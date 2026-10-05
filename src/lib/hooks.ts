import { useEffect, useState } from "react";
import { toDateKey } from "./utils";

/** Today's local date key; refreshes so "Today" views stay correct across midnight. */
export function useToday(): string {
  const [today, setToday] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setToday(toDateKey(new Date())), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return today;
}

/** The current time, refreshed every `intervalMs` while `active` (for live timers). Callers clamp negatives. */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard focus for a modal dialog: Tab and Shift+Tab cycle inside it, and when it closes focus returns to
 * whatever was focused before it opened.
 */
export function useModalFocus(ref: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog?.addEventListener("keydown", onKeyDown);
    return () => {
      dialog?.removeEventListener("keydown", onKeyDown);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [ref]);
}
