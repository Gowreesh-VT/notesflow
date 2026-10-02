"use client";

import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { ItemList } from "./ItemList";
import { NoteDetail } from "./NoteDetail";
import { TaskDetail } from "./TaskDetail";

export function Workspace() {
  const items = useWorkspace((s) => s.items);
  const selectedItemId = useUi((s) => s.selectedItemId);
  const selected = items.find((i) => i.id === selectedItemId) ?? null;

  return (
    <div className="flex h-full">
      <div
        className={
          selected
            ? "hidden w-full md:block md:w-80 md:shrink-0 xl:w-96"
            : "w-full md:w-80 md:shrink-0 xl:w-96"
        }
      >
        <ItemList />
      </div>
      <section
        aria-label="Details"
        className={
          (selected ? "min-w-0 flex-1" : "hidden min-w-0 flex-1 md:block") +
          " overflow-hidden bg-white dark:bg-stone-900 md:m-3 md:ml-0 md:rounded-2xl md:border md:border-stone-200 md:shadow-soft dark:md:border-stone-800"
        }
      >
        {selected ? (
          selected.kind === "task" ? (
            <TaskDetail key={selected.id} item={selected} />
          ) : (
            <NoteDetail key={selected.id} item={selected} />
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-stone-500 dark:text-stone-400">
            <p className="heading-display text-xl text-stone-700 dark:text-stone-200">
              Nothing selected
            </p>
            <p className="max-w-xs text-sm">
              Pick a task or note to see its details, or press Alt+T to add a task.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
