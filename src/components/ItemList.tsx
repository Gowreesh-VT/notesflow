"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Columns2,
  Columns3,
  CopyPlus,
  FileText,
  FolderInput,
  Group as GroupIcon,
  Hourglass,
  ListChecks,
  List as ListIcon,
  Menu,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Repeat,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import {
  activeLists,
  archivedListIds,
  dueBucket,
  effectiveSort,
  ENERGY_OPTIONS,
  filterByEnergy,
  filterItems,
  isContainerView,
  isEnergy,
  GROUP_BY_OPTIONS,
  groupByDue,
  groupByPriority,
  groupBySections,
  groupByTag,
  resolveGroupBy,
  itemTags,
  parseQuickAdd,
  quickAddDefaults,
  resolveQuickAdd,
  type QuickAddPicks,
  subtaskProgress,
  viewKey,
  viewTitle,
  type GroupBy,
} from "@/lib/items-logic";
import { getDragItem, isItemDrag, setDragItem } from "@/lib/dnd";
import { isSideways, swipeAction, swipeOffset } from "@/lib/gestures";
import { formatDuration } from "@/lib/duration";
import { planMove, planStep } from "@/lib/ordering";
import { ROW_PAGE, rowLimit } from "@/lib/paging";
import { useToday } from "@/lib/hooks";
import { filterByOutcome, outcomeBreakdown } from "@/lib/outcomes";
import { todayTally } from "@/lib/progress";
import { describeRepeat } from "@/lib/recurrence";
import { dropOnListPatch, pinnedList, SPLIT_DRAG_TYPE, viewListId } from "@/lib/split";
import { askConfirm, askText } from "@/store/dialog";
import { BoardView } from "./BoardView";
import { CopyToListForm } from "./CopyToList";
import { BatchToolbar, SelectCheckbox, SelectToggle, useRowSelection } from "./BatchSelect";
import { EnergyIcon } from "./EnergyField";
import { ListSelect } from "./ListSelect";
import { Popover, SHEET_CLASSES } from "./Popover";
import { QuickAddPickers } from "./QuickAddPickers";
import { DragHandle, DropLine, useReorder } from "./Reorder";
import { TaskCheckbox } from "./TaskCheckbox";
import { Suggestions } from "./Suggestions";
import { TemplatesMenu } from "./TemplatesMenu";
import { shownTitle } from "@/lib/tags";
import { runningEntry } from "@/lib/time-tracking";
import { INBOX_ID, type Item, type ItemKind, type ItemSort } from "@/lib/types";
import { addDays, displayTitle, formatDueRange, formatDueWithTime, getSnippet } from "@/lib/utils";
import { useSelection } from "@/store/selection";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

/** Drag-and-drop wiring for a row in manual order. */
type RowReorder = {
  row: React.HTMLAttributes<HTMLLIElement>;
  handle: React.HTMLAttributes<HTMLSpanElement>;
  line: "top" | "bottom" | null;
  dragging: boolean;
};

