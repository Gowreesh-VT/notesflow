"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  FileText,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import {
  boardColumns,
  planCardDrop,
  planCardStep,
  type BoardColumn,
  type CardDirection,
  type CardMove,
} from "@/lib/board";
import { getDragItem, isItemDrag, setDragItem } from "@/lib/dnd";
import { dueBucket, itemTags, subtaskProgress } from "@/lib/items-logic";
import type { Item, TaskList } from "@/lib/types";
import { displayTitle, formatDueRange, getSnippet } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { SelectCheckbox, useRowSelection } from "./BatchSelect";
import { TaskCheckbox } from "./TaskCheckbox";

/** Drag payload for a column header; cards use the shared item payload from lib/dnd. */
const SECTION_DRAG_TYPE = "application/x-notesflow-section";
const isSectionDrag = (event: React.DragEvent) =>
  event.dataTransfer.types.includes(SECTION_DRAG_TYPE);

const ARROWS: Record<string, CardDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/** Where a dragged card would land: before the card at `index` of column `column`. */
type CardTarget = { column: string; index: number };

/** Drag-and-drop state and handlers shared by the columns of one board. */
type BoardDnd = {
  draggingCard: string | null;
  cardTarget: CardTarget | null;
  /** Drop position among the list's sections while a column header is dragged. */
  sectionTarget: number | null;
  startCard: (event: React.DragEvent, id: string) => void;
  startSection: (event: React.DragEvent, id: string) => void;
  end: () => void;
  overCard: (event: React.DragEvent<HTMLElement>, column: string, index: number) => void;
  overColumn: (event: React.DragEvent<HTMLElement>, column: BoardColumn) => void;
  dropOnColumn: (event: React.DragEvent, column: BoardColumn) => void;
  stepCard: (event: React.KeyboardEvent, id: string) => void;
};

function BoardCard({
  item,
  today,
  selected,
  dnd,
  line,
  index,
  columnId,
}: {
  item: Item;
  today: string;
  selected: boolean;
  dnd: BoardDnd;
  /** Drop line above or below this card. */
  line?: "top" | "bottom" | null;
  /** Position in its column, for open cards that can be moved. */
  index?: number;
  columnId: string;
}) {
  const selectItem = useUi((s) => s.selectItem);
  const { selecting, checked, handleClick } = useRowSelection(item.id);
  const isTask = item.kind === "task";
  const closed = isTask && item.status !== "open";
  const bucket = dueBucket(item, today);
  const progress = subtaskProgress(item);
  const tags = itemTags(item);
  const movable = index !== undefined;

  return (
    <li
      data-item-id={item.id}
      draggable={movable}
      onDragStart={movable ? (e) => dnd.startCard(e, item.id) : undefined}
      onDragEnd={movable ? dnd.end : undefined}
      onDragOver={movable ? (e) => dnd.overCard(e, columnId, index) : undefined}
      onKeyDown={movable ? (e) => dnd.stepCard(e, item.id) : undefined}
      className={clsx(
        "group relative flex gap-2.5 rounded-xl border px-3 py-2.5 shadow-soft transition-colors",
        movable && "cursor-grab active:cursor-grabbing",
        selected || checked
          ? "border-accent-300 bg-accent-50 dark:border-accent-800 dark:bg-accent-950/50"
          : "border-stone-200 bg-white hover:border-stone-300 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700",
        dnd.draggingCard === item.id && "opacity-50",
      )}
    >
      {line && (
        <span
          aria-hidden
          className={clsx(
            "pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-accent-500",
            line === "top" ? "-top-[5px]" : "-bottom-[5px]",
          )}
        />
      )}
      {selecting && <SelectCheckbox item={item} checked={checked} onClick={handleClick} />}
      <span className="mt-px">
        {isTask ? (
          <TaskCheckbox item={item} />
        ) : (
          <FileText size={18} aria-hidden className="text-stone-400" />
        )}
      </span>
      <button
        type="button"
        data-card-open
        onClick={(e) => {
          if (!handleClick(e)) selectItem(item.id);
        }}
        aria-current={selected ? "true" : undefined}
        aria-keyshortcuts={
          movable ? "Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight" : undefined
        }
        className="min-w-0 flex-1 cursor-[inherit] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        <span
          className={clsx(
            "line-clamp-3 text-sm break-words",
            closed
              ? "text-stone-400 line-through dark:text-stone-500"
              : "text-stone-800 dark:text-stone-100",
          )}
        >
          {displayTitle(item)}
        </span>
        {!isTask && item.body && (
          <span className="mt-0.5 line-clamp-2 text-xs text-stone-500 dark:text-stone-400">
            {getSnippet(item.body)}
          </span>
        )}
        {((isTask && item.due) || progress.total > 0 || tags.length > 0) && (
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
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
            {progress.total > 0 && (
              <span className="inline-flex items-center gap-1">
                <ListChecks size={13} aria-hidden />
                <span className="sr-only">Subtasks </span>
                {progress.done}/{progress.total}
              </span>
            )}
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-stone-100 px-1.5 py-0.5 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
              >
                {tag}
              </span>
            ))}
          </span>
        )}
      </button>
    </li>
  );
}

