import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "./db";
import { hashPassword } from "./password";
import { users } from "./schema";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(10, "Use at least 10 characters.").max(128),
  name: z.string().trim().max(80).optional(),
});

export type RegisterResult =
  { ok: true; id: string } | { ok: false; status: 400 | 409; message: string };

export async function registerUser(db: Db, input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Check the email and password.";
    return {
      ok: false,
      status: 400,
      message: message.startsWith("Invalid") ? "Enter a valid email." : message,
    };
  }
  const { email, password, name } = parsed.data;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return {
      ok: false,
      status: 409,
      message: "Could not create the account. Try signing in instead.",
    };
  }

  const passwordHash = await hashPassword(password);
  try {
    const [created] = await db
      .insert(users)
      .values({ email, name: name || null, passwordHash })
      .returning({ id: users.id });
    return { ok: true, id: created.id };
  } catch {
    // Lost a race with a concurrent sign-up for the same email.
    return {
      ok: false,
      status: 409,
      message: "Could not create the account. Try signing in instead.",
    };
  }
}
