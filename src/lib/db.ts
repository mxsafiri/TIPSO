import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import { buildSeedTips } from "./seed";
import { getPlan } from "./plans";
import type { PublicUser, Subscription, Tip, Transaction, User } from "./types";

/**
 * Lightweight persistence layer for the MVP. State lives in memory and is
 * mirrored to .data/db.json when the filesystem is writable. The data-access
 * functions below are the single integration point — swapping in Postgres or
 * another database later only touches this file.
 */
interface DbShape {
  users: User[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  tips: Tip[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

function hashPassword(password: string, salt?: string) {
  const s = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, s, 64).toString("hex");
  return { hash, salt: s };
}

export function verifyPassword(user: User, password: string): boolean {
  const { hash } = hashPassword(password, user.passwordSalt);
  return timingSafeEqual(Buffer.from(hash), Buffer.from(user.passwordHash));
}

function createSeedDb(): DbShape {
  const demoPassword = hashPassword("demo1234");
  const now = new Date();
  const started = new Date(now);
  started.setDate(started.getDate() - 2);
  const expires = new Date(now);
  expires.setDate(expires.getDate() + 5);

  const demoUser: User = {
    id: "usr_demo",
    name: "John Mbeya",
    email: "demo@tipso.co.tz",
    phone: "+255 712 345 678",
    passwordHash: demoPassword.hash,
    passwordSalt: demoPassword.salt,
    walletTzs: 45000,
    referralCode: "JOHN255",
    createdAt: new Date(now.getFullYear(), now.getMonth() - 3, 12).toISOString(),
  };

  const demoSub: Subscription = {
    id: "sub_demo",
    userId: demoUser.id,
    planId: "weekly",
    startedAt: started.toISOString(),
    expiresAt: expires.toISOString(),
    active: true,
  };

  const demoTx: Transaction[] = [
    {
      id: "txn_0003",
      userId: demoUser.id,
      type: "subscription",
      description: "Weekly Plan",
      amountTzs: 10000,
      provider: "mpesa",
      phone: demoUser.phone,
      status: "completed",
      reference: "TPS8F2K1Q",
      createdAt: started.toISOString(),
    },
    {
      id: "txn_0002",
      userId: demoUser.id,
      type: "referral_bonus",
      description: "Referral bonus — 3 friends joined",
      amountTzs: 15000,
      provider: "wallet",
      status: "completed",
      reference: "TPSREF003",
      createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 21).toISOString(),
    },
    {
      id: "txn_0001",
      userId: demoUser.id,
      type: "subscription",
      description: "Daily Plan",
      amountTzs: 2000,
      provider: "tigopesa",
      phone: demoUser.phone,
      status: "completed",
      reference: "TPS3J7MX0",
      createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 8).toISOString(),
    },
  ];

  return {
    users: [demoUser],
    subscriptions: [demoSub],
    transactions: demoTx,
    tips: buildSeedTips(),
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __tipsoDb: DbShape | undefined;
}

function load(): DbShape {
  if (globalThis.__tipsoDb) return globalThis.__tipsoDb;
  let db: DbShape | undefined;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as DbShape;
      // Tips are regenerated each boot so demo fixtures stay "today".
      db = { ...raw, tips: buildSeedTips() };
    }
  } catch {
    db = undefined;
  }
  if (!db) db = createSeedDb();
  globalThis.__tipsoDb = db;
  return db;
}

function persist(db: DbShape) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch {
    // Read-only filesystem (e.g. serverless) — in-memory state still works.
  }
}

function uid(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function findUserByEmail(email: string): User | undefined {
  return load().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(idArg: string): User | undefined {
  return load().users.find((u) => u.id === idArg);
}

export function createUser(input: { name: string; email: string; phone: string; password: string }): User {
  const db = load();
  const { hash, salt } = hashPassword(input.password);
  const user: User = {
    id: uid("usr"),
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash: hash,
    passwordSalt: salt,
    walletTzs: 0,
    referralCode: `${input.name.split(" ")[0].toUpperCase().slice(0, 6)}${Math.floor(100 + Math.random() * 900)}`,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  persist(db);
  return user;
}

export function getActiveSubscription(userId: string): Subscription | undefined {
  const db = load();
  const sub = db.subscriptions
    .filter((s) => s.userId === userId && s.active)
    .sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))[0];
  if (!sub) return undefined;
  if (new Date(sub.expiresAt) < new Date()) {
    sub.active = false;
    persist(db);
    return undefined;
  }
  return sub;
}

export function toPublicUser(user: User): PublicUser {
  const sub = getActiveSubscription(user.id);
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

// ---------------------------------------------------------------------------
// Subscriptions & payments (mobile-money flow is simulated for the MVP)
// ---------------------------------------------------------------------------

export function subscribe(
  userId: string,
  planId: string,
  provider: Transaction["provider"],
  phone: string,
): { subscription: Subscription; transaction: Transaction } {
  const db = load();
  const plan = getPlan(planId);
  if (!plan) throw new Error("Unknown plan");
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error("Unknown user");

  if (provider === "wallet") {
    if (user.walletTzs < plan.priceTzs) throw new Error("Insufficient wallet balance");
    user.walletTzs -= plan.priceTzs;
  }

  // Deactivate previous subscriptions; the new plan takes over.
  db.subscriptions.filter((s) => s.userId === userId).forEach((s) => (s.active = false));

  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + plan.durationDays);

  const subscription: Subscription = {
    id: uid("sub"),
    userId,
    planId: plan.id,
    startedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    active: true,
  };
  const transaction: Transaction = {
    id: uid("txn"),
    userId,
    type: "subscription",
    description: plan.name,
    amountTzs: plan.priceTzs,
    provider,
    phone: provider === "wallet" ? undefined : phone,
    status: "completed",
    reference: `TPS${randomBytes(4).toString("hex").toUpperCase()}`,
    createdAt: now.toISOString(),
  };
  db.subscriptions.push(subscription);
  db.transactions.unshift(transaction);
  persist(db);
  return { subscription, transaction };
}

export function getTransactions(userId: string): Transaction[] {
  return load()
    .transactions.filter((t) => t.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------------------------------------------------------------------------
// Tips
// ---------------------------------------------------------------------------

export function getAllTips(): Tip[] {
  return load().tips;
}

export function getTipById(idArg: string): Tip | undefined {
  return load().tips.find((t) => t.id === idArg);
}
