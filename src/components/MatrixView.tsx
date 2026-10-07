"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { archivedListIds, dueBucket } from "@/lib/items-logic";
import { getDragItem, isItemDrag, setDragItem } from "@/lib/dnd";
import { useToday } from "@/lib/hooks";
import {
  matrixTasks,
  neighbourQuadrant,
  patchForQuadrant,
  quadrantInfo,
  QUADRANTS,
  URGENT_WITHIN_DAYS,
  type MatrixDirection,
  type Quadrant,
  type QuadrantInfo,
} from "@/lib/matrix";
import { INBOX_ID, type Item } from "@/lib/types";
import { displayTitle, formatDueRange } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { TaskCheckbox } from "./TaskCheckbox";
import { ViewHeader } from "./ViewHeader";

const QUADRANT_DOT: Record<Quadrant, string> = {
  do: "bg-red-500",
  schedule: "bg-accent-500",
  delegate: "bg-amber-500",
  later: "bg-stone-400 dark:bg-stone-500",
};

const ARROW_DIRECTIONS: Record<string, MatrixDirection> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

function MatrixRow({
  item,
  today,
  listName,
  selected,
  onMove,
}: {
  item: Item;
  today: string;
  listName: string | null;
  selected: boolean;
  onMove: (direction: MatrixDirection) => void;
}) {
  const selectItem = useUi((s) => s.selectItem);
  const [dragging, setDragging] = useState(false);
  const bucket = dueBucket(item, today);
  const title = displayTitle(item);

  return (
    <li
      draggable
      onDragStart={(e) => {
        setDragItem(e, item.id);
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={clsx(
        "flex min-h-10 cursor-grab items-center gap-2.5 rounded-lg px-2 py-1 transition-colors active:cursor-grabbing compact:min-h-8 compact:py-0.5",
        selected
          ? "bg-accent-50 dark:bg-accent-950/50"
          : "hover:bg-stone-100 dark:hover:bg-stone-800/60",
        dragging && "opacity-50",
      )}
    >
      <TaskCheckbox item={item} />
      <button
        type="button"
        data-matrix-item={item.id}
        aria-current={selected ? "true" : undefined}
        aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
        onClick={() => selectItem(item.id)}
        onKeyDown={(e) => {
          const direction = ARROW_DIRECTIONS[e.key];
          if (!e.altKey || !direction) return;
          e.preventDefault();
          onMove(direction);
        }}
        className="flex min-w-0 flex-1 items-center gap-2 self-stretch text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-stone-800 dark:text-stone-100">
          {title}
        </span>
        {listName && (
          <span className="hidden max-w-24 truncate text-xs text-stone-500 lg:inline dark:text-stone-400">
            {listName}
          </span>
        )}
        {item.due && (
          <span
            className={clsx(
              "shrink-0 text-xs tabular-nums",
              bucket === "overdue"
                ? "font-medium text-red-600 dark:text-red-400"
                : bucket === "today"
                  ? "font-medium text-accent-600 dark:text-accent-400"
                  : "text-stone-500 dark:text-stone-400",
            )}
          >
            {formatDueRange(item.due, item.dueTime, item.startDate, today)}
          </span>
        )}
      </button>
    </li>
  );
}

function QuadrantPanel({
  quadrant,
  items,
  today,
  listNames,
  selectedItemId,
  dropActive,
  onDragState,
  onDropItem,
  onMove,
}: {
  quadrant: QuadrantInfo;
  items: Item[];
  today: string;
  listNames: Map<string, string>;
  selectedItemId: string | null;
  dropActive: boolean;
  onDragState: (active: boolean) => void;
  onDropItem: (id: string) => void;
  onMove: (item: Item, direction: MatrixDirection) => void;
}) {
  const headingId = `matrix-${quadrant.id}`;
  return (
    <section
      aria-labelledby={headingId}
      onDragOver={(e) => {
        if (!isItemDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!dropActive) onDragState(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onDragState(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDragState(false);
        const id = getDragItem(e);
        if (id) onDropItem(id);
      }}
      className={clsx(
        "flex min-h-36 flex-col rounded-2xl border bg-white shadow-soft transition-colors md:min-h-0 dark:bg-stone-900",
        dropActive
          ? "border-accent-400 bg-accent-50 dark:border-accent-600 dark:bg-accent-950/40"
          : "border-stone-200 dark:border-stone-800",
      )}
    >
      <header className="flex items-start gap-2 px-4 pb-2 pt-3">
        <span
          className={clsx("mt-1.5 size-2 shrink-0 rounded-full", QUADRANT_DOT[quadrant.id])}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-sm font-semibold text-stone-800 dark:text-stone-100">
            {quadrant.name}
            <span className="ml-2 font-normal text-stone-500 dark:text-stone-400">
              {items.length}
              <span className="sr-only"> {items.length === 1 ? "task" : "tasks"}</span>
            </span>
          </h2>
          <p title={quadrant.dropHint} className="text-xs text-stone-500 dark:text-stone-400">
            {dropActive ? quadrant.dropHint : quadrant.hint}
          </p>
        </div>
      </header>
      {items.length === 0 ? (
        <p className="px-4 pb-4 text-xs text-stone-500 dark:text-stone-400">
          No tasks. Drag one here.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {items.map((item) => (
            <MatrixRow
              key={item.id}
              item={item}
              today={today}
              listName={listNames.get(item.listId) ?? null}
              selected={item.id === selectedItemId}
              onMove={(direction) => onMove(item, direction)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Eisenhower matrix: open tasks sorted by importance (priority) and urgency (due date) into four quadrants.
 * Dragging a task to another quadrant, or Alt+arrow keys on it, changes its priority and due date to fit.
 */
export function MatrixView() {
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const updateItem = useWorkspace((s) => s.updateItem);
  const selectedItemId = useUi((s) => s.selectedItemId);
  const today = useToday();
  const [dropTarget, setDropTarget] = useState<Quadrant | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const groups = useMemo(
    () => matrixTasks(items, archivedListIds(lists), today),
    [items, lists, today],
  );
  const listNames = useMemo(
    () => new Map(lists.filter((l) => l.id !== INBOX_ID).map((l) => [l.id, l.name])),
    [lists],
  );

  const moveTo = (id: string, target: Quadrant, refocus = false) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const patch = patchForQuadrant(item, target, today);
    if (Object.keys(patch).length === 0) return;
    updateItem(id, patch);
    setAnnouncement(`Moved “${displayTitle(item)}” to ${quadrantInfo(target).name}.`);
    if (refocus) {
      // The row re-renders inside another quadrant; keep the keyboard focus on it.
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-matrix-item="${CSS.escape(id)}"]`)?.focus(),
      );
    }
  };

  const urgentLabel =
    URGENT_WITHIN_DAYS === 2 ? "due today or tomorrow" : `due within ${URGENT_WITHIN_DAYS} days`;

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Matrix" />
      <p className="sr-only">
        Important means high or medium priority; urgent means overdue or {urgentLabel}. Drag a task
        to another quadrant, or press Alt and an arrow key on it, to change its priority and due
        date to fit.
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-1 sm:px-4 md:overflow-hidden">
        <div className="grid gap-3 md:h-full md:grid-cols-2 md:grid-rows-2">
          {QUADRANTS.map((quadrant) => (
            <QuadrantPanel
              key={quadrant.id}
              quadrant={quadrant}
              items={groups[quadrant.id]}
              today={today}
              listNames={listNames}
              selectedItemId={selectedItemId}
              dropActive={dropTarget === quadrant.id}
              onDragState={(active) =>
                setDropTarget((current) =>
                  active ? quadrant.id : current === quadrant.id ? null : current,
                )
              }
              onDropItem={(id) => moveTo(id, quadrant.id)}
              onMove={(item, direction) => {
                const target = neighbourQuadrant(quadrant.id, direction);
                if (target) moveTo(item.id, target, true);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
