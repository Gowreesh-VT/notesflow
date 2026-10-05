/** Accent colours: a few presets plus any custom colour, each turned into a full 50–950 scale. */

export const ACCENT_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export type AccentPreset = { id: string; label: string; color: string };

/** The 600 shade of each preset (buttons and links use it). "blue" is the built-in palette. */
export const ACCENT_PRESETS: AccentPreset[] = [
  { id: "blue", label: "Blue", color: "#4259e2" },
  { id: "violet", label: "Violet", color: "#7c4ddb" },
  { id: "teal", label: "Teal", color: "#0f8a80" },
  { id: "green", label: "Green", color: "#2f8a3e" },
  { id: "amber", label: "Amber", color: "#b45f06" },
  { id: "rose", label: "Rose", color: "#d1365f" },
  { id: "graphite", label: "Graphite", color: "#4b5563" },
];

export const DEFAULT_ACCENT = "blue";

const HEX = /^#[0-9a-f]{6}$/;

/** A preset id or a custom "#rrggbb" colour. */
export const isAccent = (value: unknown): value is string =>
  typeof value === "string" &&
  (ACCENT_PRESETS.some((p) => p.id === value) || HEX.test(value.toLowerCase()));

export const accentColor = (accent: string): string =>
  ACCENT_PRESETS.find((p) => p.id === accent)?.color ?? accent.toLowerCase();

// sRGB <-> OKLab, from Björn Ottosson's reference implementation.
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

// Lightness per step, and how much of the colour's chroma each step keeps (pale and deep ends are calmer).
const LIGHTNESS = [0.975, 0.945, 0.89, 0.81, 0.71, 0.62, 0.545, 0.47, 0.4, 0.35, 0.26];
const CHROMA = [0.12, 0.22, 0.42, 0.68, 0.88, 1, 1, 0.92, 0.8, 0.7, 0.55];

/**
 * CSS custom properties for the accent scale, or an empty object for the built-in blue (the stylesheet's own
 * palette). Lightness is fixed per step so text contrast stays the same whatever colour is chosen.
 */
export function accentVariables(accent: string): Record<string, string> {
  if (!isAccent(accent) || accent === DEFAULT_ACCENT) return {};
  const { c, h } = hexToOklch(accentColor(accent));
  const chroma = Math.min(c, 0.25);
  return Object.fromEntries(
    ACCENT_STEPS.map((step, i) => [
      `--color-accent-${step}`,
      `oklch(${LIGHTNESS[i]} ${(chroma * CHROMA[i]).toFixed(4)} ${h.toFixed(1)})`,
    ]),
  );
}
