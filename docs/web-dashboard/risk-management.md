---
title: Risk Management
nav_order: 6
parent: Web Dashboard
description: Composite risk scoring, risk factor aggregation, emerging risk detection, bottleneck analysis, agent utilization metrics, optimization engine with learning feedback, and configurable risk alerts with real-time SSE updates
---

# Risk Management

The risk management system provides a comprehensive view of sprint health across projects. It computes composite risk scores (0–100), aggregates risk factors from sprint health and capacity data, detects emerging risk patterns, identifies bottlenecks across 10 types, tracks agent utilization with time-series history, generates optimization suggestions ranked by multi-factor scoring, and broadcasts configurable alerts via SSE.

{: .highlight }
Risk scores use a **weighted sum formula**: each contributor (risk factor, bottleneck, sprint health) is weighted by severity (critical=1.5, high=1.0, medium=0.6, low=0.3), summed, and normalized by 150 to produce a 0–100 score. Severity labels apply consistent thresholds: **>=76 critical, >=51 high, >=26 medium, else low**.

## Overview

The risk system spans a single page with five stacked panels:

| Panel | Component | Description |
|-------|-----------|-------------|
| **Risk Score** | `RiskScorePanel` | Composite 0–100 scores per project and portfolio-wide, with emerging risks and alert banner |
| **Risk Dashboard** | `RiskDashboard` | Aggregated risk factors with 4-column severity summary |
| **Bottleneck Analysis** | `BottleneckDashboard` | Identified bottlenecks across 10 types with impact scoring |
| **Utilization Metrics** | `UtilizationMetricsPanel` | Agent utilization with time-series rolling averages |
| **Optimization** | `OptimizationPanel` | Ranked suggestions from 5 analyzers with objective scenarios and learning |

**Page route:** `/risk` (`packages/web/src/app/risk/page.tsx`) — server component with `force-dynamic`. Loads project list from config and passes `{ id, name }[]` to each panel component.

## Risk Score

The risk score engine (`packages/web/src/lib/risk-score.ts`) computes a composite 0–100 score per project:

**Scoring formula:**
1. Collect contributors from risk factors, bottlenecks, and sprint health
2. Weight each contributor by severity: `critical=1.5`, `high=1.0`, `medium=0.6`, `low=0.3`
3. Sum weighted scores, divide by `NORMALIZATION_CONSTANT` (150), multiply by 100
4. Clamp to 0–100 and assign severity label
5. Contribution percentages use largest-remainder method to sum to exactly 100%

**Portfolio score** — `calculatePortfolioScore()` averages all project scores.

**Component:** `RiskScorePanel` (`packages/web/src/components/RiskScorePanel.tsx`) renders:
- Alert banner with SSE-driven real-time notifications
- Portfolio-level score with severity label
- Responsive grid of `RiskScoreCard` components, each showing:
  - Large severity-colored score number
  - Severity label, project name, factor/bottleneck counts
  - Expandable "Emerging Risks" section with `EmergingRiskCard` (trajectory icon, severity, pattern, cause, suggested action)
  - Expandable "Top Contributors" section with contribution percentages

**API endpoint:** `GET /api/risk/score?project={id}&breakdown=true`

## Risk Factor Aggregation

`aggregateRiskFactors()` (`packages/web/src/lib/risk-aggregation.ts`) aggregates risk factors from multiple data sources:

**Five risk factor types:**

| Type | Description | Data Source |
|------|-------------|-------------|
| `high-risk-stories` | Critical sprint health indicators | Sprint health indicators (severity ≠ "ok") |
| `resource-bottleneck` | At/near capacity agents | Capacity check results |
| `velocity-anomaly` | Utilization extremes | Agent utilization data |
| `blocking-pattern` | Sprint health score below threshold | Composite sprint health |
| `scope-creep` | Trend degradation | Throughput column trends |

**Severity model:**
- Health indicator mapping: critical=80, warning=50, ok=15
- Agent overutilization: >90% → severity = utilizationPercent
- Agent underutilization: active AND <30% → severity 30
- Sprint health: <60 triggers risk factor with severity = (100 − sprintHealthScore)
- Trend derivation: slope < −0.05 = "improving", slope > +0.05 = "worsening"

**Component:** `RiskDashboard` (`packages/web/src/components/RiskDashboard.tsx`) renders:
- 4-column summary grid: Critical (red), High (yellow), Medium, Low
- Project filter dropdown (shown when multiple projects)
- Expandable `RiskFactorCard` list sorted by severity descending
- "Last updated" timestamp footer
- Auto-refresh every 30 seconds

