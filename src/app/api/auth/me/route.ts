import { NextResponse } from "next/server";
import { getCurrentUser, getSessionUserId } from "@/lib/auth";
import { reconcilePendingTransactions } from "@/lib/db";

export async function GET() {
  const userId = await getSessionUserId();
  if (userId) {
    // Settles any pending nTZS payments before reporting the user's plan.
    await reconcilePendingTransactions(userId);
  }
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
