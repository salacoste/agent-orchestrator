# Story 10.1: File Watcher with Debounced SSE Notifications

Status: done

## Story

As a dashboard user,
I want the system to detect file changes in BMAD-related directories and push notifications via SSE,
so that the dashboard updates automatically without manual page refresh.

## Acceptance Criteria

1. **Given** a project with BMAD directories (`_bmad-output/`, `_bmad/_config/`)
   **When** a file is created, modified, or deleted in those directories
   **Then** a `workflow-change` SSE event is dispatched to connected clients within 500ms end-to-end

2. **Given** the file watcher is using `node:fs.watch()` (not chokidar)
   **When** initialized
   **Then** it watches `_bmad-output/planning-artifacts/`, `_bmad-output/research/`, `_bmad-output/implementation-artifacts/`, and `_bmad/_config/agent-manifest.csv`
   **And** zero new dependencies are added to package.json

3. **Given** rapid file changes occur (e.g., editor auto-save writing multiple times per second)
   **When** the watcher detects them
   **Then** events are debounced with a 200ms window, dispatching only one SSE event per debounce cycle

4. **Given** the SSE event is sent
   **When** the client receives it
   **Then** the event is notification-only (no payload data -- client re-fetches the API)
   **And** dispatch latency from debounce timer firing to SSE event sent is <50ms

5. **Given** the file watcher singleton
   **When** multiple SSE clients are connected
   **Then** all clients receive the notification (fan-out)

6. **Given** the watcher encounters an error (e.g., watched directory deleted)
   **When** the error occurs
   **Then** the watcher degrades gracefully without crashing the server, and logs the error internally

## Tasks / Subtasks

