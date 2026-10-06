"use client";

import { CheckSquare, Search } from "lucide-react";
import clsx from "clsx";
import { isPlannerView } from "@/lib/items-logic";
import type { PlannerViewKind } from "@/lib/types";
import { usePreferences } from "@/store/preferences";
import { useUi } from "@/store/ui";
import { PLANNER_ICONS } from "./viewIcons";

/** Views offered as tabs, in order; the first three the user has not hidden in Settings are shown. */
const TAB_VIEWS: { kind: PlannerViewKind; label: string }[] = [
  { kind: "calendar", label: "Calendar" },
  { kind: "focus", label: "Focus" },
  { kind: "habits", label: "Habits" },
  { kind: "matrix", label: "Matrix" },
  { kind: "plan", label: "Plan" },
];

function Tab({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex min-w-0 flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-500",
        active
          ? "text-accent-600 dark:text-accent-400"
          : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100",
      )}
    >
      {children}
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}

/** Phone navigation: a bottom tab bar for tasks, the main planner views and search. Hidden while a detail is open. */
export function MobileTabBar() {
  const view = useUi((s) => s.view);
  const lastTaskView = useUi((s) => s.lastTaskView);
  const detailOpen = useUi((s) => s.selectedItemId !== null);
  const { setView, setPaletteOpen } = useUi.getState();
  const { hiddenViews } = usePreferences();
  const tabs = TAB_VIEWS.filter((t) => !hiddenViews.includes(t.kind)).slice(0, 3);

  if (detailOpen) return null;

  return (
    <nav
      aria-label="Main"
      className="flex shrink-0 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-stone-800 dark:bg-stone-950/95"
    >
      <Tab label="Tasks" active={!isPlannerView(view)} onClick={() => setView(lastTaskView)}>
        <CheckSquare size={22} aria-hidden />
      </Tab>
      {tabs.map(({ kind, label }) => {
        const Icon = PLANNER_ICONS[kind];
        return (
          <Tab
            key={kind}
            label={label}
            active={view.kind === kind}
            onClick={() => setView({ kind })}
          >
            <Icon size={22} aria-hidden />
          </Tab>
        );
      })}
      <Tab label="Search" onClick={() => setPaletteOpen(true)}>
        <Search size={22} aria-hidden />
      </Tab>
    </nav>
  );
}
