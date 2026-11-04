import type { Item, Priority } from "./types";

export const FIRST_RUN_KEY = "notesflow:first-run";

export type ExampleTask = {
  title: string;
  body?: string;
  priority?: Priority;
  /** Days from today; omitted for no due date. */
  dueInDays?: number;
};

/** Listed top to bottom as they should appear. */
export const EXAMPLE_TASKS: ExampleTask[] = [
  {
    title: "Swipe this task right to complete it",
    body: "On a phone, swipe a row right to finish it and left for more actions. On a computer, use the checkbox.",
    dueInDays: 0,
  },
  {
    title: "Try quick add: type 'Call Sam tomorrow 5pm !high'",
    body: "Quick add understands dates, times, !priority, #tags, @lists and ~estimates such as ~30m.",
    dueInDays: 1,
  },
  {
    title: "Tap a task to add notes, subtasks and reminders",
  },
  {
    title: "Delete these examples whenever you like",
  },
];

/** Examples are offered once, to a device that has no data and was never set up before. */
export function shouldSeedExamples(state: {
  items: Pick<Item, "id">[];
  listCount: number;
  signedIn: boolean;
  alreadySeeded: boolean;
}): boolean {
  return (
    !state.alreadySeeded && !state.signedIn && state.items.length === 0 && state.listCount === 0
  );
}
