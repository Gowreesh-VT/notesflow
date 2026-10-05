// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Item } from "@/lib/types";
import type { Db } from "./db";
import { withinRateLimit } from "./rate-limit";
import { registerUser } from "./register";
import { users } from "./schema";
import { syncForUser } from "./sync-store";
import { createTestDb } from "./test-db";
import { verifyPassword } from "./password";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "alice", email: "alice@example.com" },
    { id: "bob", email: "bob@example.com" },
  ]);
}, 60_000);

const item = (id: string, updatedAt: number, title = id): Item => ({
  id,
  kind: "task",
  title,
  body: "",
  listId: "inbox",
  createdAt: 1,
  updatedAt,
  deletedAt: null,
  pinned: false,
  status: "open",
  completedAt: null,
  priority: "none",
  due: null,
  subtasks: [],
  sectionId: null,
});
const change = (data: Item) => ({
  collection: "item",
  id: data.id,
  updatedAt: data.updatedAt,
  deleted: false,
  data,
});

describe("syncForUser", () => {
  it("stores pushed records and returns them from a cursor of zero", async () => {
    const result = await syncForUser(db, "alice", {
      cursor: 0,
      changes: [change(item("a1", 10)), change(item("a2", 11))],
    });
    expect(result.records.map((r) => r.id).sort()).toEqual(["a1", "a2"]);
    expect(result.hasMore).toBe(false);
    expect(result.cursor).toBeGreaterThan(0);

    const again = await syncForUser(db, "alice", { cursor: result.cursor, changes: [] });
    expect(again.records).toEqual([]);
    expect(again.cursor).toBe(result.cursor);
  });

  it("returns only what changed after the cursor, so devices catch up incrementally", async () => {
    const first = await syncForUser(db, "alice", { cursor: 0, changes: [] });
    await syncForUser(db, "alice", { cursor: 0, changes: [change(item("a3", 20))] });
    const next = await syncForUser(db, "alice", { cursor: first.cursor, changes: [] });
    expect(next.records.map((r) => r.id)).toEqual(["a3"]);
  });

  it("keeps the newest write (last write wins) and ignores stale ones", async () => {
    await syncForUser(db, "alice", { cursor: 0, changes: [change(item("lww", 100, "new"))] });
    await syncForUser(db, "alice", { cursor: 0, changes: [change(item("lww", 50, "stale"))] });
    const { records } = await syncForUser(db, "alice", { cursor: 0, changes: [] });
    const stored = records.find((r) => r.id === "lww");
    expect((stored?.data as Item).title).toBe("new");
    expect(stored?.updatedAt).toBe(100);

    await syncForUser(db, "alice", { cursor: 0, changes: [change(item("lww", 200, "newest"))] });
    const after = await syncForUser(db, "alice", { cursor: 0, changes: [] });
    expect((after.records.find((r) => r.id === "lww")?.data as Item).title).toBe("newest");
  });

  it("propagates deletions as tombstones", async () => {
    await syncForUser(db, "alice", { cursor: 0, changes: [change(item("del", 10))] });
    const before = await syncForUser(db, "alice", { cursor: 0, changes: [] });
    await syncForUser(db, "alice", {
      cursor: 0,
      changes: [{ collection: "item", id: "del", updatedAt: 20, deleted: true, data: null }],
    });
    const after = await syncForUser(db, "alice", { cursor: before.cursor, changes: [] });
    expect(after.records).toEqual([
      { collection: "item", id: "del", updatedAt: 20, deleted: true, data: null },
    ]);
  });

  it("isolates users completely", async () => {
    await syncForUser(db, "bob", { cursor: 0, changes: [change(item("bob-secret", 10))] });
    const alice = await syncForUser(db, "alice", { cursor: 0, changes: [] });
    expect(alice.records.some((r) => r.id === "bob-secret")).toBe(false);
    // Same record id for two users does not collide.
    await syncForUser(db, "alice", {
      cursor: 0,
      changes: [change(item("shared-id", 10, "alice's"))],
    });
    await syncForUser(db, "bob", { cursor: 0, changes: [change(item("shared-id", 10, "bob's"))] });
    const a = await syncForUser(db, "alice", { cursor: 0, changes: [] });
    const b = await syncForUser(db, "bob", { cursor: 0, changes: [] });
    expect((a.records.find((r) => r.id === "shared-id")?.data as Item).title).toBe("alice's");
    expect((b.records.find((r) => r.id === "shared-id")?.data as Item).title).toBe("bob's");
  });

  it("stores saved filters as their own collection", async () => {
    const filter = {
      id: "f-1",
      name: "Urgent",
      criteria: { priorities: ["high"] },
      createdAt: 1,
      updatedAt: 10,
    };
    const before = await syncForUser(db, "alice", { cursor: 0, changes: [] });
    await syncForUser(db, "alice", {
      cursor: 0,
      changes: [{ collection: "filter", id: "f-1", updatedAt: 10, deleted: false, data: filter }],
    });
    const after = await syncForUser(db, "alice", { cursor: before.cursor, changes: [] });
    expect(after.records).toHaveLength(1);
    expect(after.records[0]).toMatchObject({
      collection: "filter",
      id: "f-1",
      data: { name: "Urgent", criteria: { priorities: ["high"], status: "open" } },
    });
  });

  it("discards malformed and oversized changes without failing the request", async () => {
    const huge = { ...item("huge", 10), body: "x".repeat(250_000) };
    const result = await syncForUser(db, "alice", {
      cursor: 0,
      changes: [null, { nonsense: true }, change(huge), change(item("fine", 10))],
    });
    expect(result.records.some((r) => r.id === "fine")).toBe(true);
    expect(result.records.some((r) => r.id === "huge")).toBe(false);
  });

  it("pages large result sets with hasMore", async () => {
    const changes = Array.from({ length: 500 }, (_, i) => change(item(`bulk-${i}`, 10)));
    for (let i = 0; i < 3; i++) {
      await syncForUser(db, "bob", {
        cursor: 0,
        changes: changes.map((c) => ({
          ...c,
          id: `${c.id}-${i}`,
          data: { ...c.data, id: `${c.id}-${i}` },
        })),
      });
    }
    const page = await syncForUser(db, "bob", { cursor: 0, changes: [] });
    expect(page.records).toHaveLength(1000);
    expect(page.hasMore).toBe(true);
    const rest = await syncForUser(db, "bob", { cursor: page.cursor, changes: [] });
    expect(rest.records.length).toBeGreaterThan(0);
    expect(rest.hasMore).toBe(false);
  }, 60_000);
});

