import { NextResponse } from "next/server";
import { isCloudConfigured, isGoogleConfigured } from "@/server/db";

export const dynamic = "force-dynamic";

/** Tells the client whether accounts and sync are set up on this deployment. */
export function GET() {
  return NextResponse.json(
    { configured: isCloudConfigured(), google: isCloudConfigured() && isGoogleConfigured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
