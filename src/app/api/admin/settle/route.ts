import { NextResponse } from "next/server";
import { settleTransaction, store } from "@/lib/db";

/**
 * Manually settle a pending payment by reference — for payments the operator
 * has verified in the nTZS dashboard while settlement webhooks/polling are not
 * yet available. Idempotent: settling a completed transaction is a no-op.
 */
export async function POST(req: Request) {
  const secret = process.env.TIPSO_ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "TIPSO_ADMIN_SECRET is not configured" }, { status: 501 });
  }
  if (req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  if (!reference) {
    return NextResponse.json({ error: "reference is required" }, { status: 400 });
  }

  const existing = await store.findTransactionByReference(reference);
  if (!existing) {
    return NextResponse.json({ error: "No transaction with that reference" }, { status: 404 });
  }

  const settled = await settleTransaction(reference);
  return NextResponse.json({ ok: true, transaction: settled });
}