describe("registerUser", () => {
  it("creates an account with a hashed password and normalised email", async () => {
    const result = await registerUser(db, {
      email: "  New.User@Example.COM ",
      password: "a-long-enough-password",
      name: "New",
    });
    expect(result.ok).toBe(true);
    const [row] = await db.select().from(users).where(eq(users.email, "new.user@example.com"));
    expect(row.name).toBe("New");
    expect(row.passwordHash).toMatch(/^scrypt\$/);
    expect(row.passwordHash).not.toContain("a-long-enough-password");
    expect(await verifyPassword("a-long-enough-password", row.passwordHash!)).toBe(true);
  }, 30_000);

  it("rejects weak input and duplicates", async () => {
    expect(
      await registerUser(db, { email: "not-an-email", password: "a-long-enough-password" }),
    ).toMatchObject({ ok: false, status: 400 });
    expect(await registerUser(db, { email: "x@example.com", password: "short" })).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(await registerUser(db, null)).toMatchObject({ ok: false, status: 400 });
    const dup = await registerUser(db, {
      email: "ALICE@example.com",
      password: "a-long-enough-password",
    });
    expect(dup).toMatchObject({ ok: false, status: 409 });
  }, 30_000);
});

describe("withinRateLimit", () => {
  it("allows up to the limit, blocks after, and resets when the window passes", async () => {
    const key = "test:rate";
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++)
      expect(await withinRateLimit(db, key, 3, 60_000, t0 + i)).toBe(true);
    expect(await withinRateLimit(db, key, 3, 60_000, t0 + 10)).toBe(false);
    expect(await withinRateLimit(db, key, 3, 60_000, t0 + 61_000)).toBe(true);
    expect(await withinRateLimit(db, "test:other", 3, 60_000, t0)).toBe(true);
  });
});

describe("habit sync", () => {
  it("stores and returns habits like any other record", async () => {
    const habit = {
      id: "habit-1",
      name: "Meditate",
      goal: { per: "day", times: 1 },
      checkins: ["2026-10-05"],
      createdAt: 1,
      updatedAt: 50,
    };
    const result = await syncForUser(db, "alice", {
      cursor: 0,
      changes: [{ collection: "habit", id: habit.id, updatedAt: 50, deleted: false, data: habit }],
    });
    expect(result.records.find((r) => r.id === "habit-1")).toMatchObject({
      collection: "habit",
      data: { name: "Meditate", checkins: ["2026-10-05"] },
    });
  });
});
