---
title: Workflow Events & Fleet
nav_order: 7
parent: Web Dashboard
description: Workflow dashboard with role-based widget grid and time travel, event audit trail with SSE real-time updates and JSONL export, fleet monitoring with htop-style matrix, central SSE infrastructure, event publisher/subscriber patterns, and immutable audit logging
---

# Workflow Events & Fleet

Three interconnected dashboard pages provide real-time visibility into workflow state, event history, and fleet status. The workflow dashboard renders role-based widgets from artifact scanning and phase detection. The event audit trail provides filterable paginated access to JSONL event history. The fleet monitoring page tracks active sessions via SSE with a keyboard-navigable matrix view. All three connect to a central SSE endpoint that fans out events from 8+ subsystems.

## Overview

The workflow, events, and fleet pages are three separate routes that share a common SSE infrastructure:

| Page | Route | Rendering | Description |
|------|-------|-----------|-------------|
| **Workflow** | `/workflow` | Server component, `force-dynamic` | Project list from config, delegates to `WorkflowPage` client component |
| **Events** | `/events` | Client component | Event audit trail with filters, pagination, SSE, JSONL export |
| **Fleet** | `/fleet` | Client component | Fleet monitoring with SSE auto-refresh, keyboard-navigable matrix |

**Source files:** `packages/web/src/app/workflow/page.tsx`, `packages/web/src/app/events/page.tsx`, `packages/web/src/app/fleet/page.tsx`

## Workflow Dashboard

The workflow dashboard (`packages/web/src/components/WorkflowPage.tsx`) provides a BMAD workflow visualization for the selected project. It accepts a `projects: string[]` prop from the server component and renders a project selector, SSE subscription, time travel bar, and the main dashboard.

**Key features:**
- **Project selector** — dropdown populated from config; selection syncs to URL via `?project=` query parameter
- **SSE via `useWorkflowSSE`** — subscribes to `workflow-change` events from `/api/events`; silently re-fetches workflow data on change (skipped during time travel)
- **Command palette** — `Cmd+K` / `Ctrl+K` opens a filtered action list (`CommandPalette` component) with navigation and refresh actions
- **Loading skeleton** — shown during initial data fetch
- **Empty state** — `EmptyWorkflowState` renders guidance for non-BMAD projects (no `_bmad/` directory)

### Widget Grid

`WorkflowDashboard` (`packages/web/src/components/WorkflowDashboard.tsx`) renders a role-based widget grid with 10 widgets:

| Widget ID | Description |
|-----------|-------------|
| `phaseBar` | Phase progression bar (analysis → planning → solutioning → implementation) |
| `cascadeAlert` | Cascade detection alert panel |
| `antiPatterns` | Anti-pattern detection nudges |
| `recommendation` | AI-generated phase recommendations |
| `agents` | Agent manifest with focus mode |
| `artifacts` | Classified artifact inventory |
| `lastActivity` | Last modified file indicator |
| `costPanel` | Sprint cost tracking |
| `conflictPanel` | Conflict checkpoint status |
| `chatPanel` | Project chat interface |

**Widget filtering** — widgets are filtered by user role (`useUserRole`) and experience level (`useExperienceLevel`), producing a `layout` via `filterWidgetsByLevel(getWidgetLayout(role), level)`.

**Focus mode** — clicking an agent enters focus mode, showing only that agent's detail. Press `Escape` to exit.

**Grid layout:** `grid-cols-1 md:grid-cols-3`

**Source files:** `packages/web/src/components/WorkflowPage.tsx`, `packages/web/src/components/WorkflowDashboard.tsx`, `packages/web/src/components/CommandPalette.tsx`, `packages/web/src/components/EmptyWorkflowState.tsx`

## Time Travel

The `TimeTravelBar` component (`packages/web/src/components/TimeTravelBar.tsx`) provides historical state reconstruction via a `datetime-local` picker. When a timestamp is selected, the workflow page fetches audit events and replays them to reconstruct state at that point in time.

