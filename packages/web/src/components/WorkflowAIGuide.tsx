import { recordFeedback } from "@/lib/workflow/recommendation-feedback";
import { PHASE_LABELS, type Phase, type Recommendation } from "@/lib/workflow/types";

interface WorkflowAIGuideProps {
  recommendation: Recommendation | null;
}

/** Action metadata for the "Next Step" CTA button. */
interface RecommendationAction {
  label: string;
  description: string;
}

/** Map recommendation phase → actionable CTA label and description. */
const RECOMMENDATION_ACTIONS: Record<Phase, RecommendationAction> = {
  analysis: {
    label: "Create Brief",
    description: "Start with a product brief to capture project vision",
  },
  planning: { label: "Create PRD", description: "Document detailed product requirements" },
  solutioning: {
    label: "Design Architecture",
    description: "Define technical architecture and create epics",
  },
  implementation: {
    label: "Start Sprint",
    description: "Begin sprint execution with agents",
  },
};

/**
 * Get the CTA action for a recommendation.
 * Exported for testing.
 */
export function getRecommendationAction(recommendation: Recommendation): RecommendationAction {
  return RECOMMENDATION_ACTIONS[recommendation.phase];
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
  const action = recommendation ? getRecommendationAction(recommendation) : null;

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
          {recommendation.blockers && recommendation.blockers.length > 0 && (
            <details className="mt-3" data-testid="reasoning-details">
              <summary className="text-[11px] text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)] select-none">
                Show reasoning ({recommendation.blockers.length} check
                {recommendation.blockers.length !== 1 ? "s" : ""})
              </summary>
              <ul className="mt-2 space-y-1" role="list" aria-label="Recommendation reasoning">
                {recommendation.blockers.map((b) => (
                  <li key={b.guardId} className="text-[11px] flex items-center gap-1.5">
                    <span aria-hidden="true">{b.satisfied ? "✅" : "❌"}</span>
                    <span className="sr-only">{b.satisfied ? "Satisfied" : "Not satisfied"}:</span>
                    <span
                      className={
                        b.satisfied
                          ? "text-[var(--color-text-secondary)]"
                          : "text-[var(--color-text-primary)] font-medium"
                      }
                    >
                      {b.description}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-3 flex items-center gap-2">
            {action && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[12px] font-semibold bg-[var(--color-status-success)] text-white hover:opacity-90 transition-opacity"
                data-testid="next-step-button"
                aria-label={`Next step: ${action.label}`}
                onClick={() => {
                  recordFeedback({
                    phase: recommendation.phase,
                    tier: recommendation.tier,
                    action: "accepted",
                    timestamp: new Date().toISOString(),
                  });
                  const phaseBar = document.querySelector('[aria-label="Phase progression"]');
                  phaseBar?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {action.label}
                <span aria-hidden="true">→</span>
              </button>
            )}
            <button
              type="button"
              className="px-2 py-1.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors rounded"
              data-testid="dismiss-recommendation"
              aria-label="Dismiss recommendation"
              title="Dismiss this suggestion"
              onClick={() => {
                recordFeedback({
                  phase: recommendation.phase,
                  tier: recommendation.tier,
                  action: "dismissed",
                  timestamp: new Date().toISOString(),
                });
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          All workflow phases have artifacts. No action needed.
        </p>
      )}
    </section>
  );
}
