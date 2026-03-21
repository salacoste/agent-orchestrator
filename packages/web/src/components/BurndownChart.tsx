"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSSEConnection } from "@/hooks/useSSEConnection";
import { useFlashAnimation } from "@/hooks/useFlashAnimation";

interface DailyCompletion {
  date: string;
  count: number;
  points: number;
}

interface VelocityData {
  dailyCompletions: DailyCompletion[];
  totalStories: number;
  doneCount?: number;
  hasPoints?: boolean;
  totalPoints?: number;
  donePoints?: number;
}

interface ForecastData {
  projectedCompletionDate: string | null;
  daysRemaining: number | null;
  pace: "ahead" | "on-pace" | "behind" | "no-data";
  confidence: number;
  currentVelocity: number;
  remainingStories: number;
  totalStories: number;
  completedStories: number;
}

interface MonteCarloData {
  percentiles: { p50: string; p85: string; p95: string };
  remainingStories: number;
  linearCompletionDate: string | null;
}

interface BurndownPoint {
  x: number;
  y: number;
  date: string;
  remaining: number;
  completed: number;
}

// Status badge per AC4/AC5
function StatusBadge({ isAhead, isBehind }: { isAhead: boolean; isBehind: boolean }) {
  // Show "On Track" when ahead OR when equal to ideal (on track)
  if (isAhead || (!isAhead && !isBehind)) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 font-medium">
        On Track
      </span>
    );
  }
  if (isBehind) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 font-medium">
        At Risk
      </span>
    );
  }
  return null;
}

// Tooltip per AC6
function BurndownTooltip({
  point,
  unit,
  _total,
  forecastDate,
}: {
  point: BurndownPoint;
  unit: string;
  _total: number;
  forecastDate: string | null;
}) {
  const completedLabel = unit === "pts" ? "points" : "stories";

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded px-2 py-1.5 shadow-lg text-[10px]">
      <div className="font-medium text-[var(--color-text-primary)] mb-1">{point.date}</div>
      <div className="text-[var(--color-text-muted)] space-y-0.5">
        <div>
          Remaining: {point.remaining} {unit}
        </div>
        <div>
          {completedLabel.charAt(0).toUpperCase() + completedLabel.slice(1)}: {point.completed}
        </div>
        {forecastDate && point.remaining > 0 && (
          <div className="text-[var(--color-status-attention)] mt-1">
            Est. completion: {forecastDate}
          </div>
        )}
      </div>
    </div>
  );
}

