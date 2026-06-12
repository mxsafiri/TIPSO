import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { randomBytes } from "crypto";
import { store, toPublicUser } from "@/lib/db";
import { createSession } from "@/lib/auth";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/**
 * Google Identity Services sign-in: the client posts the ID token (credential)
 * from the GIS button; we verify it against Google's JWKS and sign the user in,
 * creating their account on first sign-in.
 */
export async function POST(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google sign-in is not configured" }, { status: 501 });
  }

  const body = await req.json().catch(() => null);
  const credential = typeof body?.credential === "string" ? body.credential : "";
  if (!credential) {
    return NextResponse.json({ error: "Missing credential" }, { status: 400 });
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(credential, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
    }));
  } catch {
    return NextResponse.json({ error: "Invalid Google credential" }, { status: 401 });
  }

  const email = typeof payload.email === "string" ? payload.email : "";
  const emailVerified = payload.email_verified === true;
  const name = typeof payload.name === "string" && payload.name ? payload.name : email.split("@")[0];
  if (!email || !emailVerified) {
    return NextResponse.json({ error: "Google account email is not verified" }, { status: 403 });
  }

  let user = await store.findUserByEmail(email);
  if (!user) {
    // Passwordless account: a random password keeps the credentials path
    // unusable for this user while reusing the same storage model.
    user = await store.createUser({
      name,
      email,
      phone: "",
      password: randomBytes(32).toString("hex"),
    });
  }

  await createSession(user.id);
  return NextResponse.json({ user: await toPublicUser(user) });
}
