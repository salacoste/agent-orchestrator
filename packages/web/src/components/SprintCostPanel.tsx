import type { SprintCostSummary, SprintClock } from "@/lib/workflow/cost-tracker";

interface SprintCostPanelProps {
  cost: SprintCostSummary | null;
  clock: SprintClock | null;
}

/**
 * Sprint cost + clock dashboard panel (Story 25b.2).
 *
 * Displays token consumption, burn rate, runaway agents,
 * and sprint time-vs-work countdown.
 */
export function SprintCostPanel({ cost, clock }: SprintCostPanelProps) {
  return (
    <section
      aria-label="Sprint cost and schedule"
      className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-4"
    >
      <h2 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
        Cost & Schedule
      </h2>

      {cost && (
        <div className="space-y-2 mb-3" data-testid="cost-summary">
          <div className="flex justify-between text-[12px]">
            <span className="text-[var(--color-text-muted)]">Total tokens:</span>
            <span className="font-mono">{cost.totalTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-[var(--color-text-muted)]">Burn rate:</span>
            <span className="font-mono">{cost.burnRate.toLocaleString()}/min</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-[var(--color-text-muted)]">Active agents:</span>
            <span className="font-mono">{cost.totalAgents}</span>
          </div>
          {cost.runawayAgents.length > 0 && (
            <div
              className="text-[11px] text-[var(--color-status-attention)] mt-1"
              data-testid="runaway-warning"
            >
              ⚠️ Runaway agents: {cost.runawayAgents.join(", ")}
            </div>
          )}
        </div>
      )}

      {clock && (
        <div
          className={`rounded-[4px] px-3 py-2 text-[12px] ${
            clock.status === "on-track"
              ? "bg-green-500/10 text-green-400"
              : clock.status === "tight"
                ? "bg-amber-500/10 text-amber-400"
                : "bg-red-500/10 text-red-400"
          }`}
          data-testid="sprint-clock"
        >
          {clock.description}
        </div>
      )}

      {!cost && !clock && (
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          No cost or schedule data available.
        </p>
      )}
    </section>
  );
}
