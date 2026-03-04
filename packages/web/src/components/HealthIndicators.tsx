"use client";

import { useState, useEffect } from "react";

interface HealthIndicator {
  id: string;
  severity: "ok" | "warning" | "critical";
  message: string;
  details: string[];
}

interface SprintHealthResult {
  overall: "ok" | "warning" | "critical";
  indicators: HealthIndicator[];
  stuckStories: string[];
  wipColumns: string[];
}

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <span className="text-red-400">●</span>;
    case "warning":
      return <span className="text-yellow-400">▲</span>;
    default:
      return <span className="text-green-400">✓</span>;
  }
}

function severityBorder(severity: string): string {
  switch (severity) {
    case "critical":
      return "border-red-700/50";
    case "warning":
      return "border-yellow-700/50";
    default:
      return "border-green-700/50";
  }
}

export function HealthIndicators({ projectId }: { projectId: string }) {
  const [data, setData] = useState<SprintHealthResult | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const fetchData = () => {
      fetch(`/api/sprint/${encodeURIComponent(projectId)}/health`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load health data");
          return res.json();
        })
        .then((d) => {
          if (!cancelled) setData(d as SprintHealthResult);
        })
        .catch(() => {
          // Non-fatal — health is supplementary
        });
    };

    fetchData();
    const interval = setInterval(fetchData, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectId]);

  if (!data) return null;

  // Compact OK state
  if (data.overall === "ok") {
    return (
      <div className="rounded-[6px] border border-green-700/30 bg-[var(--color-bg-surface)] px-4 py-2.5 flex items-center gap-2">
        <span className="text-green-400 text-[12px]">✓</span>
        <span className="text-[12px] text-[var(--color-text-secondary)]">Sprint Health: OK</span>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {data.indicators.map((indicator, idx) => {
        const key = `${indicator.id}-${idx}`;
        const isExpanded = expanded.has(key);
        const hasDetails = indicator.details.length > 0;

        return (
          <div
            key={key}
            className={`rounded-[6px] border ${severityBorder(indicator.severity)} bg-[var(--color-bg-surface)] px-4 py-2.5`}
          >
            <div className="flex items-center gap-2">
              <SeverityIcon severity={indicator.severity} />
              <span className="text-[12px] text-[var(--color-text-primary)] flex-1">
                {indicator.message}
              </span>
              {hasDetails && (
                <button
                  onClick={() => toggleExpand(key)}
                  className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  {isExpanded ? "Hide" : "Details"}
                </button>
              )}
            </div>
            {isExpanded && hasDetails && (
              <div className="mt-2 pl-5 space-y-0.5">
                {indicator.details.map((detail, i) => (
                  <div key={i} className="text-[11px] text-[var(--color-text-muted)] font-mono">
                    → {detail}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
