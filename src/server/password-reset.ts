import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";
import { endSessionsBefore, newPasswordSchema } from "./account";
import type { Db } from "./db";
import type { SendEmail } from "./email";
import { hashPassword } from "./password";
import { passwordResets, users } from "./schema";

export const RESET_TTL_MS = 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const requestSchema = z.object({ email: z.string().trim().toLowerCase().max(254) });

/**
 * Emails a reset link when the address has an account. The caller always answers the same way, so the response
 * never reveals whether an account exists.
 */
export async function requestPasswordReset(
  db: Db,
  input: unknown,
  appUrl: string,
  send: SendEmail,
  now = Date.now(),
): Promise<void> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return;
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  if (!user) return;

  // Expired links are cleaned up as new ones are made.
  await db.delete(passwordResets).where(lt(passwordResets.expiresAt, now));
  const token = randomBytes(32).toString("base64url");
  await db
    .insert(passwordResets)
    .values({ tokenHash: hashToken(token), userId: user.id, expiresAt: now + RESET_TTL_MS });

  const link = `${appUrl.replace(/\/$/, "")}/app?reset=${token}`;
  await send({
    to: user.email,
    subject: "Reset your Notesflow password",
    text: `Someone (hopefully you) asked to reset the password for your Notesflow account.\n\nChoose a new password here (the link works once, for one hour):\n${link}\n\nIf you didn't ask for this, ignore this email; your password stays the same.`,
    html: `<p>Someone (hopefully you) asked to reset the password for your Notesflow account.</p><p><a href="${escapeHtml(link)}">Choose a new password</a> (the link works once, for one hour).</p><p>If you didn't ask for this, ignore this email; your password stays the same.</p>`,
  });
}

const confirmSchema = z.object({ token: z.string().min(20).max(200), password: newPasswordSchema });

export type ResetResult = { ok: true; email: string } | { ok: false; status: 400; message: string };

/** Sets the new password from a valid, unexpired link, uses up the user's links and ends their sessions. */
export async function confirmPasswordReset(
  db: Db,
  input: unknown,
  now = Date.now(),
): Promise<ResetResult> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues.find((i) => i.path[0] === "password")?.message;
    return { ok: false, status: 400, message: message ?? "This reset link is not valid." };
  }
  const [reset] = await db
    .select({ userId: passwordResets.userId, email: users.email })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(
      and(
        eq(passwordResets.tokenHash, hashToken(parsed.data.token)),
        gt(passwordResets.expiresAt, now),
      ),
    )
    .limit(1);
  if (!reset) {
    return {
      ok: false,
      status: 400,
      message: "This reset link has expired or was already used. Ask for a new one.",
    };
  }
  const passwordHash = await hashPassword(parsed.data.password);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, reset.userId));
    await tx.delete(passwordResets).where(eq(passwordResets.userId, reset.userId));
    await endSessionsBefore(tx as unknown as Db, reset.userId, now);
  });
  return { ok: true, email: reset.email };
}
