---
title: Sessions API
nav_order: 1
parent: REST API
description: Session lifecycle endpoints — list, spawn, kill, restore, send messages, and per-session state, memory, notepad, and timeline with SSE streaming.
---

# Sessions API

Manage agent session lifecycles and access per-session detail data.
16 route files cover CRUD operations, real-time streaming, and session creation.

| Group | Prefix | Routes | Description |
|-------|--------|--------|-------------|
| Session CRUD | `/api/sessions` | 7 | List, get, kill, restore, message, send, issue |
| Session Detail | `/api/session` | 8 | State, memory, notepad, timeline (GET + SSE stream each) |
| Session Spawn | `/api/spawn` | 1 | Create a new session |

Source: `packages/web/src/app/api/sessions/`, `packages/web/src/app/api/session/`, `packages/web/src/app/api/spawn/route.ts`

## List Sessions

```
GET /api/sessions
```

Returns all sessions with aggregated stats.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `active` | string | — | When `"true"`, filters out sessions where `activity === ACTIVITY_STATE.EXITED` (`"exited"`) |

### Response

```json
{
  "sessions": [DashboardSession, ...],
  "stats": {
    "totalSessions": 5,
    "workingSessions": 3,
    "openPRs": 1,
    "needsReview": 0
  },
  "orchestratorId": "session-abc-orchestrator"
}
```

### Behavior

- Orchestrator sessions (IDs ending in `-orchestrator`) are filtered from the `sessions` array but their ID is returned as `orchestratorId`.
- Metadata enrichment (issue labels, agent summaries, issue titles) is capped at **3 seconds** via `Promise.race`.
- PR enrichment via SCM APIs is capped at **4 seconds** via `Promise.race` wrapping `Promise.allSettled`.
- PR data is cached with a **5-minute TTL** (60-minute TTL when rate-limited).

Source: `packages/web/src/app/api/sessions/route.ts`

## Get Session

```
GET /api/sessions/{id}
```

Returns a single session as a `DashboardSession` object (not wrapped).

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Session identifier |

### Response

