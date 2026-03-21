# Story 2.2: Story Lifecycle Event Types & Publishing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want the system to publish events when stories are created, started, completed, or blocked,
so that other services can subscribe and react to state changes in real-time.

## Acceptance Criteria

1. Story lifecycle events published: `story.completed`, `story.started`, `story.blocked`, `story.assigned`, `agent.resumed` — wired into actual story state-change flows (completion handlers, spawn, assign, resume commands)
2. Events published via existing `EventPublisher` class (`core/src/event-publisher.ts`) with correct typed parameters (`StoryCompletedEvent`, `StoryStartedEvent`, `StoryBlockedEvent`, `StoryAssignedEvent`, `AgentResumedEvent`)
3. Event deduplication prevents redundant processing — already implemented in `EventPublisher` (5s dedup window), verify it works end-to-end
4. Events persisted to JSONL backup log before publish acknowledgment — already implemented in `EventPublisher.queueEvent()`, verify wiring
5. `wireDetection()` creates `EventPublisher` and wires it into completion/failure handlers — also creates SyncBridge (deferred Task 3.2 from Story 2-1)
6. `story.started` event published when agent is spawned for a story via `spawn --story`
7. `story.blocked` event published when failure handler detects agent crash/timeout
8. `story.completed` event published when completion handler detects agent success
9. `story.assigned` event published when `ao assign` or `ao assign-next` assigns an agent to a story

## Tasks / Subtasks

