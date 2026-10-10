"use client";

import { useEffect } from "react";
import { useUndo } from "@/store/undo";

const VISIBLE_MS = 6000;

/** A short message at the bottom offering to take back the last completing, deleting or batch action. */
export function UndoToast() {
  const offer = useUndo((s) => s.offer);
  const undo = useUndo((s) => s.undo);
  const dismiss = useUndo((s) => s.dismiss);
  const id = offer?.id;

  useEffect(() => {
    if (id === undefined) return;
    const timer = window.setTimeout(dismiss, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [id, dismiss]);

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6"
    >
      {offer && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-stone-900 py-2 pl-4 pr-2 text-sm text-white shadow-lift dark:bg-stone-100 dark:text-stone-900">
          <span>{offer.message}</span>
          <button
            type="button"
            onClick={undo}
            className="rounded-xl px-3 py-1.5 font-medium text-accent-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 dark:text-accent-700 dark:hover:bg-black/10"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
