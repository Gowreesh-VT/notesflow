import { describe, expect, it } from "vitest";
import { countOwnTasks, NUDGE_AFTER_TASKS, shouldNudgeSignIn } from "./signin-nudge";
import { INBOX_ID, type Item } from "./types";

const make = (id: string, patch: Partial<Item> = {}): Item => ({
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
  due: null,
  subtasks: [],
  sectionId: null,
  ...patch,
});

describe("sign-in nudge", () => {
  it("counts only live tasks that are not templates", () => {
    const items = [
      make("a"),
      make("b", { status: "done" }),
      make("c", { kind: "note" }),
      make("d", { template: true }),
      make("e", { deletedAt: 5 }),
    ];
    expect(countOwnTasks(items)).toBe(2);
  });

  it("shows once enough tasks exist, accounts are available and the user is signed out", () => {
    const base = {
      accountsAvailable: true,
      signedIn: false,
      dismissed: false,
      taskCount: NUDGE_AFTER_TASKS,
    };
    expect(shouldNudgeSignIn(base)).toBe(true);
    expect(shouldNudgeSignIn({ ...base, taskCount: NUDGE_AFTER_TASKS - 1 })).toBe(false);
    expect(shouldNudgeSignIn({ ...base, accountsAvailable: false })).toBe(false);
    expect(shouldNudgeSignIn({ ...base, signedIn: true })).toBe(false);
    expect(shouldNudgeSignIn({ ...base, dismissed: true })).toBe(false);
  });
});
