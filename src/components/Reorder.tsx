"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import clsx from "clsx";

/** Where a dragged row would land: before the row at `index` of `group` (index = group length: at the end). */
export type DropTarget = { group: string; index: number };

type Drag = { id: string; group: string };

/**
 * Native HTML5 drag and drop for reorderable rows, plus Alt+ArrowUp/Down for the keyboard. Rows belong to groups
 * (sections, folders); `canDrop` decides whether a row may leave its group. Pure ordering lives in lib/ordering.
 */
export function useReorder({
  canDrop,
  onDrop,
}: {
  canDrop: (from: string, to: string) => boolean;
  onDrop: (id: string, from: string, target: DropTarget) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const end = () => {
    setDrag(null);
    setTarget(null);
  };

  const accept = (event: React.DragEvent, group: string) => {
    if (!drag || !canDrop(drag.group, group)) return false;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    return true;
  };

  const show = (next: DropTarget) => {
    if (target?.group !== next.group || target.index !== next.index) setTarget(next);
  };

  const drop = (event: React.DragEvent, next: DropTarget) => {
    if (!drag || !canDrop(drag.group, next.group)) return;
    event.preventDefault();
    event.stopPropagation();
    onDrop(drag.id, drag.group, next);
    end();
  };

  /** Above or below the row under the pointer. */
  const pointTarget = (event: React.DragEvent<HTMLElement>, group: string, index: number) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { group, index: event.clientY > rect.top + rect.height / 2 ? index + 1 : index };
  };

  return {
    dragging: drag?.id ?? null,
    announcement,

    /** Is a drop line due before the row at `index` of `group`? */
    isTarget: (group: string, index: number) =>
      target !== null && target.group === group && target.index === index,

    /** Props for a row's drag handle; the whole row is shown as the drag image. */
    handleProps: (id: string, group: string) => ({
      draggable: true,
      onDragStart: (event: React.DragEvent<HTMLElement>) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
        const row = event.currentTarget.closest<HTMLElement>("[data-reorder-row]");
        if (row) event.dataTransfer.setDragImage(row, 16, row.offsetHeight / 2);
        setDrag({ id, group });
      },
      onDragEnd: end,
    }),

    /** Props for a row: dragging over it drops above or below it, and Alt+Arrow keys move it one place. */
    rowProps: (group: string, index: number, onStep?: (delta: -1 | 1) => string | null) => ({
      "data-reorder-row": "",
      onDragOver: (event: React.DragEvent<HTMLElement>) => {
        if (accept(event, group)) show(pointTarget(event, group, index));
      },
      onDrop: (event: React.DragEvent<HTMLElement>) =>
        drop(event, pointTarget(event, group, index)),
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (!onStep || !event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
          return;
        }
        event.preventDefault();
        const focused = document.activeElement as HTMLElement | null;
        const message = onStep(event.key === "ArrowUp" ? -1 : 1);
        if (message) setAnnouncement(message);
        // Moving a row re-inserts its DOM node, which can drop focus; put it back.
        requestAnimationFrame(() => {
          if (focused?.isConnected && document.activeElement !== focused) focused.focus();
        });
      },
    }),

    /** Props for a group header or empty area: dropping there puts the row at `index` of `group`. */
    zoneProps: (group: string, index: number) => ({
      onDragOver: (event: React.DragEvent<HTMLElement>) => {
        if (accept(event, group)) show({ group, index });
      },
      onDrop: (event: React.DragEvent<HTMLElement>) => drop(event, { group, index }),
    }),
  };
}

/** The grip shown at the left edge of a reorderable row on hover. */
export function DragHandle({
  label,
  ...props
}: { label: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      aria-hidden
      title={label}
      className="absolute left-0 top-1/2 flex -translate-y-1/2 cursor-grab touch-none text-stone-500 opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100 dark:text-stone-400"
    >
      <GripVertical size={12} />
    </span>
  );
}

/** A thin accent line marking where a dragged row will land. */
export function DropLine({ at }: { at: "top" | "bottom" }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "pointer-events-none absolute inset-x-2 z-10 h-0.5 rounded-full bg-accent-500",
        at === "top" ? "-top-px" : "-bottom-px",
      )}
    />
  );
}