// Export to CSV function per AC7
function exportBurndownToCSV(dailyCompletions: DailyCompletion[], unit: string, projectId: string) {
  const completedLabel = unit === "pts" ? "points" : "stories";
  const headers = [
    "Date",
    `Remaining ${unit}`,
    `Daily ${completedLabel}`,
    `Cumulative ${completedLabel}`,
  ];
  const rows = dailyCompletions.map((d, i) => {
    const remaining = dailyCompletions
      .slice(0, i + 1)
      .reduce((sum, day) => sum + (unit === "pts" ? day.points : day.count), 0);
    const dailyDelta = unit === "pts" ? d.points : d.count;
    const cumulative = remaining;
    return [d.date, String(remaining), String(dailyDelta), String(cumulative)];
  });

  // Add metadata rows at the top
  const metadataRows = [
    [`Project: ${projectId}`],
    [`Export Date: ${new Date().toISOString()}`],
    [`Unit: ${completedLabel}`],
    [],
  ];

  const csvContent = [...metadataRows, headers.join(","), ...rows.map((row) => row.join(","))].join(
    "\n",
  );

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `burndown-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function BurndownChart({
  projectId,
  epicFilter,
}: {
  projectId: string;
  epicFilter?: string | null;
}) {
  const [data, setData] = useState<VelocityData | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [mcData, setMcData] = useState<MonteCarloData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOverlays, setShowOverlays] = useState(true);
  const [pointsMode, setPointsMode] = useState<boolean | null>(null);
  const [goals, setGoals] = useState<{
    goals: Array<{ type: string; target: string | number | null }>;
  } | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<BurndownPoint | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [animateLine, setAnimateLine] = useState(false);

  // SSE integration for real-time updates per AC2
  const isFirstFetch = useRef(true);
  const fetchData = useCallback(() => {
    const epicParam = epicFilter ? `?epic=${encodeURIComponent(epicFilter)}` : "";
    const abortController = new AbortController();
    // First fetch gets 5s (dev server cold-compile), subsequent fetches get 2s (NFR-P2)
    const timeoutMs = isFirstFetch.current ? 5000 : 2000;
    isFirstFetch.current = false;
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
    const signal = abortController.signal;

    const velocityFetch = fetch(
      `/api/sprint/${encodeURIComponent(projectId)}/velocity${epicParam}`,
      { signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load burndown data");
        return res.json();
      })
      .then((d) => {
        setData(d as VelocityData);
        setError(null);
      })
      .catch((err) => {
        if (err.name === "AbortError") {
          setError(`Update timed out (${timeoutMs / 1000}s) - will retry on next event`);
        } else {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      });

    const forecastFetch = fetch(
      `/api/sprint/${encodeURIComponent(projectId)}/forecast${epicParam}`,
      { signal },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) setForecast(d as ForecastData);
      })
      .catch(() => {
        // Non-fatal — forecast is supplementary
      });

    const mcFetch = fetch(`/api/sprint/${encodeURIComponent(projectId)}/monte-carlo${epicParam}`, {
      signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) setMcData(d as MonteCarloData);
      })
      .catch(() => {
        // Non-fatal — MC is supplementary
      });

    const goalsFetch = fetch(`/api/sprint/${encodeURIComponent(projectId)}/goals${epicParam}`, {
      signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) setGoals(d);
      })
      .catch(() => {});

    return Promise.all([velocityFetch, forecastFetch, mcFetch, goalsFetch]).finally(() => {
      clearTimeout(timeoutId);
    });
  }, [projectId, epicFilter]);

  // Initial data fetch (only on mount, not on fetchData changes)
  useEffect(() => {
    let cancelled = false;
    let initialLoad = true;

    fetchData().finally(() => {
      if (!cancelled && initialLoad) {
        setLoading(false);
        initialLoad = false;
      }
    });

    return () => {
      cancelled = true;
    };
  }, []); // Empty deps - only run on mount

  // SSE for real-time updates per AC2
  useSSEConnection(
    {
      onStoryCompleted: useCallback(() => {
        // Refresh data within 2 seconds per AC2
        fetchData();
      }, [fetchData]),
    },
    { eventSourceFactory: () => new EventSource("/api/events") },
  );

  // Flash animation on data changes
  const flashTrigger = data
    ? [data.totalPoints ?? data.totalStories, data.donePoints ?? data.doneCount ?? 0]
    : [];
  const isFlashing = useFlashAnimation(flashTrigger);

  // Trigger line animation on data changes
  useEffect(() => {
    if (data && data.dailyCompletions.length > 0) {
      setAnimateLine(true);
      const timeout = setTimeout(() => setAnimateLine(false), 600); // Match CSS animation duration
      return () => clearTimeout(timeout);
    }
  }, [data?.dailyCompletions.length]);

  // Inject CSS for smooth burndown line animation (client-side only, once)
  useEffect(() => {
    if (typeof document === "undefined") return; // SSR guard

    const existingStyle = document.getElementById("burndown-chart-styles");
    if (existingStyle) return; // Already injected

    const style = document.createElement("style");
    style.id = "burndown-chart-styles";
    style.textContent = `
      .burndown-line {
        vector-effect: non-scaling-stroke;
        transition: d 0.5s ease-in-out, stroke 0.3s ease;
      }
      .burndown-line.animate-update {
        animation: pulse-line 0.6s ease-out;
      }
      @keyframes pulse-line {
        0% { opacity: 0.7; stroke-width: 2; }
        50% { opacity: 1; stroke-width: 3; }
        100% { opacity: 1; stroke-width: 2; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      // Optional cleanup (not removing to preserve styles for other instances)
    };
  }, []); // Empty deps - inject once on mount

  if (loading)
    return <div className="text-[var(--color-text-muted)] text-sm p-4">Loading burndown...</div>;
  if (error) return <div className="text-red-400 text-sm p-4">{error}</div>;
  if (!data || data.dailyCompletions.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Burndown</h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          No completion history yet. Stories will appear here as they are completed.
        </p>
      </div>
    );
  }

  const { dailyCompletions, totalStories, doneCount } = data;
  const days = dailyCompletions.length;

  // Points mode: auto-detect or manual override via toggle
  const hasPointsData =
    data.hasPoints === true && data.totalPoints !== undefined && data.totalPoints > 0;
  const usePoints = pointsMode ?? hasPointsData;
  const total = usePoints ? (data.totalPoints ?? 0) : totalStories;
  const unit = usePoints ? "pts" : "stories";

  // SVG dimensions
  const width = 400;
  const height = 150;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Use ground-truth done count from tracker (accurate even if stories bounce)
  // Fall back to summing daily completions for backwards compatibility
  const totalCompleted = usePoints
    ? (data.donePoints ?? dailyCompletions.reduce((sum, d) => sum + d.points, 0))
    : (doneCount ?? dailyCompletions.reduce((sum, d) => sum + d.count, 0));
  let cumDone = 0;
  const chartPoints: BurndownPoint[] = dailyCompletions.map((d, i) => {
    const increment = usePoints ? d.points : d.count;
    // Cap at totalCompleted so bouncing stories (done→reopened→done) don't over-count
    cumDone = Math.min(cumDone + increment, totalCompleted);
    const remaining = Math.max(0, total - cumDone);
    const x = padding.left + (i / Math.max(days - 1, 1)) * chartW;
    const y = padding.top + (1 - remaining / Math.max(total, 1)) * chartH;
    return { x, y, date: d.date, remaining, completed: cumDone };
  });

  // Dynamic color coding per AC4/AC5 - green if ahead, red if behind
  const lastPoint = chartPoints[chartPoints.length - 1];
  const idealRemainingAtLastPoint = Math.max(
    0,
    total - (total * (chartPoints.length - 1)) / Math.max(days - 1, 1),
  );
  const isAhead = lastPoint && lastPoint.remaining < idealRemainingAtLastPoint;
  const isBehind = lastPoint && lastPoint.remaining > idealRemainingAtLastPoint;
  const lineColor = isBehind ? "var(--color-status-error)" : "var(--color-status-success)";

  // Today marker per AC1 - use local timezone to match data format
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local timezone
  const todayIndex = dailyCompletions.findIndex((d) => d.date === today);
  const todayX =
    todayIndex >= 0 ? padding.left + (todayIndex / Math.max(days - 1, 1)) * chartW : null;

  // Ideal line (from total to 0)
  const idealStart = { x: padding.left, y: padding.top };
  const idealEnd = { x: padding.left + chartW, y: padding.top + chartH };

  const actualPath = chartPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Forecast line — dashed blue from last actual point to projected zero
  let forecastPath = "";
  if (
    showOverlays &&
    forecast &&
    forecast.currentVelocity > 0 &&
    chartPoints.length > 0 &&
    forecast.remainingStories > 0
  ) {
    const lastPoint = chartPoints[chartPoints.length - 1];
    if (lastPoint) {
      const daysToComplete = forecast.remainingStories / forecast.currentVelocity;
      const projectedX = Math.min(
        lastPoint.x + (daysToComplete / Math.max(days - 1, 1)) * chartW,
        padding.left + chartW,
      );
      const projectedY = padding.top + chartH; // y=0 remaining
      forecastPath = `M ${lastPoint.x} ${lastPoint.y} L ${projectedX} ${projectedY}`;
    }
  }

  // Monte Carlo P50/P85/P95 vertical marker lines
  const mcMarkers: Array<{ x: number; label: string; color: string; opacity: number }> = [];
  if (showOverlays && mcData && chartPoints.length > 0 && days > 1) {
    const firstDate = new Date(dailyCompletions[0].date);
    const lastDate = new Date(dailyCompletions[dailyCompletions.length - 1].date);
    const spanMs = lastDate.getTime() - firstDate.getTime();

    const addMarker = (dateStr: string, label: string, color: string, opacity: number) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      const offsetMs = d.getTime() - firstDate.getTime();
      // Only show if within a reasonable range (up to 2x the current span)
      if (offsetMs < 0 || (spanMs > 0 && offsetMs > spanMs * 3)) return;
      const ratio = spanMs > 0 ? offsetMs / spanMs : 1;
      const x = padding.left + ratio * chartW;
      if (x >= padding.left && x <= padding.left + chartW) {
        mcMarkers.push({ x, label, color, opacity });
      }
    };

    addMarker(mcData.percentiles.p50, "P50", "#f97316", 0.8);
    addMarker(mcData.percentiles.p85, "P85", "#f97316", 0.5);
    addMarker(mcData.percentiles.p95, "P95", "#f97316", 0.3);
  }

  // Sprint goal target line calculation
  const goalTarget = goals?.goals?.find(
    (g) => (usePoints && g.type === "points") || (!usePoints && g.type === "stories"),
  );
  const goalValue =
    goalTarget?.target && typeof goalTarget.target === "number" ? goalTarget.target : null;
  const goalY =
    goalValue !== null ? padding.top + (1 - goalValue / Math.max(total, 1)) * chartH : null;

  return (
    <div
      className={`relative rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 transition-colors duration-300 ${
        isFlashing ? "bg-[rgba(59,130,246,0.05)]" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
          Burndown{usePoints ? " (Points)" : ""}
        </h3>
        <div className="flex items-center gap-2">
          <StatusBadge isAhead={isAhead} isBehind={isBehind} />
          <button
            onClick={() => exportBurndownToCSV(dailyCompletions, unit, projectId)}
            className="text-[10px] px-2 py-1 rounded border border-[var(--color-border-default)] hover:bg-[var(--color-bg-hover)] transition-colors"
            title="Export to CSV"
          >
            Export
          </button>
        </div>
      </div>
      {/* Mode toggle - only show when points data available */}
      {data.hasPoints && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-muted">View:</span>
          <div className="flex rounded border border-border">
            <button
              onClick={() => setPointsMode(null)}
              className={`px-2 py-1 text-xs rounded-l ${
                pointsMode === null ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              Auto
            </button>
            <button
              onClick={() => setPointsMode(false)}
              className={`px-2 py-1 text-xs border-l border-border ${
                pointsMode === false ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              Count
            </button>
            <button
              onClick={() => setPointsMode(true)}
              disabled={!hasPointsData}
              className={`px-2 py-1 text-xs border-l border-border rounded-r ${
                pointsMode === true ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              } ${!hasPointsData ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Points
            </button>
          </div>
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxWidth: 500 }}
        role="img"
        aria-label={`Burndown chart: ${totalCompleted} of ${total} ${unit} completed`}
      >
        {/* Grid lines */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartH}
          style={{ stroke: "var(--color-border-subtle)" }}
          strokeWidth={1}
        />
        <line
          x1={padding.left}
          y1={padding.top + chartH}
          x2={padding.left + chartW}
          y2={padding.top + chartH}
          style={{ stroke: "var(--color-border-subtle)" }}
          strokeWidth={1}
        />

        {/* Ideal line */}
        <line
          x1={idealStart.x}
          y1={idealStart.y}
          x2={idealEnd.x}
          y2={idealEnd.y}
          style={{ stroke: "var(--color-border-default)" }}
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Forecast regression line (dashed blue) */}
        {forecastPath && (
          <path
            d={forecastPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            opacity={0.7}
          />
        )}

        {/* Sprint goal target line (dashed red) */}
        {goalY !== null && showOverlays && (
          <g>
            <line
              x1={padding.left}
              y1={goalY}
              x2={padding.left + chartW}
              y2={goalY}
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="8 4"
              opacity={0.8}
            />
            <text
              x={padding.left + chartW + 5}
              y={goalY + 3}
              textAnchor="start"
              fill="#ef4444"
              fontSize={9}
              fontWeight="bold"
            >
              Goal: {goalValue}
            </text>
          </g>
        )}

        {/* Monte Carlo percentile markers */}
        {mcMarkers.map((m, i) => (
          <g key={i}>
            <line
              x1={m.x}
              y1={padding.top}
              x2={m.x}
              y2={padding.top + chartH}
              stroke={m.color}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={m.opacity}
            />
            <text
              x={m.x}
              y={padding.top - 4}
              textAnchor="middle"
              fill={m.color}
              fontSize={8}
              opacity={m.opacity}
            >
              {m.label}
            </text>
          </g>
        ))}

        {/* Today marker per AC1 */}
        {todayX !== null && (
          <g>
            <line
              x1={todayX}
              y1={padding.top}
              x2={todayX}
              y2={padding.top + chartH}
              stroke="var(--color-border-default)"
              strokeWidth={1.5}
              strokeDasharray="2 2"
              opacity={0.8}
            />
            <text
              x={todayX}
              y={padding.top - 4}
              textAnchor="middle"
              fill="var(--color-text-muted)"
              fontSize={8}
              opacity={0.8}
            >
              Today
            </text>
          </g>
        )}

        {/* Actual line with dynamic color per AC4/AC5, smooth animation */}
        <path
          d={actualPath}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          className={`burndown-line${animateLine ? " animate-update" : ""}`}
          style={{
            transition: "d 0.5s ease-in-out, stroke 0.3s ease",
          }}
        />

        {/* Data points with hover tooltips per AC6 */}
        {chartPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredPoint === p ? 5 : 3}
            fill={lineColor}
            className="cursor-pointer transition-opacity hover:opacity-80"
            onMouseEnter={() => {
              setHoveredPoint(p);
              setTooltipPosition({ x: p.x, y: p.y });
            }}
            onMouseLeave={() => {
              setHoveredPoint(null);
              setTooltipPosition(null);
            }}
          />
        ))}

        {/* Y axis labels */}
        <text
          x={padding.left - 5}
          y={padding.top + 4}
          textAnchor="end"
          style={{ fill: "var(--color-text-muted)" }}
          fontSize={10}
        >
          {total}
        </text>
        <text
          x={padding.left - 5}
          y={padding.top + chartH + 4}
          textAnchor="end"
          style={{ fill: "var(--color-text-muted)" }}
          fontSize={10}
        >
          0
        </text>

        {/* X axis labels (first and last date) */}
        {dailyCompletions.length > 0 && (
          <>
            <text
              x={padding.left}
              y={height - 5}
              textAnchor="start"
              style={{ fill: "var(--color-text-muted)" }}
              fontSize={9}
            >
              {dailyCompletions[0].date.slice(5)}
            </text>
            <text
              x={padding.left + chartW}
              y={height - 5}
              textAnchor="end"
              style={{ fill: "var(--color-text-muted)" }}
              fontSize={9}
            >
              {dailyCompletions[dailyCompletions.length - 1].date.slice(5)}
            </text>
          </>
        )}
      </svg>

      {/* Tooltip per AC6 */}
      {hoveredPoint && tooltipPosition && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: `${tooltipPosition.x + 10}px`,
            top: `${tooltipPosition.y - 10}px`,
            transform: "translateY(-100%)",
          }}
        >
          <BurndownTooltip
            point={hoveredPoint}
            unit={unit}
            _total={total}
            forecastDate={forecast?.projectedCompletionDate ?? null}
          />
        </div>
      )}

      {/* Overlay toggle + footer */}
      {(forecast || mcData) && (
        <div className="flex items-center gap-3 mt-1 text-[10px] text-[var(--color-text-muted)]">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showOverlays}
              onChange={(e) => setShowOverlays(e.target.checked)}
              className="w-3 h-3"
            />
            Forecast overlay
          </label>
          {showOverlays && forecastPath && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0 border-t border-dashed border-blue-500" />
              Regression
            </span>
          )}
          {showOverlays && mcMarkers.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0 border-t border-dashed border-orange-500" />
              Monte Carlo
            </span>
          )}
          {showOverlays && goalY !== null && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0 border-t border-dashed border-red-500" />
              Goal
            </span>
          )}
        </div>
      )}
      <div className="flex justify-between items-center text-xs text-[var(--color-text-muted)] mt-1">
        <span>
          {Math.max(0, total - totalCompleted)} {unit} remaining
        </span>
        <div className="flex items-center gap-2">
          {forecast && forecast.projectedCompletionDate && (
            <span className="text-[10px]">
              Est. {forecast.projectedCompletionDate}
              {forecast.confidence < 0.3 && (
                <span className="text-yellow-500 ml-1" title="Low confidence forecast">
                  *
                </span>
              )}
            </span>
          )}
          <span>
            {totalCompleted} {unit} completed
          </span>
        </div>
      </div>
    </div>
  );
}