**API endpoint:** `GET /api/risk/dashboard?project={id}`

## Emerging Risk Detection

`detectEmergingRisks()` (`packages/web/src/lib/emerging-risk-detection.ts`) runs 5 pattern detectors:

| Pattern | Threshold | Severity | Trajectory |
|---------|-----------|----------|------------|
| `velocity-drop` | Recent 2-week avg < 75% of 4-week baseline | ratio<0.4→70, <0.6→50, else 30 | ratio<0.5→worsening |
| `throughput-decline` | Column dwell slope > 0.05 | min(100, 40 + slope×100) | slope>0.3→worsening |
| `capacity-trend` | Agent utilization > 70% | Per-agent severity | utilization>85%→worsening |
| `blocker-accumulation` | Stuck stories >= 3 + throughput-drop indicator | min(100, 60 + (count−3)×5) | count>5→worsening |
| `aging-acceleration` | Aging factors + column slope > 0.1 | min(100, 50 + agingFactors×10) | slope>0.1→worsening |

Detectors are independent — multiple can fire for the same project. Results are sorted by severity descending. Velocity-drop requires >=4 weeks of weekly throughput data.

## Bottleneck Analysis

`aggregateBottlenecks()` (`packages/web/src/lib/bottleneck-aggregation.ts`) identifies bottlenecks from 8 data sources:

| Source | Tracker Function | Detection |
|--------|-----------------|-----------|
| Sprint health indicators | `computeSprintHealth()` | Indicators with severity ≠ "ok" |
| Cycle time | `computeCycleTime()` | Column bottleneck (dwell ratio >= 2x) |
| Throughput trend | `computeThroughput()` | Worsening bottleneck trend |
| Team workload | `computeTeamWorkload()` | Overloaded agents |
| Unassigned stories | `computeTeamWorkload()` | Stories without agent assignment |
| Story aging | `computeStoryAging()` | Stories with `isAging` flag |
| Capacity | `getCapacityStatus()` | At/near capacity agents |
| Conflicts | `runConflictDetection()` | Resource conflicts |

**Ten bottleneck types:** `column-bottleneck`, `stuck-stories`, `wip-violation`, `throughput-drop`, `agent-overload`, `capacity-bottleneck`, `resource-conflict`, `unassigned-stories`, `aging-stories`, `bottleneck-trend`

**Impact score formula:**
```
raw = storiesAffected × 10 + delayDays × 5 + severityNum × 0.3
impactScore = min(100, round(raw))
```

**Stuck story thresholds:** 48 hours (172,800,000ms) → warning, 96 hours (345,600,000ms) → critical.

**Component:** `BottleneckDashboard` (`packages/web/src/components/BottleneckDashboard.tsx`) renders:
- 5-column summary grid: Stuck Stories, WIP Violations, Aging Stories, Overloaded Agents, Resource Conflicts
- Project filter dropdown
- Expandable `BottleneckCard` list with impact score, delay estimate, and suggested action
- Auto-refresh every 30 seconds

**API endpoint:** `GET /api/risk/bottleneck?project={id}`

## Utilization Metrics

The utilization system (`packages/web/src/lib/utilization-snapshot.ts`, `utilization-history.ts`, `utilization-metrics-types.ts`) tracks agent utilization over time:

**Thresholds:**
- Overutilized: >90%
- Underutilized: <30%
- Near capacity: >80%

**Time windows:** 1h (3,600,000ms), 24h (86,400,000ms), 7d (604,800,000ms)

**Rolling averages:** `computeRollingAverage()` computes arithmetic mean of in-window snapshots. `computeTrend()` compares older half vs newer half — delta > 5pp → "declining", delta < −5pp → "improving".

**History storage:** In-memory `globalThis._aoUtilizationHistory` singleton with max 20,160 snapshots per agent (~7 days at 1 snapshot/30s), max age 7 days.

**Component:** `UtilizationMetricsPanel` (`packages/web/src/components/UtilizationMetricsPanel.tsx`) renders:
- **Portfolio mode**: 4-column metric grid (Total Agents, Avg Utilization, Overutilized, Underutilized) + responsive grid of project cards with utilization bars
- **Single-project mode**: Agent rows with utilization bars, agent ID, percentage, active/idle status, pool badge
- Time window selector: 1h / 24h / 7d
- Project filter dropdown
- Auto-refresh every 30 seconds

**API endpoint:** `GET /api/risk/utilization?project={id}&window=24h`

## Optimization Engine