**Reconstruction process** (`packages/web/src/lib/workflow/time-travel.ts`):

1. Fetch up to 1000 audit events from `/api/audit/events?limit=1000`
2. Sort chronologically (oldest first)
3. Replay events through `reconstructState()`, processing 6 event types:

| Event Type | State Effect |
|------------|-------------|
| `story.started` | Sets story "in-progress", maps agent to story |
| `story.completed` | Sets story "done", removes blockers and agents |
| `story.blocked` | Sets story "blocked", adds to blockers set |
| `story.unblocked` | Sets story "in-progress", removes from blockers |
| `story.assigned` | Maps agent to story |
| `agent.resumed` | Maps agent to story |

4. Stop when event timestamp exceeds the target — return the `HistoricalState`

**`HistoricalState` shape:**

| Field | Type | Description |
|-------|------|-------------|
| `activeStories` | `Record<string, string>` | Story ID → status mapping |
| `activeAgents` | `string[]` | Active agent IDs |
| `blockers` | `string[]` | Blocked story IDs |
| `lastEventAt` | `string \| null` | Timestamp of last processed event |
| `eventsProcessed` | `number` | Count of events replayed |

**`AuditEvent` shape:**

| Field | Type | Description |
|-------|------|-------------|
| `eventId` | `string` | Unique event identifier |
| `eventType` | `string` | Event type (e.g., `story.started`) |
| `timestamp` | `string` | ISO 8601 timestamp |
| `metadata` | `Record<string, unknown>` | Event-specific metadata |

SSE is paused during time travel. The "Return to Present" button clears the timestamp and resumes live updates.

**Source files:** `packages/web/src/components/TimeTravelBar.tsx`, `packages/web/src/lib/workflow/time-travel.ts`

## Event Audit Trail

The `/events` page (`packages/web/src/app/events/page.tsx`) displays a filterable, paginated audit trail of orchestrator events with real-time SSE updates.

**`Event` shape:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique event identifier |
| `type` | `string` | Event type |
| `timestamp` | `string` | ISO 8601 timestamp |
| `data` | `object` | Event payload (`storyId`, `agentId`, `reason`, `status`, etc.) |
| `hash` | `string` | SHA-256 integrity hash |

**4 recognized event types:**

| Type | Badge Color |
|------|------------|
| `story.started` | Blue |
| `story.completed` | Green |
| `story.blocked` | Red |
| `agent.status_changed` | Yellow |

### Filters

`FilterState` supports 6 filters:

| Filter | Description |
|--------|-------------|
| `type` | Exact event type match |
| `storyId` | Filter by story ID |
| `agentId` | Filter by agent ID |
| `search` | Full-text search across event data |
| `dateFrom` | Events after this date (maps to API `since` param) |
| `dateTo` | Events before this date (client-side filter; API does not support `until`) |

### Pagination

- Page size: **100 events** per page
- Pagination controls shown when `total > 100`
- Auto-refresh toggle re-fetches on SSE updates
- **Flash animation** — `useFlashAnimation([events])` triggers a 300 ms `animate-pulse` on the "Load new events" button when new events arrive

### Event Detail Modal

`EventDetailModal` (`packages/web/src/components/EventDetailModal.tsx`) opens on event click, showing:
- Event ID, type, and timestamp
- Data fields (story ID, agent ID, reason)
- **SHA-256 hash** display
- **JSON payload viewer** with copy button
- **Related events** — filtered by matching `storyId` or `agentId`
- **Prev/Next** navigation through related events

### JSONL Export

Export via `GET /api/audit/events/export` downloads up to **10,000 events** as a JSONL file with applied filters.

**Source files:** `packages/web/src/app/events/page.tsx`, `packages/web/src/components/EventDetailModal.tsx`

## Fleet Monitoring

The `/fleet` page (`packages/web/src/app/fleet/page.tsx`) provides real-time fleet monitoring with SSE auto-refresh.

### Fleet Stats

