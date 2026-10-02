import { NextResponse } from "next/server";
import { getDb, isCloudConfigured } from "@/server/db";
import { clientIp, isSameOrigin, readJson } from "@/server/http";
import { withinRateLimit } from "@/server/rate-limit";
import { registerUser } from "@/server/register";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const db = getDb();
  if (!db || !isCloudConfigured()) {
    return NextResponse.json({ error: "Accounts are not set up on this server." }, { status: 503 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await readJson(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Invalid request." }, { status: body.status });

  try {
    const allowed = await withinRateLimit(
      db,
      `register:ip:${clientIp(request.headers)}`,
      10,
      60 * 60 * 1000,
    );
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const result = await registerUser(db, body.value);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("register failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { error: "Accounts are temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }
}
