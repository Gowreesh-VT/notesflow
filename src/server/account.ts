import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { users, userSecurity } from "./schema";

export type AccountInfo = { email: string; hasPassword: boolean };

export type AccountResult = { ok: true } | { ok: false; status: 400 | 403 | 404; message: string };

export const newPasswordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.");

export async function accountInfo(db: Db, userId: string): Promise<AccountInfo | null> {
  const [user] = await db
    .select({ email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ? { email: user.email, hasPassword: Boolean(user.passwordHash) } : null;
}

/** Ends every session signed in before `at` (the JWT callback checks it). */
export async function endSessionsBefore(db: Db, userId: string, at: number): Promise<void> {
  await db
    .insert(userSecurity)
    .values({ userId, sessionsValidAfter: at })
    .onConflictDoUpdate({ target: userSecurity.userId, set: { sessionsValidAfter: at } });
}

/**
 * Is a session that signed in at `authAt` still good? False once the account is gone or its password changed
 * afterwards. Before the user_security table exists (migration not run yet) sessions stay valid.
 */
export async function sessionStillValid(db: Db, userId: string, authAt: number): Promise<boolean> {
  try {
    const [row] = await db
      .select({ id: users.id, validAfter: userSecurity.sessionsValidAfter })
      .from(users)
      .leftJoin(userSecurity, eq(userSecurity.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) return false;
    return row.validAfter === null || authAt >= row.validAfter;
  } catch {
    return true;
  }
}

const changeSchema = z.object({
  current: z.string().max(128).optional(),
  next: newPasswordSchema,
});

/**
 * Sets a new password. Accounts that have one must confirm the current password; Google-only accounts can add
 * one. Other sessions end; the caller signs this device in again with the new password.
 */
export async function changePassword(
  db: Db,
  userId: string,
  input: unknown,
  now = Date.now(),
): Promise<AccountResult> {
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      message: parsed.error.issues[0]?.message ?? "Check the new password.",
    };
  }
  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { ok: false, status: 404, message: "This account no longer exists." };
  if (user.passwordHash) {
    const current = parsed.data.current ?? "";
    if (!current || !(await verifyPassword(current, user.passwordHash))) {
      return { ok: false, status: 403, message: "The current password is not right." };
    }
  }
  const passwordHash = await hashPassword(parsed.data.next);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
    await endSessionsBefore(tx as unknown as Db, userId, now);
  });
  return { ok: true };
}

const deleteSchema = z.object({
  password: z.string().max(128).optional(),
  email: z.string().max(254).optional(),
});

/**
 * Deletes the account and everything stored for it (synced records, push subscriptions and linked sign-ins go
 * with it through ON DELETE CASCADE). Confirmed with the password, or the email address for Google-only accounts.
 */
export async function deleteAccount(
  db: Db,
  userId: string,
  input: unknown,
): Promise<AccountResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, message: "Invalid request." };
  const [user] = await db
    .select({ email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { ok: false, status: 404, message: "This account no longer exists." };
  const confirmed = user.passwordHash
    ? await verifyPassword(parsed.data.password ?? "", user.passwordHash)
    : (parsed.data.email ?? "").trim().toLowerCase() === user.email.toLowerCase();
  if (!confirmed) {
    return {
      ok: false,
      status: 403,
      message: user.passwordHash
        ? "The password is not right."
        : "Type your email address exactly.",
    };
  }
  await db.delete(users).where(eq(users.id, userId));
  return { ok: true };
}
