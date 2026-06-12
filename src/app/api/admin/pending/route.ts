import { NextResponse } from "next/server";
import { store } from "@/lib/db";

function authorized(req: Request): boolean {
  const secret = process.env.TIPSO_ADMIN_SECRET;
  return Boolean(secret) && req.headers.get("x-admin-secret") === secret;
}

/** Operator view of all pending payments awaiting settlement. */
export async function GET(req: Request) {
  if (!process.env.TIPSO_ADMIN_SECRET) {
    return NextResponse.json({ error: "TIPSO_ADMIN_SECRET is not configured" }, { status: 501 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await store.getPendingTransactions();
  const withUsers = await Promise.all(
    pending.map(async (tx) => {
      const user = await store.findUserById(tx.userId);
      return {
        reference: tx.reference,
        providerRef: tx.providerRef ?? null,
        description: tx.description,
        amountTzs: tx.amountTzs,
        type: tx.type,
        createdAt: tx.createdAt,
        userEmail: user?.email ?? tx.userId,
        userPhone: tx.phone ?? user?.phone ?? null,
      };
    }),
  );
  return NextResponse.json({ pending: withUsers });
}
