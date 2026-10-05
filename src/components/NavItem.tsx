"use client";

import clsx from "clsx";

/** A sidebar row: icon, label and optional count; the active row is highlighted. */
export function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
  indent = false,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  indent?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-sm transition-colors",
        "focus-visible:outline-2 focus-visible:outline-accent-500",
        indent && "pl-7",
        className,
        active
          ? "bg-stone-200/80 font-medium text-stone-900 dark:bg-stone-800 dark:text-stone-50"
          : "text-stone-600 hover:bg-stone-200/50 dark:text-stone-300 dark:hover:bg-stone-900",
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "shrink-0",
          active ? "text-accent-600 dark:text-accent-400" : "text-stone-400",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs tabular-nums text-stone-500 dark:text-stone-400">{count}</span>
      )}
    </button>
  );
}