function IconButton({
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
      className="rounded-md p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-accent-500 dark:hover:bg-stone-800 dark:hover:text-stone-200"
    >
      {children}
    </button>
  );
}

/** A vertical accent bar beside a column, marking where a dragged column will land. */
function ColumnDropLine({ side }: { side: "left" | "right" }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "pointer-events-none absolute inset-y-2 w-0.5 rounded-full bg-accent-500",
        side === "left" ? "-left-[7px]" : "-right-[7px]",
      )}
    />
  );
}

function Column({
  list,
  column,
  today,
  selectedItemId,
  dnd,
}: {
  list: TaskList;
  column: BoardColumn;
  today: string;
  selectedItemId: string | null;
  dnd: BoardDnd;
}) {
  const renameSection = useWorkspace((s) => s.renameSection);
  const deleteSection = useWorkspace((s) => s.deleteSection);
  const moveSection = useWorkspace((s) => s.moveSection);
  const toggleSectionCollapsed = useWorkspace((s) => s.toggleSectionCollapsed);
  const [showFinished, setShowFinished] = useState(false);
  const { section } = column;
  const name = section?.name ?? "No section";
  const collapsed = Boolean(section?.collapsed);
  const headingId = `board-column-${column.id || "none"}`;

  const position = section ? list.sections.findIndex((s) => s.id === section.id) : -1;
  const sectionLine =
    section && dnd.sectionTarget === position
      ? "left"
      : section && position === list.sections.length - 1 && dnd.sectionTarget === position + 1
        ? "right"
        : null;
  const target = dnd.cardTarget?.column === column.id ? dnd.cardTarget.index : null;
  const highlighted = target !== null && (collapsed || column.items.length === 0);

  const dropProps = {
    onDragOver: (event: React.DragEvent<HTMLElement>) => dnd.overColumn(event, column),
    onDrop: (event: React.DragEvent<HTMLElement>) => dnd.dropOnColumn(event, column),
  };
  const dragProps = section
    ? {
        draggable: true,
        onDragStart: (event: React.DragEvent) => dnd.startSection(event, section.id),
        onDragEnd: dnd.end,
      }
    : {};

  if (section && collapsed) {
    return (
      <section
        aria-labelledby={headingId}
        {...dropProps}
        {...dragProps}
        className={clsx(
          "relative flex w-11 shrink-0 cursor-grab flex-col items-center gap-2 rounded-2xl py-2 active:cursor-grabbing",
          highlighted
            ? "bg-accent-50 ring-2 ring-accent-500 dark:bg-accent-950/50"
            : "bg-stone-100 dark:bg-stone-900/70",
        )}
      >
        {sectionLine && <ColumnDropLine side={sectionLine} />}
        <button
          type="button"
          aria-expanded={false}
          aria-label={`Expand section ${name}`}
          title={`Expand ${name}`}
          onClick={() => toggleSectionCollapsed(list.id, section.id)}
          className="rounded-md p-1 text-stone-500 hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-accent-500 dark:hover:bg-stone-800"
        >
          <ChevronRight size={15} aria-hidden />
        </button>
        <h2
          id={headingId}
          className="truncate text-[13px] font-semibold text-stone-700 [writing-mode:vertical-rl] dark:text-stone-200"
        >
          {name}
          <span className="ml-1.5 font-normal text-stone-400 dark:text-stone-500">
            {column.items.length}
          </span>
        </h2>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      {...dropProps}
      className={clsx(
        "relative flex max-h-full w-[17rem] min-w-64 shrink-0 flex-col rounded-2xl",
        highlighted
          ? "bg-accent-50 ring-2 ring-accent-500 dark:bg-accent-950/50"
          : "bg-stone-100 dark:bg-stone-900/70",
      )}
    >
      {sectionLine && <ColumnDropLine side={sectionLine} />}
      <div
        {...dragProps}
        className={clsx(
          "group/header flex items-center gap-1 px-2 pb-1 pt-2",
          section && "cursor-grab active:cursor-grabbing",
        )}
      >
        {section && (
          <button
            type="button"
            aria-expanded
            aria-label={`Collapse section ${name}`}
            title={`Collapse ${name}`}
            onClick={() => toggleSectionCollapsed(list.id, section.id)}
            className="rounded-md p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-accent-500 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <ChevronRight size={15} aria-hidden className="rotate-90" />
          </button>
        )}
        <h2
          id={headingId}
          className={clsx(
            "flex min-w-0 flex-1 items-baseline gap-1.5 text-[13px] font-semibold text-stone-700 dark:text-stone-200",
            !section && "pl-1.5",
          )}
        >
          <span className="truncate">{name}</span>
          <span className="font-normal text-stone-400 dark:text-stone-500">
            {column.items.length}
          </span>
        </h2>
        {section && (
          <span className="flex opacity-100 transition-opacity focus-within:opacity-100 md:opacity-0 md:group-hover/header:opacity-100">
            <IconButton
              label={`Move section ${name} left`}
              onClick={() => moveSection(list.id, section.id, -1)}
            >
              <ArrowLeft size={14} aria-hidden />
            </IconButton>
            <IconButton
              label={`Move section ${name} right`}
              onClick={() => moveSection(list.id, section.id, 1)}
            >
              <ArrowRight size={14} aria-hidden />
            </IconButton>
            <IconButton
              label={`Rename section ${name}`}
              onClick={() => {
                const next = window.prompt("Rename section", name);
                if (next) renameSection(list.id, section.id, next);
              }}
            >
              <Pencil size={14} aria-hidden />
            </IconButton>
            <IconButton
              label={`Delete section ${name}`}
              onClick={() => {
                if (window.confirm(`Delete the section “${name}”? Its items stay in the list.`)) {
                  deleteSection(list.id, section.id);
                }
              }}
            >
              <Trash2 size={14} aria-hidden />
            </IconButton>
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <ul className="flex min-h-10 flex-col gap-2 pt-1">
          {column.items.map((item, index) => (
            <BoardCard
              key={item.id}
              item={item}
              today={today}
              selected={item.id === selectedItemId}
              dnd={dnd}
              index={index}
              columnId={column.id}
              line={
                target === index
                  ? "top"
                  : index === column.items.length - 1 && target === column.items.length
                    ? "bottom"
                    : null
              }
            />
          ))}
        </ul>
        {column.finished.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              aria-expanded={showFinished}
              onClick={() => setShowFinished(!showFinished)}
              className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left text-xs font-medium text-stone-500 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-accent-500 dark:text-stone-400 dark:hover:text-stone-200"
            >
              <ChevronRight
                size={13}
                aria-hidden
                className={clsx("transition-transform", showFinished && "rotate-90")}
              />
              Completed {column.finished.length}
            </button>
            {showFinished && (
              <ul className="flex flex-col gap-2 pt-1" aria-label={`Completed in ${name}`}>
                {column.finished.map((item) => (
                  <BoardCard
                    key={item.id}
                    item={item}
                    today={today}
                    selected={item.id === selectedItemId}
                    dnd={dnd}
                    columnId={column.id}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * A list as a board: one column per section (plus "No section" when it is used), cards in manual order and finished
 * tasks folded away at the bottom of each column. Cards are dragged between and within columns (or moved with
 * Alt+Arrow keys); column headers are dragged to reorder sections. Cards dragged in from another list join it.
 */
export function BoardView({
  list,
  items,
  today,
  selectedItemId,
}: {
  list: TaskList;
  items: Item[];
  today: string;
  selectedItemId: string | null;
}) {
  const addSection = useWorkspace((s) => s.addSection);
  const updateItem = useWorkspace((s) => s.updateItem);
  const reorderItems = useWorkspace((s) => s.reorderItems);
  const moveSectionTo = useWorkspace((s) => s.moveSectionTo);
  const columns = useMemo(() => boardColumns(items, list.sections), [items, list.sections]);
  const boardRef = useRef<HTMLDivElement>(null);

  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [draggingSection, setDraggingSection] = useState<string | null>(null);
  const [cardTarget, setCardTarget] = useState<CardTarget | null>(null);
  const [sectionTarget, setSectionTarget] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const findItem = (id: string | null) =>
    id ? useWorkspace.getState().items.find((i) => i.id === id && i.deletedAt === null) : undefined;

  const apply = (item: Item, move: CardMove) => {
    if (item.listId !== list.id)
      updateItem(item.id, { listId: list.id, sectionId: move.sectionId });
    reorderItems(move.orders, { id: item.id, sectionId: move.sectionId });
  };

  const showCard = (next: CardTarget) => {
    if (cardTarget?.column !== next.column || cardTarget.index !== next.index) setCardTarget(next);
  };

  const end = () => {
    setDraggingCard(null);
    setDraggingSection(null);
    setCardTarget(null);
    setSectionTarget(null);
  };

  const dnd: BoardDnd = {
    draggingCard,
    cardTarget,
    sectionTarget,
    startCard: (event, id) => {
      event.stopPropagation();
      setDragItem(event, id);
      setDraggingCard(id);
    },
    startSection: (event, id) => {
      event.dataTransfer.setData(SECTION_DRAG_TYPE, id);
      event.dataTransfer.effectAllowed = "move";
      setDraggingSection(id);
    },
    end,
    overCard: (event, column, index) => {
      if (!isItemDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      const rect = event.currentTarget.getBoundingClientRect();
      showCard({ column, index: event.clientY > rect.top + rect.height / 2 ? index + 1 : index });
    },
    overColumn: (event, column) => {
      if (isItemDrag(event)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        showCard({ column: column.id, index: column.items.length });
      } else if (isSectionDrag(event)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const position = column.section
          ? list.sections.findIndex((s) => s.id === column.section!.id)
          : -1;
        const rect = event.currentTarget.getBoundingClientRect();
        const after = event.clientX > rect.left + rect.width / 2;
        const next = position < 0 ? 0 : position + (after ? 1 : 0);
        if (next !== sectionTarget) setSectionTarget(next);
      }
    },
    dropOnColumn: (event, column) => {
      if (isSectionDrag(event)) {
        event.preventDefault();
        const id = event.dataTransfer.getData(SECTION_DRAG_TYPE) || draggingSection;
        if (id && sectionTarget !== null) moveSectionTo(list.id, id, sectionTarget);
        end();
        return;
      }
      if (!isItemDrag(event)) return;
      event.preventDefault();
      // Handled here; keep the drop from also reaching the surrounding list pane.
      event.stopPropagation();
      const index = cardTarget?.column === column.id ? cardTarget.index : column.items.length;
      const item = findItem(getDragItem(event));
      end();
      if (!item) return;
      const move = planCardDrop(columns, item, column.id, index);
      if (move) apply(item, move);
    },
    stepCard: (event, id) => {
      const direction = ARROWS[event.key];
      if (!event.altKey || !direction) return;
      event.preventDefault();
      const item = findItem(id);
      const move = planCardStep(columns, id, direction);
      if (!item || !move) return;
      apply(item, move);
      const column = columns.find((c) => c.id === move.columnId);
      const count = (column?.items.length ?? 0) + (column?.items.some((i) => i.id === id) ? 0 : 1);
      setAnnouncement(
        `Moved “${displayTitle(item)}” to ${column?.section?.name ?? "No section"}, position ${move.index + 1} of ${count}.`,
      );
      // The card is re-rendered in its new place; keep the keyboard focus on it.
      requestAnimationFrame(() => {
        boardRef.current
          ?.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"] [data-card-open]`)
          ?.focus();
      });
    },
  };

  return (
    <div
      ref={boardRef}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setCardTarget(null);
          setSectionTarget(null);
        }
      }}
      className="flex h-full items-start gap-3 overflow-x-auto px-4 pb-4 pt-2 sm:px-6"
    >
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {columns.map((column) => (
        <Column
          key={column.id || "none"}
          list={list}
          column={column}
          today={today}
          selectedItemId={selectedItemId}
          dnd={dnd}
        />
      ))}
      <button
        type="button"
        onClick={() => {
          const name = window.prompt("New section name");
          if (name) addSection(list.id, name);
        }}
        className="flex w-[17rem] min-w-64 shrink-0 items-center gap-2 rounded-2xl border border-dashed border-stone-300 px-3 py-2.5 text-sm text-stone-500 hover:border-accent-400 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-accent-500 dark:border-stone-700 dark:text-stone-400 dark:hover:border-accent-600 dark:hover:text-accent-300"
      >
        <Plus size={15} aria-hidden /> Add section
      </button>
    </div>
  );
}
