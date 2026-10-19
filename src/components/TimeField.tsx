"use client";

import clsx from "clsx";
import { timeOptions } from "@/lib/time-options";
import { formatClock } from "@/lib/utils";

const PRESETS = ["09:00", "12:00", "15:00", "18:00"];

/**
 * A time of day (or "All day") chosen from a list, in the clock style of the user's settings. Replaces the browser's
 * time input, which looks different on every device. Common times are one tap away while no time is set.
 */
export function TimeField({
  value,
  onChange,
  label = "Time",
  disabled = false,
}: {
  value: string | null;
  /** `null` = all day. */
  onChange: (time: string | null) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <select
        aria-label={label}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        className="field py-1"
      >
        <option value="">All day</option>
        {timeOptions(value).map((time) => (
          <option key={time} value={time}>
            {formatClock(time)}
          </option>
        ))}
      </select>
      {!value && (
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((time) => (
            <button
              key={time}
              type="button"
              disabled={disabled}
              onClick={() => onChange(time)}
              className={clsx(
                "btn px-2 py-1 text-xs max-md:py-2",
                "bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700",
              )}
            >
              {formatClock(time)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