The optimization engine (`packages/web/src/lib/optimization-engine.ts`) generates suggestions via 5 analyzers:

| Analyzer | Category | Trigger | Confidence |
|----------|----------|---------|------------|
| Agent rebalancing | `agent-rebalancing` | Over/under agent pairs across projects | 85 (pool), 65 (non-pool) |
| WIP adjustment | `wip-adjustment` | Bottleneck severity >= 40 | 70 |
| Priority reorder | `priority-reorder` | Stuck/aging stories, blocking patterns | 60 (stuck), 55 (risk) |
| Capacity scaling | `capacity-scaling` | At/near capacity agents | 75 (at-cap), 50 (near-cap) |
| Underutilized detection | `underutilized-detection` | Utilization < 30% | 50–95 (formula-based) |

**Ranking formula:**
```
priority = daysSaved × 2 + riskReduction × 1.5 + |utilDelta| × 1 + confidence × 0.1
```

Optional learning weights multiply priority by category-specific boost/penalty factor.

**Component:** `OptimizationPanel` (`packages/web/src/components/OptimizationPanel.tsx`) renders:
- Objective selector: Baseline + 4 objectives
- Category filter chips (5 categories)
- `SuggestionCard` with category badge, confidence %, title, impact metrics, and Accept/Dismiss actions
- "Compare Impact" toggle showing before/after analysis
- "Compare Objectives" toggle showing side-by-side objective comparison
- "Reset Learning" button

**API endpoint:** `GET /api/risk/optimization` (also `PATCH` for feedback, `DELETE` to reset learning)

## Objective Scenarios

The scenario engine (`packages/web/src/lib/optimization-scenario.ts`) re-ranks suggestions for 4 optimization objectives:

| Objective | Focus | Top Weight |
|-----------|-------|------------|
| `minimize-time` | Fastest completion | daysSaved: 3.0 |
| `maximize-throughput` | Highest output | utilizationDelta: 1.5, daysSaved: 2.5 |
| `balance-workload` | Even distribution | utilizationDelta: 2.5 |
| `reduce-blocking` | Fewest blockers | riskReduction: 2.5 |

Each objective boosts certain categories and suppresses others:

| Objective | Boosted Categories | Suppressed |
|-----------|-------------------|------------|
| minimize-time | agent-rebalancing, priority-reorder | capacity-scaling |
| maximize-throughput | wip-adjustment, capacity-scaling, underutilized-detection | priority-reorder |
| balance-workload | agent-rebalancing, underutilized-detection | priority-reorder |
| reduce-blocking | priority-reorder | capacity-scaling |

**Comparison panel** (`ObjectiveComparisonPanel`) shows all 4 objectives side-by-side with projected impact and top suggestions.

## Optimization Learning

The learning system (`packages/web/src/lib/optimization-feedback.ts`, `optimization-learning.ts`) adjusts suggestion rankings based on user feedback:

**Feedback recording:** Accept/dismiss actions stored in-memory (`globalThis._aoOptimizationFeedback`), capped at 1000 entries.

**Learning weights:** `computeLearningWeights()` maps acceptance rate per category to a multiplier:
- Rate × `LEARNING_BOOST_MAX` (1.5), clamped to [0.5, 1.5]
- Categories with fewer than `LEARNING_MIN_SAMPLES` (3) get multiplier 1.0

**Impact analysis** (`packages/web/src/lib/optimization-impact.ts`) projects before/after metrics:
- Velocity estimate: `(utilizationPercent / 100) × VELOCITY_UTILIZATION_RATIO` (0.8) stories/day
- Risk after: `beforeRisk × (1 − riskReductionPercent / 100)`, clamped 0–100
- Completion date shift = daysSaved from suggestion

## Risk Alerts

The alert system (`packages/web/src/lib/risk-alert-broadcaster.ts`, `risk-alert-evaluation.ts`, `risk-alert-types.ts`) monitors risk scores and emerging risks:

**Default alert thresholds:**
- Score >= 76 → critical alert
- Score >= 51 → high alert
- Emerging risk score >= 60 → alert

**Evaluation:** `evaluateRiskAlerts()` checks per-project thresholds, resolving from `projectOverrides` first then `defaultThresholds`. Alert IDs are deduplicated via `knownAlertIds` set.

**Broadcaster:** `globalThis._aoRiskAlertBroadcaster` singleton with pub/sub pattern. `subscribeRiskAlerts(callback)` returns unsubscribe function. `evaluateCachedAndBroadcast()` runs evaluation against cached score data and notifies subscribers.

