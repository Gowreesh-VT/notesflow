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
