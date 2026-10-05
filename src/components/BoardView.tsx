"use client";

import { useMemo, useState } from "react";
import { ChevronRight, FileText, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { boardColumns, type BoardColumn } from "@/lib/board";
import { dueBucket, itemTags, subtaskProgress } from "@/lib/items-logic";
import type { Item, TaskList } from "@/lib/types";
import { displayTitle, formatDueRange, getSnippet } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { SelectCheckbox, useRowSelection } from "./BatchSelect";
import { TaskCheckbox } from "./TaskCheckbox";

function BoardCard({ item, today, selected }: { item: Item; today: string; selected: boolean }) {
  const selectItem = useUi((s) => s.selectItem);
  const { selecting, checked, handleClick } = useRowSelection(item.id);
  const isTask = item.kind === "task";
  const closed = isTask && item.status !== "open";
  const bucket = dueBucket(item, today);
  const progress = subtaskProgress(item);
  const tags = itemTags(item);

  return (
    <li
      data-item-id={item.id}
      className={clsx(
        "group relative flex gap-2.5 rounded-xl border px-3 py-2.5 shadow-soft transition-colors",
        selected || checked
          ? "border-accent-300 bg-accent-50 dark:border-accent-800 dark:bg-accent-950/50"
          : "border-stone-200 bg-white hover:border-stone-300 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700",
      )}
    >
      {selecting && <SelectCheckbox item={item} checked={checked} onClick={handleClick} />}
      <span className="mt-px">
        {isTask ? (
          <TaskCheckbox item={item} />
        ) : (
          <FileText size={18} aria-hidden className="text-stone-400" />
        )}
      </span>
      <button
        type="button"
        onClick={(e) => {
          if (!handleClick(e)) selectItem(item.id);
        }}
        aria-current={selected ? "true" : undefined}
        className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        <span
          className={clsx(
            "line-clamp-3 text-sm break-words",
            closed
              ? "text-stone-400 line-through dark:text-stone-500"
              : "text-stone-800 dark:text-stone-100",
          )}
        >
          {displayTitle(item)}
        </span>
        {!isTask && item.body && (
          <span className="mt-0.5 line-clamp-2 text-xs text-stone-500 dark:text-stone-400">
            {getSnippet(item.body)}
          </span>
        )}
        {((isTask && item.due) || progress.total > 0 || tags.length > 0) && (
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
            {isTask && item.due && (
              <span
                className={clsx(
                  "tabular-nums",
                  bucket === "overdue" && !closed
                    ? "font-medium text-red-600 dark:text-red-400"
                    : bucket === "today" && !closed
                      ? "font-medium text-accent-600 dark:text-accent-400"
                      : "",
                )}
              >
                {formatDueRange(item.due, item.dueTime, item.startDate, today)}
              </span>
            )}
            {progress.total > 0 && (
              <span className="inline-flex items-center gap-1">
                <ListChecks size={13} aria-hidden />
                <span className="sr-only">Subtasks </span>
                {progress.done}/{progress.total}
              </span>
            )}
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-stone-100 px-1.5 py-0.5 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
              >
                {tag}
              </span>
            ))}
          </span>
        )}
      </button>
    </li>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-md p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-accent-500 dark:hover:bg-stone-800 dark:hover:text-stone-200"
    >
      {children}
    </button>
  );
}

