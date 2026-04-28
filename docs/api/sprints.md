---
title: Sprints API
nav_order: 2
parent: REST API
description: Sprint and story management — CRUD, metrics, velocity, CFD, Monte Carlo simulation, ceremonies, workload, WIP, and cross-project aggregation across 48 route files with 54 endpoints.
---

# Sprints API

Manage sprint boards, stories, epics, and analytics across projects.
48 route files cover board CRUD, story lifecycle, metrics, forecasting, ceremonies, and global aggregation.

| Category | Prefix | Routes | Endpoints | Description |
|----------|--------|--------|-----------|-------------|
| Project-Scoped | `/api/sprint/{project}` | 36 | 42 | Board, stories, epics, config, ceremonies, metrics |
| Global Sprint | `/api/sprint` | 11 | 11 | Cross-project aggregation, cost, simulation |
| Unified | `/api/sprints` | 1 | 1 | Unified sprint across all projects |

Source: `packages/web/src/app/api/sprint/`, `packages/web/src/app/api/sprints/`

## Sprint Board

```
GET /api/sprint/{project}
```

Returns the full sprint board with columns, stories, epic summaries, stats, and session cross-reference.

### Response

```json
{
  "projectId": "my-project",
  "projectName": "My Project",
  "columns": {
    "backlog": [{ "id": "1-2-auth", "title": "Add auth", "url": "...", "bmadStatus": "backlog", "epic": "epic-1", "session": null }],
    "in-progress": [...],
    "done": [...]
  },
  "columnOrder": ["backlog", "in-progress", "review", "done"],
  "columnMeta": [{ "id": "backlog", "label": "Backlog", "category": "open", "color": "#gray" }],
  "epics": [{ "epicId": "epic-1", "title": "Authentication", "total": 5, "done": 2, "inProgress": 1, "open": 2, "percent": 40 }],
  "hasPoints": true,
  "stats": { "total": 20, "done": 8, "inProgress": 3, "open": 9 }
}
```

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `404` | Project not found, no tracker configured, or tracker doesn't support listing |
| `500` | Internal error |
| `503` | Missing credentials (env vars / API key) |

Fetches up to 200 issues from the tracker. Cross-references active sessions (non-fatal on failure). Story points are only populated when the tracker plugin is `"bmad"`.

Source: `packages/web/src/app/api/sprint/[project]/route.ts`

## Story Management

### Story Detail

```
GET /api/sprint/{project}/story/{id}
```

Returns story detail with status, transitions, cycle time, and cross-project dependencies.

**Response:**

```json
{
  "storyId": "1-2-auth",
  "currentStatus": "in-progress",
  "epic": "epic-1",
  "transitions": [...],
  "columnDwells": [...],
  "totalCycleTimeMs": 3600000,
  "startedAt": "2026-04-20T10:00:00Z",
  "completedAt": null,
  "isCompleted": false,
  "crossProjectDeps": [...]
}
```

### Move Story

```
PATCH /api/sprint/{project}/story/{id}
```

Moves a story to a new column with WIP limit enforcement.

**Request Body:**

```json
{ "status": "in-progress", "force": false }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | Must be a valid `BMAD_COLUMNS` value |
| `force` | boolean | No | Bypass WIP limit check (default `false`) |

**Response:**

```json
{
  "storyId": "1-2-auth",
  "status": "in-progress",
  "changed": true,
  "warnings": [],
  "unblockedStories": []
}
```

When moving to the same status (no-op), returns `{ "storyId": "...", "status": "...", "changed": false }` without `warnings` or `unblockedStories`.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success (`changed: false` if same status) |
| `400` | Invalid body, not bmad tracker, or invalid status value |
| `404` | Project or story not found |
| `409` | WIP limit exceeded (includes `wipExceeded`, `current`, `limit` fields) |
| `500` | Internal error |

Appends transition to history log. When status is set to `"done"`, auto-unblocks cross-project dependents (best-effort, non-blocking). Returns dependency warnings (informational, non-blocking).

Source: `packages/web/src/app/api/sprint/[project]/story/[id]/route.ts`

### Create Story

```
POST /api/sprint/{project}/story/create
```

Creates a new story via the tracker.

**Request Body:**

```json
{ "title": "Add user authentication", "description": "Implement login flow", "epic": "epic-1", "points": 3 }
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Non-empty after trim |
| `description` | string | No | Defaults to `""` |
| `epic` | string | No | Added as label if non-empty after trim |
| `points` | integer | No | Must be integer >= 0 (non-integer values silently ignored) |

