"use client";

import { useState, useEffect, useCallback } from "react";
import { RiskAlertBanner } from "./RiskAlertBanner";
import { useRiskAlertSSE } from "@/hooks/useRiskAlertSSE";

interface ProjectOption {
  id: string;
  name: string;
}

interface RiskScoreContributor {
  id: string;
  title: string;
  type: string;
  score: number;
  weight: number;
  contributionPercent: number;
}

interface EmergingRisk {
  id: string;
  type: string;
  title: string;
  status: "emerging";
  severity: number;
  trajectory: "improving" | "stable" | "worsening";
  pattern: string;
  detectedAt: string;
  cause: string;
  suggestedAction: string;
  projectId: string;
  contributingFactors: string[];
}

interface PortfolioResponse {
  scores: Array<{
    projectId: string;
    projectName?: string;
    score: number;
    severityLabel: string;
    factorCount: number;
    bottleneckCount: number;
    emergingRisks?: EmergingRisk[];
    contributors?: RiskScoreContributor[];
  }>;
  portfolioScore: number;
  portfolioSeverityLabel: string;
  lastUpdated: string;
}

interface RiskScorePanelProps {
  projects: ProjectOption[];
}

interface RiskScoreCardProps {
  projectId: string;
  projectName?: string;
  score: number;
  severityLabel: string;
  factorCount: number;
  bottleneckCount: number;
  contributors?: RiskScoreContributor[];
  emergingRisks?: EmergingRisk[];
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
      return "bg-[var(--color-accent-red)]/15 border-[var(--color-accent-red)]/30";
    case "high":
      return "bg-[var(--color-accent-yellow)]/15 border-[var(--color-accent-yellow)]/30";
    case "medium":
      return "bg-[var(--color-surface-raised)] border-[var(--color-border)]";
    default:
      return "bg-[var(--color-surface-raised)] border-[var(--color-border-subtle)]";
  }
}

function trajectoryIcon(trajectory: string): string {
  switch (trajectory) {
    case "worsening":
      return "\u25BC";
    case "improving":
      return "\u25B2";
    default:
      return "\u25CF";
  }
}

function trajectoryColor(trajectory: string): string {
  switch (trajectory) {
    case "worsening":
      return "text-[var(--color-accent-red)]";
    case "improving":
      return "text-[var(--color-accent-green)]";
    default:
      return "text-[var(--color-text-muted)]";
  }
}

export function EmergingRiskCard({ risk }: { risk: EmergingRisk }) {
  return (
    <div className="rounded-[5px] border border-[var(--color-accent-yellow)]/30 bg-[var(--color-accent-yellow)]/5 p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium">
          <span className={trajectoryColor(risk.trajectory)} style={{ marginRight: "4px" }}>
            {trajectoryIcon(risk.trajectory)}
          </span>
          {risk.title}
        </span>
        <span className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
          {risk.severity}
        </span>
      </div>
      <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
        {risk.pattern}
      </div>
      <div className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
        {risk.cause}
      </div>
      <div className="text-[10px] mt-1" style={{ color: "var(--color-accent-green)" }}>
        {risk.suggestedAction}
      </div>
    </div>
  );
}

export function RiskScoreCard({
  projectName,
  score,
  severityLabel,
  factorCount,
  bottleneckCount,
  contributors,
  emergingRisks,
}: RiskScoreCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setExpanded(!expanded)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded(!expanded);
        }
      }}
      className={`rounded-[6px] border p-3 cursor-pointer transition-colors ${severityBg(severityLabel)}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`font-mono font-bold ${severityColor(severityLabel)}`}
            style={{ fontSize: "24px" }}
          >
            {score}
          </span>
          <span className={`text-xs font-medium uppercase ${severityColor(severityLabel)}`}>
            {severityLabel}
          </span>
          {projectName && (
            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {projectName}
            </span>
          )}
        </div>
        <div
          className="flex items-center gap-2 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>{factorCount} factors</span>
          <span>{bottleneckCount} bottlenecks</span>
          {emergingRisks && emergingRisks.length > 0 && (
            <span className="text-[var(--color-accent-yellow)]">
              {emergingRisks.length} emerging
            </span>
          )}
        </div>
      </div>

      {expanded && emergingRisks && emergingRisks.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
          <div className="text-xs font-medium mb-2" style={{ color: "var(--color-accent-yellow)" }}>
            Emerging Risks
          </div>
          <div className="space-y-2">
            {emergingRisks.map((risk) => (
              <EmergingRiskCard key={risk.id} risk={risk} />
            ))}
          </div>
        </div>
      )}

      {expanded && contributors && contributors.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
          <div className="text-xs font-medium mb-2" style={{ color: "var(--color-text-muted)" }}>
            Top Contributors
          </div>
          {contributors.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-1">
              <span className="text-sm">{c.title}</span>
              <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                {c.contributionPercent}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RiskScorePanel({ projects }: RiskScorePanelProps) {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // SSE-driven live alerts + server acknowledge
  const { activeAlerts, acknowledge: sseAcknowledge } = useRiskAlertSSE();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/risk/score");
      if (!res.ok) {
        setError(`Error: ${res.status}`);
        return;
      }
      const json = await res.json();
      setData(json as PortfolioResponse);
    } catch {
      setError("Error fetching risk scores");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAcknowledge = useCallback(
    async (alertId: string) => {
      try {
        const res = await fetch("/api/risk/alerts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alertId, action: "acknowledge" }),
        });
        if (res.ok) {
          sseAcknowledge(alertId);
        }
      } catch {
        // Acknowledge failure is non-fatal
      }
    },
    [sseAcknowledge],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="rounded-[6px] border border-[var(--color-border-subtle)] p-4">
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Loading risk scores...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[6px] border border-[var(--color-accent-red)]/30 p-4">
        <div className="text-sm text-[var(--color-accent-red)]">{error}</div>
      </div>
    );
  }

  if (!data || data.scores.length === 0) {
    return (
      <div className="rounded-[6px] border border-[var(--color-border-subtle)] p-4">
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          No projects to score
        </div>
      </div>
    );
  }

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-3">
      <RiskAlertBanner alerts={activeAlerts} onAcknowledge={handleAcknowledge} />

      <div className="flex items-center justify-between">
        <h3 className="font-medium" style={{ fontSize: "14px" }}>
          Portfolio Risk Score
        </h3>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold" style={{ fontSize: "20px" }}>
            {data.portfolioScore}
          </span>
          <span
            className={`text-xs font-medium uppercase ${severityColor(data.portfolioSeverityLabel)}`}
          >
            {data.portfolioSeverityLabel}
          </span>
        </div>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
      >
        {data.scores.map((s) => (
          <RiskScoreCard
            key={s.projectId}
            projectId={s.projectId}
            projectName={projectMap.get(s.projectId)}
            score={s.score}
            severityLabel={s.severityLabel}
            factorCount={s.factorCount}
            bottleneckCount={s.bottleneckCount}
            emergingRisks={s.emergingRisks}
          />
        ))}
      </div>
    </div>
  );
}
