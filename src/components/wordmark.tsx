import { cn } from "@/lib/utils";

/**
 * TriageLane mark: three lanes of decreasing length, ordered by urgency.
 * The first lane is the shortest wait, drawn in brick.
 */
export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 22 22" className="size-[22px] shrink-0" aria-hidden>
        <rect x="1" y="1" width="20" height="20" rx="4" fill="var(--color-ink)" />
        <rect x="5" y="6" width="7" height="2.4" rx="1.2" fill="var(--color-imm-line)" />
        <rect x="5" y="9.8" width="10" height="2.4" rx="1.2" fill="var(--color-soon-line)" />
        <rect x="5" y="13.6" width="12" height="2.4" rx="1.2" fill="var(--color-rout-line)" />
      </svg>
      {!compact && (
        <span className="text-[1.0625rem] font-semibold tracking-[-0.015em] text-ink">
          Triage<span className="text-muted">Lane</span>
        </span>
      )}
    </span>
  );
}
