import {
  Ban,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCheck,
  FileText,
  Flag,
  Inbox,
  Layers,
  ListTodo,
  Trash2,
} from "lucide-react";

const NAV = [
  { icon: Inbox, label: "Inbox", count: 4 },
  { icon: CalendarDays, label: "Today", count: 3, active: true },
  { icon: CalendarClock, label: "Tomorrow", count: 2 },
  { icon: CalendarRange, label: "Next 7 Days", count: 6 },
  { icon: Layers, label: "All", count: 11 },
  { icon: CheckCheck, label: "Completed" },
  { icon: Ban, label: "Won’t Do" },
  { icon: Trash2, label: "Trash" },
];

const TASKS = [
  { title: "Send the project proposal", meta: "Today", flag: "text-red-500", done: false },
  { title: "Book dentist appointment", meta: "Today", flag: "text-amber-500", done: false },
  { title: "Review pull requests", meta: "Today · #work", flag: "", done: false },
  { title: "Plan the weekend trip", meta: "Tomorrow", flag: "", done: false },
  { title: "Pay the electricity bill", meta: "Done", flag: "", done: true },
];

/** A static, decorative illustration of the app, built from the same design tokens. */
export function AppPreview() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 shadow-lift dark:border-stone-800 dark:bg-stone-950"
    >
      <div className="flex items-center gap-1.5 border-b border-stone-200 bg-stone-100 px-4 py-2.5 dark:border-stone-800 dark:bg-stone-900">
        <span className="size-2.5 rounded-full bg-stone-300 dark:bg-stone-700" />
        <span className="size-2.5 rounded-full bg-stone-300 dark:bg-stone-700" />
        <span className="size-2.5 rounded-full bg-stone-300 dark:bg-stone-700" />
      </div>
      <div className="flex h-[26rem] text-left text-sm sm:h-[30rem]">
        <div className="hidden w-52 shrink-0 border-r border-stone-200 bg-stone-100 p-3 md:block dark:border-stone-800 dark:bg-stone-900">
          <div className="mb-3 flex items-center gap-2 px-1">
            <span className="flex size-6 items-center justify-center rounded-lg bg-accent-600 text-white dark:bg-accent-500">
              <Check size={14} strokeWidth={3} />
            </span>
            <span className="heading-display text-base font-semibold">Notesflow</span>
          </div>
          {NAV.map(({ icon: Icon, label, count, active }) => (
            <div
              key={label}
              className={
                "flex items-center gap-2 rounded-xl px-2.5 py-1.5 " +
                (active
                  ? "bg-accent-100 font-medium text-accent-900 dark:bg-accent-950 dark:text-accent-200"
                  : "text-stone-600 dark:text-stone-300")
              }
            >
              <Icon size={15} />
              <span className="flex-1">{label}</span>
              {count ? <span className="text-xs text-stone-500">{count}</span> : null}
            </div>
          ))}
          <p className="px-2.5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
            Lists
          </p>
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-stone-600 dark:text-stone-300">
            <ListTodo size={15} /> Home
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-stone-600 dark:text-stone-300">
            <ListTodo size={15} /> Work
          </div>
        </div>

        <div className="w-full min-w-0 border-stone-200 p-4 sm:w-[22rem] sm:shrink-0 md:border-r dark:border-stone-800">
          <h3 className="heading-display text-2xl font-semibold">Today</h3>
          <div className="mt-3 rounded-xl border border-stone-300 bg-white/80 px-3 py-2 text-stone-400 dark:border-stone-700 dark:bg-stone-900">
            Add a task… “Pay rent tomorrow !high”
          </div>
          <ul className="mt-3 space-y-0.5">
            {TASKS.map((task, index) => (
              <li
                key={task.title}
                className={
                  "flex items-start gap-2.5 rounded-xl px-3 py-2.5 " +
                  (index === 0
                    ? "bg-accent-50 ring-1 ring-accent-200 dark:bg-accent-950/40 dark:ring-accent-900"
                    : "")
                }
              >
                <span
                  className={
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 " +
                    (task.done ? "border-accent-600 bg-accent-600 text-white" : "border-stone-400")
                  }
                >
                  {task.done && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={
                      "block font-medium " + (task.done ? "text-stone-400 line-through" : "")
                    }
                  >
                    {task.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-stone-500">
                    {task.meta}
                    {task.flag && <Flag size={12} className={task.flag} />}
                  </span>
                </span>
              </li>
            ))}
            <li className="flex items-start gap-2.5 rounded-xl px-3 py-2.5">
              <FileText size={18} className="mt-0.5 shrink-0 text-stone-400" />
              <span>
                <span className="block font-medium">Meeting notes</span>
                <span className="text-xs text-stone-500">Agenda, decisions and next steps</span>
              </span>
            </li>
          </ul>
        </div>

        <div className="hidden min-w-0 flex-1 bg-white p-5 sm:block dark:bg-stone-900">
          <h3 className="heading-display text-2xl font-semibold">Send the project proposal</h3>
          <dl className="mt-4 grid grid-cols-[5rem_1fr] gap-y-3 text-stone-600 dark:text-stone-300">
            <dt className="text-stone-500">Due</dt>
            <dd>Today</dd>
            <dt className="text-stone-500">Priority</dt>
            <dd>
              <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                High
              </span>
            </dd>
            <dt className="text-stone-500">List</dt>
            <dd>Work</dd>
          </dl>
          <div className="mt-5 rounded-xl bg-stone-50 p-3 font-mono text-xs leading-relaxed text-stone-600 dark:bg-stone-950 dark:text-stone-300">
            - [x] Outline the scope
            <br />- [ ] Add pricing
            <br />- [ ] Send to the client #work
          </div>
        </div>
      </div>
    </div>
  );
}
