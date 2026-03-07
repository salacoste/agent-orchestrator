---
id: doc-3
title: 'Spec: task-9 Goal Line Monte Carlo Bands'
type: other
created_date: '2026-03-05 01:03'
---
# Implementation Spec: task-9 (F3) - Sprint Goal Line & Monte Carlo Bands

## Overview
Add sprint goal target line (dashed red) to BurndownChart and convert Monte Carlo vertical markers to shaded confidence bands.

## Requirements

### Part 1: Sprint Goal Target Line

#### Current State
- BurndownChart has forecast line and Monte Carlo vertical markers
- Goals API exists at /api/sprint/[project]/goals
- No goal target line rendered

#### Desired Behavior
- Fetch goals data from /api/sprint/[project]/goals
- Render horizontal dashed red line at goal target (points or stories)
- Show "Goal: X" label
- Add to legend

### Part 2: Monte Carlo Shaded Bands

#### Current State
- Vertical marker lines for P50/P85/P95 with individual labels
- Lines 296-320 in BurndownChart.tsx

#### Desired Behavior
- P50: Solid orange vertical line (median forecast)
- P85: Light orange shaded area from start to P85 (15% opacity)
- P95: Very light orange shaded area from start to P95 (8% opacity)
- Update legend to show bands + P50 line

## Implementation

### File: `packages/web/src/components/BurndownChart.tsx`

#### Part 1A: Add Goals State (after line 76)
```typescript
const [goals, setGoals] = useState<SprintGoalsResult | null>(null);
```

#### Part 1B: Import Goals Type (add to imports)
```typescript
import type { SprintGoalsResult } from "@composio/ao-plugin-tracker-bmad";
```

#### Part 1C: Fetch Goals (add to useEffect around line 133)
```typescript
const goalsFetch = fetch(`/api/sprint/${encodeURIComponent(projectId)}/goals${epicParam}`)
  .then((res) => res.ok ? res.json() : null)
  .then((d) => { if (!cancelled && d) setGoals(d as SprintGoalsResult); })
  .catch(() => {}); // Non-fatal

return Promise.all([velocityFetch, forecastFetch, mcFetch, goalsFetch]);
```

#### Part 1D: Calculate Goal Y Position (after line 189)
```typescript
// Find goal target for current mode
const goalTarget = goals?.goals.find(g => 
  (usePoints && g.type === "points") || 
  (!usePoints && g.type === "stories")
);
const goalValue = goalTarget?.target && typeof goalTarget.target === "number" 
  ? goalTarget.target 
  : null;

// Calculate Y position for goal line
const goalY = goalValue !== null 
  ? padding.top + (1 - goalValue / Math.max(total, 1)) * chartH
  : null;
```

#### Part 1E: Render Goal Line (after line 294, before Monte Carlo section)
```tsx
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
```

#### Part 2A: Replace Monte Carlo Markers with Bands (replace lines 296-320)
```tsx
{/* Monte Carlo confidence bands (shaded areas) */}
{showOverlays && mcData && chartPoints.length > 0 && days > 1 && (() => {
  const firstDate = new Date(dailyCompletions[0].date);
  const lastDate = new Date(dailyCompletions[dailyCompletions.length - 1].date);
  const spanMs = lastDate.getTime() - firstDate.getTime();
  
  const bands: Array<{ x: number; label: string; color: string; opacity: number }> = [];
  
  const addBand = (dateStr: string | undefined, opacity: number) => {
    if (!dateStr) return;
    const d = new Date(dateStr);
    const offsetMs = d.getTime() - firstDate.getTime();
    if (offsetMs < 0 || (spanMs > 0 && offsetMs > spanMs * 3)) return;
    const ratio = spanMs > 0 ? offsetMs / spanMs : 1;
    const x = padding.left + ratio * chartW;
    if (x >= padding.left && x <= padding.left + chartW) {
      bands.push({ x, color: "#f97316", opacity });
    }
  };
  
  addBand(mcData.percentiles.p95, 0.08); // Very light
  addBand(mcData.percentiles.p85, 0.15); // Light
  
  return bands.map((band, i) => (
    <rect
      key={i}
      x={padding.left}
      y={padding.top}
      width={band.x - padding.left}
      height={chartH}
      fill={band.color}
      opacity={band.opacity}
    />
  ));
})()}

{/* Monte Carlo P50 line (solid orange) */}
{showOverlays && mcData?.percentiles.p50 && chartPoints.length > 0 && days > 1 && (() => {
  const firstDate = new Date(dailyCompletions[0].date);
  const lastDate = new Date(dailyCompletions[dailyCompletions.length - 1].date);
  const spanMs = lastDate.getTime() - firstDate.getTime();
  const p50Date = new Date(mcData.percentiles.p50);
  const offsetMs = p50Date.getTime() - firstDate.getTime();
  const ratio = spanMs > 0 ? offsetMs / spanMs : 1;
  const p50X = padding.left + ratio * chartW;
  
  if (p50X < padding.left || p50X > padding.left + chartW) return null;
  
  return (
    <g>
      <line
        x1={p50X}
        y1={padding.top}
        x2={p50X}
        y2={padding.top + chartH}
        stroke="#f97316"
        strokeWidth={2}
        opacity={0.9}
      />
      <text
        x={p50X}
        y={padding.top - 4}
        textAnchor="middle"
        fill="#f97316"
        fontSize={9}
        fontWeight="bold"
      >
        P50
      </text>
    </g>
  );
})()}
```

#### Part 2B: Update Legend (replace lines 398-403)
```tsx
{showOverlays && (mcData?.percentiles.p50 || mcData?.percentiles.p85) && (
  <span className="flex items-center gap-1">
    <span className="inline-block w-3 h-2 bg-orange-500/10 rounded-sm" />
    85/95% CI
    <span className="inline-block w-3 h-0 border-t-2 border-orange-500 ml-1" />
    P50
  </span>
)}

{showOverlays && goalY !== null && (
  <span className="flex items-center gap-1">
    <span className="inline-block w-3 h-0 border-t border-dashed border-red-500" />
    Goal
  </span>
)}
```

## Acceptance Criteria

### Sprint Goal Line
- ✅ Fetch goals from /api/sprint/[project]/goals
- ✅ Detect goal target for current mode (points/stories)
- ✅ Render horizontal dashed red line at goal Y position
- ✅ Show "Goal: X" label next to line
- ✅ Only show when showOverlays is true

### Monte Carlo Bands
- ✅ Replace vertical markers with shaded rect areas
- ✅ P95 band: 8% opacity orange
- ✅ P85 band: 15% opacity orange (overlays P95)
- ✅ P50 line: Solid orange 2px vertical line
- ✅ Update legend with band + line indicators
- ✅ Bands only show when showOverlays is true

## Effort Estimate
1.5 hours | 80 lines of code | Medium risk (SVG coordinate calculations)
