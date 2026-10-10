import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspace } from "./workspace";
import { useUndo, withUndo } from "./undo";

beforeEach(() => {
  useWorkspace.setState({ items: [], tombstones: [] });
  useUndo.setState({ offer: null });
});

describe("withUndo", () => {
  it("offers to reopen a completed task", () => {
    const id = useWorkspace.getState().addItem({ kind: "task", title: "Write" });
    withUndo("Completed", () => useWorkspace.getState().toggleDone(id));
    expect(useWorkspace.getState().items[0].status).toBe("done");
    expect(useUndo.getState().offer?.message).toBe("Completed");
    useUndo.getState().undo();
    expect(useWorkspace.getState().items[0].status).toBe("open");
    expect(useUndo.getState().offer).toBeNull();
  });

  it("brings back a trashed task", () => {
    const id = useWorkspace.getState().addItem({ kind: "task", title: "Write" });
    withUndo("Moved to the trash", () => useWorkspace.getState().trashItem(id));
    expect(useWorkspace.getState().items[0].deletedAt).not.toBeNull();
    useUndo.getState().undo();
    expect(useWorkspace.getState().items[0].deletedAt).toBeNull();
  });

  it("removes the copy a repeating task leaves behind", () => {
    const id = useWorkspace.getState().addItem({ kind: "task", title: "Water", due: "2026-01-01" });
    useWorkspace.getState().updateItem(id, { repeat: { unit: "day", every: 1 } });
    withUndo("Completed", () => useWorkspace.getState().toggleDone(id));
    expect(useWorkspace.getState().items).toHaveLength(2);
    useUndo.getState().undo();
    const { items, tombstones } = useWorkspace.getState();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id, due: "2026-01-01", status: "open" });
    expect(tombstones).toHaveLength(1);
  });

  it("offers nothing when nothing changed", () => {
    withUndo("Nothing", () => undefined);
    expect(useUndo.getState().offer).toBeNull();
  });
});
