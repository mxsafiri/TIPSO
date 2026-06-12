import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { store, toPublicUser } from "./db";
import type { PublicUser } from "./types";

const COOKIE_NAME = "tipso_session";
const SECRET = new TextEncoder().encode(
  process.env.TIPSO_JWT_SECRET ?? "tipso-dev-secret-change-in-production",
);

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await store.findUserById(userId);
  return user ? toPublicUser(user) : null;
}