**Response:** The created issue object from the tracker (shape depends on tracker). Status `201`.

Source: `packages/web/src/app/api/sprint/[project]/story/create/route.ts`

### Verification Result

```
GET /api/sprint/{project}/story/{id}/verification
```

Returns the latest verification result for a story. Uses `Cache-Control: no-cache, no-store, must-revalidate` and `force-dynamic` rendering.

### Verification Retry History

```
GET /api/sprint/{project}/story/{id}/verification/retries
```

Returns retry history and persistent re-queue state.

**Response:**

```json
{
  "retries": [...],
  "retryCount": 2,
  "maxAttempts": 5,
  "persistentRequeueCount": 1,
  "persistentMaxRetries": 3
}
```

`persistentRequeueCount` and `persistentMaxRetries` are only present when the execution mode is `"persistent"`. Omitted otherwise.

Source: `packages/web/src/app/api/sprint/[project]/story/[id]/verification/route.ts`, `retries/route.ts`

## Epic CRUD

```
GET    /api/sprint/{project}/epics
POST   /api/sprint/{project}/epics
PATCH  /api/sprint/{project}/epics
DELETE /api/sprint/{project}/epics
```

### List Epics

**GET** — Returns array of epic objects. Returns `[]` for non-bmad trackers.

### Create Epic

**POST** — Body: `{ "title": "string", "description?": "string" }`. Returns `201`.

### Rename Epic

**PATCH** — Body: `{ "epicId": "string", "title": "string" }`. Returns `{ "epicId": "...", "title": "..." }`.

### Delete Epic

**DELETE** — Body: `{ "epicId": "string", "clearStories?": false }`. Spreads the `deleteEpic()` result.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success (GET/PATCH/DELETE) |
| `201` | Epic created (POST) |
| `400` | Not bmad tracker, invalid body, or missing required fields |
| `404` | Project not found |
| `500` | Internal error |

All mutation methods (POST/PATCH/DELETE) require `project.tracker.plugin === "bmad"`. GET returns an empty array for non-bmad trackers.

Source: `packages/web/src/app/api/sprint/[project]/epics/route.ts`

## Sprint Configuration

```
GET    /api/sprint/{project}/config
PATCH  /api/sprint/{project}/config
```

### Read Config

**GET** — Returns `{ "projectId": "...", "sprintEndDate": "2026-05-01" | null, "wipLimits": {...} | null }`.

### Update Config

**PATCH** — Body: `{ "sprintEndDate": "2026-05-15" }`. Pass `null` to clear the end date. Date string must match `YYYY-MM-DD`, be a real calendar date, and be in the future.

| Validation | Rule |
|-----------|------|
| Date format | Must match `YYYY-MM-DD` |
| Valid date | Must be a real calendar date |
| Future date | Must be after today |

Directly reads and writes the `agent-orchestrator.yaml` config file on disk.

Source: `packages/web/src/app/api/sprint/[project]/config/route.ts`

## Ceremonies

### Start Sprint

```
POST /api/sprint/{project}/ceremony/start
```

Starts a sprint ceremony, updating YAML config with sprint parameters.

**Request Body:**

