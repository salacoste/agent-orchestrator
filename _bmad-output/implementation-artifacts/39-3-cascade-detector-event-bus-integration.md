# Story 39.3: Cascade Detector Event Bus Integration

Status: review

## Story

As the orchestration system monitoring agent health,
I want the cascade detector to automatically record failures from SSE session snapshots,
so that cascade alerts trigger without manual wiring.

## Acceptance Criteria

1. A `createWiredCascadeDetector()` factory creates a detector that auto-records failures from session status changes
2. When a session snapshot shows agents in `blocked`/`ci_failed` status, the detector records failures
3. The wired detector exposes the same `getStatus()`/`resume()`/`reset()` API as the base detector
4. SSE events route emits `cascade.triggered` events when cascade threshold is reached
5. Tests verify automatic failure recording and cascade triggering

## Tasks / Subtasks

- [x] Task 1: Create wired cascade detector factory (AC: #1, #2, #3)
  - [x] 1.1: Create `cascade-detector-wired.ts` with `createWiredCascadeDetector(config?)` factory
  - [x] 1.2: Accept session snapshot data and scan for failure statuses (blocked, ci_failed)
  - [x] 1.3: Track previously-seen failures via `seenFailures` Set to avoid double-counting
  - [x] 1.4: Expose `getStatus()`, `resume()`, `reset()`, `processSnapshot(sessions)` API
- [x] Task 2: Integrate into SSE events route (AC: #4)
  - [x] 2.1: Create wired detector instance in events route start()
  - [x] 2.2: Feed session snapshots to detector on each 5s poll interval
  - [x] 2.3: Emit `cascade.triggered` SSE event with failureCount when cascade activates
- [x] Task 3: Write tests (AC: #5)
  - [x] 3.1: Test failure recording from session snapshots (blocked + ci_failed)
  - [x] 3.2: Test cascade triggers after threshold failures
  - [x] 3.3: Test deduplication (same agent not double-counted across polls)
  - [x] 3.4: Test resume clears state + re-counts after resume
  - [x] 3.5: Test non-failure statuses are ignored
  - [x] 3.6: Test agent recovery + re-failure counted correctly
  - [x] 3.7: Test empty snapshot, reset behavior

## Dev Notes

### Architecture Constraints

- **Pure module pattern** — `cascade-detector.ts` stays unchanged. The wired version wraps it.
- **SSE pattern** — follow the same `controller.enqueue()` pattern from events/route.ts
- **No EventBus dependency** — the web package doesn't have access to the core EventBus. Instead, feed data from the SSE poll's session snapshots (already available every 5s).

### Implementation Approach

Create `cascade-detector-wired.ts` that:
1. Creates a base `createCascadeDetector()` instance
2. Exposes `processSnapshot(sessions: Array<{id, status}>)` that scans for failure statuses
3. Tracks `seenFailures: Set<agentId>` to avoid double-counting
4. Clears seen failures when agents recover (status changes from blocked → working)

In `events/route.ts`, create the wired detector in `start()` and call `processSnapshot()` in the 5s poll interval. If cascade triggers, emit event.

### Files to Create/Modify

1. `packages/web/src/lib/workflow/cascade-detector-wired.ts` (new)
2. `packages/web/src/lib/workflow/__tests__/cascade-detector-wired.test.ts` (new)
3. `packages/web/src/app/api/events/route.ts` (modify — add cascade detection to poll)

### References

- [Source: packages/web/src/lib/workflow/cascade-detector.ts] — base detector
- [Source: packages/web/src/app/api/events/route.ts] — SSE route with 5s poll
- [Source: packages/core/src/blocked-agent-detector.ts] — core blocked detection pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Created `cascade-detector-wired.ts` wrapping base detector with snapshot processing
- `seenFailures` Set tracks counted agents to prevent double-counting across polls
- Agents that recover (status changes away from blocked/ci_failed) can be re-counted
- Wired into SSE `/api/events` route — processSnapshot on each 5s poll
- Emits `cascade.triggered` SSE event with failureCount when threshold reached
- 10 tests covering all AC requirements
- All 1,139 web tests pass, typecheck clean

### File List

- packages/web/src/lib/workflow/cascade-detector-wired.ts (new — wired detector factory)
- packages/web/src/lib/workflow/__tests__/cascade-detector-wired.test.ts (new — 10 tests)
- packages/web/src/app/api/events/route.ts (modified — cascade detection in poll)
