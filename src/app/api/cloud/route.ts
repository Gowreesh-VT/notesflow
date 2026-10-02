import { NextResponse } from "next/server";
import { getDatabaseStatus, isCloudConfigured, isGoogleConfigured } from "@/server/db";

export const dynamic = "force-dynamic";

/** Tells the client whether accounts and sync are set up and working on this deployment. */
export async function GET() {
  const configured = isCloudConfigured();
  const database = configured ? await getDatabaseStatus() : null;
  return NextResponse.json(
    { configured, database, google: configured && isGoogleConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
