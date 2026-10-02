"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useToday } from "@/lib/hooks";
import { countTasks, filterTasks, parseQuickAdd } from "@/lib/tasks-logic";
import type { TaskFilter } from "@/lib/types";
import { addDays } from "@/lib/utils";
import { useTasks } from "@/store/tasks";
import { useUi } from "@/store/ui";
import { TaskItem } from "./TaskItem";

const TITLES: Record<TaskFilter, string> = {
  inbox: "Inbox",
  today: "Today",
  upcoming: "Upcoming",
  completed: "Completed",
};

const EMPTY: Record<TaskFilter, string> = {
  inbox: "Nothing to do. Add a task above.",
  today: "Nothing due today. Enjoy the calm.",
  upcoming: "No upcoming tasks with a due date.",
  completed: "Finished tasks will show up here.",
};

export function TasksView() {
  const tasks = useTasks((s) => s.tasks);
  const addTask = useTasks((s) => s.addTask);
  const clearCompleted = useTasks((s) => s.clearCompleted);
  const filter = useUi((s) => s.taskFilter);
  const query = useUi((s) => s.query);
  const setQuery = useUi((s) => s.setQuery);
  const today = useToday();
  const [draft, setDraft] = useState("");

  const visible = useMemo(
    () => filterTasks(tasks, filter, query, today),
    [tasks, filter, query, today],
  );
  const counts = useMemo(() => countTasks(tasks, today), [tasks, today]);
  const total = counts.inbox + counts.completed;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    const parsed = parseQuickAdd(draft, today, addDays);
    addTask({
      title: parsed.title,
      priority: parsed.priority,
      due: parsed.due ?? (filter === "today" ? today : null),
    });
    setDraft("");
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4 py-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{TITLES[filter]}</h1>
          {total > 0 && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {counts.completed} of {total} tasks completed
            </p>
          )}
        </div>
        {filter === "completed" && counts.completed > 0 && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (window.confirm("Delete all completed tasks?")) clearCompleted();
            }}
          >
            Clear completed
          </button>
        )}
      </div>

      {total > 0 && (
        <div
          role="progressbar"
          aria-label="Overall completion"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={counts.completed}
          className="mb-4 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
        >
          <div
            className="h-full bg-indigo-600 transition-all"
            style={{ width: `${(counts.completed / total) * 100}%` }}
          />
        </div>
      )}

      <form onSubmit={submit} className="mb-3 flex gap-2">
        <input
          id="quick-add"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task…  try “Pay rent tomorrow !high”"
          aria-label="New task"
          className="field"
        />
        <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
          <Plus size={16} aria-hidden /> Add
        </button>
      </form>

      <div className="relative mb-3">
        <Search
          size={15}
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-2.5 text-stone-400"
        />
        <input
          id="list-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks  ( / )"
          aria-label="Search tasks"
          className="field pl-8"
        />
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-6">
        {visible.map((task) => (
          <TaskItem key={task.id} task={task} today={today} />
        ))}
        {visible.length === 0 && (
          <li className="py-10 text-center text-sm text-stone-500 dark:text-stone-400">
            {query ? `No tasks match “${query}”.` : EMPTY[filter]}
          </li>
        )}
      </ul>
    </div>
  );
}
