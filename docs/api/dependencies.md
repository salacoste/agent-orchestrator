---
title: Dependencies API
nav_order: 6
parent: REST API
description: Cross-project and per-project dependency management — CRUD operations, graph visualization, blocking alerts, story search, cycle detection.
---

# Dependencies API

Manage dependencies between stories within a project and across projects.

6 route files across 2 groups: cross-project dependencies (4 routes) and per-project dependencies (2 routes). 8 endpoints total: 6 GET, 1 POST, 1 DELETE.

| Group | Prefix | Routes | Methods | Description |
|-------|--------|--------|---------|-------------|
| Cross-Project | `/api/dependencies/cross-project` | 4 | GET, POST, DELETE, GET | CRUD, graph, blocking status, search |
| Per-Project | `/api/sprint/{project}` | 2 | GET, GET | Dependency graph, cycle detection |

Source: `packages/web/src/app/api/dependencies/cross-project/`, `packages/web/src/app/api/sprint/[project]/`

## Cross-Project Dependencies

```
GET /api/dependencies/cross-project
POST /api/dependencies/cross-project
DELETE /api/dependencies/cross-project
```

CRUD operations for cross-project story dependencies. Dependencies link a source story to a target story across different projects.

### List Dependencies

```
GET /api/dependencies/cross-project
```

Returns cross-project dependencies with optional filtering.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | No | Filter to project (source or target) |
| `storyId` | string | No | Filter to story (requires `projectId`) |
| `status` | string | No | Only supported value: `"blocked"` — filters to unresolved dependencies |

#### Filtering Logic

| Parameters Present | Behavior |
|--------------------|----------|
| `projectId` + `storyId` | `store.getForStory(projectId, storyId)` |
| `projectId` only | `store.list({ projectId })` |
| Neither | `store.list()` — returns all |
| `status=blocked` | Uses `getBlockedCrossProjectDeps()` instead of `resolveAllDependencyStatuses()` |

#### Response

```json
{
  "dependencies": [
    {
      "id": "dep-m5x7k2n-1a2b3c4d",
      "sourceProjectId": "project-a",
      "sourceStoryId": "1-2-user-auth",
      "targetProjectId": "project-b",
      "targetStoryId": "3-1-shared-module",
      "createdAt": "2026-04-25T10:00:00.000Z",
      "targetStatus": "done",
      "isResolved": true
    }
  ]
}
```

The `targetStatus` and `isResolved` fields are included when dependencies are enriched via `resolveAllDependencyStatuses()`. When `status=blocked` is used, these fields are omitted.

#### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `500` | Failed to list dependencies |

### Create Dependency

```
POST /api/dependencies/cross-project
```

