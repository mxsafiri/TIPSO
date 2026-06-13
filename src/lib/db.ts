import { memoryStore } from "./store/memory";
import { postgresStore } from "./store/postgres";
import { getPlan } from "./plans";
import { newId, newReference, verifyPassword as verify } from "./password";
import { computeMarketView, computeSettlement, hasClosed, isMarketOpen } from "./exchange";
import type { DataStore } from "./store/types";
import type {
  Market,
  MarketSide,
  MarketStake,
  MarketView,
  PublicUser,
  Subscription,
  Transaction,
  User,
} from "./types";

/**
 * Single data-access entry point. Uses Neon Postgres when DATABASE_URL is set
 * (production / Vercel); falls back to the seeded in-memory store for local
 * development without a database.
 */
export const store: DataStore = process.env.DATABASE_URL ? postgresStore : memoryStore;

export function verifyPassword(user: User, password: string): boolean {
  return verify(user.passwordHash, user.passwordSalt, password);
}

export async function toPublicUser(user: User): Promise<PublicUser> {
  const sub = await store.getActiveSubscription(user.id);
  const plan = sub ? getPlan(sub.planId) : undefined;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    walletTzs: user.walletTzs,
    referralCode: user.referralCode,
    subscription: sub && plan ? { ...sub, planName: plan.name } : null,
  };
}

/**
 * Activate a plan for a user. `paid: false` records a pending transaction that
 * is completed later by a payment webhook; `paid: true` (wallet or simulated
 * payment) activates immediately.
 */
export async function activateSubscription(
  userId: string,
  planId: string,
  provider: Transaction["provider"],
  phone: string | undefined,
  paid: boolean,
  reference?: string,
): Promise<{ subscription: Subscription | null; transaction: Transaction }> {
  const plan = getPlan(planId);
  if (!plan) throw new Error("Unknown plan");

  if (provider === "wallet") {
    await store.adjustWallet(userId, -plan.priceTzs);
  }

  const transaction = await store.createTransaction({
    userId,
    type: "subscription",
    description: plan.name,
    amountTzs: plan.priceTzs,
    provider,
    phone: provider === "wallet" ? undefined : phone,
    status: paid ? "completed" : "pending",
    reference: reference ?? newReference(),
    planId: plan.id,
  });

  if (!paid) return { subscription: null, transaction };

  const subscription = await startPlan(userId, plan.id, plan.durationDays);
  return { subscription, transaction };
}

async function startPlan(userId: string, planId: Subscription["planId"], durationDays: number) {
  await store.deactivateSubscriptions(userId);
  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + durationDays);
  const subscription: Subscription = {
    id: newId("sub"),
    userId,
    planId,
    startedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    active: true,
  };
  await store.createSubscription(subscription);
  return subscription;
}

/**
 * Called by payment webhooks when a pending collection settles. Completes the
 * transaction and applies its effect (plan activation or wallet credit).
 */
export async function settleTransaction(reference: string): Promise<Transaction | null> {
  const tx = await store.findTransactionByReference(reference);
  return tx ? settleTransactionRecord(tx) : null;
}

/**
 * Best-effort reconciliation of a user's pending nTZS payments by polling
 * deposit status — covers the gap until settlement webhooks are configured.
 * Safe to call on every login: bounded, throttled per process, never throws.
 */
const reconcileLastRun = new Map<string, number>();

export async function reconcilePendingTransactions(userId: string): Promise<void> {
  const last = reconcileLastRun.get(userId) ?? 0;
  if (Date.now() - last < 60_000) return;
  reconcileLastRun.set(userId, Date.now());

  try {
    const { ntzsDepositStatus, isSettledStatus, isFailedStatus, isNtzsConfigured } = await import(
      "./payments"
    );
    if (!isNtzsConfigured()) return;
    const pending = (await store.getPendingTransactions(userId)).filter(
      (t) => t.providerRef && Date.now() - new Date(t.createdAt).getTime() < 72 * 3600_000,
    );
    for (const tx of pending.slice(0, 5)) {
      const status = await ntzsDepositStatus(tx.providerRef!);
      if (!status) continue;
      if (isSettledStatus(status)) await settleTransactionRecord(tx);
      else if (isFailedStatus(status)) await store.setTransactionStatus(tx.id, "failed");
    }
  } catch {
    // Reconciliation must never break auth flows.
  }
}

export async function settleTransactionRecord(tx: Transaction): Promise<Transaction> {
  if (tx.status === "completed") return tx;

  await store.setTransactionStatus(tx.id, "completed");
  if (tx.type === "subscription" && tx.planId) {
    const plan = getPlan(tx.planId);
    if (plan) await startPlan(tx.userId, plan.id, plan.durationDays);
  } else if (tx.type === "wallet_topup") {
    await store.adjustWallet(tx.userId, tx.amountTzs);
  }
  return { ...tx, status: "completed" };
}

// ---------------------------------------------------------------------------
// Betua-native peer-to-peer exchange
// ---------------------------------------------------------------------------

const MIN_STAKE = 500;
const MAX_STAKE = 5_000_000;

