import { NextResponse } from "next/server";
import { getCategories, isGuapConfigured } from "@/lib/guap";

/** GET /api/guap/categories — GUAP valid categories, sub-categories & Pyth symbols. */
export async function GET() {
  if (!isGuapConfigured()) {
    return NextResponse.json({ enabled: false, categories: [] });
  }
  const data = await getCategories();
  if (!data) {
    return NextResponse.json({ error: "Could not fetch categories" }, { status: 502 });
  }
  return NextResponse.json({ enabled: true, ...data });
}
