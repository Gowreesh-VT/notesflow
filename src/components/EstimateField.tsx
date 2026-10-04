"use client";

import { useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { formatDuration, parseDuration } from "@/lib/duration";

const PRESETS = [15, 30, 60, 120];

/** Edits a duration in minutes with free text ("25m", "1h30") and a few presets. */
export function EstimateField({
  value,
  onChange,
  disabled = false,
  label,
}: {
  value: number | null | undefined;
  onChange: (minutes: number | null) => void;
  disabled?: boolean;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const shown = draft ?? (value ? formatDuration(value) : "");

  const commit = () => {
    if (draft === null) return;
    const text = draft.trim();
    if (!text) {
      onChange(null);
      setDraft(null);
      setInvalid(false);
      return;
    }
    const minutes = parseDuration(text);
    if (minutes) {
      onChange(minutes);
      setDraft(null);
      setInvalid(false);
    } else {
      setInvalid(true);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        value={shown}
        disabled={disabled}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(null);
            setInvalid(false);
          }
        }}
        placeholder="e.g. 25m or 1h30"
        aria-label={label}
        aria-invalid={invalid}
        className={clsx("field w-32", invalid && "border-red-400 dark:border-red-700")}
      />
      {!disabled &&
        PRESETS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => {
              setDraft(null);
              setInvalid(false);
              onChange(minutes);
            }}
            className={clsx(
              "btn px-2 py-1 text-xs",
              value === minutes
                ? "bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
                : "btn-ghost",
            )}
          >
            {formatDuration(minutes)}
          </button>
        ))}
      {!disabled && value ? (
        <button
          type="button"
          className="btn btn-ghost px-2 py-1 text-xs"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => {
            setDraft(null);
            onChange(null);
          }}
        >
          <X size={12} aria-hidden />
        </button>
      ) : null}
      {invalid && (
        <span role="alert" className="w-full text-xs text-red-600 dark:text-red-400">
          Try something like 25m, 1h or 1h30.
        </span>
      )}
    </div>
  );
}
