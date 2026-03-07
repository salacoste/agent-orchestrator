"use client";

import { useState, useEffect } from "react";

interface WipColumnStatus {
  column: string;
  label: string;
  current: number;
  limit: number | null;
  ratio: number;
  severity: "ok" | "warning" | "exceeded";
}

const SEVERITY_COLORS = {
  ok: "bg-green-500",
  warning: "bg-yellow-500",
  exceeded: "bg-red-500",
} as const;

const SEVERITY_BG = {
  ok: "bg-green-950/20",
  warning: "bg-yellow-950/20",
  exceeded: "bg-red-950/20",
} as const;

export function WipStatusWidget({ projectId }: { projectId: string }) {
  const [data, setData] = useState<WipColumnStatus[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = () => {
      fetch(`/api/sprint/${encodeURIComponent(projectId)}/wip`)
        .then((res) => (res.ok ? res.json() : null))
        .then((d) => {
          if (!cancelled && d) setData(d as WipColumnStatus[]);
        })
        .catch(() => {});
    };
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectId]);

  // Only show if there are columns with configured limits
  if (!data || data.every((c) => c.limit === null)) return null;

  const columnsWithLimits = data.filter((c) => c.limit !== null);

  return (
    <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
      <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">WIP Limits</h3>
      <div className="space-y-2">
        {columnsWithLimits.map((col) => (
          <div key={col.column} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--color-text-primary)]">{col.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] ${SEVERITY_BG[col.severity]} ${
                  col.severity === "exceeded"
                    ? "text-red-400"
                    : col.severity === "warning"
                      ? "text-yellow-400"
                      : "text-green-400"
                }`}
              >
                {col.current}/{col.limit}
              </span>
            </div>
            <div className="w-full h-1.5 bg-[var(--color-bg-inset)] rounded-full overflow-hidden">
              <div
                className={`h-full ${SEVERITY_COLORS[col.severity]} rounded-full transition-all`}
                style={{ width: `${Math.min(100, col.ratio * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
