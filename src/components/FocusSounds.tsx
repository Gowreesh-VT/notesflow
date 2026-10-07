"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import clsx from "clsx";
import {
  NOISE_KINDS,
  noisePlaying,
  playNoise,
  setNoiseVolume,
  stopNoise,
  type NoiseKind,
} from "@/lib/noise";

/** Ambient noise for focusing, generated in the browser. Keeps playing across pages until turned off. */
export function FocusSounds() {
  const [kind, setKind] = useState<NoiseKind | null>(() => noisePlaying());
  const [volume, setVolume] = useState(0.35);

  const choose = (next: NoiseKind | null) => {
    setKind(next);
    if (next) playNoise(next, volume);
    else stopNoise();
  };

  return (
    <section aria-label="Focus sounds" className="space-y-3">
      <h2 className="text-sm font-semibold">Background sound</h2>
      <div role="radiogroup" aria-label="Sound" className="flex flex-wrap gap-1.5">
        {[{ kind: null, label: "Off", hint: "Silence" }, ...NOISE_KINDS].map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={kind === o.kind}
            title={o.hint}
            onClick={() => choose(o.kind)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              kind === o.kind
                ? "border-accent-500 bg-accent-50 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
                : "border-stone-200 text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800",
            )}
          >
            {o.kind === null ? (
              <VolumeX size={14} aria-hidden />
            ) : (
              <Volume2 size={14} aria-hidden />
            )}
            {o.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <span className="w-16">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            setNoiseVolume(v);
          }}
          className="w-48 accent-accent-600"
        />
        <span className="w-10 text-xs tabular-nums text-stone-500 dark:text-stone-400">
          {Math.round(volume * 100)}%
        </span>
      </label>
    </section>
  );
}
