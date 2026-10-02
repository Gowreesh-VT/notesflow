import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb, isCloudConfigured } from "@/server/db";
import { isSameOrigin, readJson } from "@/server/http";
import { MAX_CHANGES_PER_REQUEST, syncForUser } from "@/server/sync-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  cursor: z.number().int().min(0),
  changes: z.array(z.unknown()).max(MAX_CHANGES_PER_REQUEST),
});

export async function POST(request: Request) {
  const db = getDb();
  if (!db || !isCloudConfigured()) {
    return NextResponse.json({ error: "Sync is not set up on this server." }, { status: 503 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in to sync." }, { status: 401 });

  const body = await readJson(request, 2_000_000);
  if (!body.ok) return NextResponse.json({ error: "Invalid request." }, { status: body.status });
  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const result = await syncForUser(db, userId, parsed.data);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
