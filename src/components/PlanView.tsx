"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
import { formatDuration } from "@/lib/duration";
import { useNow, useToday } from "@/lib/hooks";
import { archivedListIds, filterByEnergy, viewTitle } from "@/lib/items-logic";
import {
  blockLength,
  DAY_MINUTES,
  layoutBlocks,
  minutesToClock,
  nextFreeStart,
  planTotals,
  planWindow,
  scheduledOn,
  toPlanOn,
} from "@/lib/plan";
import type { Item } from "@/lib/types";
import { addDays, displayTitle, formatClock, formatDueLabel } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { clockLabel, PlanGrid, type PlanDrag } from "./PlanGrid";
import { DayPlanner } from "./DayPlanner";
import { Suggestions } from "./Suggestions";
import { PlanQueue } from "./PlanQueue";
import { ViewHeader } from "./ViewHeader";
import { formatDate } from "@/lib/locale";

function longDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return formatDate(new Date(y, m - 1, d), {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Plan a day: tasks waiting for a time on the left ("To plan"), the day's time grid on the right. Tasks are dragged
 * into slots (or given a time with the keyboard), moved, resized to set their estimate, and dragged back to unplan.
 */
export function PlanView() {
  const [planning, setPlanning] = useState(false);
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const updateItem = useWorkspace((s) => s.updateItem);
  const energyFilter = useUi((s) => s.energyFilter);
  const today = useToday();
  const nowMs = useNow(true, 30_000);

  // Null follows today (also across midnight); a chosen day stays put.
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const day = chosenDay ?? today;
  const [includeUndated, setIncludeUndated] = useState(false);
  const [drag, setDrag] = useState<PlanDrag | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const archived = useMemo(() => archivedListIds(lists), [lists]);
  const blocks = useMemo(
    () => layoutBlocks(scheduledOn(items, day, archived)),
    [items, day, archived],
  );
  const win = useMemo(() => planWindow(blocks), [blocks]);
  const queue = useMemo(
    () => filterByEnergy(toPlanOn(items, day, today, { includeUndated, archived }), energyFilter),
    [items, day, today, includeUndated, archived, energyFilter],
  );
  const openBlocks = blocks.filter((b) => b.item.status === "open");

  const nowDate = new Date(nowMs);
  const now = nowDate.getHours() * 60 + nowDate.getMinutes();
  const isToday = day === today;
  const totals = planTotals(openBlocks, win, isToday ? now : day < today ? DAY_MINUTES : null);

  const relative = formatDueLabel(day, today);
  const dayLabel = longDate(day);
  const title = viewTitle({ kind: "plan" }, lists);

  const find = (id: string): Item | undefined =>
    items.find((i) => i.id === id && i.kind === "task" && i.deletedAt === null);

  const schedule = (id: string, minutes: number) => {
    const item = find(id);
    if (!item) return;
    const time = minutesToClock(minutes);
    const moved = item.due === day && Boolean(item.dueTime);
    updateItem(id, { due: day, dueTime: time });
    setAnnouncement(
      `${moved ? "Moved" : "Scheduled"} “${displayTitle(item)}” to ${formatClock(time)}.`,
    );
  };

  // Dropping on "To plan" takes the time away and keeps the date (a task without a date gets this day).
  const unschedule = (id: string) => {
    const item = find(id);
    if (!item || (item.due && !item.dueTime)) return;
    updateItem(id, item.due ? { dueTime: null } : { due: day });
    setAnnouncement(`Moved “${displayTitle(item)}” back to To plan.`);
  };

  const resize = (id: string, minutes: number) => {
    const item = find(id);
    if (!item) return;
    updateItem(id, { estimate: minutes });
    setAnnouncement(`“${displayTitle(item)}” now takes ${formatDuration(minutes)}.`);
  };

  const suggest = (item: Item) =>
    nextFreeStart(openBlocks, isToday ? now : win.start, blockLength(item), win);

  // Re-rendering the drag source inside dragstart can cancel the drag in some browsers, so wait a tick.
  const startDrag = (item: Item, grab: number) =>
    window.setTimeout(() => setDrag({ id: item.id, grab, length: blockLength(item) }));

  const free = totals.available > 0;

  return (
    <div className="@container flex h-full flex-col">
      {planning && <DayPlanner day={day} today={today} onClose={() => setPlanning(false)} />}
      <ViewHeader title={title}>
        <button type="button" className="btn btn-primary mr-1" onClick={() => setPlanning(true)}>
          <Wand2 size={15} aria-hidden /> Plan step by step
        </button>
        <button
          type="button"
          className="btn btn-ghost px-2"
          aria-label="Previous day"
          onClick={() => setChosenDay(addDays(day, -1))}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={isToday}
          onClick={() => setChosenDay(null)}
        >
          Today
        </button>
        <button
          type="button"
          className="btn btn-ghost px-2"
          aria-label="Next day"
          onClick={() => setChosenDay(addDays(day, 1))}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </ViewHeader>
      {day === today && <Suggestions />}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 pb-3 sm:px-6">
        <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">
          {relative === "Today" || relative === "Tomorrow" || relative === "Yesterday"
            ? `${relative} · ${dayLabel}`
            : dayLabel}
        </p>
        <p className="text-sm tabular-nums text-stone-500 dark:text-stone-400">
          {totals.planned > 0 ? `${formatDuration(totals.planned)} planned` : "Nothing planned yet"}
          {free && ` · ${formatDuration(totals.free)} free until ${clockLabel(win.end)}`}
        </p>
        {totals.over > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {formatDuration(totals.over)} more than the time left — something may need another day.
          </p>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-2 pb-4 sm:px-4 @3xl:flex-row">
        <PlanQueue
          items={queue}
          day={day}
          today={today}
          includeUndated={includeUndated}
          onIncludeUndated={setIncludeUndated}
          suggest={suggest}
          onSchedule={schedule}
          onUnschedule={unschedule}
          onDragStart={startDrag}
          onDragEnd={() => setDrag(null)}
          dragId={drag?.id ?? null}
          className="max-h-[40vh] shrink-0 @3xl:max-h-none @3xl:w-72"
        />
        <PlanGrid
          blocks={blocks}
          win={win}
          dayLabel={dayLabel}
          isToday={isToday}
          now={now}
          drag={drag}
          onDragStart={startDrag}
          onDragEnd={() => setDrag(null)}
          onSchedule={schedule}
          onUnschedule={unschedule}
          onResize={resize}
          className="min-h-64 flex-1"
        />
      </div>
    </div>
  );
}