`FleetStats` header shows 4 counts:

| Stat | Description |
|------|-------------|
| `total` | Total agent sessions |
| `active` | Currently active agents |
| `idle` | Idle agents |
| `blocked` | Blocked agents |

### Fleet Matrix

`FleetMatrix` (`packages/web/src/components/FleetMatrix.tsx`) renders an htop-style row-based table with columns:

| Column | Description |
|--------|-------------|
| Agent | Agent display name |
| Story | Assigned story title |
| Status | Current status with color indicator |
| Duration | Time since session start |
| Last Activity | Relative time since last activity |

**Keyboard navigation:**
- `j` / `ArrowDown` — move selection down
- `k` / `ArrowUp` — move selection up
- `Enter` — navigate to session detail (`/sessions/{id}`)

Selection is clamped when sessions change. Input focus is excluded from keyboard handlers.

**Empty state** — when no active agents exist, `FleetMatrix` renders "No active agents" with an `ao spawn` hint in a green `<code>` block.

### SSE Subscriptions

Fleet subscribes to `onAgentStatusChanged` and `onStoryBlocked` via `useSSEConnection`, triggering `fetchData()` on each event. Data fetched from `GET /api/sessions?active=true`.

**Flash animation** — `useFlashAnimation([sessions.length])` triggers a 300 ms blue background flash (`bg-[rgba(59,130,246,0.05)]`) on fleet updates.

### Scroll Preservation

Scroll position is saved to `sessionStorage("fleet-scroll")` on row click and restored on mount via `requestAnimationFrame` for seamless back-navigation.

### Log Stream

`LogStream` (`packages/web/src/components/LogStream.tsx`) provides a live log terminal:
- **Initial load:** 100 lines from `/api/agent/{id}/logs?lines=100`
- **Poll interval:** 2000 ms
- **Auto-scroll** to bottom on new content
- **Copy all** button to clipboard
- Max display height: 400px

**Source files:** `packages/web/src/app/fleet/page.tsx`, `packages/web/src/components/FleetMatrix.tsx`, `packages/web/src/components/LogStream.tsx`

## SSE Infrastructure

The central SSE endpoint (`packages/web/src/app/api/events/route.ts`) provides a single `/api/events` stream that fans out events from 8+ subsystems.

**Connection lifecycle:**
1. Client connects — server sends an **initial session snapshot**
2. **15-second heartbeat** (`: heartbeat\n\n` comments) keeps the connection alive
3. **5-second polling** for session state changes via `sessionManager.list()`

### Subscriptions

The endpoint subscribes to these subsystems:

| Subsystem | Integration Method |
|-----------|-------------------|
| Workflow file changes | `subscribeWorkflowChanges()` |
| Collaboration changes | Collaboration broadcaster |
| Cross-project dependency changes | Dependency change broadcaster |
| Forecast changes | Forecast change broadcaster |
| Risk alerts | Risk alert broadcaster |
| Cascade detection | Cascade detector singleton |
| Resource conflict detection | `detectAndBroadcast()` |
| Utilization snapshot collection | Utilization polling |

### SSE Event Types

| Event Type | Payload |
|------------|---------|
| `snapshot` | `{ id, status, activity, attentionLevel, lastActivityAt }` per session |
| `workflow-change` | Generic file-change signal |
| `workflow.phase` | `{ phase, previousState, newState, timestamp }` |
| `cascade.triggered` | `{ failureCount, timestamp }` |
| `conflict-detected` | `{ conflicts, timestamp }` |
| `forecast-changed` | `{ project, diff, newP50, timestamp }` |
| `forecast-stale` | `{ project, timestamp }` |
| `risk-alert` | `{ alert, timestamp }` |
| `utilization.snapshot` | `{ agentCount, timestamp }` |
| `cross-project-dep-changed` | `{ action, depId, timestamp }` |
| `collaboration.*` | `{ action, data, timestamp }` |

### Connection Status

