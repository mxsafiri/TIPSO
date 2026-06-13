import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { store, toPublicUser } from "@/lib/db";
import { isGuapConfigured, redeemPosition } from "@/lib/guap";

/**
 * Redeem winnings from a resolved market into the wallet. Idempotent: a
 * REDEEM_<user>_<market> reference guards against double-crediting.
 */
export async function POST(req: Request) {
  if (!isGuapConfigured()) {
    return NextResponse.json({ error: "Staking is not available" }, { status: 501 });
  }
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const marketId = typeof body?.marketId === "string" ? body.marketId : "";
  if (!marketId) return NextResponse.json({ error: "Missing market" }, { status: 400 });

  const reference = `REDEEM_${userId}_${marketId}`;
  const existing = await store.findTransactionByReference(reference);
  if (existing) {
    return NextResponse.json({ error: "Already redeemed" }, { status: 409 });
  }

  const result = await redeemPosition(userId, marketId);
  if (!result.ok || result.payoutTzs <= 0) {
    return NextResponse.json({ error: result.error ?? "Nothing to redeem" }, { status: 400 });
  }

  await store.adjustWallet(userId, result.payoutTzs);
  await store.createTransaction({
    userId,
    type: "stake_winnings",
    description: `Winnings · market ${marketId}`,
    amountTzs: result.payoutTzs,
    provider: "guap",
    status: "completed",
    reference,
  });

  const updated = await store.findUserById(userId);
  return NextResponse.json({
    ok: true,
    payoutTzs: result.payoutTzs,
    user: updated ? await toPublicUser(updated) : null,
  });
}
