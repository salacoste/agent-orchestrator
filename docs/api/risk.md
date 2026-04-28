---
title: Risk API
nav_order: 9
parent: REST API
description: Risk scoring, alerts with configurable thresholds, bottleneck identification, optimization suggestions with learning feedback, agent utilization tracking, and lightweight risk dashboard.
---

# Risk API

Monitor, score, and optimize risk across projects and agents. Includes composite risk scoring with emerging risk detection, configurable alert thresholds, bottleneck identification from sprint health data, optimization suggestions with accept/dismiss learning feedback, and agent utilization tracking with time-series data.

7 route files under `/api/risk/`. 11 endpoints total: 7 GET, 2 PATCH, 1 PUT, 1 DELETE. All routes export `force-dynamic`.

| Group | Prefix | Routes | Methods | Description |
|-------|--------|--------|---------|-------------|
| Risk Score | `/api/risk/score` | 1 | GET | Composite risk score (single or portfolio) |
| Alerts | `/api/risk/alerts` | 1 | GET, PATCH | Active alerts and acknowledge |
| Alert Config | `/api/risk/alerts/config` | 1 | GET, PUT | Alert threshold configuration |
| Bottleneck | `/api/risk/bottleneck` | 1 | GET | Bottleneck identification and summary |
| Optimization | `/api/risk/optimization` | 1 | GET, PATCH, DELETE | Optimization suggestions with learning |
| Utilization | `/api/risk/utilization` | 1 | GET | Agent utilization metrics and time series |
| Dashboard | `/api/risk/dashboard` | 1 | GET | Lightweight risk overview |

Source: `packages/web/src/app/api/risk/`

{: .warning}
> Alert state and optimization learning feedback are **in-memory only**. Changes are lost on server restart. Persistent storage is tracked as a follow-up task.

## Risk Score

```
GET /api/risk/score
```

Returns composite risk scores with optional contributor breakdown and emerging risk detection. Operates in two modes: single-project (with `project` param) or portfolio (all projects).

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `project` | `string` | Project ID for single-project mode. Omit for portfolio mode. |
| `breakdown` | `string` | Set to `true` to include contributor breakdown (single-project mode only) |

### Score Computation

1. Aggregates risk factors from sprint health indicators, capacity, and agent utilization via `aggregateRiskFactors()`
2. Aggregates bottlenecks from sprint health, cycle time, throughput, team workload, story aging, capacity, and conflicts via `aggregateBottlenecks()`
3. Computes composite score via `calculateRiskScore()` — weighted sum of all risk factors and bottlenecks, normalized by 150
4. Sprint health score: heuristic `100 - 15*critical - 5*warning - 10*blocked`, clamped 0-100. Only contributes to risk if below 60 (inverted as health risk)
5. Detects emerging risks via 5 pattern detectors: velocity-drop, throughput-decline, capacity-trend, blocker-accumulation, aging-acceleration

Severity weights: `critical = 1.5`, `high = 1.0`, `medium = 0.6`, `low = 0.3`.

Severity label thresholds: `critical >= 76`, `high >= 51`, `medium >= 26`, `low < 26`.

{: .note}
> Sprint health, cycle time, throughput, team workload, and story aging are computed via `@composio/ao-plugin-tracker-bmad` for projects using the `bmad` tracker. Non-bmad projects receive empty defaults.

### Response (single project)

```json
{
  "projectId": "my-project",
  "projectName": "My Project",
  "score": 72,
  "severityLabel": "high",
  "factorCount": 5,
  "bottleneckCount": 3,
  "emergingRisks": [
    {
      "id": "er-001",
      "type": "throughput-decline",
      "title": "Throughput declining over 3-day window",
      "status": "emerging",
      "severity": 65,
      "trajectory": "worsening",
      "pattern": "3-day-decline",
      "detectedAt": "2026-04-25T14:30:00.000Z",
      "cause": "Daily story completion dropped below 7-day average",
      "suggestedAction": "Review in-progress stories for blockers",
      "projectId": "my-project",
      "contributingFactors": ["throughput-trend-negative"]
    }
  ],
  "lastUpdated": "2026-04-25T14:30:01.234Z"
}
```

