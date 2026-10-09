"use client";

import { askConfirm } from "@/store/dialog";

import { useEffect, useRef, useState } from "react";
import {
  Ban,
  CalendarDays,
  Check,
  CheckCheck,
  Flag,
  FolderInput,
  SquareCheckBig,
  Tag,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { ENERGY_OPTIONS, itemTags } from "@/lib/items-logic";
import { useToday } from "@/lib/hooks";
import { normalizeTag } from "@/lib/selection";
import { INBOX_ID, type Item, type Priority, type View } from "@/lib/types";
import { addDays, displayTitle } from "@/lib/utils";
import { useSelection } from "@/store/selection";
import { useUi } from "@/store/ui";
import { useWorkspace, type BatchPatch } from "@/store/workspace";
import { EnergyIcon } from "./EnergyField";
import { ListSelect } from "./ListSelect";

/** Everything except the trash can be selected and edited together. */
export const canSelectIn = (view: View): boolean => !(view.kind === "smart" && view.id === "trash");

/** Ids of the rows in the same list as `element`, in the order they are shown (collapsed groups excluded). */
function rowOrder(element: Element): string[] {
  const list = element.closest("[data-item-list]") ?? document;
  return Array.from(
    list.querySelectorAll<HTMLElement>("[data-item-id]"),
    (row) => row.dataset.itemId ?? "",
  );
}

/**
 * Click handling for a row: Ctrl/⌘-click toggles it, Shift-click selects a range (starting from the open item when
 * nothing is selected yet), and a plain click toggles it while selection mode is on. Returns false when the click
 * should open the item as usual.
 */
export function useRowSelection(id: string) {
  const selecting = useSelection((s) => s.active);
  const checked = useSelection((s) => s.ids.includes(id));

  const handleClick = (event: React.MouseEvent<HTMLElement>): boolean => {
    const ui = useUi.getState();
    const selection = useSelection.getState();
    if (!canSelectIn(ui.view)) return false;
    if (event.shiftKey) {
      selection.extend(rowOrder(event.currentTarget), id, ui.selectedItemId);
      return true;
    }
    if (event.metaKey || event.ctrlKey || selection.active) {
      selection.toggle(id);
      return true;
    }
    return false;
  };

  return { selecting, checked, handleClick };
}

/** The round selection checkbox shown at the start of each row in selection mode. */
export function SelectCheckbox({
  item,
  checked,
  onClick,
}: {
  item: Item;
  checked: boolean;
  onClick: (event: React.MouseEvent<HTMLElement>) => boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`Select “${displayTitle(item)}”`}
      onClick={onClick}
      className={clsx(
        "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
        checked
          ? "border-accent-600 bg-accent-600 text-white dark:border-accent-500 dark:bg-accent-600"
          : "border-stone-300 hover:border-accent-500 dark:border-stone-600",
      )}
    >
      {checked && <Check size={12} strokeWidth={3.5} aria-hidden />}
    </button>
  );
}

/** Header button that turns selection mode on and off. */
export function SelectToggle() {
  const view = useUi((s) => s.view);
  const active = useSelection((s) => s.active);
  const start = useSelection((s) => s.start);
  const exit = useSelection((s) => s.exit);
  if (!canSelectIn(view)) return null;
  return (
    <button
      type="button"
      aria-pressed={active}
      title="Select several items (or Ctrl/⌘-click and Shift-click rows)"
      onClick={() => (active ? exit() : start())}
      className={clsx(
        "btn px-2",
        active
          ? "bg-accent-50 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
          : "btn-ghost",
      )}
    >
      <SquareCheckBig size={16} aria-hidden />
      <span className="hidden @lg:inline">Select</span>
      <span className="sr-only @lg:hidden">Select</span>
    </button>
  );
}

type Panel = "date" | "priority" | "list" | "tag" | "energy";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "None" },
];

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function ToolButton({
  label,
  onClick,
  expanded,
  danger = false,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  expanded?: boolean;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-haspopup={expanded === undefined ? undefined : "dialog"}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "btn px-2 py-1.5 text-sm",
        danger
          ? "text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          : "btn-ghost",
        expanded && "bg-stone-100 dark:bg-stone-800",
      )}
    >
      {children}
      <span className="hidden @2xl:inline">{label}</span>
      <span className="sr-only @2xl:hidden">{label}</span>
    </button>
  );
}

function Choice({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-accent-500 dark:text-stone-200 dark:hover:bg-stone-800"
    >
      {children}
    </button>
  );
}

/**
 * The bar shown under the list while selecting: how many items are selected, and actions that apply to all of
 * them at once. `items` are the items currently shown in the view; the selection never reaches beyond them.
 */
export function BatchToolbar({ items }: { items: Item[] }) {
  const active = useSelection((s) => s.active);
  const view = useUi((s) => s.view);
  // Mounted only while selecting, so open panels and drafts start fresh each time.
  return active && canSelectIn(view) ? <Toolbar items={items} view={view} /> : null;
}

