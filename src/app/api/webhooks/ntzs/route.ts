import { NextResponse } from "next/server";
import { settleTransactionRecord, store } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/payments";

const SUCCESS_STATUSES = new Set(["completed", "minted", "success", "settled", "confirmed"]);
const FAILURE_STATUSES = new Set(["failed", "cancelled", "rejected", "expired"]);

function firstString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

/**
 * nTZS settlement webhook. Fired when a treasury deposit settles (nTZS minted
 * to the treasury wallet). We match the event to our transaction by the nTZS
 * deposit id (provider ref) or our own reference, then complete it
 * idempotently (plan activation or wallet credit).
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-ntzs-signature") ?? req.headers.get("x-snippe-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = firstString(payload, ["event", "type", "eventType"]) ?? "unknown";
  await store.recordPaymentEvent("ntzs", eventType, payload);

  // The deposit object may be nested (e.g. { event, data: {...} }).
  const data =
    typeof payload.data === "object" && payload.data !== null
      ? (payload.data as Record<string, unknown>)
      : payload;

  const providerRef = firstString(data, ["id", "depositId", "deposit_id"]);
  const reference = firstString(data, ["external_reference", "externalReference", "reference"]);

  const tx =
    (providerRef ? await store.findTransactionByProviderRef(providerRef) : undefined) ??
    (reference ? await store.findTransactionByReference(reference) : undefined);

  if (!tx) {
    // Not ours (or arrived before the transaction committed) — acknowledge so
    // the event is retried/audited rather than erroring forever.
    return NextResponse.json({ ok: true, matched: false });
  }

  const status = (firstString(data, ["status"]) ?? eventType).toLowerCase();
  if (SUCCESS_STATUSES.has(status) || [...SUCCESS_STATUSES].some((s) => status.includes(s))) {
    await settleTransactionRecord(tx);
    return NextResponse.json({ ok: true, settled: true });
  }
  if (FAILURE_STATUSES.has(status) || [...FAILURE_STATUSES].some((s) => status.includes(s))) {
    if (tx.status === "pending") await store.setTransactionStatus(tx.id, "failed");
    return NextResponse.json({ ok: true, settled: false });
  }

  return NextResponse.json({ ok: true, ignored: true });
}
