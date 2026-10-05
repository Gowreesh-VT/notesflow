"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { getDragItem, isItemDrag, setDragItem } from "@/lib/dnd";
import { formatDuration } from "@/lib/duration";
import { ENERGY_OPTIONS } from "@/lib/items-logic";
import {
  DAY_MINUTES,
  minutesToClock,
  minutesToOffset,
  offsetToMinutes,
  resizeLength,
  shiftStart,
  SLOT_MINUTES,
  slotStarts,
  SNAP_MINUTES,
  type PlanBlock,
  type PlanWindow,
} from "@/lib/plan";
import type { Item } from "@/lib/types";
import { displayTitle, formatClock } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { TaskCheckbox } from "./TaskCheckbox";

/** Height of one minute on the grid: a half-hour slot is 48px, a quarter hour 24px. */
const PX_PER_MINUTE = 1.6;

/** Clock label for minutes since midnight, with the end of the day shown as "midnight". */
export const clockLabel = (minutes: number): string =>
  minutes >= DAY_MINUTES ? "midnight" : formatClock(minutesToClock(minutes));

/** The task being dragged in this view: where it was grabbed (px from its top) and how long it is. */
export type PlanDrag = { id: string; grab: number; length: number };

type GridProps = {
  blocks: PlanBlock[];
  win: PlanWindow;
  dayLabel: string;
  isToday: boolean;
  /** The current time in minutes since midnight. */
  now: number;
  drag: PlanDrag | null;
  onDragStart: (item: Item, grab: number) => void;
  onDragEnd: () => void;
  onSchedule: (id: string, minutes: number) => void;
  onUnschedule: (id: string) => void;
  onResize: (id: string, minutes: number) => void;
  className?: string;
};

