# Story 51.5: Dependency Blocking Notifications

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **to be notified when cross-project dependencies are blocking progress**,
so that **I can coordinate with other project teams to resolve blockers**.

## Acceptance Criteria

1. **Given** a story is blocked by a cross-project dependency for more than a configurable threshold (default 1 hour)
   **When** the blocking period threshold is reached
   **Then** I receive a notification identifying the blocked story and the blocking dependency
   **And** the notification includes the source project, source story, target project, target story, and blocking duration

2. **Given** a notification for a blocked cross-project dependency is displayed
   **When** I view the notification
   **Then** it includes a link or reference to the blocking project's context (project name, dashboard URL path)
   **And** it identifies the blocking story so I can coordinate with that project team

3. **Given** multiple cross-project dependencies are blocking progress simultaneously
   **When** blocking notifications are generated
   **Then** each blocking dependency produces a separate notification
   **And** notifications are deduplicated within a configurable window (default 30 minutes) to prevent spam

4. **Given** a cross-project dependency has been notified about
   **When** the blocking dependency is resolved (target story completes)
   **Then** no further blocking notifications are emitted for that dependency
   **And** the blocking start time record is cleared

5. **Given** the CrossProjectGraphView is displayed (from Story 51.4)
   **When** a cross-project dependency status changes
   **Then** the graph updates automatically via SSE within 3 seconds
   **And** blocking dependencies are visually distinguished from resolved ones

6. **Given** no cross-project dependencies are blocking
   **When** the blocking status endpoint is queried
   **Then** an empty list is returned with no errors

## Tasks / Subtasks

