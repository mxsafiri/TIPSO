import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { store, toPublicUser } from "@/lib/db";
import { ensureGuapUser, isGuapConfigured, placeTrade } from "@/lib/guap";
import { newReference } from "@/lib/password";

const MIN_STAKE = 500;
const MAX_STAKE = 5_000_000;

/**
 * Native Betua staking: stake nTZS from the wallet onto a GUAP market.
 * Wallet-funded and money-safe — the wallet is debited first and refunded if
 * the exchange rejects the trade.
 */
export async function POST(req: Request) {
  if (!isGuapConfigured()) {
    return NextResponse.json({ error: "Staking is not available" }, { status: 501 });
  }
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to stake" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const marketId = typeof body?.marketId === "string" ? body.marketId : "";
  const side = body?.side === "YES" || body?.side === "NO" ? body.side : null;
  const amountTzs = Number(body?.amountTzs);

  if (!marketId) return NextResponse.json({ error: "Missing market" }, { status: 400 });
  if (!side) return NextResponse.json({ error: "Choose YES or NO" }, { status: 400 });
  if (!Number.isInteger(amountTzs) || amountTzs < MIN_STAKE || amountTzs > MAX_STAKE) {
    return NextResponse.json(
      { error: `Stake must be between ${MIN_STAKE.toLocaleString()} and ${MAX_STAKE.toLocaleString()} nTZS` },
      { status: 400 },
    );
  }

  const user = await store.findUserById(userId);
  if (!user) return NextResponse.json({ error: "Unknown user" }, { status: 401 });

  // Debit the wallet first; adjustWallet rejects if the balance is insufficient.
  try {
    await store.adjustWallet(userId, -amountTzs);
  } catch {
    return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
  }

  try {
    await ensureGuapUser(userId, user.name, user.phone);
    const trade = await placeTrade({ externalId: userId, marketId, side, amountTzs });
    if (!trade.ok) {
      await store.adjustWallet(userId, amountTzs); // refund
      return NextResponse.json({ error: trade.error ?? "Stake rejected" }, { status: 400 });
    }

    await store.createTransaction({
      userId,
      type: "stake",
      description: `Stake ${side} · market ${marketId}`,
      amountTzs,
      provider: "guap",
      status: "completed",
      reference: newReference(),
      providerRef: trade.tradeId,
    });

    const updated = await store.findUserById(userId);
    return NextResponse.json({ ok: true, user: updated ? await toPublicUser(updated) : null });
  } catch (e) {
    await store.adjustWallet(userId, amountTzs); // refund on any failure
    const message = e instanceof Error ? e.message : "Stake failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
