"use client";

import { Menu } from "lucide-react";
import { useUi } from "@/store/ui";

/** Title row shared by the calendar, matrix, timeline and plan views. */
export function ViewHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  return (
    <header className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
      <button
        type="button"
        className="btn btn-ghost -ml-2 px-2 md:hidden"
        aria-label="Open menu"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu size={20} />
      </button>
      <h1 className="heading-display min-w-0 max-w-full truncate text-2xl font-semibold">
        {title}
      </h1>
      {children && (
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">{children}</div>
      )}
    </header>
  );
}
