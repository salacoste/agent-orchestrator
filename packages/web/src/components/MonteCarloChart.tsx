"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface PercentileResult {
  p50: string;
  p80: string;
  p95: string;
}

interface HistogramBucket {
  date: string;
  probability: number;
  cumulative: number;
}

interface CalibrationData {
  totalForecasts: number;
  withinP50: number;
  withinP80: number;
  withinP95: number;
  p50Accuracy: number;
  p80Accuracy: number;
  p95Accuracy: number;
  bias: number;
  insufficientData: boolean;
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
  insufficientData: boolean;
  calibration?: CalibrationData;
  effectiveConfig?: {
    simulations: number;
    throughputWindowDays: number;
    excludeWeekends: boolean;
    dataPointsUsed: number;
  };
}

// Styled tooltip following BurndownChart tooltip pattern
function MonteCarloTooltip({ bucket }: { bucket: HistogramBucket }) {
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded px-2 py-1.5 shadow-lg text-[10px]">
      <div className="font-medium text-[var(--color-text-primary)] mb-1">{bucket.date}</div>
      <div className="text-[var(--color-text-muted)] space-y-0.5">
        <div>Probability: {(bucket.probability * 100).toFixed(1)}%</div>
        <div>Cumulative: {(bucket.cumulative * 100).toFixed(1)}%</div>
      </div>
    </div>
  );
}

