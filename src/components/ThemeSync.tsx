"use client";

import { useEffect } from "react";
import { accentVariables } from "@/lib/accent";
import { usePreferences } from "@/store/preferences";

/** Key read by the inline script in the root layout, so the saved look applies before first paint. */
export const APPEARANCE_KEY = "notesflow:appearance";

/** Applies the theme and accent colour from the account's preferences. */
export function ThemeSync() {
  const { theme, accent } = usePreferences();

  useEffect(() => {
    const root = document.documentElement;
    const vars = accentVariables(accent);
    // Clear a previous custom accent, then set the new scale (none for the built-in blue).
    for (const name of [...root.style]) {
      if (name.startsWith("--color-accent-")) root.style.removeProperty(name);
    }
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    try {
      window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme, vars }));
    } catch {
      // Storage unavailable: the look still applies while the app is open.
    }
  }, [theme, accent]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  return null;
}
