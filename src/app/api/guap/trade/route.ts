import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { store } from "@/lib/db";
import { ensureGuapUser, isGuapConfigured, placeTrade } from "@/lib/guap";

/**
 * POST /api/guap/trade — place a YES/NO stake on a GUAP market.
 *
 * Body:
 *   marketId    string  required
 *   side        "YES" | "NO"  required (for binary markets)
 *   optionIndex number  optional (for multi-option markets)
 *   amountTzs   number  required  — min 100 TZS
 */
export async function POST(req: Request) {
  if (!isGuapConfigured()) {
    return NextResponse.json({ error: "GUAP integration not enabled" }, { status: 503 });
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to place a trade" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const marketId = typeof body.marketId === "string" ? body.marketId.trim() : "";
  const side: "YES" | "NO" | null =
    body.side === "YES" ? "YES" : body.side === "NO" ? "NO" : null;
  const optionIndex = typeof body.optionIndex === "number" ? body.optionIndex : undefined;
  const amountTzs = Number(body.amountTzs);

  if (!marketId) return NextResponse.json({ error: "marketId is required" }, { status: 400 });
  if (!side && optionIndex === undefined) {
    return NextResponse.json({ error: "side (YES/NO) or optionIndex is required" }, { status: 400 });
  }
  if (!Number.isFinite(amountTzs) || amountTzs < 100) {
    return NextResponse.json({ error: "Minimum trade amount is TZS 100" }, { status: 400 });
  }

  const user = await store.findUserById(userId);
  if (!user) return NextResponse.json({ error: "Unknown user" }, { status: 401 });

  // Ensure the user has a GUAP account
  const guapId = await ensureGuapUser(userId, user.name, user.phone);
  if (!guapId) {
    return NextResponse.json(
      { error: "Could not provision your GUAP account — try again" },
      { status: 502 },
    );
  }

  const result = await placeTrade({
    externalId: guapId,
    marketId,
    side: side ?? "YES",
    ...(optionIndex !== undefined ? { optionIndex } : {}),
    amountTzs,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Trade failed" }, { status: 400 });
  }

  return NextResponse.json({
    tradeId: result.tradeId,
    shares: result.shares,
    fee: result.fee,
  });
}