**Component:** `RiskAlertBanner` (`packages/web/src/components/RiskAlertBanner.tsx`) renders:
- Severity-styled banner: critical=red border, high=yellow, medium=raised surface
- Alert icon: score-threshold=warning triangle, emerging-risk=microscope
- Title, details, timestamp
- "Acknowledge" button calling `PATCH /api/risk/alerts`
- Returns `null` when no active alerts

**SSE hook:** `useRiskAlertSSE` (`packages/web/src/hooks/useRiskAlertSSE.ts`) subscribes to `/api/events` for `risk-alert` event type using EventSource with auto-reconnect.

## Alert Configuration

Alert configuration (`packages/web/src/lib/risk-alert-config.ts`) is managed in-memory:

**Config structure:**
- `enabled`: boolean (global toggle)
- `defaultThresholds`: array of `{ riskType, minScore, severityLabel?, enabled }`
- `projectOverrides`: record mapping project ID to custom threshold arrays

**API endpoints:**
- `GET /api/risk/alerts/config` — returns full config
- `PUT /api/risk/alerts/config` — partial merge update (validates minScore 0–100, enabled boolean)
- `GET /api/risk/alerts` — returns active alerts, recent acknowledged, and config
- `PATCH /api/risk/alerts` — acknowledge alert (body: `{ alertId, action: "acknowledge" }`)

{: .note }
Alert configuration is currently **in-memory only** — not persisted to YAML. Restarting the server resets to defaults.

## API Routes

### Risk Dashboard & Score

| Method | Endpoint | Purpose | Key Status Codes |
|--------|----------|---------|------------------|
| `GET` | `/api/risk/dashboard` | Risk factors with severity summary (optional `project` filter) | 200, 404, 500 |
| `GET` | `/api/risk/score` | Composite risk score (optional `project`, `breakdown=true` for contributors) | 200, 404, 500 |

### Bottleneck & Utilization

| Method | Endpoint | Purpose | Key Status Codes |
|--------|----------|---------|------------------|
| `GET` | `/api/risk/bottleneck` | Bottleneck analysis (optional `project` filter) | 200, 404, 500 |
| `GET` | `/api/risk/utilization` | Utilization metrics (optional `project`, `window=1h\|24h\|7d`) | 200, 500 |

### Optimization

| Method | Endpoint | Purpose | Key Status Codes |
|--------|----------|---------|------------------|
| `GET` | `/api/risk/optimization` | Suggestions with optional `project`, `category`, `objective`, `compare`, `impact`, `suggestionId` | 200, 400, 404, 500 |
| `PATCH` | `/api/risk/optimization` | Accept/dismiss suggestion (`{ suggestionId, action, category }`) | 200, 400 |
| `DELETE` | `/api/risk/optimization` | Reset learning feedback | 200 |

### Alerts

| Method | Endpoint | Purpose | Key Status Codes |
|--------|----------|---------|------------------|
| `GET` | `/api/risk/alerts` | Active alerts, acknowledged alerts, config | 200 |
| `PATCH` | `/api/risk/alerts` | Acknowledge alert (`{ alertId, action: "acknowledge" }`) | 200, 400, 404 |
| `GET` | `/api/risk/alerts/config` | Current alert configuration | 200 |
| `PUT` | `/api/risk/alerts/config` | Update alert config (partial merge) | 200, 400 |

**Key validation rules:**
- `project`: must exist in config (404 if not found)
- `action` for alerts: must be `"acknowledge"`
- `action` for optimization: must be `"accepted"` or `"dismissed"`
- `objective`: must be one of 4 valid values
- `category`: must be one of 5 valid values
- `minScore`: must be 0–100
- Cannot specify both `compare` and `objective` simultaneously

## Key Types

### RiskFactor

```typescript
interface RiskFactor {
  id: string;
  type: RiskFactorType;                        // "high-risk-stories" | "resource-bottleneck" | "velocity-anomaly" | "blocking-pattern" | "scope-creep"
  title: string;
  severity: number;                            // 0-100
  severityLabel: RiskSeverityLabel;            // "critical" | "high" | "medium" | "low"
  trend: RiskTrend;                            // "improving" | "stable" | "worsening"
  affectedProjects: string[];
  contributingFactors: string[];
  affectedStories: string[];
  suggestedAction: string;
}
```

### RiskScoreResult

```typescript
interface RiskScoreResult {
  projectId: string;
  score: number;                               // 0-100 composite
  severityLabel: RiskSeverityLabel;
  contributors: RiskScoreContributor[];
  factorCount: number;
  bottleneckCount: number;
  lastUpdated: string;                         // ISO 8601
}
```