function Block({
  block,
  win,
  drag,
  hintId,
  onDragStart,
  onDragEnd,
  onSchedule,
  onUnschedule,
  onResize,
}: { block: PlanBlock; hintId: string } & Pick<
  GridProps,
  "win" | "drag" | "onDragStart" | "onDragEnd" | "onSchedule" | "onUnschedule" | "onResize"
>) {
  const { item, start, column, columns } = block;
  const selectItem = useUi((s) => s.selectItem);
  const selected = useUi((s) => s.selectedItemId === item.id);
  // Length while the bottom edge is being dragged, and where that drag started.
  const [preview, setPreview] = useState<number | null>(null);
  const resizeFrom = useRef<{ y: number; length: number } | null>(null);

  const length = preview ?? block.end - start;
  const end = start + length;
  const title = displayTitle(item);
  const done = item.status !== "open";
  const short = length * PX_PER_MINUTE < 40;
  const energy = ENERGY_OPTIONS.find((o) => o.value === item.energy)?.label;
  const range = `${clockLabel(start)} – ${clockLabel(end)}`;
  const description = [
    title,
    `${clockLabel(start)} to ${clockLabel(end)}`,
    formatDuration(length),
    item.priority !== "none" ? `${item.priority} priority` : "",
    energy ?? "",
    done ? "done" : "",
  ]
    .filter(Boolean)
    .join(", ");

  const endResize = (commit: boolean) => {
    const from = resizeFrom.current;
    resizeFrom.current = null;
    if (commit && from && preview !== null && preview !== from.length) onResize(item.id, preview);
    setPreview(null);
  };

  return (
    <li
      data-block-id={item.id}
      className={clsx(
        "absolute px-0.5",
        drag ? "pointer-events-none" : "pointer-events-auto",
        drag?.id === item.id && "opacity-50",
      )}
      style={{
        top: minutesToOffset(start, PX_PER_MINUTE, win),
        height: Math.max(length, SNAP_MINUTES) * PX_PER_MINUTE - 1,
        left: `${(column / columns) * 100}%`,
        width: `${100 / columns}%`,
      }}
    >
      <div
        draggable
        onDragStart={(e) => {
          setDragItem(e, item.id);
          onDragStart(item, e.clientY - e.currentTarget.getBoundingClientRect().top);
        }}
        onDragEnd={onDragEnd}
        className={clsx(
          "group flex h-full cursor-grab gap-1.5 overflow-hidden rounded-lg border px-1.5 text-xs shadow-sm active:cursor-grabbing",
          short ? "items-center" : "items-start pt-1",
          done
            ? "border-stone-200 bg-stone-100 text-stone-500 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400"
            : "border-accent-200 bg-accent-50 text-accent-900 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100",
          selected && "ring-2 ring-accent-500",
        )}
      >
        <span className={clsx("flex", !short && "pt-0.5")}>
          <TaskCheckbox item={item} small />
        </span>
        <button
          type="button"
          data-block-main
          onClick={() => selectItem(item.id)}
          onKeyDown={(e) => {
            if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
            e.preventDefault();
            const delta = e.key === "ArrowUp" ? -SNAP_MINUTES : SNAP_MINUTES;
            if (e.shiftKey) {
              const next = resizeLength(length, delta * PX_PER_MINUTE, PX_PER_MINUTE, start);
              if (next !== length) onResize(item.id, next);
            } else {
              const next = shiftStart(start, delta);
              if (next !== start) onSchedule(item.id, next);
            }
          }}
          aria-label={description}
          aria-describedby={hintId}
          aria-current={selected ? "true" : undefined}
          className="min-w-0 flex-1 self-stretch text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-500"
        >
          <span className={clsx("block truncate font-medium", done && "line-through")}>
            {title}
          </span>
          {!short && <span className="block truncate tabular-nums opacity-80">{range}</span>}
        </button>
        <button
          type="button"
          aria-label={`Unschedule “${title}”`}
          title="Back to To plan"
          onClick={() => onUnschedule(item.id)}
          className="shrink-0 rounded p-0.5 opacity-70 hover:bg-accent-100 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent-500 md:opacity-0 md:group-hover:opacity-70 dark:hover:bg-accent-900"
        >
          <X size={12} aria-hidden />
        </button>
      </div>
      <div
        aria-hidden
        title="Drag to change the length"
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          resizeFrom.current = { y: e.clientY, length: block.end - start };
          setPreview(block.end - start);
        }}
        onPointerMove={(e) => {
          const from = resizeFrom.current;
          if (!from) return;
          const next = resizeLength(from.length, e.clientY - from.y, PX_PER_MINUTE, start);
          if (next !== preview) setPreview(next);
        }}
        onPointerUp={() => endResize(true)}
        onPointerCancel={() => endResize(false)}
        className="absolute inset-x-3 -bottom-0.5 h-2.5 cursor-ns-resize touch-none rounded-full hover:bg-accent-300/60 dark:hover:bg-accent-700/60"
      />
    </li>
  );
}