function ItemRow({
  item,
  today,
  showList,
  selected,
  reorder,
}: {
  item: Item;
  today: string;
  showList: boolean;
  selected: boolean;
  reorder?: RowReorder;
}) {
  const lists = useWorkspace((s) => s.lists);
  const updateItem = useWorkspace((s) => s.updateItem);
  const selectItem = useUi((s) => s.selectItem);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleDone = useWorkspace((s) => s.toggleDone);
  const setStatus = useWorkspace((s) => s.setStatus);
  const trashItem = useWorkspace((s) => s.trashItem);
  const promptOutcome = useUi((s) => s.promptOutcome);
  // Touch swipes: right completes a task, left opens the row's actions (see src/lib/gestures.ts).
  const [swipe, setSwipe] = useState<{ dx: number; active: boolean }>({ dx: 0, active: false });
  const touch = useRef<{ x: number; y: number; dx: number; sideways: boolean } | null>(null);
  const suppressClick = useRef(false);
  const { selecting, checked, handleClick } = useRowSelection(item.id);

  const isTask = item.kind === "task";
  const closed = isTask && item.status !== "open";
  const bucket = dueBucket(item, today);
  const progress = subtaskProgress(item);
  const tags = itemTags(item);
  const listName =
    showList && item.listId !== INBOX_ID ? lists.find((l) => l.id === item.listId)?.name : null;
  const trashed = item.deletedAt !== null;
  // With a list pinned beside the view, rows can be dragged onto it to move them there.
  const splitOpen = useUi((s) => pinnedList(lists, s.splitListId, s.view) !== null) && !trashed;
  const canSwipe = !trashed && !selecting && !reorder?.dragging;
  const today1 = addDays(today, 1);

  const swipeHandlers: React.HTMLAttributes<HTMLDivElement> = canSwipe
    ? {
        onTouchStart: (e) => {
          const t = e.touches[0];
          touch.current = { x: t.clientX, y: t.clientY, dx: 0, sideways: false };
        },
        onTouchMove: (e) => {
          const start = touch.current;
          if (!start) return;
          const t = e.touches[0];
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          if (!start.sideways) {
            if (isSideways(dx, dy)) start.sideways = true;
            else if (Math.abs(dy) > 10) touch.current = null;
            if (!start.sideways) return;
          }
          // Only tasks can be completed, so notes only swipe left.
          start.dx = isTask ? dx : Math.min(0, dx);
          setSwipe({ dx: swipeOffset(start.dx), active: true });
        },
        onTouchEnd: () => {
          const start = touch.current;
          touch.current = null;
          if (!start?.sideways) return;
          suppressClick.current = true;
          setSwipe({ dx: 0, active: false });
          const action = swipeAction(start.dx);
          if (action === "complete") {
            const finishedId = toggleDone(item.id);
            if (finishedId) promptOutcome(finishedId);
          } else if (action === "actions") setMenuOpen(true);
        },
        onTouchCancel: () => {
          touch.current = null;
          setSwipe({ dx: 0, active: false });
        },
        onClickCapture: (e) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        },
      }
    : {};

  return (
    <li
      data-item-id={item.id}
      onContextMenu={(e) => {
        if (trashed) return;
        e.preventDefault();
        setMenuOpen(true);
      }}
      draggable={splitOpen || undefined}
      onDragStart={splitOpen ? (e) => setDragItem(e, item.id) : undefined}
      {...reorder?.row}
      className={clsx("group relative rounded-lg", reorder?.dragging && "opacity-50")}
    >
      {swipe.dx !== 0 && (
        <div
          aria-hidden
          className={clsx(
            "absolute inset-0 flex items-center rounded-lg px-5 text-white",
            swipe.dx > 0
              ? "justify-start bg-accent-600"
              : "justify-end bg-stone-500 dark:bg-stone-600",
          )}
        >
          {swipe.dx > 0 ? <Check size={20} /> : <MoreHorizontal size={20} />}
        </div>
      )}
      <div
        {...swipeHandlers}
        style={swipe.dx ? { transform: `translateX(${swipe.dx}px)` } : undefined}
        className={clsx(
          "relative flex min-h-11 touch-pan-y items-center gap-3 rounded-lg px-3 py-1.5 compact:min-h-8 compact:py-0.5 max-md:min-h-12",
          swipe.active ? "" : "transition-[transform,background-color] duration-150",
          selected || checked
            ? "bg-accent-50 dark:bg-accent-950"
            : swipe.dx !== 0
              ? "bg-white dark:bg-stone-900"
              : "hover:bg-stone-100 dark:hover:bg-stone-800/60",
        )}
      >
        {selecting && <SelectCheckbox item={item} checked={checked} onClick={handleClick} />}
        {reorder && <DragHandle label="Drag to reorder" {...reorder.handle} />}
        {reorder?.line && <DropLine at={reorder.line} />}
        {isTask ? (
          <TaskCheckbox item={item} disabled={trashed} />
        ) : (
          <FileText size={18} aria-hidden className="shrink-0 text-stone-500 dark:text-stone-400" />
        )}

        <button
          type="button"
          onClick={(e) => {
            if (!handleClick(e)) selectItem(item.id);
          }}
          aria-current={selected ? "true" : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          <span className="min-w-0 flex-1">
            <span
              className={clsx(
                "block truncate text-[15px]",
                closed
                  ? "text-stone-500 line-through dark:text-stone-400"
                  : "text-stone-800 dark:text-stone-100",
              )}
            >
              {shownTitle(item, displayTitle(item))}
            </span>
            {!isTask && item.body && (
              <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
                {getSnippet(item.body)}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            {isTask && item.repeat ? (
              <Repeat size={12} aria-label={describeRepeat(item.repeat)} className="shrink-0" />
            ) : null}
            {isTask && item.due && item.reminders?.length ? (
              <Bell size={12} aria-label="Has reminders" className="shrink-0" />
            ) : null}
            {isTask && item.energy && (
              <span className="hidden items-center gap-1 @lg:inline-flex">
                <EnergyIcon energy={item.energy} />
                {ENERGY_OPTIONS.find((o) => o.value === item.energy)?.label}
              </span>
            )}
            {isTask && runningEntry(item) && (
              <span className="inline-flex items-center gap-1 font-medium text-accent-600 dark:text-accent-400">
                <span className="size-1.5 animate-pulse rounded-full bg-accent-500" aria-hidden />
                Timing
              </span>
            )}
            {isTask && item.estimate && (
              <span className="hidden items-center gap-1 @xl:inline-flex" title="Estimated time">
                <Hourglass size={12} aria-hidden />
                <span className="sr-only">Estimate </span>
                {formatDuration(item.estimate)}
              </span>
            )}
            {progress.total > 0 && (
              <span className="hidden items-center gap-1 @md:inline-flex">
                <ListChecks size={13} aria-hidden />
                {progress.done}/{progress.total}
              </span>
            )}
            {item.pinned && <Pin size={13} aria-label="Pinned" className="text-accent-500" />}
            {tags.slice(0, 2).map((tag, index) => (
              <span
                key={tag}
                className={clsx(
                  "max-w-24 truncate rounded-md bg-stone-100 px-1.5 py-0.5 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
                  index > 0 && "hidden @md:inline",
                )}
              >
                #{tag}
              </span>
            ))}
            {item.outcome && (
              <span className="hidden max-w-32 truncate italic @md:inline">
                {item.outcome.label}
              </span>
            )}
            {listName && <span className="hidden max-w-28 truncate @xl:inline">{listName}</span>}
            {isTask && item.due && (
              <span
                className={clsx(
                  "tabular-nums",
                  bucket === "overdue" && !closed
                    ? "font-medium text-red-600 dark:text-red-400"
                    : bucket === "today" && !closed
                      ? "font-medium text-accent-600 dark:text-accent-400"
                      : "",
                )}
              >
                {formatDueRange(item.due, item.dueTime, item.startDate, today)}
              </span>
            )}
          </span>
        </button>
        {!trashed && (
          <button
            type="button"
            aria-label={`More actions for “${displayTitle(item)}”`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            className={clsx(
              "-mr-1.5 shrink-0 rounded-md p-1 text-stone-500 hover:bg-stone-200 hover:text-stone-700 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent-500 dark:hover:bg-stone-700 dark:hover:text-stone-200 dark:text-stone-400",
              menuOpen ? "opacity-100" : "md:opacity-0 md:group-hover:opacity-100",
            )}
          >
            <MoreHorizontal size={16} aria-hidden />
          </button>
        )}
      </div>
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close item actions"
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default max-md:z-40 max-md:bg-black/30"
            onClick={() => setMenuOpen(false)}
          />
          <div
            role="menu"
            aria-label={`Actions for “${displayTitle(item)}”`}
            onKeyDown={(e) => {
              if (e.key === "Escape") setMenuOpen(false);
            }}
            className={clsx(
              "absolute right-2 top-full z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] space-y-2 rounded-xl max-md:z-50 max-md:space-y-3 border border-stone-200 bg-white p-2.5 text-sm shadow-lift dark:border-stone-700 dark:bg-stone-900",
              SHEET_CLASSES,
            )}
          >
            <div
              aria-hidden
              className="mx-auto -mt-1 mb-1 h-1 w-10 rounded-full bg-stone-300 md:hidden dark:bg-stone-700"
            />
            <p className="truncate px-0.5 font-medium text-stone-800 md:hidden dark:text-stone-100">
              {shownTitle(item, displayTitle(item))}
            </p>
            {isTask && item.status === "open" && (
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Today", due: today },
                  { label: "Tomorrow", due: today1 },
                  { label: "Next week", due: addDays(today, 7) },
                ].map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      updateItem(item.id, { due: d.due });
                      setMenuOpen(false);
                    }}
                    className={clsx(
                      "btn flex-1 px-2 py-1.5 text-xs",
                      item.due === d.due
                        ? "bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
                        : "bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700",
                    )}
                  >
                    <CalendarDays size={13} aria-hidden /> {d.label}
                  </button>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-stone-700 dark:text-stone-200">
              <FolderInput size={15} aria-hidden className="shrink-0" />
              <span className="w-16 shrink-0">Move to</span>
              <ListSelect
                label="Move to list"
                value={item.listId}
                onChange={(listId) => {
                  updateItem(item.id, { listId });
                  setMenuOpen(false);
                }}
                className="field w-auto min-w-0 flex-1 py-1"
              />
            </label>
            <div className="flex items-center gap-2 text-stone-700 dark:text-stone-200">
              <CopyPlus size={15} aria-hidden className="shrink-0" />
              <span className="w-16 shrink-0">Copy to</span>
              <CopyToListForm
                item={item}
                onCopied={(copyId) => {
                  setMenuOpen(false);
                  selectItem(copyId);
                }}
              />
            </div>
            <div className="flex gap-1.5 border-t border-stone-200 pt-2 dark:border-stone-700">
              {isTask && (
                <button
                  type="button"
                  role="menuitem"
                  className="btn btn-ghost flex-1"
                  onClick={() => {
                    setStatus(item.id, item.status === "wontdo" ? "open" : "wontdo");
                    setMenuOpen(false);
                  }}
                >
                  <Ban size={15} aria-hidden /> {item.status === "wontdo" ? "Reopen" : "Won’t do"}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="btn btn-danger flex-1"
                onClick={() => {
                  setMenuOpen(false);
                  trashItem(item.id);
                }}
              >
                <Trash2 size={15} aria-hidden /> Delete
              </button>
            </div>
          </div>
        </>
      )}
    </li>
  );
}

function GroupHeader({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="group/header flex items-center gap-1 px-2 pb-1 pt-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-0.5 text-left text-[13px] font-semibold text-stone-700 focus-visible:outline-2 focus-visible:outline-accent-500 dark:text-stone-200"
      >
        <ChevronRight
          size={15}
          aria-hidden
          className={clsx(
            "shrink-0 text-stone-500 transition-transform dark:text-stone-400",
            open && "rotate-90",
          )}
        />
        <span className="truncate">{label}</span>
        <span className="font-normal text-stone-500 dark:text-stone-400">{count}</span>
      </button>
      {children && (
        <span className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover/header:opacity-100">
          {children}
        </span>
      )}
    </div>
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
      className="rounded-md p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-accent-500 dark:hover:bg-stone-800 dark:hover:text-stone-200 dark:text-stone-400"
    >
      {children}
    </button>
  );
}

function MenuItem({
  onClick,
  danger = false,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm",
        danger
          ? "text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          : "text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800",
      )}
    >
      {children}
    </button>
  );
}

function OptionRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
      <span className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}

/** An active filter shown under the header, so a hidden filter never explains an emptier list silently. */
function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-accent-50 py-0.5 pl-2 pr-0.5 font-medium text-accent-800 dark:bg-accent-950 dark:text-accent-200">
      {label}
      <button
        type="button"
        aria-label={`Clear ${label}`}
        onClick={onClear}
        className="rounded p-0.5 hover:bg-accent-100 focus-visible:outline-2 focus-visible:outline-accent-500 dark:hover:bg-accent-900"
      >
        <X size={12} aria-hidden />
      </button>
    </span>
  );
}

const SORTS: { value: ItemSort; label: string }[] = [
  { value: "default", label: "Smart order" },
  { value: "manual", label: "Manual order" },
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "title", label: "Title" },
  { value: "updated", label: "Last edited" },
];

/** End-of-page marker for long lists: loads the next rows as it scrolls into view, or on click. */
function MoreRows({ remaining, onMore }: { remaining: number; onMore: () => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const latest = useRef(onMore);
  useEffect(() => {
    latest.current = onMore;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) latest.current();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <li ref={ref} className="px-3 py-2">
      <button type="button" className="btn btn-ghost w-full text-xs" onClick={onMore}>
        Show {Math.min(remaining, ROW_PAGE)} more of {remaining.toLocaleString()}
      </button>
    </li>
  );
}

export function ItemList() {
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const folders = useWorkspace((s) => s.folders);
  const filters = useWorkspace((s) => s.filters);
  const addItem = useWorkspace((s) => s.addItem);
  const emptyTrash = useWorkspace((s) => s.emptyTrash);
  const renameList = useWorkspace((s) => s.renameList);
  const moveList = useWorkspace((s) => s.moveList);
  const setListArchived = useWorkspace((s) => s.setListArchived);
  const deleteList = useWorkspace((s) => s.deleteList);
  const addSection = useWorkspace((s) => s.addSection);
  const renameSection = useWorkspace((s) => s.renameSection);
  const deleteSection = useWorkspace((s) => s.deleteSection);
  const moveSection = useWorkspace((s) => s.moveSection);
  const toggleSectionCollapsed = useWorkspace((s) => s.toggleSectionCollapsed);
  const reorderItems = useWorkspace((s) => s.reorderItems);
  const { view, query, sort: chosenSort, selectedItemId } = useUi();
  const sort = effectiveSort(chosenSort, view);
  const setQuery = useUi((s) => s.setQuery);
  const setSort = useUi((s) => s.setSort);
  const groupChoices = useUi((s) => s.groupBy);
  const setGroupBy = useUi((s) => s.setGroupBy);
  const selectItem = useUi((s) => s.selectItem);
  const setView = useUi((s) => s.setView);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  const listLayout = useUi((s) => s.listLayout);
  const setListLayout = useUi((s) => s.setListLayout);
  const today = useToday();

  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<ItemKind>("task");
  const [picks, setPicks] = useState<QuickAddPicks>({});
  const [picker, setPicker] = useState<"date" | "priority" | "list" | null>(null);
  const addSheetOpen = useUi((s) => s.addSheetOpen);
  const selecting = useSelection((s) => s.active);
  const setAddSheetOpen = useUi((s) => s.setAddSheetOpen);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(["finished"]));
  const [menuOpen, setMenuOpen] = useState(false);
  const splitListId = useUi((s) => s.splitListId);
  const setSplitListId = useUi((s) => s.setSplitListId);
  const updateItem = useWorkspace((s) => s.updateItem);
  const [splitDropOver, setSplitDropOver] = useState(false);

  const energyFilter = useUi((s) => s.energyFilter);
  const setEnergyFilter = useUi((s) => s.setEnergyFilter);
  const [outcomeFilter, setOutcomeFilter] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const isCompletedView = view.kind === "smart" && view.id === "completed";
  const visible = useMemo(
    () =>
      filterByOutcome(
        filterByEnergy(
          filterItems(items, view, query, today, sort, {
            filters,
            archived: archivedListIds(lists),
          }),
          energyFilter,
        ),
        isCompletedView ? outcomeFilter : null,
      ),
    [items, view, query, today, sort, energyFilter, filters, lists, isCompletedView, outcomeFilter],
  );
  const completedOutcomes = useMemo(
    () =>
      isCompletedView
        ? outcomeBreakdown(
            filterItems(items, view, "", today, "default", { archived: archivedListIds(lists) }),
          )
        : [],
    [isCompletedView, items, view, today, lists],
  );

  const isContainer = isContainerView(view);
  const isReadOnlyView =
    view.kind === "smart" &&
    (view.id === "trash" || view.id === "completed" || view.id === "wontdo");
  const main = isContainer
    ? visible.filter((i) => i.kind === "note" || i.status === "open")
    : visible;
  const finished = isContainer
    ? visible.filter((i) => i.kind === "task" && i.status !== "open")
    : [];
  const openCount = main.filter((i) => i.kind === "task").length;

  const currentList = view.kind === "list" ? lists.find((l) => l.id === view.id) : undefined;
  const title = viewTitle(view, lists, filters);
  const hasSections = Boolean(currentList && currentList.sections.length > 0);
  const board = currentList && listLayout?.[currentList.id] === "board" ? currentList : null;

  // While a list is pinned beside this one, tasks dragged over from it move into the list shown here.
  const paneListId = pinnedList(lists, splitListId, view) ? viewListId(view) : null;
  const fromSplit = (e: React.DragEvent) =>
    isItemDrag(e) && e.dataTransfer.types.includes(SPLIT_DRAG_TYPE);
  const paneDrop = paneListId
    ? {
        onDragOver: (e: React.DragEvent<HTMLElement>) => {
          if (!fromSplit(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (!splitDropOver) setSplitDropOver(true);
        },
        onDragLeave: (e: React.DragEvent<HTMLElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSplitDropOver(false);
        },
        // Board columns handle (and stop) their own drops, so the highlight is cleared on the way down.
        onDropCapture: () => setSplitDropOver(false),
        onDrop: (e: React.DragEvent<HTMLElement>) => {
          if (!fromSplit(e)) return;
          e.preventDefault();
          const id = getDragItem(e);
          const patch = dropOnListPatch(
            items.find((i) => i.id === id),
            paneListId,
          );
          if (id && patch) updateItem(id, patch);
        },
      }
    : {};
  const splitDropClass =
    splitDropOver && paneListId && "rounded-2xl bg-accent-50/60 dark:bg-accent-950/30";
  // Pages of rows shown per group, reset whenever the view changes.
  const currentViewKey = viewKey(view);
  const [pages, setPages] = useState<{ view: string; counts: Record<string, number> }>({
    view: currentViewKey,
    counts: {},
  });
  const pageCounts = pages.view === currentViewKey ? pages.counts : {};
  const showMoreRows = (key: string) =>
    setPages((p) => {
      const counts = p.view === currentViewKey ? p.counts : {};
      return { view: currentViewKey, counts: { ...counts, [key]: (counts[key] ?? 0) + 1 } };
    });
  const groupBy = resolveGroupBy(groupChoices?.[viewKey(view)], {
    hasSections,
    sort,
    readOnly: isReadOnlyView,
  });

  const toggleGroup = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const {
    listId,
    priority: defaultPriority,
    due: defaultDue,
  } = quickAddDefaults(view, today, filters);

  const parsedDraft = kind === "task" ? parseQuickAdd(draft, today, activeLists(lists)) : null;
  const resolved = parsedDraft
    ? resolveQuickAdd(parsedDraft, picks, {
        listId,
        priority: defaultPriority,
        due: defaultDue,
      })
    : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    const tagSuffix = view.kind === "tag" ? ` #${view.tag}` : "";

    if (kind === "note") {
      selectItem(addItem({ kind, title: `${draft.trim()}${tagSuffix}`, listId }));
      setAddSheetOpen(false);
    } else if (parsedDraft && resolved) {
      addItem({
        kind,
        title: `${parsedDraft.title}${tagSuffix}`,
        ...resolved,
        estimate: parsedDraft.estimate ?? null,
      });
    }
    setDraft("");
    setPicks({});
    setPicker(null);
  };

  const preview = draft.trim() ? parsedDraft : null;
  const previewParts = preview
    ? [
        preview.due ? formatDueWithTime(preview.due, preview.dueTime, today) : "",
        preview.listId ? viewTitle({ kind: "list", id: preview.listId }, lists) : "",
        preview.listId === INBOX_ID ? "Inbox" : "",
        preview.priority !== "none"
          ? `${preview.priority[0].toUpperCase()}${preview.priority.slice(1)} priority`
          : "",
        preview.estimate ? formatDuration(preview.estimate) : "",
      ].filter(Boolean)
    : [];

  // Phones: the floating + button opens the add form as a bottom sheet. It is opened synchronously so the input
  // can take focus inside the tap, which is what makes mobile browsers show the keyboard.
  const openAddSheet = () => {
    flushSync(() => setAddSheetOpen(true));
    document.getElementById("quick-add")?.focus();
  };
  const closeAddSheet = () => {
    setAddSheetOpen(false);
    setPicker(null);
  };

  const energyLabel = ENERGY_OPTIONS.find((o) => o.value === energyFilter)?.label;
  const optionsActive = Boolean(energyFilter) || outcomeFilter !== null;
  const finishedToday = useMemo(
    () => (view.kind === "smart" && view.id === "today" ? todayTally(items, today).finished : 0),
    [items, today, view],
  );
  const emptyMessage = energyLabel
    ? `No ${energyLabel.toLowerCase()} tasks here.`
    : query
      ? `Nothing matches “${query}”.`
      : view.kind === "smart" && view.id === "trash"
        ? "Trash is empty."
        : view.kind === "smart" && view.id === "completed"
          ? "Completed tasks will show up here."
          : view.kind === "smart" && view.id === "wontdo"
            ? "Tasks you mark as Won’t Do show up here."
            : view.kind === "smart" && view.id === "today" && finishedToday > 0
              ? `Done for today. You finished ${finishedToday} task${finishedToday === 1 ? "" : "s"}; rest is part of the work.`
              : view.kind === "smart" &&
                  (view.id === "today" || view.id === "tomorrow" || view.id === "week")
                ? "Nothing due. Enjoy the calm."
                : view.kind === "filter"
                  ? "Nothing matches this filter."
                  : "Nothing here yet. Add a task or a note to get started.";

  // Manual order can be changed by dragging (or Alt+Arrow keys) in a list or the Inbox, when nothing is hidden by a
  // search or filter. Elsewhere the order is still shown, just not editable.
  const reorderable =
    sort === "manual" && isContainer && !isReadOnlyView && !query.trim() && !energyFilter;
  // Rows as displayed per drag group, filled in while rendering. Section groups are "section:<id>" ("section:" for
  // the unsectioned part); a row may only be dragged into another section, never into another kind of group.
  const shown: Record<string, Item[]> = {};
  const isSectionGroup = (group: string) => group.startsWith("section:");
  const reorder = useReorder({
    canDrop: (from, to) => from === to || (isSectionGroup(from) && isSectionGroup(to)),
    onDrop: (id, from, target) => {
      const moved = items.find((i) => i.id === id);
      if (!moved) return;
      const changes = planMove(shown[target.group] ?? [], moved, target.index);
      const sectionId = target.group.slice("section:".length) || null;
      reorderItems(
        changes,
        from !== target.group && isSectionGroup(target.group) ? { id, sectionId } : undefined,
      );
    },
  });

  // Long groups render a page at a time (more load as the end scrolls into view), so views with thousands of
  // items stay fast. The selected item is always rendered.
  let rowsCall = 0;
  const rows = (group: Item[], showList: boolean, dragGroup?: string) => {
    if (dragGroup) shown[dragGroup] = group;
    const pageKey = dragGroup ?? `group-${rowsCall++}`;
    const limit = rowLimit(group, pageCounts[pageKey] ?? 0, selectedItemId);
    const step = (item: Item, index: number) => (delta: -1 | 1) => {
      const changes = planStep(group, item.id, delta);
      if (Object.keys(changes).length === 0) return null;
      reorderItems(changes);
      return `Moved “${displayTitle(item)}” to position ${index + delta + 1} of ${group.length}.`;
    };
    return (
      <ul>
        {group.slice(0, limit).map((item, index) => (
          <ItemRow
            key={item.id}
            item={item}
            today={today}
            showList={showList}
            selected={item.id === selectedItemId}
            reorder={
              reorderable && dragGroup
                ? {
                    row: reorder.rowProps(dragGroup, index, step(item, index)),
                    handle: reorder.handleProps(item.id, dragGroup),
                    line: reorder.isTarget(dragGroup, index)
                      ? "top"
                      : index === group.length - 1 && reorder.isTarget(dragGroup, group.length)
                        ? "bottom"
                        : null,
                    dragging: reorder.dragging === item.id,
                  }
                : undefined
            }
          />
        ))}
        {group.length > limit && (
          <MoreRows remaining={group.length - limit} onMore={() => showMoreRows(pageKey)} />
        )}
      </ul>
    );
  };

  const renderGroups = () => {
    if (groupBy === "section" && currentList) {
      return groupBySections(main, currentList.sections).map(({ section, items: group }) =>
        section ? (
          <section key={section.id} aria-label={section.name}>
            <div
              {...(reorderable ? reorder.zoneProps(`section:${section.id}`, 0) : {})}
              className={clsx(
                "rounded-lg",
                (section.collapsed || group.length === 0) &&
                  reorder.isTarget(`section:${section.id}`, 0) &&
                  "bg-accent-50 dark:bg-accent-950/50",
              )}
            >
              <GroupHeader
                label={section.name}
                count={group.length}
                open={!section.collapsed}
                onToggle={() => toggleSectionCollapsed(currentList.id, section.id)}
              >
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
                  onClick={async () => {
                    const name = await askText({
                      title: "Rename section",
                      label: "Section name",
                      initial: section.name,
                    });
                    if (name) renameSection(currentList.id, section.id, name);
                  }}
                >
                  <Pencil size={14} aria-hidden />
                </SectionButton>
                <SectionButton
                  label={`Delete section ${section.name}`}
                  onClick={async () => {
                    const ok = await askConfirm({
                      title: `Delete the section “${section.name}”?`,
                      message: "Its items stay in the list.",
                      confirmLabel: "Delete",
                      danger: true,
                    });
                    if (ok) deleteSection(currentList.id, section.id);
                  }}
                >
                  <Trash2 size={14} aria-hidden />
                </SectionButton>
              </GroupHeader>
            </div>
            {!section.collapsed && rows(group, false, `section:${section.id}`)}
          </section>
        ) : group.length > 0 ? (
          <section key="none" aria-label="No section" className="pt-2">
            {rows(group, false, "section:")}
          </section>
        ) : (
          reorder.dragging && (
            <section
              key="none"
              aria-label="No section"
              {...reorder.zoneProps("section:", 0)}
              className={clsx(
                "mt-2 rounded-lg border border-dashed px-3 py-2 text-xs",
                reorder.isTarget("section:", 0)
                  ? "border-accent-500 text-accent-700 dark:text-accent-300"
                  : "border-stone-300 text-stone-500 dark:border-stone-700 dark:text-stone-400",
              )}
            >
              No section
            </section>
          )
        ),
      );
    }
    if (groupBy === "none" || groupBy === "section") {
      return <div className="pt-2">{rows(main, !isContainer, "all")}</div>;
    }
    const groups =
      groupBy === "due"
        ? groupByDue(main, today)
        : groupBy === "priority"
          ? groupByPriority(main)
          : groupByTag(main);
    return groups.map((group) => {
      const key = `${groupBy}:${group.id}`;
      return (
        <section key={key} aria-label={group.label}>
          <GroupHeader
            label={group.label}
            count={group.items.length}
            open={!collapsed.has(key)}
            onToggle={() => toggleGroup(key)}
          />
          {!collapsed.has(key) && rows(group.items, !isContainer, key)}
        </section>
      );
    });
  };

  return (
    <div className="@container flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
        <button
          type="button"
          className="btn btn-ghost -ml-2 px-2 md:hidden"
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={20} />
        </button>
        <h1 className="heading-display min-w-0 max-w-full truncate text-2xl font-semibold">
          {title}
        </h1>
        {currentList?.archivedAt ? (
          <span className="mt-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
            Archived
          </span>
        ) : null}
        {!isReadOnlyView && openCount > 0 && (
          <span className="mt-1 text-sm tabular-nums text-stone-500 dark:text-stone-400">
            {openCount}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          {currentList && (
            <div
              role="radiogroup"
              aria-label="Layout"
              className="flex shrink-0 rounded-xl bg-stone-100 p-0.5 dark:bg-stone-800"
            >
              {(
                [
                  { value: "list", label: "List", Icon: ListIcon },
                  { value: "board", label: "Board", Icon: Columns3 },
                ] as const
              ).map(({ value, label, Icon }) => {
                const active = (board ? "board" : "list") === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`${label} layout`}
                    title={`${label} layout`}
                    onClick={() => setListLayout(currentList.id, value)}
                    className={clsx(
                      "rounded-lg px-2 py-1 focus-visible:outline-2 focus-visible:outline-accent-500",
                      active
                        ? "bg-white text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-100"
                        : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200",
                    )}
                  >
                    <Icon size={15} aria-hidden />
                  </button>
                );
              })}
            </div>
          )}
          <div className="relative hidden @xl:block">
            <Search
              size={15}
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-2.5 text-stone-500 dark:text-stone-400"
            />
            <input
              id="list-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search  /"
              aria-label="Search this view"
              className="field w-40 border-transparent bg-stone-100 pl-8 transition-[width] focus:w-56 dark:border-transparent dark:bg-stone-800"
            />
          </div>
          <button
            type="button"
            className={clsx(
              "btn px-2 @xl:hidden",
              searchOpen || query
                ? "bg-accent-50 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
                : "btn-ghost",
            )}
            aria-label="Search this view"
            aria-expanded={searchOpen || Boolean(query)}
            aria-controls="list-search-narrow"
            onClick={() => {
              if (searchOpen || query) {
                setQuery("");
                setSearchOpen(false);
              } else setSearchOpen(true);
            }}
          >
            <Search size={17} aria-hidden />
          </button>
          <SelectToggle />
          <Popover
            label="View options"
            iconOnly
            align="right"
            triggerClassName={clsx(
              "btn relative px-2",
              optionsActive
                ? "bg-accent-50 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
                : "btn-ghost",
            )}
            trigger={
              <>
                <SlidersHorizontal size={17} aria-hidden />
                {optionsActive && (
                  <span
                    aria-hidden
                    className="absolute right-1 top-1 size-1.5 rounded-full bg-accent-500"
                  />
                )}
              </>
            }
            panelClassName="w-64 space-y-2.5 p-3"
          >
            {!board && (
              <OptionRow icon={<GroupIcon size={15} aria-hidden />} label="Group by">
                <select
                  aria-label="Group by"
                  value={groupBy}
                  onChange={(e) => setGroupBy(viewKey(view), e.target.value as GroupBy)}
                  className="field py-1"
                >
                  {GROUP_BY_OPTIONS.filter((o) => o.value !== "section" || hasSections).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </OptionRow>
            )}
            {!board && (
              <OptionRow icon={<ArrowUpDown size={15} aria-hidden />} label="Sort by">
                <select
                  aria-label="Sort by"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as ItemSort)}
                  className="field py-1"
                >
                  {SORTS.filter((s) => s.value !== "manual" || isContainer).map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </OptionRow>
            )}
            <OptionRow icon={<Zap size={15} aria-hidden />} label="Energy">
              <select
                aria-label="Energy filter"
                value={energyFilter ?? ""}
                onChange={(e) => setEnergyFilter(isEnergy(e.target.value) ? e.target.value : null)}
                className="field py-1"
              >
                <option value="">Any energy</option>
                {ENERGY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </OptionRow>
            {isCompletedView && completedOutcomes.length > 0 && (
              <OptionRow icon={<Sparkles size={15} aria-hidden />} label="Outcome">
                <select
                  aria-label="Outcome filter"
                  value={outcomeFilter ?? "__all"}
                  onChange={(e) =>
                    setOutcomeFilter(e.target.value === "__all" ? null : e.target.value)
                  }
                  className="field py-1"
                >
                  <option value="__all">Any outcome</option>
                  {completedOutcomes.map((o) => (
                    <option key={o.label || "none"} value={o.label}>
                      {o.label || "No outcome"} ({o.count})
                    </option>
                  ))}
                </select>
              </OptionRow>
            )}
            {(energyFilter || outcomeFilter !== null) && (
              <button
                type="button"
                className="btn btn-ghost w-full py-1 text-xs"
                onClick={() => {
                  setEnergyFilter(null);
                  setOutcomeFilter(null);
                }}
              >
                <X size={12} aria-hidden /> Clear filters
              </button>
            )}
          </Popover>
          {view.kind === "smart" && view.id === "trash" && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={visible.length === 0}
              onClick={async () => {
                const ok = await askConfirm({
                  title: "Permanently delete everything in the trash?",
                  confirmLabel: "Empty trash",
                  danger: true,
                });
                if (!ok) return;
                selectItem(null);
                emptyTrash();
              }}
            >
              Empty trash
            </button>
          )}
          {currentList && (
            <div className="relative">
              <button
                type="button"
                className="btn btn-ghost px-2"
                aria-label="List options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close list options"
                    tabIndex={-1}
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setMenuOpen(false);
                    }}
                    className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-stone-200 bg-white p-1 shadow-lift dark:border-stone-700 dark:bg-stone-900"
                  >
                    <MenuItem
                      onClick={async () => {
                        setMenuOpen(false);
                        const name = await askText({
                          title: "New section",
                          label: "Section name",
                          confirmLabel: "Add",
                        });
                        if (name) addSection(currentList.id, name);
                      }}
                    >
                      <Plus size={15} aria-hidden /> Add section
                    </MenuItem>
                    <MenuItem
                      onClick={async () => {
                        setMenuOpen(false);
                        const name = await askText({
                          title: "Rename list",
                          label: "List name",
                          initial: currentList.name,
                        });
                        if (name) renameList(currentList.id, name);
                      }}
                    >
                      <Pencil size={15} aria-hidden /> Rename list
                    </MenuItem>
                    <label className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-stone-700 dark:text-stone-200">
                      <FolderInput size={15} aria-hidden /> Folder
                      <select
                        aria-label="Folder"
                        value={currentList.folderId ?? ""}
                        onChange={(e) => moveList(currentList.id, e.target.value || null)}
                        className="field ml-auto w-28 py-1 text-xs"
                      >
                        <option value="">None</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {/* Split view only fits on large screens, so it is only offered there. */}
                    <label className="hidden items-center gap-2 px-2.5 py-1.5 text-sm text-stone-700 lg:flex dark:text-stone-200">
                      <Columns2 size={15} aria-hidden /> Beside
                      <select
                        aria-label="Open a list beside this one"
                        value={pinnedList(lists, splitListId, view)?.id ?? ""}
                        onChange={(e) => {
                          setSplitListId(e.target.value || null);
                          setMenuOpen(false);
                        }}
                        className="field ml-auto w-28 py-1 text-xs"
                      >
                        <option value="">None</option>
                        <option value={INBOX_ID}>Inbox</option>
                        {activeLists(lists)
                          .filter((l) => l.id !== currentList.id)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <MenuItem
                      onClick={() => {
                        setMenuOpen(false);
                        const archive = !currentList.archivedAt;
                        setListArchived(currentList.id, archive);
                        if (archive) setView({ kind: "smart", id: "inbox" });
                      }}
                    >
                      {currentList.archivedAt ? (
                        <>
                          <ArchiveRestore size={15} aria-hidden /> Restore list
                        </>
                      ) : (
                        <>
                          <Archive size={15} aria-hidden /> Archive list
                        </>
                      )}
                    </MenuItem>
                    <div className="my-1 border-t border-stone-200 dark:border-stone-700" />
                    <MenuItem
                      danger
                      onClick={async () => {
                        setMenuOpen(false);
                        const ok = await askConfirm({
                          title: `Delete the list “${currentList.name}”?`,
                          message: "Its items move to the Inbox.",
                          confirmLabel: "Delete",
                          danger: true,
                        });
                        if (!ok) return;
                        deleteList(currentList.id);
                        setView({ kind: "smart", id: "inbox" });
                      }}
                    >
                      <Trash2 size={15} aria-hidden /> Delete list
                    </MenuItem>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {(searchOpen || query) && (
        <div className="relative mx-4 mb-3 @xl:hidden sm:mx-6">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-2.5 text-stone-500 dark:text-stone-400"
          />
          <input
            id="list-search-narrow"
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                setSearchOpen(false);
              }
            }}
            placeholder="Search this view"
            aria-label="Search this view"
            className="field border-transparent bg-stone-100 pl-8 dark:border-transparent dark:bg-stone-800"
          />
        </div>
      )}

      {(energyLabel || outcomeFilter !== null) && (
        <p className="-mt-1 mb-2 flex flex-wrap gap-1.5 px-4 text-xs sm:px-6">
          {energyLabel && (
            <FilterChip label={`Energy: ${energyLabel}`} onClear={() => setEnergyFilter(null)} />
          )}
          {outcomeFilter !== null && (
            <FilterChip
              label={`Outcome: ${outcomeFilter || "No outcome"}`}
              onClear={() => setOutcomeFilter(null)}
            />
          )}
        </p>
      )}

      {view.kind === "smart" && view.id === "today" && <Suggestions />}

      {!isReadOnlyView && addSheetOpen && (
        <button
          type="button"
          aria-label="Close add sheet"
          tabIndex={-1}
          className="fixed inset-0 z-40 cursor-default bg-black/30 md:hidden"
          onClick={closeAddSheet}
        />
      )}
      {!isReadOnlyView && (
        <form
          onSubmit={submit}
          aria-label={kind === "task" ? "Add a task" : "Add a note"}
          onKeyDown={(e) => {
            if (e.key === "Escape" && addSheetOpen) {
              e.stopPropagation();
              closeAddSheet();
            }
          }}
          className={clsx(
            "px-4 sm:px-6",
            "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50 max-md:rounded-t-2xl max-md:border-t max-md:border-stone-200 max-md:bg-white max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom))] max-md:pt-4 max-md:shadow-lift dark:max-md:border-stone-700 dark:max-md:bg-stone-900 motion-safe:max-md:animate-[sheet-in_180ms_ease-out]",
            !addSheetOpen && "max-md:hidden",
          )}
        >
          <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 transition-colors focus-within:border-accent-400 focus-within:bg-white max-md:border-transparent max-md:bg-transparent max-md:px-0 max-md:focus-within:border-transparent max-md:focus-within:bg-transparent dark:border-stone-700 dark:bg-stone-800/60 dark:focus-within:border-accent-600 dark:focus-within:bg-stone-900 dark:max-md:border-transparent dark:max-md:bg-transparent dark:max-md:focus-within:border-transparent dark:max-md:focus-within:bg-transparent">
            <Plus
              size={17}
              aria-hidden
              className="shrink-0 text-accent-600 max-md:hidden dark:text-accent-400"
            />
            <span className="relative min-w-0 flex-1">
              <input
                id="quick-add"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label={kind === "task" ? "New task" : "New note"}
                aria-describedby="quick-add-hint"
                enterKeyHint="done"
                className="w-full bg-transparent py-2.5 text-sm outline-none max-md:text-base"
              />
              {/* A placeholder that fits the width: the full example only where there is room for it. */}
              <span
                id="quick-add-hint"
                aria-hidden={draft ? true : undefined}
                className={clsx(
                  "pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center truncate text-sm text-stone-500 max-md:text-base dark:text-stone-400",
                  draft && "invisible",
                )}
              >
                {kind === "task" ? (
                  <>
                    <span className="truncate @2xl:hidden">Add a task</span>
                    <span className="hidden truncate @2xl:inline">
                      Add a task, e.g. “Call Sam friday 5pm @work !high ~30m”
                    </span>
                  </>
                ) : (
                  <span className="truncate">Add a note title, then press Enter</span>
                )}
              </span>
            </span>
            <TemplatesMenu listId={listId} due={defaultDue} />
            <div
              role="radiogroup"
              aria-label="Add as"
              className="flex shrink-0 rounded-lg bg-stone-200/70 p-0.5 text-xs dark:bg-stone-700/60"
            >
              {(["task", "note"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={clsx(
                    "rounded-md px-2 py-0.5 font-medium capitalize transition-colors",
                    kind === k
                      ? "bg-white text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-100"
                      : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200",
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <button type="submit" className="sr-only" disabled={!draft.trim()}>
              Add
            </button>
          </div>
          {kind === "task" && resolved && (
            <QuickAddPickers
              resolved={resolved}
              picker={picker}
              onPicker={setPicker}
              onPick={(next) => {
                setPicks({ ...picks, ...next });
                setPicker(null);
                document.getElementById("quick-add")?.focus();
              }}
              today={today}
              canSubmit={Boolean(draft.trim())}
            />
          )}
          {kind === "note" && (
            <div className="mt-2 flex justify-end md:hidden">
              <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
                Add note
              </button>
            </div>
          )}
          {previewParts.length > 0 && (
            <p
              className="mt-1.5 flex flex-wrap gap-1.5 px-1 text-xs max-md:hidden"
              aria-live="polite"
            >
              {previewParts.map((part) => (
                <span
                  key={part}
                  className="rounded-md bg-accent-50 px-1.5 py-0.5 font-medium text-accent-800 dark:bg-accent-950 dark:text-accent-200"
                >
                  {part}
                </span>
              ))}
            </p>
          )}
        </form>
      )}

      {board ? (
        <div data-item-list {...paneDrop} className={clsx("min-h-0 flex-1 pt-1", splitDropClass)}>
          <BoardView list={board} items={visible} today={today} selectedItemId={selectedItemId} />
        </div>
      ) : (
        <div
          data-item-list
          {...paneDrop}
          className={clsx("min-h-0 flex-1 overflow-y-auto px-2 pb-6 pt-1 sm:px-4", splitDropClass)}
        >
          <p role="status" aria-live="polite" className="sr-only">
            {reorder.announcement}
          </p>
          {renderGroups()}
          {main.length === 0 && finished.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <svg width="72" height="72" viewBox="0 0 64 64" fill="none" aria-hidden>
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
              <GroupHeader
                label="Completed"
                count={finished.length}
                open={!collapsed.has("finished")}
                onToggle={() => toggleGroup("finished")}
              />
              {!collapsed.has("finished") && rows(finished, false)}
            </section>
          )}
        </div>
      )}
      {!isReadOnlyView && !addSheetOpen && !selecting && (
        <button
          type="button"
          aria-label={kind === "task" ? "Add a task" : "Add a note"}
          onClick={openAddSheet}
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-30 flex size-14 items-center justify-center rounded-full bg-accent-600 text-white shadow-lift transition-transform hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 active:scale-95 md:hidden"
        >
          <Plus size={26} aria-hidden />
        </button>
      )}
      <BatchToolbar items={visible} />
    </div>
  );
}
