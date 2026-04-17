"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ForecastComparison {
  timestamp: string;
  predictedP50: string;
  predictedP80: string;
  predictedP95: string;
  actualDate: string;
  biasDays: number;
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

interface AccuracyData {
  calibration: CalibrationData;
  forecastComparisons: ForecastComparison[];
  accuracyTrend: "improving" | "stable" | "degrading";
}

function AccuracyTooltip({ comp }: { comp: ForecastComparison }) {
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded px-2 py-1.5 shadow-lg text-[10px]">
      <div className="font-medium text-[var(--color-text-primary)] mb-1">
        Forecast: {comp.timestamp.slice(0, 10)}
      </div>
      <div className="text-[var(--color-text-muted)] space-y-0.5">
        <div>Predicted P50: {comp.predictedP50.slice(0, 10)}</div>
        <div>Predicted P80: {comp.predictedP80.slice(0, 10)}</div>
        <div>Predicted P95: {comp.predictedP95.slice(0, 10)}</div>
        <div>Actual: {comp.actualDate.slice(0, 10)}</div>
        <div>
          Bias:{" "}
          <span
            className={
              comp.biasDays > 0
                ? "text-[var(--color-status-warning, #eab308)]"
                : comp.biasDays < 0
                  ? "text-[var(--color-status-done)]"
                  : ""
            }
          >
            {comp.biasDays > 0 ? "+" : ""}
            {comp.biasDays}d from P50
          </span>
        </div>
      </div>
    </div>
  );
}

