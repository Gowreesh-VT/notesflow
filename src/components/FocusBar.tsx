"use client";

import { useEffect } from "react";
import { Pause, Play, SkipForward, Square, Timer } from "lucide-react";
import clsx from "clsx";
import { playChime } from "@/lib/chime";
import { PHASE_LABEL, remainingMs } from "@/lib/focus";
import { useNow } from "@/lib/hooks";
import { showNotification } from "@/lib/notifications";
import { formatElapsed } from "@/lib/time-tracking";
import { displayTitle } from "@/lib/utils";
import { useFocus } from "@/store/focus";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

/** Keeps the Pomodoro ticking, rings when a phase ends, and shows a small bar while a session is on. */
export function FocusBar() {
  const session = useFocus((s) => s.session);
  const { pause, resume, skip, stop, finishPhase } = useFocus.getState();
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const item = useWorkspace((s) => s.items.find((i) => i.id === session?.itemId));
  const running = Boolean(session && session.endsAt !== null);
  const now = useNow(running, 1000);
  const left = session ? remainingMs(session, now) : 0;

  useEffect(() => {
    void useFocus.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!session || session.endsAt === null || left > 0) return;
    const ended = finishPhase();
    if (!ended) return;
    playChime();
    const next = useFocus.getState().session;
    const title = ended === "work" ? "Focus session done" : "Break is over";
    const body =
      ended === "work"
        ? `Time for a ${next?.phase === "long" ? "long" : "short"} break.`
        : "Ready for the next focus session?";
    void showNotification(title, { body, tag: "focus", itemId: session.itemId ?? "" }, () =>
      setView({ kind: "focus" }),
    );
  }, [left, session, finishPhase, setView]);

  if (!session || view.kind === "focus") return null;
  const paused = session.endsAt === null;

  return (
    <div
      role="region"
      aria-label="Focus timer"
      className="fixed bottom-3 left-1/2 max-md:bottom-[4.75rem] z-30 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-stone-200 bg-white py-1.5 pl-3 pr-1.5 text-sm shadow-lift dark:border-stone-700 dark:bg-stone-900"
    >
      <button
        type="button"
        onClick={() => setView({ kind: "focus" })}
        className="flex min-w-0 items-center gap-2 text-left"
        aria-label="Open the focus page"
      >
        <Timer
          size={16}
          aria-hidden
          className={clsx(
            session.phase === "work" ? "text-accent-600 dark:text-accent-400" : "text-emerald-600",
          )}
        />
        <span className="font-semibold tabular-nums">{formatElapsed(left)}</span>
        <span className="hidden max-w-48 truncate text-stone-500 sm:inline dark:text-stone-400">
          {PHASE_LABEL[session.phase]}
          {item ? ` · ${displayTitle(item)}` : ""}
        </span>
      </button>
      <button
        type="button"
        className="btn btn-ghost rounded-full px-2 py-1"
        aria-label={paused ? "Resume" : "Pause"}
        onClick={() => (paused ? resume() : pause())}
      >
        {paused ? <Play size={15} /> : <Pause size={15} />}
      </button>
      <button
        type="button"
        className="btn btn-ghost rounded-full px-2 py-1"
        aria-label="Skip to next phase"
        onClick={() => skip()}
      >
        <SkipForward size={15} />
      </button>
      <button
        type="button"
        className="btn btn-ghost rounded-full px-2 py-1"
        aria-label="Stop focus session"
        onClick={() => stop()}
      >
        <Square size={14} />
      </button>
    </div>
  );
}
