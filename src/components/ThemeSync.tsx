"use client";

import { useEffect } from "react";
import { accentVariables } from "@/lib/accent";
import { BRAND_INK, BRAND_PAPER } from "@/lib/brand";
import { usePreferences } from "@/store/preferences";

/** Key read by the inline script in the root layout, so the saved look applies before first paint. */
export const APPEARANCE_KEY = "notesflow:appearance";

/** Applies the theme, accent colour, density, font and text size from the account's preferences. */
export function ThemeSync() {
  const { theme, accent, density, font, textSize } = usePreferences();

  useEffect(() => {
    const root = document.documentElement;
    const vars = accentVariables(accent);
    // Clear a previous custom accent, then set the new scale (none for the built-in blue).
    for (const name of [...root.style]) {
      if (name.startsWith("--color-accent-")) root.style.removeProperty(name);
    }
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    const attrs = { density, font, text: textSize };
    for (const [name, value] of Object.entries(attrs)) root.dataset[name] = value;
    try {
      window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme, vars, attrs }));
    } catch {
      // Storage unavailable: the look still applies while the app is open.
    }
  }, [theme, accent, density, font, textSize]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      // The browser bar follows the app's theme, not the phone's.
      for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
        meta.setAttribute("content", dark ? BRAND_INK : BRAND_PAPER);
      }
    };
    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  return null;
}
