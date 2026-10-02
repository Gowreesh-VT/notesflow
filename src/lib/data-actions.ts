import { createBackup, parseBackup } from "./backup";
import { downloadFile, slugify, toDateKey } from "./utils";
import { useNotes } from "@/store/notes";
import { useTasks } from "@/store/tasks";

export function exportBackup(): string {
  const backup = createBackup(useNotes.getState().notes, useTasks.getState().tasks);
  downloadFile(
    `notesflow-backup-${toDateKey(new Date())}.json`,
    JSON.stringify(backup, null, 2),
    "application/json",
  );
  return `Exported ${backup.notes.length} notes and ${backup.tasks.length} tasks.`;
}

export async function importBackupFile(file: File): Promise<string> {
  const { notes, tasks } = parseBackup(await file.text());
  const addedNotes = useNotes.getState().mergeNotes(notes);
  const addedTasks = useTasks.getState().mergeTasks(tasks);
  return `Imported ${addedNotes} new notes and ${addedTasks} new tasks.`;
}

export async function importMarkdownFiles(files: File[]): Promise<string> {
  let count = 0;
  for (const file of files) {
    const title = file.name.replace(/\.(md|markdown|txt)$/i, "");
    useNotes.getState().createNote({ title, body: await file.text() });
    count += 1;
  }
  return `Imported ${count} markdown ${count === 1 ? "file" : "files"}.`;
}

export function exportNoteMarkdown(note: { title: string; body: string }, name: string): void {
  const heading = note.title.trim() ? `# ${note.title.trim()}\n\n` : "";
  downloadFile(`${slugify(name)}.md`, heading + note.body, "text/markdown");
}
