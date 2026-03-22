# Story 40.1: CascadeAlert Real Status

Status: review

## Story

As a dashboard user monitoring agent health,
I want the CascadeAlert banner to show real cascade failure status from the SSE stream,
so that I see actual cascade alerts and can resume agents.

## Acceptance Criteria

1. CascadeAlert receives real cascade status from SSE `cascade.triggered` events
2. The "Resume All" button calls POST /api/agent/cascade/resume to clear cascade state
3. When no cascade is active, the banner is hidden (existing behavior preserved)
4. WorkflowDashboard passes real cascade status instead of `null`
5. Tests verify SSE event handling and resume action

## Tasks / Subtasks

- [x] Task 1: Create cascade resume API endpoint (AC: #2)
  - [x] 1.1: Create `POST /api/agent/cascade/resume` route
  - [x] 1.2: Route calls `getSharedCascadeDetector().resume()`
  - [x] 1.3: Returns success with previous failure count
- [x] Task 2: Create useCascadeStatus hook (AC: #1, #3)
  - [x] 2.1: `useCascadeStatus()` listens for `cascade.triggered` SSE events
  - [x] 2.2: Tracks cascade status (triggered, failureCount, paused)
  - [x] 2.3: `resume()` calls API and clears local status
  - [x] 2.4: 30s auto-clear timer, reset on new events
  - [x] 2.5: EventSource guard for SSR/test environments
- [x] Task 3: Wire into WorkflowDashboard (AC: #4)
  - [x] 3.1: Replace `status={null}` with `cascadeStatus` from hook
  - [x] 3.2: Pass `cascadeResume` to CascadeAlert's `onResume`
- [x] Task 4: Write tests (AC: #5)
  - [x] 4.1: Test hook starts with null, updates on cascade.triggered
  - [x] 4.2: Test resume calls API and clears status
  - [x] 4.3: Test ignores non-cascade events
  - [x] 4.4: Test auto-clear after 30s, timer reset on new event
  - [x] 4.5: Test EventSource closed on unmount

## Dev Notes

### Architecture Constraints

- **Client component** — CascadeAlert and the hook run in the browser (client-side)
- **SSE events** — The existing `useSSEConnection` or `useWorkflowSSE` hooks handle SSE. The cascade hook should listen for `cascade.triggered` events from the same SSE stream.
- **No direct cascade detector access from client** — The detector runs server-side in the SSE route. Client only receives events.

### Implementation Approach

The simplest approach: create a `useCascadeStatus` hook that:
1. Subscribes to the existing SSE `/api/events` stream via a custom event listener
2. When `cascade.triggered` event arrives, sets status to `{ triggered: true, failureCount, paused: true }`
3. The resume function calls `POST /api/agent/cascade/resume` and clears local status
4. A 30s timeout auto-clears if no new cascade events arrive (cascade may have resolved)

For the resume endpoint, we need to access the wired cascade detector. Since the detector is created per-SSE-connection (in the `start()` of the ReadableStream), we need a module-level shared detector instance instead.

**Alternative:** Make the cascade detector module-level in a shared module that both SSE route and resume endpoint can access.

### Files to Create/Modify

1. `packages/web/src/lib/workflow/cascade-detector-shared.ts` (new — shared detector instance)
2. `packages/web/src/app/api/agent/cascade/resume/route.ts` (new — resume endpoint)
3. `packages/web/src/hooks/useCascadeStatus.ts` (new — client hook)
4. `packages/web/src/components/WorkflowDashboard.tsx` (modify — wire real status)
5. `packages/web/src/app/api/events/route.ts` (modify — use shared detector)

### References

- [Source: packages/web/src/components/CascadeAlert.tsx] — the component
- [Source: packages/web/src/lib/workflow/cascade-detector-wired.ts] — wired detector
- [Source: packages/web/src/app/api/events/route.ts] — SSE route emitting cascade events

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Created shared cascade detector singleton (cascade-detector-shared.ts)
- Created POST /api/agent/cascade/resume endpoint
- Created useCascadeStatus React hook with SSE listener + 30s auto-clear
- Wired WorkflowDashboard: CascadeAlert receives real status + resume handler
- EventSource guard prevents crashes in SSR/test environments
- Updated events/route.ts to use shared detector (accessible by resume endpoint)
- 7 tests covering all hook behavior
- All 1,153 web tests pass, typecheck clean

### File List

- packages/web/src/lib/workflow/cascade-detector-shared.ts (new — shared singleton)
- packages/web/src/app/api/agent/cascade/resume/route.ts (new — resume endpoint)
- packages/web/src/hooks/useCascadeStatus.ts (new — client hook)
- packages/web/src/hooks/__tests__/useCascadeStatus.test.ts (new — 7 tests)
- packages/web/src/components/WorkflowDashboard.tsx (modified — real cascade status)
- packages/web/src/app/api/events/route.ts (modified — shared detector)