The `contributors` field (array of `RiskScoreContributor`) is included only when `breakdown=true`.

### Response (portfolio)

```json
{
  "scores": [
    {
      "projectId": "project-a",
      "score": 72,
      "severityLabel": "high",
      "factorCount": 5,
      "bottleneckCount": 3,
      "emergingRisks": []
    }
  ],
  "portfolioScore": 65,
  "portfolioSeverityLabel": "high",
  "lastUpdated": "2026-04-25T14:30:01.234Z"
}
```

Portfolio score is the average of all project scores, rounded.

{: .highlight}
> **Side effect in portfolio mode:** Calls `updateScoreCache()` to cache score data for the alert broadcaster. This triggers alert evaluation against configured thresholds.

### Errors

| Status | Condition |
|--------|-----------|
| `404` | `project` param provided but not found in config |
| `500` | Failed to load services or compute scores |

Source: `packages/web/src/app/api/risk/score/route.ts`

## Alerts

```
GET  /api/risk/alerts
PATCH /api/risk/alerts
```

Manage risk alerts triggered by score thresholds and emerging risk detection.

### GET — List Alerts

Returns active and recently-acknowledged alerts along with current configuration.

#### Response

```json
{
  "activeAlerts": [
    {
      "id": "alert-001",
      "projectId": "my-project",
      "triggeredAt": "2026-04-25T14:30:00.000Z",
      "alertType": "score-threshold",
      "severity": 78,
      "severityLabel": "critical",
      "title": "Risk score critical: my-project (78)",
      "details": "Score 78 exceeds threshold 76 for severity critical",
      "acknowledged": false
    }
  ],
  "recentAcknowledged": [
    {
      "id": "alert-002",
      "projectId": "my-project",
      "triggeredAt": "2026-04-25T10:00:00.000Z",
      "alertType": "emerging-risk",
      "severity": 65,
      "severityLabel": "high",
      "title": "Emerging risk: throughput-decline",
      "details": "Throughput declining over 3-day window",
      "acknowledged": true
    }
  ],
  "config": {
    "enabled": true,
    "defaultThresholds": [
      { "riskType": "score", "minScore": 76, "severityLabel": "critical", "enabled": true },
      { "riskType": "score", "minScore": 51, "severityLabel": "high", "enabled": true },
      { "riskType": "emerging-risk", "minScore": 60, "enabled": true }
    ],
    "projectOverrides": {}
  }
}
```

`recentAcknowledged` contains all alerts from the in-memory store where `acknowledged` is `true`.

{: .warning}
> **In-memory only:** Alert state is stored in a singleton broadcaster. All alerts are lost on server restart.

Source: `packages/web/src/app/api/risk/alerts/route.ts`

### PATCH — Acknowledge Alert

Acknowledge a single active alert.

#### Request Body

```json
{
  "alertId": "alert-001",
  "action": "acknowledge"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `alertId` | `string` | Yes | The alert ID to acknowledge |
| `action` | `string` | Yes | Must be `"acknowledge"` |

#### Response

```json
{ "success": true, "alertId": "alert-001" }
```

#### Errors

| Status | Condition |
|--------|-----------|
| `400` | Missing `alertId`, non-string `alertId`, or `action` is not `"acknowledge"` |
| `404` | Alert not found |

Source: `packages/web/src/app/api/risk/alerts/route.ts`

## Alert Configuration

```
GET /api/risk/alerts/config
PUT /api/risk/alerts/config
```

Manage risk alert thresholds. Configuration supports global defaults and per-project overrides.

### GET — Current Configuration

Returns the current `RiskAlertConfig`.

#### Response

```json
{
  "enabled": true,
  "defaultThresholds": [
    { "riskType": "score", "minScore": 76, "severityLabel": "critical", "enabled": true },
    { "riskType": "score", "minScore": 51, "severityLabel": "high", "enabled": true },
    { "riskType": "emerging-risk", "minScore": 60, "enabled": true }
  ],
  "projectOverrides": {}
}
```

The default thresholds are:
- Score >= 76 triggers `critical` alert
- Score >= 51 triggers `high` alert
- Emerging risk severity >= 60 triggers alert

Source: `packages/web/src/app/api/risk/alerts/config/route.ts`

### PUT — Update Configuration

Accepts a partial or full `RiskAlertConfig` update. Only provided fields are merged.

{: .warning}
> **In-memory only:** Configuration changes are not persisted to YAML. Changes are lost on server restart.

#### Request Body

```json
{
  "enabled": true,
  "defaultThresholds": [
    { "riskType": "score", "minScore": 80, "severityLabel": "critical", "enabled": true }
  ],
  "projectOverrides": {
    "my-project": [
      { "riskType": "score", "minScore": 70, "severityLabel": "critical", "enabled": true }
    ]
  }
}
```

All fields are optional (partial update semantics):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enabled` | `boolean` | No | Master switch for alert evaluation |
| `defaultThresholds` | `RiskAlertThreshold[]` | No | Global threshold rules |
| `projectOverrides` | `Record<string, RiskAlertThreshold[]>` | No | Per-project overrides |

