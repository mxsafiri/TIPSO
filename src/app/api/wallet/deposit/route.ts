import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { settleTransaction, store, toPublicUser } from "@/lib/db";
import { getPaymentProvider, makeReference } from "@/lib/payments";

const MIN_DEPOSIT = 1000;
const MAX_DEPOSIT = 5_000_000;

/**
 * Wallet top-up: collects mobile money into the TIPSO treasury and credits the
 * user's internal ledger balance once the collection settles.
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const amountTzs = Number(body?.amountTzs);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!Number.isInteger(amountTzs) || amountTzs < MIN_DEPOSIT || amountTzs > MAX_DEPOSIT) {
    return NextResponse.json(
      { error: `Amount must be between TZS ${MIN_DEPOSIT.toLocaleString()} and TZS ${MAX_DEPOSIT.toLocaleString()}` },
      { status: 400 },
    );
  }
  if (!/^(\+?255|0)\d{9}$/.test(phone.replace(/\s/g, ""))) {
    return NextResponse.json({ error: "Enter a valid Tanzanian phone number" }, { status: 400 });
  }

  try {
    const reference = makeReference();
    // Record the pending transaction first so a fast settlement webhook
    // always finds it.
    const tx = await store.createTransaction({
      userId,
      type: "wallet_topup",
      description: "Wallet top-up",
      amountTzs,
      provider: "ntzs",
      phone,
      status: "pending",
      reference,
    });

    let collection;
    try {
      collection = await getPaymentProvider().collect({
        amountTzs,
        phone,
        description: "TIPSO wallet top-up",
        reference,
      });
    } catch (err) {
      await store.setTransactionStatus(tx.id, "failed");
      throw err;
    }

    if (collection.status === "completed") {
      await settleTransaction(reference);
    }

    const user = await store.findUserById(userId);
    return NextResponse.json({
      pending: collection.status !== "completed",
      reference,
      user: user ? await toPublicUser(user) : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Deposit failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
