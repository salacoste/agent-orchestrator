"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  PortfolioUtilizationOverview,
  ProjectUtilizationSummary,
} from "@/lib/utilization-metrics-types";

interface ProjectOption {
  id: string;
  name: string;
}

interface UtilizationMetricsPanelProps {
  projects: ProjectOption[];
}

function utilizationColor(pct: number): string {
  if (pct > 90) return "text-[var(--color-accent-red)]";
  if (pct < 30) return "text-[var(--color-accent-yellow)]";
  return "text-[var(--color-accent-green)]";
}

function utilizationBarColor(pct: number): string {
  if (pct > 90) return "bg-[var(--color-accent-red)]";
  if (pct < 30) return "bg-[var(--color-accent-yellow)]";
  return "bg-[var(--color-accent-green)]";
}

function MetricCard({
  label,
  value,
  unit,
  colorClass,
}: {
  label: string;
  value: number;
  unit?: string;
  colorClass: string;
}) {
  return (
    <div
      className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 transition-colors hover:border-[var(--color-border-hover)]"
      role="status"
      aria-label={`${label}: ${value}${unit ?? ""}`}
    >
      <div className="text-[11px] text-[var(--color-text-muted)]">{label}</div>
      <div className={`mt-1 text-xl font-bold ${colorClass}`}>
        {value}
        {unit && <span className="text-[11px] font-normal">{unit}</span>}
      </div>
    </div>
  );
}

