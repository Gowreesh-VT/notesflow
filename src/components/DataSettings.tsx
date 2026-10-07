"use client";

import { useRef, useState } from "react";
import { CalendarDays, FileJson, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { exportAs, exportBackup, importMarkdownFiles, importTasksFile } from "@/lib/data-actions";
import { SettingsSection } from "./SettingsView";

/** Export of the whole workspace, and import from backups and other apps. */
export function DataSettings() {
  const [status, setStatus] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [notesStatus, setNotesStatus] = useState("");
  const markdownInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const run = async (action: () => string | Promise<string>) => {
    try {
      setStatus(await action());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Something went wrong.");
    }
  };
  const exports = [
    {
      label: "Backup (JSON)",
      hint: "Everything, to restore into Notesflow",
      icon: FileJson,
      run: exportBackup,
    },
    {
      label: "Spreadsheet (CSV)",
      hint: "Tasks and notes, one per row",
      icon: FileSpreadsheet,
      run: () => exportAs("csv"),
    },
    {
      label: "Markdown",
      hint: "One readable document, list by list",
      icon: FileText,
      run: () => exportAs("markdown"),
    },
    {
      label: "Calendar (iCal)",
      hint: "Open tasks with due dates as events",
      icon: CalendarDays,
      run: () => exportAs("ical"),
    },
  ];

  return (
    <>
      <SettingsSection
        title="Export"
        description="Download your tasks and notes. Trashed items and templates are left out."
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {exports.map((e) => (
            <li key={e.label}>
              <button
                type="button"
                onClick={() => void run(e.run)}
                className="flex w-full items-start gap-3 rounded-xl border border-stone-200 px-3 py-2.5 text-left transition-colors hover:border-accent-300 hover:bg-accent-50/50 focus-visible:outline-2 focus-visible:outline-accent-500 dark:border-stone-700 dark:hover:border-accent-700 dark:hover:bg-accent-950/30"
              >
                <e.icon
                  size={18}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-accent-600 dark:text-accent-400"
                />
                <span>
                  <span className="block text-sm font-medium">{e.label}</span>
                  <span className="block text-xs text-stone-500 dark:text-stone-400">{e.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p
          role="status"
          aria-live="polite"
          className="min-h-4 text-xs text-stone-500 dark:text-stone-400"
        >
          {status}
        </p>
      </SettingsSection>
      <SettingsSection
        title="Import"
        description="Bring in tasks from a TickTick backup (CSV), a Todoist project (CSV), a JSON task list, any CSV with a title column, or a Notesflow backup. Imported items are added; nothing is replaced."
      >
        <button
          type="button"
          className="btn btn-ghost border border-stone-200 dark:border-stone-700"
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={15} aria-hidden /> Choose a file to import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="hidden"
          aria-label="File to import"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setImportStatus("Importing…");
            try {
              setImportStatus(await importTasksFile(file));
            } catch (error) {
              setImportStatus(
                error instanceof Error ? error.message : "That file could not be imported.",
              );
            }
          }}
        />
        <p
          role="status"
          aria-live="polite"
          className="min-h-4 text-xs text-stone-500 dark:text-stone-400"
        >
          {importStatus}
        </p>
      </SettingsSection>
      <SettingsSection
        title="Import notes"
        description="Add Markdown or plain-text files as notes in the Inbox, one note per file, named after the file."
      >
        <button
          type="button"
          className="btn btn-ghost border border-stone-200 dark:border-stone-700"
          onClick={() => markdownInput.current?.click()}
        >
          <FileText size={15} aria-hidden /> Choose .md or .txt files
        </button>
        <input
          ref={markdownInput}
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          multiple
          className="hidden"
          aria-label="Markdown files to import"
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (!files.length) return;
            try {
              setNotesStatus(await importMarkdownFiles(files));
            } catch (error) {
              setNotesStatus(
                error instanceof Error ? error.message : "Those files could not be imported.",
              );
            }
          }}
        />
        <p
          role="status"
          aria-live="polite"
          className="min-h-4 text-xs text-stone-500 dark:text-stone-400"
        >
          {notesStatus}
        </p>
      </SettingsSection>
    </>
  );
}
