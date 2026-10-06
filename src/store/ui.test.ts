import { beforeEach, describe, expect, it } from "vitest";
import type { GroupBy } from "@/lib/items-logic";
import { useUi } from "./ui";

beforeEach(() => {
  useUi.setState({ groupBy: {} });
});

describe("group by", () => {
  it("remembers a grouping per view and ignores unknown values", () => {
    useUi.getState().setGroupBy("list:a", "priority");
    useUi.getState().setGroupBy("smart:today", "tag");
    useUi.getState().setGroupBy("list:a", "bogus" as GroupBy);
    expect(useUi.getState().groupBy).toEqual({ "list:a": "priority", "smart:today": "tag" });
  });

  it("remembers board layouts and the pinned list on this device", () => {
    useUi.getState().setListLayout("a", "board");
    useUi.getState().setListLayout("b", "list");
    useUi.getState().setSplitListId("b");
    const stored = JSON.parse(window.localStorage.getItem("notesflow:ui") ?? "{}");
    expect(stored.state.listLayout).toEqual({ a: "board", b: "list" });
    expect(stored.state.splitListId).toBe("b");
    useUi.getState().setSplitListId(null);
    expect(useUi.getState().splitListId).toBeNull();
  });

  it("is persisted on this device", () => {
    useUi.getState().setGroupBy("list:a", "none");
    const stored = JSON.parse(window.localStorage.getItem("notesflow:ui") ?? "{}");
    expect(stored.state.groupBy).toEqual({ "list:a": "none" });
  });
});

describe("sidebar sections", () => {
  it("folds and unfolds a group, remembered on this device", () => {
    useUi.setState({ foldedSidebarSections: [] });
    useUi.getState().toggleSidebarSection("views");
    useUi.getState().toggleSidebarSection("tags");
    expect(useUi.getState().foldedSidebarSections).toEqual(["views", "tags"]);
    const stored = JSON.parse(window.localStorage.getItem("notesflow:ui") ?? "{}");
    expect(stored.state.foldedSidebarSections).toEqual(["views", "tags"]);
    useUi.getState().toggleSidebarSection("views");
    expect(useUi.getState().foldedSidebarSections).toEqual(["tags"]);
  });

  it("ignores a stored value that is not a list of ids", async () => {
    window.localStorage.setItem(
      "notesflow:ui",
      JSON.stringify({ state: { foldedSidebarSections: "views" }, version: 2 }),
    );
    await useUi.persist.rehydrate();
    expect(useUi.getState().foldedSidebarSections).toEqual([]);
  });
});
