import { createHmac, timingSafeEqual } from "crypto";
import { newReference } from "./password";

/**
 * Payment collection layer for the TIPSO treasury.
 *
 * Model: TIPSO holds ONE master treasury wallet (nTZS WaaS). User payments
 * (subscriptions, wallet top-ups) are collections INTO the treasury; user
 * withdrawals are payout requests OUT of it, reviewed before release. Users do
 * not get individual nTZS wallets — their TIPSO balance is an internal ledger
 * entry backed by the treasury.
 *
 * When NTZS_API_KEY is not configured the simulated provider is used, which
 * settles collections instantly so the product flow stays fully demoable.
 */

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
  providerRef?: string;
}

interface PaymentProviderAdapter {
  name: string;
  collect(req: CollectionRequest): Promise<CollectionResult>;
}

function ntzsConfig() {
  const apiKey = process.env.NTZS_API_KEY;
  const baseUrl = process.env.NTZS_API_BASE_URL;
  const treasuryWalletId = process.env.NTZS_TREASURY_WALLET_ID;
  if (!apiKey || !baseUrl || !treasuryWalletId) return null;
  return { apiKey, baseUrl: baseUrl.replace(/\/$/, ""), treasuryWalletId };
}

export function isNtzsConfigured(): boolean {
  return ntzsConfig() !== null;
}

/**
 * nTZS WaaS adapter (treasury collections).
 *
 * NOTE: the request/response shapes below are a sensible default pending
 * access to the nTZS API specification (ntzs.co.tz/developers is not
 * reachable from the build environment). Once sandbox credentials and docs
 * are available, only this adapter should need adjusting — the rest of the
 * app consumes the CollectionResult contract.
 */
const ntzsProvider: PaymentProviderAdapter = {
  name: "ntzs",
  async collect(req) {
    const cfg = ntzsConfig();
    if (!cfg) throw new Error("nTZS is not configured");
    const res = await fetch(`${cfg.baseUrl}/collections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        wallet_id: cfg.treasuryWalletId,
        amount: req.amountTzs,
        currency: "TZS",
        msisdn: req.phone.replace(/\s/g, ""),
        external_reference: req.reference,
        narration: req.description,
        callback_url: process.env.NTZS_CALLBACK_URL,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`nTZS collection failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { id?: string; status?: string };
    return {
      status: data.status === "completed" ? "completed" : "pending",
      reference: req.reference,
      providerRef: data.id,
    };
  },
};

/** Instant-settling simulator used until nTZS credentials are configured. */
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
 * Webhook signature verification (HMAC-SHA256 over the raw body, hex digest
 * in the `x-ntzs-signature` header — adjust to the documented scheme once
 * confirmed). Returns true when no webhook secret is configured so the
 * simulated flow keeps working in development.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.NTZS_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
