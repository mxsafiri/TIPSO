import { createHmac, timingSafeEqual } from "crypto";
import { newReference } from "./password";

/**
 * Payment collection layer for the TIPSO treasury, built on the nTZS WaaS
 * partner API (docs: NEDA-LABS/ntzs — docs/09-WAAS-PARTNER-API.md).
 *
 * Model: TIPSO holds ONE treasury account on nTZS (auto-provisioned via the
 * idempotent POST /api/v1/users). User payments (subscriptions, wallet
 * top-ups) are M-Pesa deposits INTO the treasury; user withdrawals are queued
 * payout requests released from it. Users do not get individual nTZS wallets —
 * their TIPSO balance is an internal ledger entry backed by the treasury.
 *
 * Only NTZS_API_KEY is required; everything else has sensible defaults.
 * When the key is not configured the simulated provider settles collections
 * instantly so the product flow stays fully demoable.
 */

const NTZS_DEFAULT_BASE_URL = "https://www.ntzs.co.tz/api/v1";
const TREASURY_EXTERNAL_ID = "tipso-treasury";

export interface CollectionRequest {
  amountTzs: number;
  phone: string;
  description: string;
  /** Our idempotent reference, also used to match the settlement webhook. */
  reference: string;
}

export interface CollectionResult {
  /** "completed" = settled synchronously, "pending" = wait for webhook. */
  status: "completed" | "pending";
  reference: string;
  /** nTZS deposit id, used to match settlement webhooks. */
  providerRef?: string;
}

interface PaymentProviderAdapter {
  name: string;
  collect(req: CollectionRequest): Promise<CollectionResult>;
}

function ntzsBaseUrl(): string {
  return (process.env.NTZS_API_BASE_URL ?? NTZS_DEFAULT_BASE_URL).replace(/\/$/, "");
}

export function isNtzsConfigured(): boolean {
  return Boolean(process.env.NTZS_API_KEY);
}

async function ntzsFetch(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${ntzsBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NTZS_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof data.error === "string" ? data.error : `nTZS request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

/** Treasury nTZS user id, provisioned once per process (POST /users is idempotent). */
let treasuryUserId: string | undefined;

async function getTreasuryUserId(): Promise<string> {
  if (treasuryUserId) return treasuryUserId;
  const data = await ntzsFetch("/users", {
    externalId: process.env.NTZS_TREASURY_EXTERNAL_ID ?? TREASURY_EXTERNAL_ID,
    email: process.env.NTZS_TREASURY_EMAIL ?? "treasury@tipso.co.tz",
    name: "TIPSO Treasury",
    phone: "",
  });
  if (typeof data.id !== "string" || !data.id) {
    throw new Error("nTZS did not return a treasury user id");
  }
  treasuryUserId = data.id;
  return treasuryUserId;
}

const SETTLED_STATUSES = new Set(["completed", "minted", "success", "settled", "confirmed"]);

const ntzsProvider: PaymentProviderAdapter = {
  name: "ntzs",
  async collect(req) {
    const userId = await getTreasuryUserId();
    const data = await ntzsFetch("/deposits", {
      userId,
      amountTzs: req.amountTzs,
      paymentMethod: "mobile_money",
      phoneNumber: req.phone.replace(/\s/g, ""),
    });
    const status = typeof data.status === "string" ? data.status.toLowerCase() : "";
    return {
      status: SETTLED_STATUSES.has(status) ? "completed" : "pending",
      reference: req.reference,
      providerRef: typeof data.id === "string" ? data.id : undefined,
    };
  },
};

/**
 * Off-ramp payout from the treasury to a user's mobile money number, used
 * when an operator releases an approved withdrawal request.
 */
export async function ntzsPayout(amountTzs: number, phone: string): Promise<{ id?: string }> {
  if (!isNtzsConfigured()) throw new Error("nTZS is not configured");
  const userId = await getTreasuryUserId();
  const data = await ntzsFetch("/withdrawals", {
    userId,
    amountTzs,
    phoneNumber: phone.replace(/\s/g, ""),
  });
  return { id: typeof data.id === "string" ? data.id : undefined };
}

/** Instant-settling simulator used until NTZS_API_KEY is configured. */
const simulatedProvider: PaymentProviderAdapter = {
  name: "simulated",
  async collect(req) {
    return { status: "completed", reference: req.reference };
  },
};

export function getPaymentProvider(): PaymentProviderAdapter {
  return isNtzsConfigured() ? ntzsProvider : simulatedProvider;
}

export function makeReference(): string {
  return newReference();
}

/**
 * Webhook signature verification: HMAC-SHA256 over the raw body (hex digest),
 * matching the Snippe-style `whsec_` scheme used across the nTZS platform.
 * Accepts the digest from x-ntzs-signature or x-snippe-signature. Returns true
 * when no webhook secret is configured so development flows keep working.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.NTZS_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;
  const key = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const expected = createHmac("sha256", key).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/, "");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
