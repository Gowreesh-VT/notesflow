"use client";

import { useState } from "react";
import { Calendar, Check, ChevronDown, ListChecks, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { dueBucket, subtaskProgress } from "@/lib/tasks-logic";
import type { Priority, Task } from "@/lib/types";
import { formatDueLabel } from "@/lib/utils";
import { useTasks } from "@/store/tasks";

const PRIORITY_STYLES: Record<Priority, string> = {
  none: "",
  low: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function TaskItem({ task, today }: { task: Task; today: string }) {
  const [open, setOpen] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const { toggleTask, updateTask, deleteTask, addSubtask, toggleSubtask, deleteSubtask } =
    useTasks.getState();

  const bucket = dueBucket(task, today);
  const progress = subtaskProgress(task);

  return (
    <li className="rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={task.done}
          aria-label={`Mark “${task.title}” as ${task.done ? "not done" : "done"}`}
          onClick={() => toggleTask(task.id)}
          className={clsx(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
            task.done
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-stone-400 hover:border-indigo-500",
          )}
        >
          {task.done && <Check size={12} strokeWidth={3} aria-hidden />}
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              "break-words text-sm font-medium",
              task.done && "text-stone-400 line-through",
            )}
          >
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            {task.priority !== "none" && (
              <span
                className={clsx(
                  "rounded px-1.5 py-0.5 font-medium capitalize",
                  PRIORITY_STYLES[task.priority],
                )}
              >
                {task.priority}
              </span>
            )}
            {task.due && (
              <span
                className={clsx(
                  "inline-flex items-center gap-1",
                  bucket === "overdue" && !task.done
                    ? "font-medium text-red-600 dark:text-red-400"
                    : "text-stone-500 dark:text-stone-400",
                )}
              >
                <Calendar size={12} aria-hidden />
                {bucket === "overdue" && !task.done ? "Overdue · " : ""}
                {formatDueLabel(task.due, today)}
              </span>
            )}
            {progress.total > 0 && (
              <span className="inline-flex items-center gap-1 text-stone-500 dark:text-stone-400">
                <ListChecks size={12} aria-hidden />
                {progress.done}/{progress.total}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="btn btn-ghost px-1.5 py-1"
          aria-expanded={open}
          aria-label={open ? "Hide details" : "Show details"}
          onClick={() => setOpen(!open)}
        >
          <ChevronDown size={16} className={clsx("transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-stone-200 p-3 dark:border-stone-800">
          <input
            value={task.title}
            onChange={(e) => updateTask(task.id, { title: e.target.value })}
            onBlur={(e) => {
              if (!e.target.value.trim()) updateTask(task.id, { title: "Untitled task" });
            }}
            aria-label="Task title"
            className="field"
          />
          <textarea
            value={task.details}
            onChange={(e) => updateTask(task.id, { details: e.target.value })}
            placeholder="Add details…"
            aria-label="Task details"
            rows={2}
            className="field resize-y"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-stone-500 dark:text-stone-400">
              Due date
              <input
                type="date"
                value={task.due ?? ""}
                onChange={(e) => updateTask(task.id, { due: e.target.value || null })}
                className="field mt-1"
              />
            </label>
            <label className="text-xs text-stone-500 dark:text-stone-400">
              Priority
              <select
                value={task.priority}
                onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })}
                className="field mt-1"
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-stone-500 dark:text-stone-400">Subtasks</p>
            <ul className="space-y-1">
              {task.subtasks.map((sub) => (
                <li key={sub.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sub.done}
                    onChange={() => toggleSubtask(task.id, sub.id)}
                    aria-label={`Subtask: ${sub.title}`}
                    className="size-4 accent-indigo-600"
                  />
                  <span
                    className={clsx(
                      "flex-1 break-words",
                      sub.done && "text-stone-400 line-through",
                    )}
                  >
                    {sub.title}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost px-1 py-0.5"
                    aria-label={`Remove subtask ${sub.title}`}
                    onClick={() => deleteSubtask(task.id, sub.id)}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addSubtask(task.id, subtaskDraft);
                setSubtaskDraft("");
              }}
            >
              <input
                value={subtaskDraft}
                onChange={(e) => setSubtaskDraft(e.target.value)}
                placeholder="Add a subtask"
                aria-label="New subtask"
                className="field py-1"
              />
              <button type="submit" className="btn btn-ghost" disabled={!subtaskDraft.trim()}>
                Add
              </button>
            </form>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm(`Delete “${task.title}”?`)) deleteTask(task.id);
              }}
            >
              <Trash2 size={15} aria-hidden /> Delete task
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
