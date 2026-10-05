"use client";

import Link from "next/link";
import {
  BellRing,
  CalendarDays,
  CalendarFold,
  Clock3,
  CircleHelp,
  Inbox,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import clsx from "clsx";
import { sameView } from "@/lib/items-logic";
import type { Theme } from "@/lib/types";
import { setPreferences, usePreferences } from "@/store/preferences";
import { useUi } from "@/store/ui";
import { LogoMark } from "./Logo";

const NEXT_THEME: Record<Theme, { next: Theme; icon: React.ReactNode; label: string }> = {
  system: { next: "light", icon: <Monitor size={19} />, label: "Theme: system" },
  light: { next: "dark", icon: <Sun size={19} />, label: "Theme: light" },
  dark: { next: "system", icon: <Moon size={19} />, label: "Theme: dark" },
};

function RailButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        "flex size-10 items-center justify-center rounded-xl transition-colors",
        "focus-visible:outline-2 focus-visible:outline-accent-500",
        active
          ? "bg-accent-100 text-accent-700 dark:bg-accent-950 dark:text-accent-300"
          : "text-stone-500 hover:bg-stone-200/80 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
      )}
    >
      {children}
    </button>
  );
}

/** Slim desktop rail: brand, the two main views, search, sidebar toggle, help and theme. */
export function NavRail() {
  const view = useUi((s) => s.view);
  const { theme } = usePreferences();
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const { setView, setPaletteOpen, setHelpOpen, setSettingsOpen, toggleSidebarCollapsed } =
    useUi.getState();
  const themeInfo = NEXT_THEME[theme];

  return (
    <nav
      aria-label="App"
      className="hidden w-16 shrink-0 flex-col items-center gap-1 border-r border-stone-200 bg-stone-100 py-3 md:flex dark:border-stone-800 dark:bg-stone-900"
    >
      <Link href="/" aria-label="Notesflow home" className="mb-3 rounded-xl">
        <LogoMark size={34} />
      </Link>
      <RailButton
        label="Inbox"
        active={sameView(view, { kind: "smart", id: "inbox" })}
        onClick={() => setView({ kind: "smart", id: "inbox" })}
      >
        <Inbox size={19} />
      </RailButton>
      <RailButton
        label="Today"
        active={sameView(view, { kind: "smart", id: "today" })}
        onClick={() => setView({ kind: "smart", id: "today" })}
      >
        <CalendarDays size={19} />
      </RailButton>
      <RailButton
        label="Calendar"
        active={view.kind === "calendar"}
        onClick={() => setView({ kind: "calendar" })}
      >
        <CalendarFold size={19} />
      </RailButton>
      <RailButton
        label="Plan my day"
        active={view.kind === "plan"}
        onClick={() => setView({ kind: "plan" })}
      >
        <Clock3 size={19} />
      </RailButton>
      <RailButton label="Quick find (⌘K)" onClick={() => setPaletteOpen(true)}>
        <Search size={19} />
      </RailButton>

      <div className="mt-auto flex flex-col items-center gap-1">
        <RailButton
          label={collapsed ? "Show lists" : "Hide lists"}
          onClick={toggleSidebarCollapsed}
        >
          {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </RailButton>
        <RailButton label="Reminder settings" onClick={() => setSettingsOpen(true)}>
          <BellRing size={19} />
        </RailButton>
        <RailButton
          label="Settings"
          active={view.kind === "settings"}
          onClick={() => setView({ kind: "settings" })}
        >
          <Settings size={19} />
        </RailButton>
        <RailButton label="Keyboard shortcuts (?)" onClick={() => setHelpOpen(true)}>
          <CircleHelp size={19} />
        </RailButton>
        <RailButton
          label={themeInfo.label}
          onClick={() => setPreferences({ theme: themeInfo.next })}
        >
          {themeInfo.icon}
        </RailButton>
      </div>
    </nav>
  );
}
