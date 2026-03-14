import { PHASE_LABELS, type Recommendation } from "@/lib/workflow/types.js";

interface WorkflowAIGuideProps {
  recommendation: Recommendation | null;
}

function tierStyles(tier: 1 | 2): { text: string; border: string } {
  return tier === 1
    ? {
        text: "text-[var(--color-status-attention)]",
        border: "border-[var(--color-status-attention)]",
      }
    : { text: "text-[var(--color-accent)]", border: "border-[var(--color-accent)]" };
}

export function WorkflowAIGuide({ recommendation }: WorkflowAIGuideProps) {
  return (
    <section
      aria-label="AI-guided recommendations"
      className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-4 h-full"
    >
      <h2 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
        AI Guide
      </h2>
      {recommendation ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[11px] font-semibold uppercase ${tierStyles(recommendation.tier).text} border ${tierStyles(recommendation.tier).border} rounded-[4px] px-1.5 py-0.5`}
              aria-hidden="true"
            >
              Tier {recommendation.tier}
            </span>
            <span
              className="text-[11px] text-[var(--color-text-muted)] border border-[var(--color-border-default)] rounded-[4px] px-1.5 py-0.5"
              aria-hidden="true"
            >
              {PHASE_LABELS[recommendation.phase]}
            </span>
            <span className="sr-only">
              Tier {recommendation.tier} recommendation for {PHASE_LABELS[recommendation.phase]}{" "}
              phase
            </span>
          </div>
          <p className="text-[13px] text-[var(--color-text-primary)] mb-2">
            {recommendation.observation}
          </p>
          <p className="text-[12px] text-[var(--color-text-secondary)]">
            {recommendation.implication}
          </p>
        </div>
      ) : (
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          All workflow phases have artifacts. No action needed.
        </p>
      )}
    </section>
  );
}
