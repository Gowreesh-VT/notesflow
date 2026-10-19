"use client";

import { X } from "lucide-react";
import clsx from "clsx";
import type { Repeat } from "@/lib/types";
import { addDays } from "@/lib/utils";
import { DateField, DatePicker } from "./DatePicker";
import { RepeatField } from "./RepeatField";
import { TimeField } from "./TimeField";

export type Schedule = {
  due: string | null;
  dueTime: string | null;
  repeat: Repeat | null;
  startDate?: string | null;
};

/** The fields one choice in the sheet changes. */
export type SchedulePatch = Partial<Schedule>;

/**
 * The one sheet for scheduling a task: quick dates, a month grid, a time of day, an optional start date, and the
 * repeat rule with its end date. Task details, the add sheet and batch edit all use it, each deciding what a change
 * does (`onChange` receives only the fields that changed).
 */
export function SchedulePicker({
  value,
  today,
  onChange,
  withStartDate = false,
  timeWithoutDate = false,
  alwaysClearable = false,
  disabled = false,
  dateLabel = "Due date",
}: {
  value: Schedule;
  today: string;
  onChange: (patch: SchedulePatch) => void;
  /** Offers a start date for tasks that span several days. */
  withStartDate?: boolean;
  /** Shows the time even before a date is chosen (batch edit sets times on tasks that already have dates). */
  timeWithoutDate?: boolean;
  /** Shows "Clear date" even while no date is chosen (batch edit clears dates on many tasks). */
  alwaysClearable?: boolean;
  disabled?: boolean;
  dateLabel?: string;
}) {
  const quickDates = [
    { label: "Today", day: today },
    { label: "Tomorrow", day: addDays(today, 1) },
    { label: "Next week", day: addDays(today, 7) },
  ];
  const row = "grid grid-cols-[3.5rem_1fr] items-start gap-2";
  const rowLabel = "pt-1.5 text-stone-500 dark:text-stone-400";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {quickDates.map(({ label, day }) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ due: day })}
            className={clsx(
              "btn flex-1 justify-center px-2 py-1 text-xs max-md:py-2",
              value.due === day
                ? "bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
                : "btn-ghost bg-stone-100 dark:bg-stone-800",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <DatePicker
        label={dateLabel}
        value={value.due}
        today={today}
        min={value.startDate}
        onChange={(due) => onChange({ due })}
      />

      {(value.due || timeWithoutDate) && (
        <div className={row}>
          <span className={rowLabel}>Time</span>
          <TimeField
            value={value.dueTime}
            disabled={disabled}
            onChange={(dueTime) => onChange({ dueTime })}
          />
        </div>
      )}

      {withStartDate && value.due && (
        <div className={row}>
          <span className={rowLabel}>Starts</span>
          <span className="flex min-w-0 items-start gap-1.5">
            <DateField
              label="Start date"
              empty="Same day"
              value={value.startDate ?? null}
              today={today}
              max={value.due}
              disabled={disabled}
              onChange={(startDate) => onChange({ startDate })}
            />
            {value.startDate ? (
              <button
                type="button"
                className="btn btn-ghost shrink-0 px-2 py-1 text-xs"
                onClick={() => onChange({ startDate: null })}
              >
                Same day
              </button>
            ) : null}
          </span>
        </div>
      )}

      <div className="space-y-1">
        <span className={clsx(rowLabel, "block pt-0")}>Repeat</span>
        <RepeatField
          value={value.repeat}
          due={value.due}
          today={today}
          disabled={disabled}
          onChange={(repeat) => onChange({ repeat })}
        />
      </div>

      {(value.due || alwaysClearable) && (
        <button
          type="button"
          disabled={disabled}
          className="btn btn-ghost w-full justify-center py-1 text-xs max-md:py-2"
          onClick={() => onChange({ due: null })}
        >
          <X size={12} aria-hidden /> Clear date
        </button>
      )}
    </div>
  );
}