Creates a cross-project dependency between two stories.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sourceProjectId` | string | Yes | Project containing the blocked story |
| `sourceStoryId` | string | Yes | Story that is blocked |
| `targetProjectId` | string | Yes | Project containing the blocking story |
| `targetStoryId` | string | Yes | Story that must complete first |

#### Validation Pipeline

1. All 4 fields must be truthy — returns `400` if any missing
2. `validateDependencyReferences()` checks project existence in config and story existence in sprint data — returns `400` with `details` array
3. `store.add()` runs cycle detection via DFS — returns `422` with `CircularDependencyError`
4. `store.add()` runs duplicate detection — returns `409` if same source→target pair exists

#### Response

```json
{
  "dependency": {
    "id": "dep-m5x7k2n-1a2b3c4d",
    "sourceProjectId": "project-a",
    "sourceStoryId": "1-2-user-auth",
    "targetProjectId": "project-b",
    "targetStoryId": "3-1-shared-module",
    "createdAt": "2026-04-25T10:00:00.000Z"
  }
}
```

Dependency IDs are generated as `"dep-<timestamp-base36>-<random-8hex>"` via `randomBytes`.

**Side effect:** Emits `notifyCrossProjectDepChange({ action: "created", depId, timestamp })` on success.

#### Status Codes

| Code | Condition |
|------|-----------|
| `201` | Created |
| `400` | Missing fields or validation failure |
| `409` | Duplicate dependency |
| `422` | Circular dependency detected |
| `500` | Failed to create dependency |

### Delete Dependency

```
DELETE /api/dependencies/cross-project
```

Removes a cross-project dependency.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `depId` | string | Yes | Dependency identifier |

#### Response

```json
{
  "removed": {
    "id": "dep-m5x7k2n-1a2b3c4d",
    "sourceProjectId": "project-a",
    "sourceStoryId": "1-2-user-auth",
    "targetProjectId": "project-b",
    "targetStoryId": "3-1-shared-module",
    "createdAt": "2026-04-25T10:00:00.000Z"
  }
}
```

**Side effect:** Emits `notifyCrossProjectDepChange({ action: "deleted", depId, timestamp })` on success.

#### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Removed |
| `400` | Missing `depId` |
| `404` | Dependency not found |
| `500` | Failed to delete dependency |

Source: `packages/web/src/app/api/dependencies/cross-project/route.ts`

## Cross-Project Graph

```
GET /api/dependencies/cross-project/graph
```

Returns a graph visualization of all cross-project dependencies with nodes, edges, and project grouping.

No query parameters or request body.

### Response

```json
{
  "graph": {
    "nodes": [
      {
        "id": "project-a::1-2-user-auth",
        "storyId": "1-2-user-auth",
        "projectId": "project-a",
        "projectName": "Authentication Service",
        "status": "in-progress",
        "isBlocked": false
      }
    ],
    "edges": [
      {
        "id": "dep-m5x7k2n-1a2b3c4d",
        "sourceNodeId": "project-a::1-2-user-auth",
        "targetNodeId": "project-b::3-1-shared-module",
        "sourceProjectId": "project-a",
        "targetProjectId": "project-b",
        "isResolved": false
      }
    ],
    "projectGroups": {
      "project-a": ["project-a::1-2-user-auth"],
      "project-b": ["project-b::3-1-shared-module"]
    }
  }
}
```

Nodes are deduplicated by `projectId::storyId`. Project names are resolved from `config.projects`, falling back to the project ID. Edges map 1:1 to dependencies. Returns an empty graph (`{ "graph": { "nodes": [], "edges": [], "projectGroups": {} } }`) when no dependencies exist.

Uses `buildCrossProjectGraph()` from `@composio/ao-core`.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `500` | Failed to build graph |

Source: `packages/web/src/app/api/dependencies/cross-project/graph/route.ts`

## Cross-Project Blocking Status

```
GET /api/dependencies/cross-project/blocking-status
```

Returns blocking alerts for cross-project dependencies that have remained unresolved beyond a threshold. Tracks blocking start times across restarts via a persistent store.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `threshold` | integer | 3600000 | Blocking notification threshold in milliseconds. Minimum value is 1. |

The default threshold is 3,600,000 ms (1 hour), defined by `DEFAULT_BLOCKING_THRESHOLD_MS` in `@composio/ao-core`.

### Response

```json
{
  "alerts": [
    {
      "dep": {
        "id": "dep-m5x7k2n-1a2b3c4d",
        "sourceProjectId": "project-a",
        "sourceStoryId": "1-2-user-auth",
        "targetProjectId": "project-b",
        "targetStoryId": "3-1-shared-module",
        "createdAt": "2026-04-25T10:00:00.000Z",
        "targetStatus": "in-progress",
        "isResolved": false
      },
      "blockedStoryId": "1-2-user-auth",
      "blockedProjectId": "project-a",
      "blockingStoryId": "3-1-shared-module",
      "blockingProjectId": "project-b",
      "blockingDurationMs": 5400000,
      "blockingDurationLabel": "1h 30m",
      "thresholdExceeded": true
    }
  ],
  "blockingThresholdMs": 3600000,
  "totalBlocked": 1
}
```

`totalBlocked` counts only alerts where `thresholdExceeded === true`. The `blockingDurationLabel` is a human-readable string (e.g., `"<1m"`, `"5m"`, `"45m"`, `"2h 30m"`, `"2d 5h"`).

Blocking start times are persisted to `cross-project-blocking-times.yaml` alongside the config file. Returns empty `alerts` array when no dependencies exist.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `400` | Invalid threshold (NaN or < 1) |
| `500` | Failed to retrieve blocking status |

Source: `packages/web/src/app/api/dependencies/cross-project/blocking-status/route.ts`

## Cross-Project Story Search

```
GET /api/dependencies/cross-project/search-stories
```

Searches stories across all configured projects. Used to find candidate stories for creating cross-project dependencies.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query — case-insensitive substring match on story ID and derived title |

### Response

```json
{
  "stories": [
    {
      "id": "3-1-shared-module",
      "title": "shared-module",
      "status": "in-progress",
      "projectId": "project-b"
    }
  ]
}
```

Titles are derived by splitting the story ID on hyphens and joining everything after the first two segments with spaces via `deriveStoryTitle()` (e.g., `"49-3-real-time-sse-updates"` becomes `"real time sse updates"`). Stories with IDs starting with `"epic-"` or ending with `"-retrospective"` are excluded; all other stories are included.

Uses dynamic import of `@composio/ao-plugin-tracker-bmad` per project. Individual project read failures are caught and skipped.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `400` | Missing required query parameter `q` |
| `500` | Failed to search stories |

Source: `packages/web/src/app/api/dependencies/cross-project/search-stories/route.ts`

## Per-Project Dependency Graph

```
GET /api/sprint/{project}/dependencies
```

Returns the within-project dependency graph built from `dependsOn` arrays in the project's sprint-status.yaml. Requires the bmad tracker plugin.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `project` | string | Project identifier |

### Tracker Requirement

This endpoint requires `project.tracker.plugin === "bmad"`. When the project uses a different tracker (or no tracker), returns an empty default response:

```json
{ "nodes": {}, "circularWarnings": [], "missingWarnings": [] }
```

### Response

```json
{
  "nodes": {
    "1-2-user-auth": {
      "storyId": "1-2-user-auth",
      "dependsOn": ["1-1-project-setup"],
      "blockedBy": ["1-1-project-setup"],
      "blocks": ["1-3-auth-middleware"],
      "isBlocked": true
    },
    "1-1-project-setup": {
      "storyId": "1-1-project-setup",
      "dependsOn": [],
      "blockedBy": [],
      "blocks": ["1-2-user-auth"],
      "isBlocked": false
    }
  },
  "circularWarnings": [],
  "missingWarnings": []
}
```

| Field | Type | Description |
|-------|------|-------------|
| `nodes` | `Record<string, DependencyNode>` | Story dependency nodes keyed by story ID |
| `circularWarnings` | `string[][]` | Arrays of story IDs forming cycles (deduplicated by canonical form) |
| `missingWarnings` | `string[]` | Dependency references that don't exist in sprint status |

Dependency nodes are computed in two passes: first building `dependsOn` arrays, then computing reverse `blocks` links and `blockedBy` lists (dependencies not yet done).

Uses `computeDependencyGraph()` from `@composio/ao-plugin-tracker-bmad`.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success (may return empty graph if no tracker) |
| `404` | Project not found |
| `500` | Internal error |

Source: `packages/web/src/app/api/sprint/[project]/dependencies/route.ts`

## Per-Project Dependency Cycles

```
GET /api/sprint/{project}/dependency-cycles
```

Detects circular dependencies within a project's story dependency graph. Uses `@composio/ao-plugin-tracker-bmad` — will error if the tracker plugin is not available.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `project` | string | Project identifier |

### Response

```json
{
  "cycles": [
    {
      "cycle": ["1-2-user-auth", "1-3-auth-middleware", "1-2-user-auth"],
      "length": 3,
      "statuses": {
        "1-2-user-auth": "in-progress",
        "1-3-auth-middleware": "backlog"
      }
    }
  ],
  "totalCycles": 1,
  "affectedStories": ["1-2-user-auth", "1-3-auth-middleware"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `cycles` | `CycleInfo[]` | Detected cycles with story IDs, length, and current statuses |
| `totalCycles` | `number` | Count of detected cycles |
| `affectedStories` | `string[]` | All story IDs that appear in any cycle |

Cycles are detected via DFS back-edge detection. Cycle arrays are canonicalized (rotated to start with the lexicographically smallest ID) and deduplicated.

Uses `detectDependencyCycles()` from `@composio/ao-plugin-tracker-bmad`.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `404` | Project not found |
| `500` | Internal error |

Source: `packages/web/src/app/api/sprint/[project]/dependency-cycles/route.ts`

## Common Patterns

### No `force-dynamic`

None of the dependency routes export `dynamic = "force-dynamic"`. They use Next.js default caching behavior.

### bmad Tracker Guard

The per-project dependency graph route (`GET /api/sprint/{project}/dependencies`) requires `project.tracker.plugin === "bmad"`. When a different tracker is configured, it returns an empty default response instead of an error. The dependency-cycles route does not implement this guard — it calls `detectDependencyCycles()` directly, which relies on the bmad tracker being available.

### Circular Dependency Detection

Cross-project dependency creation runs DFS-based cycle detection. If a cycle would be created, the POST returns `422` with a `CircularDependencyError` containing a `cyclePath` array. Cycles are detected before the dependency is persisted.

### Dependency Change Notifications

POST and DELETE emit `notifyCrossProjectDepChange()` events via an in-memory pub/sub module. This powers the `cross-project-dep-changed` SSE event type documented in the [Events API](events/). Note: Module-level state means single-process only — multi-instance deployments need external pub/sub.

### Dynamic Import Pattern

`search-stories` and the sprint data map builder dynamically import `@composio/ao-plugin-tracker-bmad` per project. Individual project read failures are caught and logged, not fatal.

### Blocking Times Persistence

Blocking start times are persisted to `cross-project-blocking-times.yaml` alongside the config file via `BlockingTimesFileStore`. This preserves blocking durations across server restarts.

### Sprint Data Map

Several routes build a sprint data map via `buildSprintDataMap()` which reads sprint status for all configured projects. `SprintStatusEntry` objects are flattened to plain string status values.

### Graceful Empty Responses

- Graph returns empty graph when no dependencies exist
- Blocking status returns empty `alerts` array when no dependencies exist
- Per-project dependency graph returns empty default shapes when tracker is not bmad; dependency-cycles does not implement this guard

## Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success (GET, DELETE) |
| `201` | Dependency created (POST) |
| `400` | Missing or invalid fields, invalid threshold |
| `404` | Dependency or project not found |
| `409` | Duplicate dependency |
| `422` | Circular dependency detected |
| `500` | Internal error |

## Key Types

### CrossProjectDependency (6 fields)

| Field | Type |
|-------|------|
| `id` | `string` |
| `sourceProjectId` | `string` |
| `sourceStoryId` | `string` |
| `targetProjectId` | `string` |
| `targetStoryId` | `string` |
| `createdAt` | `string` (ISO 8601) |

### DependencyWithStatus (8 fields)

Extends `CrossProjectDependency` with:

| Field | Type |
|-------|------|
| `targetStatus` | `string` |
| `isResolved` | `boolean` |

### DependencyNode

| Field | Type |
|-------|------|
| `storyId` | `string` |
| `dependsOn` | `string[]` |
| `blockedBy` | `string[]` |
| `blocks` | `string[]` |
| `isBlocked` | `boolean` |

### DependencyCycleResult

| Field | Type |
|-------|------|
| `cycles` | `CycleInfo[]` |
| `totalCycles` | `number` |
| `affectedStories` | `string[]` |

### CycleInfo

| Field | Type |
|-------|------|
| `cycle` | `string[]` |
| `length` | `number` |
| `statuses` | `Record<string, string>` |

### DependencyBlockingAlert

| Field | Type |
|-------|------|
| `dep` | `DependencyWithStatus` |
| `blockedStoryId` | `string` |
| `blockedProjectId` | `string` |
| `blockingStoryId` | `string` |
| `blockingProjectId` | `string` |
| `blockingDurationMs` | `number` |
| `blockingDurationLabel` | `string` |
| `thresholdExceeded` | `boolean` |

### CrossProjectGraph

| Field | Type |
|-------|------|
| `nodes` | `CrossProjectGraphNode[]` |
| `edges` | `CrossProjectGraphEdge[]` |
| `projectGroups` | `Record<string, string[]>` |

---

- **Parent** — [REST API](./)
- **Getting Started** — [Installation](../getting-started/installation/) and [Quick Start](../getting-started/quick-start/)
- **Configuration** — [Configuration Reference](../getting-started/configuration/)
- **Related** — [Portfolio API](portfolio/), [Agents API](agents/) (pool routes), [Events API](events/) (SSE dependency events), [Sprints API](sprints/)
