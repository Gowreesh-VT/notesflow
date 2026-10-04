import { describe, expect, it } from "vitest";
import {
  dueAlarms,
  FIRED_TTL_MS,
  pruneFired,
  repeatAlarms,
  REPEAT_EVERY_MS,
  REPEAT_FOR_MS,
  STALE_AFTER_MS,
} from "./alarms";
import { atLocal, SNOOZE_OPTIONS } from "./reminders";
import { INBOX_ID, type Item } from "./types";

const task = (id: string, patch: Partial<Item> = {}): Item => ({
  id,
  kind: "task",
  title: id,
  body: "",
  listId: INBOX_ID,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  pinned: false,
  status: "open",
  completedAt: null,
  priority: "none",
  due: "2026-05-10",
  dueTime: "10:00",
  subtasks: [],
  sectionId: null,
  reminders: [{ id: "r", before: 15 }],
  ...patch,
});

const fireAt = atLocal("2026-05-10", "09:45");

describe("dueAlarms", () => {
  it("fires reminders that are due and not fired yet", () => {
    expect(dueAlarms([task("a")], fireAt - 1, {})).toEqual([]);
    const [alarm] = dueAlarms([task("a")], fireAt + 1000, {});
    expect(alarm).toMatchObject({ itemId: "a", label: "15 minutes before", at: fireAt });
    expect(dueAlarms([task("a")], fireAt + 1000, { [alarm.key]: fireAt })).toEqual([]);
  });

  it("skips stale, finished, trashed and template tasks", () => {
    const now = fireAt + 1000;
    expect(dueAlarms([task("a")], fireAt + STALE_AFTER_MS + 1, {})).toEqual([]);
    expect(dueAlarms([task("b", { status: "done" })], now, {})).toEqual([]);
    expect(dueAlarms([task("c", { deletedAt: 1 })], now, {})).toEqual([]);
    expect(dueAlarms([task("d", { template: true })], now, {})).toEqual([]);
  });

  it("re-arms when the due date moves", () => {
    const [first] = dueAlarms([task("a")], fireAt + 1000, {});
    const moved = task("a", { dueTime: "10:30" });
    const [second] = dueAlarms([moved], fireAt + 31 * 60_000, { [first.key]: fireAt });
    expect(second.key).not.toBe(first.key);
  });
});

describe("pruneFired", () => {
  it("forgets old records and keeps identity when nothing expired", () => {
    const fired = { old: 0, recent: FIRED_TTL_MS };
    expect(pruneFired(fired, FIRED_TTL_MS + 10)).toEqual({ recent: FIRED_TTL_MS });
    const fresh = { a: 5 };
    expect(pruneFired(fresh, 10)).toBe(fresh);
  });
});

describe("repeatAlarms", () => {
  const constant = task("a", { constantReminder: true });
  it("repeats constant reminders every five minutes after they rang", () => {
    expect(repeatAlarms([constant], fireAt + 60_000, {})).toEqual([]);
    expect(repeatAlarms([constant], fireAt + 4 * 60_000, { a: fireAt })).toEqual([]);
    const [again] = repeatAlarms([constant], fireAt + REPEAT_EVERY_MS, { a: fireAt });
    expect(again).toMatchObject({ itemId: "a", repeat: true, label: "Still to do" });
  });

  it("stops for normal, finished or long-past reminders", () => {
    const later = fireAt + REPEAT_EVERY_MS;
    expect(repeatAlarms([task("a")], later, { a: fireAt })).toEqual([]);
    expect(repeatAlarms([{ ...constant, status: "done" }], later, { a: fireAt })).toEqual([]);
    expect(repeatAlarms([constant], fireAt + REPEAT_FOR_MS, { a: fireAt })).toEqual([]);
  });
});

describe("snooze", () => {
  it("silences a task until the snooze ends, then rings once", () => {
    const until = fireAt + 10 * 60_000;
    const snoozed = task("a", { snoozedUntil: until });
    expect(dueAlarms([snoozed], fireAt + 60_000, {})).toEqual([]);
    const [ring] = dueAlarms([snoozed], until + 1000, {});
    expect(ring).toMatchObject({ label: "Snoozed", at: until });
    expect(dueAlarms([snoozed], until + 2000, { [ring.key]: until })).toEqual([]);
    const constant = { ...snoozed, constantReminder: true };
    expect(repeatAlarms([constant], until - 1000, { a: fireAt })).toEqual([]);
  });

  it("offers tomorrow morning at the reminder time", () => {
    const now = new Date(2026, 4, 10, 22, 15).getTime();
    expect(SNOOZE_OPTIONS[2].until(now)).toBe(new Date(2026, 4, 11, 9, 0).getTime());
    expect(SNOOZE_OPTIONS[0].until(now)).toBe(now + 600_000);
  });
});
