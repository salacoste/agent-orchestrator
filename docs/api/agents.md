---
title: Agents API
nav_order: 3
parent: REST API
description: Agent lifecycle endpoints — detail, activity, confidence, reasoning, logs, ping, reassign, restart, resume, cascade resume, and pool capacity/utilization.
---

# Agents API

Manage individual agent sessions and inspect agent state.
13 route files cover agent detail, activity, confidence, reasoning, logs, liveness, recovery actions, cascade control, and pool-level capacity.

| Group | Prefix | Routes | Description |
|-------|--------|--------|-------------|
| Agent Management | `/api/agent` | 11 | Detail, activity, confidence, reasoning, logs, ping, reassign, restart, resume, cascade resume |
| Pool Management | `/api/pool` | 2 | Capacity, utilization |

Source: `packages/web/src/app/api/agent/`, `packages/web/src/app/api/pool/`

## Get Agent

```
GET /api/agent/{id}
```

Returns agent session data from the SessionManager.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Agent session identifier |

### Response

```json
{
  "id": "session-abc",
  "projectId": "my-project",
  "status": "working",
  "activity": "active",
  "branch": "feature/auth",
  "issueId": "PROJ-123",
  "pr": { "number": 42, "url": "https://github.com/org/repo/pull/42", "title": "Add auth" },
  "hasWorkspace": true,
  "agentInfo": { "summary": "Implementing authentication flow" },
  "createdAt": "2026-04-25T10:00:00.000Z",
  "lastActivityAt": "2026-04-25T10:05:00.000Z",
  "restoredAt": null,
  "metadata": {
    "agent": "claude-code",
    "summary": "Working on auth module",
    "exitCode": null,
    "signal": null,
    "failureReason": null
  }
}
```

13 response fields. The `pr` object contains only `number`, `url`, and `title` (not the full `DashboardPR` shape). The `metadata` object is a **5-key allowlist** exposing only safe fields (`agent`, `summary`, `exitCode`, `signal`, `failureReason`) — internal paths and ports are excluded. Dates use `safeISOString()` which catches `Invalid Date` and falls back to epoch.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `404` | Agent not found |
| `500` | Internal error |

Source: `packages/web/src/app/api/agent/[id]/route.ts`

## Agent Activity

```
GET /api/agent/{id}/activity
```

Returns agent activity events from the JSONL event backup log.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Agent session identifier |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 100 | Max events to return, clamped to 1–500 |

### Response

```json
{ "events": [ ... ] }
```

Falls back to `{ "events": [] }` when no events are found.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `404` | Agent not found |
| `500` | Internal error |

Source: `packages/web/src/app/api/agent/[id]/activity/route.ts`

## Agent Confidence

```
GET /api/agent/{id}/confidence
```

Returns per-file confidence indicators calculated from learning store data.

### Path Parameters

| Parameter | Type | Validation |
|-----------|------|------------|
| `id` | string | Must match `/^[a-zA-Z0-9_-]+$/` — returns `400` if invalid |

### Response

```json
{
  "agentId": "session-abc",
  "files": [
    { "path": "src/auth.ts", "confidence": 0.85, "factors": { ... } }
  ]
}
```

Uses `calculateConfidence()` from `@composio/ao-core`. Reads the most recent learning entry (oldest-first store, takes last entry). Gracefully falls back to `{ retryCount: 0, errorCategories: [], filesModified: [] }` when no learnings exist.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `400` | Invalid agent ID format |
| `500` | Internal error |

Source: `packages/web/src/app/api/agent/[id]/confidence/route.ts`

## Agent Reasoning

```
GET /api/agent/{id}/reasoning
```

Returns extracted decision logic / reasoning trail from session summary and learning data.

### Path Parameters

| Parameter | Type | Validation |
|-----------|------|------------|
| `id` | string | Must match `/^[a-zA-Z0-9_-]+$/` — returns `400` if invalid |

### Response

Returns the output of `extractReasoning()` from `@composio/ao-core`. Data sources:

1. **Session summary** — from `session.agentInfo.summary` (non-fatal if unavailable)
2. **Learning data** — domain tags, error categories, files modified, retry count (non-fatal if unavailable)

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `400` | Invalid agent ID format |
| `500` | Internal error |

Source: `packages/web/src/app/api/agent/[id]/reasoning/route.ts`

## Agent Logs

```
GET /api/agent/{id}/logs
```

Returns the last N log lines from the agent's session log file.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Agent session identifier |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lines` | integer | 100 | Number of log lines, clamped to 1–1000 |

### Response

```json
{
  "logs": ["line 1", "line 2", "..."],
  "source": "primary"
}
```

The `source` field indicates the log origin:

| Source | Description |
|--------|-------------|
| `"primary"` | Read from the agent's primary log file |
| `"previous"` | Read from `previousLogsPath` in session metadata |
| `"none"` | No log file found |

### Path Traversal Protection

When falling back to `previousLogsPath`, the route validates `previousLogsPath.startsWith(sessionsDir)` before reading — preventing directory traversal attacks.

### Project Not Found Fallback

