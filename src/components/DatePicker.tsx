"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, monthMatrix, monthOf, startOfMonth, weekDays } from "@/lib/calendar";
import { formatDate } from "@/lib/locale";

const toDate = (day: string) => new Date(`${day}T12:00:00`);

/** A month grid for choosing one date. Honours the week start preference; `min` and `max` disable days outside them. */
export function DatePicker({
  value,
  today,
  onChange,
  min,
  max,
  label = "Choose a date",
}: {
  value: string | null;
  today: string;
  onChange: (day: string) => void;
  min?: string | null;
  max?: string | null;
  label?: string;
}) {
  const [month, setMonth] = useState(startOfMonth(value ?? today));
  const weeks = monthMatrix(month);

  return (
    <div role="group" aria-label={label} className="space-y-1">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth(addMonths(month, -1))}
          className="btn btn-ghost size-9 justify-center p-0"
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        <span aria-live="polite" className="text-sm font-medium">
          {formatDate(toDate(month), { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonth(addMonths(month, 1))}
          className="btn btn-ghost size-9 justify-center p-0"
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-stone-500 dark:text-stone-400">
        {weekDays(weeks[0][0]).map((day) => (
          <span key={day} aria-hidden className="py-1">
            {formatDate(toDate(day), { weekday: "narrow" })}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {weeks.flat().map((day) => {
          const selected = day === value;
          const outside = monthOf(day) !== monthOf(month);
          const blocked = Boolean((min && day < min) || (max && day > max));
          return (
            <button
              key={day}
              type="button"
              disabled={blocked}
              aria-pressed={selected}
              aria-current={day === today ? "date" : undefined}
              aria-label={formatDate(toDate(day), {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              onClick={() => onChange(day)}
              className={clsx(
                "mx-auto flex size-9 items-center justify-center rounded-full text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-500 disabled:opacity-30",
                selected
                  ? "bg-accent-600 font-medium text-white"
                  : day === today
                    ? "font-semibold text-accent-700 hover:bg-stone-100 dark:text-accent-300 dark:hover:bg-stone-800"
                    : outside
                      ? "text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
                      : "hover:bg-stone-100 dark:hover:bg-stone-800",
              )}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A button showing the chosen date that opens the month grid beneath it. */
export function DateField({
  value,
  today,
  onChange,
  min,
  max,
  label,
  empty,
  disabled = false,
}: {
  value: string | null;
  today: string;
  onChange: (day: string) => void;
  min?: string | null;
  max?: string | null;
  label: string;
  empty: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="field w-full py-1 text-left"
      >
        {value
          ? formatDate(toDate(value), { day: "numeric", month: "short", year: "numeric" })
          : empty}
      </button>
      {open && (
        <DatePicker
          label={label}
          value={value}
          today={today}
          min={min}
          max={max}
          onChange={(day) => {
            onChange(day);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
