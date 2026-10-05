import { NextResponse } from "next/server";
import { getDb, isCloudConfigured } from "@/server/db";
import { clientIp, isSameOrigin, readJson } from "@/server/http";
import { confirmPasswordReset } from "@/server/password-reset";
import { withinRateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Sets a new password from a reset link. */
export async function POST(request: Request) {
  const db = getDb();
  if (!db || !isCloudConfigured()) {
    return NextResponse.json({ error: "Accounts are not set up on this server." }, { status: 503 });
  }
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const body = await readJson(request, 2_000);
  if (!body.ok) return NextResponse.json({ error: "Invalid request." }, { status: body.status });

  try {
    if (
      !(await withinRateLimit(
        db,
        `reset-confirm:ip:${clientIp(request.headers)}`,
        20,
        60 * 60 * 1000,
      ))
    ) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
    const result = await confirmPasswordReset(db, body.value);
    return result.ok
      ? NextResponse.json({ ok: true, email: result.email })
      : NextResponse.json({ error: result.message }, { status: result.status });
  } catch (error) {
    console.error(
      "password reset failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json({ error: "Please try again later." }, { status: 503 });
  }
}
