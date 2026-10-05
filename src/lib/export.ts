import { itemTags } from "./items-logic";
import { INBOX_ID, type Item, type Repeat, type Subtask, type TaskList } from "./types";
import { addDays, displayTitle } from "./utils";

/** Items worth exporting: everything except trashed items and templates. */
const exportable = (items: Item[]) => items.filter((i) => i.deletedAt === null && !i.template);

const listNamer = (lists: TaskList[]) => {
  const names = new Map(lists.map((l) => [l.id, l.name]));
  return (id: string) => (id === INBOX_ID ? "Inbox" : (names.get(id) ?? "Inbox"));
};

const isoDate = (ms: number | null) => (ms ? new Date(ms).toISOString() : "");

/** One CSV cell. Text that a spreadsheet would run as a formula is prefixed with an apostrophe. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const CSV_COLUMNS = [
  "Type",
  "Title",
  "List",
  "Status",
  "Priority",
  "Due date",
  "Due time",
  "Start date",
  "Estimate (minutes)",
  "Tags",
  "Subtasks",
  "Created",
  "Completed",
  "Content",
] as const;

const flatSubtasks = (subtasks: Subtask[], depth = 0): string[] =>
  subtasks.flatMap((s) => [
    `${"  ".repeat(depth)}[${s.done ? "x" : " "}] ${s.title}`,
    ...flatSubtasks(s.children ?? [], depth + 1),
  ]);

/** Tasks and notes as a spreadsheet (one row each), opening cleanly in Excel, Numbers or Google Sheets. */
export function toCsv(items: Item[], lists: TaskList[]): string {
  const listName = listNamer(lists);
  const rows = exportable(items).map((i) => [
    i.kind,
    i.title,
    listName(i.listId),
    i.kind === "task" ? i.status : "",
    i.kind === "task" ? i.priority : "",
    i.due ?? "",
    i.dueTime ?? "",
    i.startDate ?? "",
    i.estimate ?? "",
    itemTags(i).join(" "),
    flatSubtasks(i.subtasks).join("\n"),
    isoDate(i.createdAt),
    isoDate(i.completedAt),
    i.body,
  ]);
  // A byte order mark makes Excel read the file as UTF-8.
  return "\uFEFF" + [CSV_COLUMNS, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

const PRIORITY_MARK = { none: "", low: " !low", medium: " !medium", high: " !high" } as const;

const markdownSubtasks = (subtasks: Subtask[], depth: number): string[] =>
  subtasks.flatMap((s) => [
    `${"  ".repeat(depth)}- [${s.done ? "x" : " "}] ${s.title}`,
    ...markdownSubtasks(s.children ?? [], depth + 1),
  ]);

/** The whole workspace as one Markdown document: a section per list with its tasks (as checklists) and notes. */
export function toMarkdown(items: Item[], lists: TaskList[], exportedOn: string): string {
  const listName = listNamer(lists);
  const kept = exportable(items);
  const listIds = [INBOX_ID, ...lists.filter((l) => l.id !== INBOX_ID).map((l) => l.id)];
  const out = [`# Notesflow export`, "", `Exported ${exportedOn}.`];
  for (const listId of listIds) {
    const inList = kept.filter(
      (i) => (listIds.includes(i.listId) ? i.listId : INBOX_ID) === listId,
    );
    if (!inList.length) continue;
    out.push("", `## ${listName(listId)}`);
    const tasks = inList.filter((i) => i.kind === "task");
    if (tasks.length) out.push("");
    for (const t of tasks) {
      const box = t.status === "done" ? "x" : " ";
      const due = t.due ? ` (due ${t.due}${t.dueTime ? ` ${t.dueTime}` : ""})` : "";
      const skipped = t.status === "wontdo" ? " — won’t do" : "";
      out.push(`- [${box}] ${t.title || "Untitled"}${due}${PRIORITY_MARK[t.priority]}${skipped}`);
      out.push(...markdownSubtasks(t.subtasks, 1));
      if (t.body.trim())
        out.push(
          ...t.body
            .trim()
            .split("\n")
            .map((line) => `  > ${line}`),
        );
    }
    for (const n of inList.filter((i) => i.kind === "note")) {
      out.push("", `### ${displayTitle(n)}`, "", n.body.trim());
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

/** Escapes text for an iCalendar property value. */
const icsText = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Folds lines longer than 75 octets, as RFC 5545 requires. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length;
    if (size + charSize > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += charSize;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compactDate = (day: string) => day.replace(/-/g, "");
const utcStamp = (ms: number) =>
  new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

const RRULE_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function rrule(repeat: Repeat): string | null {
  if (repeat.afterCompletion) return null; // depends on when it is done; no calendar rule fits
  const freq = { day: "DAILY", week: "WEEKLY", month: "MONTHLY", year: "YEARLY" }[repeat.unit];
  const days =
    repeat.unit === "week" && repeat.weekdays?.length
      ? `;BYDAY=${[...repeat.weekdays]
          .sort()
          .map((d) => RRULE_DAYS[d])
          .join(",")}`
      : "";
  return `RRULE:FREQ=${freq};INTERVAL=${repeat.every}${days}`;
}

/**
 * Open tasks with a due date as calendar events (an .ics file for Google Calendar, Apple Calendar or Outlook).
 * Timed tasks last their estimate (30 minutes when none) in local time; others are all-day, spanning from their
 * start date when they have one.
 */
export function toICalendar(items: Item[], lists: TaskList[], now: number): string {
  const listName = listNamer(lists);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Notesflow//Tasks//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Notesflow tasks",
  ];
  for (const t of exportable(items)) {
    if (t.kind !== "task" || t.status !== "open" || !t.due) continue;
    lines.push("BEGIN:VEVENT", `UID:${t.id}@notesflow`, `DTSTAMP:${utcStamp(now)}`);
    if (t.dueTime) {
      const [h, m] = t.dueTime.split(":").map(Number);
      const start = new Date(2000, 0, 1, h, m);
      const end = new Date(start.getTime() + (t.estimate || 30) * 60_000);
      const endDay = end.getDate() === 1 ? t.due : addDays(t.due, 1);
      const clock = (d: Date) =>
        `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
      lines.push(
        `DTSTART:${compactDate(t.due)}T${clock(start)}`,
        `DTEND:${compactDate(endDay)}T${clock(end)}`,
      );
    } else {
      const first = t.startDate && t.startDate < t.due ? t.startDate : t.due;
      lines.push(
        `DTSTART;VALUE=DATE:${compactDate(first)}`,
        `DTEND;VALUE=DATE:${compactDate(addDays(t.due, 1))}`,
      );
    }
    lines.push(`SUMMARY:${icsText(t.title || "Untitled task")}`);
    const description = [t.body.trim(), `List: ${listName(t.listId)}`].filter(Boolean).join("\n\n");
    lines.push(`DESCRIPTION:${icsText(description)}`);
    if (t.priority !== "none") lines.push(`PRIORITY:${{ high: 1, medium: 5, low: 9 }[t.priority]}`);
    const rule = t.repeat ? rrule(t.repeat) : null;
    if (rule) lines.push(rule);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
