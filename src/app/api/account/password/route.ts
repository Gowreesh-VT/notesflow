import { NextResponse } from "next/server";
import { changePassword } from "@/server/account";
import { accountRoute } from "@/server/account-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Changes (or, for Google-only accounts, adds) the password and ends the account's other sessions. */
export function POST(request: Request) {
  return accountRoute(request, async (db, userId, body) => {
    const result = await changePassword(db, userId, body);
    return result.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: result.message }, { status: result.status });
  });
}