`ConnectionStatus` (`packages/web/src/components/ConnectionStatus.tsx`) displays the SSE connection state:
- **Connected** — green indicator
- **Disconnected** — red indicator
- **Reconnecting** — amber text "Reconnecting to event stream..."

**Response headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`

**Source file:** `packages/web/src/app/api/events/route.ts`, `packages/web/src/components/ConnectionStatus.tsx`

## SSE Hooks

Nine SSE hooks connect dashboard components to real-time event streams:

### Global Hooks (connect to `/api/events`)

| Hook | Event Types | State | Reconnect |
|------|-------------|-------|-----------|
| `useSSEConnection` | `story.started`, `story.completed`, `story.blocked`, `agent.status_changed`, `cascade.triggered` | `connected`, `reconnecting` | Manual exponential backoff (1 s → 8 s cap) |
| `useWorkflowSSE` | `workflow-change` | Callback only | Manual exponential backoff (1 s → 8 s cap) |
| `useSessionEvents` | `snapshot` | `sessions[]` via `useReducer` | Browser auto-reconnect |
| `useConflictSSE` | `conflict-detected` | Callback only | Browser auto-reconnect |
| `useRiskAlertSSE` | `risk-alert` | `activeAlerts[]`, `acknowledge()` | Browser auto-reconnect |

### Session-Scoped Hooks (per-session endpoints)

| Hook | Event Type | State | Reconnect |
|------|------------|-------|-----------|
| `useTimelineSSE` | `timeline-update` | `timeline[]`, `connected` | Manual exponential backoff |
| `useSessionStateSSE` | `state-update` (named event) | `state`, `exists`, `connected` | Manual exponential backoff |
| `useNotepadSSE` | `notepad-update` | `notepad`, `exists`, `connected` | Manual exponential backoff |
| `useProjectMemorySSE` | `memory-update` (named event) | `memory`, `exists`, `connected` | Manual exponential backoff |

{: .highlight }
`useSessionStateSSE` and `useProjectMemorySSE` use **named SSE events** via `addEventListener` instead of the default `onmessage` handler. This distinction is critical when extending the SSE infrastructure.

### Hook Behaviors

- **`useSSEConnection`** — 6 event handlers (`onStoryStarted`, `onStoryCompleted`, `onStoryBlocked`, `onAgentStatusChanged`, `onCascadeTriggered`, `onReconnected`). Exponential backoff: `Math.min(1000 * 2^attempts, 8000)` ms.
- **`useWorkflowSSE`** — Keeps callback in ref to avoid re-subscribing. Fires callback on reconnect to catch missed changes.
- **`useTimelineSSE`** — REST fetch first (`GET /api/session/{id}/timeline`), then SSE stream (`/api/session/{id}/timeline/stream`).
- **`useSessionStateSSE`** — REST fetch first (`GET /api/session/{id}/state`), then SSE via `addEventListener("state-update", ...)`.
- **`useSessionEvents`** — Uses `useReducer` for efficient patch-based snapshot diffs. Only updates `status`, `activity`, `lastActivityAt` fields.
- **`useConflictSSE`** — Filters on `CONFLICT_SSE_EVENT_TYPE` constant, calls callback with `data.conflicts`.
- **`useNotepadSSE`** — REST fetch first (`GET /api/session/{id}/notepad`), then SSE stream.
- **`useProjectMemorySSE`** — REST fetch first (`GET /api/session/{id}/memory`), then SSE via `addEventListener("memory-update", ...)`.
- **`useRiskAlertSSE`** — Appends incoming alerts to `activeAlerts[]`, provides `acknowledge(alertId)` to dismiss.

**`useFlashAnimation`** — Generic flash hook (300 ms duration). Triggers on dependency array changes.

**Source files:** `packages/web/src/hooks/useSSEConnection.ts` and 8 other hook files in `packages/web/src/hooks/`

## Workflow Watcher

`subscribeWorkflowChanges()` (`packages/web/src/lib/workflow-watcher.ts`) is a singleton file watcher that detects BMAD artifact changes and broadcasts them via SSE.

**Configuration:**
- **Debounce:** 200 ms (`DEBOUNCE_MS = 200`)
- **Watch paths:** 4 BMAD directories

| Path | Filter |
|------|--------|
| `_bmad-output/planning-artifacts` | All files |
| `_bmad-output/research` | All files |
| `_bmad-output/implementation-artifacts` | All files |
| `_bmad/_config` | `agent-manifest.csv` only |

**Behavior:**
- **Lazy initialization** — watchers start only on first subscription
- Uses `node:fs.watch()` with `{ recursive: true }`
- Graceful degradation — missing directories skipped silently, errors logged as warnings
- Auto-cleanup — when `listeners.size === 0`, all watchers close

### Artifact Scanning

`scanAllArtifacts()` (`packages/web/src/lib/workflow/scan-artifacts.ts`) scans BMAD output directories for `.md` files (excluding `.backup`), classifies each by phase via `classifyArtifact()`, and returns `ClassifiedArtifact[]` sorted by `modifiedAt` newest-first.

### Phase Detection

`computePhaseStates()` (`packages/web/src/lib/workflow/compute-state.ts`) implements **downstream inference** (WD-1):

1. Scan right-to-left through `PHASES` to find the last active phase
2. Phases before last active: `"done"` (inferred complete)
3. Last active phase: `"active"` (exactly one)
4. Phases after last active: `"not-started"`
5. If no artifacts exist: all phases are `"not-started"`

Implementation phase can never be `"done"` via artifact detection alone — always `"active"` or `"not-started"`.

**Source files:** `packages/web/src/lib/workflow-watcher.ts`, `packages/web/src/lib/workflow/scan-artifacts.ts`, `packages/web/src/lib/workflow/compute-state.ts`, `packages/web/src/lib/workflow/types.ts`

## Event Publishers & Subscribers

The core engine provides a layered event system with deduplication, retry, and dead letter queues.

### Event Publisher

`EventPublisherImpl` (`packages/core/src/event-publisher.ts`) publishes typed events with resilience:

| Parameter | Default | Description |
|-----------|---------|-------------|
| Deduplication window | 5 seconds | Sliding window keyed on `eventType:storyId` |
| Backup log max size | 10 MB | Rotation keeps most recent half |
| Queue max size | 1000 events | Drops oldest on overflow |
| Flush timeout | 30 seconds | Max wait for queue drain |

**6 event types published:** `story.started`, `story.completed`, `story.blocked`, `story.assigned`, `agent.resumed`, `story.unblocked`

**Degraded mode** — on write failures, enters degraded mode with backup logging. Recovery retry: 3 attempts with `attempt^2 * 1000` ms delays (1 s, 4 s, 9 s).

### Event Subscription

`EventSubscriptionServiceImpl` (`packages/core/src/event-subscription.ts`) provides pattern-based subscription:

| Parameter | Default | Description |
|-----------|---------|-------------|
| Ack timeout | 30 seconds | `DEFAULT_ACK_TIMEOUT_MS = 30000` |
| Retry delays | `[1000, 2000, 4000, 8000, 16000]` | 5 retries with exponential backoff |

**Pattern matching** — exact match or wildcard prefix (e.g., `"story.*"` matches `"story.completed"`).

**Dead letter queue (DLQ)** — events that exceed retry limits enter the DLQ. Supports JSONL persistence and `replayDLQ()` for reprocessing.

### Resilient Event Bus

`createResilientEventBus()` (`packages/core/src/resilient-event-bus.ts`) wraps any `EventBus` with circuit breaker protection:

| Parameter | Default |
|-----------|---------|
| Max retry attempts | 5 |
| Initial backoff | 500 ms |
| Max backoff | 30 seconds |
| Jitter | 10% |

On open circuit and DLQ available, failed operations enqueue `{ operation, payload, failureReason, retryCount }`.

### Event Bus Integration

`createEventBusIntegration()` (`packages/core/src/event-bus-integration.ts`) coordinates triggers and workflows:

| Parameter | Default |
|-----------|---------|
| Debounce | 100 ms |
| Max concurrent workflows | 5 |

**8 subscribed event types:** `story.started`, `story.completed`, `story.blocked`, `story.assigned`, `agent.resumed`, `state.changed`, `conflict.detected`, `conflict.resolved`

`EventFactory` provides helper methods for constructing typed integration events.

**Source files:** `packages/core/src/event-publisher.ts`, `packages/core/src/event-subscription.ts`, `packages/core/src/resilient-event-bus.ts`, `packages/core/src/event-bus-integration.ts`

## Audit Trail

### Audit Trail Service

`AuditTrailImpl` (`packages/core/src/audit-trail.ts`) provides append-only JSONL logging with integrity verification:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxFileSize` | 10 MB | Rotation threshold |
| `maxActiveEvents` | 10,000 | Events kept in active file |
| `bufferSize` | 1,000 | Degraded mode buffer |
| `retryIntervalMs` | 30 seconds | Recovery retry interval |

