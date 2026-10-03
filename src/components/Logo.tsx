import { LOGO_DOT, LOGO_TICK } from "@/lib/brand";

/** The Notesflow mark: a flowing tick on the accent colour. Decorative; pair it with the wordmark. */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      className={`inline-flex shrink-0 items-center justify-center bg-accent-600 text-white dark:bg-accent-500 ${className}`}
    >
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24" fill="none">
        <path
          d={LOGO_TICK}
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle {...LOGO_DOT} fill="currentColor" opacity="0.7" />
      </svg>
    </span>
  );
}
