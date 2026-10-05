"use client";

import { useState } from "react";
import { CalendarDays, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { exportAs, exportBackup } from "@/lib/data-actions";
import { SettingsSection } from "./SettingsView";

/** Export (and later import) of the whole workspace. */
export function DataSettings() {
  const [status, setStatus] = useState("");
  const run = (action: () => string) => {
    try {
      setStatus(action());
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
    <SettingsSection
      title="Export"
      description="Download your tasks and notes. Trashed items and templates are left out."
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {exports.map((e) => (
          <li key={e.label}>
            <button
              type="button"
              onClick={() => run(e.run)}
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
  );
}
