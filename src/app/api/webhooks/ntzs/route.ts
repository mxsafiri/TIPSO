import { NextResponse } from "next/server";
import { settleTransaction, store } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/payments";

/**
 * nTZS settlement webhook. Expected to be called when a treasury collection
 * settles. The payload shape is a sensible default pending the published spec;
 * we match on our external reference and complete the corresponding
 * transaction (plan activation or wallet credit) idempotently.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-ntzs-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = typeof payload.event === "string" ? payload.event : "unknown";
  await store.recordPaymentEvent("ntzs", eventType, payload);

  const reference =
    typeof payload.external_reference === "string"
      ? payload.external_reference
      : typeof payload.reference === "string"
        ? payload.reference
        : null;

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const status = typeof payload.status === "string" ? payload.status.toLowerCase() : "";
  if (status === "completed" || status === "success" || status === "settled") {
    const tx = await settleTransaction(reference);
    return NextResponse.json({ ok: true, settled: Boolean(tx) });
  }
  if (status === "failed" || status === "cancelled") {
    const tx = await store.findTransactionByReference(reference);
    if (tx && tx.status === "pending") await store.setTransactionStatus(tx.id, "failed");
    return NextResponse.json({ ok: true, settled: false });
  }

  return NextResponse.json({ ok: true, ignored: true });
}
