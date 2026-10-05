import { describe, expect, it } from "vitest";
import { nextMonday, reviewRange, weeklyReview } from "./review";
import { INBOX_ID, type Item } from "./types";

const at = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12).getTime();
};
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

describe("weekly review", () => {
  // 2026-10-07 is a Wednesday.
  const today = "2026-10-07";

  it("picks the last 7 days, or earlier weeks", () => {
    expect(reviewRange(today)).toEqual({ from: "2026-10-01", to: "2026-10-07" });
    expect(reviewRange(today, 1)).toEqual({ from: "2026-09-24", to: "2026-09-30" });
  });

  it("finds finished, skipped and slipped tasks in the range", () => {
    const review = weeklyReview(
      [
        task("done-in", { status: "done", completedAt: at("2026-10-03") }),
        task("done-old", { status: "done", completedAt: at("2026-09-20") }),
        task("skipped", { status: "wontdo", completedAt: at("2026-10-05") }),
        task("slipped", { due: "2026-10-02" }),
        task("due-today", { due: today }),
        task("trashed", { due: "2026-10-02", deletedAt: 5 }),
        task("note", { kind: "note", due: "2026-10-02" }),
      ],
      today,
      reviewRange(today),
    );
    expect(review.finished.map((i) => i.id)).toEqual(["done-in"]);
    expect(review.skipped.map((i) => i.id)).toEqual(["skipped"]);
    expect(review.slipped.map((i) => i.id)).toEqual(["slipped"]);
    expect(review.perDay.find((d) => d.date === "2026-10-03")?.count).toBe(1);
  });

  it("finds next Monday", () => {
    expect(nextMonday(today)).toBe("2026-10-12");
    expect(nextMonday("2026-10-12")).toBe("2026-10-19");
    expect(nextMonday("2026-10-11")).toBe("2026-10-12");
  });
});
