# Story 2.3: Dependency Resolution & Story Unblocking

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want dependent stories to automatically become available when their prerequisites complete,
so that agents can pick up newly unblocked work without manual intervention.

## Acceptance Criteria

1. **AC1 — Event-driven dependency check:** When a `story.completed` event fires, the system subscribes to it via EventSubscriptionService and triggers a dependency graph check for all stories that depend on the completed story.

2. **AC2 — Full prerequisite unblocking:** When ALL prerequisites of a dependent story are complete (status `done`), the dependent story's status is updated from `blocked` → `ready-for-dev` in sprint-status.yaml within 5 seconds.

3. **AC3 — Partial prerequisite handling:** When only SOME prerequisites are complete, the dependent story remains `blocked` with a clear audit log entry indicating which dependencies are still outstanding.

4. **AC4 — Diamond dependency support:** The system correctly handles diamond dependencies where story C depends on both A and B. C is only unblocked when BOTH A and B reach `done` status. No partial or premature unblocking.

5. **AC5 — Circular dependency error handling:** If a circular dependency is detected during resolution, the system logs a warning to the JSONL audit trail and does NOT attempt to unblock any story in the cycle. No crash or infinite loop.

6. **AC6 — Event publishing on unblock:** When a story is unblocked, a `story.unblocked` event is published via EventPublisher with `storyId`, `unblockedBy`, and `timestamp`. This enables downstream consumers (notifications, dashboard) to react.

7. **AC7 — Assignment queue integration:** Newly unblocked stories appear in the `getAssignableStories()` list from `assignment-service.ts` on the next call. No manual refresh required.

8. **AC8 — Graceful degradation:** If the event subscription, dependency graph computation, or sprint-status.yaml update fails, the system logs the error and continues without crashing. Dependency resolution is non-fatal — manual intervention remains possible.

9. **AC9 — JSONL audit trail:** All dependency resolution events are logged to the audit trail: `story_unblocked`, `dependency_check_triggered`, `circular_dependency_detected`.

## Tasks / Subtasks

