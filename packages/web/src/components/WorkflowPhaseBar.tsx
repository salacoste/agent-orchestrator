import type { PhaseEntry, PhaseState } from "@/lib/workflow/types.js";

interface WorkflowPhaseBarProps {
  phases: PhaseEntry[];
}

function phaseIconColor(state: PhaseState): string {
  switch (state) {
    case "active":
      return "text-[var(--color-status-success)]";
    case "done":
      return "text-[var(--color-text-primary)]";
    default:
      return "text-[var(--color-text-muted)]";
  }
}

function phaseLabelClass(state: PhaseState): string {
  if (state === "active") {
    return "text-[12px] font-semibold text-[var(--color-text-primary)]";
  }
  return "text-[12px] text-[var(--color-text-secondary)]";
}

export function WorkflowPhaseBar({ phases }: WorkflowPhaseBarProps) {
  if (phases.length === 0) {
    return (
      <section
        aria-label="Phase progression"
        className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-4"
      >
        <h2 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
          Phase Progression
        </h2>
        <p className="text-[12px] text-[var(--color-text-secondary)]">No phase data available.</p>
      </section>
    );
  }

  return (
    <section
      aria-label="Phase progression"
      className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-4"
    >
      <h2 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
        Phase Progression
      </h2>
      <div className="flex flex-wrap items-center gap-y-2">
        {phases.map((phase, index) => (
          <div key={phase.id} className="flex items-center">
            <div className="flex items-center gap-2">
              <span className={`text-[14px] ${phaseIconColor(phase.state)}`} aria-hidden="true">
                {phase.state === "done" ? "●" : phase.state === "active" ? "★" : "○"}
              </span>
              <span className={phaseLabelClass(phase.state)} aria-hidden="true">
                {phase.label}
              </span>
              <span className="sr-only">
                {phase.label} phase: {phase.state === "not-started" ? "not started" : phase.state}
              </span>
            </div>
            {index < phases.length - 1 && (
              <span
                className="mx-3 hidden w-6 border-t border-[var(--color-border-default)] md:inline-block"
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
