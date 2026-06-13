/**
 * GUAP peer-to-peer staking integration (guap.gold).
 *
 * GUAP is a partner-embeddable P2P staking exchange for African events
 * (politics, sports, business): users stake YES or NO against EACH OTHER —
 * there is no bookmaker taking the other side. The YES/NO percentages are the
 * crowd's implied probability (the share of the pool on each side), not
 * house-set odds; the pool is the total staked. Winners split the pool minus
 * fees, and partners keep their fee share — a fifth TIPSO revenue stream.
 *
 * TIPSO surfaces GUAP markets alongside its fixtures so a user can go from
 * intelligence ("France to Win") to action (stake YES on a related market)
 * without leaving the app.
 *
 * Confirmed API surface (Bearer `gp_live_…`):
 *   GET  /api/v1/markets             List all markets
 *   GET  /api/v1/markets/:id         Single market details
 *   POST /api/v1/trades              Place a trade (stake YES/NO)
 *   GET  /api/v1/trades              User's trade history
 *   GET  /api/v1/positions           User's positions / portfolio
 *   POST /api/v1/positions/redeem    Redeem winnings from a resolved market
 *   GET  /api/v1/wallet/transactions Wallet history
 *   POST /api/v1/users               Provision a user
 *
 * Notes:
 * - There is NO create-market endpoint — markets are GUAP-curated, and
 *   liquidity is pooled across GUAP's whole partner network (TIPSO users are
 *   matched against everyone, not just each other).
 * - Settlement is PULL-based: poll GET /positions for resolved markets, then
 *   POST /positions/redeem to claim winnings into the wallet. No webhook needed.
 *
 * The per-market response field names aren't documented to us yet, so the
 * body shape is isolated in normalizeMarket — hit /api/guap-status once the key
 * is live to see the real fields. Gated on GUAP_API_KEY; absent, the Markets
 * tab stays hidden.
 */

const DEFAULT_BASE_URL = "https://guap.gold/api/v1";

/** Internal, UI-facing market shape. The app binds to this, not the raw API. */
export interface GuapMarket {
  id: string;
  title: string;
  category: string;
  /** Crowd-implied YES probability (share of the pool staked YES), 0-100. */
  yesPercent: number | null;
  noPercent: number | null;
  /** Total staked in the market pool, TZS. */
  poolTzs: number | null;
  closesAt: string | null;
  /** External link to the market on GUAP, for the deep-link stake flow. */
  url: string | null;
}

export function isGuapConfigured(): boolean {
  return Boolean(process.env.GUAP_API_KEY);
}