**Key behaviors:**
- **SHA-256 hashing** — each event hashed on `JSON.stringify(event)`
- **Automatic rotation** — when file exceeds `maxFileSize`, archives older events to dated files
- **Archive index** — tab-separated file tracking archive paths, event counts, and timestamps
- **Degraded mode** — enters on `EROFS` or `EACCES` errors, buffers up to `bufferSize` events
- **Query** — supports `eventType`, `since`, `until`, `grep`, `last`, `first`, `includeArchived`
- **Export** — JSONL or JSON format with optional hash verification
- **Replay** — iterates events, verifies SHA-256 hashes, skips corrupted entries
- **Conflict history** — `queryConflicts(params?)` filters by `conflict.detected`/`conflict.resolved` event types, groups by `conflictId`, pairs detection with resolution events, supports `storyId`, `agentIds`, `since`, `until`, `limit` filters. Returns `ConflictHistoryEntry[]` with `conflictId`, `storyId`, `conflictingAgents`, and optional `resolution` (winner, strategy, timestamp)

### Immutable Audit Log

`ImmutableAuditLog` (`packages/core/src/immutable-audit-log.ts`) provides tamper-proof append-only chain:

- **SHA-256 hash chaining** — each entry includes `previousHash` linking to prior entry's hash
- **Genesis hash:** `"0"` — first entry's `previousHash`
- **Write serialization** — concurrent `append()` calls serialized via promise chaining
- **Chain verification** — `verify()` returns `{ valid, entriesChecked, brokenAt?, error? }`

