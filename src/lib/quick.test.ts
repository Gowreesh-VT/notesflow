import { describe, expect, it } from "vitest";
import { quickPicks } from "./quick";
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
  due: null,
  subtasks: [],
  sectionId: null,
  ...patch,
});
const today = "2026-10-05";

describe("quick picks", () => {
  const items = [
    task("ten", { estimate: 10 }),
    task("twenty", { estimate: 20 }),
    task("quick-tag", { energy: "quick" }),
    task("urgent-five", { estimate: 5, due: today }),
    task("high-ten", { estimate: 10, priority: "high" }),
    task("no-estimate"),
    task("done", { estimate: 5, status: "done" }),
    task("archived", { estimate: 5, listId: "old" }),
  ];

  it("keeps tasks that fit, urgent and important first", () => {
    const picks = quickPicks(items, 15, today, { archived: new Set(["old"]) });
    expect(picks.map((i) => i.id)).toEqual(["urgent-five", "high-ten", "quick-tag", "ten"]);
  });

  it("only offers unestimated quick wins with at least 15 minutes, and filters by energy", () => {
    expect(quickPicks(items, 5, today).map((i) => i.id)).toEqual(["urgent-five", "archived"]);
    expect(quickPicks(items, 30, today, { energy: "quick" }).map((i) => i.id)).toEqual([
      "quick-tag",
    ]);
  });
});
