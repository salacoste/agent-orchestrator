# Epic 2 Retrospective: Real-Time Sprint State Sync

**Date:** 2026-03-16
**Facilitator:** Bob (Scrum Master)
**Participant:** R2d2
**Epic Status:** DONE (5/5 stories complete)

## Epic Summary

Epic 2 delivered the real-time state synchronization backbone: bidirectional YAML sync, event-driven story lifecycle publishing, dependency resolution with auto-unblocking, sprint burndown calculation, and state conflict reconciliation with escalation. All 5 stories completed with code reviews, all tests passing, lint/typecheck clean.

| Story | Title | Agent | Tests |
|-------|-------|-------|-------|
| 2-1 | BMAD Tracker Bidirectional Sync Bridge | Claude Opus 4.6 | 32 |
| 2-2 | Story Lifecycle Event Types & Publishing | Claude Opus 4.6 | 21 |
| 2-3 | Dependency Resolution & Story Unblocking | Claude Opus 4.6 | 32 |
| 2-4 | Sprint Burndown Recalculation | Claude Opus 4.6 | 29 |
| 2-5 | State Conflict Reconciliation | Claude Opus 4.6 | 14 |

**Total new tests:** 128 across 12 test files.

## What Went Well

1. **Consistent factory function pattern** — Every story used the same `createServiceName(config)` factory pattern. Story 2-1 established it with `createSyncBridge()`, and Stories 2-3, 2-4, 2-5 replicated it exactly (`createDependencyResolver`, `createBurndownService`, `createStateConflictReconciler`). New services slot in predictably.

2. **Non-fatal wiring pattern proved robust** — All event-driven services (EventPublisher, SyncBridge, DependencyResolver, BurndownService, StateConflictReconciler) are wrapped in try/catch in `wire-detection.ts`. This means any service can fail to initialize without blocking the core CLI workflow. The pattern from Epic 1 (Story 1-3) scaled cleanly across 5 new services.

3. **Code reuse across stories** — Each story built on predecessors without rework:
   - Story 2-1 created SyncBridge + BMADTracker adapter + StateManager wiring
   - Story 2-2 wired EventPublisher into all lifecycle flows, completed deferred Task 3.2 from 2-1
   - Story 2-3 reused `findDependentStories()` and `areDependenciesSatisfied()` from completion-handlers.ts
   - Story 2-4 copied the exact event subscription pattern from 2-3's DependencyResolver
   - Story 2-5 followed the exact same factory/wiring/test pattern from 2-4

4. **Code reviews found real issues** — Not just style nits:
   - 2-4: Module-level `EMPTY_RESULT` constant with stale `lastUpdated` timestamp → replaced with `emptyResult()` factory function
   - 2-4: Unused `auditDir` config field → removed
   - 2-4: Missing "behind" and "on-pace" test scenarios → added
   - 2-5: Dead event subscription (`state.conflict_unresolved` vs actual `story.blocked`) → fixed to correct event type
   - 2-5: Test mock didn't match `NotificationService` interface (`getQueue` vs `getStatus`) → fixed
   - 2-5: Stale conflict object in retry loop → changed `const` to `let` with refresh

5. **Deferred items tracked explicitly per story** — Each story has a "Limitations (Deferred Items)" section with Status, Requires, Epic, and Current fields. This made cross-story planning and retrospective analysis straightforward.

6. **Sprint-status reader consolidation concern from Epic 1 retro was addressed** — Story 2-1 made BMADTracker adapter the canonical bridge between flat YAML format and structured StoryState. CLI commands continue using flat reads by design, not by oversight.

7. **Progressive complexity ramp** — Story 2-1 (High complexity, foundational wiring) → 2-2 (Medium, event publishing) → 2-3 (Medium, dependency graphs) → 2-4 (Low, burndown calculation) → 2-5 (Medium, conflict orchestration). The hardest work was front-loaded.

## What Could Improve

1. **Event type naming mismatch between AuditTrail and EventBus** — Story 2-5's AC3 specified publishing `state.conflict_unresolved` to EventBus, but `publishStoryBlocked()` actually emits `story.blocked`. The AC was ambiguous — the wire-detection subscription listened for the wrong event type. Caught in code review, but could have been prevented by explicit event-type mapping in story specs.

2. **Test mock interface drift** — Story 2-5 used `getQueue`, `getDeadLetterQueue`, `getStats` for `NotificationService` mock, but the actual interface has `getStatus`, `getDLQ`, `retryDLQ`. The `as unknown as` cast masked this at compile time. Pattern: when mocking interfaces behind type casts, cross-check against actual interface definitions.

3. **wire-detection.ts growing into a god-wiring function** — This single function now creates and wires: EventBus, CompletionDetector, SyncBridge, EventPublisher, DependencyResolver, BurndownService, StateConflictReconciler, plus all their event subscriptions. It's becoming hard to reason about initialization order and cleanup sequence.

4. **CLI integration tests still deferred** — Carried from Epic 1, still unaddressed. All testing is unit-level with mocks. No end-to-end CLI test validates the actual wiring works when `ao spawn --story` runs.

5. **Types co-location decision inconsistent** — Stories 2-1 and 2-2 added types to `types.ts` (StoryUnblockedEvent, publishStoryUnblocked). Stories 2-4 and 2-5 co-located types in service files (BurndownData, ReconcileResult). The rule "co-locate unless shared across 3+ files" is reasonable but wasn't established until Story 2-4.

