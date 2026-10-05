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
