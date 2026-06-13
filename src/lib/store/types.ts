import type { Subscription, Tip, Transaction, User, WithdrawalRequest } from "../types";

export interface NewTransaction {
  userId: string;
  type: Transaction["type"];
  description: string;
  amountTzs: number;
  provider: Transaction["provider"];
  phone?: string;
  status: Transaction["status"];
  reference: string;
  planId?: Transaction["planId"];
  providerRef?: string;
}

/**
 * Storage backend contract. Implemented by the Postgres (Neon) backend in
 * production and the in-memory backend for local dev without a DATABASE_URL.
 */
export interface DataStore {
  // Users
  findUserByEmail(email: string): Promise<User | undefined>;
  findUserById(id: string): Promise<User | undefined>;
  createUser(input: { name: string; email: string; phone: string; password: string }): Promise<User>;
  adjustWallet(userId: string, deltaTzs: number): Promise<void>;

  // Subscriptions
  getActiveSubscription(userId: string): Promise<Subscription | undefined>;
  deactivateSubscriptions(userId: string): Promise<void>;
  createSubscription(sub: Subscription): Promise<void>;

  // Transactions
  createTransaction(tx: NewTransaction): Promise<Transaction>;
  getTransactions(userId: string): Promise<Transaction[]>;
  findTransactionByReference(reference: string): Promise<Transaction | undefined>;
  findTransactionByProviderRef(providerRef: string): Promise<Transaction | undefined>;
  getPendingTransactions(userId?: string): Promise<Transaction[]>;
  setTransactionStatus(id: string, status: Transaction["status"]): Promise<void>;
  setTransactionProviderRef(id: string, providerRef: string): Promise<void>;

  // Withdrawals
  createWithdrawalRequest(req: Omit<WithdrawalRequest, "id" | "status" | "createdAt">): Promise<WithdrawalRequest>;

  // Tips
  getAllTips(): Promise<Tip[]>;
  /** Insert or update tips by id (used by live fixture feeds). */
  upsertTips(tips: Tip[]): Promise<void>;
  /**
   * Remove ALL demo/seed tips — fixtures and fabricated settled history
   * (ids not from the live feed). In live-feed mode the ledger must contain
   * only real, verifiable picks.
   */
  deleteSeedTips(): Promise<void>;

  // Webhook audit trail
  recordPaymentEvent(provider: string, eventType: string, payload: unknown): Promise<void>;
}
