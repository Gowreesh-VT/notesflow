"use client";

import { useEffect, useRef } from "react";
import { useUi } from "@/store/ui";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "Ctrl/⌘ + K", label: "Open the command palette" },
  { keys: "Alt + N", label: "New note" },
  { keys: "Alt + T", label: "New task" },
  { keys: "Alt + J", label: "Open today’s daily note" },
  { keys: "/", label: "Search the current list" },
  { keys: "?", label: "Show this help" },
  { keys: "Esc", label: "Close dialogs" },
];

function HelpDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh]"
      onMouseDown={onClose}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-4 shadow-lift outline-none dark:border-stone-700 dark:bg-stone-900"
      >
        <h2 id="shortcut-help-title" className="mb-3 text-base font-semibold">
          Keyboard shortcuts
        </h2>
        <dl className="space-y-2 text-sm">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-center justify-between gap-4">
              <dt className="text-stone-600 dark:text-stone-300">{shortcut.label}</dt>
              <dd>
                <kbd className="rounded border border-stone-300 bg-stone-100 px-1.5 py-0.5 font-mono text-xs dark:border-stone-600 dark:bg-stone-800">
                  {shortcut.keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShortcutHelp() {
  const open = useUi((s) => s.helpOpen);
  const setOpen = useUi((s) => s.setHelpOpen);
  return open ? <HelpDialog onClose={() => setOpen(false)} /> : null;
}
