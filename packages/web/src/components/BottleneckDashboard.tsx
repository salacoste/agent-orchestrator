"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  BottleneckDashboardResponse,
  BottleneckItem,
  BottleneckSummary,
} from "@/lib/bottleneck-aggregation";

interface ProjectOption {
  id: string;
  name: string;
}

interface BottleneckDashboardProps {
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

function typeLabel(type: string): string {
  switch (type) {
    case "column-bottleneck":
      return "Column";
    case "stuck-stories":
      return "Stuck";
    case "wip-violation":
      return "WIP";
    case "throughput-drop":
      return "Throughput";
    case "agent-overload":
      return "Overload";
    case "capacity-bottleneck":
      return "Capacity";
    case "resource-conflict":
      return "Conflict";
    case "unassigned-stories":
      return "Unassigned";
    case "aging-stories":
      return "Aging";
    case "bottleneck-trend":
      return "Trend";
    default:
      return type;
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

export function BottleneckCard({
  item,
  isExpanded,
  onToggle,
}: {
  item: BottleneckItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-[6px] border ${severityBg(item.severityLabel)} bg-[var(--color-bg-surface)] px-4 py-3 transition-colors`}
    >
      <button
        onClick={onToggle}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-[5px]"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <span className={`text-[12px] ${severityColor(item.severityLabel)}`}>
            {isExpanded ? "▼" : "▶"}
          </span>
          <span className="text-[12px] text-[var(--color-text-primary)] flex-1">{item.title}</span>
          <span className={`text-[10px] ${trendColor(item.trend)} font-mono`}>
            {trendIcon(item.trend)} {item.trend[0]?.toUpperCase()}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 pl-5">
          <span className="text-[10px] text-[var(--color-text-muted)]">{typeLabel(item.type)}</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">·</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            Impact: {item.impact.impactScore}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)]">·</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {item.affectedProjects.length} project
            {item.affectedProjects.length !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-2 pl-5 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[var(--color-text-muted)]">
              Stories affected: {item.impact.storiesAffected}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)]">·</span>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              Est. delay: {item.impact.estimatedDelayDays}d
            </span>
          </div>
          {item.contributingFactors.length > 0 && (
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-1">
                Contributing Factors:
              </div>
              {item.contributingFactors.map((f, i) => (
                <div key={i} className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                  → {f}
                </div>
              ))}
            </div>
          )}
          {item.affectedStories.length > 0 && (
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-1">
                Affected Stories:
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                {item.affectedStories.join(", ")}
              </div>
            </div>
          )}
          <div className="text-[10px] text-[var(--color-text-muted)] italic pt-1 border-t border-[var(--color-border-subtle)]">
            {item.suggestedAction}
          </div>
        </div>
      )}
    </div>
  );
}

export function BottleneckDashboard({ projects }: BottleneckDashboardProps) {
  const [data, setData] = useState<BottleneckDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(
    (isRefresh = false) => {
      const url = selectedProject
        ? `/api/risk/bottleneck?project=${encodeURIComponent(selectedProject)}`
        : "/api/risk/bottleneck";

      if (isRefresh) setRefreshing(true);
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((d) => {
          setData(d as BottleneckDashboardResponse);
          setError(null);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load bottleneck data");
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

  const summary: BottleneckSummary = data?.summary ?? {
    stuckStories: 0,
    wipViolations: 0,
    agingStories: 0,
    overloadedAgents: 0,
    resourceConflicts: 0,
    totalBottlenecks: 0,
  };

  const bottlenecks: BottleneckItem[] = data?.bottlenecks ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-[12px] text-[var(--color-text-muted)]">
          Loading bottleneck data...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[6px] border border-[var(--color-accent-red)]/30 bg-[var(--color-bg-surface)] px-4 py-3">
        <span className="text-[12px] text-[var(--color-accent-red)]">
          Error loading bottleneck data: {error}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4" role="region" aria-label="Bottleneck Analysis">
      {/* Header with project filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
          Bottleneck Analysis
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard
          label="Stuck Stories"
          value={summary.stuckStories}
          colorClass="text-[var(--color-accent-red)]"
        />
        <SummaryCard
          label="WIP Violations"
          value={summary.wipViolations}
          colorClass="text-[var(--color-accent-yellow)]"
        />
        <SummaryCard
          label="Aging Stories"
          value={summary.agingStories}
          colorClass="text-[var(--color-accent-yellow)]"
        />
        <SummaryCard
          label="Overloaded"
          value={summary.overloadedAgents}
          colorClass="text-[var(--color-accent-red)]"
        />
        <SummaryCard
          label="Conflicts"
          value={summary.resourceConflicts}
          colorClass="text-[var(--color-text-secondary)]"
        />
      </div>

      {/* Bottleneck items list */}
      {bottlenecks.length === 0 ? (
        <div className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-6 text-center">
          <span className="text-[12px] text-[var(--color-text-muted)]">
            No bottlenecks identified
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {bottlenecks.map((item) => (
            <BottleneckCard
              key={item.id}
              item={item}
              isExpanded={expandedIds.has(item.id)}
              onToggle={() => toggleExpand(item.id)}
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