#### Validation Rules

| Rule | Constraint |
|------|-----------|
| `enabled` | Must be `boolean` if provided |
| `defaultThresholds` | Must be array if provided |
| Each threshold.`minScore` | Number 0-100 |
| Each threshold.`enabled` | Must be `boolean` |
| `projectOverrides` | Must be object if provided |

#### Response

Returns the full updated `RiskAlertConfig`.

#### Errors

| Status | Condition |
|--------|-----------|
| `400` | Invalid JSON, non-object body, validation failure |

Source: `packages/web/src/app/api/risk/alerts/config/route.ts`

## Bottleneck

```
GET /api/risk/bottleneck
```

Identifies and aggregates flow bottlenecks from sprint health, cycle time, throughput, team workload, story aging, capacity, and resource conflicts. Operates in single-project or cross-project mode.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `project` | `string` | Project ID for single-project mode. Omit for cross-project aggregation. |

### Bottleneck Types (10)

| Type | Source |
|------|--------|
| `column-bottleneck` | Cycle time: column with longest dwell |
| `stuck-stories` | Sprint health: stories not moving |
| `wip-violation` | Sprint health: WIP limit exceeded |
| `throughput-drop` | Throughput: declining trend |
| `agent-overload` | Team workload: agent over capacity |
| `capacity-bottleneck` | Capacity: agent at/near capacity |
| `resource-conflict` | Conflict detection: competing projects |
| `unassigned-stories` | Team workload: stories without owner |
| `aging-stories` | Story aging: old in-progress stories |
| `bottleneck-trend` | Throughput: worsening bottleneck pattern |

### Response

```json
{
  "bottlenecks": [
    {
      "id": "bn-001",
      "type": "column-bottleneck",
      "title": "Column bottleneck in In Progress",
      "severity": 75,
      "severityLabel": "high",
      "impact": {
        "storiesAffected": 3,
        "estimatedDelayDays": 5,
        "impactScore": 75
      },
      "trend": "worsening",
      "affectedProjects": ["my-project"],
      "affectedStories": ["story-1", "story-2", "story-3"],
      "contributingFactors": ["avg-dwell-48h"],
      "suggestedAction": "Review stories in In Progress for blockers"
    }
  ],
  "summary": {
    "stuckStories": 0,
    "wipViolations": 1,
    "agingStories": 2,
    "overloadedAgents": 1,
    "resourceConflicts": 0,
    "totalBottlenecks": 4
  },
  "lastUpdated": "2026-04-25T14:30:00.000Z"
}
```

In cross-project mode, bottlenecks from all projects are merged and sorted by `impact.impactScore` descending. The summary counts are aggregated across projects.

{: .note}
> Resource conflicts are detected once via `runConflictDetection()` and shared across all projects in the request, then filtered per-project by `competingProjects`.

### Errors

| Status | Condition |
|--------|-----------|
| `404` | `project` param provided but not found in config |
| `500` | Failed to load services or compute bottlenecks |

