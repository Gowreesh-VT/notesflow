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
