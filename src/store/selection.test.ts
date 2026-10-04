import { beforeEach, describe, expect, it } from "vitest";
import { useSelection } from "./selection";
import { useUi } from "./ui";

const selection = () => useSelection.getState();

beforeEach(() => {
  selection().exit();
});

describe("selection store", () => {
  it("toggles rows and enters selection mode", () => {
    selection().toggle("a");
    selection().toggle("b");
    expect(selection()).toMatchObject({ active: true, ids: ["a", "b"], anchor: "b" });
    selection().toggle("a");
    expect(selection().ids).toEqual(["b"]);
  });

  it("extends from the anchor, or from a fallback such as the open item", () => {
    const order = ["a", "b", "c", "d"];
    selection().extend(order, "c", "a");
    expect(selection()).toMatchObject({ ids: ["a", "b", "c"], anchor: "a" });
    selection().exit();
    selection().toggle("d");
    selection().extend(order, "b");
    expect(selection().ids).toEqual(["d", "b", "c"]);
  });

  it("prunes hidden rows and forgets a hidden anchor", () => {
    selection().setIds(["a", "b"]);
    selection().toggle("c");
    selection().prune(["a", "b"]);
    expect(selection()).toMatchObject({ ids: ["a", "b"], anchor: null });
  });

  it("clears when the view changes", () => {
    selection().toggle("a");
    useUi.getState().setView({ kind: "smart", id: "today" });
    expect(selection()).toMatchObject({ active: false, ids: [], anchor: null });
  });
});
