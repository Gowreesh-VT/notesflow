"use client";

import { Check } from "lucide-react";
import clsx from "clsx";
import { ACCENT_PRESETS, accentColor } from "@/lib/accent";

/** Accent colour swatches plus a custom colour input. */
export function AccentPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (accent: string) => void;
}) {
  const custom = !ACCENT_PRESETS.some((p) => p.id === value);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm">Accent colour</span>
      <div
        role="radiogroup"
        aria-label="Accent colour"
        className="flex flex-wrap items-center gap-1.5"
      >
        {ACCENT_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={value === p.id}
            aria-label={p.label}
            title={p.label}
            onClick={() => onChange(p.id)}
            style={{ backgroundColor: p.color }}
            className={clsx(
              "flex size-7 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-white transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500 dark:ring-offset-stone-950",
              value === p.id && "ring-2 ring-stone-400 dark:ring-stone-500",
            )}
          >
            {value === p.id && <Check size={14} aria-hidden />}
          </button>
        ))}
        <label
          title="Custom colour"
          className={clsx(
            "relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-offset-2 ring-offset-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-stone-500 dark:ring-offset-stone-950",
            custom ? "ring-2 ring-stone-400 dark:ring-stone-500" : "",
          )}
          style={{
            background: custom
              ? accentColor(value)
              : "conic-gradient(#e11d48, #f59e0b, #22c55e, #06b6d4, #6366f1, #d946ef, #e11d48)",
          }}
        >
          <span className="sr-only">Custom colour</span>
          <input
            type="color"
            value={custom ? accentColor(value) : "#4259e2"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          {custom && <Check size={14} aria-hidden className="text-white" />}
        </label>
      </div>
    </div>
  );
}
