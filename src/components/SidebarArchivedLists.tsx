"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, ChevronRight, Trash2 } from "lucide-react";
import clsx from "clsx";
import { archivedLists, sameView } from "@/lib/items-logic";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

/** Collapsible "Archived lists" section at the bottom of the sidebar, with open, restore and delete. */
export function SidebarArchivedLists() {
  const lists = useWorkspace((s) => s.lists);
  const setListArchived = useWorkspace((s) => s.setListArchived);
  const deleteList = useWorkspace((s) => s.deleteList);
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const [open, setOpen] = useState(false);

  const archived = archivedLists(lists);
  if (archived.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-sm text-stone-600 transition-colors hover:bg-stone-200/50 focus-visible:outline-2 focus-visible:outline-accent-500 dark:text-stone-300 dark:hover:bg-stone-900"
      >
        <Archive size={16} aria-hidden className="shrink-0 text-stone-500 dark:text-stone-400" />
        <span className="min-w-0 flex-1 truncate">Archived lists</span>
        <span className="text-xs tabular-nums text-stone-500 dark:text-stone-400">
          {archived.length}
        </span>
        <ChevronRight
          size={14}
          aria-hidden
          className={clsx(
            "shrink-0 text-stone-500 transition-transform dark:text-stone-400",
            open && "rotate-90",
          )}
        />
      </button>
      {open &&
        archived.map((list) => {
          const active = sameView(view, { kind: "list", id: list.id });
          return (
            <div key={list.id} className="group flex items-center">
              <button
                type="button"
                onClick={() => setView({ kind: "list", id: list.id })}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "min-w-0 flex-1 truncate rounded-lg py-[7px] pl-9 pr-2.5 text-left text-sm transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-accent-500",
                  active
                    ? "bg-stone-200/80 font-medium text-stone-900 dark:bg-stone-800 dark:text-stone-50"
                    : "text-stone-500 hover:bg-stone-200/50 dark:text-stone-400 dark:hover:bg-stone-900",
                )}
              >
                {list.name}
              </button>
              <button
                type="button"
                className="btn btn-ghost px-1 py-0.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`Restore list ${list.name}`}
                title="Restore"
                onClick={() => setListArchived(list.id, false)}
              >
                <ArchiveRestore size={13} />
              </button>
              <button
                type="button"
                className="btn btn-ghost px-1 py-0.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`Delete list ${list.name}`}
                title="Delete"
                onClick={() => {
                  if (
                    window.confirm(`Delete the list “${list.name}”? Its items move to the Inbox.`)
                  ) {
                    deleteList(list.id);
                    if (active) setView({ kind: "smart", id: "inbox" });
                  }
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
    </div>
  );
}