- [x] Task 1: Create workflow watcher module (AC: 1, 2, 3, 5, 6)
  - [x] 1.1 Create `packages/web/src/lib/workflow-watcher.ts` with module-level singleton
  - [x] 1.2 Implement `node:fs.watch()` recursive watching for configured BMAD directories
  - [x] 1.3 Implement 200ms debounce using `setTimeout`/`clearTimeout` pattern
  - [x] 1.4 Implement listener Set for fan-out to multiple SSE clients
  - [x] 1.5 Implement `subscribeWorkflowChanges(callback): () => void` API
  - [x] 1.6 Implement graceful error handling (log + continue, don't crash)
  - [x] 1.7 Implement lazy initialization (watcher starts on first subscriber)
- [x] Task 2: Integrate with existing SSE endpoint (AC: 1, 4, 5)
  - [x] 2.1 Modify `packages/web/src/app/api/events/route.ts` to subscribe to workflow watcher
  - [x] 2.2 Emit `workflow-change` event type on the existing SSE stream
  - [x] 2.3 Add unsubscribe cleanup to the stream's `cancel()` handler
- [x] Task 3: Add SSE event type (AC: 4)
  - [x] 3.1 Add `WorkflowChangeEvent` to SSE event type union in `packages/web/src/lib/types.ts`
- [x] Task 4: Write unit tests for workflow watcher (AC: 1, 2, 3, 5, 6)
  - [x] 4.1 Create `packages/web/src/lib/workflow/__tests__/workflow-watcher.test.ts`
  - [x] 4.2 Test debounce: 10 rapid events within 200ms produce single callback
  - [x] 4.3 Test fan-out: multiple subscribers all receive notification
  - [x] 4.4 Test subscribe/unsubscribe lifecycle (no leaks)
  - [x] 4.5 Test error handling: watcher error doesn't crash, logs warning
  - [x] 4.6 Test lazy initialization: watcher only starts on first subscribe
- [x] Task 5: Lint, typecheck, verify (all ACs)
  - [x] 5.1 Run `pnpm lint` -- clean
  - [x] 5.2 Run `pnpm typecheck` -- clean
  - [x] 5.3 Run `pnpm test` -- all tests pass (496 tests, 49 files)

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
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [x] No core interface methods used -- this story is entirely within `packages/web`
- [x] No feature flags needed -- `node:fs.watch()` is a Node.js built-in

**Methods Used:**
- [x] `node:fs.watch()` -- Node.js built-in, always available (Node 20+)
- [x] `ReadableStream` -- Web Streams API, already used in `app/api/events/route.ts`

**Feature Flags:**
- None required

## Dependency Review (if applicable)

**No new dependencies required.** This story uses only Node.js built-in APIs:
- `node:fs` for `fs.watch()` (recursive directory watching)
- `node:path` for path resolution
- Standard `setTimeout`/`clearTimeout` for debouncing

**Architecture Note:** The architecture document (WD-5) prescribes chokidar, but the epic's AC2 explicitly mandates `node:fs.watch()` with zero new dependencies. The architecture's WD-G1 fallback path endorses `node:fs.watch()` with manual 200ms debounce (~15 lines). Since `packages/web` does NOT have chokidar as a direct dependency, using `node:fs.watch()` satisfies both NFR-P6 (zero new deps) and AC2. The `packages/core` file-watcher uses chokidar for different purposes (state file watching with conflict resolution).

## Dev Notes

### Critical Architecture Decisions

**WD-5 (SSE Integration):** The workflow watcher is a module-level singleton in `packages/web/src/lib/workflow-watcher.ts`. It lazily initializes on first SSE client connection and fans out notifications to all connected clients. The watcher emits `workflow-change` events on the EXISTING SSE stream at `/api/events` -- it does NOT create a new SSE route (per TS-10: "new event type on existing channel, not a new route").

**WD-4 (Frozen API Contract):** SSE events are notification-only. The client re-fetches `GET /api/workflow/[project]` to get fresh data. The SSE event carries only the signal that something changed -- no data payload. The `WorkflowResponse` interface is frozen and must not be modified.

**WD-7 (LKG State Pattern):** Error resilience is handled in Story 10-3, NOT this story. This story focuses solely on the file watcher + SSE notification pipeline. If the watcher encounters errors, it degrades gracefully (logs, doesn't crash) but does NOT implement LKG caching.

### Implementation Guide

#### File: `packages/web/src/lib/workflow-watcher.ts` (NEW)

```typescript
// Module-level singleton pattern (same as architecture WD-5)
// Uses node:fs.watch() with recursive:true (Node 20+ on macOS/Windows)
// Manual 200ms debounce via setTimeout/clearTimeout
// Listener Set<WatcherCallback> for fan-out to multiple SSE clients

import { watch, type FSWatcher } from "node:fs";
import { resolve } from "node:path";

type WatcherCallback = () => void;

let watcher: FSWatcher[] | null = null;
const listeners = new Set<WatcherCallback>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function subscribeWorkflowChanges(callback: WatcherCallback): () => void {
  if (!watcher) {
    initWatcher();
  }
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
    // Optional: cleanup watcher when no listeners remain
  };
}
```

**Key implementation details:**
1. `node:fs.watch()` with `{ recursive: true }` works on macOS (FSEvents) and Windows. On Linux, recursive watching requires Node 19+.
2. Debounce: On each file change event, clear any pending timer and set a new 200ms timer. When timer fires, invoke all listeners.
3. Watch paths resolved from `process.cwd()` (Next.js project root).
4. Multiple `FSWatcher` instances (one per directory) stored in array.
5. Error handler on each watcher: `watcher.on('error', ...)` -- log and continue.

#### File: `packages/web/src/app/api/events/route.ts` (MODIFY)

Add workflow watcher subscription alongside existing session polling:

```typescript
// EXISTING: heartbeat interval + session polling
// ADD: workflow change subscription
const unsubscribe = subscribeWorkflowChanges(() => {
  try {
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ type: "workflow-change" })}\n\n`)
    );
  } catch {
    // Stream closed -- will be cleaned up by cancel()
  }
});

