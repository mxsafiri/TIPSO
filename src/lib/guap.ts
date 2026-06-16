/**
 * GUAP peer-to-peer prediction market integration (guap.gold).
 *
 * GUAP is a partner-embeddable P2P exchange: users stake YES/NO against each
 * other — no house book. Winners split the pool minus fees; partners keep their
 * own fee share.
 *
 * Confirmed API surface v1 (Bearer `gp_live_…`):
 *   POST /api/v1/users                 Create or get user by externalId
 *   GET  /api/v1/markets               List markets (status / category / pagination)
 *   GET  /api/v1/markets/:id           Single market details
 *   POST /api/v1/markets               Create a market (binary | multi | Pyth auto-resolve)
 *   GET  /api/v1/categories            Valid categories, sub-categories, Pyth symbols
 *   POST /api/v1/trades                Place a trade (YES/NO stake)
 *   GET  /api/v1/trades                User's trade history
 *   GET  /api/v1/positions             User's portfolio
 *   POST /api/v1/positions/redeem      Claim winnings from resolved market
 *   POST /api/v1/positions/sell        Exit position early
 *   POST /api/v1/markets/:id/resolve   Settle own market
 *   GET  /api/v1/wallet/balance        Wallet balance
 *   POST /api/v1/wallet/deposit        M-Pesa deposit
 *   POST /api/v1/wallet/withdraw       M-Pesa withdrawal
 *
 * Fees: 5% entry at trade time + 5% settlement at redemption (~9.75% total).
 */

const DEFAULT_BASE_URL = "https://guap.gold/api/v1";

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** Internal, UI-facing market shape. The app binds to this, not the raw API. */
export interface GuapMarket {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: "OPEN" | "RESOLVED" | "unknown";
  type: "BINARY" | "MULTI" | "unknown";
  /** Crowd-implied YES probability (0–100). */
  yesPercent: number | null;
  noPercent: number | null;
  /** Total traded volume in TZS. */
  poolTzs: number | null;
  /** ISO date when market closes / resolves. */
  closesAt: string | null;
  /** Deep-link to GUAP for the stake flow. */
  url: string | null;
}

export interface GuapCategories {
  categories: string[];
  subCategories: { Sports: { value: string; label: string }[] };
  pythSymbols: {
    crypto: string[];
    fx: string[];
    commodities: string[];
    all: string[];
  };
}

export interface CreateMarketInput {
  title: string;
  description: string;
  category: string;
  subCategory?: string;
  resolvesAt: string;           // ISO 8601
  creatorExternalId: string;
  imageUrl?: string;
  // Binary
  initialProb?: number;         // 1–99: starting YES probability
  // Multi-option (2–10 options)
  options?: string[];
  optionProbs?: number[];
  // Pyth auto-resolve
  pythSymbol?: string;          // e.g. "BTC/USD"
  pythTargetPrice?: number;
  pythOperator?: "above" | "below";
}

export interface PlaceTradeInput {
  externalId: string;
  marketId: string;
  side: "YES" | "NO";
  optionIndex?: number;         // for MULTI markets
  amountTzs: number;
}

