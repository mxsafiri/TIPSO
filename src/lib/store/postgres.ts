import { neon } from "@neondatabase/serverless";
import { buildSeedTips } from "../seed";
import { hashPassword, newId } from "../password";
import type { Market, MarketStake, Subscription, Tip, Transaction, User, WithdrawalRequest } from "../types";
import type { DataStore, NewTransaction } from "./types";

type Row = Record<string, unknown>;

/** Lazy client so importing this module never requires DATABASE_URL. */
let client: ReturnType<typeof neon> | undefined;

/**
 * Accepts the connection string as copied from the Neon console, including
 * the `psql 'postgresql://…'` command wrapper people paste by accident.
 */
function normalizeDatabaseUrl(raw: string): string {
  const match = raw.match(/postgres(?:ql)?:\/\/[^'"\s]+/);
  return match ? match[0] : raw;
}

function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(normalizeDatabaseUrl(url));
  }
  return client(strings, ...values) as Promise<Row[]>;
}

/**
 * Schema bootstrap. Runs once per process; creates tables if missing and
 * seeds demo data on an empty database, so a fresh Neon database needs no
 * manual migration step before the first deploy.
 */
let readyPromise: Promise<void> | undefined;

function ensureReady(): Promise<void> {
  if (!readyPromise) readyPromise = bootstrap();
  return readyPromise;
}

