"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type OptimizationEngineResult,
  type OptimizationSuggestion,
  type OptimizationCategory,
  type OptimizationObjective,
  type ObjectiveScenarioResult,
  type ObjectiveComparisonSummary,
  type ImpactAnalysis,
} from "@/lib/optimization-types";

interface ProjectOption {
  id: string;
  name: string;
}

interface OptimizationPanelProps {
  projects: ProjectOption[];
}

const CATEGORIES: OptimizationCategory[] = [
  "agent-rebalancing",
  "wip-adjustment",
  "priority-reorder",
  "capacity-scaling",
  "underutilized-detection",
];

const CATEGORY_LABELS: Record<OptimizationCategory, string> = {
  "agent-rebalancing": "Rebalancing",
  "wip-adjustment": "WIP Adjust",
  "priority-reorder": "Priority",
  "capacity-scaling": "Capacity",
  "underutilized-detection": "Underutilized",
};

const OBJECTIVES: OptimizationObjective[] = [
  "minimize-time",
  "maximize-throughput",
  "balance-workload",
  "reduce-blocking",
];

const OBJECTIVE_LABELS: Record<OptimizationObjective, string> = {
  "minimize-time": "Minimize Time",
  "maximize-throughput": "Maximize Throughput",
  "balance-workload": "Balance Workload",
  "reduce-blocking": "Reduce Blocking",
};

function categoryBadgeClass(category: OptimizationCategory): string {
  switch (category) {
    case "agent-rebalancing":
      return "bg-[var(--color-accent-blue)] text-white";
    case "wip-adjustment":
      return "bg-[var(--color-accent-yellow)] text-[var(--color-bg-primary)]";
    case "priority-reorder":
      return "bg-[var(--color-accent-purple)] text-white";
    case "capacity-scaling":
      return "bg-[var(--color-accent-red)] text-white";
    case "underutilized-detection":
      return "bg-[var(--color-accent-green)] text-white";
  }
}

