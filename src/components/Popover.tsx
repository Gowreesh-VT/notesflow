"use client";

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";

/** On phones the panel becomes a bottom sheet: full width, anchored to the bottom, with larger touch targets. */
export const SHEET_CLASSES =
  "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:left-0 max-md:right-0 max-md:m-0 max-md:max-h-[80dvh] max-md:w-auto max-md:max-w-none max-md:overflow-y-auto max-md:rounded-b-none max-md:rounded-t-2xl max-md:border-x-0 max-md:border-b-0 max-md:p-4 max-md:pb-[calc(1rem+env(safe-area-inset-bottom))] max-md:text-base motion-safe:max-md:animate-[sheet-in_180ms_ease-out]";

/**
 * A trigger button with a small floating panel, closed by Escape (focus returns to the trigger) or a click outside.
 * `children` may be a function that receives `close`, for panels whose choices should dismiss them.
 */
export function Popover({
  label,
  trigger,
  triggerClassName,
  panelClassName,
  align = "left",
  side = "below",
  disabled = false,
  iconOnly = false,
  children,
}: {
  /** Accessible name of the trigger and the panel. */
  label: string;
  trigger: React.ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  align?: "left" | "right";
  side?: "below" | "above";
  disabled?: boolean;
  /** The trigger shows only an icon, so `label` becomes its name; otherwise the label prefixes the visible text. */
  iconOnly?: boolean;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const triggerId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel
      ?.querySelector<HTMLElement>(
        "[aria-checked='true'], input, select, button:not([disabled]), [tabindex='0']",
      )
      ?.focus();
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) document.getElementById(triggerId)?.focus();
  };

  return (
    <div className="relative">
      <button
        id={triggerId}
        type="button"
        aria-label={iconOnly ? label : undefined}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={triggerClassName}
      >
        {!iconOnly && <span className="sr-only">{label}: </span>}
        {trigger}
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label={`Close ${label.toLowerCase()}`}
            tabIndex={-1}
            className="fixed inset-0 z-20 cursor-default max-md:bg-black/30"
            onClick={() => close(false)}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                close();
              }
            }}
            className={clsx(
              "absolute z-30 max-w-[calc(100vw-2rem)] rounded-xl border border-stone-200 bg-white p-2 text-sm shadow-lift dark:border-stone-700 dark:bg-stone-900",
              align === "right" ? "right-0" : "left-0",
              side === "above" ? "bottom-full mb-1.5" : "top-full mt-1.5",
              panelClassName,
              SHEET_CLASSES,
            )}
          >
            <div
              aria-hidden
              className="mx-auto -mt-1 mb-3 h-1 w-10 rounded-full bg-stone-300 md:hidden dark:bg-stone-700"
            />
            {typeof children === "function" ? children(() => close()) : children}
          </div>
        </>
      )}
    </div>
  );
}
