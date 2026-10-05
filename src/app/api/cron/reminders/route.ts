import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { sendDueReminders } from "@/server/push";
import { webPushSender } from "@/server/web-push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Sends due push reminders. Call it about once a minute from a scheduler (for example cron-job.org) with the
 * header `Authorization: Bearer <CRON_SECRET>`.
 */
async function run(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const db = getDb();
  const send = webPushSender();
  if (!db || !send) {
    return NextResponse.json(
      { error: "Push reminders are not set up on this server." },
      { status: 503 },
    );
  }
  try {
    const result = await sendDueReminders(db, send);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("reminder run failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Reminder run failed." }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
