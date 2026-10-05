import { NextResponse } from "next/server";
import { accountInfo, deleteAccount } from "@/server/account";
import { accountRoute } from "@/server/account-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The signed-in account's email and whether it has a password (Google-only accounts do not). */
export function GET(request: Request) {
  return accountRoute(
    request,
    async (db, userId) => {
      const info = await accountInfo(db, userId);
      return info
        ? NextResponse.json(info, { headers: { "Cache-Control": "no-store" } })
        : NextResponse.json({ error: "This account no longer exists." }, { status: 404 });
    },
    false,
  );
}

/** Deletes the account and all its synced data. */
export function DELETE(request: Request) {
  return accountRoute(request, async (db, userId, body) => {
    const result = await deleteAccount(db, userId, body);
    return result.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: result.message }, { status: result.status });
  });
}
