"use client";

import { useLayoutEffect, useRef } from "react";
import clsx from "clsx";

/** A detail panel title: a textarea that grows with its text, so long titles wrap instead of being cut off. */
export function TitleField({
  value,
  label,
  placeholder,
  fallback,
  readOnly,
  closed = false,
  onChange,
}: {
  value: string;
  label: string;
  placeholder: string;
  /** Title set when the field is left empty; omit to allow an empty title. */
  fallback?: string;
  readOnly: boolean;
  closed?: boolean;
  onChange: (title: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        if (fallback && !e.target.value.trim()) onChange(fallback);
      }}
      readOnly={readOnly}
      aria-label={label}
      placeholder={placeholder}
      className={clsx(
        "heading-display min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-0.5 text-2xl font-semibold leading-snug outline-none placeholder:text-stone-500",
        closed && "text-stone-500 line-through dark:text-stone-400",
      )}
    />
  );
}
