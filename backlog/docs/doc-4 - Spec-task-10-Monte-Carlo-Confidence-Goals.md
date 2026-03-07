---
id: doc-4
title: 'Spec: task-10 Monte Carlo Confidence Goals'
type: other
created_date: '2026-03-05 01:03'
---
# Implementation Spec: task-10 (F4) - Monte Carlo Confidence for Sprint Goals

## Overview
Add Monte Carlo-based confidence percentage to sprint goals, showing probability of hitting each goal target.

## Requirements

### Current State
- sprint-goals.ts uses computeForecast() for pace/status
- No computeMonteCarloForecast() usage
- No confidence field in SprintGoalsResult or SprintGoal types

### Desired Behavior
- Call computeMonteCarloForecast() to get probability distributions
- Calculate confidence % for each goal type (points, stories, epic)
- Add confidence: number (0-100) to SprintGoal type
- Display confidence in SprintGoalsCard.tsx component
- Show confidence in CLI output

## Data Sources

### computeMonteCarloForecast() Result
```typescript
interface MonteCarloResult {
  percentiles: {
    p50: string;  // ISO date
    p85: string;  // ISO date
    p95: string;  // ISO date
  };
  histogram: Array<{
    date: string;       // ISO date
    completed: number;  // median completion count
    cumulative: number; // 0-1 probability of completing by this date
  }>;
  linearConfidence: number; // 0-1
}
```

### Goal Configuration
```typescript
interface SprintGoalConfig {
  type: "epic" | "points" | "stories" | "custom";
  target?: number;  // For points/stories types
  targetStories?: number;
  targetPoints?: number;
  targetDate?: string; // ISO date
  epic?: string;  // For epic type
}
```

## Implementation

### File: `packages/plugins/tracker-bmad/src/sprint-goals.ts`

#### Step 1: Import Monte Carlo (line ~18)
```typescript
import { computeMonteCarloForecast } from "./monte-carlo.js";
```

#### Step 2: Add confidence to SprintGoal type (lines 25-33)
```typescript
export interface SprintGoal {
  title: string;
  type: "epic" | "points" | "stories" | "custom";
  target: string | number | null;
  current: number | null;
  progress: number; // 0-100
  status: "pending" | "in-progress" | "done" | "at-risk";
  details: string;
  confidence: number; // NEW - 0-100, Monte Carlo confidence of hitting goal
}
```

#### Step 3: Call Monte Carlo in computeSprintGoals (after line 67)
```typescript
// Call Monte Carlo for confidence calculations
let monteCarlo: MonteCarloResult | null = null;
try {
  monteCarlo = computeMonteCarloForecast(project);
} catch {
  // Non-fatal, confidence will be 0
}
```

#### Step 4: Calculate Confidence for Each Goal

**For "points" goals (around line 160):**
```typescript
case "points": {
  const target = config.targetPoints ?? config.target;
  const current = sprint.donePoints ?? 0;
  const total = sprint.totalPoints ?? 0;
  const remaining = (target as number) - current;
  
  let confidence = 0;
  if (monteCarlo && sprint.sprintEndDate) {
    // Find histogram bucket closest to sprint end date
    const endDate = new Date(sprint.sprintEndDate);
    const bucket = monteCarlo.histogram.find(h => {
      const bucketDate = new Date(h.date);
      return Math.abs(bucketDate.getTime() - endDate.getTime()) < 12 * 60 * 60 * 1000; // Within 12 hours
    });
    // Estimate confidence based on remaining points
    if (bucket) {
      const dailyPoints = bucket.completed / Math.max(monteCarlo.histogram.indexOf(bucket) + 1, 1);
      const projectedPoints = bucket.completed + (dailyPoints * 7); // 1 week projection
      confidence = Math.min(100, Math.max(0, (projectedPoints / (target as number)) * 100));
    }
  } else if (progress >= 100) {
    confidence = 100;
  }
  
  goals.push({
    title: "Points Goal",
    type: "points",
    target,
    current,
    progress,
    status,
    details: `${current.toFixed(0)} / ${target} points (${pace})`,
    confidence: Math.round(confidence),
  });
  break;
}
```

**For "stories" goals (similar approach):**
```typescript
case "stories": {
  const target = config.targetStories ?? config.target;
  const current = sprint.doneCount ?? 0;
  const total = sprint.totalCount ?? 0;
  const remaining = (target as number) - current;
  
  let confidence = 0;
  if (monteCarlo && sprint.sprintEndDate) {
    const endDate = new Date(sprint.sprintEndDate);
    const bucket = monteCarlo.histogram.find(h => {
      const bucketDate = new Date(h.date);
      return Math.abs(bucketDate.getTime() - endDate.getTime()) < 12 * 60 * 60 * 1000;
    });
    if (bucket) {
      confidence = Math.min(100, bucket.cumulative * 100);
    }
  } else if (progress >= 100) {
    confidence = 100;
  }
  
  goals.push({
    title: "Stories Goal",
    type: "stories",
    target,
    current,
    progress,
    status,
    details: `${current} / ${target} stories (${pace})`,
    confidence: Math.round(confidence),
  });
  break;
}
```

