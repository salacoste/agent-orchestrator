---
title: Scenarios API
nav_order: 7
parent: REST API
description: What-if scenario management — CRUD operations, Monte Carlo simulation, side-by-side comparison, production apply, lifecycle state machine.
---

# Scenarios API

Create, configure, simulate, compare, and apply what-if scenarios for sprint planning.

5 route files under `/api/scenarios/`. 8 endpoints total: 3 GET, 3 POST, 1 PATCH, 1 DELETE. All routes export `force-dynamic`.

| Group | Prefix | Routes | Methods | Description |
|-------|--------|--------|---------|-------------|
| Scenario CRUD | `/api/scenarios` | 2 | GET, POST | List, create |
| Scenario by ID | `/api/scenarios/{id}` | 3 | GET, PATCH, DELETE | Get, update parameters, delete |
| Simulation | `/api/scenarios/{id}/simulate` | 1 | POST | Run Monte Carlo simulation |
| Comparison | `/api/scenarios/compare` | 1 | GET | Side-by-side comparison (2-4 scenarios) |
| Apply | `/api/scenarios/{id}/apply` | 1 | POST | Apply simulated scenario to production |

Source: `packages/web/src/app/api/scenarios/`

## Scenario Lifecycle

Scenarios follow a strict 3-state lifecycle:

```
POST /api/scenarios → draft
PATCH /api/scenarios/{id} → draft (parameters only)
POST /api/scenarios/{id}/simulate → simulated
POST /api/scenarios/{id}/apply → applied
DELETE /api/scenarios/{id} → (removed at any status)
```

| Status | Description | Allowed Operations |
|--------|-------------|-------------------|
| `draft` | Newly created, parameters can be edited | GET, PATCH, DELETE, simulate |
| `simulated` | Monte Carlo simulation complete, result available | GET, DELETE, apply |
| `applied` | Applied to production | GET, DELETE |

Status guards return `409` when the wrong state is encountered:

- PATCH returns `409` if status is not `draft`
- Simulate returns `409` if status is not `draft`
- Apply returns `409` if status is not `simulated`

## List Scenarios

```
GET /api/scenarios
```

Returns all stored scenarios sorted by last-modified time (`updatedAt ?? createdAt`) descending, newest first.

No query parameters or request body.

### Response

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Add 2 agents to Sprint",
    "createdAt": "2026-04-25T10:00:00.000Z",
    "updatedAt": "2026-04-25T11:30:00.000Z",
    "projectIds": ["project-a"],
    "stories": [
      {
        "id": "54-1-scenario-creation-interface",
        "projectId": "project-a",
        "status": "in-progress",
        "domainTags": ["ui", "scenarios"]
      }
    ],
    "status": "simulated",
    "parameters": {
      "agentCount": 4,
      "capacityLimit": 3,
      "storyPriorities": [
        { "storyId": "54-1-scenario-creation-interface", "originalPriority": "medium", "newPriority": "high" }
      ]
    },
    "result": {
      "p50Days": 5,
      "p80Days": 8,
      "p95Days": 12,
      "onTimeProbability": 0.72,
      "confidence": 0.85,
      "iterationsRun": 1000
    }
  }
]
```

Returns an empty array `[]` when no scenarios exist.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `500` | Failed to list scenarios |

Source: `packages/web/src/app/api/scenarios/route.ts`

## Create Scenario

```
POST /api/scenarios
```

Creates a new scenario with a snapshot of current story state for the selected projects.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Scenario name (non-empty after trim) |
| `projectIds` | string[] | Yes | Projects to include (at least one) |

### Validation Pipeline

1. `name` must be a string, non-empty after trim — returns `400`
2. `projectIds` must be a non-empty array — returns `400`
3. All `projectIds` must exist in `config.projects` — returns `400` with unknown IDs listed

### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Add 2 agents to Sprint",
  "createdAt": "2026-04-25T10:00:00.000Z",
  "projectIds": ["project-a"],
  "stories": [
    {
      "id": "54-1-scenario-creation-interface",
      "projectId": "project-a",
      "status": "in-progress",
      "domainTags": ["ui", "scenarios"]
    }
  ],
  "status": "draft"
}
```

