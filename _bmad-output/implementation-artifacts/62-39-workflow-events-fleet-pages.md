# Story 62.39: Workflow Events & Fleet Pages

Status: done

## Story

As a developer reading the Agent Orchestrator documentation,
I want a comprehensive Workflow Events & Fleet documentation page that documents the workflow dashboard with role-based widget grid and time travel, the event audit trail with SSE real-time updates and JSONL export, the fleet monitoring dashboard with matrix view, the central SSE infrastructure connecting all real-time features, event publisher/subscriber patterns with dead letter queues, immutable audit logging, workflow watcher and phase detection, and the complete events/fleet/workflow API surface,
so that I can understand how the workflow dashboard renders role-based widgets from artifact scanning and phase detection, how time travel reconstructs historical state from audit events, how the event audit trail provides filterable paginated access to JSONL event history, how fleet monitoring tracks active sessions via SSE with keyboard-navigable matrix view, how the central SSE endpoint fans out events from 8+ subsystems (workflow changes, conflicts, risk alerts, forecasts, utilization, collaboration, cascade, cross-project deps), and how each component connects to backend APIs and core engine modules.

## Acceptance Criteria

1. **Workflow Events & Fleet page** (`docs/web-dashboard/workflow-events-fleet.md`) documents an "Overview" section describing three dashboard pages — Workflow at `/workflow` (server component, `force-dynamic`, project list from config), Events at `/events` (client component, event audit trail), Fleet at `/fleet` (client component, fleet monitoring) — sourced from `packages/web/src/app/workflow/page.tsx`, `packages/web/src/app/events/page.tsx`, `packages/web/src/app/fleet/page.tsx`
2. **Workflow Events & Fleet page** documents a "Workflow Dashboard" section describing `WorkflowPage` client component with project selector, SSE via `useWorkflowSSE` hook subscribing to `workflow-change` events from `/api/events`, `WorkflowDashboard` with role-based widget grid (10 widgets: phaseBar, cascadeAlert, antiPatterns, recommendation, agents, artifacts, lastActivity, costPanel, conflictPanel, chatPanel), widget filtering by user role and experience level, focus mode for single-agent detail, command palette (Cmd+K) with navigation and refresh actions, loading skeleton, empty state for non-BMAD projects, and URL sync via `?project=` query parameter — sourced from `packages/web/src/components/WorkflowPage.tsx`, `packages/web/src/components/WorkflowDashboard.tsx`
3. **Workflow Events & Fleet page** documents a "Time Travel" section describing `TimeTravelBar` component with datetime-local picker, historical state reconstruction via `reconstructState()` replaying audit events (6 event types: story.started, story.completed, story.blocked, story.unblocked, story.assigned, agent.resumed), `HistoricalState` shape (activeStories, activeAgents, blockers, lastEventAt, eventsProcessed), `AuditEvent` shape (eventId, eventType, timestamp, metadata), SSE pausing during time travel, and fetch from `/api/audit/events?limit=1000` — sourced from `packages/web/src/components/TimeTravelBar.tsx`, `packages/web/src/lib/workflow/time-travel.ts`
4. **Workflow Events & Fleet page** documents an "Event Audit Trail" section describing `/events` page with `Event` shape (id, type, timestamp, data, hash), 4 recognized event types (story.started, story.completed, story.blocked, agent.status_changed), `FilterState` with 6 filters (type, storyId, agentId, search, dateFrom, dateTo), pagination controls, auto-refresh toggle, SSE real-time updates via `useSSEConnection` hook, flash animation on new events, JSONL export via `/api/audit/events/export`, `EventDetailModal` with SHA-256 hash display, JSON payload viewer with copy, related events list filtered by storyId/agentId, and prev/next navigation — sourced from `packages/web/src/app/events/page.tsx`, `packages/web/src/components/EventDetailModal.tsx`
5. **Workflow Events & Fleet page** documents a "Fleet Monitoring" section describing `/fleet` page with `FleetStats` header (total, active, idle, blocked), `FleetMatrix` htop-style row-based table (Agent ID, Story, Status, Duration, Last Activity), keyboard navigation (j/k/ArrowUp/ArrowDown/Enter), empty state with `ao spawn` hint, SSE subscriptions for agent status changes and story blocked events via `useSSEConnection`, scroll-position preservation for back-navigation, flash animation on updates, and `LogStream` live log terminal (100-line initial load, 2s poll, auto-scroll, copy-all) — sourced from `packages/web/src/app/fleet/page.tsx`, `packages/web/src/components/FleetMatrix.tsx`, `packages/web/src/components/LogStream.tsx`
6. **Workflow Events & Fleet page** documents a "SSE Infrastructure" section describing the central `/api/events` SSE endpoint with initial session snapshot, 15-second heartbeat, 5-second polling for session state changes, subscriptions to 8+ subsystems (workflow file changes via `subscribeWorkflowChanges`, collaboration changes, cross-project dependency changes, forecast changes, risk alerts, cascade detection, resource conflict detection via `detectAndBroadcast`, utilization snapshot collection), SSE event types emitted (snapshot, workflow-change, workflow.phase, cascade.triggered, conflict-detected, forecast-changed, forecast-stale, risk-alert, utilization.snapshot, cross-project-dep-changed, collaboration.*), and `ConnectionStatus` component — sourced from `packages/web/src/app/api/events/route.ts`, `packages/web/src/components/ConnectionStatus.tsx`
7. **Workflow Events & Fleet page** documents an "SSE Hooks" section describing 9 SSE hooks: `useSSEConnection` (central SSE with 6 event handlers and exponential backoff 1s→8s), `useWorkflowSSE` (workflow-change events with reconnect callback), `useTimelineSSE` (REST initial + SSE from session timeline stream), `useSessionStateSSE` (named-event SSE for state updates), `useSessionEvents` (useReducer for patch-based snapshot diffs), `useConflictSSE` (conflict-detected events), `useNotepadSSE` (notepad REST+SSE), `useProjectMemorySSE` (memory-update named events), `useRiskAlertSSE` (risk-alert events) — sourced from `packages/web/src/hooks/useSSEConnection.ts` and 8 other hook files
8. **Workflow Events & Fleet page** documents a "Workflow Watcher" section describing `subscribeWorkflowChanges()` singleton file watcher with 200ms debounce, watching 4 BMAD directories (`_bmad-output/planning-artifacts`, `_bmad-output/research`, `_bmad-output/implementation-artifacts`, `_bmad/_config/agent-manifest.csv`), lazy initialization, and `scanAllArtifacts()` + `computePhaseStates()` for phase detection with 4 phases (analysis, planning, solutioning, implementation) — sourced from `packages/web/src/lib/workflow-watcher.ts`, `packages/web/src/lib/workflow/scan-artifacts.ts`, `packages/web/src/lib/workflow/compute-state.ts`, `packages/web/src/lib/workflow/types.ts`
9. **Workflow Events & Fleet page** documents an "Event Publishers & Subscribers" section describing `EventPublisherImpl` with typed events (story.started/completed/blocked/assigned, agent.resumed, story.unblocked), 5-second deduplication window, backup log with rotation (10MB max), degraded mode, queue max 1000 events; `EventSubscriptionServiceImpl` with pattern matching (exact + wildcard "story.*"), acknowledgment with 30-second timeout, retry with exponential backoff (1s→16s), dead letter queue with replay; `ResilientEventBus` with circuit breaker protection, 5 retry attempts, 500ms initial backoff, 30s max backoff, 10% jitter, DLQ integration; and `EventBusIntegration` with 100ms debounce, max 5 concurrent workflows, 8 subscribed event types — sourced from `packages/core/src/event-publisher.ts`, `packages/core/src/event-subscription.ts`, `packages/core/src/resilient-event-bus.ts`, `packages/core/src/event-bus-integration.ts`
10. **Workflow Events & Fleet page** documents an "Audit Trail" section describing `AuditTrailImpl` with append-only JSONL logging, SHA-256 integrity, automatic rotation (10MB max), archive management, degraded mode with recovery, query with filters, export, replay with hash verification, and conflict history queries; plus `ImmutableAuditLog` with tamper-proof append-only chain, SHA-256 hash chaining, genesis hash "0", sequential write chain, and chain integrity verification — sourced from `packages/core/src/audit-trail.ts`, `packages/core/src/immutable-audit-log.ts`
11. **Workflow Events & Fleet page** documents an "API Routes" section listing all endpoint groups: `GET /api/events` (SSE stream), `GET /api/audit/events` (paginated query with 7 filters, max limit 1000), `GET /api/audit/events/export` (JSONL download, max 10000), `GET /api/audit/immutable` (immutable audit with chain verification), `GET /api/workflow/{project}` (workflow dashboard data), `GET /api/sessions?active=true` (fleet active sessions), `GET /api/pool/capacity` (pool capacity), `GET /api/pool/utilization` (pool utilization) — with method, purpose, query params, and response shapes
12. **Workflow Events & Fleet page** documents a "Key Types" section listing: `Event` (5 fields), `FilterState` (6 fields), `WorkflowResponse` (9 fields), `PhaseEntry` (3 fields), `AgentInfo` (5 fields), `Recommendation` (6 fields), `HistoricalState` (5 fields), `AuditEvent` (4 fields), `FleetStats` (4 fields), `AuditLogEntry` (shape), `DashboardSession` (shape), `TimelineEntry` (shape), `WidgetId` (10 values), `Phase` (4 values), `PhaseState` (3 values), `SSEEventHandlers` (6 callbacks) — sourced from type files in `packages/web/src/lib/workflow/types.ts`, `packages/web/src/app/events/page.tsx`, `packages/web/src/app/fleet/page.tsx`, `packages/core/src/audit-trail.ts`
13. **Page uses correct Just the Docs front matter**: `title: Workflow Events & Fleet`, `nav_order: 7`, `parent: Web Dashboard`, `description` field
14. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
15. **Cross-links** verified: parent link to Web Dashboard index, sibling links to other Web Dashboard child pages, Events API (62.44), Getting Started, Configuration

