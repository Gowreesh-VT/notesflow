"use client";

import { useState } from "react";
import { Settings2, X } from "lucide-react";
import clsx from "clsx";
import { MAX_OUTCOME_NOTE } from "@/lib/outcomes";
import type { Item } from "@/lib/types";
import { setPreferences, usePreferences } from "@/store/preferences";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

function OutcomeChoices({
  value,
  onPick,
}: {
  value: string | null;
  onPick: (label: string | null) => void;
}) {
  const labels = usePreferences().outcomeLabels;
  const choices = value && !labels.includes(value) ? [...labels, value] : labels;
  return (
    <div role="radiogroup" aria-label="Outcome" className="flex flex-wrap gap-1.5">
      {choices.map((label) => (
        <button
          key={label}
          type="button"
          role="radio"
          aria-checked={value === label}
          onClick={() => onPick(value === label ? null : label)}
          className={clsx(
            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            value === label
              ? "border-accent-500 bg-accent-50 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
              : "border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Lets the user rename, add or remove outcome choices (one per line). */
function EditChoices({ onClose }: { onClose: () => void }) {
  const labels = usePreferences().outcomeLabels;
  const [draft, setDraft] = useState(labels.join("\n"));
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setPreferences({ outcomeLabels: draft.split("\n") });
        onClose();
      }}
    >
      <label className="block text-xs text-stone-500 dark:text-stone-400" htmlFor="outcome-choices">
        Outcome choices, one per line (up to 8)
      </label>
      <textarea
        id="outcome-choices"
        rows={5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="field"
      />
      <div className="flex justify-end gap-1">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Save choices
        </button>
      </div>
    </form>
  );
}

/** Outcome editor for a finished task in the detail panel. */
export function OutcomeField({ item }: { item: Item }) {
  const setOutcome = useWorkspace((s) => s.setOutcome);
  const [editing, setEditing] = useState(false);
  const label = item.outcome?.label ?? null;
  if (editing) return <EditChoices onClose={() => setEditing(false)} />;
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-1">
        <OutcomeChoices value={label} onPick={(l) => setOutcome(item.id, l, item.outcome?.note)} />
        <button
          type="button"
          className="btn btn-ghost ml-auto px-1.5 py-1"
          aria-label="Edit outcome choices"
          title="Edit outcome choices"
          onClick={() => setEditing(true)}
        >
          <Settings2 size={14} />
        </button>
      </div>
      {label && (
        <input
          key={item.outcome?.note}
          defaultValue={item.outcome?.note ?? ""}
          maxLength={MAX_OUTCOME_NOTE}
          onBlur={(e) => {
            if (e.target.value !== (item.outcome?.note ?? ""))
              setOutcome(item.id, label, e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder="One line about how it went (optional)"
          aria-label="Outcome note"
          className="field"
        />
      )}
    </div>
  );
}

/** Small card shown after completing a task, asking how it went. Entirely optional. */
export function OutcomePrompt() {
  const id = useUi((s) => s.outcomePromptId);
  const promptOutcome = useUi((s) => s.promptOutcome);
  const item = useWorkspace((s) => s.items.find((i) => i.id === id));
  const setOutcome = useWorkspace((s) => s.setOutcome);
  const [label, setLabel] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [shownFor, setShownFor] = useState<string | null>(null);

  if (id !== shownFor) {
    setShownFor(id);
    setLabel(null);
    setNote("");
  }
  if (!item || item.status !== "done") return null;

  const close = () => promptOutcome(null);
  return (
    <div
      role="dialog"
      aria-label="How did it go?"
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl border border-stone-200 bg-white p-4 shadow-lift sm:inset-x-auto sm:right-5 sm:bottom-5 dark:border-stone-700 dark:bg-stone-900"
    >
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">How did it go?</p>
          <p className="truncate text-xs text-stone-500 dark:text-stone-400">{item.title}</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost -mr-2 -mt-1 px-1.5"
          aria-label="Skip"
          onClick={close}
        >
          <X size={16} />
        </button>
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (label) setOutcome(item.id, label, note);
          close();
        }}
      >
        <OutcomeChoices value={label} onPick={setLabel} />
        {label && (
          <input
            autoFocus
            value={note}
            maxLength={MAX_OUTCOME_NOTE}
            onChange={(e) => setNote(e.target.value)}
            placeholder="One line about it (optional)"
            aria-label="Outcome note"
            className="field"
          />
        )}
        <div className="flex justify-end gap-1">
          <button type="button" className="btn btn-ghost" onClick={close}>
            Skip
          </button>
          <button type="submit" className="btn btn-primary" disabled={!label}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
