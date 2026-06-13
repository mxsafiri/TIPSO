import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getUserStakeViews } from "@/lib/db";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ positions: [] });
  return NextResponse.json({ positions: await getUserStakeViews(userId) });
}