```json
{ "goal": "Ship auth feature", "startDate": "2026-04-25", "endDate": "2026-05-09", "targetVelocity": 10 }
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `goal` | string | No | Sprint goal text |
| `startDate` | string | No | `YYYY-MM-DD`, defaults to today |
| `endDate` | string | No | `YYYY-MM-DD` or `null` |
| `targetVelocity` | number | No | Must be positive if provided |

### End Sprint

```
POST /api/sprint/{project}/ceremony/end
```

Ends a sprint ceremony with computed retrospective, forecast, and health metrics.

**Request Body:** `{ "clear?": false }` — optionally clears sprint config from YAML.

**Response:**

```json
{
  "projectId": "my-project",
  "retrospective": {...},
  "forecast": {...},
  "health": { "overall": "ok", "indicatorCount": 0 },
  "cleared": true
}
```

Requires `project.tracker.plugin === "bmad"` (returns `400` otherwise). The `cleared` field is only present when `clear: true` was sent in the request body.

Source: `packages/web/src/app/api/sprint/[project]/ceremony/start/route.ts`, `end/route.ts`

## Metrics & Analytics

All project-scoped metrics endpoints accept an optional `?epic=label` query parameter for filtering.

### Velocity

```
GET /api/sprint/{project}/velocity
GET /api/sprint/{project}/velocity-comparison
```

**Velocity History** — Returns last 100 history entries with daily completions and points data.

**Velocity Comparison** — Week-over-week comparison with standard deviation, trend slope, confidence, and next-week estimate. Accepts `?epic=`.

```json
{
  "weeks": [...],
  "averageVelocity": 5.2,
  "stdDeviation": 1.3,
  "trend": "improving",
  "trendSlope": 0.4,
  "trendConfidence": 0.72,
  "nextWeekEstimate": 6,
  "completionWeeks": 3.1,
  "currentWeekSoFar": 2,
  "remainingStories": 8
}
```

Source: `packages/web/src/app/api/sprint/[project]/velocity/route.ts`, `velocity-comparison/route.ts`

### Cycle Time

```
GET /api/sprint/{project}/metrics
```

Returns cycle time statistics: average, median, bottleneck column, and throughput.

```json
{
  "averageCycleTimeMs": 86400000,
  "medianCycleTimeMs": 72000000,
  "bottleneckColumn": "review",
  "throughputPerDay": 1.5,
  "throughputPerWeek": 7.5,
  "completedCount": 15
}
```

Source: `packages/web/src/app/api/sprint/[project]/metrics/route.ts`

### Cumulative Flow Diagram

```
GET /api/sprint/{project}/cfd
```

**Query Parameters:** `?epic=label&days=30` (lookback window, default 30).

```json
{
  "dataPoints": [...],
  "columns": ["backlog", "in-progress", "done"],
  "dateRange": { "from": "2026-03-25", "to": "2026-04-25" }
}
```

Source: `packages/web/src/app/api/sprint/[project]/cfd/route.ts`

### Throughput

```
GET /api/sprint/{project}/throughput
```

Daily/weekly throughput, lead times, cycle times, flow efficiency, and bottleneck trends.

```json
{
  "dailyThroughput": [...],
  "weeklyThroughput": [...],
  "averageLeadTimeMs": 172800000,
  "flowEfficiency": 0.35,
  "bottleneckTrend": { "column": "review", "trend": "worsening" }
}
```

Source: `packages/web/src/app/api/sprint/[project]/throughput/route.ts`

### Sprint Forecast

```
GET /api/sprint/{project}/forecast
GET /api/sprint/{project}/forecast-accuracy
```

**Forecast** — Projected completion date, pace, confidence, velocity vs required velocity.

**Forecast Accuracy** — Calibration data with p50/p80/p95 accuracy, bias, and accuracy trend (`"improving"`, `"stable"`, `"degrading"`). Computed by comparing last 3 vs previous 3 completed forecasts with a +/-10% threshold.

Source: `packages/web/src/app/api/sprint/[project]/forecast/route.ts`, `forecast-accuracy/route.ts`

### Monte Carlo Simulation

```
GET /api/sprint/{project}/monte-carlo
```

**Query Parameters:**

| Parameter | Type | Default | Validation |
|-----------|------|---------|------------|
| `simulations` | integer | — | Clamped to 1,000–100,000 |
| `throughputWindowDays` | integer | — | Clamped to 0–365; 0 treated as undefined |
| `excludeWeekends` | string | `"true"` | Only `"false"` disables |
| `confidenceLevels` | string | `"p50,p80,p95"` | Comma-separated, lowercased, trimmed |
| `epic` | string | — | Filter by epic label |

**Response:**

```json
{
  "percentiles": { "p50": "2026-05-01", "p80": "2026-05-08", "p95": "2026-05-15" },
  "histogram": [...],
  "remainingStories": 12,
  "simulationCount": 10000,
  "sampleSize": 30,
  "averageDailyRate": 1.5,
  "linearCompletionDate": "2026-05-03",
  "linearConfidence": 0.68,
  "insufficientData": false,
  "calibration": {...},
  "effectiveConfig": {
    "simulations": 10000,
    "throughputWindowDays": 30,
    "excludeWeekends": true,
    "dataPointsUsed": 25
  }
}
```

**Unique behaviors:**
- Appends forecast snapshot to JSONL log (intended non-fatal, but currently unguarded — a write failure returns 500)
- In-memory LRU cache (200 entries) for diff detection against previous forecasts
- Broadcasts significant forecast changes via `broadcastForecastChange()` (SSE)
- Computes calibration score from historical forecast log

Source: `packages/web/src/app/api/sprint/[project]/monte-carlo/route.ts`

### Sprint Health

```
GET /api/sprint/{project}/health
```

Returns health indicators, stuck stories, and WIP column status. Overall status: `"ok"` or other.

Source: `packages/web/src/app/api/sprint/[project]/health/route.ts`

### WIP Dashboard

```
GET /api/sprint/{project}/wip
```

Returns WIP limits status per column.

Source: `packages/web/src/app/api/sprint/[project]/wip/route.ts`

### Sprint Notifications

```
GET /api/sprint/{project}/notifications
```

Checks for sprint notifications: stuck stories, WIP exceeded alerts, etc.

Source: `packages/web/src/app/api/sprint/[project]/notifications/route.ts`

### Sprint History

```
GET /api/sprint/{project}/history
```

Transition history log with filters.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `story` | string | — | Story ID filter |
| `epic` | string | — | Epic filter |
| `from` | string | — | Date filter (from) |
| `to` | string | — | Date filter (to) |
| `status` | string | — | Target status filter |
| `search` | string | — | Text search |
| `limit` | integer | `100` | Min 1 |

Returns `{ "entries": [...], "total": 42 }`. Returns `{ "entries": [], "total": 0 }` for non-bmad trackers.

Source: `packages/web/src/app/api/sprint/[project]/history/route.ts`

### Retrospective

```
GET /api/sprint/{project}/retro
```

Retrospective data: periods, velocity trend, and cycle time. Accepts `?epic=` filter.

Source: `packages/web/src/app/api/sprint/[project]/retro/route.ts`

### Rework Analysis

```
GET /api/sprint/{project}/rework
```

Rework rate, rework events, transition stats, and worst offenders. Accepts `?epic=` filter.

Source: `packages/web/src/app/api/sprint/[project]/rework/route.ts`

### Sprint Comparison

```
GET /api/sprint/{project}/comparison
```

Period-over-period sprint comparison with trends. Accepts `?epic=&weeks=4` (lookback, default 4).

Source: `packages/web/src/app/api/sprint/[project]/comparison/route.ts`

### Sprint Summary

```
GET /api/sprint/{project}/summary
```

Aggregated sprint summary combining column counts, stats, points, health, velocity, forecast, notifications, and days remaining.

```json
{
  "projectId": "my-project",
  "columns": { "backlog": 5, "in-progress": 3, "done": 8 },
  "stats": { "total": 16, "done": 8, "inProgress": 3, "open": 5 },
  "progress": 50,
  "healthOverall": "ok",
  "velocity": 5,
  "velocityTrend": "improving",
  "forecastDaysRemaining": 14,
  "stuckStories": [],
  "wipAlerts": [],
  "daysRemaining": 14
}
```

`pointsStats` is only included when points data is available. Health, velocity, and forecast are computed non-fatally (failures silently use defaults).

Source: `packages/web/src/app/api/sprint/[project]/summary/route.ts`

### Additional Project-Scoped Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sprint/{project}/aging` | GET | Stories aging in columns, grouped by status. Accepts `?epic=`. |
| `/api/sprint/{project}/assignable-agents` | GET | Agent assignment pool (local + shared) with capacity info |
| `/api/sprint/{project}/conflicts` | GET | Agent assignment conflicts with severity breakdown. Accepts `?sort=recency\|frequency&export=csv\|json`. |
| `/api/sprint/{project}/dependencies` | GET | Story dependency graph with circular/missing warnings |
| `/api/sprint/{project}/dependency-cycles` | GET | Detect dependency cycles in story graph |
| `/api/sprint/{project}/goals` | GET | Sprint goal computation. Accepts `?epic=`. |
| `/api/sprint/{project}/issues` | GET | Raw issue list from tracker (all states, limit 200) |
| `/api/sprint/{project}/plan` | GET | Sprint plan with backlog, recommendations, and capacity. Accepts `?epic=`. |
| `/api/sprint/{project}/standup` | GET | Project-scoped standup report. Accepts `?epic=`. |
| `/api/sprint/{project}/utilization` | GET | Agent utilization for the project |
| `/api/sprint/{project}/workload` | GET | Team workload distribution. Accepts `?epic=`. |