export function ForecastAccuracyChart({ projectId }: { projectId: string }) {
  const [data, setData] = useState<AccuracyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(
    (signal?: AbortSignal) => {
      fetch(`/api/sprint/${encodeURIComponent(projectId)}/forecast-accuracy`, {
        signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load forecast accuracy data");
          return res.json();
        })
        .then((d) => {
          setData(d as AccuracyData);
          setError(null);
        })
        .catch((err) => {
          if (err.name !== "AbortError")
            setError(err instanceof Error ? err.message : "Unknown error");
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [projectId],
  );

  // Initial fetch + SSE auto-refresh with polling fallback (following MonteCarloChart pattern)
  useEffect(() => {
    const abortController = new AbortController();
    fetchData(abortController.signal);

    // SSE subscription for forecast-stale events
    let es: EventSource | null;
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
  }, [projectId, fetchData]);

  if (loading)
    return (
      <div className="text-[var(--color-text-muted)] text-sm p-4">Loading forecast accuracy...</div>
    );
  if (error) return <div className="text-red-400 text-sm p-4">{error}</div>;
  if (!data) return null;

  const { calibration, forecastComparisons, accuracyTrend } = data;

  if (calibration.insufficientData || forecastComparisons.length < 2) {
    const need = Math.max(0, 2 - forecastComparisons.length);
    return (
      <div className="text-[11px] text-[var(--color-text-muted)] text-center py-4">
        Forecast accuracy requires at least 2 completed sprint forecasts.
        {need > 0 ? ` ${need} more needed.` : ""}
      </div>
    );
  }

  // SVG scatter plot
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const plotW = 400;
  const plotH = 300;
  const svgW = plotW + padding.left + padding.right;
  const svgH = plotH + padding.top + padding.bottom;

  // Compute date ranges for axes
  const allDates = forecastComparisons.flatMap((c) => [
    new Date(c.predictedP50).getTime(),
    new Date(c.actualDate).getTime(),
  ]);
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const dateRange = maxDate - minDate || 1;

  const scaleX = (dateStr: string) => {
    const t = new Date(dateStr).getTime();
    return padding.left + ((t - minDate) / dateRange) * plotW;
  };

  const scaleY = (dateStr: string) => {
    const t = new Date(dateStr).getTime();
    return padding.top + plotH - ((t - minDate) / dateRange) * plotH;
  };

  const pointColor = (comp: ForecastComparison) => {
    const actualT = new Date(comp.actualDate).getTime();
    const p80T = new Date(comp.predictedP80).getTime();
    const p95T = new Date(comp.predictedP95).getTime();
    if (actualT <= p80T) return "var(--color-status-done)";
    if (actualT <= p95T) return "var(--color-status-warning, #eab308)";
    return "var(--color-status-error, #ef4444)";
  };

  // Axis tick helpers
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const t = minDate + (dateRange * i) / (tickCount - 1);
    return new Date(t).toISOString().slice(0, 10);
  });

  const handlePointHover = (i: number, e: React.MouseEvent) => {
    if (!chartRef.current) return;
    const containerRect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;
    setHoveredIdx(i);
    setTooltipPosition({ x, y });
  };

  const handlePointLeave = () => {
    setHoveredIdx(null);
    setTooltipPosition(null);
  };

  const trendLabel =
    accuracyTrend === "improving"
      ? "Improving ↑"
      : accuracyTrend === "degrading"
        ? "Degrading ↓"
        : "Stable →";
  const trendColor =
    accuracyTrend === "improving"
      ? "text-[var(--color-status-done)]"
      : accuracyTrend === "degrading"
        ? "text-[var(--color-status-error, #ef4444)]"
        : "text-[var(--color-text-muted)]";

  const biasValue = calibration.bias;
  const biasLabel =
    biasValue > 0.5
      ? `Optimistic (${(biasValue * 100).toFixed(0)}%)`
      : biasValue < 0.5
        ? `Pessimistic (${((1 - biasValue) * 100).toFixed(0)}%)`
        : "Neutral";
  const biasColor =
    biasValue > 0.5
      ? "text-[var(--color-status-warning, #eab308)]"
      : biasValue < 0.5
        ? "text-[var(--color-status-done)]"
        : "text-[var(--color-text-muted)]";

  return (
    <div className="space-y-3">
      {/* Calibration summary cards (Task 3) */}
      <div className="grid grid-cols-4 gap-2">
        {[
          {
            label: "P50 Hit Rate",
            value: `${calibration.p50Accuracy.toFixed(0)}%`,
          },
          {
            label: "P80 Hit Rate",
            value: `${calibration.p80Accuracy.toFixed(0)}%`,
          },
          {
            label: "P95 Hit Rate",
            value: `${calibration.p95Accuracy.toFixed(0)}%`,
          },
          {
            label: "Bias",
            value: biasLabel,
            color: biasColor,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[5px] border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] p-2.5 text-center"
          >
            <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">{stat.label}</div>
            <div
              className={`text-[13px] font-semibold ${stat.color ?? "text-[var(--color-text-primary)]"}`}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Accuracy trend indicator */}
      <div className={`text-center text-[11px] font-medium ${trendColor}`}>
        Accuracy Trend: {trendLabel}
      </div>

      {/* Scatter plot */}
      <div
        className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 relative"
        ref={chartRef}
      >
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Calibration Scatter Plot
        </h3>
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full"
            style={{ maxWidth: 500 }}
            role="img"
            aria-label="Forecast accuracy calibration scatter plot"
          >
            {/* Diagonal reference line (perfect prediction) */}
            <line
              x1={padding.left}
              y1={padding.top + plotH}
              x2={padding.left + plotW}
              y2={padding.top}
              stroke="var(--color-text-muted)"
              strokeWidth={1}
              strokeDasharray="4 2"
              opacity={0.5}
            />

            {/* X axis ticks */}
            {ticks.map((t) => (
              <g key={`x-${t}`}>
                <line
                  x1={scaleX(t)}
                  y1={padding.top + plotH}
                  x2={scaleX(t)}
                  y2={padding.top + plotH + 4}
                  stroke="var(--color-text-muted)"
                  strokeWidth={1}
                />
                <text
                  x={scaleX(t)}
                  y={padding.top + plotH + 14}
                  textAnchor="middle"
                  fontSize={8}
                  style={{ fill: "var(--color-text-muted)" }}
                  transform={`rotate(-30, ${scaleX(t)}, ${padding.top + plotH + 14})`}
                >
                  {t.slice(5)}
                </text>
              </g>
            ))}

            {/* Y axis ticks */}
            {ticks.map((t) => (
              <g key={`y-${t}`}>
                <line
                  x1={padding.left - 4}
                  y1={scaleY(t)}
                  x2={padding.left}
                  y2={scaleY(t)}
                  stroke="var(--color-text-muted)"
                  strokeWidth={1}
                />
                <text
                  x={padding.left - 6}
                  y={scaleY(t) + 3}
                  textAnchor="end"
                  fontSize={8}
                  style={{ fill: "var(--color-text-muted)" }}
                >
                  {t.slice(5)}
                </text>
              </g>
            ))}

            {/* Axis labels */}
            <text
              x={padding.left + plotW / 2}
              y={svgH - 2}
              textAnchor="middle"
              fontSize={9}
              style={{ fill: "var(--color-text-secondary)" }}
            >
              Predicted P50 Date
            </text>
            <text
              x={6}
              y={padding.top + plotH / 2}
              textAnchor="middle"
              fontSize={9}
              style={{ fill: "var(--color-text-secondary)" }}
              transform={`rotate(-90, 6, ${padding.top + plotH / 2})`}
            >
              Actual Completion
            </text>

            {/* Data points */}
            {forecastComparisons.map((comp, i) => {
              const cx = scaleX(comp.predictedP50);
              const cy = scaleY(comp.actualDate);
              const color = pointColor(comp);
              const isHovered = hoveredIdx === i;

              return (
                <g
                  key={comp.timestamp}
                  className="cursor-pointer"
                  onMouseEnter={(e) => handlePointHover(i, e)}
                  onMouseLeave={handlePointLeave}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : 4}
                    fill={color}
                    opacity={isHovered ? 0.9 : 0.7}
                    stroke={isHovered ? "var(--color-text-primary)" : "none"}
                    strokeWidth={1}
                  />
                </g>
              );
            })}

            {/* Perfect prediction label */}
            <text
              x={padding.left + plotW - 2}
              y={padding.top + 14}
              textAnchor="end"
              fontSize={8}
              style={{ fill: "var(--color-text-muted)" }}
              fontStyle="italic"
            >
              Perfect Prediction
            </text>
          </svg>
        </div>

        {/* Color legend */}
        <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: "var(--color-status-done)" }}
            />
            Within P80
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: "var(--color-status-warning, #eab308)",
              }}
            />
            Within P95
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: "var(--color-status-error, #ef4444)",
              }}
            />
            Beyond P95
          </span>
        </div>

        {/* Tooltip */}
        {hoveredIdx !== null && tooltipPosition && forecastComparisons[hoveredIdx] && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <AccuracyTooltip comp={forecastComparisons[hoveredIdx] as ForecastComparison} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-[10px] text-[var(--color-text-muted)] text-center">
        Based on {calibration.totalForecasts} completed forecast
        {calibration.totalForecasts !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
