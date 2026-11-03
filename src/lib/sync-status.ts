import type { SyncStatus } from "@/store/sync";
import { formatRelativeTime } from "./utils";

export type SyncSummary = {
  tone: "ok" | "busy" | "warning" | "error";
  headline: string;
  /** What the user can do next; empty when nothing is needed. */
  advice: string;
};

/** Plain-language sync state for the Settings page. */
export function summarizeSync(
  status: SyncStatus,
  lastSyncedAt: number | null,
  error: string | null,
  now = Date.now(),
): SyncSummary {
  const last = lastSyncedAt ? `Last synced ${formatRelativeTime(lastSyncedAt, now)}.` : "";
  switch (status) {
    case "syncing":
      return { tone: "busy", headline: "Syncing your changes…", advice: "" };
    case "offline":
      return {
        tone: "warning",
        headline: "This device is offline.",
        advice:
          `Everything is saved on this device and will sync when you’re back online. ${last}`.trim(),
      };
    case "error":
      return {
        tone: "error",
        headline: `Sync failed: ${error ?? "something went wrong"}`,
        advice: /sign in again/i.test(error ?? "")
          ? "Sign out and sign in again, then choose Sync now. Your changes are safe on this device."
          : "Your changes are safe on this device. Check your connection and choose Sync now; if it keeps failing, try again later.",
      };
    default:
      return lastSyncedAt
        ? { tone: "ok", headline: last, advice: "" }
        : { tone: "busy", headline: "Not synced yet.", advice: "Choose Sync now to start." };
  }
}