function baseUrl(): string {
  return (process.env.GUAP_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

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
// Shape normalization — the ONLY place that assumes the raw market layout.
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

/** Prediction-market prices come as 0-1 probabilities or 0-100 — normalize to %. */
function toPercent(value: number | null): number | null {
  if (value === null) return null;
  const pct = value <= 1 ? value * 100 : value;
  return Math.round(Math.max(0, Math.min(100, pct)));
}

export function normalizeMarket(raw: unknown): GuapMarket | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Raw;
  const id = str(o, ["id", "marketId", "market_id", "slug"]);
  const title = str(o, ["title", "question", "name", "description"]);
  if (!id || !title) return null;

  const prices = (typeof o.prices === "object" && o.prices !== null ? o.prices : o) as Raw;
  const yes = num(prices, ["yes", "yesPrice", "yes_price", "yesProbability", "probabilityYes"]);
  const no = num(prices, ["no", "noPrice", "no_price", "noProbability", "probabilityNo"]);
  const yesPercent = toPercent(yes);
  // If only YES is given, NO is its complement.
  const noPercent = toPercent(no) ?? (yesPercent !== null ? 100 - yesPercent : null);

  return {
    id,
    title,
    category: str(o, ["category", "type", "tag", "topic"]) ?? "Markets",
    yesPercent,
    noPercent,
    poolTzs: num(o, [
      "poolTzs",
      "pool_tzs",
      "pool",
      "totalStaked",
      "total_staked",
      "stakedTzs",
      "volumeTzs",
      "volume_tzs",
      "volume",
      "liquidity",
    ]),
    closesAt: str(o, ["closesAt", "closes_at", "endDate", "end_date", "resolutionDate", "expiresAt"]),
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

/** Documented market-list endpoint (kept as a list for the diagnostics probe). */
const MARKET_ENDPOINTS = ["/markets"];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let cache: { at: number; markets: GuapMarket[] } | undefined;
const CACHE_MS = 60_000;

export async function listMarkets(force = false): Promise<GuapMarket[]> {
  if (!isGuapConfigured()) return [];
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.markets;

  for (const path of MARKET_ENDPOINTS) {
    try {
      const { ok, data } = await guapFetch(path);
      if (!ok) continue;
      const markets = extractMarketArray(data)
        .map(normalizeMarket)
        .filter((m): m is GuapMarket => m !== null);
      if (markets.length > 0) {
        cache = { at: Date.now(), markets };
        return markets;
      }
    } catch {
      // Try the next candidate endpoint.
    }
  }
  return cache?.markets ?? [];
}

/** Single market details via GET /markets/:id. */
export async function getMarket(id: string): Promise<GuapMarket | null> {
  if (!isGuapConfigured()) return null;
  try {
    const { ok, data } = await guapFetch(`/markets/${encodeURIComponent(id)}`);
    if (!ok) return null;
    const obj =
      typeof data === "object" && data !== null && "market" in (data as Raw)
        ? (data as Raw).market
        : data;
    return normalizeMarket(obj);
  } catch {
    return null;
  }
}

/** Raw probe for diagnostics — surfaces the real shape, exposes no secrets. */
export async function probeMarkets(): Promise<{ endpoint: string; status: number; sample: unknown }[]> {
  const out: { endpoint: string; status: number; sample: unknown }[] = [];
  for (const path of MARKET_ENDPOINTS) {
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

/**
 * Provision (idempotently) a GUAP user mapped to a TIPSO user. Used by the
 * wallet-funded trade flow (phase 2) — externalId is our user id, so positions
 * and settlements map cleanly back to the TIPSO account.
 */
export async function ensureGuapUser(externalId: string, name: string, phone: string): Promise<string | null> {
  if (!isGuapConfigured()) return null;
  try {
    const { ok, data } = await guapFetch("/users", {
      method: "POST",
      body: JSON.stringify({ externalId, name, phone }),
    });
    if (!ok) return null;
    const o = (data ?? {}) as Raw;
    return str(o, ["id", "userId", "user_id"]) ?? externalId;
  } catch {
    return null;
  }
}

/** A user's stake in a market, as shown in their Betua portfolio. */
export interface GuapPosition {
  marketId: string;
  marketTitle: string;
  side: "YES" | "NO";
  stakeTzs: number | null;
  status: "open" | "won" | "lost" | "resolved";
  payoutTzs: number | null;
  /** True when there are unredeemed winnings to claim into the wallet. */
  redeemable: boolean;
}

function normalizePosition(raw: unknown): GuapPosition | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Raw;
  const marketId = str(o, ["marketId", "market_id", "id"]);
  if (!marketId) return null;
  const sideRaw = (str(o, ["side", "outcome", "position"]) ?? "").toUpperCase();
  const side: "YES" | "NO" = sideRaw === "NO" ? "NO" : "YES";
  const statusRaw = (str(o, ["status", "state"]) ?? "open").toLowerCase();
  const status: GuapPosition["status"] =
    statusRaw === "won" || statusRaw === "win"
      ? "won"
      : statusRaw === "lost" || statusRaw === "lose"
        ? "lost"
        : statusRaw === "resolved" || statusRaw === "settled"
          ? "resolved"
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

/** GET /positions — the user's portfolio of stakes. */
export async function getPositions(externalId: string): Promise<GuapPosition[]> {
  if (!isGuapConfigured()) return [];
  try {
    const { ok, data } = await guapFetch(`/positions?externalId=${encodeURIComponent(externalId)}`);
    if (!ok) return [];
    const arr = extractMarketArray(data); // same {data|results|items|positions} unwrapping
    if (Array.isArray((data as Raw)?.positions)) {
      return ((data as Raw).positions as unknown[]).map(normalizePosition).filter((p): p is GuapPosition => p !== null);
    }
    return arr.map(normalizePosition).filter((p): p is GuapPosition => p !== null);
  } catch {
    return [];
  }
}

/** POST /positions/redeem — claim winnings from a resolved market. */
export async function redeemPosition(
  externalId: string,
  marketId: string,
): Promise<{ ok: boolean; payoutTzs: number; error?: string }> {
  if (!isGuapConfigured()) return { ok: false, payoutTzs: 0, error: "GUAP not configured" };
  try {
    const { ok, status, data } = await guapFetch("/positions/redeem", {
      method: "POST",
      body: JSON.stringify({ externalId, marketId }),
    });
    const o = (data ?? {}) as Raw;
    if (!ok) return { ok: false, payoutTzs: 0, error: str(o, ["error", "message"]) ?? `Redeem failed (${status})` };
    const payout = num(o, ["payoutTzs", "payout", "winningsTzs", "winnings", "amountTzs", "amount"]) ?? 0;
    return { ok: true, payoutTzs: payout };
  } catch (e) {
    return { ok: false, payoutTzs: 0, error: e instanceof Error ? e.message : "Redeem error" };
  }
}

export interface PlaceTradeInput {
  externalId: string;
  marketId: string;
  side: "YES" | "NO";
  amountTzs: number;
}

/**
 * Place a stake on GUAP (YES/NO against the peer pool). Defined for the phase-2
 * wallet-funded flow; not yet wired to the UI pending the settlement-webhook
 * spec and regulatory sign-off.
 */
export async function placeTrade(
  input: PlaceTradeInput,
): Promise<{ ok: boolean; tradeId?: string; error?: string }> {
  if (!isGuapConfigured()) return { ok: false, error: "GUAP not configured" };
  try {
    const { ok, status, data } = await guapFetch("/trades", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const o = (data ?? {}) as Raw;
    if (!ok) return { ok: false, error: str(o, ["error", "message"]) ?? `GUAP trade failed (${status})` };
    return { ok: true, tradeId: str(o, ["id", "tradeId", "trade_id"]) ?? undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "GUAP trade error" };
  }
}