- [x] Task 1: Core blocking notification types and pure functions (AC: #1, #3, #4)
  - [x] 1.1: Define `BlockingStartTimeMap` type
  - [x] 1.2: Define `DependencyBlockingAlert` type
  - [x] 1.3: Implement `computeBlockingStartTimes(deps, sprintDataMap, currentTimes, now): BlockingStartTimeMap`
  - [x] 1.4: Implement `getBlockingAlerts(deps, sprintDataMap, blockingStartTimes, thresholdMs, projectNames?): DependencyBlockingAlert[]`
  - [x] 1.5: Implement `formatDurationLabel(ms): string`
  - [x] 1.6: Export new types and functions from `packages/core/src/index.ts`
  - [x] 1.7: Add unit tests in `packages/core/src/__tests__/cross-project-deps.test.ts`

- [x] Task 2: Blocking start time persistence (AC: #1, #4)
  - [x] 2.1: Create `packages/core/src/cross-project-blocking-times.ts`
  - [x] 2.2: Implement `BlockingTimesStore` class
  - [x] 2.3: Persist to `cross-project-blocking-times.yaml`
  - [x] 2.4: Add unit tests

- [x] Task 3: Event bus integration for dependency blocking (AC: #1, #3)
  - [x] 3.1: Add `"dependency.blocking"` to notification trigger map
  - [x] 3.2: Add `"dependency.blocking"` to DEFAULT_DEDUP_WINDOWS
  - [x] 3.3: Create `packages/core/src/cross-project-blocking-notifier.ts`
  - [x] 3.4: Implement `checkAndNotifyBlockingDeps`
  - [x] 3.5: Event payload with correct shape
  - [x] 3.6: Add unit tests

- [x] Task 4: API endpoint for blocking status (AC: #1, #2, #6)
  - [x] 4.1: Create blocking-status route
  - [x] 4.2: Fetch deps, build SprintDataMap, compute alerts
  - [x] 4.3: Return correct response shape
  - [x] 4.4: Accept threshold query param (minimum 1ms to prevent alert storms)
  - [x] 4.5: Add route tests

- [x] Task 5: SSE updates for cross-project graph (AC: #5, deferred from Story 51.4)
  - [x] 5.1: Add SSE event for cross-project dep changes
  - [x] 5.2: Emit SSE events from POST/DELETE routes
  - [x] 5.3: Blocking status route emits SSE events
  - [x] 5.4: PortfolioView subscribes to SSE events
  - [x] 5.5: Manual refresh kept as fallback

- [x] Task 6: Write comprehensive tests (AC: #1-6)
  - [x] 6.1: Core unit tests
  - [x] 6.2: Blocking times store tests
  - [x] 6.3: Blocking notifier tests
  - [x] 6.4: API route tests
  - [x] 6.5: Integration test coverage
  - [x] 6.6: Full test suite passing (2072 core + 668 CLI tests)

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- Deferred items explicitly documented (see "Deferred Items Tracking" below)
- No hidden TODOs or FIXMEs in completed tasks
- Documentation updated (Dev Notes, File List)

**Deferred Items Tracking:**

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Circular dependency detection
   - Status: Deferred - Story 51.6 (Circular Dependency Detection)
   - Requires: Cross-project cycle detection algorithm
   - Epic: Story 51.6
   - Current: No circular dependency detection in blocking notifications
2. Email/Telegram notification channels for dependency blocking
   - Status: Deferred - Future enhancement (Epic 57 Telegram integration)
   - Requires: Telegram bot integration (Epic 57)
   - Epic: Epic 57
   - Current: Notifications via existing channels (desktop, composio) only
3. Configurable per-project blocking thresholds
   - Status: Deferred - Future enhancement
   - Requires: Per-project notification config in YAML
   - Current: Single global threshold (default 1 hour)
```

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags

**Methods Used:**
- `CrossProjectDepStore.list()` — List all cross-project dependencies
- `resolveAllDependencyStatuses(deps, sprintDataMap)` — Enrich deps with target status
- `buildSprintDataMap(config)` — Build SprintDataMap across all projects
- `getBlockedCrossProjectDeps(deps, sprintDataMap)` — Get deps where target NOT done
- `EventBus.publish(event)` — Publish dependency blocking events
- `NotificationServiceImpl` — Automatic event-to-notification routing via trigger map

**Feature Flags:**
- None required — uses existing notification routing infrastructure

## Dependency Review

**For stories that add new dependencies:**

No new external dependencies required. Uses existing:
- Vitest for testing
- `yaml` package (already approved, v2.8.2) for blocking times persistence
- Existing event bus and notification service infrastructure

## CLI Integration Testing (if applicable)

Not applicable — this story does not add or modify CLI commands.

## Dev Notes

### Architecture Context

This is **Story 5 of 6** in **Epic 51: Cross-Project Dependencies**. It depends on:
- **Story 51.1 (done):** Cross-Project Dependency Definition — types, persistence, validation, API, search
- **Story 51.2 (done):** Dependency Status Tracking — `DependencyWithStatus`, `resolveDependencyStatus`, `areCrossProjectDepsSatisfied`, `getBlockedCrossProjectDeps`, SprintDataMap
- **Story 51.3 (done):** Automatic Story Unblocking — `findCrossProjectDependents`, `autoUnblockCrossProjectDeps`
- **Story 51.4 (done):** Cross-Project Dependency Graph — `buildCrossProjectGraph`, `CrossProjectGraphView`, manual refresh (SSE deferred to this story)

This story adds **time-based blocking notifications** for cross-project dependencies and **SSE auto-refresh** for the dependency graph (deferred from Story 51.4).

Story 51.6 (Circular Dependency Detection) builds on the same infrastructure.

### Previous Story Intelligence (51.4: Cross-Project Dependency Graph)

Key patterns and learnings to carry forward:
- **Pure function pattern**: All data transformation is in pure sync functions (e.g., `buildCrossProjectGraph`). Continue this pattern — blocking logic should be pure functions in `cross-project-deps.ts`
- **`buildSprintDataMap` shared utility**: Use from `@/lib/sprint-data-map.ts` for all SprintDataMap construction
- **`vi.hoisted()` for mocks**: Use `vi.hoisted()` for shared mock objects in test files
- **Best-effort error handling**: Wrap cross-project operations in try/catch — blocking checks should be non-fatal
- **`createCrossProjectDepStore(config.configPath)`**: Standard way to get store instance in API routes
- **Manual refresh deferred**: Story 51.4 explicitly deferred SSE auto-refresh to this story (Story 51.5)
- **`STATUS_FILL` shared palette**: Use from `@/lib/status-colors.ts` for consistent status colors

### Notification System Architecture

The codebase has a mature two-layer notification system:

**Layer 1: Event Bus (pub/sub)**
- `EventBus.publish(event)` — publishes events
- `EventBus.subscribe(callback)` — receives events
- `ResilientEventBus` — wraps with circuit breaker + retry + DLQ

**Layer 2: Notification Service (event-to-notification routing)**
- `NotificationServiceImpl` subscribes to event bus in constructor
- Trigger map (`DEFAULT_TRIGGER_MAP`) maps event types to notification priority and title
- Existing blocked-related triggers: `agent.blocked` → critical, `story.blocked` → critical
- Per-type dedup windows prevent spam (e.g., `agent.blocked` → 5 min)

**Integration Pattern to Follow:**
The `ConflictNotificationIntegration` (`conflict-notification.ts`) is the closest existing pattern — it subscribes to `conflict.detected`/`conflict.resolved` events with configurable severity filtering and channel routing. Follow this pattern for dependency blocking.

**For this story:**
- Add `"dependency.blocking"` to `DEFAULT_TRIGGER_MAP` with priority `"warning"` (not critical — dependency blocking is important but not as urgent as agent crashes)
- Add to `DEFAULT_DEDUP_WINDOWS` with 30-minute window (longer than agent.blocked because dep blocking changes slowly)
- Emit events via `eventBus.publish()` — the NotificationService automatically routes based on trigger map

### Blocking Duration Tracking Design

**Why track blocking start times?**
The AC requires notifying when a dep has been blocking for MORE than 1 hour. This means we need to know WHEN each dep first became blocking. Simple approach:

1. **`BlockingStartTimeMap`**: `Record<depId, ISO_timestamp>` — persisted to `cross-project-blocking-times.yaml`
2. **`computeBlockingStartTimes()`**: Pure function that takes current deps + sprint data + existing times → returns updated map
   - If a dep is blocking (target NOT done) and already has a start time → keep it
   - If a dep is blocking but has NO start time → add current timestamp
   - If a dep is resolved (target IS done) → remove from map
3. **`getBlockingAlerts()`**: Pure function that filters deps where `(now - startTime) > threshold`
4. **`formatDurationLabel()`**: Human-readable duration (e.g., "1h 30m", "2d 5h")

**Persistence strategy**: Simple YAML file alongside config. Same pattern as `cross-project-deps.yaml`. File: `cross-project-blocking-times.yaml` with structure:
```yaml
blockingStartTimes:
  dep-abc123: "2026-03-30T10:00:00.000Z"
  dep-xyz789: "2026-03-29T14:30:00.000Z"
```

### Event Payload Design

When a blocking notification fires, the event should include:
```typescript
{
  type: "dependency.blocking",
  priority: "warning",
  timestamp: new Date().toISOString(),
  data: {
    depId: string,
    sourceProjectId: string,    // The project with the blocked story
    sourceStoryId: string,      // The blocked story
    targetProjectId: string,    // The project with the blocking story
    targetStoryId: string,      // The blocking (prerequisite) story
    blockingDurationMs: number,
    blockingDurationLabel: string, // "2h 30m"
    sourceProjectName: string,  // For notification readability
    targetProjectName: string   // "Contact the {targetProjectName} team"
  }
}
```

### SSE Integration for Graph (Deferred from 51.4)

Story 51.4 left a manual refresh button on `CrossProjectGraphView`. This story wires SSE:
1. Define SSE event type `cross-project-dep-changed`
2. Emit from POST/DELETE dep routes after successful operation
3. Emit from blocking-status endpoint when blocking state changes
4. `CrossProjectGraphView` subscribes via existing SSE infrastructure and re-fetches graph data

### Key Design Decisions

**Warning priority (not critical):**
Dependency blocking is important but typically less urgent than agent crashes or merge conflicts. Use `"warning"` priority so it routes to composio by default but doesn't trigger desktop notifications unless the user configures warning → desktop routing.

**30-minute dedup window:**
Cross-project dependency blocking changes slowly. A 30-minute dedup prevents spam while ensuring the user gets notified reasonably soon after the threshold is exceeded.

**Pure function separation:**
All blocking logic (compute times, get alerts, format durations) is in pure functions. The persistence layer and event emission are thin wrappers. This makes testing straightforward.

**Simple YAML persistence:**
Following the established pattern from `cross-project-deps.yaml`, blocking start times are stored in a simple YAML file. No database, no complex state management.

### File Structure to Create/Modify

```
packages/core/src/
├── cross-project-deps.ts                          # MODIFY: Add blocking types and pure functions
├── cross-project-blocking-times.ts                # NEW: BlockingTimesStore for YAML persistence
├── cross-project-blocking-notifier.ts             # NEW: Event bus integration for blocking checks
├── notification-service.ts                        # MODIFY: Add dependency.blocking to trigger map + dedup windows
├── index.ts                                       # MODIFY: Export new types and functions
└── __tests__/
    ├── cross-project-deps.test.ts                 # MODIFY: Add blocking notification tests
    └── cross-project-blocking-notifier.test.ts    # NEW: Blocking notifier tests

packages/web/src/
├── app/api/dependencies/cross-project/
│   ├── blocking-status/
│   │   └── route.ts                               # NEW: GET /api/dependencies/cross-project/blocking-status
│   │   └── route.test.ts                          # NEW: API route tests
│   ├── route.ts                                   # MODIFY: Emit SSE event after POST/DELETE
│   └── graph/route.ts                             # MODIFY: (no changes needed, SSE from route.ts)
├── components/
│   └── CrossProjectGraphView.tsx                  # MODIFY: Add SSE subscription for auto-refresh
```

### Testing Strategy

**Core tests (cross-project-deps.test.ts):**
- `computeBlockingStartTimes` — new blocking deps get timestamp, existing blocking deps keep timestamp, resolved deps removed, empty deps → empty map
- `getBlockingAlerts` — below threshold filtered out, above threshold returned with correct duration, project names resolved, empty blocking times → no alerts
- `formatDurationLabel` — minutes only, hours+minutes, days+hours, sub-minute → "<1m"

**Blocking times store tests (new file):**
- Load nonexistent file → empty map
- Save and reload roundtrip
- Refresh computes new start times and clears resolved

**Blocking notifier tests (new file):**
- `checkAndNotifyBlockingDeps` emits events for threshold-exceeded deps
- Deduplicates within 30-min window (no re-emit for same dep)
- Skips resolved deps
- Skips deps below threshold

**API route tests (blocking-status/route.test.ts):**
- Returns alerts for blocked deps
- Returns empty for no deps
- Handles threshold query param override
- Handles missing blocking times file gracefully

**Component tests (CrossProjectGraphView.test.tsx update):**
- SSE subscription triggers re-fetch
- Graph updates when SSE event received

### NFRs

- **NFR-F3-1:** Blocking status check completes within 1 second (pure functions + YAML read)
- **NFR-P1:** Notification delivered within 5 seconds of threshold check
- **NFR-R3:** Blocking time tracking recovers from partial failures (best-effort persistence)

### Accessibility

- Blocking alert notifications follow existing notification accessibility patterns
- SSE graph updates are non-disruptive (no focus stealing)
- Duration labels are human-readable text

### References

- [Source: epics-cycle-10.md#Story 51.5] — Requirements and acceptance criteria
- [Source: prd-cycle-10.md#FR-F3-5] — Users receive notifications when cross-project dependencies are blocking progress
- [Source: packages/core/src/cross-project-deps.ts] — All existing types and functions (CrossProjectDependency, DependencyWithStatus, getBlockedCrossProjectDeps, etc.)
- [Source: packages/core/src/notification-service.ts] — DEFAULT_TRIGGER_MAP, DEFAULT_DEDUP_WINDOWS, NotificationServiceImpl
- [Source: packages/core/src/conflict-notification.ts] — ConflictNotificationIntegration pattern (subscribe + filter + notify)
- [Source: packages/core/src/types.ts] — EventBus, NotificationPlugin, NotificationService interfaces
- [Source: packages/web/src/lib/sprint-data-map.ts] — buildSprintDataMap utility
- [Source: packages/web/src/components/CrossProjectGraphView.tsx] — Graph component needing SSE integration
- [Source: _bmad-output/implementation-artifacts/51-4-cross-project-dependency-graph.md] — Previous story with SSE deferred

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- All existing tests must continue to pass (no regressions)
- New pure functions follow same pattern as Stories 51.1-51.4
- New event type follows existing trigger map pattern
- Blocking times YAML follows same pattern as cross-project-deps YAML

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250514)

### Debug Log References

### Completion Notes List

1. All 6 tasks implemented and passing
2. Adversarial code review completed — 23 issues found (7 HIGH, 10 MEDIUM, 6 LOW)
3. All issues fixed:
   - H2/H3: YAML load now validates each value is a string, handles null/array/missing key
   - H4: threshold=0 rejected (minimum 1) to prevent alert storms
   - H5: Added architectural note about single-instance pub/sub limitation
   - H6: Strengthened test assertions with full field validation
   - M1/M2: Added console.warn in catch blocks for publish/load failures
   - L2: formatDurationLabel now handles NaN and negative inputs gracefully
   - Added threshold=0 test case to route tests
   - Added YAML edge case tests (non-string values, null, array, missing key)
   - Added threshold variation test with custom threshold
   - Added unchanged-times optimization test
   - Added mixed threshold test (only exceeded deps published)
   - Added store.refresh call argument verification
4. Full test suite passes: 2072 core tests, 668 CLI tests, all plugin/web tests

### File List

- packages/core/src/cross-project-deps.ts — Added blocking types, computeBlockingStartTimes, getBlockingAlerts, formatDurationLabel, DEFAULT_BLOCKING_THRESHOLD_MS
- packages/core/src/cross-project-blocking-times.ts — NEW: BlockingTimesFileStore for YAML persistence
- packages/core/src/cross-project-blocking-notifier.ts — NEW: Event bus integration for blocking notifications
- packages/core/src/notification-service.ts — Added dependency.blocking to trigger map and dedup windows
- packages/core/src/index.ts — Exported all new types and functions
- packages/web/src/lib/cross-project-dep-events.ts — NEW: In-memory pub/sub for SSE integration
- packages/web/src/app/api/dependencies/cross-project/blocking-status/route.ts — NEW: GET endpoint for blocking status
- packages/web/src/app/api/dependencies/cross-project/route.ts — Added SSE notifications for POST/DELETE
- packages/web/src/app/api/events/route.ts — Added cross-project dep SSE subscriber
- packages/web/src/components/PortfolioView.tsx — Added cross-project-dep-changed SSE handling
- packages/core/src/__tests__/cross-project-deps.test.ts — Blocking notification unit tests
- packages/core/src/__tests__/cross-project-blocking-times.test.ts — NEW: Store persistence tests
- packages/core/src/__tests__/cross-project-blocking-notifier.test.ts — NEW: Notifier tests
- packages/web/src/app/api/dependencies/cross-project/blocking-status/route.test.ts — NEW: API route tests
