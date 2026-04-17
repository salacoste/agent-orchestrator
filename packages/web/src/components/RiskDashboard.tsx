"use client";

import { useState, useEffect, useCallback } from "react";
import type { RiskDashboardResponse, RiskFactor, RiskSummary } from "@/lib/risk-aggregation";

interface ProjectOption {
  id: string;
  name: string;
}

interface RiskDashboardProps {
  projects: ProjectOption[];
}

function severityColor(label: string): string {
  switch (label) {
    case "critical":
      return "text-[var(--color-accent-red)]";
    case "high":
      return "text-[var(--color-accent-yellow)]";
    case "medium":
      return "text-[var(--color-text-secondary)]";
    default:
      return "text-[var(--color-text-muted)]";
  }
}

function severityBg(label: string): string {
  switch (label) {
    case "critical":
      return "border-[var(--color-accent-red)]/30";
    case "high":
      return "border-[var(--color-accent-yellow)]/30";
    case "medium":
      return "border-[var(--color-border)]";
    default:
      return "border-[var(--color-border-subtle)]";
  }
}

function trendIcon(trend: string): string {
  switch (trend) {
    case "improving":
      return "↓";
    case "worsening":
      return "↑";
    default:
      return "→";
  }
}

function trendColor(trend: string): string {
  switch (trend) {
    case "improving":
      return "text-[var(--color-accent-green)]";
    case "worsening":
      return "text-[var(--color-accent-red)]";
    default:
      return "text-[var(--color-text-muted)]";
  }
}

function SummaryCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div
      className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 transition-colors hover:border-[var(--color-border-hover)]"
      role="status"
      aria-label={`${label}: ${value}`}
    >
      <div className="text-[11px] text-[var(--color-text-muted)]">{label}</div>
      <div className={`mt-1 text-xl font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}

export function RiskFactorCard({
  factor,
  isExpanded,
  onToggle,
}: {
  factor: RiskFactor;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-[6px] border ${severityBg(factor.severityLabel)} bg-[var(--color-bg-surface)] px-4 py-3 transition-colors`}
    >
      <button
        onClick={onToggle}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-[5px]"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <span className={`text-[12px] ${severityColor(factor.severityLabel)}`}>
            {isExpanded ? "▼" : "▶"}
          </span>
          <span className="text-[12px] text-[var(--color-text-primary)] flex-1">
            {factor.title}
          </span>
          <span className={`text-[10px] ${trendColor(factor.trend)} font-mono`}>
            {trendIcon(factor.trend)} {factor.trend[0].toUpperCase()}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 pl-5">
          <span className="text-[10px] text-[var(--color-text-muted)]">{factor.type}</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">·</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            Severity: {factor.severity}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)]">·</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {factor.affectedProjects.length} project
            {factor.affectedProjects.length !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-2 pl-5 space-y-2">
          {factor.contributingFactors.length > 0 && (
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-1">
                Contributing Factors:
              </div>
              {factor.contributingFactors.map((f, i) => (
                <div key={i} className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                  → {f}
                </div>
              ))}
            </div>
          )}
          {factor.affectedStories.length > 0 && (
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-1">
                Affected Stories:
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                {factor.affectedStories.join(", ")}
              </div>
            </div>
          )}
          <div className="text-[10px] text-[var(--color-text-muted)] italic pt-1 border-t border-[var(--color-border-subtle)]">
            {factor.suggestedAction}
          </div>
        </div>
      )}
    </div>
  );
}

export function RiskDashboard({ projects }: RiskDashboardProps) {
  const [data, setData] = useState<RiskDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(
    (isRefresh = false) => {
      const url = selectedProject
        ? `/api/risk/dashboard?project=${encodeURIComponent(selectedProject)}`
        : "/api/risk/dashboard";

      if (isRefresh) setRefreshing(true);
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((d) => {
          setData(d as RiskDashboardResponse);
          setError(null);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load risk data");
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [selectedProject],
  );

  useEffect(() => {
    setLoading(true);
    fetchData(false);
    const interval = setInterval(() => fetchData(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const summary: RiskSummary = data?.summary ?? {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: 0,
  };

  const factors: RiskFactor[] = data?.riskFactors ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-[12px] text-[var(--color-text-muted)]">Loading risk data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[6px] border border-[var(--color-accent-red)]/30 bg-[var(--color-bg-surface)] px-4 py-3">
        <span className="text-[12px] text-[var(--color-accent-red)]">
          Error loading risk data: {error}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4" role="region" aria-label="Risk Dashboard">
      {/* Header with project filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
          Risk Dashboard
          {refreshing && (
            <span className="ml-2 text-[10px] text-[var(--color-text-muted)] animate-pulse">
              refreshing...
            </span>
          )}
        </h2>
        {projects.length > 1 && (
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="rounded-[5px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            aria-label="Filter by project"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Summary metric cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          label="Critical"
          value={summary.critical}
          colorClass="text-[var(--color-accent-red)]"
        />
        <SummaryCard
          label="High"
          value={summary.high}
          colorClass="text-[var(--color-accent-yellow)]"
        />
        <SummaryCard
          label="Medium"
          value={summary.medium}
          colorClass="text-[var(--color-text-secondary)]"
        />
        <SummaryCard label="Low" value={summary.low} colorClass="text-[var(--color-text-muted)]" />
      </div>

      {/* Risk factors list */}
      {factors.length === 0 ? (
        <div className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-6 text-center">
          <span className="text-[12px] text-[var(--color-text-muted)]">
            No risk factors identified
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {factors.map((factor) => (
            <RiskFactorCard
              key={factor.id}
              factor={factor}
              isExpanded={expandedIds.has(factor.id)}
              onToggle={() => toggleExpand(factor.id)}
            />
          ))}
        </div>
      )}

      {/* Last updated */}
      {data?.lastUpdated && (
        <div className="text-[10px] text-[var(--color-text-muted)] text-right">
          Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
