---
id: doc-2
title: 'Spec: task-8 Velocity Declining Notification'
type: other
created_date: '2026-03-05 01:03'
---
# Implementation Spec: task-8 (F2) - Velocity Declining Notification

## Overview
Add notification alert when weekly velocity shows a declining trend over time.

## Requirements

### Current State
- 3 of 4 notification types implemented in sprint-notifications.ts
- computeVelocityComparison() exists but NOT imported/called
- No alert for declining velocity trend

### Desired Behavior
- Import computeVelocityComparison and check velocity trend
- Alert when trend === "declining" AND confidence >= threshold
- Configurable via velocityDecliningEnabled and velocityTrendConfidenceThreshold
- Severity: critical if slope < -1, warning otherwise

## Implementation

### File: `packages/plugins/tracker-bmad/src/sprint-notifications.ts`

#### 1. Add Import (line ~7-15, after existing imports)
```typescript
import { computeVelocityComparison } from "./velocity-comparison.js";
```

#### 2. Add Notification Type (lines 37-58, add to type union)
```typescript
type SprintNotificationType =
  | "sprint.health_warning"
  | "sprint.health_critical"
  | "sprint.forecast_behind"
  | "sprint.story_stuck"
  | "sprint.wip_exceeded"
  | "sprint.backlog_aging"
  | "sprint.cycle_time_regression"
  | "sprint.team_overload"
  | "sprint.blocked_aging"
  | "sprint.rework_rate_high"
  | "sprint.rework_story_bouncing"
  | "sprint.column_aging"
  | "sprint.dependency_circular"
  | "sprint.dependency_blocked"
  | "sprint.velocity_declining"; // NEW
```

#### 3. Add Threshold Config (lines 21-35, add to interface)
```typescript
export interface NotificationThresholds {
  stuckHours: number;
  wipLimit: number;
  throughputDropPct: number;
  forecastBehind: boolean;
  backlogAgingDays: number;
  cycleTimeRegressionPct: number;
  teamOverloadLimit: number;
  blockedAgingHours: number;
  reworkRatePct: number;
  reworkCountPerStory: number;
  columnAgingHours: number;
  circularDepsEnabled: boolean;
  blockedStoriesEnabled: boolean;
  velocityDecliningEnabled: boolean;        // NEW
  velocityTrendConfidenceThreshold: number; // NEW
}
```

#### 4. Add Default Thresholds (lines 64-78, add to DEFAULT_THRESHOLDS)
```typescript
const DEFAULT_THRESHOLDS: NotificationThresholds = {
  stuckHours: 48,
  wipLimit: 3,
  throughputDropPct: 30,
  forecastBehind: true,
  backlogAgingDays: 14,
  cycleTimeRegressionPct: 30,
  teamOverloadLimit: 3,
  blockedAgingHours: 48,
  reworkRatePct: 25,
  reworkCountPerStory: 3,
  columnAgingHours: 24,
  circularDepsEnabled: true,
  blockedStoriesEnabled: true,
  velocityDecliningEnabled: true,        // NEW - default enabled
  velocityTrendConfidenceThreshold: 0.5, // NEW - require moderate confidence
};
```

#### 5. Add Notification Check (after line 356, add section 12)
```typescript
// 12. Velocity declining trend
try {
  if (merged.velocityDecliningEnabled) {
    const velocityComp = computeVelocityComparison(project);
    if (
      velocityComp.trend === "declining" &&
      velocityComp.trendConfidence >= merged.velocityTrendConfidenceThreshold
    ) {
      notifications.push({
        type: "sprint.velocity_declining",
        severity: velocityComp.trendSlope < -1 ? "critical" : "warning",
        title: "Velocity Trend Declining",
        message: `Weekly velocity is trending down (confidence: ${Math.round(velocityComp.trendConfidence * 100)}%)`,
        details: [
          `Average velocity: ${velocityComp.averageVelocity.toFixed(1)} stories/week`,
          `Trend slope: ${velocityComp.trendSlope.toFixed(2)} stories/week²`,
          `Confidence: ${Math.round(velocityComp.trendConfidence * 100)}%`,
          `Next week estimate: ${velocityComp.nextWeekEstimate.toFixed(1)} stories`,
          ...velocityComp.weeks.slice(-4).map(w => `${w.weekStart}: ${w.completedCount} stories`),
        ],
        timestamp: now,
      });
    }
  }
} catch {
  // Non-fatal
}
```

### File: `packages/plugins/tracker-bmad/src/sprint-notifications.test.ts`

#### Add Tests
```typescript
describe("velocity declining notification", () => {
  it("should notify when velocity trend is declining with high confidence", async () => {
    // Mock computeVelocityComparison to return declining trend
    // Verify notification is pushed
  });

  it("should not notify when velocity trend is stable", async () => {
    // Mock computeVelocityComparison to return stable trend
    // Verify no notification
  });

  it("should not notify when velocityDecliningEnabled is false", async () => {
    // Set velocityDecliningEnabled: false
    // Verify no notification even with declining trend
  });

  it("should respect confidence threshold", async () => {
    // Mock with low confidence
    // Verify no notification
  });
});
```

## Acceptance Criteria
- ✅ Import computeVelocityComparison
- ✅ Add sprint.velocity_declining notification type
- ✅ Add velocityDecliningEnabled and velocityTrendConfidenceThreshold config
- ✅ Call computeVelocityComparison in checkSprintNotifications
- ✅ Generate notification when trend === "declining" and confidence >= threshold
- ✅ Severity: critical if slope < -1, warning otherwise
- ✅ Include details: avg velocity, slope, confidence, next week estimate
- ✅ Add tests for new notification type

## Effort Estimate
1 hour | 50 lines of code + tests | Low risk