Scenario IDs are generated via `crypto.randomUUID()`. The `stories` array captures a snapshot of current story state at creation time via `captureScenarioSnapshot()`. The `parameters` and `result` fields are absent until configured and simulated respectively.

**Side effects:** Reads sprint status from tracker plugin for each project via dynamic import of `@composio/ao-plugin-tracker-bmad`. Individual project read failures are non-fatal — projects whose sprint status cannot be read are included with empty data.

### Status Codes

| Code | Condition |
|------|-----------|
| `201` | Created |
| `400` | Missing/empty name, empty projectIds, or unknown project IDs |
| `500` | Failed to create scenario |

Source: `packages/web/src/app/api/scenarios/route.ts`

## Get Scenario

```
GET /api/scenarios/{id}
```

Returns a single scenario by ID.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Scenario UUID |

### Response

Returns the full `WhatIfScenario` object (see [Key Types](#key-types)).

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Found |
| `404` | Scenario not found |
| `500` | Internal error |

Source: `packages/web/src/app/api/scenarios/[id]/route.ts`

## Update Parameters

```
PATCH /api/scenarios/{id}
```

Updates scenario parameters. Only allowed when scenario status is `draft`.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Scenario UUID |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parameters` | ScenarioParameters | Yes | Simulation parameters |

See [ScenarioParameters](#key-types) for field details.

### Validation (via `validateParameters()`)

| Rule | Constraint |
|------|-----------|
| `agentCount` | Integer, 1-50 |
| `capacityLimit` | Integer, 1-20 |
| `storyPriorities[].storyId` | No duplicates, must exist in scenario's stories |
| `storyPriorities[].newPriority` | One of `high`, `medium`, `low` |
| `storyPriorities[].originalPriority` | One of `high`, `medium`, `low` |

Returns `400` with joined error messages when validation fails.

### Response

Returns the updated `WhatIfScenario` with `updatedAt` timestamp.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Updated |
| `400` | Missing parameters or validation failure |
| `404` | Scenario not found |
| `409` | Cannot modify parameters of a scenario that has been simulated or applied |
| `500` | Internal error |

Source: `packages/web/src/app/api/scenarios/[id]/route.ts`

## Delete Scenario

```
DELETE /api/scenarios/{id}
```

Removes a scenario. Allowed at any lifecycle status.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Scenario UUID |

### Response

```json
{ "ok": true }
```

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Deleted |
| `404` | Scenario not found |
| `500` | Internal error |

Source: `packages/web/src/app/api/scenarios/[id]/route.ts`

## Simulate Scenario

```
POST /api/scenarios/{id}/simulate
```

Runs a Monte Carlo simulation on a draft scenario. Transitions status from `draft` to `simulated`.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Scenario UUID |

No request body — uses the scenario's existing parameters and story snapshot.

### Prerequisites

1. Scenario must exist
2. Status must be `draft`
3. `parameters` must be configured
4. `parameters.agentCount >= 1` and `parameters.capacityLimit >= 1`

### Simulation Pipeline

1. Fetches learnings from `learningStore.list()` via `getServices()`
2. Builds `SimulationInput` from story snapshot via `buildSimulationInput()` — maps stories to `SimStory[]`, applies priority ordering, sets iterations to 1000
3. Runs Monte Carlo simulation via `simulateSprint()` from `@composio/ao-core`
4. Applies parallelism scaling via `applyParallelismScaling()` — divides p50/p80/p95 day predictions by `agentCount * capacityLimit`, clamped to minimum 1 day
5. Persists result and transitions status to `simulated` via `updateScenario()`

### Response

Returns the updated `WhatIfScenario` enriched with a `color` field:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Add 2 agents to Sprint",
  "status": "simulated",
  "result": {
    "p50Days": 5,
    "p80Days": 8,
    "p95Days": 12,
    "onTimeProbability": 0.72,
    "confidence": 0.85,
    "iterationsRun": 1000
  },
  "color": "amber"
}
```

The `color` field is derived from `onTimeProbability` via `getSimulationColor()`:

| Color | Condition |
|-------|-----------|
| `green` | `onTimeProbability > 0.8` |
| `amber` | `onTimeProbability >= 0.5` and `<= 0.8` |
| `red` | `onTimeProbability < 0.5` |

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Simulation complete |
| `400` | No parameters configured, or agentCount/capacityLimit < 1 |
| `404` | Scenario not found |
| `409` | Scenario has already been simulated or applied |
| `500` | Internal error |

Source: `packages/web/src/app/api/scenarios/[id]/simulate/route.ts`

## Compare Scenarios

```
GET /api/scenarios/compare?ids=id1,id2,id3
```

Compares 2-4 scenarios side-by-side with ranking and color assignment.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ids` | string | Yes | Comma-separated scenario IDs (2-4 unique) |

### Validation Pipeline

1. `ids` query parameter is required — returns `400`
2. At least 2 unique IDs required — returns `400`
3. At most 4 unique IDs accepted — returns `400`
4. Each ID must resolve to an existing scenario — returns `404` with not-found IDs listed
5. Draft scenarios or those without results are filtered out — generates warnings
6. At least 2 valid scenarios must remain after filtering — returns `400`
7. No duplicate scenario names allowed — returns `400`

### Comparison Algorithm

Scenarios are ranked by `onTimeProbability` descending via `compareScenarios()` from `@composio/ao-core`. Scenarios with `onTimeProbability` within 0.01 of each other are considered tied and ranked by fewer `storyCount` (simpler scope preferred). Color assigned using the same thresholds as simulation: green (>0.8), amber (>=0.5 and <=0.8), red (<0.5).

### Response

```json
{
  "scenarios": [
    {
      "name": "Add 2 agents",
      "storyCount": 10,
      "result": { "p50Days": 5, "p80Days": 8, "p95Days": 12, "onTimeProbability": 0.85, "confidence": 0.9, "iterationsRun": 1000 },
      "rank": 1,
      "color": "green",
      "isRecommended": true,
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "simulated",
      "parameters": { "agentCount": 4, "capacityLimit": 3, "storyPriorities": [] }
    }
  ],
  "recommendedIndex": 0,
  "warnings": []
}
```

The response enriches core `RankedScenario` objects with original `id`, `status`, and `parameters` from the stored scenarios. `recommendedIndex` points to the top-ranked scenario's position among the valid (post-filtering) scenarios. `warnings` lists any draft or no-result scenarios that were skipped.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Comparison complete |
| `400` | Missing ids, fewer than 2 unique, more than 4, fewer than 2 valid after filtering, or duplicate names |
| `404` | One or more scenario IDs not found |
| `500` | Internal error |

Source: `packages/web/src/app/api/scenarios/compare/route.ts`

## Apply Scenario

```
POST /api/scenarios/{id}/apply
```

Applies a simulated scenario to production. Transitions status from `simulated` to `applied`.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Scenario UUID |

No request body.

### Prerequisites

1. Scenario must exist
2. Status must be `simulated`
3. `parameters` must be defined

### Response

Returns the updated `WhatIfScenario` with status `applied`.

**Side effects:** Persists the status transition via `updateScenario()` with revision tracking for audit trail.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Applied successfully |
| `400` | No parameters configured |
| `404` | Scenario not found |
| `409` | Scenario must be simulated before applying |
| `500` | Internal error |

Source: `packages/web/src/app/api/scenarios/[id]/apply/route.ts`

## Common Patterns

### `force-dynamic` on All Routes

All 5 scenario route files export `dynamic = "force-dynamic"`, disabling Next.js response caching. Every request executes server-side.

### JSONL File-Based Persistence

Scenarios are stored in `.ao-scenarios/scenarios.jsonl` via `scenario-persistence.ts`. Data survives server restarts — no in-memory-only state.

### Dynamic Import Pattern

The create route dynamically imports `@composio/ao-plugin-tracker-bmad` per project to read sprint status for snapshot capture. Individual project read failures are caught and included with empty data rather than failing the request.

### Parallelism Scaling

`applyParallelismScaling()` adjusts Monte Carlo day predictions by dividing by `agentCount * capacityLimit`, clamped to minimum 1 day. This models the effect of parallel agent capacity on sprint duration.

### Parameter Validation Constants

| Constant | Value | Source |
|----------|-------|--------|
| `MIN_AGENT_COUNT` | 1 | `scenario-params.ts` |
| `MAX_AGENT_COUNT` | 50 | `scenario-params.ts` |
| `MIN_CAPACITY` | 1 | `scenario-params.ts` |
| `MAX_CAPACITY` | 20 | `scenario-params.ts` |

### Simulation Defaults

| Constant | Value | Source |
|----------|-------|--------|
| `DEFAULT_ITERATIONS` | 1000 | `scenario-simulation.ts` |

### Revision Tracking

`updateScenario()` appends revisions on each mutation, enabling audit trail for parameter changes, simulation results, and apply transitions.

## Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success (GET, PATCH, DELETE, simulate, compare, apply) |
| `201` | Scenario created (POST) |
| `400` | Missing/invalid fields, validation failure, wrong comparison count |
| `404` | Scenario not found |
| `409` | Wrong lifecycle status for operation |
| `500` | Internal error |

## Key Types

### WhatIfScenario (9 fields)

| Field | Type |
|-------|------|
| `id` | `string` (UUID) |
| `name` | `string` |
| `createdAt` | `string` (ISO 8601) |
| `updatedAt` | `string` (ISO 8601, optional) |
| `projectIds` | `string[]` |
| `stories` | `ScenarioStorySnapshot[]` |
| `status` | `ScenarioStatus` |
| `parameters` | `ScenarioParameters` (optional) |
| `result` | `SimulationResult` (optional) |

### ScenarioStorySnapshot (4 fields)

| Field | Type |
|-------|------|
| `id` | `string` |
| `projectId` | `string` |
| `status` | `string` |
| `domainTags` | `string[]` |

### ScenarioParameters (3 fields)

| Field | Type |
|-------|------|
| `agentCount` | `number` (1-50) |
| `capacityLimit` | `number` (1-20) |
| `storyPriorities` | `StoryPriorityOverride[]` |

### StoryPriorityOverride (3 fields)

| Field | Type |
|-------|------|
| `storyId` | `string` |
| `originalPriority` | `StoryPriority` |
| `newPriority` | `StoryPriority` |

### ScenarioStatus

`"draft" | "simulated" | "applied"`

### StoryPriority

`"high" | "medium" | "low"`

### SimulationResult (6 fields)

| Field | Type |
|-------|------|
| `p50Days` | `number` |
| `p80Days` | `number` |
| `p95Days` | `number` |
| `onTimeProbability` | `number` (0-1) |
| `confidence` | `number` (0-1) |
| `iterationsRun` | `number` |

### SimulationColor

`"green" | "amber" | "red"`

### RankedScenario (6 fields)

| Field | Type |
|-------|------|
| `name` | `string` |
| `storyCount` | `number` |
| `result` | `SimulationResult` |
| `rank` | `number` |
| `color` | `SimulationColor` |
| `isRecommended` | `boolean` |

### ParameterDiff (4 fields)

| Field | Type |
|-------|------|
| `agentCount` | `{ original: number; modified: number } \| null` |
| `capacityLimit` | `{ original: number; modified: number } \| null` |
| `priorityChanges` | `StoryPriorityOverride[]` |
| `hasChanges` | `boolean` |

`agentCount` and `capacityLimit` are `null` when unchanged, or an object with `original` and `modified` values when different.

---

- **Parent** — [REST API](./)
- **Getting Started** — [Installation](../getting-started/installation/) and [Quick Start](../getting-started/quick-start/)
- **Configuration** — [Configuration Reference](../getting-started/configuration/)
- **Related** — [Sprints API](sprints/), [Agents API](agents/) (pool routes), [Dependencies API](dependencies/), [Events API](events/) (SSE scenario events)
