import { NextResponse } from "next/server";
import { getAllTips } from "@/lib/db";
import type { PlatformStats } from "@/lib/types";

export async function GET() {
  const all = getAllTips();
  const settled = all.filter((t) => t.status === "won" || t.status === "lost");
  const won = settled.filter((t) => t.status === "won");

  // Flat-stake ROI across the settled ledger.
  const staked = settled.length;
  const returned = won.reduce((sum, t) => sum + t.odds, 0);
  const roi = staked > 0 ? ((returned - staked) / staked) * 100 : 0;
  const avgOdds = settled.length > 0 ? settled.reduce((s, t) => s + t.odds, 0) / settled.length : 0;

  let streak = 0;
  const byDate = [...settled].sort((a, b) => b.kickoff.localeCompare(a.kickoff));
  for (const tip of byDate) {
    if (tip.status === "won") streak += 1;
    else break;
  }

  const monthsMap = new Map<string, { tips: number; won: number; returned: number }>();
  for (const tip of settled) {
    const d = new Date(tip.kickoff);
    const key = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    const m = monthsMap.get(key) ?? { tips: 0, won: 0, returned: 0 };
    m.tips += 1;
    if (tip.status === "won") {
      m.won += 1;
      m.returned += tip.odds;
    }
    monthsMap.set(key, m);
  }
  const monthly = [...monthsMap.entries()]
    .map(([month, m]) => ({
      month,
      tips: m.tips,
      accuracy: Math.round((m.won / m.tips) * 100),
      roi: Math.round(((m.returned - m.tips) / m.tips) * 1000) / 10,
    }))
    .slice(0, 4);

  const stats: PlatformStats = {
    totalTips: all.length,
    settledTips: settled.length,
    wonTips: won.length,
    accuracy: Math.round((won.length / Math.max(settled.length, 1)) * 100),
    roi: Math.round(roi * 10) / 10,
    avgOdds: Math.round(avgOdds * 100) / 100,
    currentStreak: streak,
    monthly,
  };

  const recent = byDate.slice(0, 20);

  return NextResponse.json({ stats, recent });
}
