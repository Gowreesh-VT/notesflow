import { createBackup, parseBackup } from "./backup";
import { downloadFile, slugify, toDateKey } from "./utils";
import { INBOX_ID } from "./types";
import { useWorkspace } from "@/store/workspace";

export function exportBackup(): string {
  const { items, lists, folders, filters, habits } = useWorkspace.getState();
  downloadFile(
    `notesflow-backup-${toDateKey(new Date())}.json`,
    JSON.stringify(createBackup({ items, lists, folders, filters, habits }), null, 2),
    "application/json",
  );
  const tasks = items.filter((i) => i.kind === "task").length;
  return `Exported ${items.length - tasks} notes and ${tasks} tasks.`;
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