### EmergingRisk

```typescript
interface EmergingRisk {
  id: string;
  type: EmergingRiskPattern;                   // "velocity-drop" | "throughput-decline" | "capacity-trend" | "blocker-accumulation" | "aging-acceleration"
  title: string;
  status: "emerging";
  severity: number;
  trajectory: RiskTrend;
  pattern: string;
  detectedAt: string;
  cause: string;
  suggestedAction: string;
  projectId: string;
  contributingFactors: string[];
}
```

### BottleneckItem

```typescript
interface BottleneckItem {
  id: string;
  type: BottleneckType;                        // 10 possible values
  title: string;
  severity: number;
  severityLabel: BottleneckSeverityLabel;
  impact: BottleneckImpact;                    // { storiesAffected, estimatedDelayDays, impactScore }
  trend: BottleneckTrend;
  affectedProjects: string[];
  affectedStories: string[];
  contributingFactors: string[];
  suggestedAction: string;
}
```

### OptimizationSuggestion

```typescript
interface OptimizationSuggestion {
  id: string;
  category: OptimizationCategory;              // "agent-rebalancing" | "wip-adjustment" | "priority-reorder" | "capacity-scaling" | "underutilized-detection"
  title: string;
  description: string;
  impact: EstimatedImpact;                     // { daysSaved, riskReductionPercent, utilizationDeltaPercent, affectedAgents, affectedProjects, affectedStories }
  confidence: number;                          // 0-100
  priority: number;                            // 0-100
  createdAt: number;
  data: Record<string, unknown>;
}
```

### Supporting Types

| Type | Values/Shape | Description |
|------|-------------|-------------|
| `RiskFactorType` | `"high-risk-stories" \| "resource-bottleneck" \| "velocity-anomaly" \| "blocking-pattern" \| "scope-creep"` | Risk factor categories |
| `RiskSeverityLabel` | `"critical" \| "high" \| "medium" \| "low"` | Severity level (>=76, >=51, >=26, else) |
| `RiskTrend` | `"improving" \| "stable" \| "worsening"` | Direction of change |
| `RiskAlert` | `{ id, projectId, triggeredAt, alertType, severity, severityLabel, title, details, acknowledged }` | Active risk alert |
| `RiskAlertConfig` | `{ enabled, defaultThresholds[], projectOverrides }` | Alert threshold configuration |
| `BottleneckType` | 10 string union values | Bottleneck categories |
| `BottleneckSeverityLabel` | `"critical" \| "high" \| "medium" \| "low"` | Bottleneck severity level |
| `BottleneckTrend` | `"improving" \| "stable" \| "worsening"` | Bottleneck direction of change |
| `EstimatedImpact` | `{ daysSaved, riskReductionPercent, utilizationDeltaPercent, affectedAgents, affectedProjects, affectedStories }` | Projected optimization impact |
| `BottleneckSummary` | `{ stuckStories, wipViolations, agingStories, overloadedAgents, resourceConflicts, totalBottlenecks }` | Bottleneck counts |
| `OptimizationObjective` | `"minimize-time" \| "maximize-throughput" \| "balance-workload" \| "reduce-blocking"` | Optimization focus |
| `ImpactAnalysis` | `{ completionDateShift, velocityDelta, riskChange, beforeMetrics, afterMetrics }` | Before/after projection |
| `UtilizationSnapshot` | `{ agentId, projectId, timestamp, utilizationPercent, isActive, storiesWorked, isPoolAgent, isAtCapacity, isNearCapacity }` | Point-in-time utilization |
| `ProjectUtilizationSummary` | `{ projectId, avgUtilization, overutilizedCount, underutilizedCount, agentCount, agentSnapshots, poolBreakdown? }` | Per-project aggregation |

## Next Steps

- [Web Dashboard Overview](./index.md) — Dashboard architecture and navigation
- [Portfolio View](./portfolio-view.md) — Cross-project portfolio dashboard
- [Sprint Board](./sprint-board.md) — Story columns, assignment, and analytics
- [Session Detail](./session-detail.md) — Individual session deep-dive view
- [Scenario Comparison](./scenario-comparison.md) — What-if analysis and Monte Carlo simulation
- [Conflict Resolution](./conflict-resolution.md) — Conflict detection and resolution workflows
- [Conflicts & Risk API](../api/conflicts-risk.md) — Full API reference for risk endpoints *(upcoming)*
- [Getting Started](../getting-started/index.md) — Installation and first steps
- [Configuration](../getting-started/configuration.md) — YAML configuration reference
