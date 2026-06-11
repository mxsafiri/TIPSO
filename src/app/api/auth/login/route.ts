import { NextResponse } from "next/server";
import { findUserByEmail, toPublicUser, verifyPassword } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = findUserByEmail(email);
  if (!user || !verifyPassword(user, password)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ user: toPublicUser(user) });
}
