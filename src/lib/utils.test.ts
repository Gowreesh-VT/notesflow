import { describe, expect, it } from "vitest";
import {
  addDays,
  displayTitle,
  extractTags,
  formatDueLabel,
  formatRelativeTime,
  getSnippet,
  readingMinutes,
  slugify,
  toDateKey,
  wordCount,
} from "./utils";

describe("extractTags", () => {
  it("finds unique lower-case tags and ignores headings and code", () => {
    const body =
      "# Heading\nWork on #Project and #project plus #ideas-2\n`#inline`\n```\n#fenced\n```";
    expect(extractTags(body)).toEqual(["ideas-2", "project"]);
  });

  it("ignores hashes inside words", () => {
    expect(extractTags("issue#12 and c#")).toEqual([]);
  });
});

describe("text helpers", () => {
  it("counts words and reading time", () => {
    expect(wordCount("  hello   brave new world ")).toBe(4);
    expect(wordCount("")).toBe(0);
    expect(readingMinutes("")).toBe(0);
    expect(readingMinutes("word ".repeat(10))).toBe(1);
    expect(readingMinutes("word ".repeat(660))).toBe(3);
  });

  it("builds snippets without markdown syntax", () => {
    expect(getSnippet("## Title\n- [ ] **bold** [link](http://x.y)")).toBe("Title bold link");
    expect(getSnippet("a".repeat(200), 10)).toBe("aaaaaaaaaa…");
  });

  it("derives a display title", () => {
    expect(displayTitle({ title: " Plan ", body: "x" })).toBe("Plan");
    expect(displayTitle({ title: "", body: "\n## First line\nmore" })).toBe("First line");
    expect(displayTitle({ title: "", body: "" })).toBe("Untitled note");
  });

  it("slugifies file names", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
    expect(slugify("???")).toBe("note");
  });
});

describe("dates", () => {
  it("formats and shifts date keys", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("labels due dates relative to today", () => {
    expect(formatDueLabel("2026-05-10", "2026-05-10")).toBe("Today");
    expect(formatDueLabel("2026-05-11", "2026-05-10")).toBe("Tomorrow");
    expect(formatDueLabel("2026-05-09", "2026-05-10")).toBe("Yesterday");
  });

  it("formats relative times", () => {
    const now = 1_000_000_000_000;
    expect(formatRelativeTime(now - 10_000, now)).toBe("just now");
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe("2d ago");
  });
});