6. **story_dependencies namespace workaround** — Story 2-3 discovered sprint-status.yaml's `dependencies` key held package deps (chokidar, yaml), not story deps. Added `story_dependencies` as parallel key with fallback. This works but adds cognitive overhead and a dual-key lookup pattern.

## Patterns Established

| Pattern | Introduced In | Used By |
|---------|--------------|---------|
| `createServiceName(config)` factory pattern | 2-1 (SyncBridge) | 2-3, 2-4, 2-5 |
| Non-fatal wiring in try/catch blocks | 1-3 → scaled in 2-2 | 2-3, 2-4, 2-5, all future services |
| `EventBus.subscribe()` for CLI-lifetime event handling | 2-2 | 2-3, 2-4, 2-5 |
| Types co-located in service files | 2-4 (BurndownService) | 2-5 |
| `story_dependencies` key in sprint-status.yaml | 2-3 | 2-4, future dependency consumers |
| Service registry (`getEventPublisher()`) for loose coupling | 2-2 | spawn, assign, resume commands |
| BMADTracker adapter (flat ↔ structured conversion) | 2-1 | SyncBridge, SyncService consumers |
| Deferred items with Status/Requires/Epic/Current fields | 2-1 | all stories |
| `emptyResult()` factory instead of module-level constants | 2-4 code review | 2-5 |

## Epic 1 Retrospective Action Items — Resolution Status

| # | Action Item | Status | Resolution |
|---|-------------|--------|------------|
| 1 | HIGH: Refactor `assign.ts` to use shared `story-context.ts` utilities | Done | Completed in pre-Epic-2 tech debt cycle |
| 2 | MEDIUM: Block "done" if `{{` template placeholders remain | Done | Workflow validation added |
| 3 | LOW: Backfill Story 1-4 Dev Agent Record | Done | Completed in retro action items cycle |

All 3 action items from Epic 1 retrospective were resolved before/during Epic 2.

## Deferred Items Carried Forward

| Item | Deferred From | Target |
|------|--------------|--------|
| CLI commands StateManager migration | 2-1 | Tech debt story |
| Persistent background sync (daemon) | 2-1 | Epic 4 |
| Structured YAML format migration | 2-1 | Future cycle |
| CLI integration tests (createTempEnv) | Epic 1, all stories | Tech debt story |
| Web API burndown endpoint | 2-4 | Story 7-3 |
| CLI burndown command (`ao burndown`) | 2-4 | Story 5-2 |
| History-based daily burndown (time series) | 2-4 | Future enhancement |
| SyncService direct reconciler integration | 2-5 | Epic 4 |
| wire-detection.ts decomposition | organic growth | Tech debt |

## Technical Concerns for Epic 3

1. **NotificationService interface completeness.** Epic 3 (Push Notifications) will build heavily on NotificationService. The current interface (`send`, `getStatus`, `getDLQ`, `retryDLQ`, `close`) needs to support routing rules, digest batching, and channel configuration. Story 3-1 should validate the interface covers all Epic 3 needs before implementation begins.

2. **wire-detection.ts complexity.** Adding notification triggers (Story 3-2) and dedup/digest logic (Story 3-3) to the already-crowded wireDetection function will make it harder to maintain. Consider extracting service-group initializers (e.g., `wireNotificationServices()`) before or during Epic 3.

3. **Event type proliferation.** Epic 2 added `story.completed`, `story.started`, `story.blocked`, `story.assigned`, `story.unblocked`, `agent.resumed`. Epic 3 will add notification-trigger events (`agent.blocked`, `conflict.detected`, `agent.offline`, `eventbus.backlog`, `queue.depth.exceeded`). Some overlap exists (e.g., `story.blocked` vs `agent.blocked`). Story 3-2 should establish clear event taxonomy.

4. **In-memory vs persistent event handling.** Epic 2's EventBus is in-memory (CLI-lifetime). Epic 3's notification deduplication (Story 3-3, sliding window 5-30 min) needs state that outlives individual CLI invocations. This may force the Redis/persistent-store question that's been deferred since Epic 1.

5. **Existing notifier plugins.** Desktop, Slack, Composio, and Webhook notifier plugins exist in `packages/plugins/notifier-*/`. Story 3-1 needs to audit these implementations to ensure they match the routing expectations.

## Action Items

| # | Priority | Action | Target |
|---|----------|--------|--------|
| 1 | HIGH | Extract `wireDetection()` into composable service-group initializers (e.g., `wireEventServices()`, `wireSyncServices()`, `wireMonitoringServices()`) to manage growing complexity before Epic 3 adds notification wiring | Pre-Epic-3 tech debt |
| 2 | MEDIUM | Establish event type taxonomy document — map all existing event types, their publishers, subscribers, and intended semantics to prevent future naming collisions (e.g., `story.blocked` vs `agent.blocked`) | Story 3-2 prerequisite |
| 3 | MEDIUM | Add interface mock validation pattern — when test mocks use `as unknown as T`, add compile-time checks (e.g., `satisfies Partial<T>`) to catch interface drift without runtime failures | Testing standard |
| 4 | LOW | Audit notifier plugins (desktop, slack, composio, webhook) for Epic 3 readiness — verify they implement the full `Notifier` interface and handle the notification payload shape | Story 3-1 prerequisite |
