import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { toTipDto } from "@/lib/dto";
import { syncWorldCupTips } from "@/lib/fixtures/worldcup";

export async function GET() {
  await syncWorldCupTips(store);
  const userId = await getSessionUserId();
  const hasPremium = userId ? Boolean(await store.getActiveSubscription(userId)) : false;

  const tips = (await store.getAllTips())
    .filter((t) => t.status === "pending")
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .map((t) => toTipDto(t, hasPremium));

  return NextResponse.json({ tips, hasPremium });
}
