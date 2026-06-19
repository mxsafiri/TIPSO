import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { store } from "@/lib/db";
import {
  createMarket,
  ensureGuapUser,
  getCategories,
  isGuapConfigured,
  listMarkets,
} from "@/lib/guap";

/** GET /api/guap/markets — list markets from GUAP with optional filters. */
export async function GET(req: Request) {
  if (!isGuapConfigured()) {
    return NextResponse.json({ enabled: false, markets: [], pagination: null });
  }

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "OPEN") as "OPEN" | "RESOLVED" | "ALL";
  const category = searchParams.get("category") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "50");
  const offset = Number(searchParams.get("offset") ?? "0");

  const markets = await listMarkets({ status, category, limit, offset });
  return NextResponse.json({ enabled: true, markets });
}

/**
 * POST /api/guap/markets — create a new market on GUAP.
 *
 * Body (all validated here before forwarding to GUAP):
 *   title         string   required
 *   description   string   required
 *   category      string   required  — must be in GET /api/guap/categories
 *   resolvesAt    string   required  — ISO 8601, must be in the future
 *   initialProb   number   optional  — 1–99, binary starting YES %
 *   options       string[] optional  — 2–10 for multi-option markets
 *   pythSymbol    string   optional  — e.g. "BTC/USD" for auto-resolve
 *   pythTargetPrice number optional  — required when pythSymbol is set
 *   pythOperator  string   optional  — "above" | "below" (default "above")
 */
export async function POST(req: Request) {
  if (!isGuapConfigured()) {
    return NextResponse.json({ error: "GUAP integration not enabled" }, { status: 503 });
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to create a market" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const resolvesAt = typeof body.resolvesAt === "string" ? body.resolvesAt : "";
  const initialProb = typeof body.initialProb === "number" ? body.initialProb : undefined;
  const options: string[] | undefined =
    Array.isArray(body.options) && body.options.length >= 2 ? body.options : undefined;
  const pythSymbol = typeof body.pythSymbol === "string" ? body.pythSymbol.trim() : undefined;
  const pythTargetPrice = typeof body.pythTargetPrice === "number" ? body.pythTargetPrice : undefined;
  const pythOperator: "above" | "below" | undefined =
    body.pythOperator === "below" ? "below" : body.pythOperator === "above" ? "above" : undefined;

  // Validate
  if (!pythSymbol && title.length < 8) {
    return NextResponse.json({ error: "Title must be at least 8 characters" }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  }
  const resolveMs = new Date(resolvesAt).getTime();
  if (!resolveMs || resolveMs <= Date.now()) {
    return NextResponse.json({ error: "Resolve time must be in the future" }, { status: 400 });
  }
  if (resolveMs > Date.now() + 90 * 86400_000) {
    return NextResponse.json({ error: "Resolve time must be within 90 days" }, { status: 400 });
  }
  if (pythSymbol && !pythTargetPrice) {
    return NextResponse.json({ error: "pythTargetPrice is required when pythSymbol is set" }, { status: 400 });
  }
  if (initialProb !== undefined && (initialProb < 1 || initialProb > 99)) {
    return NextResponse.json({ error: "initialProb must be between 1 and 99" }, { status: 400 });
  }

  // Validate category against GUAP's list
  const cats = await getCategories();
  if (cats && cats.categories.length > 0 && !cats.categories.includes(category)) {
    return NextResponse.json(
      { error: `Invalid category. Valid: ${cats.categories.join(", ")}` },
      { status: 400 },
    );
  }

  // Ensure the user exists in GUAP
  const user = await store.findUserById(userId);
  if (!user) return NextResponse.json({ error: "Unknown user" }, { status: 401 });

  const guapId = await ensureGuapUser(userId, user.name, user.phone);
  if (!guapId) {
    return NextResponse.json(
      { error: "Could not provision your GUAP account — try again" },
      { status: 502 },
    );
  }

  const result = await createMarket({
    title: pythSymbol ? undefined! : title, // GUAP allows omitting title when pythSymbol is set
    description,
    category,
    resolvesAt,
    creatorExternalId: guapId,
    ...(initialProb !== undefined ? { initialProb } : {}),
    ...(options ? { options } : {}),
    ...(pythSymbol ? { pythSymbol, pythTargetPrice, pythOperator } : {}),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not create market" }, { status: 400 });
  }

  return NextResponse.json(
    { market: result.market, creationFee: result.creationFee ?? null },
    { status: 201 },
  );
}