function Column({
  list,
  column,
  today,
  selectedItemId,
}: {
  list: TaskList;
  column: BoardColumn;
  today: string;
  selectedItemId: string | null;
}) {
  const renameSection = useWorkspace((s) => s.renameSection);
  const deleteSection = useWorkspace((s) => s.deleteSection);
  const toggleSectionCollapsed = useWorkspace((s) => s.toggleSectionCollapsed);
  const [showFinished, setShowFinished] = useState(false);
  const { section } = column;
  const name = section?.name ?? "No section";
  const collapsed = Boolean(section?.collapsed);
  const headingId = `board-column-${column.id || "none"}`;

  if (section && collapsed) {
    return (
      <section
        aria-labelledby={headingId}
        className="flex w-11 shrink-0 flex-col items-center gap-2 rounded-2xl bg-stone-100 py-2 dark:bg-stone-900/70"
      >
        <button
          type="button"
          aria-expanded={false}
          aria-label={`Expand section ${name}`}
          title={`Expand ${name}`}
          onClick={() => toggleSectionCollapsed(list.id, section.id)}
          className="rounded-md p-1 text-stone-500 hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-accent-500 dark:hover:bg-stone-800"
        >
          <ChevronRight size={15} aria-hidden />
        </button>
        <h2
          id={headingId}
          className="truncate text-[13px] font-semibold text-stone-700 [writing-mode:vertical-rl] dark:text-stone-200"
        >
          {name}
          <span className="ml-1.5 font-normal text-stone-400 dark:text-stone-500">
            {column.items.length}
          </span>
        </h2>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex max-h-full w-[17rem] min-w-64 shrink-0 flex-col rounded-2xl bg-stone-100 dark:bg-stone-900/70"
    >
      <div className="group/header flex items-center gap-1 px-2 pb-1 pt-2">
        {section && (
          <button
            type="button"
            aria-expanded
            aria-label={`Collapse section ${name}`}
            title={`Collapse ${name}`}
            onClick={() => toggleSectionCollapsed(list.id, section.id)}
            className="rounded-md p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-accent-500 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <ChevronRight size={15} aria-hidden className="rotate-90" />
          </button>
        )}
        <h2
          id={headingId}
          className={clsx(
            "flex min-w-0 flex-1 items-baseline gap-1.5 text-[13px] font-semibold text-stone-700 dark:text-stone-200",
            !section && "pl-1.5",
          )}
        >
          <span className="truncate">{name}</span>
          <span className="font-normal text-stone-400 dark:text-stone-500">
            {column.items.length}
          </span>
        </h2>
        {section && (
          <span className="flex opacity-100 transition-opacity focus-within:opacity-100 md:opacity-0 md:group-hover/header:opacity-100">
            <IconButton
              label={`Rename section ${name}`}
              onClick={() => {
                const next = window.prompt("Rename section", name);
                if (next) renameSection(list.id, section.id, next);
              }}
            >
              <Pencil size={14} aria-hidden />
            </IconButton>
            <IconButton
              label={`Delete section ${name}`}
              onClick={() => {
                if (window.confirm(`Delete the section “${name}”? Its items stay in the list.`)) {
                  deleteSection(list.id, section.id);
                }
              }}
            >
              <Trash2 size={14} aria-hidden />
            </IconButton>
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <ul className="flex min-h-10 flex-col gap-2 pt-1">
          {column.items.map((item) => (
            <BoardCard
              key={item.id}
              item={item}
              today={today}
              selected={item.id === selectedItemId}
            />
          ))}
        </ul>
        {column.finished.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              aria-expanded={showFinished}
              onClick={() => setShowFinished(!showFinished)}
              className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left text-xs font-medium text-stone-500 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-accent-500 dark:text-stone-400 dark:hover:text-stone-200"
            >
              <ChevronRight
                size={13}
                aria-hidden
                className={clsx("transition-transform", showFinished && "rotate-90")}
              />
              Completed {column.finished.length}
            </button>
            {showFinished && (
              <ul className="flex flex-col gap-2 pt-1" aria-label={`Completed in ${name}`}>
                {column.finished.map((item) => (
                  <BoardCard
                    key={item.id}
                    item={item}
                    today={today}
                    selected={item.id === selectedItemId}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * A list as a board: one column per section (plus "No section" when it is used), cards in manual order and finished
 * tasks folded away at the bottom of each column.
 */
export function BoardView({
  list,
  items,
  today,
  selectedItemId,
}: {
  list: TaskList;
  items: Item[];
  today: string;
  selectedItemId: string | null;
}) {
  const addSection = useWorkspace((s) => s.addSection);
  const columns = useMemo(() => boardColumns(items, list.sections), [items, list.sections]);

  return (
    <div className="flex h-full items-start gap-3 overflow-x-auto px-4 pb-4 pt-2 sm:px-6">
      {columns.map((column) => (
        <Column
          key={column.id || "none"}
          list={list}
          column={column}
          today={today}
          selectedItemId={selectedItemId}
        />
      ))}
      <button
        type="button"
        onClick={() => {
          const name = window.prompt("New section name");
          if (name) addSection(list.id, name);
        }}
        className="flex w-[17rem] min-w-64 shrink-0 items-center gap-2 rounded-2xl border border-dashed border-stone-300 px-3 py-2.5 text-sm text-stone-500 hover:border-accent-400 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-accent-500 dark:border-stone-700 dark:text-stone-400 dark:hover:border-accent-600 dark:hover:text-accent-300"
      >
        <Plus size={15} aria-hidden /> Add section
      </button>
    </div>
  );
}
