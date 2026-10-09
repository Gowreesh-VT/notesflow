"use client";

import { useMemo, useState } from "react";
import { CornerDownRight } from "lucide-react";
import { flattenSubtasks, findSubtask, MAX_SUBTASK_DEPTH, subtreeHeight } from "@/lib/subtasks";
import type { Item } from "@/lib/types";
import { displayTitle } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { askConfirm } from "@/store/dialog";

/** Footer action that turns a task into a subtask of another task (optionally under one of its subtasks). */
export function MakeSubtask({ item }: { item: Item }) {
  const items = useWorkspace((s) => s.items);
  const taskToSubtask = useWorkspace((s) => s.taskToSubtask);
  const selectItem = useUi((s) => s.selectItem);
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState("");

  const candidates = useMemo(
    () =>
      items
        .filter(
          (i) =>
            i.id !== item.id &&
            i.kind === "task" &&
            i.status === "open" &&
            i.deletedAt === null &&
            !i.template,
        )
        .sort(
          (a, b) =>
            Number(b.listId === item.listId) - Number(a.listId === item.listId) ||
            displayTitle(a).localeCompare(displayTitle(b)),
        ),
    [items, item.id, item.listId],
  );
  const target = candidates.find((c) => c.id === targetId);
  // Only offer parents where the moved task (and its own subtasks) still fits within five levels.
  const height = 1 + Math.max(0, ...item.subtasks.map(subtreeHeight));
  const parents = target
    ? flattenSubtasks(target.subtasks).filter(
        (s) =>
          (findSubtask(target.subtasks, s.id)?.depth ?? MAX_SUBTASK_DEPTH) + height <=
          MAX_SUBTASK_DEPTH,
      )
    : [];

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        <CornerDownRight size={15} aria-hidden /> Make subtask
      </button>
    );
  }

  return (
    <form
      className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-stone-100 p-2 text-sm dark:bg-stone-900"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!targetId) return;
        if (item.body.trim()) {
          const ok = await askConfirm({
            title: "Move under another task?",
            message: "The task’s description will not be kept.",
            confirmLabel: "Continue",
          });
          if (!ok) return;
        }
        if (taskToSubtask(item.id, targetId, parentId || null)) {
          selectItem(targetId);
        } else {
          setError("That would nest deeper than five levels.");
        }
      }}
    >
      <label className="sr-only" htmlFor="make-subtask-target">
        Parent task
      </label>
      <select
        id="make-subtask-target"
        value={targetId}
        onChange={(e) => {
          setTargetId(e.target.value);
          setParentId("");
          setError("");
        }}
        className="field w-auto min-w-0 flex-1"
      >
        <option value="">Move under task…</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {displayTitle(c)}
          </option>
        ))}
      </select>
      {parents.length > 0 && (
        <select
          aria-label="Under subtask"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="field w-auto min-w-0 flex-1"
        >
          <option value="">At the top level</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              Under “{p.title}”
            </option>
          ))}
        </select>
      )}
      <button type="submit" className="btn btn-primary" disabled={!targetId}>
        Move
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && (
        <p role="alert" className="w-full text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