**`AuditLogEntry` shape:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Entry identifier |
| `timestamp` | `string` | ISO 8601 timestamp |
| `actor` | `string` | Who performed the action |
| `action` | `string` | What was done |
| `target` | `string` | What was affected |
| `beforeState` | `object?` | State before action |
| `afterState` | `object?` | State after action |
| `metadata` | `object?` | Additional context |
| `hash` | `string` | SHA-256 of all fields except `hash` |
| `previousHash` | `string` | Hash of previous entry |

**Source files:** `packages/core/src/audit-trail.ts`, `packages/core/src/immutable-audit-log.ts`

## API Routes

### SSE Stream

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/events` | SSE stream with 15 s heartbeat, 5 s polling, 10+ event types |

**Response:** `text/event-stream` with `Cache-Control: no-cache`, `X-Accel-Buffering: no`

### Audit Events

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/audit/events` | Paginated event query (7 filters, max limit 1000) |
| `GET` | `/api/audit/events/export` | JSONL download (max 10,000 events) |
| `GET` | `/api/audit/immutable` | Immutable audit entries with chain verification |

**`GET /api/audit/events` query params:** `page` (default 1), `limit` (default 100, max 1000), `type`, `storyId`, `agentId`, `search`, `since`

**`GET /api/audit/immutable` query params:** `since`, `limit` (default 100, max 1000), `verify` (`"true"` enables chain verification)

