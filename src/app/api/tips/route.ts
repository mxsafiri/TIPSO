import { NextResponse } from "next/server";
import { getAllTips, getActiveSubscription } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { toTipDto } from "@/lib/dto";

export async function GET() {
  const userId = await getSessionUserId();
  const hasPremium = userId ? Boolean(getActiveSubscription(userId)) : false;

  const tips = getAllTips()
    .filter((t) => t.status === "pending")
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .map((t) => toTipDto(t, hasPremium));

  return NextResponse.json({ tips, hasPremium });
}
