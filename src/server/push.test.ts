// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Item } from "@/lib/types";
import type { Db } from "./db";
import {
  deleteSubscription,
  parseSubscriptionInput,
  saveSubscription,
  sendDueReminders,
  type PushPayload,
  type Sender,
} from "./push";
import { pushDeliveries, pushSubscriptions, users } from "./schema";
import { syncForUser } from "./sync-store";
import { createTestDb } from "./test-db";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "alice", email: "alice@example.com" },
    { id: "bob", email: "bob@example.com" },
  ]);
}, 60_000);

beforeEach(async () => {
  await db.delete(pushDeliveries);
  await db.delete(pushSubscriptions);
});

const input = (endpoint: string, extra: object = {}) => ({
  endpoint,
  keys: { p256dh: "key", auth: "auth" },
  timeZone: "Asia/Kolkata",
  defaultReminderTime: "09:00",
  quietHours: null,
  ...extra,
});

const task = (id: string, patch: Partial<Item> = {}): Item => ({
  id,
  kind: "task",
  title: `Task ${id}`,
  body: "",
  listId: "inbox",
  createdAt: 1,
  updatedAt: 2,
  deletedAt: null,
  pinned: false,
  status: "open",
  completedAt: null,
  priority: "none",
  due: "2026-10-05",
  dueTime: "10:00",
  subtasks: [],
  sectionId: null,
  reminders: [{ id: "r", before: 30 }],
  ...patch,
});

async function store(userId: string, items: Item[]) {
  await syncForUser(db, userId, {
    cursor: 0,
    changes: items.map((data) => ({
      collection: "item",
      id: data.id,
      updatedAt: data.updatedAt,
      deleted: false,
      data,
    })),
  });
}

function recorder(result: "sent" | "gone" = "sent") {
  const calls: { endpoint: string; payload: PushPayload }[] = [];
  const send: Sender = async (sub, payload) => {
    calls.push({ endpoint: sub.endpoint, payload });
    return result;
  };
  return { calls, send };
}

// 10:00 in India is 04:30 UTC, so the 30-minute reminder fires at 04:00 UTC.
const fireAt = Date.UTC(2026, 9, 5, 4, 0);

describe("subscription input", () => {
  it("accepts a valid browser subscription and rejects bad ones", () => {
    expect(parseSubscriptionInput(input("https://push.example/a"))).toMatchObject({
      endpoint: "https://push.example/a",
      timeZone: "Asia/Kolkata",
    });
    expect(parseSubscriptionInput(input("http://push.example/a"))).toBeNull();
    expect(
      parseSubscriptionInput(input("https://push.example/a", { timeZone: "Nope/Zone" })),
    ).toBeNull();
    expect(parseSubscriptionInput(input("https://push.example/a", { keys: {} }))).toBeNull();
    expect(
      parseSubscriptionInput(
        input("https://push.example/a", { quietHours: { start: "22:00", end: "07:00" } }),
      )?.quietHours,
    ).toEqual({ start: "22:00", end: "07:00" });
  });
});

describe("sendDueReminders", () => {
  it("pushes a due reminder once per device, in the device's time zone", async () => {
    await store("alice", [task("a1")]);
    await saveSubscription(db, "alice", input("https://push.example/phone"));
    await saveSubscription(db, "alice", input("https://push.example/laptop"));

    const early = recorder();
    expect((await sendDueReminders(db, early.send, fireAt - 60_000)).sent).toBe(0);

    const first = recorder();
    expect((await sendDueReminders(db, first.send, fireAt + 30_000)).sent).toBe(2);
    expect(first.calls[0].payload).toMatchObject({
      title: "Task a1",
      body: "Reminder · 30 minutes before",
      itemId: "a1",
    });

    const again = recorder();
    expect((await sendDueReminders(db, again.send, fireAt + 90_000)).sent).toBe(0);
  });

  it("only sends a user's own tasks and skips finished ones", async () => {
    await store("bob", [task("b1"), task("b2", { status: "done", updatedAt: 3 })]);
    await saveSubscription(db, "alice", input("https://push.example/alice"));
    await saveSubscription(db, "bob", input("https://push.example/bob"));
    const run = recorder();
    await sendDueReminders(db, run.send, fireAt + 30_000);
    const bobTitles = run.calls
      .filter((c) => c.endpoint.endsWith("bob"))
      .map((c) => c.payload.title);
    expect(bobTitles).toEqual(["Task b1"]);
    expect(
      run.calls.some((c) => c.endpoint.endsWith("alice") && c.payload.itemId.startsWith("b")),
    ).toBe(false);
  });

  it("holds reminders during quiet hours and removes devices that are gone", async () => {
    await store("alice", [task("q1", { updatedAt: 5 })]);
    // 04:00 UTC is 09:30 in India.
    await saveSubscription(
      db,
      "alice",
      input("https://push.example/quiet", { quietHours: { start: "09:00", end: "10:00" } }),
    );
    const quiet = recorder();
    expect((await sendDueReminders(db, quiet.send, fireAt + 30_000)).sent).toBe(0);

    const later = recorder("gone");
    const result = await sendDueReminders(db, later.send, Date.UTC(2026, 9, 5, 4, 31));
    expect(later.calls.length).toBeGreaterThan(0);
    expect(result.removed).toBe(1);
    expect(await db.select().from(pushSubscriptions)).toEqual([]);
  });

  it("repeats constant reminders every five minutes", async () => {
    await store("alice", [task("c1", { constantReminder: true, updatedAt: 6 })]);
    await saveSubscription(db, "alice", input("https://push.example/constant"));
    const first = recorder();
    await sendDueReminders(db, first.send, fireAt + 30_000);
    const soon = recorder();
    await sendDueReminders(db, soon.send, fireAt + 4 * 60_000);
    const repeat = recorder();
    await sendDueReminders(db, repeat.send, fireAt + 6 * 60_000);
    expect(first.calls.find((c) => c.payload.itemId === "c1")?.payload.requireInteraction).toBe(
      true,
    );
    expect(soon.calls.filter((c) => c.payload.itemId === "c1")).toEqual([]);
    expect(repeat.calls.find((c) => c.payload.itemId === "c1")?.payload.tag).toBe("repeat:c1");
  });
});

describe("failed sends", () => {
  it("retries a reminder on the next run after a temporary failure", async () => {
    await store("alice", [task("f1", { updatedAt: 7 })]);
    await saveSubscription(db, "alice", input("https://push.example/flaky"));
    const failing: Sender = async () => "failed";
    await sendDueReminders(db, failing, fireAt + 30_000);
    const retry = recorder();
    await sendDueReminders(db, retry.send, fireAt + 90_000);
    expect(retry.calls.some((c) => c.payload.itemId === "f1")).toBe(true);
  });
});

describe("deleteSubscription", () => {
  it("only lets the owner remove a device", async () => {
    await saveSubscription(db, "alice", input("https://push.example/own"));
    await deleteSubscription(db, "bob", "https://push.example/own");
    expect(await db.select().from(pushSubscriptions)).toHaveLength(1);
    await deleteSubscription(db, "alice", "https://push.example/own");
    expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
  });
});