**For "epic" goals:**
```typescript
case "epic": {
  const epicId = config.epic;
  // ... existing logic ...
  
  let confidence = 50; // Default for epic
  if (monteCarlo && epicId) {
    // Re-run Monte Carlo with epic filter
    const epicMc = computeMonteCarloForecast(project, { epic: epicId });
    if (epicMc.histogram.length > 0 && sprint.sprintEndDate) {
      const endDate = new Date(sprint.sprintEndDate);
      const bucket = epicMc.histogram.find(h => {
        const bucketDate = new Date(h.date);
        return Math.abs(bucketDate.getTime() - endDate.getTime()) < 12 * 60 * 60 * 1000;
      });
      if (bucket) {
        confidence = Math.min(100, bucket.cumulative * 100);
      }
    }
  }
  
  goals.push({
    title: `Epic: ${epicTitle}`,
    type: "epic",
    target: epicTotal,
    current: epicDone,
    progress,
    status,
    details: `${epicDone} / ${epicTotal} stories (${pace})`,
    confidence: Math.round(confidence),
  });
  break;
}
```

**For "custom" goals:**
```typescript
case "custom": {
  // ... existing logic ...
  let confidence = progress >= 100 ? 100 : progress >= 50 ? 75 : 25;
  
  goals.push({
    title,
    type: "custom",
    target: config.target ?? null,
    current: null,
    progress,
    status,
    details,
    confidence: Math.round(confidence),
  });
  break;
}
```

### File: `packages/web/src/components/SprintGoalsCard.tsx`

#### Add Confidence Display (around line 80-91)
```tsx
<div className="flex items-center justify-between text-xs">
  <span className="text-muted">Status</span>
  <span className={`font-medium ${statusColor}`}>
    {statusLabel}
  </span>
</div>

{/* NEW: Confidence display */}
<div className="flex items-center justify-between text-xs">
  <span className="text-muted">Confidence</span>
  <span className={`font-medium ${
    goal.confidence >= 75 ? 'text-green-500' :
    goal.confidence >= 50 ? 'text-yellow-500' :
    'text-red-500'
  }`}>
    {goal.confidence}%
  </span>
</div>
```

#### Add Confidence Badge (optional, in goal header)
```tsx
<div className="flex items-center justify-between">
  <h3 className="font-medium">{goal.title}</h3>
  <span className={`text-xs px-2 py-0.5 rounded ${
    goal.confidence >= 75 ? 'bg-green-500/20 text-green-500' :
    goal.confidence >= 50 ? 'bg-yellow-500/20 text-yellow-500' :
    'bg-red-500/20 text-red-500'
  }`}>
    {goal.confidence}% conf
  </span>
</div>
```

### File: `packages/cli/src/commands/goals.ts`

#### Add Confidence to CLI Output (around line 74-79)
```typescript
console.log(
  `  ${goal.title.padEnd(25)} ${progressBar} ${progress.toString().padStart(5)}% ${statusBadge} ${goal.confidence ? `confidence: ${goal.confidence}%` : ''}`
);
```

### File: `packages/plugins/tracker-bmad/src/sprint-goals.test.ts`

#### Add Confidence Tests
```typescript
describe("Monte Carlo confidence", () => {
  it("should calculate confidence for points goals", () => {
    // Mock computeMonteCarloForecast with histogram
    // Verify confidence is calculated and returned
  });

  it("should calculate confidence for stories goals", () => {
    // Test stories goal confidence
  });

  it("should calculate confidence for epic goals with epic filter", () => {
    // Test epic goal with epic-specific Monte Carlo
  });

  it("should return 100% confidence for completed goals", () => {
    // Test done status => 100% confidence
  });

  it("should return 0% confidence when no Monte Carlo data", () => {
    // Test null monteCarlo => 0% confidence
  });
});
```

## Acceptance Criteria
- ✅ Import computeMonteCarloForecast
- ✅ Add confidence: number to SprintGoal type
- ✅ Call computeMonteCarloForecast in computeSprintGoals
- ✅ Calculate confidence for points goals using histogram
- ✅ Calculate confidence for stories goals using cumulative probability
- ✅ Calculate confidence for epic goals with epic filter
- ✅ Set default confidence for custom goals
- ✅ Return 100% confidence for completed goals
- ✅ Display confidence in SprintGoalsCard with color coding
- ✅ Show confidence in CLI output
- ✅ Add tests for confidence calculations

## Effort Estimate
2 hours | 60 lines of code + tests | Medium risk (Monte Carlo histogram logic)