Returns a `DashboardSession` directly on success. See [Key Types](#key-types) for the full shape.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `404` | Session not found |
| `500` | Internal error |

### PR Enrichment

Uses a two-phase strategy for live PR data:
1. **Cache-only read** — fast, no SCM API calls.
2. **Blocking populate** — if nothing is cached, makes SCM calls once to populate the cache, then future calls are fast.

Source: `packages/web/src/app/api/sessions/[id]/route.ts`

## Spawn Session

```
POST /api/spawn
```

Creates a new agent session.

### Request Body

```json
{
  "projectId": "my-project",
  "issueId": "PROJ-123"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `projectId` | string | Yes | Identifier: `^[a-zA-Z0-9_-]+$`, max 128 chars |
| `issueId` | string | No | Same identifier validation if provided |

### Response

```json
{
  "session": { "id": "session-abc", "projectId": "my-project", "status": "spawning", ... }
}
```

### Status Codes

| Code | Condition |
|------|-----------|
| `201` | Session created |
| `400` | Invalid body or validation failure |
| `500` | Spawn failed |

Source: `packages/web/src/app/api/spawn/route.ts`

## Kill Session

```
POST /api/sessions/{id}/kill
```

Terminates a running session.

### Path Parameters

| Parameter | Type | Validation |
|-----------|------|------------|
| `id` | string | `validateIdentifier`: `^[a-zA-Z0-9_-]+$`, max 128 chars |

### Response

```json
{ "ok": true, "sessionId": "session-abc" }
```

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Session killed |
| `400` | Invalid `id` format |
| `404` | Session not found |
| `500` | Kill failed |

Source: `packages/web/src/app/api/sessions/[id]/kill/route.ts`

## Restore Session

```
POST /api/sessions/{id}/restore
```

Restores a terminated session to active state.

### Response

```json
{
  "ok": true,
  "sessionId": "session-abc",
  "session": { "id": "session-abc", "status": "working", ... }
}
```

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Session restored |
| `400` | Invalid `id` |
| `404` | Session not found |
| `409` | `SessionNotRestorableError` — session is in a non-restorable state (e.g., `"merged"`) |
| `422` | `WorkspaceMissingError` — workspace directory no longer exists |
| `500` | Restore failed |

Source: `packages/web/src/app/api/sessions/[id]/restore/route.ts`

## Send Message

Two endpoints provide message delivery with different paths:

### Via Runtime Plugin (rich path)

```
POST /api/sessions/{id}/message
```

Routes the message through the configured runtime plugin (e.g., tmux). Requires the session to have a `runtimeHandle`.

**Response:** `{ "success": true }`

**Error (400):** `"Session has no runtime handle"` if the runtime handle is missing.

### Via Session Manager (simple path)

```
POST /api/sessions/{id}/send
```

Delegates directly to `sessionManager.send()`. Works regardless of runtime.

**Response:**

```json
{ "ok": true, "sessionId": "session-abc", "message": "sanitized message text" }
```

The sanitized message is echoed back in the response.

### Request Body (shared)

```json
{
  "message": "Hello agent, please continue."
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `message` | string | Yes | Max 10,000 chars. Control characters stripped via `stripControlChars()`. Re-validated after stripping — must not be empty. |

Source: `packages/web/src/app/api/sessions/[id]/message/route.ts`, `packages/web/src/app/api/sessions/[id]/send/route.ts`

## Get Issue

```
GET /api/sessions/{id}/issue
```

Returns issue details linked to a session.

### Response

```json
{
  "id": "PROJ-123",
  "title": "Add user authentication flow",
  "description": "Truncated to 500 characters...",
  "state": "open",
  "labels": ["feature", "auth"],
  "url": "https://github.com/org/repo/issues/123"
}
```

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `404` | Session not found, no issue linked (`"No issue linked"`), no tracker configured (`"No tracker configured"`), or tracker plugin not found |
| `500` | Tracker API call failed |

The description is truncated to **500 characters**. Uses `tracker.issueLabel()` to extract a human-readable identifier (strips `#` prefix from GitHub-style labels).

Source: `packages/web/src/app/api/sessions/[id]/issue/route.ts`

## Session State

### Read State

```
GET /api/session/{id}/state
```

Returns the OMC execution state for a session.

**Response:**

```json
{
  "sessionId": "session-abc",
  "state": { "executionMode": null, "activeAgents": [], "configured": false, ... },
  "exists": true
}
```

Reads from `.omc/state/` in the session's workspace. Best-effort: if the read fails, returns `emptySessionState()` with `exists: false` and `readError: true` — still HTTP 200. On success or missing workspace, `readError` is omitted.

### Stream State Changes

```
GET /api/session/{id}/state/stream
```

SSE stream with `event: state-update`. Sends an initial snapshot, then polls every **5 seconds** using `JSON.stringify` comparison to detect changes. Heartbeat every 15 seconds.

Source: `packages/web/src/app/api/session/[id]/state/route.ts`, `packages/web/src/app/api/session/[id]/state/stream/route.ts`

## Session Memory

### Read Memory

```
GET /api/session/{id}/memory
```

**Response:**

```json
{
  "sessionId": "session-abc",
  "memory": { "entries": [...] },
  "exists": true
}
```

On success or missing workspace, `readError` is omitted. Only included (as `true`) in the error path.

### Write Memory

```
PUT /api/session/{id}/memory
```

**Request Body:**

```json
{
  "entries": [
    { "type": "preference", "content": "Use tabs for indentation" },
    { "type": "decision", "content": "Chose SQLite for local storage" }
  ]
}
```

Each entry must have `type` (non-empty string) and `content` (non-empty string). The response re-reads memory after writing to return fresh state.

### Stream Memory Changes

```
GET /api/session/{id}/memory/stream
```

SSE stream with `event: memory-update`. Polls every 5 seconds, uses `JSON.stringify` comparison.

Source: `packages/web/src/app/api/session/[id]/memory/route.ts`, `packages/web/src/app/api/session/[id]/memory/stream/route.ts`

## Session Notepad

### Read Notepad

```
GET /api/session/{id}/notepad
```

**Response:**

```json
{
  "sessionId": "session-abc",
  "notepad": {
    "priority": "Urgent: fix login bug",
    "working": "Currently refactoring auth module",
    "manual": "Deploy after review approval"
  },
  "exists": true
}
```

`exists` is `true` only when at least one of `priority`, `working`, or `manual` contains non-whitespace content. Reads from `.omc/notepad.md` in the session's workspace.

### Stream Notepad Changes

```
GET /api/session/{id}/notepad/stream
```

SSE stream using `data:` frames (no named event type). Events include `"type": "notepad-update"`. Uses **MD5 hash comparison** for change detection — the only stream route that uses hashing. Polls every 5 seconds.

Source: `packages/web/src/app/api/session/[id]/notepad/route.ts`, `packages/web/src/app/api/session/[id]/notepad/stream/route.ts`

## Session Timeline

### Read Timeline

```
GET /api/session/{id}/timeline
```

Returns agent activity timeline entries with optional filters.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `agent` | string | Case-insensitive substring filter on `entry.agent` |
| `tool` | string | Case-insensitive substring filter on `entry.tool` |
| `from` | number | Minimum `entry.timestamp` in seconds (inclusive) |
| `to` | number | Maximum `entry.timestamp` in seconds (inclusive) |

Filters are AND-combined. `NaN` values for `from`/`to` cause the filter to be skipped.

**Response:**

```json
{
  "sessionId": "session-abc",
  "timeline": [TimelineEntry, ...],
  "totalEntries": 42
}
```

Graceful degradation: read failures return `{ "timeline": [], "totalEntries": 0 }` with HTTP 200.

### Stream Timeline Changes

```
GET /api/session/{id}/timeline/stream
```

SSE stream using `data:` frames. Polls every **10 seconds** (unique among stream routes — others poll at 5s). Uses **entry count comparison** (`entries.length !== lastCount`) for change detection. Events include `"type": "timeline-update"`.

Source: `packages/web/src/app/api/session/[id]/timeline/route.ts`, `packages/web/src/app/api/session/[id]/timeline/stream/route.ts`

## SSE Streams Summary

All four session stream routes share the same architecture (initial snapshot, polling, heartbeat, cleanup on cancel) but differ in change detection:

| Route | Event Type | Poll Interval | Change Detection | Named Event |
|-------|-----------|---------------|-------------------|-------------|
| `state/stream` | `event: state-update` | 5s | `JSON.stringify` comparison | Yes |
| `memory/stream` | `event: memory-update` | 5s | `JSON.stringify` comparison | Yes |
| `notepad/stream` | `data:` only | 5s | MD5 hash comparison | No |
| `timeline/stream` | `data:` only | 10s | Entry count comparison | No |

All use:
- **15-second heartbeat** (`: heartbeat\n\n`)
- **SSE headers**: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`
- **`force-dynamic`** rendering directive
- Interval cleanup on stream cancel

## Key Types

Source: `packages/web/src/lib/types.ts`, `packages/core/src/types.ts`

### DashboardSession (16 fields)

Flattened, JSON-serializable version of the core `Session` for the web UI.

| Field | Type |
|-------|------|
| `id` | `string` |
| `projectId` | `string` |
| `status` | `SessionStatus` |
| `activity` | `ActivityState \| null` |
| `branch` | `string \| null` |
| `issueId` | `string \| null` |
| `issueUrl` | `string \| null` |
| `issueLabel` | `string \| null` |
| `issueTitle` | `string \| null` |
| `summary` | `string \| null` |
| `summaryIsFallback` | `boolean` |
| `createdAt` | `string` (ISO 8601) |
| `lastActivityAt` | `string` (ISO 8601) |
| `pr` | `DashboardPR \| null` |
| `workspacePath` | `string \| null` |
| `metadata` | `Record<string, string>` |

### DashboardStats (4 fields)

| Field | Type |
|-------|------|
| `totalSessions` | `number` |
| `workingSessions` | `number` |
| `openPRs` | `number` |
| `needsReview` | `number` |

### DashboardPR (17 fields)

| Field | Type |
|-------|------|
| `number` | `number` |
| `url` | `string` |
| `title` | `string` |
| `owner` | `string` |
| `repo` | `string` |
| `branch` | `string` |
| `baseBranch` | `string` |
| `isDraft` | `boolean` |
| `state` | `"open" \| "merged" \| "closed"` |
| `additions` | `number` |
| `deletions` | `number` |
| `ciStatus` | `CIStatus` |
| `ciChecks` | `DashboardCICheck[]` |
| `reviewDecision` | `ReviewDecision` |
| `mergeability` | `DashboardMergeability` |
| `unresolvedThreads` | `number` |
| `unresolvedComments` | `DashboardUnresolvedComment[]` |

### Other Types

| Type | Fields | Description |
|------|--------|-------------|
| `DashboardCICheck` | 3 (`name`, `status`, `url?`) | Individual CI check result |
| `DashboardMergeability` | — | Alias for `MergeReadiness` from core |
| `DashboardUnresolvedComment` | 4 (`url`, `path`, `author`, `body`) | Unresolved review comment |
| `SessionSpawnConfig` | 8 (`projectId`, `issueId?`, `branch?`, `prompt?`, `agent?`, `storyContext?`, `priority?`, `modelTier?`) | Spawn configuration |
| `SessionState` | 7 (`executionMode`, `activeAgents`, `configured`, `activeModes`, `health`, `persistentRequeueCount?`, `persistentMaxRetries?`) | OMC execution state |

### String Union Types

**SessionStatus** (18 values):
`spawning`, `working`, `pr_open`, `ci_failed`, `review_pending`, `changes_requested`, `approved`, `mergeable`, `merged`, `cleanup`, `needs_input`, `stuck`, `errored`, `killed`, `done`, `terminated`, `blocked`, `paused`

**ActivityState** (6 values):
`active`, `ready`, `idle`, `waiting_input`, `blocked`, `exited`

**AttentionLevel** (6 values):
`merge`, `respond`, `review`, `pending`, `working`, `done`

---

- **Parent** — [REST API](./)
- **Getting Started** — [Installation](../getting-started/installation/) and [Quick Start](../getting-started/quick-start/)
- **Configuration** — [Configuration Reference](../getting-started/configuration/)
- **Related** — [Sprints API](sprints/), [Agents API](agents/), [Events API](events/)
