import { describe, expect, it } from "vitest";
import { detectPhone, hasReminder, pushSteps, shouldOfferPush } from "./push-offer";
import { INBOX_ID, type Item } from "./types";

const make = (patch: Partial<Item> = {}): Item => ({
  id: "a",
  kind: "task",
  title: "a",
  body: "",
  listId: INBOX_ID,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  pinned: false,
  status: "open",
  completedAt: null,
  priority: "none",
  due: null,
  subtasks: [],
  sectionId: null,
  ...patch,
});

const ready = {
  pushAvailable: true,
  signedIn: true,
  supported: true,
  subscribed: false,
  dismissed: false,
  hasReminder: true,
};

describe("hasReminder", () => {
  it("is true for a task with a constant reminder", () => {
    expect(hasReminder([make({ constantReminder: true })])).toBe(true);
  });
  it("ignores plain, deleted and template items", () => {
    expect(hasReminder([make()])).toBe(false);
    expect(hasReminder([make({ reminders: [] })])).toBe(false);
    expect(hasReminder([make({ constantReminder: true, deletedAt: 5 })])).toBe(false);
    expect(hasReminder([make({ constantReminder: true, template: true })])).toBe(false);
  });
});

describe("shouldOfferPush", () => {
  it("offers when everything lines up", () => {
    expect(shouldOfferPush(ready)).toBe(true);
  });
  it.each([
    { pushAvailable: false },
    { signedIn: false },
    { supported: false },
    { subscribed: true },
    { dismissed: true },
    { hasReminder: false },
  ])("stays quiet when %o", (patch) => {
    expect(shouldOfferPush({ ...ready, ...patch })).toBe(false);
  });
});

describe("detectPhone and pushSteps", () => {
  it("recognises iPhone, iPadOS and Android", () => {
    expect(detectPhone("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("ios");
    expect(detectPhone("Mozilla/5.0 (Macintosh; Intel Mac OS X)", 5)).toBe("ios");
    expect(detectPhone("Mozilla/5.0 (Macintosh; Intel Mac OS X)", 0)).toBe("other");
    expect(detectPhone("Mozilla/5.0 (Linux; Android 14)")).toBe("android");
  });
  it("gives iPhone users the Home Screen step first", () => {
    expect(pushSteps("ios")[0]).toMatch(/Home Screen/);
    expect(pushSteps("other")).toHaveLength(1);
  });
});
