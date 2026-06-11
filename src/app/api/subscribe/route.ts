import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { findUserById, subscribe, toPublicUser } from "@/lib/db";
import { getPlan } from "@/lib/plans";

const PROVIDERS = ["mpesa", "tigopesa", "airtelmoney", "halopesa", "wallet"] as const;

/**
 * MVP payment flow: the mobile-money STK push is simulated and the
 * subscription is activated immediately. The route signature is designed so a
 * real PSP integration (e.g. M-Pesa OpenAPI / Selcom) can replace the body
 * without changing the client.
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

  if (!getPlan(planId)) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }
  if (!provider) {
    return NextResponse.json({ error: "Choose a payment method" }, { status: 400 });
  }
  if (provider !== "wallet" && !/^(\+?255|0)\d{9}$/.test(phone.replace(/\s/g, ""))) {
    return NextResponse.json({ error: "Enter a valid Tanzanian phone number" }, { status: 400 });
  }

  try {
    const { subscription, transaction } = subscribe(userId, planId, provider, phone);
    const user = findUserById(userId);
    return NextResponse.json({
      subscription,
      transaction,
      user: user ? toPublicUser(user) : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
