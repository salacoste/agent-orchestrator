# Story 60.8: Session State Dashboard Panel

Status: done

## Story

As a developer using the dashboard,
I want a panel in the session detail view that displays the current OMC execution state,
so that I can see the execution mode, active agents, progress indicators, and health status at a glance with real-time updates.

## Acceptance Criteria

1. **AC1 — Session State Panel component**: A new client component at `packages/web/src/components/SessionStatePanel.tsx` that:
   - Accepts `{ sessionId: string }` as props
   - Renders in the session detail view alongside existing panels (NotepadViewer, TimelineViewer, CostBreakdownPanel)
   - Only renders when `session.workspacePath` is truthy (same guard as other panels)
   - Uses the established card wrapper pattern: `detail-card mb-6 rounded-[8px] border border-[var(--color-border-default)] p-5`
   - Has `data-testid="session-state-panel"` and `role="region"` with `aria-labelledby`

2. **AC2 — Execution mode badge**: Displays the current execution mode (e.g., "standard", "autopilot") as a badge:
   - Shows "Standard" by default when `executionMode` is null
   - Capitalizes first letter of mode name
   - Uses a distinct color or style to indicate active vs inactive

3. **AC3 — Active agents list**: Displays the list of active agents:
   - Shows agent names as chips/badges
   - Shows "No agents" when `activeAgents` is empty
   - Shows "Configured" / "Not Configured" indicator based on `configured` field

4. **AC4 — Progress indicators for active modes**: For each entry in `activeModes`:
   - Shows mode name (e.g., "Ralph", "Ultrawork", "Autopilot")
   - Shows active/inactive status with visual indicator
   - When active: shows progress bar using `iteration`/`maxIterations` if available
   - Shows `phase` if available (e.g., "executing")
   - Shows `tasksCompleted`/`tasksTotal` if available (autopilot-specific)

5. **AC5 — Health indicator**: Shows provider health status:
   - When `health` is null (deferred): show "Health check not available" in muted text
   - When `health.healthy` is true: show green indicator
   - When `health.healthy` is false: show red indicator with `health.message`
   - Show `health.lastCheck` timestamp when available

6. **AC6 — Real-time SSE updates via custom hook**: A new hook at `packages/web/src/hooks/useSessionStateSSE.ts` that:
   - Follows the exact pattern from `useNotepadSSE.ts`
   - Fetches initial state via REST `GET /api/session/[id]/state`
   - Subscribes to SSE at `/api/session/[id]/state/stream`
   - Uses `es.addEventListener("state-update", handler)` (NOT `es.onmessage`) because the SSE endpoint sends named events
   - Auto-reconnects with exponential backoff (1s, 2s, 4s, 8s cap)
   - Returns `{ state: SessionState | null, exists: boolean, connected: boolean }`
   - Proper cleanup on unmount

7. **AC7 — Empty and loading states**:
   - Loading: show subtle loading indicator while initial fetch completes
   - Empty/no state (`exists: false`): show "No session state available yet" in muted text
   - Disconnected: `ActivityDot` in header turns red/grey (same as NotepadViewer/TimelineViewer)

8. **AC8 — Unit tests for the panel component**: Tests at `packages/web/src/components/__tests__/SessionStatePanel.test.tsx` covering:
   - Renders execution mode badge
   - Renders active agents list
   - Renders progress bar for active modes with iteration data
   - Renders "No agents" when agent list is empty
   - Renders health unavailable message when health is null
   - Handles empty state (exists: false)

9. **AC9 — Unit tests for the SSE hook**: Tests at `packages/web/src/hooks/__tests__/useSessionStateSSE.test.ts` covering:
   - Returns initial null state
   - Fetches initial data via REST
   - Subscribes to SSE with `addEventListener("state-update", ...)`
   - Updates state on SSE message
   - Reconnects on error with exponential backoff
   - Cleans up on unmount

