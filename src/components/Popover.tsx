"use client";

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";

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
            className="fixed inset-0 z-20 cursor-default"
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
            )}
          >
            {typeof children === "function" ? children(() => close()) : children}
          </div>
        </>
      )}
    </div>
  );
}
