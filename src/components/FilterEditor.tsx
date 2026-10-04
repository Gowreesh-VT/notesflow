"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";
import {
  EMPTY_CRITERIA,
  FILTER_DUE_OPTIONS,
  FILTER_KIND_OPTIONS,
  FILTER_PRIORITIES,
  FILTER_STATUS_OPTIONS,
} from "@/lib/filters";
import { collectTags, ENERGY_OPTIONS } from "@/lib/items-logic";
import {
  INBOX_ID,
  type FilterCriteria,
  type FilterDue,
  type FilterKind,
  type FilterStatus,
  type SavedFilter,
} from "@/lib/types";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={clsx(
        "rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-accent-500",
        pressed
          ? "border-accent-300 bg-accent-50 text-accent-800 dark:border-accent-700 dark:bg-accent-950 dark:text-accent-200"
          : "border-stone-200 text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800",
      )}
    >
      {children}
    </button>
  );
}

function ChipGroup({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

const toggle = <T,>(values: T[], value: T): T[] =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

/** Dialog to create (filter null) or edit a saved filter. */
export function FilterEditor({
  filter,
  onClose,
}: {
  filter: SavedFilter | null;
  onClose: () => void;
}) {
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const [name, setName] = useState(filter?.name ?? "");
  const [criteria, setCriteria] = useState<FilterCriteria>(filter?.criteria ?? EMPTY_CRITERIA);

  const tags = useMemo(
    () => [...new Set([...collectTags(items).map((t) => t.tag), ...criteria.tags])],
    [items, criteria.tags],
  );
  const listChoices = [{ id: INBOX_ID, name: "Inbox" }, ...lists];
  const update = (patch: Partial<FilterCriteria>) => setCriteria((c) => ({ ...c, ...patch }));

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const known = new Set(listChoices.map((l) => l.id));
    const next = { ...criteria, lists: criteria.lists.filter((id) => known.has(id)) };
    const workspace = useWorkspace.getState();
    if (filter) {
      workspace.updateFilter(filter.id, { name, criteria: next });
    } else {
      const id = workspace.addFilter(name, next);
      if (id) useUi.getState().setView({ kind: "filter", id });
    }
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]"
      onMouseDown={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-editor-title"
        onSubmit={save}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        className="w-full max-w-lg space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-lift dark:border-stone-700 dark:bg-stone-900"
      >
        <div className="flex items-center justify-between">
          <h2 id="filter-editor-title" className="heading-display text-xl font-semibold">
            {filter ? "Edit filter" : "New filter"}
          </h2>
          <button
            type="button"
            className="btn btn-ghost px-1.5"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="e.g. Urgent work this week"
            className="field"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Show</span>
            <select
              value={criteria.kind}
              onChange={(e) => update({ kind: e.target.value as FilterKind })}
              className="field"
            >
              {FILTER_KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Status</span>
            <select
              value={criteria.status}
              onChange={(e) => update({ status: e.target.value as FilterStatus })}
              className="field"
            >
              {FILTER_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ChipGroup legend="Lists">
          {listChoices.map((l) => (
            <Chip
              key={l.id}
              pressed={criteria.lists.includes(l.id)}
              onClick={() => update({ lists: toggle(criteria.lists, l.id) })}
            >
              {l.name}
            </Chip>
          ))}
        </ChipGroup>

        {tags.length > 0 && (
          <ChipGroup legend="Tags">
            {tags.map((tag) => (
              <Chip
                key={tag}
                pressed={criteria.tags.includes(tag)}
                onClick={() => update({ tags: toggle(criteria.tags, tag) })}
              >
                #{tag}
              </Chip>
            ))}
          </ChipGroup>
        )}

        <ChipGroup legend="Priority">
          {FILTER_PRIORITIES.map((p) => (
            <Chip
              key={p.value}
              pressed={criteria.priorities.includes(p.value)}
              onClick={() => update({ priorities: toggle(criteria.priorities, p.value) })}
            >
              {p.label}
            </Chip>
          ))}
        </ChipGroup>

        <ChipGroup legend="Energy">
          {ENERGY_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              pressed={criteria.energies.includes(o.value)}
              onClick={() => update({ energies: toggle(criteria.energies, o.value) })}
            >
              {o.label}
            </Chip>
          ))}
        </ChipGroup>

        <div className="space-y-1.5">
          <label htmlFor="filter-due" className="block text-sm font-semibold">
            Due
          </label>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              id="filter-due"
              value={criteria.due}
              onChange={(e) => update({ due: e.target.value as FilterDue })}
              className="field w-auto"
            >
              {FILTER_DUE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {criteria.due === "range" && (
              <>
                <input
                  type="date"
                  aria-label="Due from"
                  value={criteria.dueFrom ?? ""}
                  onChange={(e) => update({ dueFrom: e.target.value || null })}
                  className="field w-auto"
                />
                <span>to</span>
                <input
                  type="date"
                  aria-label="Due until"
                  value={criteria.dueTo ?? ""}
                  onChange={(e) => update({ dueTo: e.target.value || null })}
                  className="field w-auto"
                />
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400">
          Nothing chosen in a group means any. Priority, energy, due date and finished statuses only
          match tasks.
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            {filter ? "Save" : "Create filter"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