Source: `packages/web/src/app/api/sprint/[project]/`

## Global Sprint Routes

11 cross-project endpoints under `/api/sprint/` (no `{project}` segment).

### Sprint Digest

```
GET /api/sprint/digest
```

On-demand digest: completed stories, active agents, and blockers across all projects. Accepts `?since=` (ISO 8601, for display only).

### Daily Standup

```
GET /api/sprint/standup
```

Daily standup summary across all projects. Accepts `?hours=24` (clamped to min 1).

### Sprint Health

```
GET /api/sprint/health
```

Global health score computed from session states (done/total/blocked/failure rate). Uses `force-dynamic` and `Cache-Control: no-cache, no-store, must-revalidate`.

### Sprint Forecast

```
GET /api/sprint/forecast
```

Global P50/P80/P95 completion estimates from learning store data. Uses `force-dynamic` and `Cache-Control: no-cache, no-store, must-revalidate`.

### Sprint Simulation

```
GET /api/sprint/simulate
```

Monte Carlo sprint simulation across all projects. Accepts `?iterations=1000` (1–10,000). Infers domain tags from historical learnings.

### ROI Calculation

```
GET /api/sprint/roi
```

Agent value/ROI from completed sessions. Accepts `?hoursPerStory=&hourlyRate=&pricePerMillionTokens=` (all optional, must be positive).

