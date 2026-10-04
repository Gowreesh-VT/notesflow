"use client";

import { useState } from "react";
import { CopyPlus } from "lucide-react";
import { viewTitle } from "@/lib/items-logic";
import type { Item } from "@/lib/types";
import { useWorkspace } from "@/store/workspace";
import { ListSelect } from "./ListSelect";

/** Picks a list and copies the item into it; calls `onCopied` with the copy's id and the list name. */
export function CopyToListForm({
  item,
  onCopied,
  onCancel,
}: {
  item: Item;
  onCopied: (copyId: string, listName: string) => void;
  onCancel?: () => void;
}) {
  const copyItem = useWorkspace((s) => s.copyItem);
  const lists = useWorkspace((s) => s.lists);
  const [target, setTarget] = useState(item.listId);

  return (
    <form
      className="flex min-w-0 flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const id = copyItem(item.id, target);
        if (id) onCopied(id, viewTitle({ kind: "list", id: target }, lists));
      }}
    >
      <ListSelect
        label="Copy to list"
        value={target}
        onChange={setTarget}
        className="field w-auto min-w-0 flex-1 py-1"
      />
      <button type="submit" className="btn btn-primary px-2.5 py-1">
        Copy
      </button>
      {onCancel && (
        <button type="button" className="btn btn-ghost px-2.5 py-1" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}

/** "Copy to list" action for the detail panels: opens a small list picker, then reports where it copied. */
export function CopyToList({
  item,
  onCopied,
}: {
  item: Item;
  onCopied: (listName: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        <CopyPlus size={15} aria-hidden /> Copy to list
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl bg-stone-100 p-2 text-sm dark:bg-stone-900">
      <CopyToListForm
        item={item}
        onCancel={() => setOpen(false)}
        onCopied={(_, listName) => {
          setOpen(false);
          onCopied(listName);
        }}
      />
    </div>
  );
}
