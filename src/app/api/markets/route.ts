import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { createMarketWithStake, listMarketViews, store, toPublicUser } from "@/lib/db";
import { MARKET_CATEGORIES } from "@/lib/exchange";

const MIN_STAKE = 500;
const MAX_STAKE = 5_000_000;
const MAX_DAYS_AHEAD = 60;

export async function GET() {
  return NextResponse.json({ markets: await listMarketViews() });
}

/** Create a Betua-native market with the creator's opening stake. */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to create a market" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const category = MARKET_CATEGORIES.includes(body?.category) ? body.category : "Other";
  const closesAt = typeof body?.closesAt === "string" ? body.closesAt : "";
  const side = body?.side === "YES" || body?.side === "NO" ? body.side : null;
  const amountTzs = Number(body?.amountTzs);

  if (question.length < 8) {
    return NextResponse.json({ error: "Write a clear yes/no question (min 8 characters)" }, { status: 400 });
  }
  if (!side) return NextResponse.json({ error: "Pick the side you're backing" }, { status: 400 });
  if (!Number.isInteger(amountTzs) || amountTzs < MIN_STAKE || amountTzs > MAX_STAKE) {
    return NextResponse.json(
      { error: `Opening stake must be ${MIN_STAKE.toLocaleString()}–${MAX_STAKE.toLocaleString()} nTZS` },
      { status: 400 },
    );
  }
  const closeMs = new Date(closesAt).getTime();
  if (!closeMs || closeMs <= Date.now()) {
    return NextResponse.json({ error: "Close time must be in the future" }, { status: 400 });
  }
  if (closeMs > Date.now() + MAX_DAYS_AHEAD * 86400000) {
    return NextResponse.json({ error: `Close time must be within ${MAX_DAYS_AHEAD} days` }, { status: 400 });
  }

  const user = await store.findUserById(userId);
  if (!user) return NextResponse.json({ error: "Unknown user" }, { status: 401 });

  try {
    const market = await createMarketWithStake({ user, question, category, closesAt, side, amountTzs });
    const updated = await store.findUserById(userId);
    return NextResponse.json({ market, user: updated ? await toPublicUser(updated) : null }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create market" }, { status: 400 });
  }
}
