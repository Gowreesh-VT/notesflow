const WIDTHS = ["w-3/5", "w-2/5", "w-4/5", "w-1/2", "w-2/3", "w-1/3"];

/** Placeholder task rows shown while the workspace or a lazily loaded view is on its way. */
export function LoadingRows({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" className="space-y-1 p-4">
      <span className="sr-only">{label}…</span>
      {WIDTHS.map((width, i) => (
        <div key={i} aria-hidden className="flex items-center gap-3 px-2 py-3">
          <div className="size-5 shrink-0 animate-pulse rounded-md bg-stone-100 motion-reduce:animate-none dark:bg-stone-800" />
          <div
            className={`h-3.5 animate-pulse rounded-md bg-stone-100 motion-reduce:animate-none dark:bg-stone-800 ${width}`}
          />
        </div>
      ))}
    </div>
  );
}
