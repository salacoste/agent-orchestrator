"use client";

/**
 * Model cost breakdown panel for session detail view (Story 60.6).
 *
 * Shows per-tier token usage and estimated cost with proportional bars.
 * Uses polling via useCostData hook (no SSE — API is REST-only).
 */

import { useCostData, type CostSummary, type ModelTier } from "@/hooks/useCostData";
import { ActivityDot } from "./ActivityDot";

const TIER_ORDER: ModelTier[] = ["low", "medium", "high"];

const TIER_COLORS: Record<ModelTier, string> = {
  low: "var(--color-status-ready)",
  medium: "var(--color-status-attention)",
  high: "var(--color-status-error)",
};

const TIER_LABELS: Record<ModelTier, string> = {
  low: "Haiku",
  medium: "Sonnet",
  high: "Opus",
};

function formatCost(usd: number): string {
  if (usd < 0) return `-$${Math.abs(usd).toFixed(2)}`;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface TierRowProps {
  tier: ModelTier;
  tokens: number;
  cost: number;
  sessions: number;
  totalTokens: number;
}

function TierRow({ tier, tokens, cost, sessions, totalTokens }: TierRowProps) {
  const barWidth = totalTokens > 0 ? Math.max(1, (tokens / totalTokens) * 100) : 1;
  const color = TIER_COLORS[tier];
  const label = TIER_LABELS[tier];

  return (
    <div className="flex items-center gap-2 py-1.5" data-testid={`tier-${tier}`}>
      <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: color }} />
      <span className="text-[12px] font-medium text-[var(--color-text-primary)] w-16">{label}</span>
      <span className="text-[11px] text-[var(--color-text-secondary)] w-24 text-right font-[var(--font-mono)]">
        {tokens.toLocaleString()}
      </span>
      <span className="text-[11px] text-[var(--color-text-secondary)] w-16 text-right">
        {formatCost(cost)}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)]">
        <div
          className="h-full rounded-full"
          role="progressbar"
          aria-valuenow={Math.round(barWidth)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} token usage`}
          style={{
            width: `${barWidth}%`,
            background: color,
            transition: "width 300ms ease",
          }}
        />
      </div>
      <span
        className="text-[10px] text-[var(--color-text-tertiary)] w-8 text-right"
        aria-label={`${sessions} sessions`}
      >
        {sessions}s
      </span>
    </div>
  );
}

function CostContent({ summary }: { summary: CostSummary }) {
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-3">
        <span className="text-[var(--color-text-muted)]">Total tokens:</span>
        <span className="font-[var(--font-mono)]">{summary.totalTokens.toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-[12px] mb-4">
        <span className="text-[var(--color-text-muted)]">Estimated cost:</span>
        <span>{formatCost(summary.totalCost)}</span>
      </div>
      {TIER_ORDER.map((tier) => {
        const data = summary.byTier[tier];
        return (
          <TierRow
            key={tier}
            tier={tier}
            tokens={data.tokens}
            cost={data.cost}
            sessions={data.sessions}
            totalTokens={summary.totalTokens}
          />
        );
      })}
    </div>
  );
}

/**
 * Model cost breakdown dashboard panel.
 * Shows per-tier (Haiku/Sonnet/Opus) token usage and cost with proportional bars.
 */
export function CostBreakdownPanel() {
  const { summary, loading, error } = useCostData();

  return (
    <div
      data-testid="cost-breakdown-panel"
      className="detail-card rounded-[8px] border border-[var(--color-border-default)] p-5 mb-6"
      role="region"
      aria-labelledby="cost-breakdown-heading"
    >
      <h2
        id="cost-breakdown-heading"
        className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3 flex items-center gap-1.5"
      >
        Model Cost
        <ActivityDot activity={summary ? "active" : "idle"} dotOnly size={6} />
      </h2>

      {summary ? (
        <>
          {error && (
            <p className="text-[11px] text-[var(--color-status-attention)] mb-2" role="alert">
              Warning: data may be stale ({error})
            </p>
          )}
          <CostContent summary={summary} />
        </>
      ) : loading ? (
        <p className="text-[12px] text-[var(--color-text-secondary)]">Loading cost data...</p>
      ) : error ? (
        <p className="text-[12px] text-[var(--color-status-error)]" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-[12px] text-[var(--color-text-secondary)]">No cost data available.</p>
      )}
    </div>
  );
}
