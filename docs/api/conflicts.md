---
title: Conflicts API
nav_order: 8
parent: REST API
description: Resource conflict detection, resolution, suggestions, history, and policy management — 9 route files, 11 endpoints across two prefix groups.
---

# Conflicts API

Detect, resolve, and manage resource conflicts across agents and projects. Includes sprint-level file conflict detection, resolution history with pattern analysis, and configurable conflict resolution policies.

9 route files across two prefix groups. 11 endpoints total: 9 GET, 1 POST, 1 PUT.

| Group | Prefix | Routes | Methods | Description |
|-------|--------|--------|---------|-------------|
| Conflict CRUD | `/api/conflicts` | 1 | GET | List resource conflicts |
| Conflict by ID | `/api/conflicts/{conflictId}` | 1 | POST | Resolve a conflict |
| Suggestions | `/api/conflicts/{conflictId}/suggestions` | 1 | GET | Get resolution suggestions |
| History | `/api/conflicts/history` | 1 | GET | Conflict history with patterns |
| History Export | `/api/conflicts/history/export` | 1 | GET | Export history as JSON file |
| Policies | `/api/conflicts/policies` | 1 | GET | List all policies |
| Policy by Type | `/api/conflicts/policies/{resourceType}` | 1 | GET, PUT | Get/update policy per resource type |
| Sprint Conflicts (Global) | `/api/sprint/conflicts` | 1 | GET | Global file conflict detection |
| Sprint Conflicts (Project) | `/api/sprint/{project}/conflicts` | 1 | GET | Project-level conflicts with export |

Source: `packages/web/src/app/api/conflicts/`, `packages/web/src/app/api/sprint/`

{: .warning}
> Only `/api/sprint/conflicts` exports `dynamic = "force-dynamic"`. The other 8 routes use Next.js default caching behavior.

## List Resource Conflicts

```
GET /api/conflicts
```

Runs a fresh conflict detection scan and returns detected conflicts.

{: .highlight}
> **Side-effecting read:** Every call triggers `checkResourceConflicts()`, which detects conflicts, persists results to the conflict store, and appends to the audit trail. This is not a pure read.

### Query Parameters

All parameters are optional.

| Parameter | Type | Description |
|-----------|------|-------------|
| `resourceType` | `string` | Filter by resource type: `repository`, `file-path`, `agent`, `external-service` |
| `projectId` | `string` | Filter to conflicts involving a specific project |

### Response

```json
{
  "conflicts": [
    {
      "id": "conflict-001",
      "resourceType": "file-path",
      "resourceIdentifier": "src/auth/login.ts",
      "competingProjects": ["project-a", "project-b"],
      "severity": "high",
      "detectedAt": "2026-04-25T14:30:00.000Z",
      "metadata": {}
    }
  ],
  "lastScanAt": "2026-04-25T14:30:01.234Z",
  "scanDurationMs": 45
}
```

Source: `packages/web/src/app/api/conflicts/route.ts`

## Resolve Conflict

```
POST /api/conflicts/{conflictId}
```

Resolve a conflict by choosing an action.

{: .warning}
> **Mock implementation:** This endpoint currently returns a hardcoded response. A future release will call `ConflictResolutionService.resolve()` for real resolution.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `conflictId` | `string` | The conflict ID to resolve |

### Request Body

