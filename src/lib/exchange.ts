import type { Market, MarketSide, MarketStake, MarketView } from "./types";

/**
 * Betua peer-to-peer exchange settlement (parimutuel / pooled).
 *
 * There is no order book and no bookmaker. Everyone who staked the winning
 * outcome gets their own stake back plus a pro-rata share of the losing pool,
 * minus a platform fee taken only from the losing money. Losers get nothing.
 * This means a market is ALWAYS settleable regardless of how lopsided the
 * stakes are — which is exactly what removes the matching/liquidity problem.
 */

/** Betua's cut, taken only from the losing pool (never from a winner's stake). */
export const PLATFORM_FEE = 0.05;

export const MARKET_CATEGORIES = ["Football", "Politics", "Business", "Entertainment", "Other"] as const;

export function isMarketOpen(m: Market, now = Date.now()): boolean {
  return m.status === "open" && new Date(m.closesAt).getTime() > now;
}

export function hasClosed(m: Market, now = Date.now()): boolean {
  return new Date(m.closesAt).getTime() <= now;
}

function round(n: number): number {
  return Math.round(n);
}

export function computeMarketView(market: Market, stakes: MarketStake[]): MarketView {
  let yes = 0;
  let no = 0;
  const stakers = new Set<string>();
  for (const s of stakes) {
    stakers.add(s.userId);
    if (s.side === "YES") yes += s.amountTzs;
    else no += s.amountTzs;
  }
  const total = yes + no;
  return {
    ...market,
    yesPoolTzs: yes,
    noPoolTzs: no,
    totalPoolTzs: total,
    // Crowd-implied probability = share of the pool on each side.
    yesPercent: total > 0 ? Math.round((yes / total) * 100) : null,
    noPercent: total > 0 ? Math.round((no / total) * 100) : null,
    stakerCount: stakers.size,
  };
}

export interface SettlementLine {
  stakeId: string;
  userId: string;
  payoutTzs: number;
}

export interface Settlement {
  /** True when the market is voided and every stake is refunded. */
  voided: boolean;
  lines: SettlementLine[];
  /** Total credited back to users. */
  paidOutTzs: number;
  /** Betua's retained fee (from the losing pool). */
  feeTzs: number;
}

/**
 * Compute per-stake payouts for a resolved outcome.
 * - Winners: own stake back + pro-rata share of losingPool*(1-fee).
 * - Losers: zero.
 * - If no one staked the winning side, the market is VOID → refund everyone.
 */
export function computeSettlement(
  stakes: MarketStake[],
  outcome: MarketSide,
  fee = PLATFORM_FEE,
): Settlement {
  const winners = stakes.filter((s) => s.side === outcome);
  const losers = stakes.filter((s) => s.side !== outcome);
  const winningPool = winners.reduce((a, s) => a + s.amountTzs, 0);
  const losingPool = losers.reduce((a, s) => a + s.amountTzs, 0);

  // No winners staked → can't fairly assign the pool. Refund all.
  if (winningPool === 0) {
    return {
      voided: true,
      lines: stakes.map((s) => ({ stakeId: s.id, userId: s.userId, payoutTzs: s.amountTzs })),
      paidOutTzs: stakes.reduce((a, s) => a + s.amountTzs, 0),
      feeTzs: 0,
    };
  }

  const distributable = losingPool * (1 - fee);
  const lines: SettlementLine[] = winners.map((s) => ({
    stakeId: s.id,
    userId: s.userId,
    payoutTzs: round(s.amountTzs + (s.amountTzs / winningPool) * distributable),
  }));
  const paidOut = lines.reduce((a, l) => a + l.payoutTzs, 0);

  return {
    voided: false,
    lines,
    paidOutTzs: paidOut,
    feeTzs: round(losingPool - distributable),
  };
}
