import { NextResponse } from "next/server";
import { isGuapConfigured, listMarkets } from "@/lib/guap";

export async function GET() {
  if (!isGuapConfigured()) {
    return NextResponse.json({ enabled: false, markets: [] });
  }
  const markets = await listMarkets();
  return NextResponse.json({ enabled: true, markets });
}
