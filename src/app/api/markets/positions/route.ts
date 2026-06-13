import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getPositions, isGuapConfigured } from "@/lib/guap";
import { store } from "@/lib/db";

export async function GET() {
  if (!isGuapConfigured()) return NextResponse.json({ positions: [] });
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ positions: [] });

  const positions = await getPositions(userId);

  // Mark positions already redeemed in our ledger so the UI won't offer it twice.
  const txns = await store.getTransactions(userId);
  const redeemed = new Set(
    txns
      .filter((t) => t.type === "stake_winnings")
      .map((t) => t.reference.replace(`REDEEM_${userId}_`, "")),
  );
  const withRedeemed = positions.map((p) => ({
    ...p,
    redeemable: p.redeemable && !redeemed.has(p.marketId),
  }));

  return NextResponse.json({ positions: withRedeemed });
}