function Toolbar({ items, view }: { items: Item[]; view: View }) {
  const ids = useSelection((s) => s.ids);
  const { exit, prune, setIds } = useSelection.getState();
  const today = useToday();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [notice, setNotice] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [pickedDate, setPickedDate] = useState("");
  const [targetList, setTargetList] = useState(view.kind === "list" ? view.id : INBOX_ID);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Opening a panel moves focus into it; closing it with Escape returns focus to its button.
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("button, input, select")?.focus();
  }, [panel]);

  useEffect(() => {
    prune(items.map((i) => i.id));
  }, [items, prune]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ui = useUi.getState();
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        isTypingTarget(event.target) ||
        ui.paletteOpen ||
        ui.helpOpen ||
        ui.settingsOpen ||
        ui.outcomePromptId
      ) {
        return;
      }
      useSelection.getState().exit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const selected = items.filter((i) => ids.includes(i.id));
  const tasks = selected.filter((i) => i.kind === "task");
  const selectedIds = selected.map((i) => i.id);
  const taskIds = tasks.map((i) => i.id);
  const tags = [...new Set(selected.flatMap((i) => itemTags(i)))].sort();
  const allSelected = items.length > 0 && selected.length === items.length;
  const store = useWorkspace.getState();

  const done = (message: string) => {
    setPanel(null);
    setNotice(message);
  };
  const toggle = (next: Panel) => {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setNotice("");
    setPanel(panel === next ? null : next);
  };
  // Finished tasks drop out of the selection, so the next action does not reach them by surprise.
  const finish = (status: "done" | "wontdo") => {
    const count = store.setStatusMany(taskIds, status).length;
    setIds(ids.filter((id) => !taskIds.includes(id)));
    done(
      status === "done"
        ? `Completed ${plural(count, "task")}.`
        : `Marked ${plural(count, "task")} as won’t do.`,
    );
  };
  const patchTasks = (patch: BatchPatch, message: string) => {
    store.updateItems(taskIds, patch);
    done(message);
  };
  const tagName = normalizeTag(tagDraft);

  const quickDates = [
    { label: "Today", value: today },
    { label: "Tomorrow", value: addDays(today, 1) },
    { label: "Next week", value: addDays(today, 7) },
  ];

  const renderPanel = () => {
    switch (panel) {
      case "date":
        return (
          <>
            {quickDates.map((d) => (
              <Choice
                key={d.label}
                onClick={() =>
                  patchTasks(
                    { due: d.value },
                    `Set ${plural(tasks.length, "task")} to ${d.label.toLowerCase()}.`,
                  )
                }
              >
                {d.label}
              </Choice>
            ))}
            <form
              className="flex items-center gap-2 px-1.5 py-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (pickedDate) {
                  patchTasks(
                    { due: pickedDate },
                    `Set the date on ${plural(tasks.length, "task")}.`,
                  );
                }
              }}
            >
              <input
                type="date"
                aria-label="Due date for the selected tasks"
                value={pickedDate}
                onChange={(e) => setPickedDate(e.target.value)}
                className="field min-w-0 flex-1 py-1 text-sm"
              />
              <button
                type="submit"
                className="btn btn-primary px-3 py-1 text-sm"
                disabled={!pickedDate}
              >
                Set
              </button>
            </form>
            <Choice
              onClick={() =>
                patchTasks({ due: null }, `Cleared the date on ${plural(tasks.length, "task")}.`)
              }
            >
              <X size={14} aria-hidden /> Clear date
            </Choice>
          </>
        );
      case "priority":
        return PRIORITIES.map((p) => (
          <Choice
            key={p.value}
            onClick={() =>
              patchTasks(
                { priority: p.value },
                `Set ${plural(tasks.length, "task")} to ${p.label.toLowerCase()} priority.`,
              )
            }
          >
            <Flag size={14} aria-hidden /> {p.label}
          </Choice>
        ));
      case "energy":
        return (
          <>
            {ENERGY_OPTIONS.map((o) => (
              <Choice
                key={o.value}
                onClick={() =>
                  patchTasks(
                    { energy: o.value },
                    `Tagged ${plural(tasks.length, "task")} as ${o.label.toLowerCase()}.`,
                  )
                }
              >
                <EnergyIcon energy={o.value} size={14} /> {o.label}
              </Choice>
            ))}
            <Choice
              onClick={() =>
                patchTasks({ energy: null }, `Cleared energy on ${plural(tasks.length, "task")}.`)
              }
            >
              <X size={14} aria-hidden /> Clear energy
            </Choice>
          </>
        );
      case "list":
        return (
          <form
            className="flex items-center gap-2 p-1"
            onSubmit={(e) => {
              e.preventDefault();
              store.updateItems(selectedIds, { listId: targetList });
              done(`Moved ${plural(selected.length, "item")}.`);
            }}
          >
            <ListSelect
              value={targetList}
              onChange={setTargetList}
              label="Move the selected items to"
              className="field min-w-0 flex-1 py-1 text-sm"
            />
            <button type="submit" className="btn btn-primary px-3 py-1 text-sm">
              Move
            </button>
          </form>
        );
      case "tag":
        return (
          <div className="flex flex-col gap-2 p-1">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!tagName) return;
                store.addTagToItems(selectedIds, tagName);
                setTagDraft("");
                done(`Added #${tagName} to ${plural(selected.length, "item")}.`);
              }}
            >
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="tag"
                aria-label="Tag name"
                className="field min-w-0 flex-1 py-1 text-sm"
              />
              <button
                type="submit"
                className="btn btn-primary px-3 py-1 text-sm"
                disabled={!tagName}
              >
                Add
              </button>
              <button
                type="button"
                className="btn btn-ghost px-3 py-1 text-sm"
                disabled={!tagName}
                onClick={() => {
                  if (!tagName) return;
                  store.removeTagFromItems(selectedIds, tagName);
                  setTagDraft("");
                  done(`Removed #${tagName} from ${plural(selected.length, "item")}.`);
                }}
              >
                Remove
              </button>
            </form>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Remove a tag">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-label={`Remove #${tag} from the selected items`}
                    onClick={() => {
                      store.removeTagFromItems(selectedIds, tag);
                      done(`Removed #${tag} from ${plural(selected.length, "item")}.`);
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                  >
                    #{tag} <X size={11} aria-hidden />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const panelLabel: Record<Panel, string> = {
    date: "Set date",
    priority: "Set priority",
    list: "Move to list",
    tag: "Tags",
    energy: "Set energy",
  };
  const noTasks = tasks.length === 0;
  const none = selected.length === 0;

  return (
    <section aria-label="Selected items" className="@container relative px-2 pb-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-lift dark:border-stone-700 dark:bg-stone-900">
        <p
          className="px-2 text-sm font-medium tabular-nums text-stone-700 dark:text-stone-200"
          aria-live="polite"
        >
          {none ? "Select items" : `${selected.length} selected`}
        </p>
        <ToolButton
          label="Set date"
          expanded={panel === "date"}
          disabled={noTasks}
          onClick={() => toggle("date")}
        >
          <CalendarDays size={16} aria-hidden />
        </ToolButton>
        <ToolButton
          label="Priority"
          expanded={panel === "priority"}
          disabled={noTasks}
          onClick={() => toggle("priority")}
        >
          <Flag size={16} aria-hidden />
        </ToolButton>
        <ToolButton
          label="Move"
          expanded={panel === "list"}
          disabled={none}
          onClick={() => toggle("list")}
        >
          <FolderInput size={16} aria-hidden />
        </ToolButton>
        <ToolButton
          label="Tags"
          expanded={panel === "tag"}
          disabled={none}
          onClick={() => toggle("tag")}
        >
          <Tag size={16} aria-hidden />
        </ToolButton>
        <ToolButton
          label="Energy"
          expanded={panel === "energy"}
          disabled={noTasks}
          onClick={() => toggle("energy")}
        >
          <Zap size={16} aria-hidden />
        </ToolButton>
        <ToolButton label="Complete" disabled={noTasks} onClick={() => finish("done")}>
          <Check size={16} aria-hidden />
        </ToolButton>
        <ToolButton label="Won’t do" disabled={noTasks} onClick={() => finish("wontdo")}>
          <Ban size={16} aria-hidden />
        </ToolButton>
        <ToolButton
          label="Delete"
          danger
          disabled={none}
          onClick={async () => {
            const ok = await askConfirm({
              title: `Move ${plural(selected.length, "item")} to the trash?`,
              confirmLabel: "Move to trash",
              danger: true,
            });
            if (!ok) return;
            const open = useUi.getState().selectedItemId;
            if (open && selectedIds.includes(open)) useUi.getState().selectItem(null);
            store.trashItems(selectedIds);
            exit();
          }}
        >
          <Trash2 size={16} aria-hidden />
        </ToolButton>
        <span className="ml-auto flex items-center gap-1">
          <ToolButton
            label={allSelected ? "Select none" : "Select all"}
            disabled={items.length === 0}
            onClick={() => setIds(allSelected ? [] : items.map((i) => i.id))}
          >
            <CheckCheck size={16} aria-hidden />
          </ToolButton>
          <ToolButton label="Done selecting" onClick={exit}>
            <X size={16} aria-hidden />
          </ToolButton>
        </span>
      </div>
      {panel && (
        <>
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setPanel(null)}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={panelLabel[panel]}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setPanel(null);
                openerRef.current?.focus();
              }
            }}
            className="absolute inset-x-2 bottom-full z-20 mb-1 rounded-2xl border border-stone-200 bg-white p-1 shadow-lift sm:inset-x-auto sm:left-4 sm:w-80 dark:border-stone-700 dark:bg-stone-900"
          >
            {renderPanel()}
          </div>
        </>
      )}
      <p className="sr-only" role="status">
        {notice}
      </p>
    </section>
  );
}
