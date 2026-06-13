import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { activateSubscription, settleTransaction, store, toPublicUser } from "@/lib/db";
import { getPaymentProvider, makeReference } from "@/lib/payments";
import { getPlan } from "@/lib/plans";

const PROVIDERS = ["mpesa", "tigopesa", "airtelmoney", "halopesa", "wallet"] as const;

/**
 * Subscription checkout. Wallet payments settle against the internal ledger
 * immediately. Mobile-money payments are collected into the TIPSO treasury via
 * the configured provider (nTZS WaaS when credentials are set, otherwise the
 * instant simulator): a synchronous "completed" activates the plan now, a
 * "pending" collection is activated by the settlement webhook.
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to subscribe" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const planId = typeof body?.planId === "string" ? body.planId : "";
  const provider = PROVIDERS.includes(body?.provider) ? (body.provider as (typeof PROVIDERS)[number]) : null;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  const plan = getPlan(planId);
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }
  if (!provider) {
    return NextResponse.json({ error: "Choose a payment method" }, { status: 400 });
  }
  if (provider !== "wallet" && !/^(\+?255|0)\d{9}$/.test(phone.replace(/\s/g, ""))) {
    return NextResponse.json({ error: "Enter a valid Tanzanian phone number" }, { status: 400 });
  }

  try {
    const reference = makeReference();
    let subscription = null;
    let transaction;
    let paid = true;

    if (provider === "wallet") {
      ({ subscription, transaction } = await activateSubscription(userId, plan.id, provider, phone, true, reference));
    } else {
      // Record the pending transaction first so a fast settlement webhook
      // always finds it, then start the treasury collection.
      ({ transaction } = await activateSubscription(userId, plan.id, provider, phone, false, reference));
      let collection;
      try {
        collection = await getPaymentProvider().collect({
          amountTzs: plan.priceTzs,
          phone,
          description: `Betua ${plan.name}`,
          reference,
        });
      } catch (err) {
        await store.setTransactionStatus(transaction.id, "failed");
        throw err;
      }
      if (collection.providerRef) {
        await store.setTransactionProviderRef(transaction.id, collection.providerRef);
      }
      paid = collection.status === "completed";
      if (paid) {
        const settled = await settleTransaction(reference);
        transaction = settled ?? transaction;
        subscription = (await store.getActiveSubscription(userId)) ?? null;
      }
    }

    const user = await store.findUserById(userId);
    return NextResponse.json({
      subscription,
      transaction,
      pending: !paid,
      user: user ? await toPublicUser(user) : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
