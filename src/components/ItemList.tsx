"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  Check,
  ChevronRight,
  FileText,
  Flag,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import {
  dueBucket,
  filterItems,
  groupBySections,
  itemTags,
  parseQuickAdd,
  subtaskProgress,
  viewTitle,
} from "@/lib/items-logic";
import { useToday } from "@/lib/hooks";
import { INBOX_ID, type Item, type ItemKind, type ItemSort, type Priority } from "@/lib/types";
import { addDays, displayTitle, formatDueLabel, getSnippet } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

const PRIORITY_FLAG: Record<Priority, string> = {
  none: "",
  low: "text-sky-500",
  medium: "text-amber-500",
  high: "text-red-500",
};

function ItemRow({
  item,
  today,
  showList,
  selected,
}: {
  item: Item;
  today: string;
  showList: boolean;
  selected: boolean;
}) {
  const lists = useWorkspace((s) => s.lists);
  const toggleDone = useWorkspace((s) => s.toggleDone);
  const selectItem = useUi((s) => s.selectItem);

  const isTask = item.kind === "task";
  const closed = isTask && item.status !== "open";
  const bucket = dueBucket(item, today);
  const progress = subtaskProgress(item);
  const tags = itemTags(item);
  const listName =
    showList && item.listId !== INBOX_ID ? lists.find((l) => l.id === item.listId)?.name : null;
  const trashed = item.deletedAt !== null;

  return (
    <li
      className={clsx(
        "flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors",
        selected
          ? "bg-accent-50 ring-1 ring-accent-200 dark:bg-accent-950/40 dark:ring-accent-900"
          : "hover:bg-stone-100 dark:hover:bg-stone-900",
      )}
    >
      {isTask ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={item.status === "done"}
          aria-label={`Mark “${item.title}” as ${item.status === "open" ? "done" : "not done"}`}
          disabled={trashed}
          onClick={() => toggleDone(item.id)}
          className={clsx(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
            item.status === "done"
              ? "border-accent-600 bg-accent-600 text-white"
              : item.status === "wontdo"
                ? "border-stone-400 bg-stone-300 text-white dark:bg-stone-600"
                : "border-stone-400 hover:border-accent-500",
          )}
        >
          {item.status === "done" && <Check size={12} strokeWidth={3} aria-hidden />}
          {item.status === "wontdo" && <Ban size={11} strokeWidth={3} aria-hidden />}
        </button>
      ) : (
        <FileText size={18} aria-hidden className="mt-0.5 shrink-0 text-stone-400" />
      )}

      <button
        type="button"
        onClick={() => selectItem(item.id)}
        aria-current={selected ? "true" : undefined}
        className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        <span
          className={clsx(
            "block break-words text-sm font-medium",
            closed && "text-stone-400 line-through",
          )}
        >
          {displayTitle(item)}
        </span>
        {!isTask && item.body && (
          <span className="mt-0.5 line-clamp-1 block text-xs text-stone-500 dark:text-stone-400">
            {getSnippet(item.body)}
          </span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {isTask && item.due && (
            <span
              className={clsx(
                bucket === "overdue" && !closed
                  ? "font-medium text-red-600 dark:text-red-400"
                  : bucket === "today" && !closed
                    ? "font-medium text-accent-600 dark:text-accent-400"
                    : "text-stone-500 dark:text-stone-400",
              )}
            >
              {formatDueLabel(item.due, today)}
            </span>
          )}
          {isTask && item.priority !== "none" && (
            <Flag
              size={12}
              aria-label={`${item.priority} priority`}
              className={PRIORITY_FLAG[item.priority]}
            />
          )}
          {progress.total > 0 && (
            <span className="inline-flex items-center gap-1 text-stone-500 dark:text-stone-400">
              <ListChecks size={12} aria-hidden />
              {progress.done}/{progress.total}
            </span>
          )}
          {item.pinned && <span className="text-accent-600">Pinned</span>}
          {tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-stone-500 dark:text-stone-400">
              #{tag}
            </span>
          ))}
          {listName && <span className="text-stone-400">{listName}</span>}
        </span>
      </button>
    </li>
  );
}

function SectionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-accent-500 dark:hover:bg-stone-800 dark:hover:text-stone-200"
    >
      {children}
    </button>
  );
}

const SORTS: { value: ItemSort; label: string }[] = [
  { value: "default", label: "Smart order" },
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "title", label: "Title" },
  { value: "updated", label: "Last edited" },
];

