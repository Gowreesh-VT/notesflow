import type { Item } from "./types";

/** Tasks a new user adds before we mention signing in to sync. */
export const NUDGE_AFTER_TASKS = 5;

export const NUDGE_KEY = "notesflow:signin-nudge";

/** Tasks the user created themselves (not templates, not in the trash). */
export function countOwnTasks(items: Item[]): number {
  return items.filter((i) => i.kind === "task" && !i.template && i.deletedAt === null).length;
}

/** Whether to offer signing in: accounts exist here, the user is signed out, has added a few tasks, and has not declined. */
export function shouldNudgeSignIn(state: {
  accountsAvailable: boolean;
  signedIn: boolean;
  dismissed: boolean;
  taskCount: number;
}): boolean {
  return (
    state.accountsAvailable &&
    !state.signedIn &&
    !state.dismissed &&
    state.taskCount >= NUDGE_AFTER_TASKS
  );
}
