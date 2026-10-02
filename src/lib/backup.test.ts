import { describe, expect, it } from "vitest";
import { createBackup, parseBackup } from "./backup";

describe("backup", () => {
  it("round-trips notes and tasks", () => {
    const note = {
      id: "n1",
      title: "T",
      body: "B",
      createdAt: 1,
      updatedAt: 2,
      pinned: true,
      archived: false,
      deletedAt: null,
    };
    const task = {
      id: "t1",
      title: "Do",
      details: "",
      done: false,
      priority: "high" as const,
      due: "2026-01-01",
      createdAt: 1,
      completedAt: null,
      subtasks: [{ id: "s1", title: "sub", done: true }],
    };
    const text = JSON.stringify(createBackup([note], [task], 5));
    expect(parseBackup(text)).toEqual({ notes: [note], tasks: [task] });
  });

  it("rejects invalid files", () => {
    expect(() => parseBackup("nope")).toThrow("not valid JSON");
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow("not a Notesflow backup");
  });

  it("sanitises malformed entries", () => {
    const text = JSON.stringify({
      app: "notesflow",
      notes: [null, { body: "ok", pinned: "yes" }, 5],
      tasks: [{ title: "  " }, { title: "x", priority: "urgent", due: "tomorrow" }],
    });
    const result = parseBackup(text, 7);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toMatchObject({ body: "ok", pinned: false, createdAt: 7 });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({ priority: "none", due: null });
  });
});