Source: `packages/web/src/app/api/risk/bottleneck/route.ts`

## Optimization

```
GET    /api/risk/optimization
PATCH  /api/risk/optimization
DELETE /api/risk/optimization
```

Generate optimization suggestions based on risk factors, bottlenecks, and utilization data. Supports five operating modes, accept/dismiss learning feedback, and before/after impact analysis.

### GET — List Suggestions

Returns optimization suggestions. Supports five operating modes controlled by query parameters:

| Mode | Parameters | Description |
|------|-----------|-------------|
| Default | (none or `category`) | Standard suggestions with learning weights |
| Objective | `objective=X` (optionally `category`) | Suggestions optimized for a single objective |
| Compare | `compare=true` | Side-by-side comparison of all four objectives |
| Impact (all) | `impact=true` | All suggestions augmented with before/after analysis |
| Impact (single) | `impact=true` + `suggestionId=X` | Single suggestion with impact analysis |

{: .warning}
> `compare` and `objective` are mutually exclusive — returns `400` if both are provided.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `project` | `string` | Filter to a single project |
| `category` | `string` | Filter by category (5 values, see below) |
| `objective` | `string` | Optimize for a single objective (4 values, see below) |
| `compare` | `string` | Set to `true` to compare all objectives |
| `impact` | `string` | Set to `true` to include impact analysis |
| `suggestionId` | `string` | Specific suggestion ID for single-impact mode |

#### Categories (5)

| Category | Description |
|----------|-------------|
| `agent-rebalancing` | Move agents between projects for better distribution |
| `wip-adjustment` | Adjust work-in-progress limits |
| `priority-reorder` | Reorder story priorities |
| `capacity-scaling` | Scale agent capacity up or down |
| `underutilized-detection` | Identify underutilized agents |

#### Objectives (4)

| Objective | Description |
|-----------|-------------|
| `minimize-time` | Minimize sprint completion time |
| `maximize-throughput` | Maximize story throughput |
| `balance-workload` | Balance workload across agents |
| `reduce-blocking` | Reduce blocking dependencies |

#### Response (default mode)

```json
{
  "suggestions": [
    {
      "id": "opt-001",
      "category": "agent-rebalancing",
      "title": "Move agent-3 from project-a to project-b",
      "description": "Agent utilization imbalance detected",
      "impact": {
        "daysSaved": 2,
        "riskReductionPercent": 15,
        "utilizationDeltaPercent": 12,
        "affectedAgents": ["agent-3"],
        "affectedProjects": ["project-a", "project-b"],
        "affectedStories": []
      },
      "confidence": 85,
      "priority": 78,
      "createdAt": 1714057800000,
      "data": {}
    }
  ],
  "analysisTimeMs": 45,
  "inputSummary": {
    "projectCount": 2,
    "agentCount": 8,
    "overutilizedCount": 1,
    "underutilizedCount": 2,
    "bottleneckCount": 3
  }
}
```

#### Response (compare mode)

```json
{
  "objectives": [
    {
      "objective": "minimize-time",
      "topSuggestions": [],
      "projectedImpact": {
        "daysSaved": 3,
        "riskReductionPercent": 20,
        "utilizationDeltaPercent": 15,
        "affectedAgents": [],
        "affectedProjects": [],
        "affectedStories": []
      }
    }
  ],
  "baselineTopSuggestions": [],
  "analysisTimeMs": 120
}
```

#### Response (impact mode, single)

```json
{
  "suggestion": { "id": "opt-001", "..." : "..." },
  "impactAnalysis": {
    "completionDateShift": 2,
    "velocityDelta": 0.5,
    "riskChange": { "before": 72, "after": 55, "delta": -17 },
    "beforeMetrics": {
      "utilizationPercent": 65,
      "velocity": 1.5,
      "riskScore": 72,
      "activeAgents": 8,
      "storiesAtRisk": 5
    },
    "afterMetrics": {
      "utilizationPercent": 78,
      "velocity": 2.0,
      "riskScore": 55,
      "activeAgents": 8,
      "storiesAtRisk": 2
    }
  }
}
```