If the agent exists but its project is not found in the config (`config.projects[session.projectId]` is falsy), returns status 200 with:

```json
{ "logs": [], "source": "none", "message": "Project not found in config" }
```

This is distinct from the "no log file found" case which has a different message.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success (may return empty logs) |
| `404` | Agent not found |
| `500` | Internal error |

Source: `packages/web/src/app/api/agent/[id]/logs/route.ts`

## Agent Capacity

```
GET /api/agent/{id}/capacity
```

Returns capacity status for a single agent — workload vs configured max, utilization percentage, and at/near-capacity flags.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Agent session identifier |

### Response

Returns the output of `checkCapacity()` from `@composio/ao-core`. Counts active sessions for this agent to determine current workload, then resolves per-project capacity configuration.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success (returns capacity result or zero-workload result) |
| `404` | Agent not found — `{ "error": "Agent {id} not found" }` |
| `500` | Internal error — `{ "error": "Failed to fetch agent capacity" }` |

Source: `packages/web/src/app/api/agent/[id]/capacity/route.ts`

## Agent Ping

```
GET /api/agent/{id}/ping
```

Liveness check for an agent session.

Note: The `lastActivityAt` field returns the raw session value (`?? null`) without `safeISOString()` wrapping used by the agent detail route. Next.js JSON serialization handles Date objects, but Invalid Date values are not guarded here unlike in the detail endpoint.

### Response

```json
{
  "success": true,
  "agentId": "session-abc",
  "status": "working",
  "lastActivityAt": "2026-04-25T10:05:00.000Z",
  "message": "Agent session-abc is working"
}
```

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `404` | Agent not found |
| `500` | Internal error |

Source: `packages/web/src/app/api/agent/[id]/ping/route.ts`

## Agent Reassign

```
POST /api/agent/{id}/reassign
```

Kills the agent session and returns its story to the queue with boosted priority for reassignment.

### Response

```json
{
  "success": true,
  "agentId": "session-abc",
  "message": "Agent session-abc killed. Story returned to queue for reassignment.",
  "previousStatus": "stuck"
}
```

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `404` | Agent not found |
| `500` | Internal error |

Source: `packages/web/src/app/api/agent/[id]/reassign/route.ts`

## Agent Restart

```
POST /api/agent/{id}/restart
```

Kills and respawns an agent with the same story context. This is a **non-atomic** operation: `kill()` runs first, then `restore()` — a concurrent request between these calls could see the session as missing.

### Response (full success)

```json
{
  "success": true,
  "agentId": "session-def",
  "previousAgentId": "session-abc",
  "previousStatus": "stuck",
  "newStatus": "working",
  "storyId": "PROJ-123",
  "branch": "feature/auth",
  "message": "Agent session-abc restarted as session-def"
}
```

### Response (partial success — kill OK, respawn failed)

```json
{
  "success": false,
  "partial": true,
  "agentId": "session-abc",
  "previousStatus": "stuck",
  "action": "killed",
  "respawnFailed": true,
  "respawnError": "Workspace missing",
  "storyId": "PROJ-123",
  "branch": "feature/auth",
  "message": "Agent session-abc terminated. Respawn failed: Workspace missing. Use CLI: ao spawn --story \"PROJ-123\""
}
```

Partial success returns **207 Multi-Status**. The message includes a CLI command to manually respawn.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Full success (kill + respawn) |
| `207` | Partial success (kill OK, respawn failed) |
| `404` | Agent not found |
| `500` | Kill failed, or internal error |

Source: `packages/web/src/app/api/agent/[id]/restart/route.ts`

## Agent Resume

```
POST /api/agent/{id}/resume
```

Resumes a blocked agent by restoring its session with accumulated context.

### Request Body (optional)

