"use client";

import { useState, useEffect } from "react";

interface CfdDataPoint {
  date: string;
  columns: Record<string, number>;
}

interface CfdData {
  dataPoints: CfdDataPoint[];
  columns: string[];
  dateRange: { from: string; to: string };
}

const COLUMN_COLORS: Record<string, string> = {
  backlog: "#71717a", // zinc-500
  "ready-for-dev": "#eab308", // yellow-500
  "in-progress": "#3b82f6", // blue-500
  review: "#a855f7", // purple-500
  done: "#22c55e", // green-500
};

const COLUMN_LABELS: Record<string, string> = {
  backlog: "Backlog",
  "ready-for-dev": "Ready",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
};

export function CfdChart({
  projectId,
  epicFilter,
}: {
  projectId: string;
  epicFilter?: string | null;
}) {
  const [data, setData] = useState<CfdData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const epicParam = epicFilter ? `&epic=${encodeURIComponent(epicFilter)}` : "";
    fetch(`/api/sprint/${encodeURIComponent(projectId)}/cfd?days=30${epicParam}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load CFD data");
        return res.json();
      })
      .then((d) => {
        if (!cancelled) setData(d as CfdData);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, epicFilter]);

  if (error) return <div className="text-red-400 text-[11px]">{error}</div>;
  if (!data) {
    return <div className="text-[var(--color-text-muted)] text-[11px]">Loading CFD data...</div>;
  }
  if (data.dataPoints.length === 0) {
    return <div className="text-[var(--color-text-muted)] text-[11px]">No CFD data available.</div>;
  }

  // Compute SVG chart
  const width = 600;
  const height = 200;
  const padding = { top: 10, right: 10, bottom: 30, left: 35 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const n = data.dataPoints.length;

  // Max total for Y axis
  const maxTotal = Math.max(
    ...data.dataPoints.map((dp) => Object.values(dp.columns).reduce((s, v) => s + v, 0)),
    1,
  );

  // Build stacked area paths (bottom to top)
  const reversedCols = [...data.columns].reverse(); // done at bottom, backlog at top
  const areas: Array<{ column: string; path: string }> = [];

  for (let ci = 0; ci < reversedCols.length; ci++) {
    const col = reversedCols[ci] ?? "";
    const points: string[] = [];

    // Top edge (current column cumulative)
    for (let i = 0; i < n; i++) {
      const dp = data.dataPoints[i];
      if (!dp) continue;
      let cumulative = 0;
      for (let j = 0; j <= ci; j++) {
        cumulative += dp.columns[reversedCols[j] ?? ""] ?? 0;
      }
      const x = padding.left + (i / Math.max(n - 1, 1)) * chartW;
      const y = padding.top + chartH - (cumulative / maxTotal) * chartH;
      points.push(`${x},${y}`);
    }

    // Bottom edge (previous column cumulative, reversed)
    for (let i = n - 1; i >= 0; i--) {
      const dp = data.dataPoints[i];
      if (!dp) continue;
      let cumulative = 0;
      for (let j = 0; j < ci; j++) {
        cumulative += dp.columns[reversedCols[j] ?? ""] ?? 0;
      }
      const x = padding.left + (i / Math.max(n - 1, 1)) * chartW;
      const y = padding.top + chartH - (cumulative / maxTotal) * chartH;
      points.push(`${x},${y}`);
    }

    areas.push({ column: col, path: `M${points.join("L")}Z` });
  }

  // Tooltip data
  const hovered = hoveredIdx !== null ? data.dataPoints[hoveredIdx] : null;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Areas */}
        {areas.map(({ column, path }) => (
          <path key={column} d={path} fill={COLUMN_COLORS[column] ?? "#71717a"} opacity={0.7} />
        ))}

        {/* Hover detection columns */}
        {data.dataPoints.map((_, i) => {
          const x = padding.left + (i / Math.max(n - 1, 1)) * chartW;
          const colWidth = chartW / Math.max(n - 1, 1);
          return (
            <rect
              key={i}
              x={x - colWidth / 2}
              y={padding.top}
              width={colWidth}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoveredIdx(i)}
            />
          );
        })}

        {/* Hover line */}
        {hoveredIdx !== null && (
          <line
            x1={padding.left + (hoveredIdx / Math.max(n - 1, 1)) * chartW}
            y1={padding.top}
            x2={padding.left + (hoveredIdx / Math.max(n - 1, 1)) * chartW}
            y2={padding.top + chartH}
            stroke="white"
            strokeWidth={1}
            opacity={0.5}
          />
        )}

        {/* X axis labels */}
        {data.dataPoints
          .filter((_, i) => i % Math.max(1, Math.floor(n / 6)) === 0 || i === n - 1)
          .map((dp, _, arr) => {
            const origIdx = data.dataPoints.indexOf(dp);
            const x = padding.left + (origIdx / Math.max(n - 1, 1)) * chartW;
            return (
              <text
                key={dp.date}
                x={x}
                y={height - 5}
                textAnchor={origIdx === arr.length - 1 ? "end" : "middle"}
                className="text-[8px] fill-[var(--color-text-muted)]"
              >
                {dp.date.slice(5)}
              </text>
            );
          })}

        {/* Y axis labels */}
        {[0, Math.round(maxTotal / 2), maxTotal].map((v) => {
          const y = padding.top + chartH - (v / maxTotal) * chartH;
          return (
            <text
              key={v}
              x={padding.left - 5}
              y={y + 3}
              textAnchor="end"
              className="text-[8px] fill-[var(--color-text-muted)]"
            >
              {v}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-3 justify-center flex-wrap">
        {data.columns.map((col) => (
          <div key={col} className="flex items-center gap-1 text-[10px]">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: COLUMN_COLORS[col] ?? "#71717a" }}
            />
            <span className="text-[var(--color-text-muted)]">{COLUMN_LABELS[col] ?? col}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hovered && (
        <div className="text-[10px] text-center text-[var(--color-text-muted)]">
          {hovered.date}:{" "}
          {data.columns
            .map((col) => `${COLUMN_LABELS[col] ?? col}: ${hovered.columns[col] ?? 0}`)
            .join(" | ")}
        </div>
      )}
    </div>
  );
}
