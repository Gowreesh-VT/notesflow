"use client";

import { ArrowLeft, Copy, Download, Pin, PinOff, RotateCcw, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { exportNoteMarkdown } from "@/lib/data-actions";
import type { Item } from "@/lib/types";
import { displayTitle, readingMinutes, wordCount } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { ListSelect } from "./ListSelect";
import { MarkdownEditor, ModeSwitch } from "./MarkdownEditor";

export function NoteDetail({ item }: { item: Item }) {
  const editorMode = useUi((s) => s.editorMode);
  const setEditorMode = useUi((s) => s.setEditorMode);
  const selectItem = useUi((s) => s.selectItem);
  const { updateItem, togglePin, trashItem, restoreItem, deleteForever, duplicateItem } =
    useWorkspace.getState();

  const trashed = item.deletedAt !== null;

  const iconButton = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    danger = false,
  ) => (
    <button
      type="button"
      className={clsx("btn px-2", danger ? "btn-danger" : "btn-ghost")}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      {trashed && (
        <div className="flex items-center justify-between gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span>This note is in the trash.</span>
          <span className="flex gap-1">
            <button type="button" className="btn btn-ghost" onClick={() => restoreItem(item.id)}>
              <RotateCcw size={15} aria-hidden /> Restore
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm(`Permanently delete “${displayTitle(item)}”?`)) {
                  selectItem(null);
                  deleteForever(item.id);
                }
              }}
            >
              Delete forever
            </button>
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="btn btn-ghost px-2"
          aria-label="Close details"
          onClick={() => selectItem(null)}
        >
          <ArrowLeft size={18} className="md:hidden" />
          <X size={18} className="hidden md:block" />
        </button>
        <input
          value={item.title}
          onChange={(e) => updateItem(item.id, { title: e.target.value })}
          placeholder="Untitled note"
          aria-label="Note title"
          readOnly={trashed}
          className="heading-display min-w-0 flex-1 bg-transparent text-2xl font-semibold outline-none placeholder:text-stone-400"
        />
        {!trashed && (
          <div className="flex shrink-0 items-center">
            {iconButton(
              item.pinned ? "Unpin note" : "Pin note",
              item.pinned ? <PinOff size={17} /> : <Pin size={17} />,
              () => togglePin(item.id),
            )}
            {iconButton("Duplicate note", <Copy size={17} />, () => {
              const id = duplicateItem(item.id);
              if (id) selectItem(id);
            })}
            {iconButton("Export as Markdown", <Download size={17} />, () =>
              exportNoteMarkdown(item, displayTitle(item)),
            )}
            {iconButton(
              "Move to trash",
              <Trash2 size={17} />,
              () => {
                trashItem(item.id);
                selectItem(null);
              },
              true,
            )}
          </div>
        )}
      </div>

      {!trashed && (
        <div className="flex items-center gap-2 px-3 pb-2 text-sm text-stone-500 dark:text-stone-400">
          <span>List</span>
          <ListSelect
            value={item.listId}
            onChange={(listId) => updateItem(item.id, { listId })}
            className="field w-auto py-1"
          />
        </div>
      )}

      <MarkdownEditor
        label="Note content"
        value={item.body}
        onChange={(body) => updateItem(item.id, { body })}
        mode={editorMode}
        readOnly={trashed}
        className="flex-1"
        toolbarRight={<ModeSwitch mode={editorMode} onChange={setEditorMode} />}
      />

      <footer className="flex gap-4 border-t border-stone-200 px-4 py-1.5 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
        <span>{wordCount(item.body)} words</span>
        <span>{item.body.length} characters</span>
        <span>{readingMinutes(item.body)} min read</span>
        <span className="ml-auto">Saved automatically</span>
      </footer>
    </div>
  );
}