async function bootstrap(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      wallet_tzs INTEGER NOT NULL DEFAULT 0,
      referral_code TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      plan_id TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_tzs INTEGER NOT NULL,
      provider TEXT NOT NULL,
      phone TEXT,
      status TEXT NOT NULL,
      reference TEXT NOT NULL UNIQUE,
      plan_id TEXT,
      provider_ref TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // Lightweight migration for databases created before provider_ref existed.
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS provider_ref TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      amount_tzs INTEGER NOT NULL,
      destination TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      processed_at TIMESTAMPTZ
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS tips (
      id TEXT PRIMARY KEY,
      sport TEXT NOT NULL,
      league TEXT NOT NULL,
      home TEXT NOT NULL,
      away TEXT NOT NULL,
      home_code TEXT NOT NULL,
      away_code TEXT NOT NULL,
      home_color TEXT NOT NULL,
      away_color TEXT NOT NULL,
      kickoff TIMESTAMPTZ NOT NULL,
      prediction TEXT NOT NULL,
      prediction_sw TEXT NOT NULL,
      odds REAL NOT NULL,
      confidence INTEGER NOT NULL,
      is_premium BOOLEAN NOT NULL DEFAULT FALSE,
      is_hot_pick BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      live_minute INTEGER,
      live_home_score INTEGER,
      live_away_score INTEGER,
      analysis TEXT NOT NULL DEFAULT '',
      analysis_sw TEXT NOT NULL DEFAULT '',
      market TEXT,
      key_factors JSONB,
      key_factors_sw JSONB,
      ai_generated BOOLEAN NOT NULL DEFAULT FALSE
    )`;
  // Migrations for databases created before the AI prediction engine.
  await sql`ALTER TABLE tips ADD COLUMN IF NOT EXISTS market TEXT`;
  await sql`ALTER TABLE tips ADD COLUMN IF NOT EXISTS key_factors JSONB`;
  await sql`ALTER TABLE tips ADD COLUMN IF NOT EXISTS key_factors_sw JSONB`;
  await sql`ALTER TABLE tips ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT FALSE`;
  // Rebrand: migrate the demo account email on databases seeded as TIPSO.
  await sql`UPDATE users SET email = 'demo@betua.co.tz' WHERE email = 'demo@tipso.co.tz'`;
  await sql`
    CREATE TABLE IF NOT EXISTS payment_events (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS markets (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL REFERENCES users(id),
      creator_name TEXT NOT NULL,
      question TEXT NOT NULL,
      category TEXT NOT NULL,
      closes_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      outcome TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolved_at TIMESTAMPTZ
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS market_stakes (
      id TEXT PRIMARY KEY,
      market_id TEXT NOT NULL REFERENCES markets(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      user_name TEXT NOT NULL,
      side TEXT NOT NULL,
      amount_tzs INTEGER NOT NULL,
      payout_tzs INTEGER,
      settled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_stakes_market ON market_stakes(market_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_stakes_user ON market_stakes(user_id)`;

  await seedIfEmpty();
  if (process.env.FOOTBALL_DATA_API_KEY) {
    // Live-feed mode: the ledger holds only real picks. Remove any demo
    // fixtures and the fabricated demo track record.
    await sql`DELETE FROM tips WHERE id NOT LIKE 'wc\\_%' ESCAPE '\\'`;
  } else {
    await refreshFixturesIfStale();
  }
}

async function seedIfEmpty(): Promise<void> {
  const [{ count: userCount }] = (await sql`SELECT count(*)::int AS count FROM users`) as Row[] as {
    count: number;
  }[];
  if (userCount === 0) {
    const demo = hashPassword("demo1234");
    const started = new Date();
    started.setDate(started.getDate() - 2);
    const expires = new Date();
    expires.setDate(expires.getDate() + 5);
    await sql`
      INSERT INTO users (id, name, email, phone, password_hash, password_salt, wallet_tzs, referral_code)
      VALUES ('usr_demo', 'John Mbeya', 'demo@betua.co.tz', '+255 712 345 678',
              ${demo.hash}, ${demo.salt}, 45000, 'JOHN255')`;
    await sql`
      INSERT INTO subscriptions (id, user_id, plan_id, started_at, expires_at, active)
      VALUES ('sub_demo', 'usr_demo', 'weekly', ${started.toISOString()}, ${expires.toISOString()}, TRUE)`;
    await sql`
      INSERT INTO transactions (id, user_id, type, description, amount_tzs, provider, phone, status, reference, created_at)
      VALUES ('txn_seed_1', 'usr_demo', 'subscription', 'Weekly Plan', 10000, 'mpesa',
              '+255 712 345 678', 'completed', 'TPS8F2K1Q', ${started.toISOString()}),
             ('txn_seed_2', 'usr_demo', 'referral_bonus', 'Referral bonus — 3 friends joined', 15000,
              'wallet', NULL, 'completed', 'TPSREF003', now() - interval '21 days')`;
  }

  // Demo tips exist only in demo mode; live-feed mode starts from a clean
  // ledger and fills with real fixtures.
  if (process.env.FOOTBALL_DATA_API_KEY) return;
  const [{ count: tipCount }] = (await sql`SELECT count(*)::int AS count FROM tips`) as Row[] as {
    count: number;
  }[];
  if (tipCount === 0) {
    await insertTips(buildSeedTips());
  }
}

/**
 * Demo fixtures age out (kickoffs are seeded relative to "today"). When no
 * pending tip is in the future, replace pending fixtures with a fresh batch so
 * the app always has a live "Mkeka wa Leo". Settled history is never touched.
 */
async function refreshFixturesIfStale(): Promise<void> {
  // Live-feed mode: real fixtures come from the World Cup sync — never
  // (re)create demo fixtures.
  if (process.env.FOOTBALL_DATA_API_KEY) return;
  const rows = (await sql`
    SELECT count(*)::int AS count FROM tips WHERE status = 'pending' AND kickoff > now()`) as {
    count: number;
  }[];
  if (rows[0].count > 0) return;
  await sql`DELETE FROM tips WHERE status = 'pending'`;
  const fresh = buildSeedTips().filter((t) => t.status === "pending");
  await insertTips(fresh.map((t) => ({ ...t, id: newId("tip") })));
}

async function insertTips(tips: Tip[]): Promise<void> {
  for (const t of tips) {
    await sql`
      INSERT INTO tips (id, sport, league, home, away, home_code, away_code, home_color, away_color,
                        kickoff, prediction, prediction_sw, odds, confidence, is_premium, is_hot_pick,
                        status, result, live_minute, live_home_score, live_away_score, analysis, analysis_sw,
                        market, key_factors, key_factors_sw, ai_generated)
      VALUES (${t.id}, ${t.sport}, ${t.league}, ${t.home}, ${t.away}, ${t.homeCode}, ${t.awayCode},
              ${t.homeColor}, ${t.awayColor}, ${t.kickoff}, ${t.prediction}, ${t.predictionSw},
              ${t.odds}, ${t.confidence}, ${t.isPremium}, ${t.isHotPick}, ${t.status},
              ${t.result ?? null}, ${t.live?.minute ?? null}, ${t.live?.homeScore ?? null},
              ${t.live?.awayScore ?? null}, ${t.analysis}, ${t.analysisSw},
              ${t.market ?? null}, ${JSON.stringify(t.keyFactors ?? null)}::jsonb,
              ${JSON.stringify(t.keyFactorsSw ?? null)}::jsonb, ${t.aiGenerated ?? false})
      ON CONFLICT (id) DO NOTHING`;
  }
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapUser(r: Row): User {
  return {
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    phone: r.phone as string,
    passwordHash: r.password_hash as string,
    passwordSalt: r.password_salt as string,
    walletTzs: r.wallet_tzs as number,
    referralCode: r.referral_code as string,
    createdAt: toIso(r.created_at),
  };
}

function mapSubscription(r: Row): Subscription {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    planId: r.plan_id as Subscription["planId"],
    startedAt: toIso(r.started_at),
    expiresAt: toIso(r.expires_at),
    active: r.active as boolean,
  };
}

function mapTransaction(r: Row): Transaction {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    type: r.type as Transaction["type"],
    description: r.description as string,
    amountTzs: r.amount_tzs as number,
    provider: r.provider as Transaction["provider"],
    phone: (r.phone as string | null) ?? undefined,
    status: r.status as Transaction["status"],
    reference: r.reference as string,
    planId: (r.plan_id as Transaction["planId"] | null) ?? undefined,
    providerRef: (r.provider_ref as string | null) ?? undefined,
    createdAt: toIso(r.created_at),
  };
}

function mapTip(r: Row): Tip {
  return {
    id: r.id as string,
    sport: r.sport as Tip["sport"],
    league: r.league as string,
    home: r.home as string,
    away: r.away as string,
    homeCode: r.home_code as string,
    awayCode: r.away_code as string,
    homeColor: r.home_color as string,
    awayColor: r.away_color as string,
    kickoff: toIso(r.kickoff),
    prediction: r.prediction as string,
    predictionSw: r.prediction_sw as string,
    odds: r.odds as number,
    confidence: r.confidence as number,
    isPremium: r.is_premium as boolean,
    isHotPick: r.is_hot_pick as boolean,
    status: r.status as Tip["status"],
    result: (r.result as string | null) ?? undefined,
    live:
      r.live_minute != null
        ? {
            minute: r.live_minute as number,
            homeScore: r.live_home_score as number,
            awayScore: r.live_away_score as number,
          }
        : undefined,
    analysis: r.analysis as string,
    analysisSw: r.analysis_sw as string,
    market: (r.market as string | null) ?? undefined,
    keyFactors: parseStringArray(r.key_factors),
    keyFactorsSw: parseStringArray(r.key_factors_sw),
    aiGenerated: Boolean(r.ai_generated),
  };
}

/** JSONB columns arrive parsed from the Neon driver; tolerate string too. */
function parseStringArray(value: unknown): string[] | undefined {
  let v = value;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(v)) return undefined;
  const arr = v.filter((x): x is string => typeof x === "string");
  return arr.length > 0 ? arr : undefined;
}

// ---------------------------------------------------------------------------
// DataStore implementation
// ---------------------------------------------------------------------------

export const postgresStore: DataStore = {
  async findUserByEmail(email) {
    await ensureReady();
    const rows = (await sql`SELECT * FROM users WHERE lower(email) = lower(${email}) LIMIT 1`) as Row[];
    return rows[0] ? mapUser(rows[0]) : undefined;
  },

  async findUserById(id) {
    await ensureReady();
    const rows = (await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`) as Row[];
    return rows[0] ? mapUser(rows[0]) : undefined;
  },

  async createUser(input) {
    await ensureReady();
    const { hash, salt } = hashPassword(input.password);
    const user: User = {
      id: newId("usr"),
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash: hash,
      passwordSalt: salt,
      walletTzs: 0,
      referralCode: `${input.name.split(" ")[0].toUpperCase().slice(0, 6)}${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
    };
    await sql`
      INSERT INTO users (id, name, email, phone, password_hash, password_salt, wallet_tzs, referral_code, created_at)
      VALUES (${user.id}, ${user.name}, ${user.email}, ${user.phone}, ${user.passwordHash},
              ${user.passwordSalt}, ${user.walletTzs}, ${user.referralCode}, ${user.createdAt})`;
    return user;
  },

  async adjustWallet(userId, deltaTzs) {
    await ensureReady();
    const rows = (await sql`
      UPDATE users SET wallet_tzs = wallet_tzs + ${deltaTzs}
      WHERE id = ${userId} AND wallet_tzs + ${deltaTzs} >= 0
      RETURNING id`) as Row[];
    if (rows.length === 0) throw new Error("Insufficient wallet balance");
  },

  async getActiveSubscription(userId) {
    await ensureReady();
    const rows = (await sql`
      SELECT * FROM subscriptions
      WHERE user_id = ${userId} AND active = TRUE AND expires_at > now()
      ORDER BY expires_at DESC LIMIT 1`) as Row[];
    return rows[0] ? mapSubscription(rows[0]) : undefined;
  },

  async deactivateSubscriptions(userId) {
    await ensureReady();
    await sql`UPDATE subscriptions SET active = FALSE WHERE user_id = ${userId}`;
  },

  async createSubscription(sub) {
    await ensureReady();
    await sql`
      INSERT INTO subscriptions (id, user_id, plan_id, started_at, expires_at, active)
      VALUES (${sub.id}, ${sub.userId}, ${sub.planId}, ${sub.startedAt}, ${sub.expiresAt}, ${sub.active})`;
  },

  async createTransaction(tx: NewTransaction) {
    await ensureReady();
    const full: Transaction = { ...tx, id: newId("txn"), createdAt: new Date().toISOString() };
    await sql`
      INSERT INTO transactions (id, user_id, type, description, amount_tzs, provider, phone, status, reference, plan_id, provider_ref, created_at)
      VALUES (${full.id}, ${full.userId}, ${full.type}, ${full.description}, ${full.amountTzs},
              ${full.provider}, ${full.phone ?? null}, ${full.status}, ${full.reference},
              ${full.planId ?? null}, ${full.providerRef ?? null}, ${full.createdAt})`;
    return full;
  },

  async getTransactions(userId) {
    await ensureReady();
    const rows = (await sql`
      SELECT * FROM transactions WHERE user_id = ${userId} ORDER BY created_at DESC`) as Row[];
    return rows.map(mapTransaction);
  },

  async findTransactionByReference(reference) {
    await ensureReady();
    const rows = (await sql`SELECT * FROM transactions WHERE reference = ${reference} LIMIT 1`) as Row[];
    return rows[0] ? mapTransaction(rows[0]) : undefined;
  },

  async findTransactionByProviderRef(providerRef) {
    await ensureReady();
    const rows = (await sql`SELECT * FROM transactions WHERE provider_ref = ${providerRef} LIMIT 1`) as Row[];
    return rows[0] ? mapTransaction(rows[0]) : undefined;
  },

  async getPendingTransactions(userId) {
    await ensureReady();
    const rows = userId
      ? ((await sql`
          SELECT * FROM transactions WHERE status = 'pending' AND user_id = ${userId}
          ORDER BY created_at DESC LIMIT 20`) as Row[])
      : ((await sql`
          SELECT * FROM transactions WHERE status = 'pending'
          ORDER BY created_at DESC LIMIT 100`) as Row[]);
    return rows.map(mapTransaction);
  },

  async setTransactionStatus(id, status) {
    await ensureReady();
    await sql`UPDATE transactions SET status = ${status} WHERE id = ${id}`;
  },

  async setTransactionProviderRef(id, providerRef) {
    await ensureReady();
    await sql`UPDATE transactions SET provider_ref = ${providerRef} WHERE id = ${id}`;
  },

  async createWithdrawalRequest(req) {
    await ensureReady();
    const full: WithdrawalRequest = {
      ...req,
      id: newId("wdr"),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await sql`
      INSERT INTO withdrawal_requests (id, user_id, amount_tzs, destination, status, created_at)
      VALUES (${full.id}, ${full.userId}, ${full.amountTzs}, ${full.destination}, ${full.status}, ${full.createdAt})`;
    return full;
  },

  async getAllTips() {
    await ensureReady();
    const rows = (await sql`SELECT * FROM tips`) as Row[];
    return rows.map(mapTip);
  },

  async upsertTips(tips) {
    await ensureReady();
    for (const t of tips) {
      await sql`
        INSERT INTO tips (id, sport, league, home, away, home_code, away_code, home_color, away_color,
                          kickoff, prediction, prediction_sw, odds, confidence, is_premium, is_hot_pick,
                          status, result, live_minute, live_home_score, live_away_score, analysis, analysis_sw,
                          market, key_factors, key_factors_sw, ai_generated)
        VALUES (${t.id}, ${t.sport}, ${t.league}, ${t.home}, ${t.away}, ${t.homeCode}, ${t.awayCode},
                ${t.homeColor}, ${t.awayColor}, ${t.kickoff}, ${t.prediction}, ${t.predictionSw},
                ${t.odds}, ${t.confidence}, ${t.isPremium}, ${t.isHotPick}, ${t.status},
                ${t.result ?? null}, ${t.live?.minute ?? null}, ${t.live?.homeScore ?? null},
                ${t.live?.awayScore ?? null}, ${t.analysis}, ${t.analysisSw},
                ${t.market ?? null}, ${JSON.stringify(t.keyFactors ?? null)}::jsonb,
                ${JSON.stringify(t.keyFactorsSw ?? null)}::jsonb, ${t.aiGenerated ?? false})
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          result = EXCLUDED.result,
          is_hot_pick = EXCLUDED.is_hot_pick,
          live_minute = EXCLUDED.live_minute,
          live_home_score = EXCLUDED.live_home_score,
          live_away_score = EXCLUDED.live_away_score`;
    }
  },

  async deleteSeedTips() {
    await ensureReady();
    await sql`DELETE FROM tips WHERE id NOT LIKE 'wc\\_%' ESCAPE '\\'`;
  },

  async recordPaymentEvent(provider, eventType, payload) {
    await ensureReady();
    await sql`
      INSERT INTO payment_events (id, provider, event_type, payload)
      VALUES (${newId("evt")}, ${provider}, ${eventType}, ${JSON.stringify(payload)}::jsonb)`;
  },

  async createMarket(m) {
    await ensureReady();
    await sql`
      INSERT INTO markets (id, creator_id, creator_name, question, category, closes_at, status, outcome, created_at, resolved_at)
      VALUES (${m.id}, ${m.creatorId}, ${m.creatorName}, ${m.question}, ${m.category}, ${m.closesAt},
              ${m.status}, ${m.outcome ?? null}, ${m.createdAt}, ${m.resolvedAt ?? null})`;
  },

  async getMarkets() {
    await ensureReady();
    const rows = (await sql`SELECT * FROM markets ORDER BY created_at DESC LIMIT 200`) as Row[];
    return rows.map(mapMarket);
  },

  async getMarketById(id) {
    await ensureReady();
    const rows = (await sql`SELECT * FROM markets WHERE id = ${id} LIMIT 1`) as Row[];
    return rows[0] ? mapMarket(rows[0]) : undefined;
  },

  async resolveMarketRecord(id, status, outcome, resolvedAt) {
    await ensureReady();
    await sql`
      UPDATE markets SET status = ${status}, outcome = ${outcome ?? null}, resolved_at = ${resolvedAt}
      WHERE id = ${id}`;
  },

  async createStake(s) {
    await ensureReady();
    await sql`
      INSERT INTO market_stakes (id, market_id, user_id, user_name, side, amount_tzs, payout_tzs, settled, created_at)
      VALUES (${s.id}, ${s.marketId}, ${s.userId}, ${s.userName}, ${s.side}, ${s.amountTzs},
              ${s.payoutTzs ?? null}, ${s.settled}, ${s.createdAt})`;
  },

  async getStakesByMarket(marketId) {
    await ensureReady();
    const rows = (await sql`SELECT * FROM market_stakes WHERE market_id = ${marketId}`) as Row[];
    return rows.map(mapStake);
  },

  async getStakesByUser(userId) {
    await ensureReady();
    const rows = (await sql`SELECT * FROM market_stakes WHERE user_id = ${userId} ORDER BY created_at DESC`) as Row[];
    return rows.map(mapStake);
  },

  async settleStake(id, payoutTzs) {
    await ensureReady();
    await sql`UPDATE market_stakes SET payout_tzs = ${payoutTzs}, settled = TRUE WHERE id = ${id}`;
  },
};

function mapMarket(r: Row): Market {
  return {
    id: r.id as string,
    creatorId: r.creator_id as string,
    creatorName: r.creator_name as string,
    question: r.question as string,
    category: r.category as string,
    closesAt: toIso(r.closes_at),
    status: r.status as Market["status"],
    outcome: (r.outcome as Market["outcome"] | null) ?? null,
    createdAt: toIso(r.created_at),
    resolvedAt: r.resolved_at ? toIso(r.resolved_at) : undefined,
  };
}

function mapStake(r: Row): MarketStake {
  return {
    id: r.id as string,
    marketId: r.market_id as string,
    userId: r.user_id as string,
    userName: r.user_name as string,
    side: r.side as MarketStake["side"],
    amountTzs: r.amount_tzs as number,
    payoutTzs: (r.payout_tzs as number | null) ?? null,
    settled: Boolean(r.settled),
    createdAt: toIso(r.created_at),
  };
}
