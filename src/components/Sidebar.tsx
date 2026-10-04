"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  Ban,
  BellRing,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCheck,
  ChevronRight,
  Download,
  FileText,
  Folder as FolderIcon,
  Hash,
  Inbox,
  Layers,
  ListTodo,
  Monitor,
  Moon,
  Pencil,
  Plus,
  Search,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import clsx from "clsx";
import { collectTags, countInView, sameView, SMART_VIEWS } from "@/lib/items-logic";
import { exportBackup, importBackupFile, importMarkdownFiles } from "@/lib/data-actions";
import { useToday } from "@/lib/hooks";
import { planMove, planStep, sortByOrder } from "@/lib/ordering";
import { cleanTagName } from "@/lib/tags";
import { INBOX_ID, type SmartViewId, type TaskList, type View } from "@/lib/types";
import { useUi, type Theme } from "@/store/ui";
import { AccountMenu } from "./AccountMenu";
import { InstallButton } from "./InstallButton";
import { LogoMark } from "./Logo";
import { DragHandle, DropLine, useReorder } from "./Reorder";
import { useWorkspace } from "@/store/workspace";

const SMART_ICONS: Record<SmartViewId, React.ReactNode> = {
  inbox: <Inbox size={16} />,
  today: <CalendarDays size={16} />,
  tomorrow: <CalendarClock size={16} />,
  week: <CalendarRange size={16} />,
  all: <Layers size={16} />,
  completed: <CheckCheck size={16} />,
  wontdo: <Ban size={16} />,
  trash: <Trash2 size={16} />,
};

const COUNTED: SmartViewId[] = ["inbox", "today", "tomorrow", "week", "all"];
/** Archive-like views sit at the bottom of the sidebar, as in TickTick. */
const ARCHIVE_VIEWS: SmartViewId[] = ["completed", "wontdo", "trash"];

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
  indent = false,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-sm transition-colors",
        "focus-visible:outline-2 focus-visible:outline-accent-500",
        indent && "pl-7",
        active
          ? "bg-stone-200/80 font-medium text-stone-900 dark:bg-stone-800 dark:text-stone-50"
          : "text-stone-600 hover:bg-stone-200/50 dark:text-stone-300 dark:hover:bg-stone-900",
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "shrink-0",
          active ? "text-accent-600 dark:text-accent-400" : "text-stone-400",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs tabular-nums text-stone-500 dark:text-stone-400">{count}</span>
      )}
    </button>
  );
}

const THEMES: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun size={16} /> },
  { value: "system", label: "System", icon: <Monitor size={16} /> },
  { value: "dark", label: "Dark", icon: <Moon size={16} /> },
];

