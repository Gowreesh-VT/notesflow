"use client";

import { createElement, useEffect } from "react";
import clsx from "clsx";
import dynamic from "next/dynamic";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { isPlannerView } from "@/lib/items-logic";
import type { PlannerViewKind } from "@/lib/types";
import { canPin, pinnedList } from "@/lib/split";
import { ItemList } from "./ItemList";
import { SplitPane } from "./SplitPane";
import { NoteDetail } from "./NoteDetail";
import { TaskDetail } from "./TaskDetail";

function ViewLoading() {
  return (
    <p role="status" className="p-6 text-sm text-stone-500 dark:text-stone-400">
      Loading…
    </p>
  );
}

// Whole-workspace views load on first use, keeping them out of the initial bundle.
const lazyView = (load: () => Promise<React.ComponentType>) =>
  dynamic(load, { loading: ViewLoading });

const PLANNER_COMPONENTS: Record<PlannerViewKind, React.ComponentType> = {
  calendar: lazyView(() => import("./CalendarView").then((m) => m.CalendarView)),
  matrix: lazyView(() => import("./MatrixView").then((m) => m.MatrixView)),
  timeline: lazyView(() => import("./TimelineView").then((m) => m.TimelineView)),
  plan: lazyView(() => import("./PlanView").then((m) => m.PlanView)),
  focus: lazyView(() => import("./FocusView").then((m) => m.FocusView)),
  habits: lazyView(() => import("./HabitsView").then((m) => m.HabitsView)),
  review: lazyView(() => import("./ReviewView").then((m) => m.ReviewView)),
  progress: lazyView(() => import("./ProgressView").then((m) => m.ProgressView)),
  quick: lazyView(() => import("./QuickView").then((m) => m.QuickView)),
  settings: lazyView(() => import("./SettingsView").then((m) => m.SettingsView)),
};

// The list takes the full width; the detail panel only opens beside it when something is selected.
export function Workspace() {
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const selectedItemId = useUi((s) => s.selectedItemId);
  const view = useUi((s) => s.view);
  const splitListId = useUi((s) => s.splitListId);
  const setSplitListId = useUi((s) => s.setSplitListId);
  const selected = items.find((i) => i.id === selectedItemId) ?? null;
  const pinned = pinnedList(lists, splitListId, view);

  // A pinned list that was deleted or archived (here or on another device) is unpinned.
  useEffect(() => {
    if (splitListId && !canPin(lists, splitListId)) setSplitListId(null);
  }, [lists, splitListId, setSplitListId]);

  return (
    <div className="flex h-full">
      <div className={selected ? "hidden min-w-0 flex-1 md:block" : "min-w-0 flex-1"}>
        {isPlannerView(view) ? createElement(PLANNER_COMPONENTS[view.kind]) : <ItemList />}
      </div>
      {/* Split view needs room: beside the list on large screens, and on extra-wide ones also beside details. */}
      {pinned && (
        <div className={clsx("hidden", selected ? "2xl:flex" : "lg:flex")}>
          <SplitPane key={pinned.id} listId={pinned.id} name={pinned.name} />
        </div>
      )}
      {selected && (
        <section
          aria-label="Details"
          className="w-full min-w-0 overflow-hidden bg-stone-50 md:w-[24rem] md:shrink-0 md:border-l md:border-stone-200 lg:w-[30rem] xl:w-[34rem] dark:bg-stone-950 dark:md:border-stone-800"
        >
          {selected.kind === "task" ? (
            <TaskDetail key={selected.id} item={selected} />
          ) : (
            <NoteDetail key={selected.id} item={selected} />
          )}
        </section>
      )}
    </div>
  );
}
