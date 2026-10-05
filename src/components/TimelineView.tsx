"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { archivedListIds } from "@/lib/items-logic";
import { useToday } from "@/lib/hooks";
import {
  barGeometry,
  DAY_WIDTH,
  dayOffset,
  daysFromPixels,
  describeBar,
  dragDates,
  groupTimeline,
  isWeekend,
  monthSpans,
  rangeDays,
  timelineRange,
  timelineStart,
  timelineTasks,
  type DragMode,
  type TimelineRange,
  type TimelineTask,
  type TimelineZoom,
} from "@/lib/timeline";
import type { Priority } from "@/lib/types";
import { daysBetween, displayTitle } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { ViewHeader } from "./ViewHeader";
import { formatDate } from "@/lib/locale";

const BAR_STYLE: Record<Priority, string> = {
  none: "border-accent-500/60 bg-accent-500/15",
  low: "border-sky-500/60 bg-sky-500/15",
  medium: "border-amber-500/60 bg-amber-500/15",
  high: "border-red-500/60 bg-red-500/15",
};

const DIAMOND_STYLE: Record<Priority, string> = {
  none: "bg-accent-500",
  low: "bg-sky-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
};

const ZOOMS: { value: TimelineZoom; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

/** Bars narrower than this have no resize handles; they can still be moved, and edited in the detail panel. */
const MIN_RESIZE_WIDTH = 32;
/** Pointer travel (px) before a press on a bar counts as a drag instead of a click. */
const DRAG_THRESHOLD = 4;

type DragState = { id: string; mode: DragMode; originX: number; days: number; moved: boolean };

const HELP_ID = "timeline-help";

function TimelineBar({
  task,
  range,
  dayWidth,
  today,
  selected,
  drag,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onActivate,
  onKeyMove,
}: {
  task: TimelineTask;
  range: TimelineRange;
  dayWidth: number;
  today: string;
  selected: boolean;
  drag: DragState | null;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onActivate: () => void;
  onKeyMove: (mode: DragMode, days: number) => void;
}) {
  // While dragging, show where the task would land.
  const dates = drag
    ? dragDates(task, drag.mode, drag.days)
    : { due: task.due, startDate: task.startDate ?? null };
  const shown = { ...task, ...dates };
  const start = timelineStart(shown);
  const geometry = barGeometry(start, shown.due, range, dayWidth);
  if (!geometry) return null;
  const single = start === shown.due;
  const resizable = geometry.width >= MIN_RESIZE_WIDTH;
  const labelInside = !single && geometry.width >= 56;
  const title = displayTitle(task);

  return (
    <button
      type="button"
      data-timeline-bar={task.id}
      aria-label={describeBar(shown, today)}
      aria-describedby={HELP_ID}
      aria-current={selected ? "true" : undefined}
      aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+Shift+ArrowLeft Alt+Shift+ArrowRight"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        e.preventDefault();
        onKeyMove(e.shiftKey ? "end" : "move", e.key === "ArrowLeft" ? -1 : 1);
      }}
      style={{ left: geometry.x, width: geometry.width }}
      className={clsx(
        "absolute inset-y-1.5 flex touch-pan-y select-none items-center rounded-md text-left",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
        drag?.moved ? "cursor-grabbing shadow-lift" : "cursor-grab",
        single
          ? "justify-center"
          : clsx(
              "border",
              BAR_STYLE[task.priority],
              geometry.clippedStart && "rounded-l-none border-l-0",
              geometry.clippedEnd && "rounded-r-none border-r-0",
            ),
        selected && "ring-2 ring-accent-500",
      )}
    >
      {single && (
        <span
          aria-hidden
          className={clsx("size-2.5 rotate-45 rounded-[2px]", DIAMOND_STYLE[task.priority])}
        />
      )}
      <span
        aria-hidden
        className={clsx(
          "pointer-events-none truncate text-xs text-stone-800 dark:text-stone-100",
          labelInside
            ? "min-w-0 px-2"
            : "absolute left-full ml-1.5 max-w-48 text-stone-600 dark:text-stone-300",
        )}
      >
        {title}
      </span>
      {resizable && (
        <>
          <span
            aria-hidden
            data-edge="start"
            className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l-md hover:bg-stone-900/10 dark:hover:bg-white/15"
          />
          <span
            aria-hidden
            data-edge="end"
            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-md hover:bg-stone-900/10 dark:hover:bg-white/15"
          />
        </>
      )}
    </button>
  );
}

/**
 * Gantt-style timeline of open tasks with a due date, grouped by list. Multi-day tasks are bars from their start to
 * their due date, single-day tasks are diamonds. Bars can be dragged (or moved with Alt+arrow keys) to change dates.
 */
