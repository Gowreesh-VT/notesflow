import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb, isCloudConfigured } from "@/server/db";
import { isSameOrigin, readJson } from "@/server/http";
import { deleteSubscription, parseSubscriptionInput, saveSubscription } from "@/server/push";
import { vapidPublicKey } from "@/server/web-push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function context(request: Request) {
  const db = getDb();
  if (!db || !isCloudConfigured() || !vapidPublicKey()) {
    return {
      error: NextResponse.json(
        { error: "Push reminders are not set up on this server." },
        { status: 503 },
      ),
    };
  }
  if (!isSameOrigin(request))
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  const userId = (await auth())?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };
  const body = await readJson(request, 8_000);
  if (!body.ok)
    return { error: NextResponse.json({ error: "Invalid request." }, { status: body.status }) };
  return { db, userId, body: body.value };
}

/** Turns on push reminders for this browser, or updates its reminder settings. */
export async function POST(request: Request) {
  const ctx = await context(request);
  if ("error" in ctx) return ctx.error;
  const input = parseSubscriptionInput(ctx.body);
  if (!input) return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  try {
    await saveSubscription(ctx.db, ctx.userId, input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(
      "saving push subscription failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "Push reminders are not available yet: the database needs the latest migration." },
      { status: 503 },
    );
  }
}

/** Turns push reminders off for this browser. */
export async function DELETE(request: Request) {
  const ctx = await context(request);
  if ("error" in ctx) return ctx.error;
  const endpoint = (ctx.body as { endpoint?: unknown } | null)?.endpoint;
  if (typeof endpoint !== "string")
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    await deleteSubscription(ctx.db, ctx.userId, endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Push reminders are temporarily unavailable." },
      { status: 503 },
    );
  }
}
