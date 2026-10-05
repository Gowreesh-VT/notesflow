// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { sessionStillValid } from "./account";
import type { Db } from "./db";
import type { Email } from "./email";
import { hashPassword, verifyPassword } from "./password";
import { confirmPasswordReset, RESET_TTL_MS, requestPasswordReset } from "./password-reset";
import { passwordResets, users } from "./schema";
import { createTestDb } from "./test-db";

let db: Db;
const sent: Email[] = [];
const send = async (email: Email) => {
  sent.push(email);
};
const tokenFrom = (email: Email) => email.text.match(/reset=([\w-]+)/)![1];

beforeAll(async () => {
  db = await createTestDb();
  await db.insert(users).values({
    id: "u1",
    email: "reset@example.com",
    passwordHash: await hashPassword("forgotten password"),
  });
}, 60_000);

describe("password reset", () => {
  it("emails a one-time link only when the account exists, storing just a hash", async () => {
    await requestPasswordReset(
      db,
      { email: "nobody@example.com" },
      "https://app.test",
      send,
      1_000,
    );
    expect(sent).toHaveLength(0);
    await requestPasswordReset(
      db,
      { email: " Reset@Example.com " },
      "https://app.test/",
      send,
      1_000,
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("reset@example.com");
    expect(sent[0].text).toContain("https://app.test/app?reset=");
    const token = tokenFrom(sent[0]);
    const [row] = await db.select().from(passwordResets);
    expect(row.tokenHash).not.toBe(token);
    expect(row.expiresAt).toBe(1_000 + RESET_TTL_MS);
  });

  it("rejects expired, unknown and weak resets", async () => {
    const token = tokenFrom(sent[0]);
    expect(
      await confirmPasswordReset(
        db,
        { token, password: "a new password" },
        1_000 + RESET_TTL_MS + 1,
      ),
    ).toMatchObject({ ok: false });
    expect(
      await confirmPasswordReset(db, { token: "x".repeat(40), password: "a new password" }, 2_000),
    ).toMatchObject({ ok: false });
    expect(await confirmPasswordReset(db, { token, password: "short" }, 2_000)).toMatchObject({
      ok: false,
      message: "Use at least 10 characters.",
    });
  });

  it("sets the new password, uses up the link and ends older sessions", async () => {
    const token = tokenFrom(sent[0]);
    expect(await confirmPasswordReset(db, { token, password: "a new password" }, 2_000)).toEqual({
      ok: true,
      email: "reset@example.com",
    });
    const [user] = await db.select().from(users).where(eq(users.id, "u1"));
    expect(await verifyPassword("a new password", user.passwordHash!)).toBe(true);
    expect(await db.select().from(passwordResets)).toEqual([]);
    expect(await sessionStillValid(db, "u1", 1_999)).toBe(false);
    expect(
      await confirmPasswordReset(db, { token, password: "another password" }, 2_500),
    ).toMatchObject({ ok: false });
  });
});
