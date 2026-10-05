import { describe, expect, it } from "vitest";
import { sanitizeRecord } from "./sync";
import {
  clockMinutes,
  currentPreferences,
  DEFAULT_PREFERENCES,
  legacyPreferences,
  parsePreferences,
  PREFERENCES_ID,
  updatePreferences,
} from "./preferences";

describe("preferences", () => {
  it("falls back to the defaults when nothing is saved", () => {
    expect(currentPreferences([])).toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps valid values and replaces invalid ones with defaults", () => {
    const parsed = parsePreferences(
      {
        id: PREFERENCES_ID,
        theme: "dark",
        editorMode: "sideways",
        outcomeLabels: ["Nailed it", " ", "nailed it", 4],
        dayEnd: "25:00",
        hiddenViews: ["matrix", "settings", "bogus"],
        updatedAt: 10,
        extra: "dropped",
      },
      99,
    );
    expect(parsed).toEqual({
      id: PREFERENCES_ID,
      theme: "dark",
      editorMode: "split",
      outcomeLabels: ["Nailed it"],
      dayEnd: "21:00",
      hiddenViews: ["matrix"],
      updatedAt: 10,
    });
    expect(parsePreferences({ id: "other", theme: "dark" }, 1)).toBeNull();
  });

  it("stamps every change so the newest one wins across devices", () => {
    const first = updatePreferences([], { theme: "light" }, 100);
    const second = updatePreferences(first, { dayEnd: "18:30" }, 200);
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ theme: "light", dayEnd: "18:30", updatedAt: 200 });
  });

  it("carries over what older versions kept on the device", () => {
    const ui = JSON.stringify({ state: { theme: "dark", editorMode: "preview", sort: "due" } });
    expect(legacyPreferences(ui)).toMatchObject({
      theme: "dark",
      editorMode: "preview",
      updatedAt: 1,
    });
    expect(legacyPreferences(JSON.stringify({ state: { theme: "system" } }))).toBeNull();
    expect(legacyPreferences("not json")).toBeNull();
    expect(legacyPreferences(null)).toBeNull();
  });

  it("is accepted by sync as the setting collection", () => {
    const record = updatePreferences([], { theme: "dark" }, 5)[0];
    expect(
      sanitizeRecord({
        collection: "setting",
        id: PREFERENCES_ID,
        updatedAt: 5,
        deleted: false,
        data: record,
      }),
    ).toMatchObject({ collection: "setting", data: { theme: "dark" } });
  });

  it("reads clock times as minutes", () => {
    expect(clockMinutes("21:30")).toBe(21 * 60 + 30);
  });
});
