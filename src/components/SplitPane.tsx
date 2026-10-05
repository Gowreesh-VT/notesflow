"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { getDragItem, isItemDrag, setDragItem } from "@/lib/dnd";
import { useToday } from "@/lib/hooks";
import { dueBucket } from "@/lib/items-logic";
import { dropOnListPatch, pinnedTasks, SPLIT_DRAG_TYPE } from "@/lib/split";
import { displayTitle, formatDueRange } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { TaskCheckbox } from "./TaskCheckbox";

/**
 * A list pinned beside the main view (split view): its open tasks in a compact column. Tasks dragged here from the
 * main view move into this list; tasks dragged from here onto the main view move into the list shown there.
 */
export function SplitPane({ listId, name }: { listId: string; name: string }) {
  const items = useWorkspace((s) => s.items);
  const updateItem = useWorkspace((s) => s.updateItem);
  const selectedItemId = useUi((s) => s.selectedItemId);
  const selectItem = useUi((s) => s.selectItem);
  const setSplitListId = useUi((s) => s.setSplitListId);
  const today = useToday();
  const tasks = useMemo(() => pinnedTasks(items, listId, today), [items, listId, today]);
  const [over, setOver] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Drags that started in this pane carry SPLIT_DRAG_TYPE and are not dropped back onto it.
  const accepts = (event: React.DragEvent) =>
    isItemDrag(event) && !event.dataTransfer.types.includes(SPLIT_DRAG_TYPE);

  return (
    <aside
      aria-label={`${name}, pinned beside`}
      onDragOver={(event) => {
        if (!accepts(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(event) => {
        if (!accepts(event)) return;
        event.preventDefault();
        setOver(false);
        const id = getDragItem(event);
        const item = useWorkspace.getState().items.find((i) => i.id === id);
        const patch = dropOnListPatch(item, listId);
        if (item && patch) {
          updateItem(item.id, patch);
          setAnnouncement(`Moved “${displayTitle(item)}” to ${name}.`);
        }
      }}
      className={clsx(
        "flex h-full w-80 shrink-0 flex-col border-l border-stone-200 transition-colors dark:border-stone-800",
        over
          ? "bg-accent-50 ring-2 ring-inset ring-accent-500 dark:bg-accent-950/40"
          : "bg-stone-50 dark:bg-stone-950",
      )}
    >
      <header className="flex items-center gap-2 px-4 pb-2 pt-5">
        <h2 className="heading-display min-w-0 truncate text-lg font-semibold">{name}</h2>
        {tasks.length > 0 && (
          <span className="mt-0.5 text-sm tabular-nums text-stone-400 dark:text-stone-500">
            {tasks.length}
          </span>
        )}
        <button
          type="button"
          aria-label={`Close ${name} beside this view`}
          title="Close split view"
          onClick={() => setSplitListId(null)}
          className="btn btn-ghost ml-auto px-2"
        >
          <X size={16} aria-hidden />
        </button>
      </header>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        {tasks.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-stone-500 dark:text-stone-400">
            No open tasks. Drag tasks here to move them to {name}.
          </p>
        ) : (
          <ul>
            {tasks.map((item) => {
              const bucket = dueBucket(item, today);
              const selected = item.id === selectedItemId;
              return (
                <li
                  key={item.id}
                  draggable
                  onDragStart={(event) => {
                    setDragItem(event, item.id);
                    event.dataTransfer.setData(SPLIT_DRAG_TYPE, listId);
                  }}
                  className={clsx(
                    "flex min-h-10 cursor-grab items-center gap-2.5 rounded-lg px-2.5 py-1 active:cursor-grabbing compact:min-h-8 compact:py-0.5",
                    selected
                      ? "bg-accent-50 dark:bg-accent-950/50"
                      : "hover:bg-stone-100 dark:hover:bg-stone-800/60",
                  )}
                >
                  <TaskCheckbox item={item} />
                  <button
                    type="button"
                    onClick={() => selectItem(item.id)}
                    aria-current={selected ? "true" : undefined}
                    className="flex min-w-0 flex-1 cursor-[inherit] items-center gap-2 self-stretch text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
                  >
                    <span className="min-w-0 flex-1 truncate text-stone-800 dark:text-stone-100">
                      {displayTitle(item)}
                    </span>
                    {item.due && (
                      <span
                        className={clsx(
                          "shrink-0 text-xs tabular-nums",
                          bucket === "overdue"
                            ? "font-medium text-red-600 dark:text-red-400"
                            : bucket === "today"
                              ? "font-medium text-accent-600 dark:text-accent-400"
                              : "text-stone-400 dark:text-stone-500",
                        )}
                      >
                        {formatDueRange(item.due, item.dueTime, item.startDate, today)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