async function recordStake(
  user: User,
  marketId: string,
  side: MarketSide,
  amountTzs: number,
): Promise<MarketStake> {
  // Debit the wallet into escrow; adjustWallet rejects on insufficient funds.
  await store.adjustWallet(user.id, -amountTzs);
  const stake: MarketStake = {
    id: newId("stk"),
    marketId,
    userId: user.id,
    userName: user.name,
    side,
    amountTzs,
    payoutTzs: null,
    settled: false,
    createdAt: new Date().toISOString(),
  };
  try {
    await store.createStake(stake);
  } catch (e) {
    await store.adjustWallet(user.id, amountTzs); // refund if the write fails
    throw e;
  }
  await store.createTransaction({
    userId: user.id,
    type: "stake",
    description: `Stake ${side}`,
    amountTzs,
    provider: "wallet",
    status: "completed",
    reference: newReference(),
    providerRef: marketId,
  });
  return stake;
}

/** Create a market and place the creator's opening stake atomically-ish. */
export async function createMarketWithStake(input: {
  user: User;
  question: string;
  category: string;
  closesAt: string;
  side: MarketSide;
  amountTzs: number;
}): Promise<Market> {
  const { user, question, category, closesAt, side, amountTzs } = input;
  if (amountTzs < MIN_STAKE || amountTzs > MAX_STAKE) throw new Error("Invalid stake amount");
  if (new Date(closesAt).getTime() <= Date.now()) throw new Error("Close time must be in the future");

  const market: Market = {
    id: newId("mkt"),
    creatorId: user.id,
    creatorName: user.name,
    question: question.trim().slice(0, 200),
    category,
    closesAt,
    status: "open",
    outcome: null,
    createdAt: new Date().toISOString(),
  };
  // Take the opening stake first; if it fails (e.g. no balance) no market is made.
  await recordStakePrecheck(user, amountTzs);
  await store.createMarket(market);
  await recordStake(user, market.id, side, amountTzs);
  return market;
}

async function recordStakePrecheck(user: User, amountTzs: number): Promise<void> {
  const fresh = await store.findUserById(user.id);
  if (!fresh || fresh.walletTzs < amountTzs) throw new Error("Insufficient wallet balance");
}

export async function placeMarketStake(
  user: User,
  marketId: string,
  side: MarketSide,
  amountTzs: number,
): Promise<void> {
  if (amountTzs < MIN_STAKE || amountTzs > MAX_STAKE) throw new Error("Invalid stake amount");
  const market = await store.getMarketById(marketId);
  if (!market) throw new Error("Market not found");
  if (!isMarketOpen(market)) throw new Error("Market is closed");
  await recordStakePrecheck(user, amountTzs);
  await recordStake(user, marketId, side, amountTzs);
}

/**
 * Resolve a market and pay out the pool. Only the creator or an admin may
 * resolve, and only after the close time. Idempotent: a resolved market is a
 * no-op. Winners are credited to their wallets immediately.
 */
export async function resolveMarket(
  marketId: string,
  outcome: MarketSide,
  byUserId: string | "admin",
): Promise<{ paidOutTzs: number; feeTzs: number; voided: boolean }> {
  const market = await store.getMarketById(marketId);
  if (!market) throw new Error("Market not found");
  if (market.status !== "open") throw new Error("Market already resolved");
  if (byUserId !== "admin" && market.creatorId !== byUserId) {
    throw new Error("Only the creator can resolve this market");
  }
  if (!hasClosed(market)) throw new Error("Market has not closed yet");

  const stakes = await store.getStakesByMarket(marketId);
  const settlement = computeSettlement(stakes, outcome);

  for (const line of settlement.lines) {
    await store.settleStake(line.stakeId, line.payoutTzs);
    if (line.payoutTzs > 0) {
      await store.adjustWallet(line.userId, line.payoutTzs);
      await store.createTransaction({
        userId: line.userId,
        type: "stake_winnings",
        description: settlement.voided ? "Stake refunded (void)" : `Winnings · ${outcome}`,
        amountTzs: line.payoutTzs,
        provider: "wallet",
        status: "completed",
        reference: `MKT_${marketId}_${line.stakeId}`,
      });
    }
  }
  // Mark losing stakes settled with zero payout.
  for (const s of stakes) {
    if (!settlement.lines.some((l) => l.stakeId === s.id)) {
      await store.settleStake(s.id, 0);
    }
  }

  await store.resolveMarketRecord(
    marketId,
    settlement.voided ? "void" : "resolved",
    settlement.voided ? null : outcome,
    new Date().toISOString(),
  );
  return { paidOutTzs: settlement.paidOutTzs, feeTzs: settlement.feeTzs, voided: settlement.voided };
}

export async function listMarketViews(): Promise<MarketView[]> {
  const markets = await store.getMarkets();
  const views: MarketView[] = [];
  for (const m of markets) {
    const stakes = await store.getStakesByMarket(m.id);
    views.push(computeMarketView(m, stakes));
  }
  return views;
}

export interface UserStakeView {
  stake: MarketStake;
  market: Market | undefined;
}

export async function getUserStakeViews(userId: string): Promise<UserStakeView[]> {
  const stakes = await store.getStakesByUser(userId);
  const out: UserStakeView[] = [];
  for (const s of stakes) {
    out.push({ stake: s, market: await store.getMarketById(s.marketId) });
  }
  return out;
}
