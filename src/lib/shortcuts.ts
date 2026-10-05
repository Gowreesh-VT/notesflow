import type { Priority, View } from "./types";

/** What a key press asks for. Running it is up to the KeyboardShortcuts component. */
export type ShortcutAction =
  | { type: "palette" }
  | { type: "newTask" }
  | { type: "newNote" }
  | { type: "dailyNote" }
  | { type: "search" }
  | { type: "help" }
  | { type: "go"; view: View }
  | { type: "move"; to: "next" | "previous" | "first" | "last" }
  | { type: "toggleDone" }
  | { type: "priority"; priority: Priority }
  | { type: "due"; when: "today" | "tomorrow" | "none" }
  | { type: "pin" }
  | { type: "edit" }
  | { type: "trash" }
  | { type: "close" };

export type KeyInput = {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  /** Focus is in a text field, so plain keys are typing. */
  typing: boolean;
};

/** "g" then a letter jumps to a view. */
export const GO_TO: Record<string, { view: View; label: string }> = {
  i: { view: { kind: "smart", id: "inbox" }, label: "Inbox" },
  t: { view: { kind: "smart", id: "today" }, label: "Today" },
  w: { view: { kind: "smart", id: "week" }, label: "Next 7 days" },
  a: { view: { kind: "smart", id: "all" }, label: "All" },
  c: { view: { kind: "calendar" }, label: "Calendar" },
  m: { view: { kind: "matrix" }, label: "Matrix" },
  p: { view: { kind: "plan" }, label: "Plan my day" },
  f: { view: { kind: "focus" }, label: "Focus" },
  h: { view: { kind: "habits" }, label: "Habits" },
  r: { view: { kind: "review" }, label: "Weekly review" },
  s: { view: { kind: "settings" }, label: "Settings" },
};

const PRIORITY_KEYS: Record<string, Priority> = {
  "1": "high",
  "2": "medium",
  "3": "low",
  "0": "none",
};

type Result = { action: ShortcutAction | null; pending: string };
const none = (pending = ""): Result => ({ action: null, pending });
const act = (action: ShortcutAction): Result => ({ action, pending: "" });

/**
 * Maps a key press to an action. `pending` holds the first key of a two-key sequence ("g i", vim's "g g" and
 * "d d"); the result says what is pending next. Vim mode adds j/k/G/gg/dd on top of the standard keys.
 */
export function resolveShortcut(input: KeyInput, pending: string, vim: boolean): Result {
  const { key, code, altKey, shiftKey } = input;
  const mod = Boolean(input.ctrlKey || input.metaKey);

  // These work everywhere, even while typing.
  if (mod && !altKey && key.toLowerCase() === "k") return act({ type: "palette" });
  if (altKey && !mod) {
    if (code === "KeyN") return act({ type: "newNote" });
    if (code === "KeyT") return act({ type: "newTask" });
    if (code === "KeyJ") return act({ type: "dailyNote" });
  }
  if (input.typing || mod || altKey) return none();

  if (pending === "g") {
    if (vim && key === "g") return act({ type: "move", to: "first" });
    const target = GO_TO[key];
    return target ? act({ type: "go", view: target.view }) : none();
  }
  if (pending === "d") return vim && key === "d" ? act({ type: "trash" }) : none();

  switch (key) {
    case "g":
      return none("g");
    case "/":
      return act({ type: "search" });
    case "?":
      return act({ type: "help" });
    case "n":
      return act({ type: "newTask" });
    case "N":
      return act({ type: "newNote" });
    case "ArrowDown":
      return shiftKey ? none() : act({ type: "move", to: "next" });
    case "ArrowUp":
      return shiftKey ? none() : act({ type: "move", to: "previous" });
    case "x":
      return act({ type: "toggleDone" });
    case "t":
      return act({ type: "due", when: "today" });
    case "T":
      return act({ type: "due", when: "tomorrow" });
    case "r":
      return act({ type: "due", when: "none" });
    case "s":
      return act({ type: "pin" });
    case "e":
      return act({ type: "edit" });
    case "Delete":
    case "Backspace":
      return act({ type: "trash" });
    case "Escape":
      return act({ type: "close" });
  }
  if (key in PRIORITY_KEYS) return act({ type: "priority", priority: PRIORITY_KEYS[key] });
  if (vim) {
    if (key === "j") return act({ type: "move", to: "next" });
    if (key === "k") return act({ type: "move", to: "previous" });
    if (key === "G") return act({ type: "move", to: "last" });
    if (key === "d") return none("d");
    if (key === "o" || key === "i") return act({ type: "edit" });
  }
  return none();
}

/** The next selection when moving through `ids` (the visible rows, top to bottom). */
export function moveSelection(
  ids: string[],
  current: string | null,
  to: "next" | "previous" | "first" | "last",
): string | null {
  if (!ids.length) return null;
  if (to === "first") return ids[0];
  if (to === "last") return ids[ids.length - 1];
  const index = current ? ids.indexOf(current) : -1;
  if (index < 0) return to === "next" ? ids[0] : ids[ids.length - 1];
  return ids[Math.max(0, Math.min(ids.length - 1, index + (to === "next" ? 1 : -1)))];
}

export type ShortcutGroup = { title: string; items: { keys: string; label: string }[] };

export const SHORTCUT_HELP: ShortcutGroup[] = [
  {
    title: "Anywhere",
    items: [
      { keys: "Ctrl/⌘ K", label: "Command palette" },
      { keys: "n  or  Alt T", label: "New task" },
      { keys: "N  or  Alt N", label: "New note" },
      { keys: "Alt J", label: "Today’s daily note" },
      { keys: "/", label: "Search the current list" },
      { keys: "?", label: "Show this help" },
    ],
  },
  {
    title: "Go to",
    items: Object.entries(GO_TO).map(([letter, target]) => ({
      keys: `g ${letter}`,
      label: target.label,
    })),
  },
  {
    title: "Selected task or note",
    items: [
      { keys: "↑ / ↓", label: "Select the previous or next item" },
      { keys: "e", label: "Edit the title" },
      { keys: "x", label: "Complete or reopen" },
      { keys: "1  2  3  0", label: "Priority high, medium, low, none" },
      { keys: "t  /  T", label: "Due today / tomorrow" },
      { keys: "r", label: "Remove the due date" },
      { keys: "s", label: "Pin or unpin" },
      { keys: "Delete", label: "Move to trash" },
      { keys: "Esc", label: "Close the details" },
    ],
  },
  {
    title: "Vim keys (turn on in Settings)",
    items: [
      { keys: "j / k", label: "Next / previous item" },
      { keys: "g g  /  G", label: "First / last item" },
      { keys: "o  or  i", label: "Edit the title" },
      { keys: "d d", label: "Move to trash" },
    ],
  },
  {
    title: "Elsewhere",
    items: [
      { keys: "Alt ↑ / ↓", label: "Move a list, or a task in manual order" },
      { keys: "Alt ← / →", label: "Move a task a day in the calendar" },
      { keys: "Ctrl/⌘ click", label: "Select several items" },
      { keys: "Shift click", label: "Select a range of items" },
    ],
  },
];