```json
{ "message": "Please continue with the implementation." }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | No | User message sent to the restored session via `sessionManager.send()`. Send failure is non-fatal. |

### Resumable Statuses

Only agents in these statuses can be resumed:

- `blocked`
- `ci_failed`
- `changes_requested`

### Response

```json
{
  "success": true,
  "agentId": "session-abc",
  "previousStatus": "blocked",
  "newStatus": "working",
  "message": "Agent session-abc resumed successfully"
}
```

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `404` | Agent not found |
| `409` | Agent not in resumable status, or `SessionNotRestorableError` |
| `422` | `WorkspaceMissingError` — workspace directory no longer exists |
| `500` | Internal error |

Source: `packages/web/src/app/api/agent/[id]/resume/route.ts`

## Cascade Resume

```
POST /api/agent/cascade/resume
```

Clears the shared cascade detector state so agents can be restarted after a cascade pause.

No path parameters or request body.

### Response

```json
{
  "success": true,
  "previousFailureCount": 5,
  "wasPaused": true,
  "message": "Cascade state cleared. Agents can be resumed."
}
```

### Authentication Note

This endpoint currently has **no authentication**. It affects all agents simultaneously. Gate this endpoint when authentication is implemented.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `500` | Internal error |

Source: `packages/web/src/app/api/agent/cascade/resume/route.ts`

## Pool Capacity

```
GET /api/pool/capacity
```

Returns per-agent capacity results and an aggregate summary across all pool-enabled projects.

### Response (pool configured)

```json
{
  "agents": [
    {
      "agentId": "session-abc",
      "currentWorkload": 2,
      "maxCapacity": 3,
      "utilizationPercent": 66.7,
      "isAtCapacity": false,
      "isNearCapacity": true
    }
  ],
  "summary": {
    "total": 5,
    "atCapacity": 1,
    "nearCapacity": 2,
    "available": 4
  }
}
```

### Response (pool not configured)

```json
{ "enabled": false }
```

Returns `{ "enabled": false }` when no projects have pool configuration. Returns `404` when no projects are configured at all.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `404` | No projects configured |
| `500` | Internal error |

Source: `packages/web/src/app/api/pool/capacity/route.ts`

## Pool Utilization

```
GET /api/pool/utilization
```

Returns pool utilization overview computed from the agent registry and session list.

### Response (pool configured)

Returns the output of `computePoolUtilizationOverview()` from `@composio/ao-core`.

### Response (pool not configured)

```json
{ "enabled": false }
```

Returns `{ "enabled": false }` when pool is not configured. Returns `404` when no projects are configured at all.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `404` | No projects configured |
| `500` | Internal error |

Source: `packages/web/src/app/api/pool/utilization/route.ts`

## Common Patterns

### Force-Dynamic Rendering

8 of 11 agent routes export `dynamic = "force-dynamic"`:

| Route | `force-dynamic` |
|-------|-----------------|
| `agent/{id}` | Yes |
| `agent/{id}/activity` | Yes |
| `agent/{id}/logs` | Yes |
| `agent/{id}/ping` | Yes |
| `agent/{id}/reassign` | Yes |
| `agent/{id}/restart` | Yes |
| `agent/{id}/resume` | Yes |
| `agent/cascade/resume` | Yes |
| `agent/{id}/confidence` | No |
| `agent/{id}/reasoning` | No |
| `agent/{id}/capacity` | No |

### ID Validation

Only `confidence` and `reasoning` validate the `id` parameter against `/^[a-zA-Z0-9_-]+$/`. Other routes perform a direct `sessionManager.get()` lookup and return `404` if not found.

### Non-Atomic Restart

The `restart` route performs sequential `kill()` then `restore()`. A concurrent request between these calls could see the session as missing. Returns `207 Multi-Status` on partial success.

### RESUMABLE_STATUSES

The `resume` route checks against a `Set(["blocked", "ci_failed", "changes_requested"])`. Agents in any other status receive `409`.

### Metadata Allowlist

The agent detail route exposes only 5 safe metadata keys: `agent`, `summary`, `exitCode`, `signal`, `failureReason`. Internal paths, ports, and other sensitive fields are excluded.

### Path Traversal Protection

The `logs` route validates `previousLogsPath.startsWith(sessionsDir)` before reading fallback log files.

### Graceful Empty Responses

- `logs` returns `{ "logs": [], "source": "none" }` when no log file found (also when project not found in config)
- `activity` returns `{ "events": [] }` when no events found
- `confidence` returns default `{ retryCount: 0, errorCategories: [], filesModified: [] }` when no learnings

### Pool Fallback

Both pool routes return `{ "enabled": false }` when no pool-enabled projects are configured, allowing clients to check `enabled` before rendering pool UI.

## Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `207` | Restart partial success (kill OK, respawn failed) |
| `400` | Invalid agent ID format (confidence, reasoning only) |
| `404` | Agent not found, or no projects configured (pool) |
| `409` | Agent not in resumable status, or `SessionNotRestorableError` |
| `422` | `WorkspaceMissingError` — workspace directory deleted |
| `500` | Internal error |

## Key Types

### Agent Detail Response (13 fields)

| Field | Type |
|-------|------|
| `id` | `string` |
| `projectId` | `string` |
| `status` | `SessionStatus` |
| `activity` | `ActivityState \| null` |
| `branch` | `string \| null` |
| `issueId` | `string \| null` |
| `pr` | `{ number: number, url: string, title: string } \| null` |
| `hasWorkspace` | `boolean` |
| `agentInfo` | `AgentInfo \| null` |
| `createdAt` | `string` (ISO 8601) |
| `lastActivityAt` | `string` (ISO 8601) |
| `restoredAt` | `string \| null` (ISO 8601) |
| `metadata` | `AgentMetadata` |

### AgentMetadata (5-key allowlist)

| Field | Type |
|-------|------|
| `agent` | `string \| null` |
| `summary` | `string \| null` |
| `exitCode` | `string \| null` |
| `signal` | `string \| null` |
| `failureReason` | `string \| null` |

### Pool Summary

| Field | Type |
|-------|------|
| `total` | `number` |
| `atCapacity` | `number` |
| `nearCapacity` | `number` |
| `available` | `number` |

---

- **Parent** — [REST API](./)
- **Getting Started** — [Installation](../getting-started/installation/) and [Quick Start](../getting-started/quick-start/)
- **Configuration** — [Configuration Reference](../getting-started/configuration/)
- **Related** — [Sessions API](sessions/), [Sprints API](sprints/), [Events API](events/)