### Spawn Queue

```
GET /api/sprint/queue
```

WIP limit, running count, and queued items from the spawn queue.

### Sprint Cost

```
GET /api/sprint/cost
```

Token cost summary and sprint clock (time remaining vs. stories done).

### Sprint Diff

```
GET /api/sprint/diff
```

Compare two sprint periods. **Required query parameters:** `?a=<ISO timestamp>&b=<ISO timestamp>` (`b` must be after `a`).

| Code | Condition |
|------|-----------|
| `200` | Success |
| `400` | Missing `a` or `b`, invalid timestamp, or `a` not before `b` |

### File Conflict Detection

```
GET /api/sprint/conflicts
```

Detects file conflicts across active sessions using the learning store. Uses `force-dynamic` and `Cache-Control: no-cache, no-store, must-revalidate`.

### Post-Mortem Report

```
GET /api/sprint/postmortem
```

Auto-generated failure analysis from failed/blocked/abandoned sessions.

Source: `packages/web/src/app/api/sprint/`

## Unified Sprint

```
GET /api/sprints/unified
```

Aggregates sprint data across all configured projects into a single view.

```json
{
  "sprints": [UnifiedSprintEntry, ...],
  "summary": UnifiedSprintSummary
}
```

Graceful degradation: skips projects where the tracker read fails (logs warning, continues). Returns an empty array when no projects are configured.

Source: `packages/web/src/app/api/sprints/unified/route.ts`

## Common Patterns

### Project Validation

All `/api/sprint/{project}/` routes validate that the project exists in `agent-orchestrator.yaml`. Returns `404` if not found.

### Epic Filtering

16 project-scoped endpoints accept `?epic=label` for filtering results to a specific epic.

### Non-BMAD Tracker Fallback

Analytics endpoints (velocity, metrics, CFD, throughput, forecast, health, etc.) return zeroed/empty default shapes rather than errors when the tracker is not `"bmad"`. Mutation endpoints (story create, story move, epic CRUD, ceremonies) return `400` for non-bmad trackers.

### WIP Limit Enforcement

Story move (`PATCH`) checks WIP limits unless `force: true` is passed. Returns `409` with `wipExceeded`, `current`, and `limit` fields when exceeded.

### Data Freshness

Several routes use `force-dynamic` rendering and `Cache-Control: no-cache, no-store, must-revalidate` headers:
- Verification result and retries
- File conflict detection
- Sprint cost
- Global forecast and health

### Non-Fatal Failures

Session lookups, sprint status reads, points data, learning store queries, and cross-project dependency lookups are all non-fatal — failures are caught and silently skipped with default/empty values.

### YAML Config Mutations

Ceremony start, ceremony end, and config PATCH routes directly read, modify, and write the `agent-orchestrator.yaml` file on disk.

## Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success (default) |
| `201` | Resource created (story, epic) |
| `400` | Validation failure, not bmad tracker, invalid request |
| `404` | Project or resource not found |
| `409` | WIP limit exceeded |
| `500` | Internal error |
| `503` | Missing credentials (env vars / API key) |

---

- **Parent** — [REST API](./)
- **Getting Started** — [Installation](../getting-started/installation/) and [Quick Start](../getting-started/quick-start/)
- **Configuration** — [Configuration Reference](../getting-started/configuration/)
- **Related** — [Sessions API](sessions/), [Agents API](agents/), [Events API](events/)
