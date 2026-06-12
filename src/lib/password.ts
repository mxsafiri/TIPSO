import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, s, 64).toString("hex");
  return { hash, salt: s };
}

export function verifyPassword(hash: string, salt: string, password: string): boolean {
  const candidate = hashPassword(password, salt).hash;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function newReference(): string {
  return `TPS${randomBytes(4).toString("hex").toUpperCase()}`;
}
