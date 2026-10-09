import { create } from "zustand";

export type DialogRequest =
  | {
      kind: "confirm";
      id: number;
      title: string;
      message?: string;
      confirmLabel: string;
      danger: boolean;
      resolve: (ok: boolean) => void;
    }
  | {
      kind: "text";
      id: number;
      title: string;
      label: string;
      initial: string;
      placeholder?: string;
      confirmLabel: string;
      error?: (value: string) => string | null;
      resolve: (value: string | null) => void;
    };

let nextId = 1;

interface DialogState {
  /** Requests wait their turn; only the first is shown. */
  queue: DialogRequest[];
  push: (request: DialogRequest) => void;
  shift: () => void;
}

export const useDialogs = create<DialogState>((set) => ({
  queue: [],
  push: (request) => set((s) => ({ queue: [...s.queue, request] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

/** In-app replacement for `window.confirm`; resolves true when confirmed. */
export function askConfirm(options: {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) =>
    useDialogs.getState().push({
      kind: "confirm",
      id: nextId++,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? "Confirm",
      danger: options.danger ?? false,
      resolve,
    }),
  );
}

/** In-app replacement for `window.prompt`; resolves the trimmed text, or null when cancelled. */
export function askText(options: {
  title: string;
  label: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  error?: (value: string) => string | null;
}): Promise<string | null> {
  return new Promise((resolve) =>
    useDialogs.getState().push({
      kind: "text",
      id: nextId++,
      title: options.title,
      label: options.label,
      initial: options.initial ?? "",
      placeholder: options.placeholder,
      confirmLabel: options.confirmLabel ?? "Save",
      error: options.error,
      resolve,
    }),
  );
}