### Workflow

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/workflow/{project}` | Workflow dashboard data with phases, agents, artifacts |

**Response:** `WorkflowResponse` with `projectId`, `projectName`, `hasBmad`, `phases`, `agents`, `recommendation`, `artifacts`, `lastActivity`, `readiness`

### Fleet & Pool

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/sessions?active=true` | Active agent sessions for fleet view |
| `GET` | `/api/pool/capacity` | Pool capacity status per agent |
| `GET` | `/api/pool/utilization` | Pool utilization overview |

## Key Types

| Type | Fields | Description |
|------|--------|-------------|
| `Event` | 5 (`id`, `type`, `timestamp`, `data`, `hash`) | Audit trail event |
| `FilterState` | 6 (`type`, `storyId`, `agentId`, `search`, `dateFrom`, `dateTo`) | Event filter controls |
| `WorkflowResponse` | 9 (`projectId`, `projectName`, `hasBmad`, `phases`, `agents`, `recommendation`, `artifacts`, `lastActivity`, `readiness`) | Workflow API response |
| `PhaseEntry` | 3 (`id`, `label`, `state`) | Phase state entry |
| `AgentInfo` | 5 (`name`, `displayName`, `title`, `icon`, `role`) | Agent metadata |
| `Recommendation` | 6 (`tier`, `observation`, `implication`, `phase`, `reasoning?`, `blockers?`) | AI recommendation |
| `HistoricalState` | 5 (`activeStories`, `activeAgents`, `blockers`, `lastEventAt`, `eventsProcessed`) | Reconstructed state at a point in time |
| `AuditEvent` | 4 (`eventId`, `eventType`, `timestamp`, `metadata`) | Time-travel replay event |
| `FleetStats` | 4 (`total`, `active`, `idle`, `blocked`) | Fleet summary counts |
| `AuditLogEntry` | 10 (`id`, `timestamp`, `actor`, `action`, `target`, `beforeState?`, `afterState?`, `metadata?`, `hash`, `previousHash`) | Immutable audit chain entry |
| `DashboardSession` | Flattened session with `id`, `status`, `activity`, `attentionLevel`, `lastActivityAt`, plus PR/issue/summary fields | Dashboard session representation |
| `TimelineEntry` | `{ agent, agentType, action, event, timestamp, duration?, tool?, file?, success?, model? }` | Sub-agent activity event |
| `WidgetId` | 10 values: `phaseBar`, `cascadeAlert`, `antiPatterns`, `recommendation`, `agents`, `artifacts`, `lastActivity`, `costPanel`, `conflictPanel`, `chatPanel` | Dashboard widget identifiers |
| `Phase` | 4 values: `analysis`, `planning`, `solutioning`, `implementation` | BMAD workflow phases |
| `PhaseState` | 3 values: `not-started`, `done`, `active` | Phase state labels |
| `SSEEventHandlers` | 6 callbacks: `onStoryStarted`, `onStoryCompleted`, `onStoryBlocked`, `onAgentStatusChanged`, `onCascadeTriggered`, `onReconnected` | SSE event handler interface |

**Source files:** `packages/web/src/lib/workflow/types.ts`, `packages/web/src/app/events/page.tsx`, `packages/web/src/app/fleet/page.tsx`, `packages/core/src/audit-trail.ts`, `packages/core/src/immutable-audit-log.ts`

## Next Steps

- [Web Dashboard Overview](index.md) — parent page with navigation and design system
- [Session Detail](session-detail.md) — agent session detail with timeline and log streaming
- [Conflict Resolution](conflict-resolution.md) — conflict detection and policy configuration
- [Risk Management](risk-management.md) — risk scoring, bottlenecks, and optimization
- [Getting Started](../getting-started/) — install and run the dashboard
- [Configuration](../getting-started/configuration.md) — configure projects and plugins
- [Events API](../api/events.md) *(upcoming)* — detailed API reference for events endpoints
