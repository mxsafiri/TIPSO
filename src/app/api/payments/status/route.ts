import { NextResponse } from "next/server";
import { getCurrentUser, getSessionUserId } from "@/lib/auth";
import { reconcileTransactionByReference, store } from "@/lib/db";

/**
 * Foreground payment-status poll. The checkout screen hits this every few
 * seconds after starting a mobile-money collection: it actively re-checks the
 * nTZS deposit status for THIS reference (not throttled, unlike the background
 * reconcile on /auth/me) and settles the transaction the moment the deposit
 * clears — so activation no longer depends on the settlement webhook arriving.
 *
 * GET /api/payments/status?reference=<ref>
 *   → { status: "pending" | "completed" | "failed", subscription, user }
 */
export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference")?.trim() ?? "";
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const status = await reconcileTransactionByReference(userId, reference);
  const subscription = await store.getActiveSubscription(userId);
  const user = await getCurrentUser();

  return NextResponse.json({
    status,
    subscription: subscription ?? null,
    user,
  });
}