export function TimelineView() {
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const updateItem = useWorkspace((s) => s.updateItem);
  const selectedItemId = useUi((s) => s.selectedItemId);
  const selectItem = useUi((s) => s.selectItem);
  const today = useToday();

  const [zoom, setZoom] = useState<TimelineZoom>("week");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // Bumped to ask for a scroll to today (on open, on zoom and with the Today button).
  const [scrollRequest, setScrollRequest] = useState(1);
  const handledScroll = useRef(0);
  const suppressClick = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const nameColumn = useRef<HTMLDivElement>(null);

  const tasks = useMemo(() => timelineTasks(items, archivedListIds(lists)), [items, lists]);
  const groups = useMemo(() => groupTimeline(tasks, lists), [tasks, lists]);
  const range = useMemo(() => timelineRange(tasks, today, zoom), [tasks, today, zoom]);
  const dayWidth = DAY_WIDTH[zoom];
  const totalWidth = range.days * dayWidth;
  const days = useMemo(() => rangeDays(range), [range]);
  const months = useMemo(() => monthSpans(range), [range]);
  const todayInRange = today >= range.from && today <= range.to;

  // When the range grows to the left (a task moved earlier), keep the same days in view.
  const shownFrom = useRef({ from: range.from, dayWidth });
  useLayoutEffect(() => {
    const previous = shownFrom.current;
    shownFrom.current = { from: range.from, dayWidth };
    const el = scroller.current;
    if (el && previous.dayWidth === dayWidth && previous.from !== range.from) {
      el.scrollLeft += daysBetween(range.from, previous.from) * dayWidth;
    }
  }, [range.from, dayWidth]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || handledScroll.current === scrollRequest) return;
    const first = handledScroll.current === 0;
    handledScroll.current = scrollRequest;
    const visible = el.clientWidth - (nameColumn.current?.offsetWidth ?? 0);
    el.scrollTo({
      left: Math.max(0, dayOffset(range, today, dayWidth) - visible / 4),
      behavior: first ? "auto" : "smooth",
    });
  }, [scrollRequest, range, today, dayWidth]);

  const commit = (task: TimelineTask, mode: DragMode, delta: number) => {
    const dates = dragDates(task, mode, delta);
    if (dates.due === task.due && dates.startDate === (task.startDate ?? null)) return;
    updateItem(task.id, dates);
    setAnnouncement(`Rescheduled: ${describeBar({ ...task, ...dates }, today)}.`);
  };

  const barHandlers = (task: TimelineTask) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      suppressClick.current = false;
      if (e.button !== 0) return;
      const edge = (e.target as HTMLElement).dataset.edge;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({
        id: task.id,
        mode: edge === "start" || edge === "end" ? edge : "move",
        originX: e.clientX,
        days: 0,
        moved: false,
      });
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag || drag.id !== task.id) return;
      const dx = e.clientX - drag.originX;
      const moved = drag.moved || Math.abs(dx) > DRAG_THRESHOLD;
      const delta = moved ? daysFromPixels(dx, dayWidth) : 0;
      if (moved !== drag.moved || delta !== drag.days) setDrag({ ...drag, moved, days: delta });
    },
    onPointerUp: () => {
      if (!drag || drag.id !== task.id) return;
      if (drag.moved) {
        suppressClick.current = true;
        commit(task, drag.mode, drag.days);
      }
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
    onActivate: () => {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      selectItem(task.id);
    },
    onKeyMove: (mode: DragMode, delta: number) => {
      commit(task, mode, delta);
      // Rows are sorted by date, so the bar may move to another row; keep the keyboard focus on it.
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`[data-timeline-bar="${CSS.escape(task.id)}"]`)
          ?.focus(),
      );
    },
  });

  const toggleGroup = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const trackStyle = { width: totalWidth };
  const nameCell =
    "sticky left-0 z-10 w-[var(--name-w)] shrink-0 border-r border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900";

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Timeline">
        <div
          role="group"
          aria-label="Zoom"
          className="flex rounded-xl border border-stone-200 p-0.5 dark:border-stone-700"
        >
          {ZOOMS.map((z) => (
            <button
              key={z.value}
              type="button"
              aria-pressed={zoom === z.value}
              onClick={() => {
                setZoom(z.value);
                setScrollRequest((n) => n + 1);
              }}
              className={clsx(
                "rounded-lg px-2.5 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-500",
                zoom === z.value
                  ? "bg-accent-50 font-medium text-accent-700 dark:bg-accent-950/60 dark:text-accent-300"
                  : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
              )}
            >
              {z.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={tasks.length === 0}
          onClick={() => setScrollRequest((n) => n + 1)}
        >
          Today
        </button>
      </ViewHeader>
      <p id={HELP_ID} className="px-4 pb-2 text-xs text-stone-500 sm:px-6 dark:text-stone-400">
        Drag a bar to move it, or its ends to change the start or due date. On a focused bar,
        Alt+Left/Right moves it by a day and Alt+Shift+Left/Right changes its due date.
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {tasks.length === 0 ? (
        <p className="px-4 py-6 text-sm text-stone-500 sm:px-6 dark:text-stone-400">
          Tasks with a due date show up here. Give a task a start date too to see it as a range.
        </p>
      ) : (
        <section
          aria-label="Timeline"
          ref={scroller}
          className="relative min-h-0 flex-1 overflow-auto overscroll-x-contain border-t border-stone-200 [--name-w:8.5rem] sm:[--name-w:14rem] dark:border-stone-800"
        >
          <div
            className="relative min-h-full pb-6"
            style={{ width: `calc(var(--name-w) + ${totalWidth}px)` }}
          >
            {/* Weekends, today's column and month boundaries, behind the rows. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-[var(--name-w)]"
              style={trackStyle}
            >
              {zoom === "week" &&
                days.map((day, i) =>
                  isWeekend(day) ? (
                    <div
                      key={day}
                      className="absolute inset-y-0 bg-stone-50 dark:bg-stone-800/40"
                      style={{ left: i * dayWidth, width: dayWidth }}
                    />
                  ) : null,
                )}
              {months.slice(1).map((m) => (
                <div
                  key={m.key}
                  className="absolute inset-y-0 w-px bg-stone-200 dark:bg-stone-800"
                  style={{ left: dayOffset(range, m.start, dayWidth) }}
                />
              ))}
              {todayInRange && (
                <>
                  <div
                    className="absolute inset-y-0 bg-accent-500/5"
                    style={{ left: dayOffset(range, today, dayWidth), width: dayWidth }}
                  />
                  <div
                    className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-accent-500/70"
                    style={{ left: dayOffset(range, today, dayWidth) + dayWidth / 2 }}
                  />
                </>
              )}
            </div>

            <div className="sticky top-0 z-20 flex border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
              <div
                ref={nameColumn}
                className={clsx(nameCell, "z-30 flex items-end px-3 pb-1.5 text-xs font-medium")}
              >
                <span className="text-stone-500 dark:text-stone-400">Task</span>
              </div>
              <div aria-hidden className="relative h-14 shrink-0" style={trackStyle}>
                {months.map((m) => (
                  <div
                    key={m.key}
                    className="absolute top-0 h-7 overflow-hidden whitespace-nowrap px-2 pt-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200"
                    style={{ left: dayOffset(range, m.start, dayWidth), width: m.days * dayWidth }}
                  >
                    {m.days * dayWidth >= 60 ? m.label : ""}
                  </div>
                ))}
                {days.map((day, i) => {
                  const label = zoom === "week" ? true : new Date(`${day}T00:00`).getDay() === 1;
                  if (!label) return null;
                  const isToday = day === today;
                  const date = new Date(`${day}T00:00`);
                  return (
                    <div
                      key={day}
                      className={clsx(
                        "absolute top-7 flex h-7 items-center text-[11px] tabular-nums",
                        zoom === "week" ? "justify-center" : "pl-0.5",
                        isToday
                          ? "font-semibold text-accent-600 dark:text-accent-400"
                          : "text-stone-500 dark:text-stone-400",
                      )}
                      style={{
                        left: i * dayWidth,
                        width: zoom === "week" ? dayWidth : 7 * dayWidth,
                      }}
                    >
                      {zoom === "week"
                        ? `${formatDate(date, { weekday: "narrow" })} ${date.getDate()}`
                        : date.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>

            {groups.map((group) => {
              const open = !collapsed.has(group.id);
              const headingId = `timeline-group-${group.id}`;
              return (
                <section key={group.id} aria-labelledby={headingId} className="relative">
                  <div className="flex h-9 border-b border-stone-100 dark:border-stone-800/70">
                    <div className={clsx(nameCell, "flex items-center px-1.5")}>
                      <button
                        type="button"
                        id={headingId}
                        aria-expanded={open}
                        onClick={() => toggleGroup(group.id)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[13px] font-semibold text-stone-700 focus-visible:outline-2 focus-visible:outline-accent-500 dark:text-stone-200"
                      >
                        <ChevronRight
                          size={15}
                          aria-hidden
                          className={clsx(
                            "shrink-0 text-stone-400 transition-transform",
                            open && "rotate-90",
                          )}
                        />
                        <span className="truncate">{group.name}</span>
                        <span className="font-normal text-stone-400 dark:text-stone-500">
                          {group.items.length}
                        </span>
                      </button>
                    </div>
                  </div>
                  {open && (
                    <ul>
                      {group.items.map((task) => {
                        const selected = task.id === selectedItemId;
                        const inRange =
                          barGeometry(timelineStart(task), task.due, range, dayWidth) !== null;
                        return (
                          <li
                            key={task.id}
                            className="flex h-9 border-b border-stone-100 dark:border-stone-800/70"
                          >
                            <div className={nameCell}>
                              <button
                                type="button"
                                tabIndex={inRange ? -1 : 0}
                                onClick={() => selectItem(task.id)}
                                className={clsx(
                                  "flex size-full items-center px-3 text-left text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-500",
                                  selected
                                    ? "bg-accent-50 text-stone-900 dark:bg-accent-950/50 dark:text-stone-50"
                                    : "text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800/60",
                                )}
                              >
                                <span className="truncate">{displayTitle(task)}</span>
                              </button>
                            </div>
                            <div className="relative shrink-0" style={trackStyle}>
                              <TimelineBar
                                task={task}
                                range={range}
                                dayWidth={dayWidth}
                                today={today}
                                selected={selected}
                                drag={drag?.id === task.id ? drag : null}
                                {...barHandlers(task)}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
