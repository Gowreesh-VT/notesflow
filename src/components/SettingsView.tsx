"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import clsx from "clsx";
import { PLANNER_VIEWS } from "@/lib/items-logic";
import { DEFAULT_PREFERENCES, HIDEABLE_VIEWS, type PreferenceValues } from "@/lib/preferences";
import { MAX_OUTCOME_CHOICES } from "@/lib/outcomes";
import { setPreferences, usePreferences } from "@/store/preferences";
import { useSyncStore } from "@/store/sync";
import { useUi } from "@/store/ui";
import { AccentPicker } from "./AccentPicker";
import { ViewHeader } from "./ViewHeader";

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const id = `settings-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className="space-y-3 border-b border-stone-200 pb-6 last:border-0 dark:border-stone-800"
    >
      <div>
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-stone-500 dark:text-stone-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** A row of mutually exclusive choices (a radio group drawn as a segmented control). */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex flex-wrap gap-0.5 rounded-lg bg-stone-100 p-0.5 dark:bg-stone-800"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={clsx(
              "rounded-md px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-500",
              value === o.value
                ? "bg-white font-medium shadow-sm dark:bg-stone-950"
                : "text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OutcomeChoices({ labels }: { labels: string[] }) {
  const [draft, setDraft] = useState(labels.join("\n"));
  const dirty = draft !== labels.join("\n");
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setPreferences({ outcomeLabels: draft.split("\n") });
      }}
    >
      <label htmlFor="settings-outcomes" className="block text-sm">
        Choices offered when you finish a task, one per line (up to {MAX_OUTCOME_CHOICES})
      </label>
      <textarea
        id="settings-outcomes"
        rows={5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="field w-full max-w-md"
      />
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={!dirty}>
          Save choices
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setDraft(DEFAULT_PREFERENCES.outcomeLabels.join("\n"));
            setPreferences({ outcomeLabels: DEFAULT_PREFERENCES.outcomeLabels });
          }}
        >
          Reset
        </button>
      </div>
    </form>
  );
}

/** Every preference in one place. Preferences sync to the account; reminder settings stay on each device. */
export function SettingsView() {
  const prefs = usePreferences();
  const signedIn = useSyncStore((s) => s.userId !== null);
  const set = (patch: Partial<PreferenceValues>) => setPreferences(patch);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <ViewHeader title="Settings" />
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-12 sm:px-6">
        <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600 dark:bg-stone-900 dark:text-stone-300">
          {signedIn
            ? "Settings are saved to your account and apply on every device you sign in on."
            : "Settings are saved on this device. Sign in to keep them in sync across devices."}
        </p>

        <SettingsSection title="Appearance">
          <Choice
            label="Theme"
            value={prefs.theme}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            onChange={(theme) => set({ theme })}
          />
          <AccentPicker value={prefs.accent} onChange={(accent) => set({ accent })} />
        </SettingsSection>

        <SettingsSection title="Notes">
          <Choice
            label="Editor layout"
            value={prefs.editorMode}
            options={[
              { value: "edit", label: "Write" },
              { value: "split", label: "Split" },
              { value: "preview", label: "Preview" },
            ]}
            onChange={(editorMode) => set({ editorMode })}
          />
        </SettingsSection>

        <SettingsSection
          title="Planning"
          description="Scheduling suggestions plan your remaining work up to the end of your day."
        >
          <label className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>My working day ends at</span>
            <input
              type="time"
              value={prefs.dayEnd}
              onChange={(e) => e.target.value && set({ dayEnd: e.target.value })}
              className="field w-auto"
            />
          </label>
        </SettingsSection>

        <SettingsSection title="Outcomes">
          <OutcomeChoices key={prefs.outcomeLabels.join("\n")} labels={prefs.outcomeLabels} />
        </SettingsSection>

        <SettingsSection title="Sidebar" description="Choose which views appear in the sidebar.">
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Views shown in the sidebar</legend>
            {HIDEABLE_VIEWS.map((kind) => {
              const label = PLANNER_VIEWS.find((v) => v.kind === kind)?.label ?? kind;
              const shown = !prefs.hiddenViews.includes(kind);
              return (
                <label key={kind} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={shown}
                    onChange={() =>
                      set({
                        hiddenViews: shown
                          ? [...prefs.hiddenViews, kind]
                          : prefs.hiddenViews.filter((v) => v !== kind),
                      })
                    }
                    className="size-4 accent-accent-600"
                  />
                  {label}
                </label>
              );
            })}
          </fieldset>
        </SettingsSection>

        <SettingsSection
          title="Reminders"
          description="Notifications, push reminders, the default reminder time and quiet hours are set per device."
        >
          <button
            type="button"
            className="btn btn-ghost border border-stone-200 dark:border-stone-700"
            onClick={() => useUi.getState().setSettingsOpen(true)}
          >
            <BellRing size={15} aria-hidden /> Reminder settings for this device
          </button>
        </SettingsSection>
      </div>
    </div>
  );
}
