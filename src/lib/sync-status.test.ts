import { describe, expect, it } from "vitest";
import { summarizeSync } from "./sync-status";

const now = Date.parse("2026-11-03T12:00:00Z");

describe("summarizeSync", () => {
  it("reports the last sync time when synced", () => {
    const s = summarizeSync("synced", now - 5 * 60_000, null, now);
    expect(s).toMatchObject({ tone: "ok", headline: "Last synced 5m ago." });
  });

  it("asks to sync when nothing has synced yet", () => {
    expect(summarizeSync("idle", null, null, now).advice).toContain("Sync now");
  });

  it("explains offline and keeps the last sync time", () => {
    const s = summarizeSync("offline", now - 3_600_000, null, now);
    expect(s.tone).toBe("warning");
    expect(s.advice).toContain("Last synced 1h ago.");
  });

  it("gives sign-in advice for an expired session", () => {
    const s = summarizeSync("error", null, "Your session expired. Sign in again.", now);
    expect(s.tone).toBe("error");
    expect(s.advice).toContain("sign in again");
  });

  it("gives retry advice for other failures", () => {
    const s = summarizeSync("error", null, "The server could not sync right now.", now);
    expect(s.advice).toContain("Sync now");
  });
});
