"use client";

import { ChevronRight, Plus } from "lucide-react";
import clsx from "clsx";
import { useUi } from "@/store/ui";

/**
 * A titled sidebar group that can be folded away (remembered on this device), with optional header actions.
 * Folded groups keep their header so the actions stay one click away.
 */
export function SidebarSection({
  id,
  title,
  actions,
  children,
}: {
  id: string;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const folded = useUi((s) => s.foldedSidebarSections.includes(id));
  const toggle = useUi((s) => s.toggleSidebarSection);
  return (
    <section aria-label={title} className="pt-3">
      <div className="group/section flex items-center justify-between pb-0.5 pl-1 pr-0.5">
        <button
          type="button"
          aria-expanded={!folded}
          onClick={() => toggle(id)}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-accent-500 dark:text-stone-400 dark:hover:text-stone-200"
        >
          <ChevronRight
            size={12}
            aria-hidden
            className={clsx("shrink-0 transition-transform", !folded && "rotate-90")}
          />
          <h2>{title}</h2>
        </button>
        {actions && <span className="flex">{actions}</span>}
      </div>
      {!folded && children}
    </section>
  );
}

/** The quiet "+ New …" row an empty sidebar group shows instead of a paragraph of help text. */
export function SidebarEmptyAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-sm text-stone-500 hover:bg-stone-200/50 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-accent-500 compact:py-1 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-stone-200"
    >
      <Plus size={16} aria-hidden />
      {label}
    </button>
  );
}