10. **AC10 — Integration in SessionDetail**: The panel is added to `packages/web/src/components/SessionDetail.tsx`:
    - Imported as `SessionStatePanel`
    - Rendered alongside existing panels with same `session.workspacePath` guard
    - Passes `sessionId={session.id}` as prop

11. **AC11 — No new dependencies**: Uses only existing dependencies (React, vitest, testing-library).

## Tasks / Subtasks

- [x] Task 1: Create SSE hook (AC: #6)
  - [x] 1.1 Create `packages/web/src/hooks/useSessionStateSSE.ts`
  - [x] 1.2 Implement initial REST fetch to `/api/session/[id]/state`
  - [x] 1.3 Implement SSE subscription with `addEventListener("state-update", ...)` (named event)
  - [x] 1.4 Implement exponential backoff reconnection (1s, 2s, 4s, 8s cap)
  - [x] 1.5 Return `{ state, exists, connected }` with proper cleanup

- [x] Task 2: Create Session State Panel component (AC: #1, #2, #3, #4, #5, #7)
  - [x] 2.1 Create `packages/web/src/components/SessionStatePanel.tsx`
  - [x] 2.2 Implement card wrapper with header, ActivityDot, and data-testid
  - [x] 2.3 Implement execution mode badge (AC2)
  - [x] 2.4 Implement active agents list with chips/badges (AC3)
  - [x] 2.5 Implement active modes section with progress bars (AC4)
  - [x] 2.6 Implement health indicator (AC5)
  - [x] 2.7 Implement loading, empty, and disconnected states (AC7)

- [x] Task 3: Integrate in SessionDetail (AC: #10)
  - [x] 3.1 Import `SessionStatePanel` in `SessionDetail.tsx`
  - [x] 3.2 Add panel after existing panels with `session.workspacePath` guard

- [x] Task 4: Unit tests — SSE hook (AC: #9)
  - [x] 4.1 Create `packages/web/src/hooks/__tests__/useSessionStateSSE.test.ts`
  - [x] 4.2 Test initial null state
  - [x] 4.3 Test REST fetch and state population
  - [x] 4.4 Test SSE subscription with named event listener
  - [x] 4.5 Test state update on SSE message
  - [x] 4.6 Test reconnection on error
  - [x] 4.7 Test cleanup on unmount

- [x] Task 5: Unit tests — Panel component (AC: #8)
  - [x] 5.1 Create `packages/web/src/components/__tests__/SessionStatePanel.test.tsx`
  - [x] 5.2 Test renders execution mode badge
  - [x] 5.3 Test renders active agents list
  - [x] 5.4 Test renders progress bar for active modes
  - [x] 5.5 Test renders "No agents" when empty
  - [x] 5.6 Test renders health unavailable when health is null
  - [x] 5.7 Test handles exists: false state

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

Health check is deferred — the API returns `health: null` always. The panel should render a "not available" state for health. When the provider health integration is completed (deferred from 60-7), the panel will automatically show real health data.

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- [ ] `GET /api/session/[id]/state` — REST endpoint (created in Story 60-7)
- [ ] `GET /api/session/[id]/state/stream` — SSE endpoint (created in Story 60-7)
- [ ] `SessionState` type from `@composio/ao-core` (created in Story 60-7)
- [ ] `ActiveModeState` type from `@composio/ao-core` (created in Story 60-7)
- [ ] `SessionHealth` type from `@composio/ao-core` (created in Story 60-7)

**Feature Flags:**
- None. All required API endpoints and types exist from Story 60-7.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. Uses existing React, testing-library, and vitest.

## Dev Notes

### Architecture Context

This story is the eighth in Epic 60 (Dashboard Intelligence). It creates the client-side dashboard panel that consumes the API endpoints created in Story 60-7 (`GET /api/session/[id]/state` and `GET /api/session/[id]/state/stream`).

The panel displays real-time OMC execution state: execution mode, active agents, mode progress, and health status.

### Data Shape (from Story 60-7 API)

The REST endpoint returns:
```typescript
{
  sessionId: string;
  state: SessionState;  // from @composio/ao-core
  exists: boolean;
  readError?: boolean;  // true when state read threw
}
```

The SSE stream sends `event: state-update` with the same payload shape.

### SSE Hook Pattern — CRITICAL DIFFERENCE

The state SSE endpoint sends **named events** (`event: state-update`) unlike the notepad and timeline streams which use default `message` events. The hook MUST use:

```typescript
es.addEventListener("state-update", (event: MessageEvent) => {
  const data = JSON.parse(event.data);
  // update state
});
```

NOT `es.onmessage = ...` — that will NOT receive the named events.

### Card Wrapper Pattern

Follow the exact pattern from `NotepadViewer.tsx` and `TimelineViewer.tsx`:

```tsx
<div className="detail-card mb-6 rounded-[8px] border border-[var(--color-border-default)] p-5"
     data-testid="session-state-panel" role="region" aria-labelledby="session-state-heading">
  <div className="mb-3 flex items-center gap-2">
    <ActivityDot connected={connected} />
    <h3 id="session-state-heading" className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
      Session State
    </h3>
  </div>
  {/* content */}
</div>
```

### Component Structure

The panel should have these sections:

1. **Header** — "Session State" with ActivityDot (same as other panels)
2. **Execution Mode Badge** — e.g., "Standard" or "Autopilot" with colored background
3. **Active Agents Row** — agent names as small chips/badges
4. **Configured Indicator** — "Configured" (green) or "Not Configured" (muted)
5. **Active Modes Section** — one entry per mode with:
   - Mode name + active/inactive indicator
   - Progress bar (iteration / maxIterations) when available
   - Phase text when available
   - Task progress (X/Y) when available
6. **Health Section** — "Health check not available" (muted) since health is always null currently

### SessionDetail Integration Point

In `SessionDetail.tsx`, add after the existing panels (around line 461):

```tsx
{session.workspacePath && <SessionStatePanel sessionId={session.id} />}
```

### Import Conventions (MUST follow)

- **API types**: Import `SessionState`, `ActiveModeState`, `SessionHealth` from `@composio/ao-core` (NOT `@composio/ao-core/session-state` — that's for server-side only)
- **SSE hook**: Import from `@/hooks/useSessionStateSSE`
- **ActivityDot**: Import from `./ActivityDot` (same as NotepadViewer)
- **CSS**: Use CSS variables (`var(--color-*)`) — same as all other dashboard components

### Anti-Patterns to Avoid

- **DO NOT** use `es.onmessage` — the state stream uses named events (`event: state-update`). Use `es.addEventListener("state-update", ...)`.
- **DO NOT** call the `@composio/ao-core/session-state` sub-path export from client code — it's server-only (uses `node:fs`). Use the REST API instead.
- **DO NOT** import `"use client"` in the hook file unless it uses React state — the hook file already has `"use client"` from the pattern.
- **DO NOT** create a separate page for session state — it's a panel embedded in SessionDetail.
- **DO NOT** forget `"use client"` directive on the panel component — it uses React hooks.
- **DO NOT** forget `data-testid` and `role="region"` with `aria-labelledby` — accessibility requirement.
- **DO NOT** render health details beyond "not available" — `health` is always `null` (deferred from 60-7).

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 60, Story 60-8 definition, FR-D4-1, FR-D4-2]
- [Source: `packages/web/src/components/NotepadViewer.tsx` — Panel card wrapper pattern]
- [Source: `packages/web/src/components/TimelineViewer.tsx` — Panel with filtering pattern]
- [Source: `packages/web/src/components/CostBreakdownPanel.tsx` — Panel with data-testid and role]
- [Source: `packages/web/src/hooks/useNotepadSSE.ts` — SSE hook pattern with exponential backoff]
- [Source: `packages/web/src/hooks/useTimelineSSE.ts` — SSE hook pattern variant]
- [Source: `packages/web/src/components/SessionDetail.tsx` — Panel integration point (~line 461)]
- [Source: `packages/web/src/app/api/session/[id]/state/route.ts` — REST endpoint (Story 60-7)]
- [Source: `packages/web/src/app/api/session/[id]/state/stream/route.ts` — SSE endpoint (Story 60-7)]
- [Source: `packages/core/src/types.ts` — `SessionState`, `ActiveModeState`, `SessionHealth` interfaces]
- [Source: `_bmad-output/implementation-artifacts/60-7-session-state-api-route.md` — Previous story (60-7)]

### Previous Story Intelligence (60-7)

1. **API response shape**: `{ sessionId, state: SessionState, exists, readError? }` — the hook should destructure accordingly.
2. **SSE uses named events**: `event: state-update` — MUST use `addEventListener("state-update", ...)`, NOT `onmessage`.
3. **`emptySessionState()` is frozen**: The mock in tests returns `Object.freeze({...})`. Match this in test mocks.
4. **Read error distinction**: When `readError` is true, `exists` is false but the read actually failed. Consider showing a different message ("Failed to read state") vs just "No state available yet".
5. **Health is always null**: Don't build elaborate health UI — a simple "Health check not available" is sufficient.
6. **Best-effort pattern**: The API returns 200 with empty data, not errors. The hook should handle `exists: false` gracefully.
7. **Types available from `@composio/ao-core`**: `SessionState`, `ActiveModeState`, `SessionHealth` are exported from the main entry point.

### Previous Story Intelligence (60-6, 60-4, 60-2)

1. **Panel pattern is consistent**: All three panels use the same `detail-card mb-6 rounded-[8px] border...` wrapper with `ActivityDot` in the header.
2. **SSE hooks follow identical patterns**: `useNotepadSSE`, `useTimelineSSE` are nearly identical — copy the structure and adapt for state data + named events.
3. **Test patterns**: Panel tests mock the hook with `vi.mock("@/hooks/useSessionStateSSE", ...)`. Hook tests use `@testing-library/react` `renderHook` + manual EventSource mocking.
4. **CSS variables for colors**: Use `var(--color-text-muted)`, `var(--color-border-default)`, etc. — not hardcoded colors.

### Limitations (Deferred Items)

1. **Provider health display**
   - Status: Deferred — API returns `health: null` always (deferred from 60-7)
   - Requires: Provider health integration in core + API route
   - Current: Panel shows "Health check not available" in muted text

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 5 tasks implemented, all 22 subtasks complete
- 24 new tests (13 hook + 11 panel), all passing
- Full web test suite: 2687 tests pass, zero regressions
- SSE hook uses `addEventListener("state-update", ...)` for named events (NOT `onmessage`)
- Panel follows exact card wrapper pattern from NotepadViewer/TimelineViewer
- Health shows "not available" since health is always null (deferred from 60-7)
- ESLint clean after fix (eqeqeq: `!==` instead of `!=`)

**Code Review Fixes Applied:**
- M1: Fixed truthiness check hiding progress bar at iteration 0 — changed to `typeof` checks
- M2: Fixed `!== null` letting undefined through for optional fields — changed to `typeof` checks
- M3: Fixed health section block/inline layout — parent now flex, HealthIndicator uses inline-flex
- L1: Added tests for healthy/unhealthy health states (2 new tests)
- L2: Removed unused `onmessage` property from MockEventSource
- L3: Added sessionId assertion to panel test
- Post-review: 27 tests (13 hook + 14 panel), all passing

### File List

- `packages/web/src/hooks/useSessionStateSSE.ts` — NEW: SSE hook with named event support
- `packages/web/src/hooks/__tests__/useSessionStateSSE.test.ts` — NEW: 13 hook tests
- `packages/web/src/components/SessionStatePanel.tsx` — NEW: Panel component
- `packages/web/src/components/__tests__/SessionStatePanel.test.tsx` — NEW: 11 panel tests
- `packages/web/src/components/SessionDetail.tsx` — MODIFIED: Added SessionStatePanel import and rendering
- `_bmad-output/implementation-artifacts/60-8-session-state-dashboard-panel.md` — MODIFIED: Status → done, tasks marked complete
