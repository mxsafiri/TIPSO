import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import { getFeedDiagnostics, syncWorldCupTips } from "@/lib/fixtures/worldcup";

/**
 * Live diagnostics for the World Cup fixtures feed. Forces a sync (bypassing
 * the 30-minute throttle) and reports what happened — use this to verify the
 * FOOTBALL_DATA_API_KEY wiring after deploys. Exposes no secrets.
 */
export async function GET() {
  await syncWorldCupTips(store, true);
  const diag = getFeedDiagnostics();

  let worldCupTipsInDb = 0;
  let pendingWcTips = 0;
  try {
    const all = await store.getAllTips();
    const wc = all.filter((t) => t.league.includes("World Cup"));
    worldCupTipsInDb = wc.length;
    pendingWcTips = wc.filter((t) => t.status === "pending").length;
  } catch (e) {
    return NextResponse.json(
      { feed: diag, dbError: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  let aiTips = 0;
  try {
    aiTips = (await store.getAllTips()).filter((t) => t.aiGenerated).length;
  } catch {
    aiTips = 0;
  }

  return NextResponse.json({
    feed: diag,
    worldCupTipsInDb,
    pendingWcTips,
    aiGeneratedTips: aiTips,
    aiEngine: diag.aiConfigured
      ? "Claude Opus 4.8 prediction engine active"
      : "ANTHROPIC_API_KEY not set — using strength-model fallback",
    hint: !diag.keyPresent
      ? "FOOTBALL_DATA_API_KEY is not set in this deployment — add it in Vercel and redeploy."
      : diag.error
        ? "The feed call failed — see feed.error."
        : worldCupTipsInDb === 0
          ? "Feed reachable but no matches mapped — check feed.matchesFromApi."
          : "World Cup feed is healthy.",
  });
}