// In cancel():
cancel() {
  clearInterval(heartbeat);
  clearInterval(updates);
  unsubscribe();  // ADD: clean up workflow watcher subscription
}
```

#### File: `packages/web/src/lib/types.ts` (MODIFY)

Add `workflow-change` to the SSE event type union. Check existing type definitions to find where SSE event types are defined and add the new type.

### Watched Paths

Per AC2, the watcher monitors these directories (resolved from `process.cwd()`):
1. `_bmad-output/planning-artifacts/` -- PRD, architecture, epics, UX docs
2. `_bmad-output/research/` -- Research reports
3. `_bmad-output/implementation-artifacts/` -- Sprint status, story files
4. `_bmad/_config/agent-manifest.csv` -- Agent manifest (single file, not directory)

**Important:** For `agent-manifest.csv`, watch the parent directory `_bmad/_config/` and filter events for the specific file, OR use `fs.watchFile()` for single file watching.

### Latency Budget (TS-05: <500ms end-to-end)

| Stage | Budget | Mechanism |
|---|---|---|
| File write -> fs.watch detection | ~50ms | OS file system events (FSEvents on macOS) |
| Debounce stabilization | 200ms | Manual setTimeout |
| SSE dispatch | <50ms | In-memory callback, Set iteration |
| Network + client processing | ~100ms | localhost, minimal payload |
| **Total** | **~400ms** | **Within 500ms budget** |

### Existing Code Patterns to Follow

**SSE stream pattern** (from `app/api/events/route.ts`):
- `export const dynamic = "force-dynamic"` at top of file
- `ReadableStream` with `start()`, `cancel()` callbacks
- `TextEncoder` for encoding SSE data
- Heartbeat: `:\n\n` comment line (keeps connection alive)
- Event format: `data: ${JSON.stringify(payload)}\n\n`

**Timer cleanup pattern** (from `packages/web/src/lib/cache.ts`):
- `clearInterval()` in cleanup/close methods
- `.unref()` for background intervals that shouldn't prevent process exit

**Module-level singleton pattern** (from architecture WD-5):
- Module-level variables (not class instances)
- Lazy initialization on first use
- Export functions, not classes

### Testing Strategy

**Test file:** `packages/web/src/lib/workflow/__tests__/workflow-watcher.test.ts`

**Approach:** Mock `node:fs` `watch()` function to simulate file system events without touching the real filesystem. Use `vi.useFakeTimers()` for deterministic debounce testing.

**Key test scenarios:**
1. **Debounce coalescence:** Fire 10 events in 50ms, verify single callback after 200ms
2. **Debounce reset:** Fire event, wait 100ms, fire another, verify callback at 300ms (200ms after last event)
3. **Fan-out:** Add 3 subscribers, fire event, verify all 3 called
4. **Unsubscribe:** Subscribe, unsubscribe, fire event, verify NOT called
5. **Error resilience:** Simulate watcher error event, verify no crash, verify subsequent events still work
6. **Lazy init:** Verify `fs.watch()` NOT called until first `subscribeWorkflowChanges()`
7. **Cleanup:** Unsubscribe all listeners, verify watchers cleaned up (or remain for efficiency)

**Mocking pattern:**
```typescript
vi.mock("node:fs", () => ({
  watch: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
}));
```

### Cross-Story Context

**Story 10-2 (next):** Will add client-side `EventSource` subscription on the Workflow page that listens for `workflow-change` events and triggers `GET /api/workflow/[project]` re-fetch. This story provides the server-side infrastructure that 10-2 consumes.

**Story 10-3:** Will add LKG caching to the API route so that file read errors return cached data. This story does NOT implement LKG -- it only watches for changes and notifies.

**Story 10-4:** Will add comprehensive tests for debounce timing, LKG matrix (30 scenarios), and panel independence. This story includes its own unit tests for the watcher module.

### Project Structure Notes

- All new files go in `packages/web/src/lib/` (watcher module) or modify existing files in `packages/web/src/app/api/`
- ESM imports with `.js` extensions required
- `type` keyword for type-only imports
- Strict TypeScript mode
- No `any` -- use `unknown` + type guards
- CSS variables for colors (not hardcoded)
- File naming: `kebab-case.ts`

### Previous Story Learnings (Epic 9)

From Story 9-1 and 9-2 implementation:
- **PHASE_LABELS** mapping works well for converting raw phase strings to human labels
- **Props-only components** (WD-6): All Workflow components receive data as props, no internal fetching
- **Accessibility patterns**: sr-only text, aria-hidden on duplicate visible content, semantic HTML
- **Testing patterns**: `vi.useFakeTimers()` + `vi.setSystemTime()` for time-dependent tests
- **Code review caught**: Duplicate function calls (extract to variables), missing boundary tests

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#WD-5 SSE Integration]
- [Source: _bmad-output/planning-artifacts/architecture.md#WD-4 API Design & Contract]
- [Source: _bmad-output/planning-artifacts/architecture.md#WD-7 LKG State Pattern]
- [Source: _bmad-output/planning-artifacts/epics-workflow-dashboard.md#Epic 4 Story 1]
- [Source: packages/web/src/app/api/events/route.ts -- existing SSE endpoint]
- [Source: packages/web/src/hooks/useSSEConnection.ts -- existing SSE client hook]
- [Source: packages/web/src/lib/workflow/types.ts -- frozen WorkflowResponse interface]
- [Source: packages/core/src/file-watcher.ts -- existing chokidar-based watcher (different package)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Created `workflow-watcher.ts` module-level singleton using `node:fs.watch()` with `{ recursive: true }` for 4 BMAD directories
- Implemented 200ms debounce via `setTimeout`/`clearTimeout` -- coalesces rapid file changes into single notification
- Implemented `Set<WatcherCallback>` fan-out -- all connected SSE clients notified simultaneously
- `subscribeWorkflowChanges(callback)` returns unsubscribe function for proper cleanup
- Graceful error handling: `existsSync` check skips missing directories, `error` event handler prevents crashes
- Lazy initialization: `fs.watch()` not called until first subscriber connects
- `_resetForTesting()` exported for test isolation (closes all watchers, clears listeners)
- Integrated with existing `/api/events` SSE endpoint -- new `workflow-change` event type on same stream
- Added `SSEWorkflowChangeEvent` type to `packages/web/src/lib/types.ts`
- 20 unit tests covering: debounce coalescence, timer reset, cross-watcher debounce, fan-out, subscribe/unsubscribe lifecycle, error resilience, lazy init, non-existent directory handling, filename filter, watcher cleanup on last unsubscribe, watch() init errors
- All tests pass, lint clean, typecheck clean

**Code Review Fixes Applied:**
- Added `console.warn` logging on watcher errors (AC6 compliance)
- Added filename filter for `_bmad/_config` watcher -- only triggers on `agent-manifest.csv` (AC2 compliance)
- Added watcher cleanup when all listeners unsubscribe (resource leak fix)
- Removed incorrect istanbul ignore comment (project uses vitest)
- Added 6 new tests: cross-watcher debounce, watch() throw resilience, watcher cleanup lifecycle, re-init after cleanup, filename filter (accept/reject)

### File List

- `packages/web/src/lib/workflow-watcher.ts` (NEW) -- workflow file watcher singleton module
- `packages/web/src/lib/workflow/__tests__/workflow-watcher.test.ts` (NEW) -- 20 unit tests
- `packages/web/src/app/api/events/route.ts` (MODIFIED) -- added workflow watcher subscription + cleanup
- `packages/web/src/lib/types.ts` (MODIFIED) -- added `SSEWorkflowChangeEvent` interface