export function ItemList() {
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const folders = useWorkspace((s) => s.folders);
  const addItem = useWorkspace((s) => s.addItem);
  const emptyTrash = useWorkspace((s) => s.emptyTrash);
  const renameList = useWorkspace((s) => s.renameList);
  const moveList = useWorkspace((s) => s.moveList);
  const deleteList = useWorkspace((s) => s.deleteList);
  const addSection = useWorkspace((s) => s.addSection);
  const renameSection = useWorkspace((s) => s.renameSection);
  const deleteSection = useWorkspace((s) => s.deleteSection);
  const moveSection = useWorkspace((s) => s.moveSection);
  const { view, query, sort, selectedItemId } = useUi();
  const setQuery = useUi((s) => s.setQuery);
  const setSort = useUi((s) => s.setSort);
  const selectItem = useUi((s) => s.selectItem);
  const setView = useUi((s) => s.setView);
  const today = useToday();

  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<ItemKind>("task");
  const [showFinished, setShowFinished] = useState(false);

  const visible = useMemo(
    () => filterItems(items, view, query, today, sort),
    [items, view, query, today, sort],
  );

  const isContainer = view.kind === "list" || (view.kind === "smart" && view.id === "inbox");
  const isReadOnlyView =
    view.kind === "smart" &&
    (view.id === "trash" || view.id === "completed" || view.id === "wontdo");
  const main = isContainer
    ? visible.filter((i) => i.kind === "note" || i.status === "open")
    : visible;
  const finished = isContainer
    ? visible.filter((i) => i.kind === "task" && i.status !== "open")
    : [];

  const currentList = view.kind === "list" ? lists.find((l) => l.id === view.id) : undefined;
  const title = viewTitle(view, lists);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    const listId = view.kind === "list" ? view.id : INBOX_ID;
    const defaultDue =
      view.kind === "smart" && (view.id === "today" || view.id === "week")
        ? today
        : view.kind === "smart" && view.id === "tomorrow"
          ? addDays(today, 1)
          : null;
    const tagSuffix = view.kind === "tag" ? ` #${view.tag}` : "";

    if (kind === "note") {
      selectItem(addItem({ kind, title: `${draft.trim()}${tagSuffix}`, listId }));
    } else {
      const parsed = parseQuickAdd(draft, today);
      addItem({
        kind,
        title: `${parsed.title}${tagSuffix}`,
        priority: parsed.priority,
        due: parsed.due ?? defaultDue,
        listId,
      });
    }
    setDraft("");
  };

  const emptyMessage = query
    ? `Nothing matches “${query}”.`
    : view.kind === "smart" && view.id === "trash"
      ? "Trash is empty."
      : view.kind === "smart" && view.id === "completed"
        ? "Completed tasks will show up here."
        : view.kind === "smart" && view.id === "wontdo"
          ? "Tasks you mark as Won’t Do show up here."
          : view.kind === "smart" &&
              (view.id === "today" || view.id === "tomorrow" || view.id === "week")
            ? "Nothing due. Enjoy the calm."
            : "Nothing here yet. Add a task or note above.";

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2.5 px-4 pb-2 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="heading-display truncate text-2xl font-semibold">{title}</h1>
          {view.kind === "smart" && view.id === "trash" && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={visible.length === 0}
              onClick={() => {
                if (window.confirm("Permanently delete everything in the trash?")) {
                  selectItem(null);
                  emptyTrash();
                }
              }}
            >
              Empty trash
            </button>
          )}
        </div>

        {currentList && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={() => {
                const name = window.prompt("Rename list", currentList.name);
                if (name) renameList(currentList.id, name);
              }}
            >
              Rename
            </button>
            <label className="flex items-center gap-1 text-stone-500 dark:text-stone-400">
              Folder
              <select
                aria-label="Folder"
                value={currentList.folderId ?? ""}
                onChange={(e) => moveList(currentList.id, e.target.value || null)}
                className="field w-auto py-1 text-xs"
              >
                <option value="">None</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={() => {
                const name = window.prompt("New section name");
                if (name) addSection(currentList.id, name);
              }}
            >
              Add section
            </button>
            <button
              type="button"
              className="btn btn-danger px-2 py-1 text-xs"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete the list “${currentList.name}”? Its items move to the Inbox.`,
                  )
                ) {
                  deleteList(currentList.id);
                  setView({ kind: "smart", id: "inbox" });
                }
              }}
            >
              Delete list
            </button>
          </div>
        )}

        {!isReadOnlyView && (
          <form onSubmit={submit} className="space-y-1.5">
            <div className="flex gap-2">
              <input
                id="quick-add"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  kind === "task" ? "Add a task…  “Pay rent tomorrow !high”" : "Add a note title…"
                }
                aria-label={kind === "task" ? "New task" : "New note"}
                className="field"
              />
              <button type="submit" className="btn btn-primary px-2.5" disabled={!draft.trim()}>
                <Plus size={16} aria-hidden />
                <span className="sr-only">Add</span>
              </button>
            </div>
            <div role="radiogroup" aria-label="Add as" className="flex gap-1 text-xs">
              {(["task", "note"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={clsx(
                    "rounded-md px-2 py-0.5 font-medium capitalize",
                    kind === k
                      ? "bg-stone-200 dark:bg-stone-800"
                      : "text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-900",
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
          </form>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-2.5 text-stone-400"
            />
            <input
              id="list-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search  ( / )"
              aria-label="Search this view"
              className="field pl-8"
            />
          </div>
          <select
            aria-label="Sort by"
            value={sort}
            onChange={(e) => setSort(e.target.value as ItemSort)}
            className="field w-auto"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {currentList && currentList.sections.length > 0 ? (
          groupBySections(main, currentList.sections).map(({ section, items: group }) => (
            <section key={section?.id ?? "none"} aria-label={section?.name ?? "No section"}>
              {section ? (
                <div className="flex items-center gap-1 px-3 pb-1 pt-4">
                  <h2 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    {section.name} <span className="font-normal">({group.length})</span>
                  </h2>
                  <SectionButton
                    label={`Move section ${section.name} up`}
                    onClick={() => moveSection(currentList.id, section.id, -1)}
                  >
                    <ArrowUp size={14} aria-hidden />
                  </SectionButton>
                  <SectionButton
                    label={`Move section ${section.name} down`}
                    onClick={() => moveSection(currentList.id, section.id, 1)}
                  >
                    <ArrowDown size={14} aria-hidden />
                  </SectionButton>
                  <SectionButton
                    label={`Rename section ${section.name}`}
                    onClick={() => {
                      const name = window.prompt("Rename section", section.name);
                      if (name) renameSection(currentList.id, section.id, name);
                    }}
                  >
                    <Pencil size={14} aria-hidden />
                  </SectionButton>
                  <SectionButton
                    label={`Delete section ${section.name}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete the section “${section.name}”? Its items stay in the list.`,
                        )
                      ) {
                        deleteSection(currentList.id, section.id);
                      }
                    }}
                  >
                    <Trash2 size={14} aria-hidden />
                  </SectionButton>
                </div>
              ) : (
                group.length > 0 && <div className="pt-1" />
              )}
              <ul className="space-y-0.5">
                {group.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    today={today}
                    showList={false}
                    selected={item.id === selectedItemId}
                  />
                ))}
              </ul>
            </section>
          ))
        ) : (
          <ul className="space-y-0.5 pt-1">
            {main.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                today={today}
                showList={!isContainer}
                selected={item.id === selectedItemId}
              />
            ))}
          </ul>
        )}
        {main.length === 0 && finished.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
              <circle cx="32" cy="32" r="30" className="fill-stone-100 dark:fill-stone-800" />
              <circle cx="32" cy="32" r="14" className="stroke-accent-400" strokeWidth="2.5" />
              <path
                d="M25.5 32.5l4.5 4.5 9-10"
                className="stroke-accent-600 dark:stroke-accent-400"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-sm text-stone-500 dark:text-stone-400">{emptyMessage}</p>
          </div>
        )}
        {finished.length > 0 && (
          <section aria-label="Finished tasks">
            <button
              type="button"
              aria-expanded={showFinished}
              onClick={() => setShowFinished(!showFinished)}
              className="flex w-full items-center gap-1 px-3 py-2 text-xs font-medium text-stone-500 hover:text-stone-700 dark:text-stone-400"
            >
              <ChevronRight size={14} aria-hidden className={clsx(showFinished && "rotate-90")} />
              Completed ({finished.length})
            </button>
            {showFinished && (
              <ul>
                {finished.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    today={today}
                    showList={false}
                    selected={item.id === selectedItemId}
                  />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