function UtilizationBar({ percent }: { percent: number }) {
  return (
    <div
      className="h-1.5 w-full rounded-full bg-[var(--color-border-subtle)]"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all ${utilizationBarColor(percent)}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function ProjectCard({ summary }: { summary: ProjectUtilizationSummary }) {
  return (
    <div className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">
          {summary.projectId}
        </span>
        <span className={`text-[12px] font-mono ${utilizationColor(summary.avgUtilization)}`}>
          {summary.avgUtilization}%
        </span>
      </div>
      <UtilizationBar percent={summary.avgUtilization} />
      <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
        <span>
          {summary.agentCount} agent{summary.agentCount !== 1 ? "s" : ""}
        </span>
        {summary.overutilizedCount > 0 && (
          <span className="text-[var(--color-accent-red)]">{summary.overutilizedCount} over</span>
        )}
        {summary.underutilizedCount > 0 && (
          <span className="text-[var(--color-accent-yellow)]">
            {summary.underutilizedCount} under
          </span>
        )}
        {summary.poolBreakdown && (
          <span>
            {summary.poolBreakdown.activePoolAgents}/{summary.poolBreakdown.totalPoolAgents} pool
          </span>
        )}
      </div>
    </div>
  );
}

export function UtilizationMetricsPanel({ projects }: UtilizationMetricsPanelProps) {
  const [overview, setOverview] = useState<PortfolioUtilizationOverview | null>(null);
  const [projectDetail, setProjectDetail] = useState<{
    projectSummary: ProjectUtilizationSummary;
    timestamp: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedWindow, setSelectedWindow] = useState<string>("24h");

  const fetchData = useCallback(
    (isRefresh = false) => {
      const params = new URLSearchParams();
      if (selectedProject) params.set("project", selectedProject);
      if (selectedWindow) params.set("window", selectedWindow);
      const qs = params.toString();
      const url = `/api/risk/utilization${qs ? `?${qs}` : ""}`;

      if (isRefresh) setRefreshing(true);
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((d) => {
          if (selectedProject) {
            setProjectDetail(d as { projectSummary: ProjectUtilizationSummary; timestamp: number });
            setOverview(null);
          } else {
            setOverview(d as PortfolioUtilizationOverview);
            setProjectDetail(null);
          }
          setError(null);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load utilization data");
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [selectedProject, selectedWindow],
  );

  useEffect(() => {
    setLoading(true);
    fetchData(false);
    const interval = setInterval(() => fetchData(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-[12px] text-[var(--color-text-muted)]">
          Loading utilization metrics...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[6px] border border-[var(--color-accent-red)]/30 bg-[var(--color-bg-surface)] px-4 py-3">
        <span className="text-[12px] text-[var(--color-accent-red)]">
          Error loading utilization data: {error}
        </span>
      </div>
    );
  }

  const isProjectMode = selectedProject && projectDetail;
  const summary = isProjectMode && projectDetail ? projectDetail.projectSummary : null;

  return (
    <div className="space-y-4" role="region" aria-label="Resource Utilization">
      {/* Header with filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
          Resource Utilization
          {refreshing && (
            <span className="ml-2 text-[10px] text-[var(--color-text-muted)] animate-pulse">
              refreshing...
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
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
          <select
            value={selectedWindow}
            onChange={(e) => setSelectedWindow(e.target.value)}
            className="rounded-[5px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            aria-label="Time window"
          >
            <option value="1h">1h</option>
            <option value="24h">24h</option>
            <option value="7d">7d</option>
          </select>
        </div>
      </div>

      {/* Portfolio overview metrics */}
      {overview && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard
              label="Total Agents"
              value={overview.totalAgents}
              colorClass="text-[var(--color-text-primary)]"
            />
            <MetricCard
              label="Avg Utilization"
              value={overview.avgUtilization}
              unit="%"
              colorClass={utilizationColor(overview.avgUtilization)}
            />
            <MetricCard
              label="Overutilized"
              value={overview.overutilizedAgents}
              colorClass="text-[var(--color-accent-red)]"
            />
            <MetricCard
              label="Underutilized"
              value={overview.underutilizedAgents}
              colorClass="text-[var(--color-accent-yellow)]"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {overview.projectSummaries.map((ps) => (
              <ProjectCard key={ps.projectId} summary={ps} />
            ))}
          </div>
        </>
      )}

      {/* Single-project detail view */}
      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard
              label="Agents"
              value={summary.agentCount}
              colorClass="text-[var(--color-text-primary)]"
            />
            <MetricCard
              label="Avg Utilization"
              value={summary.avgUtilization}
              unit="%"
              colorClass={utilizationColor(summary.avgUtilization)}
            />
            <MetricCard
              label="Overutilized"
              value={summary.overutilizedCount}
              colorClass="text-[var(--color-accent-red)]"
            />
            <MetricCard
              label="Underutilized"
              value={summary.underutilizedCount}
              colorClass="text-[var(--color-accent-yellow)]"
            />
          </div>

          {/* Agent rows */}
          {summary.agentSnapshots.length === 0 ? (
            <div className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-6 text-center">
              <span className="text-[12px] text-[var(--color-text-muted)]">
                No agent data available
              </span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {summary.agentSnapshots.map((agent) => (
                <div
                  key={agent.agentId}
                  className="flex items-center gap-3 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2"
                >
                  <span
                    className="text-[11px] text-[var(--color-text-primary)] font-mono w-28 truncate"
                    title={agent.agentId}
                  >
                    {agent.agentId}
                  </span>
                  <div className="flex-1">
                    <UtilizationBar percent={agent.utilizationPercent} />
                  </div>
                  <span
                    className={`text-[11px] font-mono w-12 text-right ${utilizationColor(agent.utilizationPercent)}`}
                  >
                    {agent.utilizationPercent}%
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] w-8 text-right">
                    {agent.isActive ? "active" : "idle"}
                  </span>
                  {agent.isPoolAgent && (
                    <span className="text-[9px] text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-1.5 py-0.5 rounded-[3px]">
                      pool
                    </span>
                  )}
                  {(agent.isAtCapacity || agent.isNearCapacity) && (
                    <span className="text-[9px] text-[var(--color-accent-red)] bg-[var(--color-accent-red)]/10 px-1.5 py-0.5 rounded-[3px]">
                      {agent.isAtCapacity ? "full" : "near"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Last updated */}
      {(overview?.timestamp ?? projectDetail?.timestamp) ? (
        <div className="text-[10px] text-[var(--color-text-muted)] text-right">
          Last updated:{" "}
          {new Date(
            overview?.timestamp ?? projectDetail?.timestamp ?? Date.now(),
          ).toLocaleTimeString()}
        </div>
      ) : null}
    </div>
  );
}
