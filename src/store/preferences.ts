import { useMemo } from "react";
import { currentPreferences, type PreferenceValues } from "@/lib/preferences";
import { useWorkspace } from "./workspace";

/** The account's preferences (synced), with defaults for anything not set yet. */
export function usePreferences(): PreferenceValues {
  const settings = useWorkspace((s) => s.settings);
  return useMemo(() => currentPreferences(settings), [settings]);
}

/** Reads the current preferences outside React. */
export const getPreferences = (): PreferenceValues =>
  currentPreferences(useWorkspace.getState().settings);

/** Changes preferences; the change syncs to the account like any other edit. */
export const setPreferences = (patch: Partial<PreferenceValues>): void =>
  useWorkspace.getState().setPreferences(patch);
