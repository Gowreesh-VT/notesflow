"use client";

import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { ItemList } from "./ItemList";
import { NoteDetail } from "./NoteDetail";
import { TaskDetail } from "./TaskDetail";

// The list takes the full width; the detail panel only opens beside it when something is selected.
export function Workspace() {
  const items = useWorkspace((s) => s.items);
  const selectedItemId = useUi((s) => s.selectedItemId);
  const selected = items.find((i) => i.id === selectedItemId) ?? null;

  return (
    <div className="flex h-full">
      <div className={selected ? "hidden min-w-0 flex-1 md:block" : "min-w-0 flex-1"}>
        <ItemList />
      </div>
      {selected && (
        <section
          aria-label="Details"
          className="w-full min-w-0 overflow-hidden bg-stone-50 md:w-[24rem] md:shrink-0 md:border-l md:border-stone-200 lg:w-[30rem] xl:w-[34rem] dark:bg-stone-950 dark:md:border-stone-800"
        >
          {selected.kind === "task" ? (
            <TaskDetail key={selected.id} item={selected} />
          ) : (
            <NoteDetail key={selected.id} item={selected} />
          )}
        </section>
      )}
    </div>
  );
}
