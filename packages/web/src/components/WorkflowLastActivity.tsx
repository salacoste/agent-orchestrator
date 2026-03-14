import { PHASE_LABELS, type Phase } from "@/lib/workflow/types.js";

interface WorkflowLastActivityProps {
  lastActivity: {
    filename: string;
    phase: string;
    modifiedAt: string;
  } | null;
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function phaseLabel(phase: string): string {
  if (phase in PHASE_LABELS) {
    return PHASE_LABELS[phase as Phase];
  }
  return phase;
}

export function WorkflowLastActivity({ lastActivity }: WorkflowLastActivityProps) {
  return (
    <section
      aria-label="Last activity"
      className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-4 h-full"
    >
      <h2 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
        Last Activity
      </h2>
      {lastActivity ? (
        (() => {
          const label = phaseLabel(lastActivity.phase);
          const relativeTime = formatRelativeTime(lastActivity.modifiedAt);
          return (
            <div>
              <span className="sr-only">
                Last activity: {lastActivity.filename}, {label} phase, {relativeTime}
              </span>
              <p className="text-[13px] text-[var(--color-text-primary)] mb-1" aria-hidden="true">
                {lastActivity.filename}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]" aria-hidden="true">
                {label} &middot; <time dateTime={lastActivity.modifiedAt}>{relativeTime}</time>
              </p>
            </div>
          );
        })()
      ) : (
        <p className="text-[12px] text-[var(--color-text-secondary)]">No activity yet.</p>
      )}
    </section>
  );
}
