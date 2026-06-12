import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { store, toPublicUser } from "@/lib/db";

const MIN_WITHDRAWAL = 2000;

/**
 * Withdrawal request: debits the internal ledger immediately and queues a
 * payout request from the TIPSO treasury. Payouts are reviewed/released by an
 * operator (and later automated via nTZS once payout APIs are wired in).
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const amountTzs = Number(body?.amountTzs);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!Number.isInteger(amountTzs) || amountTzs < MIN_WITHDRAWAL) {
    return NextResponse.json(
      { error: `Minimum withdrawal is TZS ${MIN_WITHDRAWAL.toLocaleString()}` },
      { status: 400 },
    );
  }
  if (!/^(\+?255|0)\d{9}$/.test(phone.replace(/\s/g, ""))) {
    return NextResponse.json({ error: "Enter a valid Tanzanian phone number" }, { status: 400 });
  }

  try {
    // Debit first — adjustWallet rejects if the balance is insufficient.
    await store.adjustWallet(userId, -amountTzs);
    const request = await store.createWithdrawalRequest({
      userId,
      amountTzs,
      destination: phone,
    });

    const user = await store.findUserById(userId);
    return NextResponse.json({
      request,
      user: user ? await toPublicUser(user) : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Withdrawal failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
