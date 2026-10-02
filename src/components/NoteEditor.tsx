"use client";

import { useRef } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Bold,
  CheckSquare,
  Code,
  Code2,
  Copy,
  Download,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pin,
  PinOff,
  Quote,
  RotateCcw,
  Strikethrough,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { exportNoteMarkdown } from "@/lib/data-actions";
import {
  applyFormat,
  continueList,
  toggleTaskLine,
  type FormatKind,
  type FormatResult,
} from "@/lib/markdown-format";
import type { Note } from "@/lib/types";
import { displayTitle, readingMinutes, wordCount } from "@/lib/utils";
import { useNotes } from "@/store/notes";
import { useUi, type EditorMode } from "@/store/ui";
import { MarkdownPreview } from "./MarkdownPreview";

const TOOLS: { kind: FormatKind; label: string; icon: React.ReactNode }[] = [
  { kind: "bold", label: "Bold (Ctrl+B)", icon: <Bold size={16} /> },
  { kind: "italic", label: "Italic (Ctrl+I)", icon: <Italic size={16} /> },
  { kind: "strike", label: "Strikethrough", icon: <Strikethrough size={16} /> },
  { kind: "h1", label: "Heading 1", icon: <Heading1 size={16} /> },
  { kind: "h2", label: "Heading 2", icon: <Heading2 size={16} /> },
  { kind: "ul", label: "Bulleted list", icon: <List size={16} /> },
  { kind: "ol", label: "Numbered list", icon: <ListOrdered size={16} /> },
  { kind: "checklist", label: "Checklist", icon: <CheckSquare size={16} /> },
  { kind: "quote", label: "Quote", icon: <Quote size={16} /> },
  { kind: "code", label: "Inline code", icon: <Code size={16} /> },
  { kind: "codeblock", label: "Code block", icon: <Code2 size={16} /> },
  { kind: "link", label: "Link", icon: <LinkIcon size={16} /> },
];

const MODES: { value: EditorMode; label: string }[] = [
  { value: "edit", label: "Edit" },
  { value: "split", label: "Split" },
  { value: "preview", label: "Preview" },
];

export function NoteEditor({ note }: { note: Note }) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const editorMode = useUi((s) => s.editorMode);
  const setEditorMode = useUi((s) => s.setEditorMode);
  const selectNote = useUi((s) => s.selectNote);
  const {
    updateNote,
    togglePin,
    setArchived,
    trashNote,
    restoreNote,
    deleteForever,
    duplicateNote,
  } = useNotes.getState();

  const trashed = note.deletedAt !== null;
  const mode: EditorMode = trashed ? "preview" : editorMode;

  const apply = (el: HTMLTextAreaElement, result: FormatResult) => {
    updateNote(note.id, { body: result.value });
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  const format = (kind: FormatKind) => {
    const el = textarea.current;
    if (!el) return;
    apply(el, applyFormat(note.body, el.selectionStart, el.selectionEnd, kind));
  };

  const toggleTask = (line: number) => {
    const body = toggleTaskLine(note.body, line);
    if (body !== null) updateNote(note.id, { body });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !(event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) &&
      !event.nativeEvent.isComposing
    ) {
      const el = event.currentTarget;
      const result = continueList(note.body, el.selectionStart, el.selectionEnd);
      if (result) {
        event.preventDefault();
        apply(el, result);
      }
      return;
    }
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      format("bold");
    } else if (key === "i") {
      event.preventDefault();
      format("italic");
    }
  };

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
            <button type="button" className="btn btn-ghost" onClick={() => restoreNote(note.id)}>
              <RotateCcw size={15} aria-hidden /> Restore
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm(`Permanently delete “${displayTitle(note)}”?`)) {
                  selectNote(null);
                  deleteForever(note.id);
                }
              }}
            >
              Delete forever
            </button>
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-stone-200 px-3 py-2 dark:border-stone-800">
        <button
          type="button"
          className="btn btn-ghost px-2 md:hidden"
          aria-label="Back to notes"
          onClick={() => selectNote(null)}
        >
          <ArrowLeft size={18} />
        </button>
        <input
          value={note.title}
          onChange={(e) => updateNote(note.id, { title: e.target.value })}
          placeholder="Untitled note"
          aria-label="Note title"
          readOnly={trashed}
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-stone-400"
        />
        {!trashed && (
          <div className="flex shrink-0 items-center">
            {iconButton(
              note.pinned ? "Unpin note" : "Pin note",
              note.pinned ? <PinOff size={17} /> : <Pin size={17} />,
              () => togglePin(note.id),
            )}
            {iconButton(
              note.archived ? "Unarchive note" : "Archive note",
              note.archived ? <ArchiveRestore size={17} /> : <Archive size={17} />,
              () => setArchived(note.id, !note.archived),
            )}
            {iconButton("Duplicate note", <Copy size={17} />, () => {
              const id = duplicateNote(note.id);
              if (id) selectNote(id);
            })}
            {iconButton("Export as Markdown", <Download size={17} />, () =>
              exportNoteMarkdown(note, displayTitle(note)),
            )}
            {iconButton(
              "Move to trash",
              <Trash2 size={17} />,
              () => {
                trashNote(note.id);
                selectNote(null);
              },
              true,
            )}
          </div>
        )}
      </div>

      {!trashed && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-3 py-1.5 dark:border-stone-800">
          <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center">
            {TOOLS.map((tool) => (
              <button
                key={tool.kind}
                type="button"
                className="btn btn-ghost px-1.5 py-1"
                aria-label={tool.label}
                title={tool.label}
                disabled={mode === "preview"}
                onClick={() => format(tool.kind)}
              >
                {tool.icon}
              </button>
            ))}
          </div>
          <div
            role="radiogroup"
            aria-label="Editor view"
            className="flex rounded-lg bg-stone-200/70 p-0.5 dark:bg-stone-800"
          >
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={editorMode === m.value}
                onClick={() => setEditorMode(m.value)}
                className={clsx(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  m.value === "split" && "hidden lg:block",
                  editorMode === m.value
                    ? "bg-white shadow-sm dark:bg-stone-700"
                    : "text-stone-600 dark:text-stone-300",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {mode !== "preview" && (
          <textarea
            ref={textarea}
            value={note.body}
            onChange={(e) => updateNote(note.id, { body: e.target.value })}
            onKeyDown={onKeyDown}
            placeholder="Write in Markdown. Use #tags to organise."
            aria-label="Note content"
            spellCheck
            className={clsx(
              "resize-none bg-transparent p-4 font-mono text-sm leading-relaxed outline-none",
              mode === "split" ? "w-1/2 border-r border-stone-200 dark:border-stone-800" : "w-full",
              mode === "split" && editorMode === "split" && "max-lg:w-full max-lg:border-r-0",
            )}
          />
        )}
        {(mode === "preview" || mode === "split") && (
          <div
            className={clsx(
              "overflow-y-auto p-4",
              mode === "split" ? "w-1/2 max-lg:hidden" : "w-full",
            )}
          >
            <MarkdownPreview source={note.body} onToggleTask={trashed ? undefined : toggleTask} />
          </div>
        )}
      </div>

      <footer className="flex gap-4 border-t border-stone-200 px-4 py-1.5 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
        <span>{wordCount(note.body)} words</span>
        <span>{note.body.length} characters</span>
        <span>{readingMinutes(note.body)} min read</span>
        <span className="ml-auto">Saved automatically</span>
      </footer>
    </div>
  );
}
