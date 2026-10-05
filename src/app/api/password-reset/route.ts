import { after, NextResponse } from "next/server";
import { getDb, isCloudConfigured } from "@/server/db";
import { isEmailConfigured, sendEmail } from "@/server/email";
import { clientIp, isSameOrigin, readJson } from "@/server/http";
import { requestPasswordReset } from "@/server/password-reset";
import { withinRateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOUR = 60 * 60 * 1000;
const SENT = { ok: true, message: "If that email has an account, a reset link is on its way." };

/** Emails a password reset link. Answers the same way whether or not the account exists. */
export async function POST(request: Request) {
  const db = getDb();
  if (!db || !isCloudConfigured() || !isEmailConfigured()) {
    return NextResponse.json(
      { error: "Password reset is not set up on this server." },
      { status: 503 },
    );
  }
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const body = await readJson(request, 1_000);
  if (!body.ok) return NextResponse.json({ error: "Invalid request." }, { status: body.status });
  const email = String((body.value as { email?: unknown })?.email ?? "")
    .trim()
    .toLowerCase();

  try {
    const allowed =
      (await withinRateLimit(db, `reset:ip:${clientIp(request.headers)}`, 10, HOUR)) &&
      (await withinRateLimit(db, `reset:email:${email}`, 3, HOUR));
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: "Please try again later." }, { status: 503 });
  }

  const appUrl = process.env.AUTH_URL || new URL(request.url).origin;
  // The lookup and the email happen after the response, so its timing doesn't reveal whether the account exists.
  after(async () => {
    try {
      await requestPasswordReset(db, { email }, appUrl, sendEmail);
    } catch (error) {
      console.error(
        "password reset email failed:",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  });
  return NextResponse.json(SENT);
}
