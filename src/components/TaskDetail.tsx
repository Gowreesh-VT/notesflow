"use client";

import { useState } from "react";
import { ArrowLeft, Ban, Check, Copy, LayoutTemplate, RotateCcw, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { itemTags } from "@/lib/items-logic";
import { useToday } from "@/lib/hooks";
import type { Item, Priority } from "@/lib/types";
import { addDays, formatDueLabel } from "@/lib/utils";
import { useUi, type EditorMode } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { ListSelect } from "./ListSelect";
import { MarkdownEditor, ModeSwitch } from "./MarkdownEditor";
import { EnergyField } from "./EnergyField";
import { EstimateField } from "./EstimateField";
import { MakeSubtask } from "./MakeSubtask";
import { OutcomeField } from "./Outcome";
import { RemindersField } from "./RemindersField";
import { RepeatField } from "./RepeatField";
import { SubtaskTree } from "./SubtaskTree";
import { TimeTracker } from "./TimeTracker";

const PRIORITIES: { value: Priority; label: string; active: string }[] = [
  { value: "none", label: "None", active: "bg-stone-200 dark:bg-stone-700" },
  {
    value: "low",
    label: "Low",
    active: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  },
  {
    value: "medium",
    label: "Medium",
    active: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  {
    value: "high",
    label: "High",
    active: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
];

export function TaskDetail({ item }: { item: Item }) {
  const today = useToday();
  const [descriptionMode, setDescriptionMode] = useState<EditorMode>("edit");
  const selectItem = useUi((s) => s.selectItem);
  const promptOutcome = useUi((s) => s.promptOutcome);
  const [notice, setNotice] = useState("");
  const {
    updateItem,
    setStatus,
    toggleDone,
    trashItem,
    restoreItem,
    deleteForever,
    duplicateItem,
    saveAsTemplate,
  } = useWorkspace.getState();

  const sections = useWorkspace((s) => s.lists.find((l) => l.id === item.listId)?.sections) ?? [];
  const trashed = item.deletedAt !== null;
  const tags = itemTags(item);
  const quickDates = [
    { label: "Today", value: today },
    { label: "Tomorrow", value: addDays(today, 1) },
    { label: "Next week", value: addDays(today, 7) },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {trashed && (
        <div className="flex items-center justify-between gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span>This task is in the trash.</span>
          <span className="flex gap-1">
            <button type="button" className="btn btn-ghost" onClick={() => restoreItem(item.id)}>
              <RotateCcw size={15} aria-hidden /> Restore
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm(`Permanently delete “${item.title}”?`)) {
                  selectItem(null);
                  deleteForever(item.id);
                }
              }}
            >
              Delete forever
            </button>
          </span>
        </div>
      )}

      <div className="flex items-start gap-3 px-4 pb-2 pt-4">
        <button
          type="button"
          className="btn btn-ghost mt-0.5 px-2"
          aria-label="Close details"
          onClick={() => selectItem(null)}
        >
          <ArrowLeft size={18} className="md:hidden" />
          <X size={18} className="hidden md:block" />
        </button>
        <button
          type="button"
          role="checkbox"
          aria-checked={item.status === "done"}
          aria-label={item.status === "open" ? "Mark as done" : "Mark as not done"}
          disabled={trashed}
          onClick={() => {
            const finishedId = toggleDone(item.id);
            if (finishedId) promptOutcome(finishedId);
          }}
          className={clsx(
            "mt-1.5 flex size-[22px] shrink-0 items-center justify-center rounded-md border-2 transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
            item.status === "done"
              ? "border-accent-600 bg-accent-600 text-white"
              : item.status === "wontdo"
                ? "border-stone-400 bg-stone-300 text-white dark:bg-stone-600"
                : "border-stone-400 hover:border-accent-500",
          )}
        >
          {item.status === "done" && <Check size={14} strokeWidth={3} aria-hidden />}
          {item.status === "wontdo" && <Ban size={13} strokeWidth={3} aria-hidden />}
        </button>
        <input
          value={item.title}
          onChange={(e) => updateItem(item.id, { title: e.target.value })}
          onBlur={(e) => {
            if (!e.target.value.trim()) updateItem(item.id, { title: "Untitled task" });
          }}
          readOnly={trashed}
          aria-label="Task title"
          placeholder="Task title"
          className={clsx(
            "heading-display min-w-0 flex-1 bg-transparent text-2xl font-semibold outline-none placeholder:text-stone-400",
            item.status !== "open" && "text-stone-400 line-through",
          )}
        />
      </div>

      <dl className="grid grid-cols-[6rem_1fr] items-center gap-x-3 gap-y-3 px-4 py-3 text-sm">
        <dt className="text-stone-500 dark:text-stone-400">Due</dt>
        <dd className="flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            aria-label="Due date"
            value={item.due ?? ""}
            disabled={trashed}
            onChange={(e) => updateItem(item.id, { due: e.target.value || null })}
            className="field w-auto"
          />
          {!trashed &&
            quickDates.map((d) => (
              <button
                key={d.label}
                type="button"
                onClick={() => updateItem(item.id, { due: d.value })}
                className={clsx(
                  "btn px-2 py-1 text-xs",
                  item.due === d.value
                    ? "bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
                    : "btn-ghost",
                )}
              >
                {d.label}
              </button>
            ))}
          {!trashed && item.due && (
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={() => updateItem(item.id, { due: null })}
            >
              <X size={12} aria-hidden /> Clear
              <span className="sr-only"> due date ({formatDueLabel(item.due, today)})</span>
            </button>
          )}
        </dd>

        {item.due && (
          <>
            <dt className="text-stone-500 dark:text-stone-400">Starts</dt>
            <dd className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                aria-label="Start date"
                value={item.startDate ?? ""}
                max={item.due}
                disabled={trashed}
                onChange={(e) => updateItem(item.id, { startDate: e.target.value || null })}
                className="field w-auto"
              />
              {item.startDate ? (
                !trashed && (
                  <button
                    type="button"
                    className="btn btn-ghost px-2 py-1 text-xs"
                    onClick={() => updateItem(item.id, { startDate: null })}
                  >
                    <X size={12} aria-hidden /> Same day
                  </button>
                )
              ) : (
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  Optional, for tasks that span several days
                </span>
              )}
            </dd>
          </>
        )}

        {item.due && (
          <>
            <dt className="text-stone-500 dark:text-stone-400">Time</dt>
            <dd className="flex flex-wrap items-center gap-1.5">
              <input
                type="time"
                aria-label="Due time"
                value={item.dueTime ?? ""}
                disabled={trashed}
                onChange={(e) => updateItem(item.id, { dueTime: e.target.value || null })}
                className="field w-auto"
              />
              {item.dueTime ? (
                !trashed && (
                  <button
                    type="button"
                    className="btn btn-ghost px-2 py-1 text-xs"
                    onClick={() => updateItem(item.id, { dueTime: null })}
                  >
                    <X size={12} aria-hidden /> All day
                  </button>
                )
              ) : (
                <span className="text-xs text-stone-500 dark:text-stone-400">All day</span>
              )}
            </dd>
          </>
        )}

        {item.due && (
          <>
            <dt className="self-start pt-1.5 text-stone-500 dark:text-stone-400">Reminders</dt>
            <dd>
              <RemindersField item={item} readOnly={trashed} />
            </dd>
          </>
        )}

        {item.status === "done" && (
          <>
            <dt className="self-start pt-1 text-stone-500 dark:text-stone-400">Outcome</dt>
            <dd>
              <OutcomeField item={item} />
            </dd>
          </>
        )}

        <dt className="self-start pt-1.5 text-stone-500 dark:text-stone-400">Repeat</dt>
        <dd>
          <RepeatField
            value={item.repeat}
            disabled={trashed}
            onChange={(repeat) => updateItem(item.id, { repeat })}
          />
        </dd>

        <dt className="text-stone-500 dark:text-stone-400">Estimate</dt>
        <dd>
          <EstimateField
            label="Estimated time"
            value={item.estimate}
            disabled={trashed}
            onChange={(estimate) => updateItem(item.id, { estimate })}
          />
        </dd>

        <dt className="text-stone-500 dark:text-stone-400">Energy</dt>
        <dd>
          <EnergyField
            value={item.energy}
            disabled={trashed}
            onChange={(energy) => updateItem(item.id, { energy })}
          />
        </dd>

        <dt className="text-stone-500 dark:text-stone-400">Priority</dt>
        <dd>
          <div
            role="radiogroup"
            aria-label="Priority"
            className="inline-flex rounded-lg bg-stone-100 p-0.5 dark:bg-stone-800"
          >
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={item.priority === p.value}
                disabled={trashed}
                onClick={() => updateItem(item.id, { priority: p.value })}
                className={clsx(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  item.priority === p.value ? p.active : "text-stone-600 dark:text-stone-300",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </dd>

        <dt className="text-stone-500 dark:text-stone-400">List</dt>
        <dd>
          <ListSelect
            value={item.listId}
            onChange={(listId) => updateItem(item.id, { listId })}
            className="field w-auto max-w-full"
          />
        </dd>

        {sections.length > 0 && (
          <>
            <dt className="text-stone-500 dark:text-stone-400">Section</dt>
            <dd>
              <select
                aria-label="Section"
                value={sections.some((s) => s.id === item.sectionId) ? item.sectionId! : ""}
                onChange={(e) => updateItem(item.id, { sectionId: e.target.value || null })}
                className="field w-auto max-w-full"
              >
                <option value="">None</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </dd>
          </>
        )}

        {tags.length > 0 && (
          <>
            <dt className="text-stone-500 dark:text-stone-400">Tags</dt>
            <dd className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-stone-200 px-1.5 py-0.5 text-xs dark:bg-stone-800"
                >
                  #{tag}
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>

      <SubtaskTree item={item} readOnly={trashed} />

      <TimeTracker item={item} readOnly={trashed} />

      <MarkdownEditor
        label="Task description"
        placeholder="Add a description. Markdown and #tags work here."
        value={item.body}
        onChange={(body) => updateItem(item.id, { body })}
        mode={descriptionMode}
        readOnly={trashed}
        className="min-h-48 flex-1"
        toolbarRight={
          <ModeSwitch
            mode={descriptionMode}
            onChange={setDescriptionMode}
            modes={["edit", "preview"]}
          />
        }
      />

      <p
        role="status"
        aria-live="polite"
        className="px-4 text-xs text-accent-700 empty:hidden dark:text-accent-300"
      >
        {notice}
      </p>
      {!trashed && (
        <div className="flex flex-wrap justify-end gap-1 border-t border-stone-200 px-3 py-2 dark:border-stone-800">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setStatus(item.id, item.status === "wontdo" ? "open" : "wontdo")}
          >
            <Ban size={15} aria-hidden /> {item.status === "wontdo" ? "Reopen" : "Won’t do"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const id = duplicateItem(item.id);
              if (id) selectItem(id);
            }}
          >
            <Copy size={15} aria-hidden /> Duplicate
          </button>
          <MakeSubtask item={item} />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (saveAsTemplate(item.id))
                setNotice("Saved as a template. Use it from the quick-add bar.");
            }}
          >
            <LayoutTemplate size={15} aria-hidden /> Save as template
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              trashItem(item.id);
              selectItem(null);
            }}
          >
            <Trash2 size={15} aria-hidden /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
