import { describe, expect, it } from "vitest";
import { moveSelection, resolveShortcut, type KeyInput } from "./shortcuts";

const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  typing: false,
  ...extra,
});
const press = (k: string | KeyInput, pending = "", vim = false) =>
  resolveShortcut(typeof k === "string" ? key(k) : k, pending, vim);

describe("keyboard shortcuts", () => {
  it("opens the palette and makes items even while typing", () => {
    expect(press(key("k", { metaKey: true, typing: true })).action).toEqual({ type: "palette" });
    expect(press(key("†", { altKey: true, code: "KeyT", typing: true })).action).toEqual({
      type: "newTask",
    });
  });

  it("ignores plain keys while typing or with modifiers", () => {
    expect(press(key("x", { typing: true })).action).toBeNull();
    expect(press(key("x", { ctrlKey: true })).action).toBeNull();
  });

  it("acts on the selected item", () => {
    expect(press("x").action).toEqual({ type: "toggleDone" });
    expect(press("1").action).toEqual({ type: "priority", priority: "high" });
    expect(press("0").action).toEqual({ type: "priority", priority: "none" });
    expect(press("T").action).toEqual({ type: "due", when: "tomorrow" });
    expect(press("Delete").action).toEqual({ type: "trash" });
    expect(press("ArrowDown").action).toEqual({ type: "move", to: "next" });
  });

  it("jumps to views with g and a letter", () => {
    const first = press("g");
    expect(first).toEqual({ action: null, pending: "g" });
    expect(press("t", first.pending).action).toEqual({
      type: "go",
      view: { kind: "smart", id: "today" },
    });
    expect(press("z", "g")).toEqual({ action: null, pending: "" });
  });

  it("adds vim keys only in vim mode", () => {
    expect(press("j").action).toBeNull();
    expect(press("j", "", true).action).toEqual({ type: "move", to: "next" });
    expect(press("G", "", true).action).toEqual({ type: "move", to: "last" });
    expect(press("g", "g", true).action).toEqual({ type: "move", to: "first" });
    expect(press("g", "g", false).action).toBeNull();
    const d = press("d", "", true);
    expect(d.pending).toBe("d");
    expect(press("d", d.pending, true).action).toEqual({ type: "trash" });
  });
});

describe("moving the selection", () => {
  const ids = ["a", "b", "c"];
  it("steps through rows and stops at the ends", () => {
    expect(moveSelection(ids, null, "next")).toBe("a");
    expect(moveSelection(ids, null, "previous")).toBe("c");
    expect(moveSelection(ids, "a", "next")).toBe("b");
    expect(moveSelection(ids, "c", "next")).toBe("c");
    expect(moveSelection(ids, "a", "previous")).toBe("a");
    expect(moveSelection(ids, "b", "last")).toBe("c");
    expect(moveSelection(ids, "gone", "next")).toBe("a");
    expect(moveSelection([], null, "next")).toBeNull();
  });
});