## Tasks / Subtasks

- [x] Task 1: Write Workflow Events & Fleet page (AC: #1-15)
  - [x] Replace stub content in docs/web-dashboard/workflow-events-fleet.md
  - [x] Write front matter (title, nav_order: 7, parent: Web Dashboard, description)
  - [x] Write "Overview" section — three pages, server/client components, data loading (AC #1)
  - [x] Write "Workflow Dashboard" section — widget grid, roles, focus mode, command palette, SSE (AC #2)
  - [x] Write "Time Travel" section — reconstruction, event replay, historical state (AC #3)
  - [x] Write "Event Audit Trail" section — filters, pagination, SSE, export, detail modal (AC #4)
  - [x] Write "Fleet Monitoring" section — stats, matrix, keyboard nav, log stream (AC #5)
  - [x] Write "SSE Infrastructure" section — central endpoint, subsystems, event types (AC #6)
  - [x] Write "SSE Hooks" section — 9 hooks with features and patterns (AC #7)
  - [x] Write "Workflow Watcher" section — file watcher, debounce, phase detection (AC #8)
  - [x] Write "Event Publishers & Subscribers" section — publisher, subscription, resilient bus, integration (AC #9)
  - [x] Write "Audit Trail" section — JSONL, integrity, rotation, immutable chain (AC #10)
  - [x] Write "API Routes" section — endpoint groups with method/purpose/params/response (AC #11)
  - [x] Write "Key Types" section — all relevant types with field counts (AC #12)
  - [x] Write "Next Steps" cross-links section (AC #15)
  - [x] Verify all cross-links exist
  - [x] Verify no hero font classes

## Task Completion Validation

**Task Completion Criteria:**
- All 18 subtasks checked off
- `docs/web-dashboard/workflow-events-fleet.md` exists with comprehensive content
- Every AC maps to at least one documentation section
- All source file references are accurate
- Cross-links resolve to existing pages

## Source Files

### Page Routes (Server Components)
- `packages/web/src/app/workflow/page.tsx` — workflow page (server component with force-dynamic)
- `packages/web/src/app/events/page.tsx` — events page (client component)
- `packages/web/src/app/fleet/page.tsx` — fleet page (client component)

### Components
- `packages/web/src/components/WorkflowPage.tsx` — workflow dashboard with project selector, SSE, time travel
- `packages/web/src/components/WorkflowDashboard.tsx` — role-based widget grid with 10 widgets
- `packages/web/src/components/EventDetailModal.tsx` — event detail modal with hash, JSON viewer, related events
- `packages/web/src/components/FleetMatrix.tsx` — htop-style fleet table with keyboard navigation
- `packages/web/src/components/LogStream.tsx` — live agent log streaming terminal
- `packages/web/src/components/TimelineViewer.tsx` — color-coded sub-agent activity timeline
- `packages/web/src/components/ConnectionStatus.tsx` — SSE connection status indicator
- `packages/web/src/components/TimeTravelBar.tsx` — datetime picker for historical state reconstruction
- `packages/web/src/components/EmptyWorkflowState.tsx` — empty state for non-BMAD projects
- `packages/web/src/components/CommandPalette.tsx` — Cmd+K action palette

### API Routes
- `packages/web/src/app/api/events/route.ts` — GET SSE stream endpoint
- `packages/web/src/app/api/audit/events/route.ts` — GET paginated event query
- `packages/web/src/app/api/audit/events/export/route.ts` — GET JSONL export
- `packages/web/src/app/api/audit/immutable/route.ts` — GET immutable audit entries
- `packages/web/src/app/api/workflow/[project]/route.ts` — GET workflow dashboard data
- `packages/web/src/app/api/pool/capacity/route.ts` — GET pool capacity
- `packages/web/src/app/api/pool/utilization/route.ts` — GET pool utilization

### Core Engine (packages/core)
- `packages/core/src/event-publisher.ts` — typed event publisher with dedup, backup, degraded mode
- `packages/core/src/event-subscription.ts` — pattern matching, ack, retry, DLQ
- `packages/core/src/resilient-event-bus.ts` — circuit breaker, retry, DLQ integration
- `packages/core/src/event-bus-integration.ts` — integration layer with debounce and EventFactory
- `packages/core/src/audit-trail.ts` — append-only JSONL with SHA-256, rotation, replay
- `packages/core/src/immutable-audit-log.ts` — tamper-proof hash chain with verification
- `packages/core/src/timeline.ts` — session timeline from replay JSONL
- `packages/core/src/eventbus-backlog-monitor.ts` — queue depth monitoring with alert thresholds

### Web Lib Modules
- `packages/web/src/lib/event-filters.ts` — shared event filtering utility
- `packages/web/src/lib/workflow-watcher.ts` — singleton file watcher with 200ms debounce
- `packages/web/src/lib/workflow/scan-artifacts.ts` — artifact scanning and classification
- `packages/web/src/lib/workflow/compute-state.ts` — phase state computation
- `packages/web/src/lib/workflow/types.ts` — workflow types (Phase, PhaseState, WorkflowResponse, etc.)
- `packages/web/src/lib/workflow/time-travel.ts` — historical state reconstruction
- `packages/web/src/lib/workflow/cascade-detector-shared.ts` — shared cascade detector singleton
- `packages/web/src/lib/workflow/collaboration.ts` — team presence, review claims, decision logging
- `packages/web/src/lib/conflict-sse-constants.ts` — CONFLICT_SSE_EVENT_TYPE constant
- `packages/web/src/lib/conflict-broadcaster.ts` — globalThis singleton pub/sub for conflicts
- `packages/web/src/lib/risk-alert-sse-constants.ts` — RISK_ALERT_SSE_EVENT_TYPE constant
- `packages/web/src/lib/risk-alert-broadcaster.ts` — globalThis singleton pub/sub for risk alerts
- `packages/web/src/lib/cross-project-dep-events.ts` — pub/sub for cross-project dependency changes
- `packages/web/src/lib/forecast-change-broadcaster.ts` — pub/sub for forecast changes

### Hooks
- `packages/web/src/hooks/useSSEConnection.ts` — central SSE connection with 6 event handlers
- `packages/web/src/hooks/useWorkflowSSE.ts` — workflow-change SSE with reconnect
- `packages/web/src/hooks/useTimelineSSE.ts` — timeline REST+SSE
- `packages/web/src/hooks/useSessionStateSSE.ts` — state-update named events
- `packages/web/src/hooks/useSessionEvents.ts` — patch-based snapshot diffs via useReducer
- `packages/web/src/hooks/useConflictSSE.ts` — conflict-detected events
- `packages/web/src/hooks/useNotepadSSE.ts` — notepad REST+SSE
- `packages/web/src/hooks/useProjectMemorySSE.ts` — memory-update named events
- `packages/web/src/hooks/useRiskAlertSSE.ts` — risk-alert events
- `packages/web/src/hooks/useFlashAnimation.ts` — generic flash animation hook (300ms)

## Change Log

- 2026-04-25: Story created from sprint backlog
- 2026-04-25: Wrote comprehensive workflow-events-fleet.md documentation covering all 15 ACs
- 2026-04-25: Adversarial code review — all constants verified against source (15+ thresholds). 6 issues fixed: missing fleet empty state, missing flash animations (events + fleet), missing queryConflicts() in audit trail, DashboardSession/TimelineEntry field shapes, dateTo filter asymmetry note

## Dev Notes

### Architecture Patterns (from Stories 62-36, 62-37, 62-38 learnings)

- Just the Docs front matter MUST include `description` field (was missing from original stubs)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- Cross-links: parent link to Web Dashboard index, sibling links, related advanced topics and API docs
- Each section should name its source file(s) for traceability
- Verify cross-links resolve to existing files; annotate forward references with *(upcoming)*
- Adversarial code review should verify exact constants, thresholds, and type shapes against source code

### Source Tree Components

- 3 UI page routes under `packages/web/src/app/` (workflow, events, fleet)
- 10 UI components under `packages/web/src/components/` (WorkflowPage, WorkflowDashboard, EventDetailModal, FleetMatrix, LogStream, TimelineViewer, ConnectionStatus, TimeTravelBar, EmptyWorkflowState, CommandPalette)
- 7 API route files under `packages/web/src/app/api/` (events, audit, workflow, pool)
- 14 web lib modules under `packages/web/src/lib/` (event-filters, workflow-watcher, workflow/*, conflict-*, risk-alert-*, cross-project-dep-events, forecast-change-broadcaster)
- 8 core engine modules under `packages/core/src/` (event-publisher, event-subscription, resilient-event-bus, event-bus-integration, audit-trail, immutable-audit-log, timeline, eventbus-backlog-monitor)
- 10 hooks under `packages/web/src/hooks/` (9 SSE hooks + useFlashAnimation)

### Testing Standards

- Verify documentation accuracy against source code (adversarial code review)
- Check all type field counts match actual TypeScript interfaces
- Verify API endpoint parameters and response shapes match route implementations
- Confirm SSE event type names match source constants
- Verify workflow phases (analysis, planning, solutioning, implementation) match PHASES constant
- Confirm widget IDs match WIDGET_META registry
- Check event publisher dedup window (5s), backup max size (10MB), queue max (1000)
- Confirm audit trail rotation threshold (10MB max file size)
- Verify subscription retry delays match DEFAULT_RETRY_DELAYS array
- Confirm SSE heartbeat interval (15s) and poll interval (5s)

### Project Structure Notes

- Doc file location: `docs/web-dashboard/workflow-events-fleet.md`
- Nav order: 7 (after Risk Management at nav_order: 6)
- Sibling pages: index.md (0), portfolio-view.md (1), sprint-board.md (2), session-detail.md (3), scenario-comparison.md (4), conflict-resolution.md (5), risk-management.md (6)

### Key Constants to Verify

- SSE heartbeat: 15 seconds
- SSE poll interval: 5 seconds
- Workflow watcher debounce: 200ms
- Event publisher dedup window: 5 seconds
- Event publisher backup max: 10MB
- Event publisher queue max: 1000 events
- Subscription ack timeout: 30 seconds
- Subscription retry delays: [1000, 2000, 4000, 8000, 16000]
- Resilient bus retry attempts: 5, initial backoff: 500ms, max backoff: 30s, jitter: 10%
- Integration debounce: 100ms, max concurrent workflows: 5
- Audit trail max file size: 10MB, max active events: 10000, buffer size: 1000
- LogStream poll interval: 2000ms, initial lines: 100
- Flash animation duration: 300ms
- Workflow phases: analysis, planning, solutioning, implementation
- Widget count: 10

### References

- [Source: _bmad-output/planning-artifacts/epics-documentation.md#Story 62.39]
- [Source: packages/web/src/app/workflow/page.tsx]
- [Source: packages/web/src/app/events/page.tsx]
- [Source: packages/web/src/app/fleet/page.tsx]
- [Source: packages/web/src/components/WorkflowPage.tsx]
- [Source: packages/web/src/components/WorkflowDashboard.tsx]
- [Source: packages/web/src/app/api/events/route.ts]
- [Source: packages/core/src/event-publisher.ts]
- [Source: packages/core/src/audit-trail.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes

- Wrote `docs/web-dashboard/workflow-events-fleet.md` replacing stub with comprehensive documentation
- All 15 acceptance criteria covered across 13 documentation sections
- Documented 3 page routes, 7 API endpoints, 10 components, 8 core engine modules, 9 SSE hooks, 6 web lib modules
- Front matter includes `description` field (was missing from stub)
- Cross-links: 7 sibling pages verified, getting-started and configuration verified, api/events.md is forward reference annotated *(upcoming)*
- No hero font classes used
- All constants verified against source: SSE heartbeat (15s), poll (5s), watcher debounce (200ms), dedup (5s), backup max (10MB), queue max (1000), ack timeout (30s), retry delays [1000,2000,4000,8000,16000], resilient bus (5 attempts, 500ms initial, 30s max, 10% jitter), integration debounce (100ms), max concurrent (5), audit trail max file (10MB), max events (10000), buffer (1000), LogStream poll (2000ms), initial lines (100), flash (300ms), genesis hash ("0")
- Source analysis from 3 parallel subagents provided exhaustive coverage of 48+ files

### File List

- `docs/web-dashboard/workflow-events-fleet.md` — replaced stub with comprehensive documentation
