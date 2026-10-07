"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Ban,
  Settings,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCheck,
  ChevronRight,
  Folder as FolderIcon,
  Hash,
  Inbox,
  Layers,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import {
  activeLists,
  archivedListIds,
  collectTags,
  countInView,
  sameView,
  SMART_VIEWS,
  PLANNER_VIEWS,
} from "@/lib/items-logic";
import { useToday } from "@/lib/hooks";
import { planMove, planStep, sortByOrder } from "@/lib/ordering";
import { cleanTagName } from "@/lib/tags";
import { type SmartViewId, type TaskList, type View } from "@/lib/types";
import { usePreferences } from "@/store/preferences";
import { useUi } from "@/store/ui";
import { AccountMenu } from "./AccountMenu";
import { LogoMark } from "./Logo";
import { NavItem } from "./NavItem";
import { PLANNER_ICONS } from "./viewIcons";
import { DragHandle, DropLine, useReorder } from "./Reorder";
import { SidebarArchivedLists } from "./SidebarArchivedLists";
import { SidebarCountdowns } from "./SidebarCountdowns";
import { SidebarFilters } from "./SidebarFilters";
import { SidebarEmptyAction, SidebarSection } from "./SidebarSection";
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

export function Sidebar() {
  const items = useWorkspace((s) => s.items);
  const allLists = useWorkspace((s) => s.lists);
  const folders = useWorkspace((s) => s.folders);
  const addList = useWorkspace((s) => s.addList);
  const addFolder = useWorkspace((s) => s.addFolder);
  const renameFolder = useWorkspace((s) => s.renameFolder);
  const deleteFolder = useWorkspace((s) => s.deleteFolder);
  const renameTag = useWorkspace((s) => s.renameTag);
  const reorderLists = useWorkspace((s) => s.reorderLists);
  const { view, sidebarOpen, sidebarCollapsed } = useUi();
  const { hiddenViews } = usePreferences();
  const setView = useUi((s) => s.setView);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const toggleSidebarSection = useUi((s) => s.toggleSidebarSection);
  const today = useToday();

  const [adding, setAdding] = useState<"list" | "folder" | null>(null);
  const [addDraft, setAddDraft] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");

  // Archived lists live in their own section; their items stay out of smart views, counts and tags.
  const lists = useMemo(() => activeLists(allLists), [allLists]);
  const archived = useMemo(() => archivedListIds(allLists), [allLists]);
  const smartCounts = useMemo(
    () =>
      Object.fromEntries(
        SMART_VIEWS.map((v) => [
          v.id,
          countInView(items, { kind: "smart", id: v.id }, today, { archived }),
        ]),
      ) as Record<SmartViewId, number>,
    [items, today, archived],
  );
  const tags = useMemo(() => collectTags(items, archived), [items, archived]);

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

  const startAdding = (kind: "list" | "folder") => {
    if (useUi.getState().foldedSidebarSections.includes("lists")) toggleSidebarSection("lists");
    setAdding(kind);
    setAddDraft("");
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

          <SidebarSection
            id="lists"
            title="Lists"
            actions={
              <>
                <button
                  type="button"
                  className="btn btn-ghost px-1.5 py-0.5"
                  aria-label="New folder"
                  title="New folder"
                  onClick={() => startAdding("folder")}
                >
                  <FolderIcon size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost px-1.5 py-0.5"
                  aria-label="New list"
                  title="New list"
                  onClick={() => startAdding("list")}
                >
                  <Plus size={14} />
                </button>
              </>
            }
          >
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
              <SidebarEmptyAction label="New list" onClick={() => startAdding("list")} />
            )}
          </SidebarSection>

          <SidebarSection id="views" title="Views">
            {PLANNER_VIEWS.filter(
              (v) => v.kind !== "settings" && !hiddenViews.includes(v.kind),
            ).map((v) => {
              const Icon = PLANNER_ICONS[v.kind];
              return (
                <NavItem
                  key={v.kind}
                  icon={<Icon size={16} />}
                  label={v.label}
                  active={view.kind === v.kind}
                  onClick={() => goTo({ kind: v.kind })}
                />
              );
            })}
          </SidebarSection>

          <SidebarFilters />

          <SidebarCountdowns />

          {tags.length > 0 && (
            <SidebarSection id="tags" title="Tags">
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
            </SidebarSection>
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
          <SidebarArchivedLists />
        </nav>

        <div className="space-y-2 border-t border-stone-200 p-3 dark:border-stone-800">
          <button
            type="button"
            className="btn btn-ghost w-full justify-start text-xs md:hidden"
            onClick={() => goTo({ kind: "settings" })}
          >
            <Settings size={14} aria-hidden /> Settings
          </button>
          <AccountMenu />
          <p
            role="status"
            aria-live="polite"
            className="text-xs text-stone-500 empty:hidden dark:text-stone-400"
          >
            {status}
          </p>
        </div>
      </aside>
    </>
  );
}
