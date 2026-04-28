# Story 62.44: Events API

Status: done

## Story

As a developer integrating with the Agent Orchestrator,
I want a comprehensive Events API documentation page that documents the SSE event stream endpoint, all emitted event types with their JSON schemas, connection lifecycle, subscription mechanisms, polling behavior, and side effects,
so that I can subscribe to real-time dashboard events, understand which event types are available, handle reconnection correctly, and understand the complete real-time event API surface.

## Acceptance Criteria

1. **Events API page** (`docs/api/events.md`) replaces stub with comprehensive content, using Just the Docs front matter: `title: Events API`, `nav_order: 4`, `parent: REST API`, `description` field
2. **Overview section** documents: 1 route file (`route.ts`), 1 HTTP endpoint (`GET /api/events`), SSE-only response (no JSON), `force-dynamic` export — sourced from `packages/web/src/app/api/events/route.ts`
3. **Connection section** documents: SSE connection setup (Content-Type, Cache-Control, Connection, X-Accel-Buffering headers), initial snapshot on connect, empty snapshot fallback when services unavailable — sourced from `route.ts:170-193` and `route.ts:401-408`
4. **Polling & Heartbeat section** documents: 5-second polling interval (`setInterval(..., 5000)`) for session state snapshots, 15-second heartbeat interval (`setInterval(..., 15000)`) sending SSE comment `: heartbeat\n\n`, session snapshot fields (id, status, activity, attentionLevel, lastActivityAt) — sourced from `route.ts:197-204` and `route.ts:207-388`
5. **Snapshot Event section** documents: `type: "snapshot"` emitted on connect and every 5s poll, session array with 5 fields per session (id, status, activity, attentionLevel, lastActivityAt), computed via `sessionToDashboard()` + `getAttentionLevel()`, empty `{ sessions: [] }` on service failure — sourced from `route.ts:177-193` and `route.ts:220-230`
6. **Workflow Events section** documents: `type: "workflow-change"` generic signal on any file change via `subscribeWorkflowChanges()`, `type: "workflow.phase"` phase transition detection comparing current vs previous phase states with fields (phase, previousState, newState, timestamp) — sourced from `route.ts:113-168`
7. **Collaboration Events section** documents: `type: "collaboration.{event.type}"` via `subscribeCollaborationChanges()`, fields (action, data, timestamp), note that collaboration data contains only display-safe fields — sourced from `route.ts:57-70`
8. **Cascade Event section** documents: `type: "cascade.triggered"` when shared cascade detector detects cascade pattern, fields (failureCount, timestamp), uses shared cascade detector accessible by both SSE route and resume endpoint — sourced from `route.ts:239-253`
9. **Cross-Project Dependency Events section** documents: `type: "cross-project-dep-changed"` via `subscribeCrossProjectDepChanges()`, fields (action, depId, timestamp) — sourced from `route.ts:86-96`
10. **Conflict Events section** documents: `type` from `CONFLICT_SSE_EVENT_TYPE` constant via `detectAndBroadcast()`, fields (conflicts array, timestamp), only emitted when new conflicts detected (length > 0) — sourced from `route.ts:256-268`
11. **Forecast Events section** documents: `type: "forecast-changed"` via `subscribeForecastChanges()` with fields (project, diff, newP50, timestamp), `type: "forecast-stale"` when done-story count changes per project with fields (project, timestamp), forecast calibration: marks latest open forecast with actual date when all stories done — sourced from `route.ts:73-83` and `route.ts:271-317`
12. **Risk Alert Events section** documents: `type` from `RISK_ALERT_SSE_EVENT_TYPE` constant via `subscribeRiskAlerts()`, fields (alert, timestamp), iterates over alerts array — sourced from `route.ts:99-111`
13. **Utilization Snapshot Events section** documents: `type: "utilization.snapshot"` when utilization snapshots are recorded, fields (agentCount, timestamp), uses `computeAgentUtilization()` + `getCapacityStatus()` + `collectSnapshot()` + `recordSnapshots()` — sourced from `route.ts:327-386`
14. **Side Effects section** documents: 5 side effects during polling cycle — cascade detection (`cascadeDetector.processSnapshot()`), conflict detection (`detectAndBroadcast()`), forecast calibration (`markForecastActual()`), risk evaluation (`evaluateCachedAndBroadcast()`), utilization snapshot collection — all wrapped in individual try/catch blocks — sourced from `route.ts:239-386`
15. **Cleanup section** documents: `cancel()` callback clears heartbeat + updates intervals, calls 5 unsubscribe functions (unsubWorkflow, unsubCollab, unsubCrossProjectDeps, unsubForecastChanges, unsubRiskAlerts) — sourced from `route.ts:390-398`
16. **Canonical Event Types section** documents: 36 `EventType` union values from `packages/core/src/types.ts` organized by domain (Session lifecycle 7, PR lifecycle 4, CI 4, Reviews 5, Automated reviews 2, Merge 3, Reactions 2, Summary 1, Tracker 2, Agent blocked/resumed 2, Agent capacity 2, Verification gates 2), each with the `OrchestratorEvent` interface shape (id, type, priority, sessionId, projectId, timestamp, message, data) — sourced from `packages/core/src/types.ts:773-833`
17. **SSE Streams Summary section** provides cross-reference to 4 session-level SSE streams documented in Sessions API (state-update, memory-update, notepad-update, timeline-update) with their event types and poll intervals
18. **Common Patterns section** documents: `force-dynamic` export, all errors wrapped in try/catch (non-fatal — polling continues), SSE comment format for heartbeats, `X-Accel-Buffering: no` header, `ReadableStream` + `TextEncoder` pattern, no request validation or authentication
19. **Status Codes section** provides table: 200 (always, even on service failure — empty snapshot fallback)
20. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
21. **Cross-links** verified: parent link to REST API index, sibling links to other API pages, Getting Started, Configuration, Sessions API (for session-level SSE streams)

