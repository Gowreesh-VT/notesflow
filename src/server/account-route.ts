import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb, isCloudConfigured, type Db } from "./db";
import { isSameOrigin, readJson } from "./http";
import { withinRateLimit } from "./rate-limit";

type Handler = (db: Db, userId: string, body: unknown) => Promise<NextResponse>;

/**
 * Shared checks for the account routes: accounts configured, same-origin request, signed in, a small JSON body
 * and at most 10 attempts per 15 minutes (password checks are rate limited like sign-in).
 */
export async function accountRoute(request: Request, handler: Handler, withBody = true) {
  const db = getDb();
  if (!db || !isCloudConfigured()) {
    return NextResponse.json({ error: "Accounts are not set up on this server." }, { status: 503 });
  }
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: unknown = null;
  if (withBody) {
    const read = await readJson(request, 4_000);
    if (!read.ok) return NextResponse.json({ error: "Invalid request." }, { status: read.status });
    body = read.value;
  }
  try {
    if (withBody && !(await withinRateLimit(db, `account:${userId}`, 10, 15 * 60 * 1000))) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
    return await handler(db, userId, body);
  } catch (error) {
    console.error(
      "account request failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { error: "Account changes are temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }
}
