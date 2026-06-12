import { buildSeedTips } from "../seed";
import { hashPassword, newId } from "../password";
import type { Subscription, Tip, Transaction, User, WithdrawalRequest } from "../types";
import type { DataStore, NewTransaction } from "./types";

interface MemoryState {
  users: User[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  withdrawals: WithdrawalRequest[];
  tips: Tip[];
}

function createSeedState(): MemoryState {
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

  return {
    users: [demoUser],
    subscriptions: [
      {
        id: "sub_demo",
        userId: demoUser.id,
        planId: "weekly",
        startedAt: started.toISOString(),
        expiresAt: expires.toISOString(),
        active: true,
      },
    ],
    transactions: [
      {
        id: "txn_seed_1",
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
        id: "txn_seed_2",
        userId: demoUser.id,
        type: "referral_bonus",
        description: "Referral bonus — 3 friends joined",
        amountTzs: 15000,
        provider: "wallet",
        status: "completed",
        reference: "TPSREF003",
        createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 21).toISOString(),
      },
    ],
    withdrawals: [],
    tips: buildSeedTips(),
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __tipsoMemoryState: MemoryState | undefined;
}

function state(): MemoryState {
  if (!globalThis.__tipsoMemoryState) globalThis.__tipsoMemoryState = createSeedState();
  return globalThis.__tipsoMemoryState;
}

export const memoryStore: DataStore = {
  async findUserByEmail(email) {
    return state().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },

  async findUserById(id) {
    return state().users.find((u) => u.id === id);
  },

  async createUser(input) {
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
    state().users.push(user);
    return user;
  },

  async adjustWallet(userId, deltaTzs) {
    const user = state().users.find((u) => u.id === userId);
    if (!user) throw new Error("Unknown user");
    if (user.walletTzs + deltaTzs < 0) throw new Error("Insufficient wallet balance");
    user.walletTzs += deltaTzs;
  },

  async getActiveSubscription(userId) {
    const sub = state()
      .subscriptions.filter((s) => s.userId === userId && s.active)
      .sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))[0];
    if (!sub) return undefined;
    if (new Date(sub.expiresAt) < new Date()) {
      sub.active = false;
      return undefined;
    }
    return sub;
  },

  async deactivateSubscriptions(userId) {
    state()
      .subscriptions.filter((s) => s.userId === userId)
      .forEach((s) => (s.active = false));
  },

  async createSubscription(sub) {
    state().subscriptions.push(sub);
  },

  async createTransaction(tx: NewTransaction) {
    const full: Transaction = { ...tx, id: newId("txn"), createdAt: new Date().toISOString() };
    state().transactions.unshift(full);
    return full;
  },

  async getTransactions(userId) {
    return state()
      .transactions.filter((t) => t.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async findTransactionByReference(reference) {
    return state().transactions.find((t) => t.reference === reference);
  },

  async setTransactionStatus(id, status) {
    const tx = state().transactions.find((t) => t.id === id);
    if (tx) tx.status = status;
  },

  async createWithdrawalRequest(req) {
    const full: WithdrawalRequest = {
      ...req,
      id: newId("wdr"),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    state().withdrawals.push(full);
    return full;
  },

  async getAllTips() {
    return state().tips;
  },

  async recordPaymentEvent() {
    // Audit trail is a no-op in the in-memory backend.
  },
};
