import type { Sport } from "./types";

/**
 * Canonical betting markets TIPSO predicts. Every market is settleable from a
 * final score, so any pick — whether from the strength model or the AI tipster
 * — grades mechanically. Labels are bilingual; `settle` is the single source of
 * truth for win/loss grading.
 */
export type MarketKey =
  | "home_win"
  | "away_win"
  | "draw_or_home"
  | "draw_or_away"
  | "over_1_5"
  | "over_2_5"
  | "under_2_5"
  | "under_3_5"
  | "btts";

export interface MarketDef {
  key: MarketKey;
  /** Renders the display label, e.g. "France to Win". */
  labelEn: (home: string, away: string) => string;
  labelSw: (home: string, away: string) => string;
  /** Typical fair odds, used to clamp AI estimates and as a fallback. */
  baseOdds: number;
  /** Mechanical settlement from the full-time score. */
  settle: (homeGoals: number, awayGoals: number) => boolean;
  /** Football only, or applicable to all sports. */
  sports: Sport[];
}

const ALL: Sport[] = ["football", "basketball", "tennis"];
const FOOTBALL: Sport[] = ["football"];

export const MARKETS: Record<MarketKey, MarketDef> = {
  home_win: {
    key: "home_win",
    labelEn: (h) => `${h} to Win`,
    labelSw: (h) => `${h} Kushinda`,
    baseOdds: 1.55,
    settle: (h, a) => h > a,
    sports: ALL,
  },
  away_win: {
    key: "away_win",
    labelEn: (_h, a) => `${a} to Win`,
    labelSw: (_h, a) => `${a} Kushinda`,
    baseOdds: 2.3,
    settle: (h, a) => a > h,
    sports: ALL,
  },
  draw_or_home: {
    key: "draw_or_home",
    labelEn: (h) => `Draw or ${h}`,
    labelSw: (h) => `Sare au ${h}`,
    baseOdds: 1.3,
    settle: (h, a) => h >= a,
    sports: FOOTBALL,
  },
  draw_or_away: {
    key: "draw_or_away",
    labelEn: (_h, a) => `Draw or ${a}`,
    labelSw: (_h, a) => `Sare au ${a}`,
    baseOdds: 1.45,
    settle: (h, a) => a >= h,
    sports: FOOTBALL,
  },
  over_1_5: {
    key: "over_1_5",
    labelEn: () => "Over 1.5 Goals",
    labelSw: () => "Zaidi ya Magoli 1.5",
    baseOdds: 1.4,
    settle: (h, a) => h + a > 1.5,
    sports: FOOTBALL,
  },
  over_2_5: {
    key: "over_2_5",
    labelEn: () => "Over 2.5 Goals",
    labelSw: () => "Zaidi ya Magoli 2.5",
    baseOdds: 1.9,
    settle: (h, a) => h + a > 2.5,
    sports: FOOTBALL,
  },
  under_2_5: {
    key: "under_2_5",
    labelEn: () => "Under 2.5 Goals",
    labelSw: () => "Chini ya Magoli 2.5",
    baseOdds: 1.85,
    settle: (h, a) => h + a < 2.5,
    sports: FOOTBALL,
  },
  under_3_5: {
    key: "under_3_5",
    labelEn: () => "Under 3.5 Goals",
    labelSw: () => "Chini ya Magoli 3.5",
    baseOdds: 1.4,
    settle: (h, a) => h + a < 3.5,
    sports: FOOTBALL,
  },
  btts: {
    key: "btts",
    labelEn: () => "Both Teams to Score",
    labelSw: () => "Timu Zote Kufunga",
    baseOdds: 1.75,
    settle: (h, a) => h > 0 && a > 0,
    sports: FOOTBALL,
  },
};

export const MARKET_KEYS = Object.keys(MARKETS) as MarketKey[];

export function isMarketKey(value: unknown): value is MarketKey {
  return typeof value === "string" && value in MARKETS;
}

/** Clamp an odds estimate to a sane band around the market's base price. */
export function clampOdds(market: MarketKey, odds: number): number {
  const base = MARKETS[market].baseOdds;
  const lo = Math.max(1.15, base * 0.65);
  const hi = Math.min(4.5, base * 1.8);
  const clamped = Math.min(hi, Math.max(lo, odds));
  return Math.round(clamped * 100) / 100;
}
