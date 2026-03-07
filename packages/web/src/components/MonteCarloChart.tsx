"use client";

import { useState, useEffect } from "react";

interface PercentileResult {
  p50: string;
  p85: string;
  p95: string;
}

interface HistogramBucket {
  date: string;
  probability: number;
  cumulative: number;
}

interface MonteCarloData {
  percentiles: PercentileResult;
  histogram: HistogramBucket[];
  remainingStories: number;
  simulationCount: number;
  sampleSize: number;
  averageDailyRate: number;
  linearCompletionDate: string | null;
  linearConfidence: number;
}

export function MonteCarloChart({
  projectId,
  epicFilter,
}: {
  projectId: string;
  epicFilter?: string | null;
}) {
  const [data, setData] = useState<MonteCarloData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const epicParam = epicFilter ? `&epic=${encodeURIComponent(epicFilter)}` : "";

    fetch(`/api/sprint/${encodeURIComponent(projectId)}/monte-carlo?simulations=5000${epicParam}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load Monte Carlo data");
        return res.json();
      })
      .then((d) => {
        if (!cancelled) {
          setData(d as MonteCarloData);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, epicFilter]);

  if (loading)
    return (
      <div className="text-[var(--color-text-muted)] text-sm p-4">
        Loading Monte Carlo forecast...
      </div>
    );
  if (error) return <div className="text-red-400 text-sm p-4">{error}</div>;
  if (!data || !data.percentiles.p50) {
    return (
      <div className="text-[11px] text-[var(--color-text-muted)] text-center py-4">
        No completed stories yet. Monte Carlo forecast will appear as stories are done.
      </div>
    );
  }

  // SVG dimensions for histogram
  const buckets = data.histogram;
  const maxProb = Math.max(...buckets.map((b) => b.probability), 0.01);
  const barW = Math.max(12, Math.min(28, 500 / buckets.length));
  const barGap = 2;
  const chartW = buckets.length * (barW + barGap) + 40;
  const chartH = 120;
  const labelH = 30;

  // Find indices for percentile lines
  const findBucketIdx = (dateStr: string): number => {
    const idx = buckets.findIndex((b) => b.date === dateStr);
    return idx >= 0 ? idx : -1;
  };

  const p50Idx = findBucketIdx(data.percentiles.p50);
  const p85Idx = findBucketIdx(data.percentiles.p85);
  const p95Idx = findBucketIdx(data.percentiles.p95);

  const percentileLines = [
    { idx: p50Idx, label: "P50", color: "var(--color-status-success)" },
    { idx: p85Idx, label: "P85", color: "var(--color-status-warning, #eab308)" },
    { idx: p95Idx, label: "P95", color: "var(--color-status-error, #ef4444)" },
  ];

  return (
    <div className="space-y-3">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "P50 (Likely)", value: data.percentiles.p50 },
          { label: "P85 (Conservative)", value: data.percentiles.p85 },
          { label: "P95 (Safe)", value: data.percentiles.p95 },
          {
            label: "Avg Rate",
            value: `${data.averageDailyRate.toFixed(1)}/day`,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[5px] border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] p-2.5 text-center"
          >
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">{stat.label}</div>
            <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Probability histogram */}
      {buckets.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
            Completion Date Probability
          </h3>
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartW} ${chartH + labelH}`}
              className="w-full"
              style={{ maxWidth: 700 }}
              role="img"
              aria-label="Monte Carlo completion date histogram"
            >
              {/* Bars */}
              {buckets.map((bucket, i) => {
                const x = i * (barW + barGap) + 20;
                const h = (bucket.probability / maxProb) * chartH;
                const y = chartH - h;

                return (
                  <g key={bucket.date}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      rx={2}
                      style={{ fill: "var(--color-accent)" }}
                      opacity={0.6}
                    >
                      <title>
                        {bucket.date}: {(bucket.probability * 100).toFixed(1)}% (cumulative:{" "}
                        {(bucket.cumulative * 100).toFixed(1)}%)
                      </title>
                    </rect>
                    {/* Show date label every Nth bar to avoid overlap */}
                    {(i % Math.max(1, Math.floor(buckets.length / 8)) === 0 ||
                      i === buckets.length - 1) && (
                      <text
                        x={x + barW / 2}
                        y={chartH + 14}
                        textAnchor="middle"
                        style={{ fill: "var(--color-text-muted)" }}
                        fontSize={8}
                        transform={`rotate(-30, ${x + barW / 2}, ${chartH + 14})`}
                      >
                        {bucket.date.slice(5)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Percentile vertical lines */}
              {percentileLines.map(
                (pl) =>
                  pl.idx >= 0 && (
                    <g key={pl.label}>
                      <line
                        x1={pl.idx * (barW + barGap) + 20 + barW / 2}
                        y1={0}
                        x2={pl.idx * (barW + barGap) + 20 + barW / 2}
                        y2={chartH}
                        stroke={pl.color}
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        opacity={0.8}
                      />
                      <text
                        x={pl.idx * (barW + barGap) + 20 + barW / 2}
                        y={-4}
                        textAnchor="middle"
                        fill={pl.color}
                        fontSize={9}
                        fontWeight="bold"
                      >
                        {pl.label}
                      </text>
                    </g>
                  ),
              )}
            </svg>
          </div>
        </div>
      )}

      {/* Linear comparison */}
      {data.linearCompletionDate && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Linear Comparison
          </h3>
          <div className="flex items-center gap-4 text-[11px]">
            <div>
              <span className="text-[var(--color-text-muted)]">Linear forecast: </span>
              <span className="text-[var(--color-text-primary)] font-medium">
                {data.linearCompletionDate}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-text-muted)]">Confidence: </span>
              <span className="text-[var(--color-text-primary)] font-medium">
                {(data.linearConfidence * 100).toFixed(1)}%
              </span>
              <span className="text-[var(--color-text-muted)]"> of simulations agree</span>
            </div>
          </div>
        </div>
      )}

      {/* Simulation info */}
      <div className="text-[10px] text-[var(--color-text-muted)] text-center">
        {data.simulationCount.toLocaleString()} simulations | {data.sampleSize} day sample |{" "}
        {data.remainingStories} stories remaining
      </div>
    </div>
  );
}
