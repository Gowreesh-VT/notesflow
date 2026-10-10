"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Flag,
  LayoutTemplate,
  ListTodo,
  MoreHorizontal,
  RotateCcw,
  Rows3,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import { dueBucket, itemTags } from "@/lib/items-logic";
import { useToday } from "@/lib/hooks";
import type { Item, Priority } from "@/lib/types";
import { addDays, formatDueLabel, formatDueRange } from "@/lib/utils";
import { useUi, type EditorMode } from "@/store/ui";
import { toggleDoneWithUndo, trashWithUndo } from "@/store/undo";
import { useWorkspace } from "@/store/workspace";
import { askConfirm } from "@/store/dialog";
import { CopyToList } from "./CopyToList";
import { ListSelect } from "./ListSelect";
import { MarkdownEditor, ModeSwitch } from "./MarkdownEditor";
import { EnergyField } from "./EnergyField";
import { EstimateField } from "./EstimateField";
import { MakeSubtask } from "./MakeSubtask";
import { OutcomeField } from "./Outcome";
import { Popover } from "./Popover";
import { RemindersField } from "./RemindersField";
import { RepeatField } from "./RepeatField";
import { SubtaskTree } from "./SubtaskTree";
import { TimeTracker } from "./TimeTracker";
import { TitleField } from "./TitleField";

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

const PRIORITY_FLAG: Record<Priority, string> = {
  none: "text-stone-400 dark:text-stone-500",
  low: "fill-sky-500 text-sky-500",
  medium: "fill-amber-500 text-amber-500",
  high: "fill-red-500 text-red-500",
};

const PRIORITY_BOX: Record<Priority, string> = {
  none: "border-stone-400",
  low: "border-sky-500",
  medium: "border-amber-500",
  high: "border-red-500",
};

/** A property chip in the task header: compact, quiet, and a button or select underneath. */
const CHIP =
  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors hover:bg-stone-100 focus-within:outline-2 focus-within:outline-accent-500 focus-visible:outline-2 focus-visible:outline-accent-500 disabled:opacity-60 dark:hover:bg-stone-800";
const CHIP_TEXT = "text-stone-700 dark:text-stone-200";
const CHIP_MUTED = "text-stone-500 dark:text-stone-400";