export interface GuapPosition {
  marketId: string;
  marketTitle: string;
  side: "YES" | "NO";
  stakeTzs: number | null;
  status: "open" | "won" | "lost" | "resolved";
  payoutTzs: number | null;
  redeemable: boolean;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

export function isGuapConfigured(): boolean {
  return Boolean(process.env.GUAP_API_KEY);
}

function baseUrl(): string {
  return (process.env.GUAP_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function guapFetch(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GUAP_API_KEY}`,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

// ---------------------------------------------------------------------------
// Shape normalization — single source of truth for raw → GuapMarket.
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>;

function str(o: Raw, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

function num(o: Raw, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

/** Normalize 0–1 or 0–100 probability to a clean integer percentage. */
function toPercent(value: number | null): number | null {
  if (value === null) return null;
  const pct = value <= 1 ? value * 100 : value;
  return Math.round(Math.max(0, Math.min(100, pct)));
}

export function normalizeMarket(raw: unknown): GuapMarket | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Raw;

  const id = str(o, ["id", "marketId", "market_id", "slug"]);
  const title = str(o, ["title", "question", "name"]);
  if (!id || !title) return null;

  // Prices come nested under `prices` or flat on the object.
  const prices = (typeof o.prices === "object" && o.prices !== null ? o.prices : o) as Raw;
  const yes = num(prices, ["yes", "yesPrice", "yes_price", "yesProbability", "probabilityYes"]);
  const no = num(prices, ["no", "noPrice", "no_price", "noProbability", "probabilityNo"]);
  const yesPercent = toPercent(yes);
  const noPercent = toPercent(no) ?? (yesPercent !== null ? 100 - yesPercent : null);

  const statusRaw = str(o, ["status"]) ?? "";
  const status: GuapMarket["status"] =
    statusRaw === "OPEN" ? "OPEN" : statusRaw === "RESOLVED" ? "RESOLVED" : "unknown";

  const typeRaw = str(o, ["type"]) ?? "";
  const type: GuapMarket["type"] =
    typeRaw === "BINARY" ? "BINARY" : typeRaw === "MULTI" ? "MULTI" : "unknown";

  return {
    id,
    title,
    description: str(o, ["description"]),
    category: str(o, ["category", "tag", "topic"]) ?? "Markets",
    status,
    type,
    yesPercent,
    noPercent,
    poolTzs: num(o, [
      "totalVolume", "poolTzs", "pool_tzs", "pool",
      "totalStaked", "total_staked", "stakedTzs",
      "volumeTzs", "volume_tzs", "volume", "liquidity",
    ]),
    closesAt: str(o, ["resolvesAt", "closesAt", "closes_at", "endDate", "end_date", "expiresAt"]),
    url: str(o, ["url", "link", "shareUrl", "permalink"]),
  };
}

function extractMarketArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && data !== null) {
    const o = data as Raw;
    for (const key of ["markets", "data", "results", "items"]) {
      if (Array.isArray(o[key])) return o[key] as unknown[];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Markets — list, get, create, resolve
// ---------------------------------------------------------------------------

let marketsCache: { at: number; markets: GuapMarket[] } | undefined;
const MARKETS_CACHE_MS = 60_000;

export async function listMarkets(options?: {
  status?: "OPEN" | "RESOLVED" | "ALL";
  category?: string;
  limit?: number;
  offset?: number;
  force?: boolean;
}): Promise<GuapMarket[]> {
  if (!isGuapConfigured()) return [];

  const force = options?.force ?? false;
  if (!force && marketsCache && Date.now() - marketsCache.at < MARKETS_CACHE_MS) {
    return marketsCache.markets;
  }

  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.category) params.set("category", options.category);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));
  const qs = params.toString();
  const path = `/markets${qs ? `?${qs}` : ""}`;

  try {
    const { ok, data } = await guapFetch(path);
    if (!ok) return marketsCache?.markets ?? [];

    const markets = extractMarketArray(data)
      .map(normalizeMarket)
      .filter((m): m is GuapMarket => m !== null);

    if (markets.length > 0) {
      marketsCache = { at: Date.now(), markets };
      return markets;
    }
  } catch {
    // Fall through to stale cache.
  }

  return marketsCache?.markets ?? [];
}

/** GET /markets/:id — full market details. */
export async function getMarket(id: string): Promise<GuapMarket | null> {
  if (!isGuapConfigured()) return null;
  try {
    const { ok, data } = await guapFetch(`/markets/${encodeURIComponent(id)}`);
    if (!ok) return null;
    const o = data as Raw;
    const raw = typeof o.market === "object" && o.market !== null ? o.market : data;
    return normalizeMarket(raw);
  } catch {
    return null;
  }
}

/** POST /markets — create a binary, multi-option, or Pyth auto-resolve market. */
export async function createMarket(input: CreateMarketInput): Promise<{
  ok: boolean;
  market?: GuapMarket;
  creationFee?: number;
  error?: string;
}> {
  if (!isGuapConfigured()) return { ok: false, error: "GUAP not configured" };
  try {
    const { ok, status, data } = await guapFetch("/markets", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const o = (data ?? {}) as Raw;
    if (!ok) {
      return {
        ok: false,
        error: str(o, ["error", "message"]) ?? `Market creation failed (${status})`,
      };
    }
    const marketRaw = typeof o.market === "object" && o.market !== null ? o.market : data;
    const market = normalizeMarket(marketRaw) ?? undefined;
    const creationFee = num(o, ["creationFee", "fee", "creation_fee"]) ?? undefined;
    // Bust the list cache so the new market shows immediately.
    marketsCache = undefined;
    return { ok: true, market, creationFee };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Create market error" };
  }
}

/** POST /markets/:id/resolve — settle your own market. */
export async function resolveMarket(
  marketId: string,
  outcome: number, // 0 = NO/false, 1 = YES/true, or option index for MULTI
): Promise<{ ok: boolean; error?: string }> {
  if (!isGuapConfigured()) return { ok: false, error: "GUAP not configured" };
  try {
    const { ok, status, data } = await guapFetch(`/markets/${encodeURIComponent(marketId)}/resolve`, {
      method: "POST",
      body: JSON.stringify({ outcome }),
    });
    const o = (data ?? {}) as Raw;
    if (!ok) {
      return { ok: false, error: str(o, ["error", "message"]) ?? `Resolve failed (${status})` };
    }
    marketsCache = undefined;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Resolve error" };
  }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

let categoriesCache: { at: number; data: GuapCategories } | undefined;
const CATEGORIES_CACHE_MS = 3_600_000; // 1 hour — these rarely change

export async function getCategories(): Promise<GuapCategories | null> {
  if (!isGuapConfigured()) return null;
  if (categoriesCache && Date.now() - categoriesCache.at < CATEGORIES_CACHE_MS) {
    return categoriesCache.data;
  }
  try {
    const { ok, data } = await guapFetch("/categories");
    if (!ok || !data) return null;
    const o = data as Raw;
    const result: GuapCategories = {
      categories: Array.isArray(o.categories) ? (o.categories as string[]) : [],
      subCategories: (o.subCategories as GuapCategories["subCategories"]) ?? { Sports: [] },
      pythSymbols: (o.pythSymbols as GuapCategories["pythSymbols"]) ?? {
        crypto: [], fx: [], commodities: [], all: [],
      },
    };
    if (result.categories.length > 0) {
      categoriesCache = { at: Date.now(), data: result };
    }
    return result;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Trading
// ---------------------------------------------------------------------------

/** POST /trades — stake YES/NO on a GUAP market. */
export async function placeTrade(
  input: PlaceTradeInput,
): Promise<{ ok: boolean; tradeId?: string; shares?: number; fee?: number; error?: string }> {
  if (!isGuapConfigured()) return { ok: false, error: "GUAP not configured" };
  try {
    const { ok, status, data } = await guapFetch("/trades", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const o = (data ?? {}) as Raw;
    if (!ok) {
      return { ok: false, error: str(o, ["error", "message"]) ?? `Trade failed (${status})` };
    }
    return {
      ok: true,
      tradeId: str(o, ["tradeId", "id", "trade_id"]) ?? undefined,
      shares: num(o, ["shares"]) ?? undefined,
      fee: num(o, ["fee"]) ?? undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Trade error" };
  }
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

function normalizePosition(raw: unknown): GuapPosition | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Raw;
  const marketId = str(o, ["marketId", "market_id", "id"]);
  if (!marketId) return null;

  const sideRaw = (str(o, ["side", "outcome", "position"]) ?? "").toUpperCase();
  const side: "YES" | "NO" = sideRaw === "NO" ? "NO" : "YES";

  const statusRaw = (str(o, ["status", "state"]) ?? "open").toLowerCase();
  const status: GuapPosition["status"] =
    statusRaw === "won" || statusRaw === "win" ? "won"
    : statusRaw === "lost" || statusRaw === "lose" ? "lost"
    : statusRaw === "resolved" || statusRaw === "settled" ? "resolved"
    : "open";

  const payoutTzs = num(o, ["payoutTzs", "payout", "winningsTzs", "winnings", "redeemableTzs"]);
  const alreadyRedeemed = o.redeemed === true || o.claimed === true;

  return {
    marketId,
    marketTitle: str(o, ["marketTitle", "market_title", "title", "question"]) ?? "Market",
    side,
    stakeTzs: num(o, ["stakeTzs", "stake", "amountTzs", "amount"]),
    status,
    payoutTzs,
    redeemable: !alreadyRedeemed && (status === "won" || (payoutTzs ?? 0) > 0),
  };
}

/** GET /positions — user's stake portfolio. */
export async function getPositions(externalId: string): Promise<GuapPosition[]> {
  if (!isGuapConfigured()) return [];
  try {
    const { ok, data } = await guapFetch(`/positions?externalId=${encodeURIComponent(externalId)}`);
    if (!ok) return [];
    const o = data as Raw;
    const arr = Array.isArray(o?.positions) ? (o.positions as unknown[]) : extractMarketArray(data);
    return arr.map(normalizePosition).filter((p): p is GuapPosition => p !== null);
  } catch {
    return [];
  }
}

/** POST /positions/redeem — claim winnings. */
export async function redeemPosition(
  externalId: string,
  positionId: string,
): Promise<{ ok: boolean; payoutTzs: number; error?: string }> {
  if (!isGuapConfigured()) return { ok: false, payoutTzs: 0, error: "GUAP not configured" };
  try {
    const { ok, status, data } = await guapFetch("/positions/redeem", {
      method: "POST",
      body: JSON.stringify({ externalId, positionId }),
    });
    const o = (data ?? {}) as Raw;
    if (!ok) {
      return {
        ok: false,
        payoutTzs: 0,
        error: str(o, ["error", "message"]) ?? `Redeem failed (${status})`,
      };
    }
    return {
      ok: true,
      payoutTzs: num(o, ["payoutTzs", "payout", "winningsTzs", "winnings", "amountTzs"]) ?? 0,
    };
  } catch (e) {
    return { ok: false, payoutTzs: 0, error: e instanceof Error ? e.message : "Redeem error" };
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** POST /users — idempotently provision a GUAP user mapped to a Betua user. */
export async function ensureGuapUser(
  externalId: string,
  name: string,
  phone: string,
): Promise<string | null> {
  if (!isGuapConfigured()) return null;
  try {
    const { ok, data } = await guapFetch("/users", {
      method: "POST",
      body: JSON.stringify({ externalId, name, phone }),
    });
    if (!ok) return null;
    const o = (data ?? {}) as Raw;
    return str(o, ["id", "userId", "user_id", "externalId"]) ?? externalId;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export async function probeMarkets(): Promise<{ endpoint: string; status: number; sample: unknown }[]> {
  const out: { endpoint: string; status: number; sample: unknown }[] = [];
  for (const path of ["/markets", "/categories"]) {
    try {
      const { status, data } = await guapFetch(path);
      const arr = extractMarketArray(data);
      out.push({ endpoint: path, status, sample: arr[0] ?? data });
    } catch (e) {
      out.push({ endpoint: path, status: 0, sample: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
