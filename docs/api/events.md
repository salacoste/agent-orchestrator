---
title: Events API
nav_order: 4
parent: REST API
description: Real-time SSE event stream — connection lifecycle, 11 dashboard event types, 36 canonical EventType values, polling, heartbeat, subscriptions, and side effects.
---

# Events API

Real-time event streaming via Server-Sent Events (SSE). A single long-lived connection multiplexes 11 distinct event types for dashboard state updates.

1 route file, 1 HTTP endpoint, SSE-only response (no JSON endpoints).

| Group | Prefix | Routes |
|-------|--------|--------|
| Event Stream | `/api/events` | 1 (GET SSE) |

Source: `packages/web/src/app/api/events/route.ts`

## Connection

```
GET /api/events
```

Opens an SSE stream for real-time dashboard events. No path parameters, no query parameters, no request body.

### Response Headers

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

### Initial Snapshot

On connection, the server immediately sends a `snapshot` event with the current session state. If services are unavailable, an empty snapshot is sent instead — the connection is never rejected.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success (SSE stream opened) |

Always returns 200 with the SSE stream, even when services fail. Errors within the stream are handled gracefully (empty snapshots, skipped poll cycles).

Source: `packages/web/src/app/api/events/route.ts`

## Polling & Heartbeat

The SSE stream uses two intervals:

| Interval | Period | Purpose |
|----------|--------|---------|
| Polling | 5 seconds | Session state snapshots + side effects |
| Heartbeat | 15 seconds | SSE comment `: heartbeat\n\n` to keep connection alive |

The heartbeat is an SSE comment (starts with `:`) and will not trigger `EventSource` message handlers.