export function TaskDetail({ item }: { item: Item }) {
  const today = useToday();
  const [descriptionMode, setDescriptionMode] = useState<EditorMode>("edit");
  const selectItem = useUi((s) => s.selectItem);
  const promptOutcome = useUi((s) => s.promptOutcome);
  const [notice, setNotice] = useState("");
  const { updateItem, setStatus, restoreItem, deleteForever, duplicateItem, saveAsTemplate } =
    useWorkspace.getState();

  const sections = useWorkspace((s) => s.lists.find((l) => l.id === item.listId)?.sections) ?? [];
  const trashed = item.deletedAt !== null;
  const tags = itemTags(item);
  const bucket = dueBucket(item, today);
  const quickDates = [
    { label: "Today", value: today },
    { label: "Tomorrow", value: addDays(today, 1) },
    { label: "Next week", value: addDays(today, 7) },
  ];

  return (
    <div className="@container flex h-full flex-col">
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
              onClick={async () => {
                const ok = await askConfirm({
                  title: `Permanently delete “${item.title}”?`,
                  confirmLabel: "Delete forever",
                  danger: true,
                });
                if (!ok) return;
                selectItem(null);
                deleteForever(item.id);
              }}
            >
              Delete forever
            </button>
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-start gap-2 px-4 pb-1 pt-4">
          <button
            type="button"
            className="btn btn-ghost -ml-1 mt-0.5 px-2"
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
              const finishedId = toggleDoneWithUndo(item.id);
              if (finishedId) promptOutcome(finishedId);
            }}
            className={clsx(
              "mt-2 flex size-[22px] shrink-0 items-center justify-center rounded-md border-2 transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
              item.status === "done"
                ? "border-accent-600 bg-accent-600 text-white"
                : item.status === "wontdo"
                  ? "border-stone-400 bg-stone-300 text-white dark:bg-stone-600"
                  : clsx(PRIORITY_BOX[item.priority], "hover:border-accent-500"),
            )}
          >
            {item.status === "done" && <Check size={14} strokeWidth={3} aria-hidden />}
            {item.status === "wontdo" && <Ban size={13} strokeWidth={3} aria-hidden />}
          </button>
          <TitleField
            value={item.title}
            label="Task title"
            placeholder="Task title"
            fallback="Untitled task"
            readOnly={trashed}
            closed={item.status !== "open"}
            onChange={(title) => updateItem(item.id, { title })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 pl-[4.75rem] max-md:pl-4">
          <Popover
            label="Due date"
            disabled={trashed}
            triggerClassName={clsx(
              CHIP,
              bucket === "overdue" && item.status === "open"
                ? "text-red-700 dark:text-red-400"
                : bucket === "today" && item.status === "open"
                  ? "text-accent-700 dark:text-accent-300"
                  : item.due
                    ? CHIP_TEXT
                    : CHIP_MUTED,
            )}
            trigger={
              <>
                <CalendarDays size={14} aria-hidden />
                {item.due
                  ? formatDueRange(item.due, item.dueTime, item.startDate, today)
                  : "Add date"}
              </>
            }
            panelClassName="w-72 space-y-3"
          >
            <div className="flex flex-wrap gap-1">
              {quickDates.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => updateItem(item.id, { due: d.value })}
                  className={clsx(
                    "btn flex-1 justify-center px-2 py-1 text-xs",
                    item.due === d.value
                      ? "bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
                      : "btn-ghost bg-stone-100 dark:bg-stone-800",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <label className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
              <span className="text-stone-500 dark:text-stone-400">Due</span>
              <input
                type="date"
                aria-label="Due date"
                value={item.due ?? ""}
                onChange={(e) => updateItem(item.id, { due: e.target.value || null })}
                className="field py-1"
              />
            </label>
            {item.due && (
              <>
                <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
                  <label
                    htmlFor={`due-time-${item.id}`}
                    className="text-stone-500 dark:text-stone-400"
                  >
                    Time
                  </label>
                  <span className="flex items-center gap-1.5">
                    <input
                      id={`due-time-${item.id}`}
                      type="time"
                      aria-label="Due time"
                      value={item.dueTime ?? ""}
                      onChange={(e) => updateItem(item.id, { dueTime: e.target.value || null })}
                      className="field min-w-0 flex-1 py-1"
                    />
                    {item.dueTime ? (
                      <button
                        type="button"
                        className="btn btn-ghost shrink-0 px-2 py-1 text-xs"
                        onClick={() => updateItem(item.id, { dueTime: null })}
                      >
                        All day
                      </button>
                    ) : null}
                  </span>
                </div>
                <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
                  <label
                    htmlFor={`start-date-${item.id}`}
                    className="text-stone-500 dark:text-stone-400"
                  >
                    Starts
                  </label>
                  <span className="flex items-center gap-1.5">
                    <input
                      id={`start-date-${item.id}`}
                      type="date"
                      aria-label="Start date"
                      value={item.startDate ?? ""}
                      max={item.due}
                      onChange={(e) => updateItem(item.id, { startDate: e.target.value || null })}
                      className="field min-w-0 flex-1 py-1"
                    />
                    {item.startDate ? (
                      <button
                        type="button"
                        className="btn btn-ghost shrink-0 px-2 py-1 text-xs"
                        onClick={() => updateItem(item.id, { startDate: null })}
                      >
                        Same day
                      </button>
                    ) : null}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost w-full justify-center py-1 text-xs"
                  onClick={() => updateItem(item.id, { due: null })}
                >
                  <X size={12} aria-hidden /> Clear date
                  <span className="sr-only"> ({formatDueLabel(item.due, today)})</span>
                </button>
              </>
            )}
          </Popover>

          <Popover
            label="Priority"
            disabled={trashed}
            triggerClassName={clsx(CHIP, item.priority === "none" ? CHIP_MUTED : CHIP_TEXT)}
            trigger={
              <>
                <Flag size={14} aria-hidden className={PRIORITY_FLAG[item.priority]} />
                {item.priority === "none"
                  ? "Priority"
                  : PRIORITIES.find((p) => p.value === item.priority)?.label}
              </>
            }
            panelClassName="w-44 p-1"
          >
            {(close) => (
              <div role="radiogroup" aria-label="Priority">
                {[...PRIORITIES].reverse().map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={item.priority === p.value}
                    onClick={() => {
                      updateItem(item.id, { priority: p.value });
                      close();
                    }}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm",
                      item.priority === p.value
                        ? "bg-stone-100 font-medium dark:bg-stone-800"
                        : "hover:bg-stone-100 dark:hover:bg-stone-800",
                    )}
                  >
                    <Flag size={14} aria-hidden className={PRIORITY_FLAG[p.value]} />
                    <span className="flex-1">{p.label}</span>
                    {item.priority === p.value && <Check size={14} aria-hidden />}
                  </button>
                ))}
              </div>
            )}
          </Popover>

          <label className={clsx(CHIP, CHIP_TEXT, "relative pr-1.5")}>
            <ListTodo size={14} aria-hidden className="shrink-0" />
            <ListSelect
              value={item.listId}
              onChange={(listId) => updateItem(item.id, { listId })}
              className="max-w-40 cursor-pointer appearance-none truncate bg-transparent outline-none"
            />
            <ChevronDown size={13} aria-hidden className="shrink-0 text-stone-500" />
          </label>

          {sections.length > 0 && (
            <label className={clsx(CHIP, CHIP_TEXT, "relative pr-1.5")}>
              <Rows3 size={14} aria-hidden className="shrink-0" />
              <select
                aria-label="Section"
                value={sections.some((s) => s.id === item.sectionId) ? item.sectionId! : ""}
                onChange={(e) => updateItem(item.id, { sectionId: e.target.value || null })}
                className="max-w-36 cursor-pointer appearance-none truncate bg-transparent outline-none"
              >
                <option value="">No section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} aria-hidden className="shrink-0 text-stone-500" />
            </label>
          )}

          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300"
            >
              #{tag}
            </span>
          ))}
        </div>

        <MarkdownEditor
          label="Task description"
          placeholder="Add a description. Markdown and #tags work here."
          value={item.body}
          onChange={(body) => updateItem(item.id, { body })}
          mode={descriptionMode}
          readOnly={trashed}
          className="min-h-36"
          toolbarRight={
            <ModeSwitch
              mode={descriptionMode}
              onChange={setDescriptionMode}
              modes={["edit", "preview"]}
            />
          }
        />

        <div className="border-t border-stone-200 pt-3 dark:border-stone-800">
          <SubtaskTree item={item} readOnly={trashed} />
        </div>

        <dl className="grid grid-cols-[6rem_1fr] items-center gap-x-3 gap-y-3 border-t border-stone-200 px-4 py-4 text-sm dark:border-stone-800">
          {item.status === "done" && (
            <>
              <dt className="self-start pt-1 text-stone-500 dark:text-stone-400">Outcome</dt>
              <dd>
                <OutcomeField item={item} />
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

          <dt className="self-start pt-1.5 text-stone-500 dark:text-stone-400">Repeat</dt>
          <dd>
            <RepeatField
              value={item.repeat}
              due={item.due}
              disabled={trashed}
              onChange={(repeat) => updateItem(item.id, { repeat })}
            />
          </dd>

          <dt className="self-start pt-1.5 text-stone-500 dark:text-stone-400">Estimate</dt>
          <dd>
            <EstimateField
              label="Estimated time"
              value={item.estimate}
              disabled={trashed}
              onChange={(estimate) => updateItem(item.id, { estimate })}
            />
          </dd>

          <dt className="self-start pt-1 text-stone-500 dark:text-stone-400">Energy</dt>
          <dd>
            <EnergyField
              value={item.energy}
              disabled={trashed}
              onChange={(energy) => updateItem(item.id, { energy })}
            />
          </dd>
        </dl>

        <div className="border-t border-stone-200 pt-3 dark:border-stone-800">
          <TimeTracker item={item} readOnly={trashed} />
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        className="px-4 text-xs text-accent-700 empty:hidden dark:text-accent-300"
      >
        {notice}
      </p>
      {!trashed && (
        <div className="flex items-center gap-1 border-t border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-stone-950">
          <button
            type="button"
            className="btn btn-ghost"
            aria-label={item.status === "wontdo" ? "Reopen" : "Won’t do"}
            title={item.status === "wontdo" ? "Reopen" : "Won’t do"}
            onClick={() => setStatus(item.id, item.status === "wontdo" ? "open" : "wontdo")}
          >
            <Ban size={15} aria-hidden />
            <span className="hidden @md:inline">
              {item.status === "wontdo" ? "Reopen" : "Won’t do"}
            </span>
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            aria-label="Duplicate"
            title="Duplicate"
            onClick={() => {
              const id = duplicateItem(item.id);
              if (id) selectItem(id);
            }}
          >
            <Copy size={15} aria-hidden />
            <span className="hidden @md:inline">Duplicate</span>
          </button>
          <Popover
            label="More actions"
            iconOnly
            triggerClassName="btn btn-ghost"
            trigger={<MoreHorizontal size={16} aria-hidden />}
            side="above"
            panelClassName="flex w-64 flex-col gap-1 p-1.5 [&>button]:justify-start"
          >
            {(close) => (
              <>
                <CopyToList
                  item={item}
                  onCopied={(listName) => {
                    close();
                    setNotice(`Copied to ${listName}.`);
                  }}
                />
                <MakeSubtask item={item} />
                <button
                  type="button"
                  className="btn btn-ghost w-full justify-start"
                  onClick={() => {
                    close();
                    if (saveAsTemplate(item.id))
                      setNotice("Saved as a template. Use it from the quick-add bar.");
                  }}
                >
                  <LayoutTemplate size={15} aria-hidden /> Save as template
                </button>
              </>
            )}
          </Popover>
          <button
            type="button"
            className="btn btn-danger ml-auto"
            aria-label="Delete"
            title="Delete"
            onClick={() => {
              trashWithUndo(item.id);
              selectItem(null);
            }}
          >
            <Trash2 size={15} aria-hidden />
            <span className="hidden @md:inline">Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
