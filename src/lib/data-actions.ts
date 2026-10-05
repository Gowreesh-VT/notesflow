import { createBackup, parseBackup } from "./backup";
import { toCsv, toICalendar, toMarkdown } from "./export";
import { downloadFile, slugify, toDateKey } from "./utils";
import { INBOX_ID } from "./types";
import { useWorkspace } from "@/store/workspace";

export function exportBackup(): string {
  const { items, lists, folders, filters, habits, countdowns, settings } = useWorkspace.getState();
  downloadFile(
    `notesflow-backup-${toDateKey(new Date())}.json`,
    JSON.stringify(
      createBackup({ items, lists, folders, filters, habits, countdowns, settings }),
      null,
      2,
    ),
    "application/json",
  );
  const tasks = items.filter((i) => i.kind === "task").length;
  return `Exported ${items.length - tasks} notes and ${tasks} tasks.`;
}

/** Exports tasks and notes as a spreadsheet, a Markdown document or calendar events. */
export function exportAs(format: "csv" | "markdown" | "ical"): string {
  const { items, lists } = useWorkspace.getState();
  const date = toDateKey(new Date());
  if (format === "csv") {
    downloadFile(`notesflow-${date}.csv`, toCsv(items, lists), "text/csv;charset=utf-8");
    return "Exported a spreadsheet (CSV).";
  }
  if (format === "markdown") {
    downloadFile(`notesflow-${date}.md`, toMarkdown(items, lists, date), "text/markdown");
    return "Exported a Markdown document.";
  }
  downloadFile(`notesflow-${date}.ics`, toICalendar(items, lists, Date.now()), "text/calendar");
  return "Exported open tasks with due dates as calendar events (.ics).";
}

export async function importBackupFile(file: File): Promise<string> {
  const added = useWorkspace.getState().mergeData(parseBackup(await file.text()));
  return `Imported ${added.items} new items and ${added.lists} new lists.`;
}

export async function importMarkdownFiles(files: File[], listId = INBOX_ID): Promise<string> {
  let count = 0;
  for (const file of files) {
    const title = file.name.replace(/\.(md|markdown|txt)$/i, "");
    useWorkspace.getState().addItem({ kind: "note", title, body: await file.text(), listId });
    count += 1;
  }
  return `Imported ${count} markdown ${count === 1 ? "file" : "files"}.`;
}

export function exportNoteMarkdown(note: { title: string; body: string }, name: string): void {
  const heading = note.title.trim() ? `# ${note.title.trim()}\n\n` : "";
  downloadFile(`${slugify(name)}.md`, heading + note.body, "text/markdown");
}
