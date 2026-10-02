import type { Priority, Task, TaskFilter } from "./types";

export type DueBucket = "overdue" | "today" | "upcoming" | "none";

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };

export function dueBucket(task: Pick<Task, "due">, today: string): DueBucket {
  if (!task.due) return "none";
  if (task.due < today) return "overdue";
  if (task.due === today) return "today";
  return "upcoming";
}

export function filterTasks(
  tasks: Task[],
  filter: TaskFilter,
  query: string,
  today: string,
): Task[] {
  const q = query.trim().toLowerCase();

  const byView = tasks.filter((task) => {
    if (filter === "completed") return task.done;
    if (task.done) return false;
    const bucket = dueBucket(task, today);
    if (filter === "today") return bucket === "today" || bucket === "overdue";
    if (filter === "upcoming") return bucket === "upcoming";
    return true;
  });

  const matching = q
    ? byView.filter(
        (task) =>
          task.title.toLowerCase().includes(q) ||
          task.details.toLowerCase().includes(q) ||
          task.subtasks.some((s) => s.title.toLowerCase().includes(q)),
      )
    : byView;

  return [...matching].sort((a, b) => {
    if (filter === "completed") return (b.completedAt ?? 0) - (a.completedAt ?? 0);
    if (a.due !== b.due) {
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    }
    if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return a.createdAt - b.createdAt;
  });
}

export function countTasks(tasks: Task[], today: string) {
  let inbox = 0;
  let todayCount = 0;
  let upcoming = 0;
  let completed = 0;
  for (const task of tasks) {
    if (task.done) {
      completed += 1;
      continue;
    }
    inbox += 1;
    const bucket = dueBucket(task, today);
    if (bucket === "today" || bucket === "overdue") todayCount += 1;
    if (bucket === "upcoming") upcoming += 1;
  }
  return { inbox, today: todayCount, upcoming, completed };
}

export function subtaskProgress(task: Pick<Task, "subtasks">): { done: number; total: number } {
  return {
    done: task.subtasks.filter((s) => s.done).length,
    total: task.subtasks.length,
  };
}

const PRIORITY_WORDS: Record<string, Priority> = {
  "!high": "high",
  "!h": "high",
  "!medium": "medium",
  "!med": "medium",
  "!m": "medium",
  "!low": "low",
  "!l": "low",
};

/** Understands quick-add input such as "Buy milk tomorrow !high". */
export function parseQuickAdd(
  input: string,
  today: string,
  addDays: (dateKey: string, days: number) => string,
): { title: string; priority: Priority; due: string | null } {
  let priority: Priority = "none";
  let due: string | null = null;
  const kept: string[] = [];

  for (const word of input.trim().split(/\s+/)) {
    const lower = word.toLowerCase();
    if (lower in PRIORITY_WORDS) priority = PRIORITY_WORDS[lower];
    else if (lower === "today") due = today;
    else if (lower === "tomorrow") due = addDays(today, 1);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) due = lower;
    else kept.push(word);
  }

  return { title: kept.join(" ").trim() || input.trim(), priority, due };
}
