export type Sport = "football" | "basketball" | "tennis";

export type TipStatus = "pending" | "won" | "lost" | "void";

export interface Tip {
  id: string;
  sport: Sport;
  league: string;
  home: string;
  away: string;
  /** Short code used for the team badge, e.g. "MCI" */
  homeCode: string;
  awayCode: string;
  homeColor: string;
  awayColor: string;
  /** ISO date of kickoff */
  kickoff: string;
  prediction: string;
  /** Swahili version of the prediction */
  predictionSw: string;
  odds: number;
  confidence: number;
  isPremium: boolean;
  isHotPick: boolean;
  status: TipStatus;
  /** Final score once settled, e.g. "2-1" */
  result?: string;
  /** Live state for the Live tab */
  live?: { minute: number; homeScore: number; awayScore: number };
  analysis: string;
  analysisSw: string;
  /** Canonical market key (for mechanical settlement of fixture-fed tips). */
  market?: string;
  /** Short bullet drivers behind the pick (TIPSO Intelligence). */
  keyFactors?: string[];
  keyFactorsSw?: string[];
  /** True when the pick + analysis came from the AI prediction engine. */
  aiGenerated?: boolean;
}

export type PlanId = "daily" | "weekly" | "vip";

export interface Plan {
  id: PlanId;
  name: string;
  nameSw: string;
  priceTzs: number;
  period: "day" | "week" | "month";
  durationDays: number;
  popular: boolean;
  features: string[];
  featuresSw: string[];
}

export type PaymentProvider = "mpesa" | "tigopesa" | "airtelmoney" | "halopesa";

export interface Subscription {
  id: string;
  userId: string;
  planId: PlanId;
  startedAt: string;
  expiresAt: string;
  active: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  type: "subscription" | "wallet_topup" | "referral_bonus" | "stake" | "stake_winnings";
  description: string;
  amountTzs: number;
  provider: PaymentProvider | "wallet" | "ntzs" | "guap";
  phone?: string;
  status: "pending" | "completed" | "failed";
  reference: string;
  /** Plan being purchased, for subscription transactions */
  planId?: PlanId;
  /** Payment-provider id (e.g. nTZS deposit id) for webhook matching */
  providerRef?: string;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  amountTzs: number;
  /** Mobile money number the payout should go to */
  destination: string;
  status: "pending" | "approved" | "paid" | "rejected";
  createdAt: string;
  processedAt?: string;
}

export type MarketSide = "YES" | "NO";
export type MarketStatus = "open" | "resolved" | "void";

/** A Betua-native peer-to-peer staking market, created by a user. */
export interface Market {
  id: string;
  creatorId: string;
  creatorName: string;
  question: string;
  category: string;
  /** ISO close time — staking is allowed until then. */
  closesAt: string;
  status: MarketStatus;
  outcome: MarketSide | null;
  createdAt: string;
  resolvedAt?: string;
}

/** A single stake placed by a user on a market. */
export interface MarketStake {
  id: string;
  marketId: string;
  userId: string;
  userName: string;
  side: MarketSide;
  amountTzs: number;
  /** Payout credited on settlement (parimutuel); null until resolved. */
  payoutTzs: number | null;
  settled: boolean;
  createdAt: string;
}

/** Market enriched with pool aggregates for display. */
export interface MarketView extends Market {
  yesPoolTzs: number;
  noPoolTzs: number;
  totalPoolTzs: number;
  yesPercent: number | null;
  noPercent: number | null;
  stakerCount: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  passwordSalt: string;
  walletTzs: number;
  referralCode: string;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  walletTzs: number;
  referralCode: string;
  subscription: (Subscription & { planName: string }) | null;
}

export interface PlatformStats {
  totalTips: number;
  settledTips: number;
  wonTips: number;
  accuracy: number;
  roi: number;
  avgOdds: number;
  currentStreak: number;
  monthly: { month: string; tips: number; accuracy: number; roi: number }[];
}
