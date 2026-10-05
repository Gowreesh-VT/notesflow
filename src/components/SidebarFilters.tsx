"use client";

import { useMemo, useState } from "react";
import { Funnel, Pencil, Plus, X } from "lucide-react";
import { sortFilters } from "@/lib/filters";
import { archivedListIds, countInView, sameView } from "@/lib/items-logic";
import { useToday } from "@/lib/hooks";
import type { SavedFilter } from "@/lib/types";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { NavItem } from "./NavItem";
import dynamic from "next/dynamic";

const FilterEditor = dynamic(() => import("./FilterEditor").then((m) => m.FilterEditor));

/** The sidebar's "Filters" section: saved filters with their counts, plus create, edit and delete. */
export function SidebarFilters() {
  const items = useWorkspace((s) => s.items);
  const filters = useWorkspace((s) => s.filters);
  const lists = useWorkspace((s) => s.lists);
  const deleteFilter = useWorkspace((s) => s.deleteFilter);
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const today = useToday();
  const [editing, setEditing] = useState<SavedFilter | "new" | null>(null);

  const sorted = useMemo(() => sortFilters(filters), [filters]);
  const counts = useMemo(() => {
    const ctx = { filters, archived: archivedListIds(lists) };
    return new Map(
      filters.map((f) => [f.id, countInView(items, { kind: "filter", id: f.id }, today, ctx)]),
    );
  }, [items, filters, lists, today]);

  return (
    <>
      <div className="flex items-center justify-between px-2.5 pb-1 pt-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          Filters
        </h2>
        <button
          type="button"
          className="btn btn-ghost px-1.5 py-0.5"
          aria-label="New filter"
          title="New filter"
          onClick={() => setEditing("new")}
        >
          <Plus size={14} />
        </button>
      </div>

      {sorted.map((filter) => {
        const active = sameView(view, { kind: "filter", id: filter.id });
        const count = counts.get(filter.id) ?? 0;
        return (
          <div key={filter.id} className="group flex items-center">
            <NavItem
              icon={<Funnel size={16} />}
              label={filter.name}
              count={count}
              active={active}
              onClick={() => setView({ kind: "filter", id: filter.id })}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              className="btn btn-ghost px-1 py-0.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`Edit filter ${filter.name}`}
              onClick={() => setEditing(filter)}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              className="btn btn-ghost px-1 py-0.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`Delete filter ${filter.name}`}
              onClick={() => {
                if (window.confirm(`Delete the filter “${filter.name}”? No tasks are deleted.`)) {
                  deleteFilter(filter.id);
                  if (active) setView({ kind: "smart", id: "inbox" });
                }
              }}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}

      {filters.length === 0 && (
        <p className="px-2.5 py-1 text-xs text-stone-500 dark:text-stone-400">
          Save a filter to see matching tasks in one place.
        </p>
      )}

      {editing && (
        <FilterEditor
          filter={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