- [x] Task 1: Wire EventPublisher creation into wireDetection + SyncBridge (AC: #2, #5)
  - [x] 1.1 In `packages/cli/src/lib/wire-detection.ts`: create `EventPublisher` instance using the existing in-memory `EventBus`. Config: `{ eventBus, deduplicationWindowMs: 5000, backupLogPath: join(sessionsDir, ".audit", "events.jsonl") }`. Use `createEventPublisher()` factory from `@composio/ao-core`.
  - [x] 1.2 Create `SyncBridge` (deferred from Story 2-1 Task 3.2): import `createSyncBridge`, `createBMADTrackerAdapter` and wire them. Use the same in-memory `EventBus`. Register the StateManager via `registerStateManager()` from `story-context.ts`. Clear on cleanup via `clearStateManager()`.
  - [x] 1.3 Pass `stateManager` (from SyncBridge) to `createCompletionHandler()` and `createFailureHandler()` as the 7th parameter (already supported since Story 2-1).
  - [x] 1.4 Add `eventPublisher.close()` and `syncBridge.close()` to the `cleanup()` function in wireDetection. Maintain reverse teardown order: eventPublisher → syncBridge → blockedDetector → eventBus.
  - [x] 1.5 All wireDetection setup wrapped in try/catch — non-fatal pattern. If EventPublisher or SyncBridge creation fails, fall back to existing behavior (no events published, no StateManager routing).

- [x] Task 2: Publish story.completed and story.blocked events from completion/failure handlers (AC: #7, #8)
  - [x] 2.1 In `packages/core/src/completion-handlers.ts`: modify `createCompletionHandler()` to accept an optional `eventPublisher?: EventPublisher` parameter (8th parameter, after `stateManager`).
  - [x] 2.2 Inside completion handler: after `updateSprintStatus()`, call `eventPublisher.publishStoryCompleted({ storyId, previousStatus: "in-progress", newStatus: "done", agentId, duration })` — wrapped in try/catch (non-fatal).
  - [x] 2.3 Modify `createFailureHandler()` to accept optional `eventPublisher?: EventPublisher` parameter.
  - [x] 2.4 Inside failure handler: after `updateSprintStatus()`, call `eventPublisher.publishStoryBlocked({ storyId, agentId, reason, exitCode, signal })` — wrapped in try/catch. Skip for `disconnected` reason (same as sprint status skip).
  - [x] 2.5 In `wire-detection.ts`: pass `eventPublisher` to both `createCompletionHandler()` and `createFailureHandler()`.

- [x] Task 3: Publish story.started event from spawn flow (AC: #6)
  - [x] 3.1 In `packages/cli/src/commands/spawn-story.ts` and `spawn.ts`: after agent session is spawned and registered, call `eventPublisher.publishStoryStarted({ storyId, agentId: sessionId, contextHash })` and `eventPublisher.publishStoryAssigned({ storyId, agentId, reason: "auto" })`. Use `getEventPublisher()` from service registry.
  - [x] 3.2 Wrapped in try/catch — non-fatal. Missing EventPublisher means no event published, not a crash.

- [x] Task 4: Publish story.assigned event from assign/assign-next commands (AC: #9)
  - [x] 4.1 In `packages/cli/src/commands/assign.ts`: after successful assignment, call `eventPublisher.publishStoryAssigned({ storyId, agentId, reason: "manual" })`. Use `getEventPublisher()` from service registry.
  - [x] 4.2 In `packages/cli/src/commands/assign-next.ts`: after successful auto-assignment, call `eventPublisher.publishStoryAssigned({ storyId, agentId, reason: "auto" })`.
  - [x] 4.3 Wrapped in try/catch — non-fatal.

- [x] Task 5: Write tests (AC: #1-#9)
  - [x] 5.1 Created `packages/core/src/__tests__/completion-events.test.ts`: tests verifying `publishStoryCompleted()` is called on completion and `publishStoryBlocked()` is called on failure when `eventPublisher` is provided. Verify non-fatal (event publish failure doesn't block handler).
  - [x] 5.2 Created `packages/cli/__tests__/lib/wire-detection-events.test.ts`: tests that wireDetection creates EventPublisher and SyncBridge, passes them to handlers. Tests graceful degradation when SyncBridge creation fails.
  - [x] 5.3 Existing `packages/core/__tests__/event-publisher.test.ts` tests are comprehensive — no changes needed.
  - [x] 5.4 Created `packages/cli/__tests__/commands/story-lifecycle-events.test.ts`: tests event shape validation, non-fatal pattern, and event ordering for spawn and resume flows. 12 tests covering story.started, story.assigned, agent.resumed publishing.

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
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags
- [x] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- [x] `EventPublisher.publishStoryCompleted(params)` — [Source: packages/core/src/types.ts:1507] — implemented in EventPublisherImpl
- [x] `EventPublisher.publishStoryStarted(params)` — [Source: packages/core/src/types.ts:1510] — implemented in EventPublisherImpl
- [x] `EventPublisher.publishStoryBlocked(params)` — [Source: packages/core/src/types.ts:1513] — implemented in EventPublisherImpl
- [x] `EventPublisher.publishStoryAssigned(params)` — [Source: packages/core/src/types.ts:1516] — implemented in EventPublisherImpl
- [x] `EventPublisher.publishAgentResumed(params)` — [Source: packages/core/src/types.ts:1519] — implemented in EventPublisherImpl
- [x] `EventPublisher.close()` — [Source: packages/core/src/types.ts:1531] — implemented
- [x] `EventPublisher.flush()` — [Source: packages/core/src/types.ts:1522] — implemented
- [x] `EventPublisher.getQueueSize()` — [Source: packages/core/src/types.ts:1525] — implemented
- [x] `createEventPublisher(config)` — [Source: packages/core/src/event-publisher.ts:553] — factory function
- [x] `getEventPublisher()` — [Source: packages/core/src/service-registry.ts:46] — returns registered instance or undefined
- [x] `registerEventPublisher(publisher)` — [Source: packages/core/src/service-registry.ts:30] — called automatically by EventPublisherImpl constructor
- [x] `createSyncBridge(config)` — [Source: packages/core/src/sync-bridge.ts:58] — from Story 2-1
- [x] `SyncBridge.initialize()` — [Source: packages/core/src/sync-bridge.ts:66] — wires SM+FW+SS
- [x] `SyncBridge.getStateManager()` — [Source: packages/core/src/sync-bridge.ts:114] — returns StateManager
- [x] `SyncBridge.close()` — [Source: packages/core/src/sync-bridge.ts:96] — reverse teardown
- [x] `createBMADTrackerAdapter(project)` — [Source: packages/plugins/tracker-bmad/src/bmad-tracker-adapter.ts:75] — from Story 2-1
- [x] `registerStateManager(sm)` — [Source: packages/cli/src/lib/story-context.ts:24] — from Story 2-1
- [x] `clearStateManager()` — [Source: packages/cli/src/lib/story-context.ts:31] — from Story 2-1

**Feature Flags:**
- [x] None expected — all interface methods exist from previous cycles

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

No new dependencies required. All needed libraries are already approved:
- `yaml` (2.8.2, ISC) — approved in previous cycle
- `chokidar` (4.0.3, MIT) — approved in previous cycle, used by FileWatcher
- `proper-lockfile` (4.1.2, MIT) — approved in previous cycle, used by StateManager
- `zod` (3.25.76, MIT) — approved in previous cycle

## CLI Integration Testing (if applicable)

- [x] Create CLI integration test in `packages/cli/__tests__/commands/story-lifecycle-events.test.ts`
- [x] Test event shape validation (correct fields for each event type)
- [x] Test non-fatal pattern (event publish failures don't crash handlers)
- [x] Test event ordering (spawn publishes assigned before started)
- [x] Test resume publishes both agentResumed and storyAssigned
- [x] Test wireDetection creates EventPublisher and SyncBridge

**CLI Test Pattern:**
```typescript
import { describe, it, expect } from "vitest";
import { runCliWithTsx } from "../integration/helpers/cli-test.js";
import { createTempEnv } from "../integration/helpers/temp-env.js";

describe("ao spawn --story (with event publishing)", () => {
  it("should publish story.started event when spawning", async () => {
    const env = createTempEnv();
    try {
      // Verify event publisher is created and story.started is published
      const result = await runCliWithTsx(["spawn", "myproject", "--story", "1-1-test"], { cwd: env.cwd });
      expect(result.exitCode).toBe(0);
    } finally {
      env.cleanup();
    }
  });
});
```

**Reference:** See `packages/cli/__tests__/CLI_TEST_README.md` for complete CLI testing guide.

## Dev Notes

### Architecture Overview

This story **wires** the existing EventPublisher into the actual story lifecycle flows. The EventPublisher class and all publish methods already exist and are fully tested — but they are NEVER called from production code (only from DLQ replay and tests). This story closes that gap.

```
┌──────────────────────────────────────────────────────────────────┐
│                      wireDetection()                              │
│                                                                    │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ EventPublisher   │  │  SyncBridge  │  │ CompletionDetector  │  │
│  │ (dedup+log)      │  │ (SM+FW+SS)  │  │ (polls runtime)     │  │
│  └───────┬──────────┘  └──────┬───────┘  └────────┬────────────┘  │
│          │                    │                    │                │
│          │  ┌─────────────────┘                    │                │
│          │  │ StateManager                         │                │
│          │  │                                      │                │
│  ┌───────▼──▼───────────────┐         ┌───────────▼────────────┐  │
│  │ completionHandler        │         │ failureHandler          │  │
│  │ → updateSprintStatus(SM) │         │ → updateSprintStatus(SM)│  │
│  │ → publishStoryCompleted  │         │ → publishStoryBlocked   │  │
│  └──────────────────────────┘         └─────────────────────────┘  │
│                                                                    │
│  In-Memory EventBus ←──── all events flow through here            │
└──────────────────────────────────────────────────────────────────┘

Spawn Flow:
  ao spawn --story → spawnAgent() → publishStoryStarted()

Assign Flow:
  ao assign / ao assign-next → assignAgent() → publishStoryAssigned()

Resume Flow:
  ao resume → resumeAgent() → publishAgentResumed()
```

### What Already Exists (DO NOT REINVENT)

| Module | File | Lines | Status |
|--------|------|-------|--------|
| EventPublisher | `core/src/event-publisher.ts` | 556 | FULLY IMPLEMENTED — dedup, queue, backup log, degraded mode, flush |
| EventPublisher interface | `core/src/types.ts` | ~80 | ALL publish methods + event types defined |
| Event types | `core/src/types.ts` | 1534-1573 | StoryCompletedEvent, StoryStartedEvent, StoryBlockedEvent, StoryAssignedEvent, AgentResumedEvent |
| Service registry | `core/src/service-registry.ts` | 48 | registerEventPublisher(), getEventPublisher() |
| In-memory EventBus | `cli/src/lib/wire-detection.ts` | 29 | createInMemoryEventBus() |
| SyncBridge | `core/src/sync-bridge.ts` | 165 | createSyncBridge() — from Story 2-1 |
| BMADTracker adapter | `tracker-bmad/src/bmad-tracker-adapter.ts` | 142 | createBMADTrackerAdapter() — from Story 2-1 |
| StateManager cache | `cli/src/lib/story-context.ts` | 50 | registerStateManager(), clearStateManager(), getStateManagerOrFallback() — from Story 2-1 |
| Completion handlers | `core/src/completion-handlers.ts` | 440 | Already accept optional `stateManager` param — from Story 2-1 |
| wireDetection | `cli/src/lib/wire-detection.ts` | 181 | Creates EventBus, detectors, handlers |
| Event publisher tests | `core/__tests__/event-publisher.test.ts` | 620+ | Comprehensive tests for all publish methods |

### What's MISSING (This Story Fills)

| Gap | Description |
|-----|-------------|
| EventPublisher not created in wireDetection | `createEventPublisher()` never called in production code — only EventBus is created |
| SyncBridge not wired into wireDetection | Deferred from Story 2-1 Task 3.2 — wireDetection doesn't create SyncBridge |
| story.completed not published on completion | `createCompletionHandler()` calls `updateSprintStatus()` but never `publishStoryCompleted()` |
| story.blocked not published on failure | `createFailureHandler()` calls `updateSprintStatus()` but never `publishStoryBlocked()` |
| story.started not published on spawn | Spawn flow doesn't call `publishStoryStarted()` |
| story.assigned not published on assign | Assign commands don't call `publishStoryAssigned()` |
| StateManager not passed to handlers in wireDetection | wireDetection creates handlers without StateManager (line 93-101) |

### Critical: EventPublisher is Auto-Registered

When `new EventPublisherImpl(config)` is constructed, it calls `registerEventPublisher(this)` in the constructor (line 106). This means any code can call `getEventPublisher()` from the service registry to get the publisher — no need to pass it as parameter to every function. Use this for spawn/assign/resume commands.

However, for completion/failure handlers, passing EventPublisher as a parameter is cleaner because:
1. The handlers are created at wireDetection time (not at call time)
2. The EventPublisher instance is known at creation time
3. No dependency on global service registry from core library code

### Anti-Patterns to Avoid

- **Do NOT create a second EventBus** — reuse the in-memory EventBus already created in wireDetection (line 134)
- **Do NOT modify EventPublisher class** — it's complete. Only WIRE it into flows.
- **Do NOT modify EventBus interface** — it's complete. Only use it.
- **Do NOT make event publishing fatal** — always wrap in try/catch. A failed event publish must never block story completion/failure handling.
- **Do NOT use `exec()` for shell commands** — always `execFile()` with timeouts (NFR-S7, NFR-S9).
- **Do NOT add Redis** — in-memory EventBus only for this story. Redis is for later Epic 2 or Epic 4.
- **Do NOT add new event types** — all 5 story lifecycle event types and their parameter interfaces already exist in types.ts.

### Key Implementation Constraints

- **CLI-lifetime scope**: EventPublisher and SyncBridge live for the duration of `ao spawn --story` CLI process. Persistent event publishing is deferred.
- **Non-fatal pattern**: All event publishing wrapped in try/catch. The system must work identically with or without EventPublisher — events are additive, not required.
- **Service registry for loose coupling**: Commands like `assign`, `spawn --story`, `resume` use `getEventPublisher()` from service registry. They don't need the publisher passed as parameter.
- **Backward compatibility**: All changes are additive. Existing commands continue working unchanged when EventPublisher is not registered.
- **Dedup already works**: EventPublisher has 5s dedup window keyed on `eventType:storyId`. No additional dedup logic needed.

### Cross-Story Dependencies

- **Story 2-1 (done)**: Provided SyncBridge, BMADTracker adapter, StateManager routing in completion handlers, StateManager cache in story-context.ts
- **Story 2-3 (backlog)**: Will subscribe to `story.completed` events from this story to trigger dependency resolution
- **Story 2-4 (backlog)**: Will subscribe to story lifecycle events to recalculate burndown
- **Story 2-5 (backlog)**: Will extend conflict resolution with notification escalation

### Testing Strategy

- **Unit tests** for completion/failure handlers with EventPublisher: mock EventPublisher, verify publish methods called with correct args
- **Unit tests** for wireDetection event wiring: mock createEventPublisher/createSyncBridge, verify creation and teardown
- **Unit tests** for spawn event publishing: mock getEventPublisher(), verify publishStoryStarted called
- **Unit tests** for assign event publishing: mock getEventPublisher(), verify publishStoryAssigned called
- **Non-fatal verification**: mock EventPublisher that throws on publish, verify handler still completes successfully
- **Use existing mock patterns**: vi.mock for module-level mocks, vi.fn() for spy verification
- **Try/finally cleanup** for any temp directories (pattern from Story 1-5)

### ESLint Hook Warning

The project has a post-tool-use lint hook that validates each edit in isolation. When adding a new import and its usage, **combine them in a single Edit** operation. If you add the import in one edit and the usage in a separate edit, the first edit will fail because the import appears unused.

### Project Structure Notes

**Files to modify:**
- `packages/cli/src/lib/wire-detection.ts` — create EventPublisher + SyncBridge, pass to handlers
- `packages/core/src/completion-handlers.ts` — add optional `eventPublisher` param, call publish methods
- `packages/cli/src/commands/spawn-story.ts` — publish story.started after spawn (or wherever spawn happens)
- `packages/cli/src/commands/assign.ts` — publish story.assigned after assignment
- `packages/cli/src/commands/assign-next.ts` — publish story.assigned after auto-assignment

**Files to create:**
- `packages/cli/__tests__/wire-detection-events.test.ts` — tests for event wiring in wireDetection

**Files to extend:**
- `packages/core/src/__tests__/completion-wiring.test.ts` — tests for EventPublisher in handlers

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.2]
- [Source: _bmad-output/planning-artifacts/architecture.md — Decision 1 (Event Bus), Decision 2 (State Manager)]
- [Source: _bmad-output/planning-artifacts/prd.md — FR17, FR18, FR23, FR24, NFR-P6, NFR-P7, NFR-R6]
- [Source: packages/core/src/event-publisher.ts — EventPublisherImpl (556 lines, fully implemented)]
- [Source: packages/core/src/types.ts — EventPublisher (1497-1532), StoryCompletedEvent (1534), StoryStartedEvent (1545), StoryBlockedEvent (1551), StoryAssignedEvent (1560), AgentResumedEvent (1567)]
- [Source: packages/core/src/service-registry.ts — registerEventPublisher(), getEventPublisher()]
- [Source: packages/cli/src/lib/wire-detection.ts — wireDetection(), createInMemoryEventBus()]
- [Source: packages/core/src/completion-handlers.ts — createCompletionHandler(), createFailureHandler()]
- [Source: packages/core/src/sync-bridge.ts — createSyncBridge() from Story 2-1]
- [Source: packages/plugins/tracker-bmad/src/bmad-tracker-adapter.ts — createBMADTrackerAdapter() from Story 2-1]
- [Source: packages/cli/src/lib/story-context.ts — registerStateManager(), clearStateManager() from Story 2-1]
- [Source: _bmad-output/implementation-artifacts/2-1-bmad-tracker-bidirectional-sync-bridge.md — Story 2-1 dev notes, deferred Task 3.2]
- [Source: _bmad-output/implementation-artifacts/epic-1-retrospective.md — Sprint status reader consolidation, testing patterns]
- [Source: _bmad-output/project-context.md — coding rules, ESM conventions, shell security]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes

- All 5 story lifecycle event types wired into production flows: story.completed, story.started, story.blocked, story.assigned, agent.resumed
- EventPublisher + SyncBridge created in wireDetection with proper cleanup teardown
- StateManager passed to completion/failure handlers via SyncBridge
- All event publishing uses non-fatal try/catch pattern
- Commands use getEventPublisher() from service registry for loose coupling
- 21 new tests across 3 test files, all passing
- Build passes across all packages (core, cli, web, plugins)
- All existing tests remain passing: core (1099), CLI (596), web (772)

### File List

**Modified:**
- `packages/cli/src/lib/wire-detection.ts` — Task 1: EventPublisher + SyncBridge creation, cleanup, stateManager/eventPublisher passed to handlers
- `packages/core/src/completion-handlers.ts` — Task 2: optional eventPublisher param, publishStoryCompleted/publishStoryBlocked calls
- `packages/cli/src/commands/spawn-story.ts` — Task 3: publishStoryAssigned + publishStoryStarted after spawn
- `packages/cli/src/commands/spawn.ts` — Task 3: publishStoryAssigned + publishStoryStarted after spawn
- `packages/cli/src/commands/resume.ts` — Task 4: publishAgentResumed + publishStoryAssigned after resume
- `packages/cli/src/commands/assign.ts` — Task 4: publishStoryAssigned (reason: "manual") after register
- `packages/cli/src/commands/assign-next.ts` — Task 4: publishStoryAssigned (reason: "auto") after register

**Created:**
- `packages/core/src/__tests__/completion-events.test.ts` — Task 5.1: 5 tests for completion/failure handler event publishing
- `packages/cli/__tests__/lib/wire-detection-events.test.ts` — Task 5.2: 4 tests for wireDetection event wiring
- `packages/cli/__tests__/commands/story-lifecycle-events.test.ts` — Task 5.4/5.5: 12 tests for spawn/resume event publishing
