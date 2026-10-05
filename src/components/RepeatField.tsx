"use client";

import clsx from "clsx";
import { describeRepeat, MAX_REPEAT_EVERY, REPEAT_UNITS } from "@/lib/recurrence";
import type { Repeat, RepeatUnit } from "@/lib/types";

const PRESETS: { id: string; label: string; rule: Repeat | null }[] = [
  { id: "none", label: "Doesn’t repeat", rule: null },
  { id: "daily", label: "Daily", rule: { unit: "day", every: 1 } },
  {
    id: "weekdays",
    label: "Every weekday",
    rule: { unit: "week", every: 1, weekdays: [1, 2, 3, 4, 5] },
  },
  { id: "weekly", label: "Weekly", rule: { unit: "week", every: 1 } },
  { id: "monthly", label: "Monthly", rule: { unit: "month", every: 1 } },
  { id: "yearly", label: "Yearly", rule: { unit: "year", every: 1 } },
];

const sameRule = (a: Repeat | null | undefined, b: Repeat | null) =>
  (a ?? null) === b ||
  (!!a &&
    !!b &&
    a.unit === b.unit &&
    a.every === b.every &&
    (a.weekdays ?? []).slice().sort().join() === (b.weekdays ?? []).slice().sort().join());

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Repeat presets plus a custom "every N units (on weekdays)" editor and the after-completion switch. */
export function RepeatField({
  value,
  onChange,
  disabled = false,
}: {
  value: Repeat | null | undefined;
  onChange: (rule: Repeat | null) => void;
  disabled?: boolean;
}) {
  const preset = PRESETS.find((p) => sameRule(value, p.rule))?.id ?? "custom";
  const after = Boolean(value?.afterCompletion);
  const withAfter = (rule: Repeat | null): Repeat | null =>
    rule ? { ...rule, ...(after ? { afterCompletion: true } : {}) } : null;

  return (
    <div className="space-y-2">
      <select
        aria-label="Repeat"
        value={preset}
        disabled={disabled}
        onChange={(e) => {
          const id = e.target.value;
          if (id === "custom") onChange(withAfter({ unit: "week", every: 2 }));
          else onChange(withAfter(PRESETS.find((p) => p.id === id)?.rule ?? null));
        }}
        className="field w-auto"
      >
        {PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
        <option value="custom">Custom…</option>
      </select>

      {value && preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Every</span>
          <input
            type="number"
            min={1}
            max={MAX_REPEAT_EVERY}
            aria-label="Repeat every"
            value={value.every}
            disabled={disabled}
            onChange={(e) => {
              const every = Math.min(
                MAX_REPEAT_EVERY,
                Math.max(1, Math.round(Number(e.target.value) || 1)),
              );
              onChange({ ...value, every });
            }}
            className="field w-20"
          />
          <select
            aria-label="Repeat unit"
            value={value.unit}
            disabled={disabled}
            onChange={(e) => {
              const unit = e.target.value as RepeatUnit;
              const next: Repeat = { ...value, unit };
              if (unit !== "week") delete next.weekdays;
              onChange(next);
            }}
            className="field w-auto"
          >
            {REPEAT_UNITS.map((u) => (
              <option key={u} value={u}>
                {value.every === 1 ? u : `${u}s`}
              </option>
            ))}
          </select>
          {value.unit === "week" && (
            <div role="group" aria-label="On these days" className="flex gap-1">
              {WEEKDAYS.map((d) => {
                const on = value.weekdays?.includes(d) ?? false;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    aria-label={WEEKDAY_LONG[d]}
                    disabled={disabled}
                    onClick={() => {
                      const days = on
                        ? (value.weekdays ?? []).filter((x) => x !== d)
                        : [...(value.weekdays ?? []), d];
                      const next: Repeat = { ...value, weekdays: days };
                      if (!days.length) delete next.weekdays;
                      onChange(next);
                    }}
                    className={clsx(
                      "size-7 rounded-full text-xs font-medium",
                      on
                        ? "bg-accent-600 text-white dark:bg-accent-600"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300",
                    )}
                  >
                    {WEEKDAY_SHORT[d]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {value && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={after}
              disabled={disabled}
              onChange={(e) => {
                const next: Repeat = { ...value };
                if (e.target.checked) next.afterCompletion = true;
                else delete next.afterCompletion;
                onChange(next);
              }}
              className="size-4 accent-accent-600"
            />
            Count the next date from when I complete it
          </label>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {describeRepeat(value)}. Completing it logs a finished copy and moves this task to the
            next date.
          </p>
        </>
      )}
    </div>
  );
}
