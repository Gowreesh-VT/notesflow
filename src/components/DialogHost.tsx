"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useModalFocus } from "@/lib/hooks";
import { useDialogs, type DialogRequest } from "@/store/dialog";

function RequestDialog({ request, onDone }: { request: DialogRequest; onDone: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(modalRef);
  const [value, setValue] = useState(request.kind === "text" ? request.initial : "");
  const [touched, setTouched] = useState(false);

  const finish = (result: boolean | string | null) => {
    if (request.kind === "confirm") request.resolve(result === true);
    else request.resolve(typeof result === "string" ? result : null);
    onDone();
  };
  const cancel = () => finish(request.kind === "confirm" ? false : null);

  const trimmed = value.trim();
  const problem = request.kind === "text" && trimmed ? (request.error?.(trimmed) ?? null) : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (request.kind === "confirm") return finish(true);
    setTouched(true);
    if (!trimmed || problem) return;
    finish(trimmed);
  };

  return createPortal(
    <div
      ref={modalRef}
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[15vh]"
      onMouseDown={cancel}
    >
      <form
        role={request.kind === "confirm" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby={
          request.kind === "confirm" && request.message ? "app-dialog-text" : undefined
        }
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            cancel();
          }
        }}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-lift dark:border-stone-700 dark:bg-stone-900"
      >
        <h2 id="app-dialog-title" className="heading-display text-lg font-semibold">
          {request.title}
        </h2>
        {request.kind === "confirm" && request.message && (
          <p id="app-dialog-text" className="text-sm text-stone-600 dark:text-stone-300">
            {request.message}
          </p>
        )}
        {request.kind === "text" && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{request.label}</span>
            <input
              autoFocus
              className="field w-full"
              value={value}
              placeholder={request.placeholder}
              aria-invalid={touched && (!trimmed || !!problem)}
              aria-describedby={problem ? "app-dialog-error" : undefined}
              onChange={(e) => setValue(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
            />
            {problem && (
              <span
                id="app-dialog-error"
                role="alert"
                className="block text-sm text-red-600 dark:text-red-400"
              >
                {problem}
              </span>
            )}
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={cancel}>
            Cancel
          </button>
          <button
            type="submit"
            autoFocus={request.kind === "confirm"}
            className={clsx(
              "btn",
              request.kind === "confirm" && request.danger ? "btn-danger" : "btn-primary",
            )}
          >
            {request.confirmLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/** Renders the pending confirm/text request from `askConfirm` / `askText`, one at a time. */
export function DialogHost() {
  const request = useDialogs((s) => s.queue[0]);
  const shift = useDialogs((s) => s.shift);
  if (!request) return null;
  return <RequestDialog key={request.id} request={request} onDone={shift} />;
}
