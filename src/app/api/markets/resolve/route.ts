import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { resolveMarket } from "@/lib/db";

/**
 * Resolve a market and pay out the pool. The creator may resolve their own
 * market after it closes; an operator can override via TIPSO_ADMIN_SECRET.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const marketId = typeof body?.marketId === "string" ? body.marketId : "";
  const outcome = body?.outcome === "YES" || body?.outcome === "NO" ? body.outcome : null;
  if (!marketId || !outcome) {
    return NextResponse.json({ error: "marketId and outcome (YES/NO) are required" }, { status: 400 });
  }

  const adminSecret = process.env.TIPSO_ADMIN_SECRET;
  const isAdmin = Boolean(adminSecret) && req.headers.get("x-admin-secret") === adminSecret;

  let actor: string | "admin";
  if (isAdmin) {
    actor = "admin";
  } else {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Sign in to resolve" }, { status: 401 });
    actor = userId;
  }

  try {
    const result = await resolveMarket(marketId, outcome, actor);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Resolve failed" }, { status: 400 });
  }
}
