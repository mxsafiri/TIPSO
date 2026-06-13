import { NextResponse } from "next/server";
import { isGuapConfigured } from "@/lib/guap";

/** Public feature flags used to toggle optional UI (no secrets). */
export async function GET() {
  return NextResponse.json({
    guapEnabled: isGuapConfigured(),
  });
}
