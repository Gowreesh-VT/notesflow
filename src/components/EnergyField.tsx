"use client";

import { BatteryLow, Brain, Zap } from "lucide-react";
import clsx from "clsx";
import { ENERGY_OPTIONS } from "@/lib/items-logic";
import type { Energy } from "@/lib/types";

export function EnergyIcon({ energy, size = 12 }: { energy: Energy; size?: number }) {
  const Icon = energy === "quick" ? Zap : energy === "deep" ? Brain : BatteryLow;
  return <Icon size={size} aria-hidden />;
}

/** Picks a task's energy tag; clicking the selected tag again clears it. */
export function EnergyField({
  value,
  onChange,
  disabled = false,
}: {
  value: Energy | null | undefined;
  onChange: (energy: Energy | null) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Energy" className="flex flex-wrap gap-1.5">
      {ENERGY_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(value === o.value ? null : o.value)}
          className={clsx(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value
              ? "border-accent-500 bg-accent-50 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
              : "border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800",
          )}
        >
          <EnergyIcon energy={o.value} />
          {o.label}
        </button>
      ))}
    </div>
  );
}
