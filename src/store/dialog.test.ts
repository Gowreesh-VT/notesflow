import { beforeEach, describe, expect, it } from "vitest";
import { askConfirm, askText, useDialogs } from "./dialog";

describe("dialog requests", () => {
  beforeEach(() => useDialogs.setState({ queue: [] }));

  it("queues requests and resolves them in order", async () => {
    const first = askConfirm({ title: "Delete?", danger: true });
    const second = askText({ title: "Rename", label: "Name", initial: "A" });
    expect(useDialogs.getState().queue).toHaveLength(2);

    const [a, b] = useDialogs.getState().queue;
    if (a.kind === "confirm") a.resolve(true);
    useDialogs.getState().shift();
    if (b.kind === "text") b.resolve("B");
    useDialogs.getState().shift();

    expect(await first).toBe(true);
    expect(await second).toBe("B");
    expect(useDialogs.getState().queue).toHaveLength(0);
  });

  it("applies defaults", () => {
    void askConfirm({ title: "x" });
    void askText({ title: "y", label: "z" });
    const [c, t] = useDialogs.getState().queue;
    expect(c).toMatchObject({ confirmLabel: "Confirm", danger: false });
    expect(t).toMatchObject({ confirmLabel: "Save", initial: "" });
  });
});