## Tasks / Subtasks

- [x] Task 1: Write Events API page (AC: #1-21)
  - [x] Replace stub content in docs/api/events.md
  - [x] Write front matter (title, nav_order: 4, parent: REST API, description)
  - [x] Write "Overview" section — 1 route, 1 endpoint, SSE-only (AC #1-2)
  - [x] Write "Connection" section — headers, initial snapshot, fallback (AC #3)
  - [x] Write "Polling & Heartbeat" section — 5s poll, 15s heartbeat, session fields (AC #4)
  - [x] Write "Snapshot Event" section — type, fields, empty fallback (AC #5)
  - [x] Write "Workflow Events" section — workflow-change + workflow.phase (AC #6)
  - [x] Write "Collaboration Events" section — collaboration.{type}, safe fields (AC #7)
  - [x] Write "Cascade Event" section — cascade.triggered, shared detector (AC #8)
  - [x] Write "Cross-Project Dependency Events" section — cross-project-dep-changed (AC #9)
  - [x] Write "Conflict Events" section — CONFLICT_SSE_EVENT_TYPE, detectAndBroadcast (AC #10)
  - [x] Write "Forecast Events" section — forecast-changed + forecast-stale + calibration (AC #11)
  - [x] Write "Risk Alert Events" section — RISK_ALERT_SSE_EVENT_TYPE (AC #12)
  - [x] Write "Utilization Snapshot Events" section — utilization.snapshot (AC #13)
  - [x] Write "Side Effects" section — 5 polling side effects (AC #14)
  - [x] Write "Cleanup" section — cancel callback, 5 unsubscribes (AC #15)
  - [x] Write "Canonical Event Types" section — 36 EventType values by domain (AC #16)
  - [x] Write "SSE Streams Summary" section — cross-reference to Sessions API (AC #17)
  - [x] Write "Common Patterns" section — force-dynamic, error isolation, no auth (AC #18)
  - [x] Write "Status Codes" section — 200 only (AC #19)
  - [x] Write cross-links section (AC #21)
  - [x] Verify all cross-links resolve
  - [x] Verify no hero font classes (AC #20)

## Task Completion Validation

**Task Completion Criteria:**
- All 23 subtasks checked off
- `docs/api/events.md` exists with comprehensive content replacing stub
- Every AC maps to at least one documentation section
- All source file references are accurate
- Cross-links resolve to existing pages
- No hero font classes used
- Canonical EventType count verified against source (36 values)

## Dev Notes

### Architecture Patterns (from Story 62-40/62-41/62-42/62-43 learnings)

- Just the Docs front matter MUST include `description` field (was missing from original stub — current stub lacks it)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- Cross-links: parent link to REST API index, sibling links to each API sub-page
- Each section should name its source file(s) for traceability
- Verify cross-links resolve to existing files
- Route counts must be verified against actual file listings (62-42 had inflated epic filter count)
- Type field counts must match actual TypeScript interfaces (62-41 had miscounted fields)
- Response shape details must match source code exactly (adversarial code review found 12 issues in 62-42)

### Source Tree — Route Inventory (1 file, 1 endpoint)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/events` | GET | SSE stream — real-time dashboard events |

**No nested routes.** No POST/PUT/PATCH/DELETE. Single monolithic SSE endpoint.

### SSE Event Types (11 types from main stream)

| # | `type` field | Trigger | Key Fields |
|---|-------------|---------|------------|
| 1 | `snapshot` | On connect + every 5s poll | `sessions[]` with 5 fields each |
| 2 | `workflow-change` | Workflow file change | None (generic signal) |
| 3 | `workflow.phase` | Phase state transition | `phase, previousState, newState, timestamp` |
| 4 | `collaboration.{type}` | Collaboration pub/sub | `action, data, timestamp` |
| 5 | `cascade.triggered` | Cascade pattern detected | `failureCount, timestamp` |
| 6 | `cross-project-dep-changed` | Cross-project dep change | `action, depId, timestamp` |
| 7 | `conflict-detected` | New resource conflicts | `conflicts[], timestamp` |
| 8 | `forecast-changed` | Forecast update | `project, diff, newP50, timestamp` |
| 9 | `forecast-stale` | Done-story count change | `project, timestamp` |
| 10 | `risk-alert` | Risk alert broadcast | `alert, timestamp` |
| 11 | `utilization.snapshot` | Utilization recorded | `agentCount, timestamp` |

### Canonical EventType (36 values in `packages/core/src/types.ts`)

| Domain | Count | Values |
|--------|-------|--------|
| Session lifecycle | 7 | `session.spawned`, `session.working`, `session.exited`, `session.killed`, `session.stuck`, `session.needs_input`, `session.errored` |
| PR lifecycle | 4 | `pr.created`, `pr.updated`, `pr.merged`, `pr.closed` |
| CI | 4 | `ci.passing`, `ci.failing`, `ci.fix_sent`, `ci.fix_failed` |
| Reviews | 5 | `review.pending`, `review.approved`, `review.changes_requested`, `review.comments_sent`, `review.comments_unresolved` |
| Automated reviews | 2 | `automated_review.found`, `automated_review.fix_sent` |
| Merge | 3 | `merge.ready`, `merge.conflicts`, `merge.completed` |
| Reactions | 2 | `reaction.triggered`, `reaction.escalated` |
| Summary | 1 | `summary.all_complete` |
| Tracker | 2 | `tracker.story_done`, `tracker.sprint_complete` |
| Agent blocked/resumed | 2 | `agent.blocked`, `agent.resumed` |
| Agent capacity | 2 | `agent.capacity_reached`, `agent.capacity_warning` |
| Verification gates | 2 | `verification.passed`, `verification.failed` |
| **Total** | **36** | |

Note: The epic description mentions "33 event types" but the actual `EventType` union contains 36 values. This discrepancy likely arose from 3 additions after the epic was written (agent capacity 2 + verification gates 2 = 4 added, minus 1 that may have been removed/merged). Document the actual count from source.

### Key Behavioral Patterns

- **Single endpoint, multiplexed events**: One long-lived SSE connection carries 11 distinct event types — no separate endpoints per event type
- **5 subscription sources**: workflow changes, collaboration changes, cross-project dependency changes, forecast changes, risk alerts — all registered in `start()` callback
- **Polling-driven**: Session state updates are polled every 5s (not push-based from core) — `sessionManager.list()` called each cycle
- **Side effects during polling**: 5 additional operations execute each poll cycle (cascade, conflict, forecast calibration, risk evaluation, utilization) — all non-fatal, wrapped in individual try/catch
- **Shared cascade detector**: Accessible by both SSE route and cascade resume endpoint (`/api/agent/cascade/resume`)
- **`prevDoneCounts` module-level Map**: Tracks done-story counts per project across poll cycles for forecast-stale detection
- **`prevPhases` per-connection state**: Tracks previous phase states for transition detection
- **Error isolation**: Every side effect and subscription callback has its own try/catch — failures never kill the SSE stream
- **Empty snapshot fallback**: If `getServices()` or `sessionManager.list()` fails, sends `{ type: "snapshot", sessions: [] }` instead of closing the connection
- **No authentication**: No request validation, no auth guards on the SSE endpoint
- **`force-dynamic`**: Route exports `dynamic = "force-dynamic"` to disable Next.js caching

### Event Type Naming Conventions

| System | Convention | Example |
|--------|-----------|---------|
| Canonical `EventType` | `domain.action` (dot.case) | `session.spawned`, `ci.failing` |
| SSE event `type` field | `domain-event` (kebab-case) | `forecast-changed`, `risk-alert` |
| SSE collaboration | `collaboration.{type}` (hybrid) | `collaboration.presence` |
| JSONL audit log | `domain_action` (snake_case) | `story_unblocked`, `agent_completed` |
| Event bus | `domain.action` or `domain.event` | `state.external_update`, `sync.completed` |

### Collaboration Event Sub-types

The collaboration subscription emits events with these sub-types (prefixed as `collaboration.{type}`):

| Sub-type | Actions |
|----------|---------|
| `presence` | update, remove |
| `claim` | claim, unclaim |
| `decision` | log |
| `annotation` | add |
| `ownership` | assign, remove |

### Imports Inventory

#### From `@composio/ao-core`
- `computeAgentUtilization` — function
- `getCapacityStatus` — function

#### From `@composio/ao-plugin-tracker-bmad`
- `readSprintStatus` — function
- `readForecastLog` — function
- `markForecastActual` — function

#### Local `@/lib/*` imports (18 imports)
| Import | Source File |
|--------|-----------|
| `getServices` | `@/lib/services` |
| `sessionToDashboard` | `@/lib/serialize` |
| `getAttentionLevel` | `@/lib/types` |
| `subscribeWorkflowChanges` | `@/lib/workflow-watcher` |
| `subscribeCollaborationChanges` | `@/lib/workflow/collaboration` |
| `getSharedCascadeDetector` | `@/lib/workflow/cascade-detector-shared` |
| `buildPhasePresence`, `scanAllArtifacts` | `@/lib/workflow/scan-artifacts` |
| `computePhaseStates` | `@/lib/workflow/compute-state` |
| `PhaseEntry` (type) | `@/lib/workflow/types` |
| `subscribeCrossProjectDepChanges` | `@/lib/cross-project-dep-events` |
| `detectAndBroadcast` | `@/lib/conflict-broadcaster` |
| `CONFLICT_SSE_EVENT_TYPE` | `@/lib/conflict-sse-constants` |
| `subscribeForecastChanges` | `@/lib/forecast-change-broadcaster` |
| `subscribeRiskAlerts`, `evaluateCachedAndBroadcast` | `@/lib/risk-alert-broadcaster` |
| `RISK_ALERT_SSE_EVENT_TYPE` | `@/lib/risk-alert-sse-constants` |
| `getAlertConfig` | `@/lib/risk-alert-config` |
| `collectSnapshot`, `SnapshotInput` (type) | `@/lib/utilization-snapshot` |
| `recordSnapshots` | `@/lib/utilization-history` |

### Testing Standards

- Verify documentation accuracy against source code (adversarial code review)
- Check SSE event type names match source exactly
- Verify field counts and names in snapshot sessions (5 fields)
- Confirm EventType count matches actual union values (36, not 33)
- Validate polling and heartbeat intervals match source
- Verify all 5 subscription sources documented
- Verify all 5 side effects documented
- Confirm cleanup unsubscribes match subscriptions
- Verify SSE header set matches source
- Confirm error isolation pattern documented

### Project Structure Notes

- Doc file location: `docs/api/events.md`
- Nav order: 4 (fourth child under REST API)
- Parent: REST API (docs/api/index.md)
- Sibling pages: sessions (1), sprints (2), agents (3), portfolio (5), dependencies (6), scenarios (7), conflicts (8), risk (9)
- Current stub references "Story 62.19" — incorrect, this is Story 62-44

### References

- [Source: _bmad-output/planning-artifacts/epics-documentation.md#Story 62.44]
- [Source: packages/web/src/app/api/events/route.ts]
- [Source: packages/core/src/types.ts — EventType (lines 773-821), OrchestratorEvent (lines 824-833)]
- [Source: packages/web/src/lib/workflow/collaboration.ts — collaboration event types]
- [Source: packages/web/src/lib/conflict-sse-constants.ts — CONFLICT_SSE_EVENT_TYPE]
- [Source: packages/web/src/lib/risk-alert-sse-constants.ts — RISK_ALERT_SSE_EVENT_TYPE]

## Change Log

- 2026-04-26: Story created from sprint backlog
- 2026-04-26: Wrote comprehensive Events API documentation covering all 21 ACs — 15+ sections replacing 9-line stub
- 2026-04-26: Adversarial code review — 21 claims verified across 1 route file + 2 type files. Found and fixed 2 issues: 1 MEDIUM (Canonical Event Types group labels "Agent Capacity"/"Pool Capacity" swapped), 1 LOW (forecast-stale first-cycle baseline behavior not documented)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes

- Replaced `docs/api/events.md` stub (9 lines) with comprehensive documentation (~330+ lines)
- All 21 acceptance criteria covered across 15+ sections: Overview, Connection, Polling & Heartbeat, Snapshot Event, Workflow Events, Collaboration Events, Cascade Event, Cross-Project Dependency Events, Conflict Events, Forecast Events (2 types), Risk Alert Events, Utilization Snapshot Events, Side Effects, Cleanup, Canonical Event Types (36 values in 12 domains), SSE Streams Summary, Common Patterns, Status Codes, cross-links
- Front matter includes `description` field (was missing from stub)
- Cross-links: 3 sibling API pages (sessions, agents, sprints), 3 getting-started pages, parent link
- No hero font classes used
- Canonical EventType count: 36 values (epic claimed 33 — documented actual count from source)
- SSE event types: 11 distinct types from main stream, 5 subscription sources
- Snapshot session fields: 5 per session (id, status, activity, attentionLevel, lastActivityAt)
- OrchestratorEvent shape: 8 fields (id, type, priority, sessionId, projectId, timestamp, message, data)
- Side effects: 5 documented (cascade, conflict, forecast calibration, risk, utilization)
- Cleanup: 2 intervals cleared + 5 unsubscribe functions called
- SSE constants verified: CONFLICT_SSE_EVENT_TYPE = "conflict-detected", RISK_ALERT_SSE_EVENT_TYPE = "risk-alert"
- Collaboration sub-types verified: 5 (presence, claim, decision, annotation, ownership)
- Event type naming conventions documented across 4 systems
- Code review fixes: 2 issues (1 MEDIUM, 1 LOW) — corrected Canonical Event Types group labels ("Agent Capacity" → "Agent Blocked/Resumed", "Pool Capacity" → "Agent Capacity"), documented forecast-stale first-cycle baseline behavior

### File List

- `docs/api/events.md` — replaced stub with comprehensive Events API documentation