export function MonteCarloChart({
  projectId,
  epicFilter,
  simulations,
  confidenceLevels,
  throughputWindowDays,
  excludeWeekends,
  onEffectiveConfig,
}: {
  projectId: string;
  epicFilter?: string | null;
  simulations?: number;
  confidenceLevels?: string[];
  throughputWindowDays?: number;
  excludeWeekends?: boolean;
  onEffectiveConfig?: (cfg: {
    simulations: number;
    throughputWindowDays: number;
    excludeWeekends: boolean;
    dataPointsUsed: number;
  }) => void;
}) {
  const [data, setData] = useState<MonteCarloData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredBucket, setHoveredBucket] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(
    (signal?: AbortSignal) => {
      const params = new URLSearchParams();
      if (simulations) params.set("simulations", String(simulations));
      if (epicFilter) params.set("epic", encodeURIComponent(epicFilter));
      if (throughputWindowDays && throughputWindowDays > 0)
        params.set("throughputWindowDays", String(throughputWindowDays));
      if (excludeWeekends === false) params.set("excludeWeekends", "false");
      if (confidenceLevels && confidenceLevels.length > 0)
        params.set("confidenceLevels", confidenceLevels.join(","));

      fetch(`/api/sprint/${encodeURIComponent(projectId)}/monte-carlo?${params.toString()}`, {
        signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load Monte Carlo data");
          return res.json();
        })
        .then((d) => {
          const mcData = d as MonteCarloData;
          setData(mcData);
          setError(null);
          if (onEffectiveConfig && mcData.effectiveConfig) {
            onEffectiveConfig(mcData.effectiveConfig);
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError")
            setError(err instanceof Error ? err.message : "Unknown error");
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [
      projectId,
      epicFilter,
      simulations,
      throughputWindowDays,
      excludeWeekends,
      confidenceLevels,
      onEffectiveConfig,
    ],
  );

  // Initial fetch + SSE auto-refresh with polling fallback (Story 55.4)
  useEffect(() => {
    const abortController = new AbortController();
    fetchData(abortController.signal);

    // SSE subscription for forecast-stale events
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let reconnectDelay = 1000;

    function connectSSE() {
      try {
        es = new EventSource("/api/events");
        es.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data);
            if (event.type === "forecast-stale" && event.project === projectId) {
              fetchData();
            }
          } catch {
            // Malformed SSE data — ignore
          }
        };
        es.onerror = () => {
          es?.close();
          es = null;
          // Start polling fallback (30s interval)
          if (!pollTimer) {
            pollTimer = setInterval(() => fetchData(), 30000);
          }
          // Retry SSE with exponential backoff (1s → 2s → 4s → 8s max)
          reconnectDelay = Math.min(reconnectDelay * 2, 8000);
          setTimeout(connectSSE, reconnectDelay);
        };
        // SSE connected — clear polling fallback
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = undefined;
        }
      } catch {
        // EventSource not available — rely on polling fallback
      }
    }

    // Start polling fallback immediately in case SSE never connects
    pollTimer = setInterval(() => fetchData(), 30000);
    connectSSE();

    return () => {
      abortController.abort();
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [projectId, epicFilter, fetchData]);

  if (loading)
    return (
      <div className="text-[var(--color-text-muted)] text-sm p-4">
        Loading Monte Carlo forecast...
      </div>
    );
  if (error) return <div className="text-red-400 text-sm p-4">{error}</div>;
  if (!data || !data.percentiles.p50) {
    const message = data?.insufficientData
      ? "Insufficient throughput data. Complete more stories to generate a forecast."
      : "No completed stories yet. Monte Carlo forecast will appear as stories are done.";
    return (
      <div className="text-[11px] text-[var(--color-text-muted)] text-center py-4">{message}</div>
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
  const p80Idx = findBucketIdx(data.percentiles.p80);
  const p95Idx = findBucketIdx(data.percentiles.p95);

  const effectiveConfidenceLevels =
    confidenceLevels && confidenceLevels.length > 0
      ? confidenceLevels.map((l) => l.toLowerCase())
      : ["p50", "p80", "p95"];

  const percentileLines = [
    { idx: p50Idx, label: "P50", color: "var(--color-status-done)", key: "p50" },
    { idx: p80Idx, label: "P80", color: "var(--color-status-warning, #eab308)", key: "p80" },
    { idx: p95Idx, label: "P95", color: "var(--color-status-error, #ef4444)", key: "p95" },
  ].filter((pl) => effectiveConfidenceLevels.includes(pl.key));

  // Tooltip follows mouse position (AC #2: "tooltip follows the mouse position")
  const handleBarHover = (i: number, e: React.MouseEvent) => {
    if (!chartRef.current) return;
    const containerRect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;
    setHoveredBucket(i);
    setTooltipPosition({ x, y });
  };

  const handleBarLeave = () => {
    setHoveredBucket(null);
    setTooltipPosition(null);
  };

  return (
    <div className="space-y-3">
      {/* Stat cards */}
      <div
        className={`grid gap-2 ${effectiveConfidenceLevels.length >= 3 ? "grid-cols-4" : effectiveConfidenceLevels.length === 2 ? "grid-cols-3" : "grid-cols-2"}`}
      >
        {[
          ...(effectiveConfidenceLevels.includes("p50")
            ? [{ label: "P50 (Likely)", value: data.percentiles.p50 }]
            : []),
          ...(effectiveConfidenceLevels.includes("p80")
            ? [{ label: "P80 (Conservative)", value: data.percentiles.p80 }]
            : []),
          ...(effectiveConfidenceLevels.includes("p95")
            ? [{ label: "P95 (Safe)", value: data.percentiles.p95 }]
            : []),
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
        <div
          className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 relative"
          ref={chartRef}
        >
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
                const isHovered = hoveredBucket === i;

                return (
                  <g
                    key={bucket.date}
                    className="cursor-pointer transition-opacity hover:opacity-90"
                    onMouseEnter={(e) => handleBarHover(i, e)}
                    onMouseLeave={handleBarLeave}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      rx={2}
                      style={{ fill: "var(--color-accent)" }}
                      opacity={isHovered ? 0.9 : 0.6}
                    />
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

          {/* Percentile color legend */}
          <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--color-text-muted)]">
            {effectiveConfidenceLevels.includes("p50") && (
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-3 h-0 border-t-2 border-dashed"
                  style={{ borderColor: "var(--color-status-done)" }}
                />
                P50 (Likely)
              </span>
            )}
            {effectiveConfidenceLevels.includes("p80") && (
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-3 h-0 border-t-2 border-dashed"
                  style={{ borderColor: "var(--color-status-warning, #eab308)" }}
                />
                P80 (Conservative)
              </span>
            )}
            {effectiveConfidenceLevels.includes("p95") && (
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-3 h-0 border-t-2 border-dashed"
                  style={{ borderColor: "var(--color-status-error, #ef4444)" }}
                />
                P95 (Safe)
              </span>
            )}
          </div>

          {/* Styled tooltip (positioned outside SVG, following BurndownChart pattern) */}
          {hoveredBucket !== null && tooltipPosition && buckets[hoveredBucket] && (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                left: `${tooltipPosition.x}px`,
                top: `${tooltipPosition.y}px`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <MonteCarloTooltip bucket={buckets[hoveredBucket] as HistogramBucket} />
            </div>
          )}
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

      {/* Forecast accuracy / calibration */}
      {data.calibration && !data.calibration.insufficientData && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Forecast Accuracy
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "P50 Hit Rate", value: `${data.calibration.p50Accuracy.toFixed(0)}%` },
              { label: "P80 Hit Rate", value: `${data.calibration.p80Accuracy.toFixed(0)}%` },
              { label: "P95 Hit Rate", value: `${data.calibration.p95Accuracy.toFixed(0)}%` },
              {
                label: "Bias",
                value:
                  data.calibration.bias > 0.5
                    ? `Optimistic (${(data.calibration.bias * 100).toFixed(0)}%)`
                    : data.calibration.bias < 0.5
                      ? `Pessimistic (${((1 - data.calibration.bias) * 100).toFixed(0)}%)`
                      : "Neutral",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-[5px] border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] p-2.5 text-center"
              >
                <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">
                  {stat.label}
                </div>
                <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)] mt-2 text-center">
            Based on {data.calibration.totalForecasts} completed forecast
            {data.calibration.totalForecasts !== 1 ? "s" : ""}
          </div>
        </div>
      )}
      {data.calibration?.insufficientData && (
        <div className="text-[11px] text-[var(--color-text-muted)] text-center py-2">
          Forecast accuracy will appear after more sprints complete.
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