- [x] Task 1: Create DependencyResolverService (AC: #1, #2, #3, #4, #5, #8)
  - [x] 1.1 Create `packages/core/src/dependency-resolver.ts` with factory function `createDependencyResolver()`
  - [x] 1.2 Implement `onStoryCompleted(event)` handler that triggers dependency graph recomputation
  - [x] 1.3 Reuse existing `findDependentStories()` and `areDependenciesSatisfied()` from `completion-handlers.ts` — imported directly
  - [x] 1.4 Handle diamond dependencies: check ALL dependencies, not just the triggering one
  - [x] 1.5 Handle circular dependency detection — implemented DFS in core to avoid cross-plugin coupling (tracker-bmad requires ProjectConfig)
  - [x] 1.6 Wrap all operations in try/catch for graceful degradation
- [x] Task 2: Wire event subscription (AC: #1, #6, #9)
  - [x] 2.1 Subscribe to `story.completed` events via in-memory EventBus in `wire-detection.ts`
  - [x] 2.2 Publish `story.unblocked` events via EventPublisher when stories are unblocked
  - [x] 2.3 Add audit trail logging for all dependency resolution events
- [x] Task 3: Update sprint-status.yaml dependency format (AC: #2, #3, #4)
  - [x] 3.1 Added `story_dependencies` key to avoid conflict with package `dependencies` — all resolvers prefer `story_dependencies` with fallback to `dependencies`
  - [x] 3.2 `updateSprintStatus()` calls change `blocked` → `ready-for-dev`
  - [x] 3.3 StateManager integration available via `updateSprintStatus()` which already supports StateManager param
- [x] Task 4: Integration with assignment service (AC: #7)
  - [x] 4.1 Verified `getAssignableStories()` already filters by dependency status via `resolveDependencies()`
  - [x] 4.2 `resolveDependencies()` updated to use `story_dependencies` key — reads fresh YAML on each call, no cache invalidation needed
- [x] Task 5: Comprehensive tests (AC: #1-#9)
  - [x] 5.1 Unit test: linear dependency chain (A→B→C, A completes → B unblocked, B completes → C unblocked)
  - [x] 5.2 Unit test: diamond dependency (A→C, B→C; A completes → C still blocked; B completes → C unblocked)
  - [x] 5.3 Unit test: circular dependency error handling (A→B→A detected, logged, no crash)
  - [x] 5.4 Unit test: partial prerequisite — only some deps done, story remains blocked
  - [x] 5.5 Unit test: event subscription integration — story.completed fires → dependency check runs
  - [x] 5.6 Unit test: graceful degradation — EventSubscription throws → no crash
  - [x] 5.7 Unit test: audit trail entries written for unblock, check, and circular events

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

If your task has deferred items or known limitations:

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Feature name
   - Status: Deferred - Requires X
   - Requires: Specific requirement
   - Epic: Story Y or Epic number
   - Current: What's currently implemented
```

**In sprint-status.yaml (if applicable), add:**
```yaml
limitations:
  feature-name: "Epic Y - Description or epic number"
```

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] No deferred items — all ACs fully implemented
- [x] File List includes all changed files

## Interface Validation

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags
- [x] No sprint-status.yaml limitations to add

**Methods Used:**
- [x] `EventBus.subscribe()` — used directly in `wire-detection.ts` (simpler than EventSubscriptionService for single-event subscription)
- [x] `EventPublisher.publishStoryCompleted()` — consumed (published by Story 2-2 completion handlers)
- [x] `EventPublisher.publishStoryUnblocked()` — NEW, added to types.ts and event-publisher.ts
- [x] `findDependentStories()` — `core/src/completion-handlers.ts` (now exported)
- [x] `areDependenciesSatisfied()` — `core/src/completion-handlers.ts` (now exported)
- [x] `updateSprintStatus()` — `core/src/completion-handlers.ts`
- [x] `logAuditEvent()` — `core/src/completion-handlers.ts`
- [x] `getAssignableStories()` — `core/src/assignment-service.ts`
- [x] `resolveDependencies()` — `core/src/assignment-service.ts`
- [x] `detectDependencyCycles()` — implemented in core (`dependency-resolver.ts`) to avoid cross-plugin coupling
- [ ] `computeDependencyGraph()` — NOT USED, tracker-bmad version requires ProjectConfig; simpler DFS in core suffices
- [x] `StateManager.update()` — available via `updateSprintStatus()` which passes StateManager through

**Feature Flags:**
- [x] No new feature flags needed — all required interfaces exist or were added

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dev Notes

### Critical Architecture & Implementation Context

**EXISTING CODE TO REUSE — DO NOT REINVENT:**

1. **`completion-handlers.ts` already has dependency unblocking** (lines 226-297):
   - `unblockDependentStories(projectPath, completedStoryId, auditDir, notifier)` — already called from `createCompletionHandler` at line 360
   - `findDependentStories(sprintStatus, completedStoryId)` — finds reverse deps from `dependencies` map
   - `areDependenciesSatisfied(storyId, sprintStatus)` — checks all deps are `done`
   - This code already updates status to `ready-for-dev` and logs audit events
   - **The completion handler already calls `unblockDependentStories()` on every story completion!**

2. **`tracker-bmad/src/dependencies.ts`** (290 lines) — full dependency graph:
   - `computeDependencyGraph(project)` — builds full graph with cycle detection
   - `validateDependencies(storyId, project)` — checks single story
   - `detectDependencyCycles(project)` — DFS-based cycle detection
   - **This module is in the tracker-bmad plugin, not core.** To use it from core, either:
     - Extract the pure graph logic to core (preferred)
     - Or import from plugin (creates coupling — avoid)

3. **`assignment-service.ts`** (line 110-129) — already filters by deps:
   - `resolveDependencies(storyId, sprintData)` — returns `{ resolved, unresolved }`
   - Used in `getAssignableStories()` — stories with unresolved deps are excluded

**KEY INSIGHT: The main gap is NOT dependency resolution logic (it exists). The gap is:**
- The `dependencies` section in sprint-status.yaml needs to be populated with story-level deps (currently only has `chokidar`, `proper-lockfile`, etc. package deps)
- Event-driven subscription to `story.completed` needs to wire to the resolver
- Circular dependency detection needs to use the tracker-bmad graph logic
- `story.unblocked` event type needs to be added to EventPublisher

### sprint-status.yaml Dependencies Format

The existing `unblockDependentStories()` expects this format in sprint-status.yaml:
```yaml
dependencies:
  2-3-dependency-resolution-story-unblocking:
    - 2-2-story-lifecycle-event-types-publishing
  2-4-sprint-burndown-recalculation:
    - 2-2-story-lifecycle-event-types-publishing
  3-1-notification-routing-channel-configuration:
    - 2-2-story-lifecycle-event-types-publishing
```

**Currently**, the `dependencies` key in sprint-status.yaml holds **package** dependencies (chokidar, yaml, etc.), NOT story dependencies. The story dependency data needs to come from the epics file or be added as a separate `story_dependencies` key to avoid conflict.

### Event Types to Add

A new event type `story.unblocked` needs to be added:
```typescript
export interface StoryUnblockedEvent {
  storyId: string;
  unblockedBy: string;  // The completed story that triggered unblocking
  previousStatus: "blocked";
  newStatus: "ready-for-dev";
}
```

Add `publishStoryUnblocked(params: StoryUnblockedEvent): Promise<void>` to the `EventPublisher` interface in `core/src/types.ts`.

### Testing Standards

- Use vitest with `describe`/`it`/`expect`
- Mock sprint-status.yaml with `mkdtempSync` temp directories
- Mock EventSubscriptionService and EventPublisher
- Test circular dependencies with known cycle structures
- Use `Promise.allSettled()` for independent operations (per project-context.md)
- Add `_resetForTesting()` to any new singletons (per project-context.md)

### Non-Fatal Pattern (CRITICAL)

ALL dependency resolution must be wrapped in try/catch. The existing pattern in `completion-handlers.ts` is correct:
```typescript
try {
  await unblockDependentStories(projectPath, event.storyId, auditDir, notifier);
} catch (err) {
  console.error(`[completion-handlers] Dependency unblocking failed:`, err);
  // Continue — dependency resolution is an enhancement, not critical path
}
```

### TypeScript Conventions (from CLAUDE.md)

- ESM modules with `.js` extensions in imports
- `node:` prefix for builtins
- `type` imports for type-only usage
- `execFile` never `exec` for shell commands
- Semicolons, double quotes, 2-space indent

### Project Structure Notes

- New service goes in `packages/core/src/dependency-resolver.ts`
- New tests go in `packages/core/src/__tests__/dependency-resolver.test.ts`
- Types added to `packages/core/src/types.ts`
- Wire into `packages/cli/src/lib/wire-detection.ts`
- Export from `packages/core/src/index.ts`

### References

- [Source: packages/core/src/completion-handlers.ts#unblockDependentStories — existing unblock logic, lines 226-297]
- [Source: packages/core/src/completion-handlers.ts#findDependentStories — reverse dependency lookup, lines 181-198]
- [Source: packages/core/src/completion-handlers.ts#areDependenciesSatisfied — prerequisite check, lines 203-221]
- [Source: packages/core/src/assignment-service.ts#resolveDependencies — assignment-time dep check, lines 110-129]
- [Source: packages/plugins/tracker-bmad/src/dependencies.ts — full dependency graph with cycle detection, 290 lines]
- [Source: packages/core/src/event-subscription.ts — EventSubscriptionService with DLQ, ack, retry, 463 lines]
- [Source: packages/core/src/event-publisher.ts — EventPublisher with deduplication, queue, backpressure]
- [Source: packages/core/src/types.ts#EventPublisher — interface at line 1497]
- [Source: packages/core/src/types.ts#StoryCompletedEvent — event shape at line 1534]
- [Source: packages/cli/src/lib/wire-detection.ts — detection wiring pattern for CLI commands]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3 — requirements FR13]
- [Source: _bmad-output/implementation-artifacts/2-2-story-lifecycle-event-types-publishing.md — previous story context]
- [Source: project-context.md — singleton _resetForTesting(), Promise.allSettled(), non-fatal patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Build: `pnpm build` — all packages pass
- Typecheck: `pnpm typecheck` — all packages pass
- Tests: 1131 passed, 1 skipped (60 test files), including 32 new dependency-resolver tests

### Completion Notes List

- Implemented DFS cycle detection in core rather than importing from tracker-bmad plugin to avoid cross-plugin coupling (tracker-bmad's `detectDependencyCycles` requires full `ProjectConfig`)
- Introduced `story_dependencies` key in sprint-status.yaml to avoid namespace conflict with existing `dependencies` key (which holds package metadata). All resolvers prefer `story_dependencies` with backward-compat fallback to `dependencies`.
- Used direct `EventBus.subscribe()` in wire-detection.ts rather than the heavier `EventSubscriptionService` — for a single event type subscription within the CLI process lifetime, the simpler approach is more appropriate
- `StoryUnblockedEvent` type and `publishStoryUnblocked()` method added to EventPublisher interface (types.ts + event-publisher.ts)
- Exported `findDependentStories()` and `areDependenciesSatisfied()` from completion-handlers.ts (were previously private)

### File List

- `packages/core/src/dependency-resolver.ts` — NEW: DependencyResolverService factory with cycle detection, unblocking, audit logging
- `packages/core/src/__tests__/dependency-resolver.test.ts` — NEW: 32 tests covering all ACs
- `packages/core/src/types.ts` — MODIFIED: added `StoryUnblockedEvent` interface, `publishStoryUnblocked()` to EventPublisher
- `packages/core/src/event-publisher.ts` — MODIFIED: implemented `publishStoryUnblocked()` method
- `packages/core/src/completion-handlers.ts` — MODIFIED: exported `findDependentStories()` and `areDependenciesSatisfied()`, updated to use `story_dependencies` key
- `packages/core/src/assignment-service.ts` — MODIFIED: added `story_dependencies` to SprintStatusData, updated `resolveDependencies()` and `readSprintData()` to use it
- `packages/core/src/index.ts` — MODIFIED: added exports for dependency-resolver module, StoryUnblockedEvent, findDependentStories, areDependenciesSatisfied
- `packages/cli/src/lib/wire-detection.ts` — MODIFIED: wired dependency resolver subscription to story.completed events
- `packages/core/src/__tests__/completion-events.test.ts` — MODIFIED: added `publishStoryUnblocked` to mock EventPublisher
- `packages/cli/__tests__/commands/story-lifecycle-events.test.ts` — MODIFIED: added `publishStoryUnblocked` to mock EventPublisher
- `packages/cli/__tests__/lib/wire-detection-events.test.ts` — MODIFIED: added `publishStoryUnblocked` to mock EventPublisher
