"use client";

import { useMemo, useRef, useState } from "react";
import {
  Archive,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  Download,
  FileText,
  Hash,
  Inbox,
  Monitor,
  Moon,
  Pin,
  Search,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import clsx from "clsx";
import { collectTags, countByFilter } from "@/lib/notes-logic";
import { countTasks } from "@/lib/tasks-logic";
import { exportBackup, importBackupFile, importMarkdownFiles } from "@/lib/data-actions";
import { useToday } from "@/lib/hooks";
import type { NoteFilter, TaskFilter } from "@/lib/types";
import { useNotes } from "@/store/notes";
import { useTasks } from "@/store/tasks";
import { useUi, type Theme } from "@/store/ui";

type NavItemProps = {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
};

function NavItem({ icon, label, count, active, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
        "focus-visible:outline-2 focus-visible:outline-indigo-500",
        active
          ? "bg-indigo-100 font-medium text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200"
          : "text-stone-600 hover:bg-stone-200/70 dark:text-stone-300 dark:hover:bg-stone-800",
      )}
    >
      <span aria-hidden className="shrink-0">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs tabular-nums text-stone-500 dark:text-stone-400">{count}</span>
      )}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-2.5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
      {children}
    </h2>
  );
}

const THEMES: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun size={16} /> },
  { value: "system", label: "System", icon: <Monitor size={16} /> },
  { value: "dark", label: "Dark", icon: <Moon size={16} /> },
];

function sameFilter(a: NoteFilter, b: NoteFilter): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === "tag" && b.kind === "tag" ? a.tag === b.tag : true;
}

export function Sidebar() {
  const notes = useNotes((s) => s.notes);
  const tasks = useTasks((s) => s.tasks);
  const { section, noteFilter, taskFilter, theme, sidebarOpen } = useUi();
  const setNoteFilter = useUi((s) => s.setNoteFilter);
  const setTaskFilter = useUi((s) => s.setTaskFilter);
  const setTheme = useUi((s) => s.setTheme);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const today = useToday();

  const noteCounts = useMemo(() => countByFilter(notes), [notes]);
  const taskCounts = useMemo(() => countTasks(tasks, today), [tasks, today]);
  const tags = useMemo(() => collectTags(notes), [notes]);

  const [status, setStatus] = useState("");
  const backupInput = useRef<HTMLInputElement>(null);
  const markdownInput = useRef<HTMLInputElement>(null);

  const run = async (action: () => Promise<string> | string) => {
    try {
      setStatus(await action());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Something went wrong.");
    }
  };

  const noteItem = (filter: NoteFilter, label: string, icon: React.ReactNode, count?: number) => (
    <NavItem
      icon={icon}
      label={label}
      count={count}
      active={section === "notes" && sameFilter(noteFilter, filter)}
      onClick={() => setNoteFilter(filter)}
    />
  );

  const taskItem = (filter: TaskFilter, label: string, icon: React.ReactNode, count?: number) => (
    <NavItem
      icon={icon}
      label={label}
      count={count}
      active={section === "tasks" && taskFilter === filter}
      onClick={() => setTaskFilter(filter)}
    />
  );

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        aria-label="Sidebar"
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-stone-200 bg-stone-100 transition-transform",
          "dark:border-stone-800 dark:bg-stone-900 md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <span className="text-lg font-semibold tracking-tight">Notesflow</span>
          <button
            type="button"
            className="btn btn-ghost md:hidden"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-3">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-500 hover:border-stone-400 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-400"
          >
            <Search size={15} aria-hidden />
            <span className="flex-1 text-left">Quick find…</span>
            <kbd className="rounded border border-stone-300 px-1 text-[10px] dark:border-stone-700">
              ⌘K
            </kbd>
          </button>
        </div>

        <nav aria-label="Workspace" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <SectionLabel>Notes</SectionLabel>
          {noteItem({ kind: "all" }, "All notes", <FileText size={16} />, noteCounts.all)}
          {noteItem({ kind: "pinned" }, "Pinned", <Pin size={16} />, noteCounts.pinned)}
          {noteItem({ kind: "archive" }, "Archive", <Archive size={16} />, noteCounts.archive)}
          {noteItem({ kind: "trash" }, "Trash", <Trash2 size={16} />, noteCounts.trash)}

          <SectionLabel>Tasks</SectionLabel>
          {taskItem("inbox", "Inbox", <Inbox size={16} />, taskCounts.inbox)}
          {taskItem("today", "Today", <CalendarDays size={16} />, taskCounts.today)}
          {taskItem("upcoming", "Upcoming", <CalendarClock size={16} />, taskCounts.upcoming)}
          {taskItem("completed", "Completed", <CheckCheck size={16} />, taskCounts.completed)}

          {tags.length > 0 && (
            <>
              <SectionLabel>Tags</SectionLabel>
              {tags.map(({ tag, count }) =>
                noteItem({ kind: "tag", tag }, tag, <Hash size={16} />, count),
              )}
            </>
          )}
        </nav>

        <div className="space-y-2 border-t border-stone-200 p-3 dark:border-stone-800">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={theme === t.value}
                aria-label={t.label}
                title={t.label}
                onClick={() => setTheme(t.value)}
                className={clsx(
                  "btn justify-center",
                  theme === t.value ? "bg-white shadow-sm dark:bg-stone-800" : "btn-ghost",
                )}
              >
                {t.icon}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              className="btn btn-ghost px-1 text-xs"
              onClick={() => run(exportBackup)}
            >
              <Download size={14} aria-hidden /> Backup
            </button>
            <button
              type="button"
              className="btn btn-ghost px-1 text-xs"
              onClick={() => backupInput.current?.click()}
            >
              <Upload size={14} aria-hidden /> Restore
            </button>
            <button
              type="button"
              className="btn btn-ghost px-1 text-xs"
              onClick={() => markdownInput.current?.click()}
            >
              <FileText size={14} aria-hidden /> Import .md
            </button>
          </div>
          <input
            ref={backupInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Restore backup file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void run(() => importBackupFile(file));
            }}
          />
          <input
            ref={markdownInput}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            multiple
            className="hidden"
            aria-label="Import markdown files"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              if (files.length) void run(() => importMarkdownFiles(files));
            }}
          />
          <p
            role="status"
            aria-live="polite"
            className="min-h-4 text-xs text-stone-500 dark:text-stone-400"
          >
            {status}
          </p>
        </div>
      </aside>
    </>
  );
}
