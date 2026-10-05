import { describe, expect, it } from "vitest";
import { accentColor, accentVariables, hexToOklch, isAccent } from "./accent";
import { cleanPreferenceValues } from "./preferences";

describe("accent colours", () => {
  it("accepts presets and custom hex colours only", () => {
    expect(isAccent("teal")).toBe(true);
    expect(isAccent("#A1B2C3")).toBe(true);
    expect(isAccent("#abc")).toBe(false);
    expect(isAccent("red")).toBe(false);
    expect(cleanPreferenceValues({ accent: "#A1B2C3" }).accent).toBe("#a1b2c3");
    expect(cleanPreferenceValues({ accent: "javascript:" }).accent).toBe("blue");
  });

  it("converts sRGB to OKLCH", () => {
    expect(hexToOklch("#ffffff").l).toBeCloseTo(1, 3);
    expect(hexToOklch("#000000").l).toBeCloseTo(0, 3);
    const red = hexToOklch("#ff0000");
    expect(red.l).toBeCloseTo(0.628, 2);
    expect(red.h).toBeCloseTo(29.2, 0);
  });

  it("keeps the stylesheet palette for the default blue", () => {
    expect(accentVariables("blue")).toEqual({});
  });

  it("builds a full scale from light to dark in the chosen hue", () => {
    const vars = accentVariables("teal");
    expect(Object.keys(vars)).toHaveLength(11);
    const lightness = Object.values(vars).map((v) => Number(v.match(/oklch\(([\d.]+)/)![1]));
    expect(lightness).toEqual([...lightness].sort((a, b) => b - a));
    const hue = hexToOklch(accentColor("teal")).h;
    expect(vars["--color-accent-600"]).toContain(hue.toFixed(1));
    // Grey custom colours stay grey.
    expect(accentVariables("#808080")["--color-accent-600"]).toMatch(/oklch\(0\.545 0\.0000/);
  });
});