#### Response (impact mode, all)

When `impact=true` without `suggestionId`, each suggestion is wrapped in a `SuggestionImpactDetail` object:

```json
{
  "suggestions": [
    {
      "suggestion": { "id": "opt-001", "..." : "..." },
      "impactAnalysis": { "completionDateShift": 2, "..." : "..." }
    }
  ],
  "analysisTimeMs": 60,
  "inputSummary": { "..." : "..." }
}
```

#### Errors

| Status | Condition |
|--------|-----------|
| `400` | Both `compare` and `objective` provided, or invalid `objective` value |
| `404` | `suggestionId` not found (impact mode only) |
| `500` | Failed to load services |

Source: `packages/web/src/app/api/risk/optimization/route.ts`

### PATCH — Accept or Dismiss Suggestion

Record learning feedback for a suggestion. The optimization engine adjusts future suggestion rankings based on accumulated accept/dismiss history.

#### Request Body

```json
{
  "suggestionId": "opt-001",
  "action": "accepted",
  "category": "agent-rebalancing",
  "reason": "Agreed with the rebalancing suggestion"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `suggestionId` | `string` | Yes | The suggestion ID |
| `action` | `string` | Yes | `"accepted"` or `"dismissed"` |
| `category` | `string` | Yes | One of the 5 `OptimizationCategory` values |
| `reason` | `string` | No | Optional reason |

{: .warning}
> **In-memory only:** Feedback is stored in memory (max 1000 entries). Cleared on server restart.

#### Learning Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `LEARNING_MIN_SAMPLES` | 3 | Minimum feedback entries per category before learning adjusts |
| `LEARNING_BOOST_MAX` | 1.5 | Maximum boost multiplier for high-acceptance categories |
| `LEARNING_PENALTY_MAX` | 0.5 | Maximum penalty multiplier for low-acceptance categories |

#### Response

```json
{ "success": true, "suggestionId": "opt-001", "action": "accepted" }
```

#### Errors

| Status | Condition |
|--------|-----------|
| `400` | Missing required fields, invalid `action`, or invalid `category` |

Source: `packages/web/src/app/api/risk/optimization/route.ts`

### DELETE — Clear Learning Feedback

Resets all accumulated optimization learning feedback. Future suggestions will use default weights until new feedback is recorded.

#### Response

```json
{ "success": true, "message": "Learning feedback cleared" }
```

Source: `packages/web/src/app/api/risk/optimization/route.ts`

## Utilization

```
GET /api/risk/utilization
```

Agent utilization metrics with time-series rolling averages. Operates in single-project or portfolio mode.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `project` | `string` | — | Project ID for single-project mode. Omit for portfolio. |
| `window` | `string` | `24h` | Time window: `1h`, `24h`, or `7d`. Invalid values silently default to `24h`. |

Window durations: `1h` = 3,600,000ms, `24h` = 86,400,000ms, `7d` = 604,800,000ms.

### Utilization Thresholds

| Threshold | Value | Meaning |
|-----------|-------|---------|
| Overutilized | > 90% | Agent has too many concurrent assignments |
| Underutilized | < 30% (active agents only) | Active agent with capacity for more work |

### Response (single project)

```json
{
  "projectSummary": {
    "projectId": "my-project",
    "avgUtilization": 65,
    "overutilizedCount": 1,
    "underutilizedCount": 2,
    "agentCount": 8,
    "agentSnapshots": [],
    "poolBreakdown": {
      "totalPoolAgents": 4,
      "activePoolAgents": 3,
      "reservedAgents": 1
    }
  },
  "timeSeries": [
    {
      "agentId": "agent-1",
      "rollingAvg1h": 75,
      "rollingAvg24h": 68,
      "rollingAvg7d": 62,
      "trend": "stable"
    }
  ],
  "timestamp": 1714057800000
}
```

### Response (portfolio)

```json
{
  "projectSummaries": [],
  "totalAgents": 12,
  "avgUtilization": 65,
  "overutilizedAgents": 2,
  "underutilizedAgents": 3,
  "timestamp": 1714057800000,
  "timeSeries": []
}
```

In portfolio mode, agent utilization is computed once across all projects, then `collectSnapshot` and `buildProjectSummary` are called per-project. Time series are built for all agents across the portfolio.

### Errors

| Status | Condition |
|--------|-----------|
| `500` | Failed to load services |

Source: `packages/web/src/app/api/risk/utilization/route.ts`

## Risk Dashboard

```
GET /api/risk/dashboard
```

Lightweight risk overview aggregating sprint health indicators, capacity, and agent utilization into risk factors. Lighter-weight than `/api/risk/score` — does not compute cycle time, throughput, team workload, or story aging.

{: .note}
> Unlike the score route, the dashboard passes `sprintHealthScore` directly to `aggregateRiskFactors()`, which generates a velocity-anomaly risk factor when sprint health is below 60. The score route handles sprint health separately in `calculateRiskScore()` to avoid double-counting.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `project` | `string` | Project ID for single-project mode. Omit for all projects. |

### Response

```json
{
  "riskFactors": [
    {
      "id": "rf-001",
      "type": "resource-bottleneck",
      "title": "Agent capacity critical: 3 agents at capacity",
      "severity": 80,
      "severityLabel": "critical",
      "trend": "worsening",
      "affectedProjects": ["my-project"],
      "contributingFactors": ["3-agents-at-capacity"],
      "affectedStories": [],
      "suggestedAction": "Consider adding agents or redistributing workload"
    }
  ],
  "summary": {
    "critical": 1,
    "high": 2,
    "medium": 3,
    "low": 1,
    "total": 7
  },
  "lastUpdated": "2026-04-25T14:30:00.000Z"
}
```

In multi-project mode, risk factors from all projects are merged and sorted by `severity` descending. The summary counts are aggregated across projects.

### Risk Factor Types (5)

| Type | Description |
|------|-------------|
| `high-risk-stories` | Stories flagged as high risk |
| `resource-bottleneck` | Capacity or agent bottleneck detected |
| `velocity-anomaly` | Sprint velocity deviation from norm |
| `blocking-pattern` | Recurring blocking dependencies |
| `scope-creep` | Scope expansion detected |

### Errors

| Status | Condition |
|--------|-----------|
| `404` | `project` param provided but not found in config |
| `500` | Failed to load services or aggregate factors |

Source: `packages/web/src/app/api/risk/dashboard/route.ts`

## Common Patterns

### `force-dynamic` on All Routes

All 7 risk route files export `dynamic = "force-dynamic"`, disabling Next.js response caching. Every request executes server-side.

### In-Memory State

Three components use in-memory-only state, lost on server restart:
- **Alert state** — active and acknowledged alerts stored in singleton broadcaster
- **Alert configuration** — threshold changes not persisted to YAML
- **Optimization learning feedback** — accept/dismiss history (max 1000 entries)

### Sprint Health Heuristic

Sprint health score: `100 - 15*critical_indicators - 5*warning_indicators - 10*blocked_stories`, clamped 0-100. Only computed for projects using the `bmad` tracker plugin.

### Risk Score Normalization

Composite score is a weighted sum normalized by 150. Severity weights: critical 1.5, high 1.0, medium 0.6, low 0.3. Sprint health contributes only when below 60 (inverted as health risk).

### Emerging Risk Detection

5 pattern detectors run against throughput data, sprint health, and agent utilization:
- `velocity-drop` — throughput declining over rolling window
- `throughput-decline` — sustained daily throughput decrease
- `capacity-trend` — agent utilization trending toward overload
- `blocker-accumulation` — increasing stuck stories
- `aging-acceleration` — stories aging faster than baseline

### Learning Feedback Loop

The optimization engine records accept/dismiss feedback per category. After 3+ samples per category, `computeLearningWeights()` adjusts suggestion rankings using a linear scale: `multiplier = acceptanceRate * 1.5`, clamped to [0.5, 1.5]. Categories with fewer than 3 samples retain neutral 1.0x. This means 50% acceptance yields 0.75x (penalty), and only 100% acceptance yields the full 1.5x boost.

### Cross-Project Merging

Both bottleneck and dashboard endpoints support multi-project aggregation. Results are merged with per-project factors, then sorted by severity or impact score.

## Status Codes

| Status | Meaning | When |
|--------|---------|------|
| `200` | Success | All successful responses |
| `400` | Bad Request | Invalid parameters, validation failure |
| `404` | Not Found | Project or resource not found |
| `500` | Internal Server Error | Failed to load services or compute results |

## Key Types

### RiskFactor (10 fields)

| Field | Type |
|-------|------|
| `id` | `string` |
| `type` | `RiskFactorType` |
| `title` | `string` |
| `severity` | `number` (0-100) |
| `severityLabel` | `RiskSeverityLabel` |
| `trend` | `RiskTrend` |
| `affectedProjects` | `string[]` |
| `contributingFactors` | `string[]` |
| `affectedStories` | `string[]` |
| `suggestedAction` | `string` |

### RiskFactorType

`"high-risk-stories" | "resource-bottleneck" | "velocity-anomaly" | "blocking-pattern" | "scope-creep"`

### RiskSeverityLabel

`"critical" | "high" | "medium" | "low"`

### RiskTrend

`"improving" | "stable" | "worsening"`

### RiskScoreResult (7 fields)

| Field | Type |
|-------|------|
| `projectId` | `string` |
| `score` | `number` (0-100) |
| `severityLabel` | `RiskSeverityLabel` |
| `contributors` | `RiskScoreContributor[]` |
| `factorCount` | `number` |
| `bottleneckCount` | `number` |
| `lastUpdated` | `string` (ISO 8601) |

### RiskScoreContributor (6 fields)

| Field | Type |
|-------|------|
| `id` | `string` |
| `title` | `string` |
| `type` | `"risk-factor" \| "bottleneck" \| "sprint-health"` |
| `score` | `number` |
| `weight` | `number` |
| `contributionPercent` | `number` |

### PortfolioRiskResult (4 fields)

| Field | Type |
|-------|------|
| `scores` | `Array<{ projectId, score, severityLabel, factorCount, bottleneckCount }>` |
| `portfolioScore` | `number` (0-100) |
| `portfolioSeverityLabel` | `RiskSeverityLabel` |
| `lastUpdated` | `string` (ISO 8601) |

### EmergingRisk (12 fields)

| Field | Type |
|-------|------|
| `id` | `string` |
| `type` | `EmergingRiskPattern` |
| `title` | `string` |
| `status` | `"emerging"` |
| `severity` | `number` |
| `trajectory` | `RiskTrend` |
| `pattern` | `string` |
| `detectedAt` | `string` (ISO 8601) |
| `cause` | `string` |
| `suggestedAction` | `string` |
| `projectId` | `string` |
| `contributingFactors` | `string[]` |

### EmergingRiskPattern

`"velocity-drop" | "throughput-decline" | "capacity-trend" | "blocker-accumulation" | "aging-acceleration"`

### RiskAlert (9 fields)

| Field | Type |
|-------|------|
| `id` | `string` |
| `projectId` | `string` |
| `triggeredAt` | `string` (ISO 8601) |
| `alertType` | `"score-threshold" \| "emerging-risk"` |
| `severity` | `number` |
| `severityLabel` | `RiskSeverityLabel` |
| `title` | `string` |
| `details` | `string` |
| `acknowledged` | `boolean` |

### RiskAlertConfig (3 fields)

| Field | Type |
|-------|------|
| `enabled` | `boolean` |
| `defaultThresholds` | `RiskAlertThreshold[]` |
| `projectOverrides` | `Record<string, RiskAlertThreshold[]>` |

### RiskAlertThreshold (4 fields)

| Field | Type |
|-------|------|
| `riskType` | `"score" \| "emerging-risk" \| RiskFactorType` |
| `minScore` | `number` (0-100) |
| `severityLabel` | `RiskSeverityLabel` (optional) |
| `enabled` | `boolean` |

### BottleneckItem (11 fields)

| Field | Type |
|-------|------|
| `id` | `string` |
| `type` | `BottleneckType` |
| `title` | `string` |
| `severity` | `number` |
| `severityLabel` | `BottleneckSeverityLabel` |
| `impact` | `BottleneckImpact` |
| `trend` | `BottleneckTrend` |
| `affectedProjects` | `string[]` |
| `affectedStories` | `string[]` |
| `contributingFactors` | `string[]` |
| `suggestedAction` | `string` |

### BottleneckType (10 values)

`"column-bottleneck" | "stuck-stories" | "wip-violation" | "throughput-drop" | "agent-overload" | "capacity-bottleneck" | "resource-conflict" | "unassigned-stories" | "aging-stories" | "bottleneck-trend"`

### BottleneckImpact (3 fields)

| Field | Type |
|-------|------|
| `storiesAffected` | `number` |
| `estimatedDelayDays` | `number` |
| `impactScore` | `number` |

### BottleneckSummary (6 fields)

| Field | Type |
|-------|------|
| `stuckStories` | `number` |
| `wipViolations` | `number` |
| `agingStories` | `number` |
| `overloadedAgents` | `number` |
| `resourceConflicts` | `number` |
| `totalBottlenecks` | `number` |

### OptimizationSuggestion (9 fields)

| Field | Type |
|-------|------|
| `id` | `string` |
| `category` | `OptimizationCategory` |
| `title` | `string` |
| `description` | `string` |
| `impact` | `EstimatedImpact` |
| `confidence` | `number` (0-100) |
| `priority` | `number` |
| `createdAt` | `number` (epoch ms) |
| `data` | `Record<string, unknown>` |

### EstimatedImpact (6 fields)

| Field | Type |
|-------|------|
| `daysSaved` | `number` |
| `riskReductionPercent` | `number` |
| `utilizationDeltaPercent` | `number` |
| `affectedAgents` | `string[]` |
| `affectedProjects` | `string[]` |
| `affectedStories` | `string[]` |

### OptimizationCategory (5 values)

`"agent-rebalancing" | "wip-adjustment" | "priority-reorder" | "capacity-scaling" | "underutilized-detection"`

### OptimizationObjective (4 values)

`"minimize-time" | "maximize-throughput" | "balance-workload" | "reduce-blocking"`

### UtilizationSnapshot (9 fields)

| Field | Type |
|-------|------|
| `agentId` | `string` |
| `projectId` | `string` |
| `timestamp` | `number` (epoch ms) |
| `utilizationPercent` | `number` (0-100) |
| `isActive` | `boolean` |
| `storiesWorked` | `number` |
| `isPoolAgent` | `boolean` |
| `isAtCapacity` | `boolean` |
| `isNearCapacity` | `boolean` |

### UtilizationTimeSeries (5 fields)

| Field | Type |
|-------|------|
| `agentId` | `string` |
| `rollingAvg1h` | `number` |
| `rollingAvg24h` | `number` |
| `rollingAvg7d` | `number` |
| `trend` | `"improving" \| "stable" \| "declining"` |

### ProjectUtilizationSummary (7 fields)

| Field | Type |
|-------|------|
| `projectId` | `string` |
| `avgUtilization` | `number` |
| `overutilizedCount` | `number` |
| `underutilizedCount` | `number` |
| `agentCount` | `number` |
| `agentSnapshots` | `UtilizationSnapshot[]` |
| `poolBreakdown` | `object` (optional) |

`poolBreakdown` when present: `{ totalPoolAgents: number, activePoolAgents: number, reservedAgents: number }`.

---

- **Parent** — [REST API](./)
- **Siblings** — [Sessions](sessions/), [Sprints](sprints/), [Agents](agents/), [Events](events/), [Portfolio](portfolio/), [Dependencies](dependencies/), [Scenarios](scenarios/), [Conflicts](conflicts/)
- **Getting Started** — [Installation](../getting-started/installation/), [Quick Start](../getting-started/quick-start/)
- **Configuration** — [Configuration Reference](../getting-started/configuration/)