```json
{
  "action": "keep-existing",
  "reason": "Existing agent has more context"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | `string` | Yes | One of: `keep-existing`, `replace-with-new`, `manual` |
| `reason` | `string` | No | Optional reason (auto-generated if omitted) |

### Response

```json
{
  "success": true,
  "resolution": {
    "conflictId": "conflict-001",
    "action": "keep-existing",
    "keptAgent": "existing-agent",
    "terminatedAgent": "new-agent",
    "reason": "Existing agent has more context",
    "resolvedAt": "2026-04-25T15:00:00.000Z"
  }
}
```

The `keptAgent` and `terminatedAgent` fields are derived from the action:

| Action | keptAgent | terminatedAgent |
|--------|-----------|-----------------|
| `keep-existing` | `existing-agent` | `new-agent` |
| `replace-with-new` | `new-agent` | `existing-agent` |
| `manual` | `null` | `null` |

### Errors

| Status | Condition |
|--------|-----------|
| `400` | `action` is missing or not one of the three valid values |

Source: `packages/web/src/app/api/conflicts/[conflictId]/route.ts`

## Resolution Suggestions

```
GET /api/conflicts/{conflictId}/suggestions
```

Generate resolution suggestions for a specific conflict.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `conflictId` | `string` | The conflict ID |

### Response

```json
{
  "conflict": { "id": "conflict-001", "resourceType": "file-path", "..." : "..." },
  "suggestions": [
    {
      "id": "sugg-001",
      "conflictId": "conflict-001",
      "strategy": "sequential-scheduling",
      "description": "Queue project work sequentially",
      "impactEstimate": "Eliminates all conflicts of this type",
      "recommended": true,
      "actions": [
        { "type": "config-change", "description": "Set priority order in config" }
      ]
    }
  ],
  "generatedAt": "2026-04-25T14:35:00.000Z"
}
```

The response is typed as `ConflictResolutionResponse` from `@composio/ao-core`.

{: .note}
> Conflict lookup is performed by linear scan over all stored conflicts (no index). For large conflict sets, this may be slow.

### Errors

| Status | Condition |
|--------|-----------|
| `404` | No conflict found matching `conflictId` |

Source: `packages/web/src/app/api/conflicts/[conflictId]/suggestions/route.ts`

## Conflict History

```
GET /api/conflicts/history
```

Returns conflict resolution history with computed patterns. Reads all entries from the JSONL audit trail and filters in-memory.

### Query Parameters

All parameters are optional.

| Parameter | Type | Description |
|-----------|------|-------------|
| `dateFrom` | `string` | Start date filter (ISO 8601) |
| `dateTo` | `string` | End date filter (ISO 8601) |
| `resourceType` | `string` | Filter by resource type |
| `projectId` | `string` | Filter by project |
| `outcome` | `string` | Filter by resolution outcome |

Filter parsing is shared with the export endpoint via `filter-utils.ts`. The query param `outcome` maps to the `resolutionOutcome` field in the `ConflictHistoryFilter`. Type casts from query strings to `ResourceConflictType` and `ConflictResolutionOutcome` are **not validated** — arbitrary strings pass through.

### Response

```json
{
  "entries": [
    {
      "id": "entry-001",
      "conflict": { "id": "conflict-001", "resourceType": "file-path", "resourceIdentifier": "src/auth/login.ts", "competingProjects": ["project-a", "project-b"], "severity": "high", "detectedAt": "2026-04-25T14:30:00.000Z", "metadata": {} },
      "resolvedAt": "2026-04-25T15:00:00.000Z",
      "resolutionStrategy": "sequential-scheduling",
      "resolutionOutcome": "resolved",
      "resolvedBy": "auto",
      "notes": ""
    }
  ],
  "patterns": {
    "totalResolved": 12,
    "byResourceType": { "file-path": 8, "repository": 4 },
    "byOutcome": { "resolved": 10, "dismissed": 2 },
    "byStrategy": { "sequential-scheduling": 6, "manual": 4, "none": 2 },
    "mostConflictedResource": "src/auth/",
    "avgResolutionTimeMs": 3400,
    "recurringConflicts": [{ "resourceIdentifier": "src/auth/", "count": 5 }]
  },
  "filter": {
    "dateFrom": "2026-04-01"
  }
}
```

The `entries` array contains `ConflictHistoryEntry` objects with the full `ResourceConflict` snapshot embedded. The `patterns` field contains `ConflictPatternSummary` computed by `computeConflictPatterns()` over the filtered entries. The `filter` object only includes keys that were provided as query parameters — omitted parameters are excluded (not returned as `null`).

Source: `packages/web/src/app/api/conflicts/history/route.ts`, `packages/web/src/app/api/conflicts/history/filter-utils.ts`

## Export History

```
GET /api/conflicts/history/export
```

Export conflict history as a downloadable JSON file. Uses the same filter pipeline as the history endpoint.

### Query Parameters

Same as [Conflict History](#conflict-history): `dateFrom`, `dateTo`, `resourceType`, `projectId`, `outcome`.

### Response

Returns a JSON file download (not inline JSON):

```
Content-Type: application/json
Content-Disposition: attachment; filename="conflict-history-2026-04-25T15-00-00-000Z.json"
```

The filename timestamp uses ISO 8601 with colons and dots replaced by hyphens.

Source: `packages/web/src/app/api/conflicts/history/export/route.ts`

## List Policies

```
GET /api/conflicts/policies
```

Returns conflict resolution policies for all four resource types.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | `string` | Resolve project-level overrides for a specific project |

### Response

```json
{
  "policies": {
    "repository": { "resolutionMode": "priority-based", "priorityOrder": ["agent-1", "agent-2"] },
    "file-path": { "resolutionMode": "manual" },
    "agent": { "resolutionMode": "isolation", "isolationConfig": { "strategy": "worktree" } },
    "external-service": { "resolutionMode": "priority-based", "priorityOrder": [] }
  }
}
```

The four resource types are always returned regardless of query parameters. Policies merge global defaults with project-level overrides when `projectId` is provided.

Source: `packages/web/src/app/api/conflicts/policies/route.ts`

## Get / Update Policy

```
GET  /api/conflicts/policies/{resourceType}
PUT  /api/conflicts/policies/{resourceType}
```

Get or update the conflict resolution policy for a specific resource type.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `resourceType` | `string` | Required. One of: `repository`, `file-path`, `agent`, `external-service` |

### GET

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | `string` | Resolve project-level overrides |

#### Response

```json
{
  "policy": {
    "resolutionMode": "priority-based",
    "priorityOrder": ["agent-1", "agent-2"]
  }
}
```

### PUT

{: .warning}
> **In-memory only:** Policy updates modify the in-memory config object. YAML write-back requires config persistence infrastructure (tracked as follow-up task). Changes are lost on server restart.

#### Request Body

```json
{
  "resolutionMode": "priority-based",
  "priorityOrder": ["agent-1", "agent-2", "agent-3"],
  "isolationConfig": { "strategy": "worktree" },
  "projectId": "my-project"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resolutionMode` | `string` | Yes | One of: `priority-based`, `manual`, `isolation` |
| `priorityOrder` | `string[]` | No | Agent priority order (for `priority-based` mode) |
| `isolationConfig` | `object` | No | Isolation configuration (for `isolation` mode) |
| `projectId` | `string` | No | Scope the update to a specific project |

#### Response

```json
{
  "policy": { "resolutionMode": "priority-based", "priorityOrder": ["agent-1", "agent-2", "agent-3"] },
  "effective": { "resolutionMode": "priority-based", "priorityOrder": ["agent-1", "agent-2", "agent-3"] }
}
```

- `policy` — the submitted policy
- `effective` — the resolved effective policy after merging with project/global config

#### Errors

| Status | Condition |
|--------|-----------|
| `400` | Invalid `resourceType` in URL |
| `400` | `resolutionMode` missing or not one of: `priority-based`, `manual`, `isolation` |

Source: `packages/web/src/app/api/conflicts/policies/[resourceType]/route.ts`

## Sprint Conflicts (Global)

```
GET /api/sprint/conflicts
```

Detect file-level conflicts across all active sprint sessions. This is the only conflict route that exports `dynamic = "force-dynamic"`.

Includes header: `Cache-Control: no-cache, no-store, must-revalidate`.

{: .note}
> Builds `AgentFileChange[]` from the learning store (`getLearningStore()`), with a fallback to `session.metadata["filesModified"]` (JSON-parsed) for sessions without learning data. Malformed JSON in session metadata is silently skipped.

### Response

```json
{
  "conflicts": [
    {
      "filePath": "src/auth/login.ts",
      "agentA": "claude-1",
      "agentB": "claude-3"
    }
  ],
  "timeline": null,
  "timestamp": "2026-04-25T14:30:00.000Z"
}
```

The `timeline` field is always `null` (checkpoint timeline feature deferred).

{: .highlight}
> **Graceful degradation:** On any unhandled exception, returns HTTP 200 with `{ "conflicts": [], "timeline": null, "timestamp": "..." }`. This endpoint never returns a 500 error.

Source: `packages/web/src/app/api/sprint/conflicts/route.ts`

## Sprint Conflicts (Project)

```
GET /api/sprint/{project}/conflicts
```

Project-level sprint conflict detection using the `ConflictDetectionService`. Supports sorting and export.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `project` | `string` | Project ID (must exist in `config.projects`) |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sort` | `string` | `recency` | Sort order: `recency` (most recent first) or `frequency` (most frequent first) |
| `export` | `string` | — | Export format: `csv` or `json`. Omit for inline JSON. |

### Response (default JSON)

```json
{
  "conflicts": [
    {
      "conflictId": "conflict-001",
      "storyId": "62-47-conflicts-risk-api",
      "existingAgent": "claude-1",
      "conflictingAgent": "claude-3",
      "type": "duplicate-assignment",
      "severity": "high",
      "detectedAt": "2026-04-25T14:30:00.000Z",
      "priorityScores": null,
      "recommendations": null,
      "resolution": null
    }
  ],
  "summary": {
    "total": 1,
    "bySeverity": { "critical": 0, "high": 1, "medium": 0, "low": 0 },
    "byType": { "duplicate-assignment": 1 }
  }
}
```

{: .note}
> The `byType` summary only tracks `"duplicate-assignment"`. Other conflict type categories are not currently counted.

### Response (export=csv)

Returns a CSV file download:

```
Content-Type: text/csv
Content-Disposition: attachment; filename="conflicts-my-project.csv"
```

Columns: `Conflict ID`, `Story ID`, `Existing Agent`, `Conflicting Agent`, `Type`, `Severity`, `Detected At`, `Resolution`, `Resolved At`.

### Response (export=json)

Returns a pretty-printed JSON file download:

```
Content-Type: application/json
Content-Disposition: attachment; filename="conflicts-my-project.json"
```

### Errors

| Status | Condition |
|--------|-----------|
| `404` | `project` not found in `config.projects` |
| `500` | Detection service failure |

Source: `packages/web/src/app/api/sprint/[project]/conflicts/route.ts`

## Common Patterns

### Rendering Mode

| Route | `dynamic` export | Notes |
|-------|------------------|-------|
| `/api/conflicts` | None (default) | |
| `/api/conflicts/{conflictId}` | None (default) | |
| `/api/conflicts/{conflictId}/suggestions` | None (default) | |
| `/api/conflicts/history` | None (default) | |
| `/api/conflicts/history/export` | None (default) | |
| `/api/conflicts/policies` | None (default) | |
| `/api/conflicts/policies/{resourceType}` | None (default) | |
| `/api/sprint/conflicts` | `force-dynamic` | Only one |
| `/api/sprint/{project}/conflicts` | None (default) | |

### Implementation Gaps

| Gap | Route | Notes |
|-----|-------|-------|
| Mock resolution | `POST /api/conflicts/{conflictId}` | Returns hardcoded response, not calling real `ConflictResolutionService` |
| Deferred timeline | `GET /api/sprint/conflicts` | `timeline` field always `null` |
| In-memory policy | `PUT /api/conflicts/policies/{resourceType}` | No YAML write-back; changes lost on restart |
| Unvalidated casts | History, export | `resourceType` and `outcome` query params cast without validation |

### Shared Filter Pipeline

The history and export endpoints share filter parsing via `conflicts/history/filter-utils.ts`:

```typescript
function parseHistoryFilter(searchParams: URLSearchParams): ConflictHistoryFilter
```

Both endpoints read the full JSONL history, apply the same filter, and then either return inline JSON (history) or a file download (export).

## Status Codes

| Status | Meaning | When |
|--------|---------|------|
| `200` | Success | All successful responses |
| `400` | Bad Request | Invalid action, invalid resource type, missing required fields |
| `404` | Not Found | Conflict ID or project ID not found |
| `500` | Internal Server Error | Unhandled exceptions (not returned by `/api/sprint/conflicts`) |

## Key Types

| Type | Source | Description |
|------|--------|-------------|
| `ResourceConflict` (7 fields) | `@composio/ao-core` | `id`, `resourceType`, `resourceIdentifier`, `competingProjects`, `severity`, `detectedAt`, `metadata` |
| `ResourceConflictType` | `@composio/ao-core` | `"repository" \| "file-path" \| "agent" \| "external-service"` |
| `ResourceConflictPolicy` | `@composio/ao-core` | Resolution policy for a resource type |
| `ResourceConflictSuggestion` (7 fields) | `@composio/ao-core` | `id`, `conflictId`, `strategy`, `description`, `impactEstimate`, `recommended`, `actions` |
| `SuggestionAction` (2 fields) | `@composio/ao-core` | `type` (`"config-change" \| "agent-operation" \| "schedule-change"`), `description` |
| `ResourceConflictResolutionStrategy` | `@composio/ao-core` | `"sequential-scheduling" \| "resource-isolation" \| "agent-reassignment" \| "increase-capacity" \| "stagger-schedules"` |
| `ConflictResolutionOutcome` | `@composio/ao-core` | `"resolved" \| "dismissed" \| "escalated" \| "auto-resolved"` |
| `ConflictResolutionResponse` (3 fields) | `@composio/ao-core` | `conflict`, `suggestions[]`, `generatedAt` |
| `ConflictHistoryEntry` (6 fields) | `@composio/ao-core` | `id`, `conflict`, `resolvedAt`, `resolutionStrategy`, `resolutionOutcome`, `resolvedBy`, `notes` |
| `ConflictHistoryFilter` (5 fields) | `@composio/ao-core` | `dateFrom`, `dateTo`, `resourceType`, `projectId`, `resolutionOutcome` (all optional) |
| `ConflictPatternSummary` (7 fields) | `@composio/ao-core` | `totalResolved`, `byResourceType`, `byOutcome`, `byStrategy`, `mostConflictedResource`, `avgResolutionTimeMs`, `recurringConflicts` |
| `FileConflict` (3 fields) | `@/lib/workflow/conflict-detector` | `filePath`, `agentA`, `agentB` |
| `AgentFileChange` | `@/lib/workflow/conflict-detector` | Agent → files mapping for conflict detection |

---

- **Parent** — [REST API](.)
- **Siblings** — [Sessions](sessions/), [Sprints](sprints/), [Agents](agents/), [Events](events/), [Portfolio](portfolio/), [Dependencies](dependencies/), [Scenarios](scenarios/), [Risk](risk/)
- **Getting Started** — [Installation](../getting-started/installation/), [Quick Start](../getting-started/quick-start/)
- **Configuration** — [Configuration Reference](../getting-started/configuration/)
