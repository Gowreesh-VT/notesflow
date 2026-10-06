"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Copy,
  CopyPlus,
  Download,
  ListChecks,
  Pin,
  PinOff,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import { exportNoteMarkdown } from "@/lib/data-actions";
import { viewTitle } from "@/lib/items-logic";
import type { EditorMode, Item } from "@/lib/types";
import { displayTitle, readingMinutes, wordCount } from "@/lib/utils";
import { setPreferences, usePreferences } from "@/store/preferences";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { CopyToListForm } from "./CopyToList";
import { ListSelect } from "./ListSelect";
import { MarkdownEditor, ModeSwitch } from "./MarkdownEditor";
import { Popover } from "./Popover";
import { TitleField } from "./TitleField";

export function NoteDetail({ item }: { item: Item }) {
  const { editorMode } = usePreferences();
  const setEditorMode = (mode: EditorMode) => setPreferences({ editorMode: mode });
  const selectItem = useUi((s) => s.selectItem);
  const {
    updateItem,
    togglePin,
    trashItem,
    restoreItem,
    deleteForever,
    duplicateItem,
    checklistToTasks,
  } = useWorkspace.getState();

  const [notice, setNotice] = useState("");
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

      <div className="flex items-start gap-2 px-4 pb-1 pt-4">
        <button
          type="button"
          className="btn btn-ghost -ml-1 mt-0.5 px-2"
          aria-label="Close details"
          onClick={() => selectItem(null)}
        >
          <ArrowLeft size={18} className="md:hidden" />
          <X size={18} className="hidden md:block" />
        </button>
        <TitleField
          value={item.title}
          label="Note title"
          placeholder="Untitled note"
          readOnly={trashed}
          onChange={(title) => updateItem(item.id, { title })}
        />
      </div>

      {!trashed && (
        <div className="flex flex-wrap items-center gap-1 px-4 pb-2 text-sm">
          <ListSelect
            label="List"
            value={item.listId}
            onChange={(listId) => updateItem(item.id, { listId })}
            className="field w-auto max-w-44 py-1"
          />
          <div className="ml-auto flex items-center">
            {iconButton(
              item.pinned ? "Unpin note" : "Pin note",
              item.pinned ? <PinOff size={17} /> : <Pin size={17} />,
              () => togglePin(item.id),
            )}
            {iconButton("Duplicate note", <Copy size={17} />, () => {
              const id = duplicateItem(item.id);
              if (id) selectItem(id);
            })}
            {iconButton("Create tasks from checklist", <ListChecks size={17} />, () => {
              const created = checklistToTasks(item.id).length;
              const listName = viewTitle(
                { kind: "list", id: item.listId },
                useWorkspace.getState().lists,
              );
              setNotice(
                created
                  ? `Created ${created} task${created === 1 ? "" : "s"} in ${listName} and checked them off here.`
                  : "No unchecked checklist items (- [ ] …) in this note.",
              );
            })}
            {iconButton("Export as Markdown", <Download size={17} />, () =>
              exportNoteMarkdown(item, displayTitle(item)),
            )}
            <Popover
              label="Copy to list"
              iconOnly
              align="right"
              triggerClassName="btn btn-ghost px-2"
              trigger={<CopyPlus size={17} aria-hidden />}
              panelClassName="w-72"
            >
              {(close) => (
                <CopyToListForm
                  item={item}
                  onCancel={close}
                  onCopied={(_, listName) => {
                    close();
                    setNotice(`Copied to ${listName}.`);
                  }}
                />
              )}
            </Popover>
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
          <p
            role="status"
            aria-live="polite"
            className="w-full text-xs text-accent-700 empty:hidden dark:text-accent-300"
          >
            {notice}
          </p>
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
