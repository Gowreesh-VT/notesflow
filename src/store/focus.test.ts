import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_FOCUS_SETTINGS } from "@/lib/focus";
import { useFocus } from "./focus";
import { useWorkspace } from "./workspace";

const focus = () => useFocus.getState();
const task = () => useWorkspace.getState().items[0];
const MIN = 60_000;

beforeEach(() => {
  useWorkspace.setState({ items: [], lists: [], folders: [], filters: [], tombstones: [] });
  useFocus.setState({ settings: DEFAULT_FOCUS_SETTINGS, session: null });
});

describe("focus sessions", () => {
  it("records focused stretches on the task, minus pauses, and moves to a break", () => {
    const id = useWorkspace.getState().addItem({ kind: "task", title: "Write" });
    focus().start(id, 0);
    focus().pause(10 * MIN);
    focus().resume(15 * MIN);
    expect(focus().session?.endsAt).toBe(30 * MIN);
    expect(focus().finishPhase(30 * MIN)).toBe("work");
    const entries = task().timeEntries!;
    expect(entries.map((e) => [e.start, e.end, e.focus])).toEqual([
      [0, 10 * MIN, true],
      [15 * MIN, 30 * MIN, true],
    ]);
    // Breaks wait for a click unless auto-start is on.
    expect(focus().session).toMatchObject({
      phase: "short",
      endsAt: null,
      pausedRemaining: 5 * MIN,
    });
  });

  it("stops a running stopwatch and records nothing without a task", () => {
    const id = useWorkspace.getState().addItem({ kind: "task", title: "Read" });
    useWorkspace.getState().startTimer(id);
    focus().start(null, 1_000);
    expect(task().timeEntries![0].end).not.toBeNull();
    focus().stop(20 * MIN);
    expect(task().timeEntries).toHaveLength(1);
    expect(focus().session).toBeNull();
  });

  it("skips to a long break after enough sessions and auto-starts when asked", () => {
    focus().setSettings({ longEvery: 2, autoStart: true });
    focus().start(null, 0);
    focus().skip(MIN);
    expect(focus().session).toMatchObject({ phase: "short", completedWork: 1 });
    focus().skip(2 * MIN);
    focus().skip(3 * MIN);
    expect(focus().session).toMatchObject({
      phase: "long",
      completedWork: 2,
      endsAt: 3 * MIN + 15 * MIN,
    });
  });
});
