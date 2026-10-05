import { NextResponse } from "next/server";
import { getDatabaseStatus, isCloudConfigured, isGoogleConfigured } from "@/server/db";
import { isEmailConfigured } from "@/server/email";
import { vapidPublicKey } from "@/server/web-push";

export const dynamic = "force-dynamic";

/** Tells the client whether accounts and sync are set up and working on this deployment. */
export async function GET() {
  const configured = isCloudConfigured();
  const database = configured ? await getDatabaseStatus() : null;
  return NextResponse.json(
    {
      configured,
      database,
      google: configured && isGoogleConfigured(),
      // Public key for push reminders, or null when they are not set up.
      push: configured ? vapidPublicKey() : null,
      // Password reset by email needs an email provider.
      email: configured && isEmailConfigured(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
