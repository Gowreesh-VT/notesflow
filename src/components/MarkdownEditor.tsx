"use client";

import { useRef } from "react";
import {
  Bold,
  CheckSquare,
  Code,
  Code2,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react";
import clsx from "clsx";
import {
  applyFormat,
  continueList,
  toggleTaskLine,
  type FormatKind,
  type FormatResult,
} from "@/lib/markdown-format";
import type { EditorMode } from "@/store/ui";
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

const MODE_LABELS: Record<EditorMode, string> = {
  edit: "Edit",
  split: "Split",
  preview: "Preview",
};

export function ModeSwitch({
  mode,
  onChange,
  modes = ["edit", "split", "preview"],
}: {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
  modes?: EditorMode[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Editor view"
      className="flex rounded-lg bg-stone-200/70 p-0.5 dark:bg-stone-800"
    >
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => onChange(m)}
          className={clsx(
            "rounded-md px-2.5 py-1 text-xs font-medium",
            m === "split" && "hidden xl:block",
            mode === m
              ? "bg-white shadow-sm dark:bg-stone-700"
              : "text-stone-600 dark:text-stone-300",
          )}
        >
          {MODE_LABELS[m]}
        </button>
      ))}
    </div>
  );
}

export function MarkdownEditor({
  value,
  onChange,
  mode,
  readOnly = false,
  placeholder = "Write in Markdown. Use #tags to organise.",
  label,
  toolbarRight,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  mode: EditorMode;
  readOnly?: boolean;
  placeholder?: string;
  label: string;
  toolbarRight?: React.ReactNode;
  className?: string;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const effective: EditorMode = readOnly ? "preview" : mode;

  const apply = (el: HTMLTextAreaElement, result: FormatResult) => {
    onChange(result.value);
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  const format = (kind: FormatKind) => {
    const el = textarea.current;
    if (!el) return;
    apply(el, applyFormat(value, el.selectionStart, el.selectionEnd, kind));
  };

  const toggleTask = (line: number) => {
    const next = toggleTaskLine(value, line);
    if (next !== null) onChange(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !(event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) &&
      !event.nativeEvent.isComposing
    ) {
      const el = event.currentTarget;
      const result = continueList(value, el.selectionStart, el.selectionEnd);
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

  return (
    <div className={clsx("flex min-h-0 flex-col", className)}>
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-stone-200 px-2 py-1.5 dark:border-stone-800">
          <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center">
            {TOOLS.map((tool) => (
              <button
                key={tool.kind}
                type="button"
                className="btn btn-ghost px-1.5 py-1"
                aria-label={tool.label}
                title={tool.label}
                disabled={effective === "preview"}
                onClick={() => format(tool.kind)}
              >
                {tool.icon}
              </button>
            ))}
          </div>
          {toolbarRight}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {effective !== "preview" && (
          <textarea
            ref={textarea}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label={label}
            spellCheck
            className={clsx(
              "resize-none bg-transparent p-4 font-mono text-sm leading-relaxed outline-none",
              effective === "split"
                ? "w-1/2 border-r border-stone-200 max-xl:w-full max-xl:border-r-0 dark:border-stone-800"
                : "w-full",
            )}
          />
        )}
        {(effective === "preview" || effective === "split") && (
          <div
            className={clsx(
              "overflow-y-auto p-4",
              effective === "split" ? "w-1/2 max-xl:hidden" : "w-full",
            )}
          >
            <MarkdownPreview source={value} onToggleTask={readOnly ? undefined : toggleTask} />
          </div>
        )}
      </div>
    </div>
  );
}