/** The day's time grid: half-hour slots to drop tasks on, scheduled blocks, and the current time. */
export function PlanGrid({
  blocks,
  win,
  dayLabel,
  isToday,
  now,
  drag,
  onSchedule,
  onResize,
  className,
  ...blockProps
}: GridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const hintId = useId();
  const slots = slotStarts(win);
  const showNow = isToday && now >= win.start && now <= win.end;

  // Scroll to an hour before now on today, otherwise to the first block or the morning, whenever the day changes.
  const scrollTarget = isToday ? now - 60 : (blocks[0]?.start ?? 8 * 60) - 30;
  const scrollFor = useRef<string | null>(null);
  useEffect(() => {
    if (scrollFor.current === dayLabel || !scrollRef.current) return;
    scrollFor.current = dayLabel;
    scrollRef.current.scrollTop = Math.max(0, minutesToOffset(scrollTarget, PX_PER_MINUTE, win));
  }, [dayLabel, scrollTarget, win]);

  // Keep the keyboard focus on a block after Alt+Arrow moves it (its row may be re-ordered).
  const focusBlock = (id: string) =>
    requestAnimationFrame(() =>
      columnRef.current
        ?.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"] [data-block-main]`)
        ?.focus(),
    );

  const minutesAt = (clientY: number) => {
    const top = columnRef.current?.getBoundingClientRect().top ?? 0;
    return offsetToMinutes(clientY - top - (drag?.grab ?? 0), PX_PER_MINUTE, win);
  };

  return (
    <section
      aria-labelledby="plan-grid-heading"
      className={clsx(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white/70 dark:border-stone-800 dark:bg-stone-900/40",
        className,
      )}
    >
      <h2 id="plan-grid-heading" className="sr-only">
        Schedule for {dayLabel}
      </h2>
      <p id={hintId} className="sr-only">
        Alt+Up or Alt+Down moves a task by 15 minutes; add Shift to change its length.
      </p>
      {/* Focusable so keyboard users can scroll the day. */}
      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label="Day schedule"
        className="min-h-0 flex-1 overflow-y-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-500"
      >
        <div className="flex py-3 pr-2">
          <div
            aria-hidden
            className="relative w-16 shrink-0"
            style={{ height: (win.end - win.start) * PX_PER_MINUTE }}
          >
            {slots
              .filter((m) => m % 60 === 0)
              .map((m) => (
                <span
                  key={m}
                  className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-stone-500 dark:text-stone-400"
                  style={{ top: minutesToOffset(m, PX_PER_MINUTE, win) }}
                >
                  {clockLabel(m)}
                </span>
              ))}
          </div>
          <div
            ref={columnRef}
            className="relative min-w-0 flex-1"
            onDragOver={(e) => {
              if (!isItemDrag(e)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              const minutes = minutesAt(e.clientY);
              if (minutes !== hover) setHover(minutes);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setHover(null);
              const id = getDragItem(e);
              if (id) onSchedule(id, minutesAt(e.clientY));
            }}
          >
            <div role="list" aria-label={`Time slots, ${dayLabel}`}>
              {slots.map((m) => (
                <div
                  key={m}
                  role="listitem"
                  aria-label={clockLabel(m)}
                  style={{ height: SLOT_MINUTES * PX_PER_MINUTE }}
                  className={clsx(
                    "border-t",
                    m % 60 === 0
                      ? "border-stone-200 dark:border-stone-800"
                      : "border-dashed border-stone-100 dark:border-stone-800/50",
                    isToday && m + SLOT_MINUTES <= now && "bg-stone-100/50 dark:bg-stone-900/50",
                  )}
                />
              ))}
            </div>
            {hover !== null && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-1 z-[2] rounded-lg border-2 border-dashed border-accent-400 bg-accent-50/70 px-2 py-0.5 text-xs font-medium text-accent-700 dark:border-accent-600 dark:bg-accent-950/50 dark:text-accent-300"
                style={{
                  top: minutesToOffset(hover, PX_PER_MINUTE, win),
                  height: (drag?.length ?? SLOT_MINUTES) * PX_PER_MINUTE,
                }}
              >
                {clockLabel(hover)}
              </div>
            )}
            <ul aria-label="Scheduled tasks" className="pointer-events-none absolute inset-0 z-[1]">
              {blocks.map((block) => (
                <Block
                  key={block.item.id}
                  block={block}
                  win={win}
                  drag={drag}
                  hintId={hintId}
                  onSchedule={(id, minutes) => {
                    onSchedule(id, minutes);
                    focusBlock(id);
                  }}
                  onResize={(id, minutes) => {
                    onResize(id, minutes);
                    focusBlock(id);
                  }}
                  {...blockProps}
                />
              ))}
            </ul>
            {showNow && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 z-[3] flex -translate-y-1/2 items-center"
                style={{ top: minutesToOffset(now, PX_PER_MINUTE, win) }}
              >
                <span className="-ml-1 size-2 rounded-full bg-red-500" />
                <span className="h-px flex-1 bg-red-500" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
