import { memoryStore } from "./store/memory";
import { postgresStore } from "./store/postgres";
import { getPlan } from "./plans";
import { newId, newReference, verifyPassword as verify } from "./password";
import type { DataStore } from "./store/types";
import type { PublicUser, Subscription, Transaction, User } from "./types";

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
