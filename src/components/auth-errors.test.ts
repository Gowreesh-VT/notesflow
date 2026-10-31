import { afterEach, describe, expect, it, vi } from "vitest";
import { networkErrorMessage, offlineMessage, OFFLINE_MESSAGE } from "./auth-errors";

afterEach(() => vi.unstubAllGlobals());

describe("offline messages", () => {
  it("says the device is offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(offlineMessage()).toBe(OFFLINE_MESSAGE);
    expect(networkErrorMessage()).toBe(OFFLINE_MESSAGE);
  });

  it("falls back to the generic message when online", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(offlineMessage()).toBeNull();
    expect(networkErrorMessage()).toMatch(/Could not reach the server/);
  });
});
