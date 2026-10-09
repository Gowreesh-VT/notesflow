"use client";

import { useMemo, useState } from "react";
import { LayoutTemplate, X } from "lucide-react";
import { formatDuration } from "@/lib/duration";
import { listTemplates } from "@/lib/items-logic";
import { countSubtasks } from "@/lib/subtasks";
import { displayTitle } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { askConfirm } from "@/store/dialog";

/** Quick-add menu for creating a task from a saved template, and for removing templates. */
export function TemplatesMenu({ listId, due }: { listId: string; due: string | null }) {
  const items = useWorkspace((s) => s.items);
  const createFromTemplate = useWorkspace((s) => s.createFromTemplate);
  const deleteTemplate = useWorkspace((s) => s.deleteTemplate);
  const selectItem = useUi((s) => s.selectItem);
  const [open, setOpen] = useState(false);
  const templates = useMemo(() => listTemplates(items), [items]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="flex items-center rounded-md p-1 text-stone-500 hover:bg-stone-200/70 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-accent-500 dark:text-stone-400 dark:hover:bg-stone-700 dark:hover:text-stone-100"
        aria-label="Create from a template"
        title="Templates"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <LayoutTemplate size={16} />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close templates"
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            aria-label="Templates"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-stone-200 bg-white p-1 shadow-lift dark:border-stone-700 dark:bg-stone-900"
          >
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              New task from template
            </p>
            {templates.length === 0 ? (
              <p className="px-2.5 pb-2 text-sm text-stone-500 dark:text-stone-400">
                No templates yet. Open a task and choose “Save as template”.
              </p>
            ) : (
              templates.map((t) => {
                const subtasks = countSubtasks(t.subtasks).total;
                const meta = [
                  subtasks ? `${subtasks} subtask${subtasks === 1 ? "" : "s"}` : "",
                  t.estimate ? formatDuration(t.estimate) : "",
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div
                    key={t.id}
                    className="group flex items-center rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="min-w-0 flex-1 px-2.5 py-1.5 text-left"
                      onClick={() => {
                        const id = createFromTemplate(t.id, listId, due);
                        setOpen(false);
                        if (id) selectItem(id);
                      }}
                    >
                      <span className="block truncate text-sm text-stone-800 dark:text-stone-100">
                        {displayTitle(t)}
                      </span>
                      {meta && (
                        <span className="block text-xs text-stone-500 dark:text-stone-400">
                          {meta}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="mr-1 rounded-md p-1 text-stone-500 opacity-0 hover:bg-stone-200 hover:text-stone-700 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-stone-700 dark:hover:text-stone-200 dark:text-stone-400"
                      aria-label={`Delete template ${displayTitle(t)}`}
                      onClick={async () => {
                        const ok = await askConfirm({
                          title: `Delete the template “${displayTitle(t)}”?`,
                          confirmLabel: "Delete",
                          danger: true,
                        });
                        if (ok) deleteTemplate(t.id);
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