Both intervals are cleared when the client disconnects (see [Cleanup](#cleanup)).

Source: `packages/web/src/app/api/events/route.ts:197-204` (heartbeat), `route.ts:207-388` (polling)

## Snapshot Event

```json
{
  "type": "snapshot",
  "sessions": [
    {
      "id": "session-abc",
      "status": "working",
      "activity": "active",
      "attentionLevel": "normal",
      "lastActivityAt": "2026-04-25T10:05:00.000Z"
    }
  ]
}
```

Emitted on connect and every 5-second poll cycle. Each session object contains 5 fields derived from `sessionToDashboard()` with `getAttentionLevel()`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Session identifier |
| `status` | `SessionStatus` | Current session status |
| `activity` | `ActivityState \| null` | Activity state |
| `attentionLevel` | `AttentionLevel` | Computed attention level |
| `lastActivityAt` | `string \| null` | ISO 8601 timestamp |

Falls back to `{ "type": "snapshot", "sessions": [] }` when `getServices()` or `sessionManager.list()` fails.

Source: `packages/web/src/app/api/events/route.ts:170-230`

## Workflow Events

Two event types from workflow file-change subscriptions.

### workflow-change

```json
{ "type": "workflow-change" }
```

Generic signal emitted on any workflow file change via `subscribeWorkflowChanges()`. Contains no additional fields — clients use this as a trigger to refresh workflow state.

### workflow.phase

```json
{
  "type": "workflow.phase",
  "phase": "sprint",
  "previousState": "not-started",
  "newState": "in-progress",
  "timestamp": "2026-04-25T10:05:00.000Z"
}
```

Emitted when a phase state transition is detected. The server compares current phase states (from `scanAllArtifacts()` + `computePhaseStates()`) against the previous cycle's states. Only transitions are emitted — steady-state phases produce no event.

| Field | Type | Description |
|-------|------|-------------|
| `phase` | `string` | Phase identifier |
| `previousState` | `string` | Previous phase state |
| `newState` | `string` | New phase state |
| `timestamp` | `string` | ISO 8601 timestamp |

If `scanAllArtifacts()` fails, typed events are skipped but the generic `workflow-change` signal was already sent.

Source: `packages/web/src/app/api/events/route.ts:113-168`

## Collaboration Events

```json
{
  "type": "collaboration.presence",
  "action": "update",
  "data": { "userId": "user-1", "displayName": "Alice" },
  "timestamp": "2026-04-25T10:05:00.000Z"
}
```

Emitted via `subscribeCollaborationChanges()`. The `type` field is dynamically prefixed: `collaboration.{event.type}`. Collaboration data contains only display-safe fields (userId, displayName, page, itemId, decision text) — no secrets or internal paths.

### Sub-types

| `type` suffix | Actions | Description |
|---------------|---------|-------------|
| `collaboration.presence` | `update`, `remove` | User presence updates |
| `collaboration.claim` | `claim`, `unclaim` | Review claim changes |
| `collaboration.decision` | `log` | Decision log entries |
| `collaboration.annotation` | `add` | Annotation additions |
| `collaboration.ownership` | `assign`, `remove` | Agent ownership changes |

Source: `packages/web/src/lib/workflow/collaboration.ts:246-252`

## Cascade Event

```json
{
  "type": "cascade.triggered",
  "failureCount": 3,
  "timestamp": "2026-04-25T10:05:00.000Z"
}
```

Emitted when the shared cascade detector detects a cascade failure pattern during a poll cycle. The cascade detector is shared between this SSE route and the `POST /api/agent/cascade/resume` endpoint.

| Field | Type | Description |
|-------|------|-------------|
| `failureCount` | `number` | Current failure count in cascade |
| `timestamp` | `string` | ISO 8601 timestamp |

Source: `packages/web/src/app/api/events/route.ts:239-253`

## Cross-Project Dependency Events

```json
{
  "type": "cross-project-dep-changed",
  "action": "created",
  "depId": "dep-123",
  "timestamp": "2026-04-25T10:05:00.000Z"
}
```

Emitted via `subscribeCrossProjectDepChanges()` when a cross-project dependency is created, updated, or removed.

| Field | Type | Description |
|-------|------|-------------|
| `action` | `string` | Change action (e.g., `created`, `updated`, `removed`) |
| `depId` | `string` | Dependency identifier |
| `timestamp` | `string` | ISO 8601 timestamp |

Source: `packages/web/src/app/api/events/route.ts:86-96`

## Conflict Events

```json
{
  "type": "conflict-detected",
  "conflicts": [
    { "resource": "file.ts", "agents": ["session-abc", "session-def"] }
  ],
  "timestamp": "2026-04-25T10:05:00.000Z"
}
```

Emitted during the poll cycle when `detectAndBroadcast()` finds new resource conflicts. Only emitted when `conflicts.length > 0`. The event type string comes from the shared constant `CONFLICT_SSE_EVENT_TYPE` (`"conflict-detected"`).

| Field | Type | Description |
|-------|------|-------------|
| `conflicts` | `array` | Array of detected conflicts |
| `timestamp` | `string` | ISO 8601 timestamp |

Source: `packages/web/src/app/api/events/route.ts:256-268`, `packages/web/src/lib/conflict-sse-constants.ts`

## Forecast Events

Two event types related to sprint forecasting.

### forecast-changed

```json
{
  "type": "forecast-changed",
  "project": "my-project",
  "diff": -2,
  "newP50": "2026-05-01",
  "timestamp": "2026-04-25T10:05:00.000Z"
}
```

Emitted via `subscribeForecastChanges()` when a forecast is recalculated.

| Field | Type | Description |
|-------|------|-------------|
| `project` | `string` | Project identifier |
| `diff` | `number` | Change in forecast days |
| `newP50` | `string` | New P50 completion date |
| `timestamp` | `string` | ISO 8601 timestamp |

### forecast-stale

```json
{
  "type": "forecast-stale",
  "project": "my-project",
  "timestamp": "2026-04-25T10:05:00.000Z"
}
```

Emitted during the poll cycle when the done-story count changes for a project. The server tracks `prevDoneCounts` per project across poll cycles to detect count changes. Note: `prevDoneCounts` starts empty, so the first poll cycle for a project establishes the baseline — no `forecast-stale` event fires until the second poll cycle detects a change.

Additionally, when all stories in a project are done, the server automatically marks the latest open forecast with the actual completion date via `markForecastActual()`.

Source: `packages/web/src/app/api/events/route.ts:73-83` (forecast-changed), `route.ts:271-317` (forecast-stale)

## Risk Alert Events

```json
{
  "type": "risk-alert",
  "alert": { "level": "warning", "message": "Agent utilization above 90%" },
  "timestamp": "2026-04-25T10:05:00.000Z"
}
```

Emitted via `subscribeRiskAlerts()` when risk alerts are broadcast. The event type string comes from the shared constant `RISK_ALERT_SSE_EVENT_TYPE` (`"risk-alert"`). The handler iterates over the alerts array — multiple events may be emitted per broadcast.

| Field | Type | Description |
|-------|------|-------------|
| `alert` | `object` | Risk alert details |
| `timestamp` | `string` | ISO 8601 timestamp |

Source: `packages/web/src/app/api/events/route.ts:99-111`, `packages/web/src/lib/risk-alert-sse-constants.ts`

## Utilization Snapshot Events

```json
{
  "type": "utilization.snapshot",
  "agentCount": 5,
  "timestamp": "2026-04-25T10:05:00.000Z"
}
```

Emitted during the poll cycle when utilization snapshots are recorded. Uses `computeAgentUtilization()` + `getCapacityStatus()` + `collectSnapshot()` + `recordSnapshots()` to compute and persist utilization data per project.

| Field | Type | Description |
|-------|------|-------------|
| `agentCount` | `number` | Number of utilization snapshots recorded |
| `timestamp` | `string` | ISO 8601 timestamp |

Only emitted when `allSnaps.length > 0` (snapshots were actually recorded).

Source: `packages/web/src/app/api/events/route.ts:327-386`

## Side Effects

Beyond emitting SSE events, the 5-second poll cycle executes 5 side effects. Each is wrapped in its own `try/catch` — failures never kill the SSE stream.

| # | Side Effect | Trigger | Source Function |
|---|-------------|---------|-----------------|
| 1 | **Cascade detection** | Every poll cycle | `cascadeDetector.processSnapshot()` |
| 2 | **Conflict detection** | Every poll cycle | `detectAndBroadcast(services.config)` |
| 3 | **Forecast calibration** | All stories done | `markForecastActual()` |
| 4 | **Risk evaluation** | Every poll cycle | `evaluateCachedAndBroadcast(getAlertConfig())` |
| 5 | **Utilization snapshot** | Every poll cycle | `computeAgentUtilization()` + `collectSnapshot()` + `recordSnapshots()` |

Source: `packages/web/src/app/api/events/route.ts:239-386`

## Cleanup

When the client disconnects, the `cancel()` callback:

1. Clears the `heartbeat` interval
2. Clears the `updates` interval
3. Calls 5 unsubscribe functions:
   - `unsubWorkflow()`
   - `unsubCollab()`
   - `unsubCrossProjectDeps()`
   - `unsubForecastChanges()`
   - `unsubRiskAlerts()`

Each subscription is optional (`?.()` called) to handle cases where subscription setup failed before disconnect.

Source: `packages/web/src/app/api/events/route.ts:390-398`

## Canonical Event Types

The `EventType` union type in `packages/core/src/types.ts` defines 36 orchestrator-domain event values used by the `OrchestratorEvent` interface. These are distinct from the SSE event types documented above — they represent the core event model, not the SSE wire format.

### Session Lifecycle (7)

| Type | Description |
|------|-------------|
| `session.spawned` | Agent session created |
| `session.working` | Agent actively working |
| `session.exited` | Agent process exited |
| `session.killed` | Agent session killed |
| `session.stuck` | Agent detected as stuck |
| `session.needs_input` | Agent waiting for user input |
| `session.errored` | Agent encountered an error |

### PR Lifecycle (4)

| Type | Description |
|------|-------------|
| `pr.created` | Pull request created |
| `pr.updated` | Pull request updated |
| `pr.merged` | Pull request merged |
| `pr.closed` | Pull request closed |

### CI (4)

| Type | Description |
|------|-------------|
| `ci.passing` | CI checks passing |
| `ci.failing` | CI checks failing |
| `ci.fix_sent` | Automated fix submitted |
| `ci.fix_failed` | Automated fix failed |

### Reviews (5)

| Type | Description |
|------|-------------|
| `review.pending` | Review requested |
| `review.approved` | Review approved |
| `review.changes_requested` | Changes requested |
| `review.comments_sent` | Automated comments sent |
| `review.comments_unresolved` | Unresolved comments remain |

### Automated Reviews (2)

| Type | Description |
|------|-------------|
| `automated_review.found` | Automated review found issues |
| `automated_review.fix_sent` | Automated review fix sent |

### Merge (3)

| Type | Description |
|------|-------------|
| `merge.ready` | PR ready for merge |
| `merge.conflicts` | Merge conflicts detected |
| `merge.completed` | Merge completed |

### Reactions (2)

| Type | Description |
|------|-------------|
| `reaction.triggered` | Automated reaction triggered |
| `reaction.escalated` | Issue escalated to human |

### Summary (1)

| Type | Description |
|------|-------------|
| `summary.all_complete` | All work items completed |

### Tracker (2)

| Type | Description |
|------|-------------|
| `tracker.story_done` | Story marked done in tracker |
| `tracker.sprint_complete` | Sprint completed in tracker |

### Agent Blocked/Resumed (2)

| Type | Description |
|------|-------------|
| `agent.blocked` | Agent is blocked |
| `agent.resumed` | Agent resumed from blocked state |

### Agent Capacity (2)

| Type | Description |
|------|-------------|
| `agent.capacity_reached` | Agent at maximum capacity |
| `agent.capacity_warning` | Agent approaching capacity |

### Verification Gates (2)

| Type | Description |
|------|-------------|
| `verification.passed` | Story verification passed |
| `verification.failed` | Story verification failed |

### OrchestratorEvent Shape (8 fields)

| Field | Type |
|-------|------|
| `id` | `string` |
| `type` | `EventType` |
| `priority` | `EventPriority` (`"urgent"` \| `"action"` \| `"warning"` \| `"info"`) |
| `sessionId` | `SessionId` |
| `projectId` | `string` |
| `timestamp` | `Date` |
| `message` | `string` |
| `data` | `Record<string, unknown>` |

Source: `packages/core/src/types.ts:773-833`

## SSE Streams Summary

In addition to the main event stream at `GET /api/events`, 4 session-level SSE streams provide per-session detail updates. These are documented in the [Sessions API](sessions/).

| Stream | Endpoint | Event Type | Poll Interval | Change Detection |
|--------|----------|------------|---------------|------------------|
| State | `GET /api/session/{id}/state/stream` | `event: state-update` | 5s | JSON.stringify |
| Memory | `GET /api/session/{id}/memory/stream` | `event: memory-update` | 5s | JSON.stringify |
| Notepad | `GET /api/session/{id}/notepad/stream` | `data:` only | 5s | MD5 hash |
| Timeline | `GET /api/session/{id}/timeline/stream` | `data:` only | 10s | Entry count |

All SSE streams (main + session-level) share common patterns: 15-second heartbeat, `X-Accel-Buffering: no` header, cleanup on client disconnect.

## Common Patterns

### Force-Dynamic Rendering

The route exports `dynamic = "force-dynamic"` to disable Next.js static caching and ISR.

### Error Isolation

Every subscription callback, side effect, and poll-cycle operation has its own `try/catch` block. Failures are silently handled — the SSE stream continues operating even when individual features fail.

### No Authentication

The SSE endpoint has no authentication guards. Any client can connect and receive all dashboard events.

### SSE Comment Heartbeat

Heartbeats use the SSE comment format (`: heartbeat\n\n`) which does not trigger `EventSource` `onmessage` handlers — clients must use `onopen` or a separate timer to detect connection health.

### ReadableStream Pattern

The stream is built using `new ReadableStream()` with a `TextEncoder` for encoding SSE frames. The `start(controller)` callback sets up subscriptions and intervals; the `cancel()` callback handles cleanup.

### Module-Level State

- `prevDoneCounts` — a module-level `Map<string, number>` tracking done-story counts per project for forecast-stale detection across connections
- `prevPhases` — a per-connection variable tracking previous phase states for transition detection

### Event Type Naming

| System | Convention | Example |
|--------|-----------|---------|
| SSE stream events | kebab-case | `forecast-changed`, `risk-alert` |
| Canonical EventType | dot.case | `session.spawned`, `ci.failing` |
| Collaboration SSE | hybrid prefix | `collaboration.presence` |
| JSONL audit log | snake_case | `story_unblocked`, `agent_completed` |

---

- **Parent** — [REST API](./)
- **Getting Started** — [Installation](../getting-started/installation/) and [Quick Start](../getting-started/quick-start/)
- **Configuration** — [Configuration Reference](../getting-started/configuration/)
- **Related** — [Sessions API](sessions/) (session-level SSE streams), [Agents API](agents/), [Sprints API](sprints/)
