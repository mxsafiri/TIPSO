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
  type: "subscription" | "wallet_topup" | "referral_bonus";
  description: string;
  amountTzs: number;
  provider: PaymentProvider | "wallet";
  phone?: string;
  status: "pending" | "completed" | "failed";
  reference: string;
  createdAt: string;
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
