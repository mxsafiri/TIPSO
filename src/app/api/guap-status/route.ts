import { NextResponse } from "next/server";
import { isGuapConfigured, listMarkets, probeMarkets } from "@/lib/guap";

/**
 * Diagnostics for the GUAP integration. Probes candidate market endpoints and
 * returns the raw shape of the first market from each, plus the normalized
 * count — so the real payload can be mapped precisely after the key is live.
 * Exposes no credentials.
 */
export async function GET() {
  if (!isGuapConfigured()) {
    return NextResponse.json({
      configured: false,
      hint: "GUAP_API_KEY not set — add it in Vercel and redeploy to enable the Markets tab.",
    });
  }

  const probes = await probeMarkets();
  const markets = await listMarkets({ force: true });

  return NextResponse.json({
    configured: true,
    baseUrl: (process.env.GUAP_API_BASE_URL ?? "https://guap.gold/api/v1").replace(/\/$/, ""),
    normalizedMarketCount: markets.length,
    sampleNormalized: markets[0] ?? null,
    rawProbes: probes,
    hint:
      markets.length > 0
        ? "GUAP markets are flowing. The Markets tab is live."
        : "Connected, but no markets normalized — check rawProbes for the real shape and adjust normalizeMarket / endpoints in src/lib/guap.ts.",
  });
}
