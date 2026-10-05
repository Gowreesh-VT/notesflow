"use client";

import { useState } from "react";
import { ArrowUpRight, CornerDownRight, X } from "lucide-react";
import clsx from "clsx";
import { countSubtasks, MAX_SUBTASK_DEPTH } from "@/lib/subtasks";
import type { Item, Subtask } from "@/lib/types";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

function AddForm({
  placeholder,
  onAdd,
  onDone,
  autoFocus = false,
}: {
  placeholder: string;
  onAdd: (title: string) => void;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        onAdd(draft);
        setDraft("");
      }}
    >
      <input
        autoFocus={autoFocus}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone?.();
        }}
        onBlur={() => {
          if (!draft.trim()) onDone?.();
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="field py-1"
      />
      <button type="submit" className="btn btn-ghost" disabled={!draft.trim()}>
        Add
      </button>
    </form>
  );
}

function SubtaskNode({
  item,
  node,
  depth,
  readOnly,
}: {
  item: Item;
  node: Subtask;
  depth: number;
  readOnly: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const { addSubtask, renameSubtask, toggleSubtask, deleteSubtask, subtaskToTask } =
    useWorkspace.getState();
  const selectItem = useUi((s) => s.selectItem);
  const children = node.children ?? [];
  const progress = countSubtasks(children);

  return (
    <li>
      <div className="group flex items-center gap-2 rounded-lg py-0.5 text-sm">
        <input
          type="checkbox"
          checked={node.done}
          disabled={readOnly}
          onChange={() => toggleSubtask(item.id, node.id)}
          aria-label={`Subtask: ${node.title}`}
          className="size-4 shrink-0 accent-accent-600"
        />
        <input
          key={node.title}
          defaultValue={node.title}
          readOnly={readOnly}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== node.title) {
              renameSubtask(item.id, node.id, e.target.value);
            } else {
              e.target.value = node.title;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          aria-label="Subtask title"
          className={clsx(
            "min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 outline-none focus:bg-white focus:ring-1 focus:ring-accent-300 dark:focus:bg-stone-900",
            node.done && "text-stone-500 line-through dark:text-stone-400",
          )}
        />
        {children.length > 0 && (
          <span className="shrink-0 text-xs tabular-nums text-stone-500 dark:text-stone-400">
            {progress.done}/{progress.total}
          </span>
        )}
        {!readOnly && (
          <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            {depth < MAX_SUBTASK_DEPTH && (
              <button
                type="button"
                className="btn btn-ghost px-1 py-0.5"
                aria-label={`Add a subtask under ${node.title}`}
                title="Add a subtask under this one"
                onClick={() => setAdding(true)}
              >
                <CornerDownRight size={14} />
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost px-1 py-0.5"
              aria-label={`Convert ${node.title} into a task`}
              title="Convert into a task"
              onClick={() => {
                const id = subtaskToTask(item.id, node.id);
                if (id) selectItem(id);
              }}
            >
              <ArrowUpRight size={14} />
            </button>
            <button
              type="button"
              className="btn btn-ghost px-1 py-0.5"
              aria-label={`Remove subtask ${node.title}`}
              title="Remove"
              onClick={() => deleteSubtask(item.id, node.id)}
            >
              <X size={14} />
            </button>
          </span>
        )}
      </div>
      {(children.length > 0 || adding) && (
        <div className="ml-2 border-l border-stone-200 pl-4 dark:border-stone-800">
          <SubtaskList item={item} list={children} depth={depth + 1} readOnly={readOnly} />
          {adding && (
            <div className="py-1">
              <AddForm
                autoFocus
                placeholder={`Subtask under “${node.title}”`}
                onAdd={(title) => addSubtask(item.id, title, node.id)}
                onDone={() => setAdding(false)}
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function SubtaskList({
  item,
  list,
  depth,
  readOnly,
}: {
  item: Item;
  list: Subtask[];
  depth: number;
  readOnly: boolean;
}) {
  return (
    <ul className="space-y-0.5">
      {list.map((node) => (
        <SubtaskNode key={node.id} item={item} node={node} depth={depth} readOnly={readOnly} />
      ))}
    </ul>
  );
}

/** Subtasks of a task, nested up to five levels, with roll-up progress. */
export function SubtaskTree({ item, readOnly }: { item: Item; readOnly: boolean }) {
  const addSubtask = useWorkspace((s) => s.addSubtask);
  const progress = countSubtasks(item.subtasks);
  return (
    <section aria-label="Subtasks" className="px-4 pb-3">
      <h2 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
        Subtasks
        {progress.total > 0 && (
          <span className="font-normal normal-case tabular-nums">
            {progress.done}/{progress.total}
          </span>
        )}
      </h2>
      {progress.total > 0 && (
        <div
          className="mb-2 h-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
          role="progressbar"
          aria-label="Subtask progress"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
        >
          <div
            className="h-full rounded-full bg-accent-500 transition-[width]"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
      )}
      <SubtaskList item={item} list={item.subtasks} depth={1} readOnly={readOnly} />
      {!readOnly && (
        <div className="mt-2">
          <AddForm placeholder="Add a subtask" onAdd={(title) => addSubtask(item.id, title)} />
        </div>
      )}
    </section>
  );
}