export function Sidebar() {
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const folders = useWorkspace((s) => s.folders);
  const addList = useWorkspace((s) => s.addList);
  const addFolder = useWorkspace((s) => s.addFolder);
  const renameFolder = useWorkspace((s) => s.renameFolder);
  const deleteFolder = useWorkspace((s) => s.deleteFolder);
  const renameTag = useWorkspace((s) => s.renameTag);
  const reorderLists = useWorkspace((s) => s.reorderLists);
  const { view, theme, sidebarOpen, sidebarCollapsed } = useUi();
  const setView = useUi((s) => s.setView);
  const setTheme = useUi((s) => s.setTheme);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const today = useToday();

  const [adding, setAdding] = useState<"list" | "folder" | null>(null);
  const [addDraft, setAddDraft] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const backupInput = useRef<HTMLInputElement>(null);
  const markdownInput = useRef<HTMLInputElement>(null);

  const smartCounts = useMemo(
    () =>
      Object.fromEntries(
        SMART_VIEWS.map((v) => [v.id, countInView(items, { kind: "smart", id: v.id }, today)]),
      ) as Record<SmartViewId, number>,
    [items, today],
  );
  const tags = useMemo(() => collectTags(items), [items]);

  const listCount = (id: string) => countInView(items, { kind: "list", id }, today);
  const sortedLists = useMemo(() => sortByOrder(lists), [lists]);
  const topLevelLists = sortedLists.filter(
    (l) => !l.folderId || !folders.some((f) => f.id === l.folderId),
  );
  // Lists can be dragged (or moved with Alt+Arrow keys) within the top level or within their folder.
  const listsIn = (group: string) =>
    group === "top" ? topLevelLists : sortedLists.filter((l) => l.folderId === group);
  const reorder = useReorder({
    canDrop: (from, to) => from === to,
    onDrop: (id, _from, target) => {
      const moved = lists.find((l) => l.id === id);
      if (moved) reorderLists(planMove(listsIn(target.group), moved, target.index));
    },
  });

  const run = async (action: () => Promise<string> | string) => {
    try {
      setStatus(await action());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Something went wrong.");
    }
  };

  const goTo = (target: View) => setView(target);

  const promptRenameTag = (tag: string) => {
    const input = window.prompt(`Rename #${tag} (an existing tag name merges them)`, tag);
    if (input === null) return;
    const name = cleanTagName(input);
    if (!name) {
      setStatus("A tag starts with a letter and uses letters, digits, - or _.");
      return;
    }
    const merged = tags.some((t) => t.tag === name.toLowerCase() && t.tag !== tag);
    const changed = renameTag(tag, name);
    setStatus(
      `${merged ? "Merged" : "Renamed"} #${tag} ${merged ? "into" : "to"} #${name} in ${changed} item${changed === 1 ? "" : "s"}.`,
    );
    if (sameView(view, { kind: "tag", tag })) goTo({ kind: "tag", tag: name.toLowerCase() });
  };

  const removeTag = (tag: string, count: number) => {
    if (
      !window.confirm(
        `Remove #${tag} from ${count} item${count === 1 ? "" : "s"}? The word stays, without the #.`,
      )
    ) {
      return;
    }
    const changed = renameTag(tag, null);
    setStatus(`Removed #${tag} from ${changed} item${changed === 1 ? "" : "s"}.`);
    if (sameView(view, { kind: "tag", tag })) goTo({ kind: "smart", id: "inbox" });
  };

  const submitAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (adding === "list") {
      const id = addList(addDraft);
      if (id) goTo({ kind: "list", id });
    } else if (adding === "folder") {
      addFolder(addDraft);
    }
    setAdding(null);
    setAddDraft("");
  };

  const listItem = (list: TaskList, group: string, index: number, siblings: TaskList[]) => (
    <div
      key={list.id}
      {...reorder.rowProps(group, index, (delta) => {
        const changes = planStep(siblings, list.id, delta);
        if (Object.keys(changes).length === 0) return null;
        reorderLists(changes);
        return `Moved list “${list.name}” to position ${index + delta + 1} of ${siblings.length}.`;
      })}
      className={clsx("group relative", reorder.dragging === list.id && "opacity-50")}
    >
      <DragHandle label="Drag to reorder" {...reorder.handleProps(list.id, group)} />
      {reorder.isTarget(group, index) && <DropLine at="top" />}
      {index === siblings.length - 1 && reorder.isTarget(group, siblings.length) && (
        <DropLine at="bottom" />
      )}
      <NavItem
        icon={<ListTodo size={16} />}
        label={list.name}
        count={listCount(list.id)}
        active={sameView(view, { kind: "list", id: list.id })}
        onClick={() => goTo({ kind: "list", id: list.id })}
        indent={group !== "top"}
      />
    </div>
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
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-stone-200 bg-stone-50 transition-transform",
          "dark:border-stone-800 dark:bg-stone-950 md:static md:w-60 md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed && "md:hidden",
        )}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4 md:hidden">
          <Link href="/" className="flex items-center gap-2" aria-label="Notesflow home">
            <LogoMark size={28} />
            <span className="heading-display text-xl font-semibold">Notesflow</span>
          </Link>
          <button
            type="button"
            className="btn btn-ghost md:hidden"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-3 md:hidden">
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

        <nav
          aria-label="Workspace"
          className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2 md:pt-4"
        >
          {SMART_VIEWS.filter((v) => !ARCHIVE_VIEWS.includes(v.id)).map((v) => (
            <NavItem
              key={v.id}
              icon={SMART_ICONS[v.id]}
              label={v.label}
              count={COUNTED.includes(v.id) ? smartCounts[v.id] : undefined}
              active={sameView(view, { kind: "smart", id: v.id })}
              onClick={() => goTo({ kind: "smart", id: v.id })}
            />
          ))}

          <div className="flex items-center justify-between px-2.5 pb-1 pt-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Lists
            </h2>
            <span className="flex">
              <button
                type="button"
                className="btn btn-ghost px-1.5 py-0.5"
                aria-label="New folder"
                title="New folder"
                onClick={() => {
                  setAdding("folder");
                  setAddDraft("");
                }}
              >
                <FolderIcon size={14} />
              </button>
              <button
                type="button"
                className="btn btn-ghost px-1.5 py-0.5"
                aria-label="New list"
                title="New list"
                onClick={() => {
                  setAdding("list");
                  setAddDraft("");
                }}
              >
                <Plus size={14} />
              </button>
            </span>
          </div>

          {adding && (
            <form onSubmit={submitAdd} className="px-1 pb-1">
              <input
                autoFocus
                value={addDraft}
                onChange={(e) => setAddDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setAdding(null);
                }}
                onBlur={() => {
                  if (!addDraft.trim()) setAdding(null);
                }}
                placeholder={adding === "list" ? "List name" : "Folder name"}
                aria-label={adding === "list" ? "New list name" : "New folder name"}
                className="field py-1"
              />
            </form>
          )}

          {topLevelLists.map((l, i) => listItem(l, "top", i, topLevelLists))}

          {folders.map((folder) => {
            const inFolder = listsIn(folder.id);
            const open = !collapsed.has(folder.id);
            return (
              <div key={folder.id}>
                <div className="group flex items-center">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setCollapsed((prev) => {
                        const next = new Set(prev);
                        if (open) next.add(folder.id);
                        else next.delete(folder.id);
                        return next;
                      })
                    }
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-stone-600 hover:bg-stone-200/70 dark:text-stone-300 dark:hover:bg-stone-800"
                  >
                    <ChevronRight
                      size={14}
                      aria-hidden
                      className={clsx("shrink-0", open && "rotate-90")}
                    />
                    <FolderIcon size={16} aria-hidden className="shrink-0" />
                    <span className="truncate">{folder.name}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost px-1 py-0.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Rename folder ${folder.name}`}
                    onClick={() => {
                      const name = window.prompt("Rename folder", folder.name);
                      if (name) renameFolder(folder.id, name);
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost px-1 py-0.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Delete folder ${folder.name}`}
                    onClick={() => {
                      if (
                        window.confirm(`Delete the folder “${folder.name}”? Its lists are kept.`)
                      ) {
                        deleteFolder(folder.id);
                      }
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
                {open && inFolder.map((l, i) => listItem(l, folder.id, i, inFolder))}
              </div>
            );
          })}

          <p role="status" aria-live="polite" className="sr-only">
            {reorder.announcement}
          </p>

          {lists.length === 0 && folders.length === 0 && !adding && (
            <p className="px-2.5 py-1 text-xs text-stone-500 dark:text-stone-400">
              Create lists to organise tasks and notes.
            </p>
          )}

          {tags.length > 0 && (
            <>
              <h2 className="px-2.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Tags
              </h2>
              {tags.map(({ tag, count }) => (
                <div key={tag} className="group flex items-center">
                  <div className="min-w-0 flex-1">
                    <NavItem
                      icon={<Hash size={16} />}
                      label={tag}
                      count={count}
                      active={sameView(view, { kind: "tag", tag })}
                      onClick={() => goTo({ kind: "tag", tag })}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost px-1 py-0.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Rename tag ${tag}`}
                    title="Rename or merge tag"
                    onClick={() => promptRenameTag(tag)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost px-1 py-0.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Remove tag ${tag}`}
                    title="Remove tag"
                    onClick={() => removeTag(tag, count)}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </>
          )}

          <div className="mx-2.5 my-3 border-t border-stone-200 dark:border-stone-800" />
          {SMART_VIEWS.filter((v) => ARCHIVE_VIEWS.includes(v.id)).map((v) => (
            <NavItem
              key={v.id}
              icon={SMART_ICONS[v.id]}
              label={v.label}
              active={sameView(view, { kind: "smart", id: v.id })}
              onClick={() => goTo({ kind: "smart", id: v.id })}
            />
          ))}
        </nav>

        <div className="space-y-2 border-t border-stone-200 p-3 dark:border-stone-800">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 md:hidden">
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
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-200/70 dark:text-stone-400 dark:hover:bg-stone-800 [&::-webkit-details-marker]:hidden">
              <ChevronRight
                size={13}
                aria-hidden
                className="transition-transform group-open:rotate-90"
              />
              Backup &amp; import
            </summary>
            <div className="grid grid-cols-3 gap-1 pt-1">
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
          </details>
          <button
            type="button"
            className="btn btn-ghost w-full justify-start text-xs md:hidden"
            onClick={() => useUi.getState().setSettingsOpen(true)}
          >
            <BellRing size={14} aria-hidden /> Reminder settings
          </button>
          <AccountMenu />
          <InstallButton />
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
              const listId = view.kind === "list" ? view.id : INBOX_ID;
              if (files.length) void run(() => importMarkdownFiles(files, listId));
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
