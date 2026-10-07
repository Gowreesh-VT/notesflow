// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Guards the palette in globals.css: the grey used for secondary text must stay readable (WCAG AA, 4.5:1). */
const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const token = (name: string, from = css) =>
  from.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i"))![1];
/** The dark theme's own neutral scale (the `html.dark` block). */
const dark = (name: string) => token(name, css.slice(css.indexOf("html.dark {")));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("text contrast", () => {
  it("secondary text (stone-500) is readable on every light surface", () => {
    for (const surface of ["#ffffff", token("stone-50"), token("stone-100"), token("stone-200")]) {
      expect(contrast(token("stone-500"), surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("secondary text in dark mode (stone-400) is readable on dark surfaces", () => {
    for (const surface of [dark("stone-800"), dark("stone-900"), dark("stone-950")]) {
      expect(contrast(dark("stone-400"), surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("dark mode is black with neutral greys", () => {
    expect(dark("stone-950")).toBe("#000000");
    for (const step of [500, 600, 700, 800, 900]) {
      const hex = dark(`stone-${step}`);
      expect(new Set([hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)]).size).toBe(1);
    }
  });

  it("white text on the primary button (accent-600) is readable", () => {
    expect(contrast("#ffffff", token("accent-600"))).toBeGreaterThanOrEqual(4.5);
  });
});