function ImpactMetrics({
  daysSaved,
  riskReductionPercent,
  utilizationDeltaPercent,
  affectedCount,
}: {
  daysSaved: number;
  riskReductionPercent: number;
  utilizationDeltaPercent: number;
  affectedCount: number;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-[11px]">
      <span className="rounded-[5px] bg-[var(--color-bg-surface)] px-1.5 py-0.5 text-[var(--color-text-secondary)]">
        {daysSaved.toFixed(1)} days saved
      </span>
      <span className="rounded-[5px] bg-[var(--color-bg-surface)] px-1.5 py-0.5 text-[var(--color-text-secondary)]">
        {riskReductionPercent.toFixed(0)}% risk reduction
      </span>
      {utilizationDeltaPercent !== 0 && (
        <span className="rounded-[5px] bg-[var(--color-bg-surface)] px-1.5 py-0.5 text-[var(--color-text-secondary)]">
          {utilizationDeltaPercent > 0 ? "+" : ""}
          {utilizationDeltaPercent}% utilization
        </span>
      )}
      {affectedCount > 0 && (
        <span className="rounded-[5px] bg-[var(--color-bg-surface)] px-1.5 py-0.5 text-[var(--color-text-muted)]">
          {affectedCount} affected
        </span>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  objectiveBadge,
  onAccept,
  onDismiss,
  impactAnalysis,
}: {
  suggestion: OptimizationSuggestion;
  objectiveBadge?: string | null;
  onAccept: (id: string, category: OptimizationCategory) => void;
  onDismiss: (id: string, category: OptimizationCategory) => void;
  impactAnalysis?: ImpactAnalysis | null;
}) {
  const affectedCount =
    suggestion.impact.affectedAgents.length +
    suggestion.impact.affectedProjects.length +
    suggestion.impact.affectedStories.length;

  const [showImpact, setShowImpact] = useState(false);

  return (
    <div
      className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 transition-colors hover:border-[var(--color-border-hover)]"
      role="article"
      aria-label={suggestion.title}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium ${categoryBadgeClass(suggestion.category)}`}
            >
              {CATEGORY_LABELS[suggestion.category]}
            </span>
            {objectiveBadge && (
              <span className="rounded-[5px] bg-[var(--color-accent-green)] px-1.5 py-0.5 text-[10px] font-medium text-white">
                {objectiveBadge}
              </span>
            )}
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {suggestion.confidence}% confidence
            </span>
          </div>
          <h4 className="mt-1 text-[13px] font-semibold text-[var(--color-text-primary)]">
            {suggestion.title}
          </h4>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
            {suggestion.description}
          </p>
          <div className="mt-2">
            <ImpactMetrics
              daysSaved={suggestion.impact.daysSaved}
              riskReductionPercent={suggestion.impact.riskReductionPercent}
              utilizationDeltaPercent={suggestion.impact.utilizationDeltaPercent}
              affectedCount={affectedCount}
            />
          </div>
          {impactAnalysis && (
            <button
              onClick={() => setShowImpact(!showImpact)}
              className="mt-1 rounded-[5px] border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)]"
              aria-expanded={showImpact}
              aria-label="Compare impact before and after"
            >
              {showImpact ? "Hide Impact" : "Compare Impact"}
            </button>
          )}
          {showImpact && impactAnalysis && (
            <ImpactDetail analysis={impactAnalysis} suggestion={suggestion} />
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col gap-1">
          <button
            onClick={() => onAccept(suggestion.id, suggestion.category)}
            className="rounded-[5px] bg-[var(--color-accent-green)] px-2 py-1 text-[10px] font-medium text-white hover:opacity-80"
            aria-label={`Accept suggestion: ${suggestion.title}`}
          >
            Accept
          </button>
          <button
            onClick={() => onDismiss(suggestion.id, suggestion.category)}
            className="rounded-[5px] border border-[var(--color-border)] px-2 py-1 text-[10px] font-medium text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)]"
            aria-label={`Dismiss suggestion: ${suggestion.title}`}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function ObjectiveComparisonPanel({ comparison }: { comparison: ObjectiveComparisonSummary }) {
  return (
    <div className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3">
      <h4 className="mb-2 text-[12px] font-semibold text-[var(--color-text-primary)]">
        Objective Comparison
      </h4>
      {comparison.objectives.length === 0 && (
        <div className="text-[11px] text-[var(--color-text-muted)]">No objectives to compare</div>
      )}
      <div className="flex flex-col gap-2">
        {comparison.objectives.map((obj) => (
          <div
            key={obj.objective}
            className="rounded-[5px] border border-[var(--color-border)] p-2"
          >
            <div className="mb-1 text-[11px] font-semibold text-[var(--color-text-primary)]">
              {OBJECTIVE_LABELS[obj.objective]}
            </div>
            <ImpactMetrics
              daysSaved={obj.projectedImpact.daysSaved}
              riskReductionPercent={obj.projectedImpact.riskReductionPercent}
              utilizationDeltaPercent={obj.projectedImpact.utilizationDeltaPercent}
              affectedCount={
                obj.projectedImpact.affectedAgents.length +
                obj.projectedImpact.affectedProjects.length +
                obj.projectedImpact.affectedStories.length
              }
            />
            <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">
              Top: {obj.topSuggestions.map((s) => s.title).join(", ")}
            </div>
          </div>
        ))}
      </div>
      {comparison.baselineTopSuggestions.length > 0 && (
        <div className="mt-2 border-t border-[var(--color-border)] pt-2">
          <div className="text-[10px] font-semibold text-[var(--color-text-muted)]">
            Baseline (no objective)
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)]">
            {comparison.baselineTopSuggestions.map((s) => s.title).join(", ")}
          </div>
        </div>
      )}
      <div className="mt-2 text-[10px] text-[var(--color-text-muted)]">
        Compared in {comparison.analysisTimeMs}ms
      </div>
    </div>
  );
}

function BeforeAfterComparison({
  before,
  after,
  inverted = false,
}: {
  before: number;
  after: number;
  /** When true, a decrease is positive (e.g. risk score: lower = better) */
  inverted?: boolean;
}) {
  const delta = Math.round((after - before) * 10) / 10;
  const isPositive = inverted ? delta <= 0 : delta >= 0;
  return (
    <span
      className={isPositive ? "text-[var(--color-accent-green)]" : "text-[var(--color-accent-red)]"}
    >
      {before} → {after} ({isPositive ? "+" : ""}
      {delta})
    </span>
  );
}

function ImpactDetail({
  analysis,
  suggestion,
}: {
  analysis: ImpactAnalysis;
  suggestion: OptimizationSuggestion;
}) {
  return (
    <div className="mt-2 rounded-[5px] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-2">
      <h5 className="mb-1 text-[11px] font-semibold text-[var(--color-text-primary)]">
        Impact Analysis
      </h5>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
        <div>
          <span className="text-[var(--color-text-muted)]">Completion:</span>{" "}
          <span className="text-[var(--color-text-primary)]">
            {analysis.completionDateShift > 0 ? "-" : "+"}
            {Math.abs(analysis.completionDateShift).toFixed(1)} days
          </span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Velocity:</span>{" "}
          <BeforeAfterComparison
            before={analysis.beforeMetrics.velocity}
            after={analysis.afterMetrics.velocity}
          />
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Risk Score:</span>{" "}
          <BeforeAfterComparison
            before={analysis.beforeMetrics.riskScore}
            after={analysis.afterMetrics.riskScore}
            inverted
          />
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Utilization:</span>{" "}
          <BeforeAfterComparison
            before={analysis.beforeMetrics.utilizationPercent}
            after={analysis.afterMetrics.utilizationPercent}
          />
        </div>
      </div>
      {suggestion.impact.affectedProjects.length > 0 && (
        <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">
          Projects: {suggestion.impact.affectedProjects.join(", ")}
        </div>
      )}
      {suggestion.impact.affectedStories.length > 0 && (
        <div className="text-[10px] text-[var(--color-text-muted)]">
          Stories: {suggestion.impact.affectedStories.length} affected
        </div>
      )}
      {suggestion.impact.affectedAgents.length > 0 && (
        <div className="text-[10px] text-[var(--color-text-muted)]">
          Agents: {suggestion.impact.affectedAgents.join(", ")}
        </div>
      )}
    </div>
  );
}

export function OptimizationPanel({ projects: _projects }: OptimizationPanelProps) {
  const [result, setResult] = useState<OptimizationEngineResult | null>(null);
  const [scenarioResult, setScenarioResult] = useState<ObjectiveScenarioResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ObjectiveComparisonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [impactMap, setImpactMap] = useState<Map<string, ImpactAnalysis>>(new Map());
  const [activeCategory, setActiveCategory] = useState<OptimizationCategory | "all">("all");
  const [activeObjective, setActiveObjective] = useState<OptimizationObjective | "baseline">(
    "baseline",
  );
  const [showComparison, setShowComparison] = useState(false);
  // projects prop available for future project-scoped filtering
  void _projects;

  const fetchBaseline = useCallback(async () => {
    try {
      const resp = await fetch("/api/risk/optimization");
      if (!resp.ok) throw new Error("Failed to fetch optimization suggestions");
      const data: OptimizationEngineResult = await resp.json();
      setResult(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading optimization data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchObjective = useCallback(async (objective: OptimizationObjective) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch(`/api/risk/optimization?objective=${objective}`);
      if (!resp.ok) throw new Error("Failed to fetch objective scenario");
      const data: ObjectiveScenarioResult = await resp.json();
      setScenarioResult(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading objective scenario");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchImpact = useCallback(async (suggestionId?: string) => {
    try {
      const url = suggestionId
        ? `/api/risk/optimization?impact=true&suggestionId=${suggestionId}`
        : "/api/risk/optimization?impact=true";
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Failed to fetch impact analysis");
      const data = await resp.json();
      if (data.impactAnalysis && data.suggestion) {
        // Single suggestion response
        setImpactMap((prev) => {
          const next = new Map(prev);
          next.set(data.suggestion.id, data.impactAnalysis);
          return next;
        });
      } else if (Array.isArray(data.suggestions)) {
        // All suggestions response — build map from SuggestionImpactDetail[]
        const map = new Map<string, ImpactAnalysis>();
        for (const detail of data.suggestions) {
          if (detail.suggestion && detail.impactAnalysis) {
            map.set(detail.suggestion.id, detail.impactAnalysis);
          }
        }
        setImpactMap(map);
      }
    } catch {
      // Impact analysis is optional — don't set error state
    }
  }, []);

  const fetchComparison = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/risk/optimization?compare=true");
      if (!resp.ok) throw new Error("Failed to fetch objective comparison");
      const data: ObjectiveComparisonSummary = await resp.json();
      setComparisonResult(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading comparison");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBaseline();
    fetchImpact();
  }, [fetchBaseline, fetchImpact]);

  const handleObjectiveChange = useCallback(
    (value: OptimizationObjective | "baseline") => {
      setActiveObjective(value);
      setShowComparison(false);
      setComparisonResult(null);
      setScenarioResult(null);
      if (value === "baseline") {
        setResult(null);
        setLoading(true);
        fetchBaseline();
      } else {
        fetchObjective(value);
      }
    },
    [fetchBaseline, fetchObjective],
  );

  const handleCompareToggle = useCallback(() => {
    const next = !showComparison;
    setShowComparison(next);
    if (next) {
      setActiveObjective("baseline");
      setScenarioResult(null);
      fetchComparison();
    } else {
      setComparisonResult(null);
    }
  }, [showComparison, fetchComparison]);

  const resetLearning = useCallback(() => {
    if (!window.confirm("Reset learning model? This will clear all feedback history.")) return;
    fetch("/api/risk/optimization", { method: "DELETE" })
      .then(() => fetchBaseline())
      .catch(() => {
        // Reset is best-effort
      });
  }, [fetchBaseline]);

  // Active suggestions: from scenario result or baseline result
  const activeSuggestions = scenarioResult?.suggestions ?? result?.suggestions ?? [];

  // Client-side category filtering
  const filteredSuggestions =
    activeSuggestions.filter((s) => activeCategory === "all" || s.category === activeCategory) ??
    [];

  const analysisMs = scenarioResult?.analysisTimeMs ?? result?.analysisTimeMs ?? 0;

  const handleAction = useCallback(
    async (
      suggestionId: string,
      action: "accepted" | "dismissed",
      category: OptimizationCategory,
    ) => {
      try {
        const resp = await fetch("/api/risk/optimization", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId, action, category }),
        });
        if (!resp.ok) throw new Error(`Failed to ${action} suggestion`);
        // Remove from whichever result is active
        setResult((prev) =>
          prev
            ? {
                ...prev,
                suggestions: prev.suggestions.filter((s) => s.id !== suggestionId),
              }
            : null,
        );
        setScenarioResult((prev) =>
          prev
            ? {
                ...prev,
                suggestions: prev.suggestions.filter((s) => s.id !== suggestionId),
              }
            : null,
        );
      } catch {
        setError(`Failed to ${action} suggestion. Please try again.`);
      }
    },
    [],
  );

  const handleAccept = useCallback(
    (id: string, category: OptimizationCategory) => handleAction(id, "accepted", category),
    [handleAction],
  );

  const handleDismiss = useCallback(
    (id: string, category: OptimizationCategory) => handleAction(id, "dismissed", category),
    [handleAction],
  );

  const objectiveBadge = activeObjective !== "baseline" ? OBJECTIVE_LABELS[activeObjective] : null;

  return (
    <section aria-label="Optimization Suggestions">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          Optimization Suggestions
        </h3>
        {(result || scenarioResult) && (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            Analysis completed in {analysisMs}ms
          </span>
        )}
      </div>

      {/* Objective selector */}
      <div className="mb-2 flex items-center gap-2">
        <label
          htmlFor="objective-select"
          className="text-[11px] font-medium text-[var(--color-text-secondary)]"
        >
          Objective:
        </label>
        <select
          id="objective-select"
          value={activeObjective}
          onChange={(e) =>
            handleObjectiveChange(e.target.value as OptimizationObjective | "baseline")
          }
          className="rounded-[5px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-0.5 text-[11px] text-[var(--color-text-primary)]"
          aria-label="Select optimization objective"
        >
          <option value="baseline">Baseline (Default)</option>
          {OBJECTIVES.map((obj) => (
            <option key={obj} value={obj}>
              {OBJECTIVE_LABELS[obj]}
            </option>
          ))}
        </select>
        <button
          onClick={handleCompareToggle}
          className={`rounded-[5px] px-2 py-0.5 text-[11px] font-medium ${showComparison ? "bg-[var(--color-accent-purple)] text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}
          aria-label="Compare all objectives"
          aria-pressed={showComparison}
        >
          Compare Objectives
        </button>
        <button
          onClick={resetLearning}
          className="rounded-[5px] border border-[var(--color-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)] hover:border-[var(--color-accent-red)] hover:text-[var(--color-accent-red)]"
          aria-label="Reset learning model"
        >
          Reset Learning
        </button>
      </div>

      {/* Category filter chips */}
      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Filter by category">
        <button
          onClick={() => setActiveCategory("all")}
          className={`rounded-[5px] px-2 py-0.5 text-[11px] font-medium ${activeCategory === "all" ? "bg-[var(--color-accent-blue)] text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-[5px] px-2 py-0.5 text-[11px] font-medium ${activeCategory === cat ? "bg-[var(--color-accent-blue)] text-white" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-[12px] text-[var(--color-text-muted)]">
          Loading optimization suggestions...
        </div>
      )}

      {error && (
        <div className="rounded-[6px] border border-[var(--color-accent-red)] bg-[var(--color-bg-surface)] p-3 text-[12px] text-[var(--color-accent-red)]">
          Error loading optimization data: {error}
        </div>
      )}

      {!loading && !error && filteredSuggestions.length === 0 && !showComparison && (
        <div className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 text-[12px] text-[var(--color-text-muted)]">
          No optimization suggestions available
        </div>
      )}

      {showComparison && comparisonResult && !loading && (
        <ObjectiveComparisonPanel comparison={comparisonResult} />
      )}

      {!loading && !error && !showComparison && (
        <div className="flex flex-col gap-2">
          {filteredSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              objectiveBadge={objectiveBadge}
              onAccept={handleAccept}
              onDismiss={handleDismiss}
              impactAnalysis={impactMap.get(suggestion.id) ?? null}
            />
          ))}
        </div>
      )}
    </section>
  );
}
