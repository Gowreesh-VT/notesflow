"use client";

import { useEffect } from "react";
import { usePreferences } from "@/store/preferences";

/** Key read by the inline script in the root layout, so the saved look applies before first paint. */
export const APPEARANCE_KEY = "notesflow:appearance";

export function ThemeSync() {
  const { theme } = usePreferences();

  useEffect(() => {
    try {
      window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme }));
    } catch {
      // Storage unavailable: the theme still applies while the app is open.
    }
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
