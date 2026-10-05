// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { accountInfo, changePassword, deleteAccount, sessionStillValid } from "./account";
import type { Db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { pushSubscriptions, syncRecords, users } from "./schema";
import { createTestDb } from "./test-db";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "pw", email: "pw@example.com", passwordHash: await hashPassword("old password 1") },
    { id: "google", email: "g@example.com" },
  ]);
}, 60_000);

describe("account settings", () => {
  it("reports whether the account has a password", async () => {
    expect(await accountInfo(db, "pw")).toEqual({ email: "pw@example.com", hasPassword: true });
    expect(await accountInfo(db, "google")).toEqual({ email: "g@example.com", hasPassword: false });
    expect(await accountInfo(db, "nobody")).toBeNull();
  });

  it("changes the password only with the current one, and ends older sessions", async () => {
    expect(
      await changePassword(db, "pw", { current: "wrong", next: "new password 2" }),
    ).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(
      await changePassword(db, "pw", { current: "old password 1", next: "short" }),
    ).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(await sessionStillValid(db, "pw", 100)).toBe(true);
    expect(
      await changePassword(db, "pw", { current: "old password 1", next: "new password 2" }, 5_000),
    ).toEqual({ ok: true });
    const [row] = await db.select().from(users).where(eq(users.id, "pw"));
    expect(await verifyPassword("new password 2", row.passwordHash!)).toBe(true);
    expect(await sessionStillValid(db, "pw", 4_999)).toBe(false);
    expect(await sessionStillValid(db, "pw", 5_000)).toBe(true);
  });

  it("lets a Google-only account add a password", async () => {
    expect(await changePassword(db, "google", { next: "a brand new one" })).toEqual({ ok: true });
    expect((await accountInfo(db, "google"))?.hasPassword).toBe(true);
  });

  it("deletes the account and everything stored for it after confirmation", async () => {
    await db.insert(users).values({
      id: "leaving",
      email: "leave@example.com",
      passwordHash: await hashPassword("goodbye password"),
    });
    await db.insert(syncRecords).values({
      userId: "leaving",
      collection: "item",
      id: "i1",
      data: {},
      updatedAt: 1,
    });
    await db.insert(pushSubscriptions).values({
      endpoint: "https://push.example/1",
      userId: "leaving",
      p256dh: "k",
      auth: "a",
      timeZone: "UTC",
      defaultReminderTime: "09:00",
      createdAt: 1,
      updatedAt: 1,
    });
    expect(await deleteAccount(db, "leaving", { password: "nope" })).toMatchObject({ status: 403 });
    expect(await deleteAccount(db, "leaving", { password: "goodbye password" })).toEqual({
      ok: true,
    });
    expect(await db.select().from(users).where(eq(users.id, "leaving"))).toEqual([]);
    expect(await db.select().from(syncRecords).where(eq(syncRecords.userId, "leaving"))).toEqual(
      [],
    );
    expect(await db.select().from(pushSubscriptions)).toEqual([]);
    expect(await sessionStillValid(db, "leaving", Date.now())).toBe(false);
  });

  it("confirms with the email address when there is no password", async () => {
    await db.insert(users).values({ id: "g2", email: "g2@example.com" });
    expect(await deleteAccount(db, "g2", { email: "other@example.com" })).toMatchObject({
      status: 403,
    });
    expect(await deleteAccount(db, "g2", { email: " G2@example.com " })).toEqual({ ok: true });
  });
});
