import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { placeMarketStake, store, toPublicUser } from "@/lib/db";

/** Stake nTZS from the wallet onto an open Betua market. */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to stake" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const marketId = typeof body?.marketId === "string" ? body.marketId : "";
  const side = body?.side === "YES" || body?.side === "NO" ? body.side : null;
  const amountTzs = Number(body?.amountTzs);

  if (!marketId) return NextResponse.json({ error: "Missing market" }, { status: 400 });
  if (!side) return NextResponse.json({ error: "Choose YES or NO" }, { status: 400 });
  if (!Number.isInteger(amountTzs) || amountTzs <= 0) {
    return NextResponse.json({ error: "Enter a valid stake amount" }, { status: 400 });
  }

  const user = await store.findUserById(userId);
  if (!user) return NextResponse.json({ error: "Unknown user" }, { status: 401 });

  try {
    await placeMarketStake(user, marketId, side, amountTzs);
    const updated = await store.findUserById(userId);
    return NextResponse.json({ ok: true, user: updated ? await toPublicUser(updated) : null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Stake failed" }, { status: 400 });
  }
}
