# Story 60.4: Agent Activity Timeline Component

Status: done

## Story

As a developer using the dashboard,
I want a visual timeline component showing sub-agent activity per session,
so that I can see which agent ran when, what tools were used, and what files were touched — in real-time.

## Acceptance Criteria

1. **AC1 — `useTimelineSSE` hook**: A new custom hook at `packages/web/src/hooks/useTimelineSSE.ts` that:
   - Accepts `sessionId: string`
   - Returns `{ timeline: TimelineEntry[]; connected: boolean }`
   - Performs initial REST fetch from `/api/session/${sessionId}/timeline` for baseline data
   - Opens SSE connection to `/api/session/${sessionId}/timeline/stream`
   - Listens for `data.type === "timeline-update"` messages
   - Updates state when new timeline entries arrive
   - Implements exponential backoff reconnect (1s, 2s, 4s, 8s cap) on error
   - Cleans up EventSource and timers on unmount

2. **AC2 — `TimelineViewer` component**: A new `"use client"` component at `packages/web/src/components/TimelineViewer.tsx` that:
   - Accepts `{ sessionId: string }` props
   - Uses `useTimelineSSE(sessionId)` for all data fetching
   - Renders a scrollable timeline list of entries, each showing: timestamp, agent name, action description, tool/file info, duration
   - Color-codes entries by event type (agent events, tool events, file events, system events)
   - Shows an empty state "No timeline data yet." when timeline is empty
   - Shows connection status indicator (ActivityDot) in the header

3. **AC3 — Timeline entry rendering**: Each entry in the timeline displays:
   - Relative or absolute timestamp (formatted as `MM:SS` from session start)
   - Agent name with agent type badge
   - Human-readable action text (from `entry.action`)
   - Tool name (when `entry.tool` is present)
   - File path (when `entry.file` is present)
   - Duration badge (when `entry.duration` is present, formatted as `Xms` or `Xs`)
   - Success/failure indicator (when `entry.success` is present)

4. **AC4 — Color coding by event type**: Entries are visually distinguished:
   - Agent events (`agent_start`, `agent_stop`): primary color
   - Tool events (`tool_start`, `tool_end`): secondary color
   - File events (`file_touch`): accent color
   - System events (`intervention`, `error`, `hook_fire`, `hook_result`, `keyword_detected`, `skill_activated`, `skill_invoked`, `mode_change`): muted color

5. **AC5 — Card shell styling**: The component uses the established dashboard panel pattern:
   - Outer container: `detail-card rounded-[8px] border border-[var(--color-border-default)] p-5 mb-6`
   - Section header: `text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider`
   - ActivityDot for connection status next to the header text

6. **AC6 — Integration in SessionDetail**: The `TimelineViewer` is rendered in `packages/web/src/components/SessionDetail.tsx`:
   - Conditionally rendered when `session.workspacePath` exists (same pattern as NotepadViewer)
   - Placed below the NotepadViewer

7. **AC7 — Filtering UI**: The component provides filter controls:
   - Agent filter: text input that filters entries by agent name (case-insensitive)
   - Filters are applied client-side to the timeline data from the hook
   - Active filter shows count of matching entries

8. **AC8 — Unit tests for `useTimelineSSE` hook**: Comprehensive vitest tests covering:
   - Returns initial data from REST fetch
   - Updates state on SSE message
   - Sets connected=true on SSE open
   - Sets connected=false on SSE error
   - Reconnects with exponential backoff
   - Cleans up on unmount

9. **AC9 — Unit tests for `TimelineViewer` component**: Comprehensive vitest tests covering:
   - Renders timeline entries when data is available
   - Shows empty state when no data
   - Shows connection indicator
   - Passes sessionId to hook
   - Agent filter narrows displayed entries
   - Displays tool, file, duration, and success info

10. **AC10 — No new dependencies**: Uses only existing dependencies (React, no external timeline/chart libraries).

## Tasks / Subtasks

- [x] Task 1: Create `useTimelineSSE` hook (AC: #1)
  - [x] 1.1 Create `packages/web/src/hooks/useTimelineSSE.ts`
  - [x] 1.2 Implement initial REST fetch from `/api/session/${sessionId}/timeline`
  - [x] 1.3 Implement SSE connection to `/api/session/${sessionId}/timeline/stream`
  - [x] 1.4 Parse `timeline-update` events and update state
  - [x] 1.5 Implement exponential backoff reconnect (1s, 2s, 4s, 8s cap)
  - [x] 1.6 Implement cleanup on unmount (close EventSource, clear timers, mounted guard)

- [x] Task 2: Create `TimelineViewer` component (AC: #2, #3, #4, #5, #7)
  - [x] 2.1 Create `packages/web/src/components/TimelineViewer.tsx` with `"use client"` directive
  - [x] 2.2 Implement card shell with header and ActivityDot connection indicator
  - [x] 2.3 Implement timeline entry rendering (timestamp, agent, action, tool, file, duration, success)
  - [x] 2.4 Implement color coding by event type category
  - [x] 2.5 Implement agent filter text input with client-side filtering
  - [x] 2.6 Implement empty state ("No timeline data yet.")
  - [x] 2.7 Format timestamps as `MM:SS` from session start; durations as `Xms` or `Xs`

- [x] Task 3: Integrate in SessionDetail (AC: #6)
  - [x] 3.1 Add `TimelineViewer` import to `packages/web/src/components/SessionDetail.tsx`
  - [x] 3.2 Render `<TimelineViewer sessionId={session.id} />` conditionally on `session.workspacePath`
  - [x] 3.3 Place below the existing `<NotepadViewer />` component

- [x] Task 4: Unit tests — hook (AC: #8)
  - [x] 4.1 Create `packages/web/src/hooks/__tests__/useTimelineSSE.test.ts`
  - [x] 4.2 Test initial REST fetch returns data
  - [x] 4.3 Test SSE message updates state
  - [x] 4.4 Test connected=true on SSE open
  - [x] 4.5 Test connected=false on SSE error
  - [x] 4.6 Test exponential backoff reconnect
  - [x] 4.7 Test cleanup on unmount

- [x] Task 5: Unit tests — component (AC: #9)
  - [x] 5.1 Create `packages/web/src/components/__tests__/TimelineViewer.test.tsx`
  - [x] 5.2 Test renders timeline entries when data available
  - [x] 5.3 Test shows empty state when no data
  - [x] 5.4 Test shows connection indicator
  - [x] 5.5 Test passes sessionId to hook
  - [x] 5.6 Test agent filter narrows displayed entries
  - [x] 5.7 Test displays tool, file, duration, and success info

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

Time-range and tool-type filter UI deferred — the API supports `?from=` and `?to=` and `?tool=` query params, but the initial component only exposes agent filtering. Additional filter controls can be added later.

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
- [x] `useTimelineSSE(sessionId)` — NEW hook added by this story
- [x] `fetch(/api/session/${sessionId}/timeline)` — REST endpoint from Story 60-3
- [x] `EventSource(/api/session/${sessionId}/timeline/stream)` — SSE endpoint from Story 60-3

**Feature Flags:**
- Component only works for sessions with `workspacePath`. Sessions without OMC provider will show empty timeline (consistent with NotepadViewer behavior).

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] Check if dependency is necessary — No new external dependencies. Uses existing React, EventSource API, and patterns from NotepadViewer.

## Dev Notes

### Architecture Context

This story is the fourth in Epic 60 (Dashboard Intelligence). It consumes the timeline API and SSE stream from Story 60-3 and renders a visual timeline in the session detail view. It follows the exact same patterns as Story 60-2 (NotepadViewer + useNotepadSSE hook).

### Data Flow

```
OMC Provider → .omc/state/agent-replay-{sessionId}.jsonl
                    ↓
     Story 60-3: readTimeline() → GET /api/session/[id]/timeline
                    ↓
     Story 60-4: useTimelineSSE hook → TimelineViewer component
```

### API Endpoints Consumed

**REST** — `GET /api/session/${sessionId}/timeline`
- Response: `{ sessionId: string, timeline: TimelineEntry[], totalEntries: number }`
- Supports query params: `?agent=`, `?tool=`, `?from=`, `?to=` (not used by component initially)

**SSE** — `GET /api/session/${sessionId}/timeline/stream`
- Event type: `"timeline-update"`
- Payload: `{ type: "timeline-update", sessionId: string, timeline: TimelineEntry[], totalEntries: number }`
- Heartbeat: `: heartbeat\n\n` every 15s

### TimelineEntry Type (from @composio/ao-core)

```typescript
interface TimelineEntry {
  agent: string;          // e.g., "planner", "executor", "verifier"
  agentType: string;      // agent category
  action: string;         // human-readable, e.g., "Agent planner started", "Called Read"
  event: ReplayEventType; // 13 possible values
  timestamp: number;      // seconds since session start (float)
  duration?: number;      // milliseconds
  tool?: string;          // tool name
  file?: string;          // file path
  success?: boolean;      // outcome
  model?: string;         // model used
}
```

### ReplayEventType Categories for Color Coding

```typescript
const AGENT_EVENTS = ["agent_start", "agent_stop"];
const TOOL_EVENTS = ["tool_start", "tool_end"];
const FILE_EVENTS = ["file_touch"];
const SYSTEM_EVENTS = ["intervention", "error", "hook_fire", "hook_result", "keyword_detected", "skill_activated", "skill_invoked", "mode_change"];
```

### Component Pattern — Follow NotepadViewer Exactly

The component MUST follow the NotepadViewer pattern (Story 60-2):

1. **`"use client"` directive** at top of file
2. **Delegates ALL data fetching to custom hook** — component is purely presentational
3. **CSS classes for card shell:**
   - Outer: `detail-card rounded-[8px] border border-[var(--color-border-default)] p-5 mb-6`
   - Header: `text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider`
   - ActivityDot for connection status
4. **Empty state:** Card shell with header + "No timeline data yet." message
5. **No loading spinner** — SSE provides initial data; empty state shown while waiting
6. **No explicit error state** — hook absorbs errors, falls back to previous data

### Hook Pattern — Follow useNotepadSSE Exactly

The hook MUST follow the `useNotepadSSE` pattern:

```typescript
// State
const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
const [connected, setConnected] = useState(false);

// Refs
const esRef = useRef<EventSource | null>(null);
const retryRef = useRef(0);
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const mountedRef = useRef(true);

// Effect (depends on [sessionId])
useEffect(() => {
  mountedRef.current = true;

  // 1. Initial REST fetch
  fetch(`/api/session/${sessionId}/timeline`)
    .then(res => res.json())
    .then(data => { if (mountedRef.current) setTimeline(data.timeline ?? []); })
    .catch(() => {});

  // 2. SSE connection
  const connect = () => {
    const es = new EventSource(`/api/session/${sessionId}/timeline/stream`);
    esRef.current = es;

    es.onopen = () => { if (mountedRef.current) { setConnected(true); retryRef.current = 0; } };
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "timeline-update" && mountedRef.current) {
          setTimeline(data.timeline ?? []);
        }
      } catch {}
    };
    es.onerror = () => {
      if (mountedRef.current) setConnected(false);
      es.close();
      const delay = Math.min(1000 * 2 ** retryRef.current, 8000);
      retryRef.current++;
      timerRef.current = setTimeout(connect, delay);
    };
  };

  connect();

  // 3. Cleanup
  return () => {
    mountedRef.current = false;
    esRef.current?.close();
    if (timerRef.current) clearTimeout(timerRef.current);
  };
}, [sessionId]);
```

### SessionDetail Integration Point

In `packages/web/src/components/SessionDetail.tsx`, the NotepadViewer is rendered at approximately line 457:

```tsx
{session.workspacePath && <NotepadViewer sessionId={session.id} />}
```

Add TimelineViewer below it:

```tsx
{session.workspacePath && <NotepadViewer sessionId={session.id} />}
{session.workspacePath && <TimelineViewer sessionId={session.id} />}
```

### Timestamp Formatting

Timeline entries use `timestamp` as seconds since session start (float). Format as:

```typescript
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
```

Duration formatting:

```typescript
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
```

### Testing Standards

- **Framework**: vitest + React Testing Library
- **Hook tests**: Follow `useNotepadSSE.test.ts` pattern — mock EventSource, simulate events
- **Component tests**: Follow `NotepadViewer.test.tsx` pattern — mock the hook, test rendering
- **Mock pattern**: Use `vi.hoisted()` for mock references in `vi.mock()` factories
- **No `import()` type annotations** — use top-level `import type`
- **No `expect(true).toBe(true)`** — all assertions must verify real behavior
- **Run command**: `pnpm vitest run` in packages/web

### Import Conventions (MUST follow)

- **Package imports**: `import type { TimelineEntry, ReplayEventType } from "@composio/ao-core"` — NO `.js` extension
- **Local imports**: `import { useTimelineSSE } from "@/hooks/useTimelineSSE"` — NO `.js` extension
- **React imports**: `import { useState, useEffect, useRef } from "react"` — no path prefix needed

### Anti-Patterns to Avoid

- **DO NOT** add external dependencies (timeline libraries, chart libraries, animation libraries) — use pure CSS and React
- **DO NOT** fetch data directly in the component — delegate to `useTimelineSSE` hook
- **DO NOT** use `vi.useFakeTimers()` in SSE hook tests — breaks EventSource async
- **DO NOT** call the API with query params from the component initially — client-side filtering only (agent filter)
- **DO NOT** use loading spinners — follow the NotepadViewer pattern of showing empty state
- **DO NOT** forget `"use client"` directive — this is a client component using hooks
- **DO NOT** implement server-side rendering for this component — it requires browser APIs (EventSource)

### Limitations (Deferred Items)

1. **Tool-type and time-range filter UI**
   - Status: Deferred — API supports `?tool=`, `?from=`, `?to=` but initial UI only exposes agent filtering
   - Requires: Additional filter controls in the component
   - Current: Client-side agent name filter only

2. **Timeline visualization (Gantt-style)**
   - Status: Deferred — initial implementation is a scrollable list, not a visual Gantt chart
   - Requires: Canvas/SVG-based visualization or external chart library
   - Current: Simple scrollable list with color-coded entries

3. **Expandable entry details**
   - Status: Deferred — each entry shows summary info; full details (model, agent_type, success) could be shown on expand
   - Requires: Accordion or expandable row UI pattern
   - Current: All visible fields shown inline

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 60, Story 60-4 definition, FR-D2-2]
- [Source: `packages/core/src/types.ts:1258-1317` — `ReplayEventType`, `ReplayEvent`, `TimelineEntry` types]
- [Source: `packages/core/src/timeline.ts` — `readTimeline()` core module with `describeAction()` and `isValidReplayEvent()`]
- [Source: `packages/web/src/app/api/session/[id]/timeline/route.ts` — REST API response shape and query params]
- [Source: `packages/web/src/app/api/session/[id]/timeline/stream/route.ts` — SSE event shape and lifecycle]
- [Source: `packages/web/src/components/NotepadViewer.tsx` — Dashboard panel pattern to follow exactly]
- [Source: `packages/web/src/hooks/useNotepadSSE.ts` — SSE hook pattern to follow exactly]
- [Source: `packages/web/src/components/__tests__/NotepadViewer.test.tsx` — Component test pattern]
- [Source: `packages/web/src/hooks/__tests__/useNotepadSSE.test.ts` — Hook test pattern with MockEventSource]
- [Source: `packages/web/src/components/SessionDetail.tsx:457` — Integration point for dashboard panels]
- [Source: `_bmad-output/implementation-artifacts/60-3-agent-timeline-api-route.md` — Previous story (API route) and review fixes]

### Previous Story Intelligence (60-3)

**Key learnings from 60-3 that impact this story:**

1. **Runtime validation added**: `readTimeline()` now validates parsed JSON via `isValidReplayEvent()` — rejects entries without valid `event` type or numeric `t`. The component will never receive malformed entries.

2. **SSE `snapshotSent` flag**: The timeline SSE stream only starts polling if the initial snapshot was successfully sent. If service init fails, no spurious events are sent.

3. **Consistent `vi.hoisted()` pattern**: Both route test files now use `vi.hoisted()` for mock references. Component and hook tests should use the same pattern.

4. **Real timers for SSE tests**: SSE tests CANNOT use `vi.useFakeTimers()` — it blocks ReadableStream/EventSource async primitives. Use real timers with explicit timeouts.

5. **No `expect(true).toBe(true)`**: All assertions must be real — code review caught and fixed this.

6. **`let entries: TimelineEntry[]`**: Explicit type annotations are required (not implicit `any` from bare `let`).

### Previous Story Intelligence (60-2)

**Key learnings from 60-2 that impact this story:**

1. **`session.workspacePath` is the correct field**: The Session interface uses `workspacePath` (not `worktreePath`). Conditionally render on this field.

2. **Best-effort pattern**: Missing data returns empty arrays (200), not errors. The component should handle empty timeline gracefully.

3. **SSE uses standard EventSource format**: `data: {...}\n\n` — compatible with browser's native EventSource API.

4. **MockEventSource pattern for hook tests**: The `useNotepadSSE.test.ts` established a `MockEventSource` class with `simulateOpen/Error/Message` methods and `mockInstances` array. Timeline hook tests should use the same pattern.

5. **vi.hoisted() for mock references**: Required when mock instances are referenced in `vi.mock()` factory functions.

### Previous Story Intelligence (60-1)

1. **Object.freeze for empty response constants**: Dashboard components should handle immutable data safely.

2. **SSE race condition fix**: Poll starts after initial snapshot completes. Hook should handle this gracefully by relying on the REST fetch for initial data.

3. **`export const dynamic = "force-dynamic"`**: Both REST and SSE routes have this — no caching issues.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (claude-sonnet-4-6)

### Debug Log References

1. **ESLint: `SYSTEM_EVENTS` unused** — Prefixed with `_` since it's used only for category lookup completeness, not directly referenced.
2. **ESLint: `!=` instead of `!==`** — Changed all `!= null` checks to explicit `!== null && !== undefined` for `eqeqeq` rule compliance.
3. **ESLint: `TimelineViewer` unused after import** — Expected, resolved by also adding the JSX usage in SessionDetail in the same edit sequence.

### Completion Notes List

1. All 10 ACs implemented and verified with tests.
2. `useTimelineSSE` hook follows exact `useNotepadSSE` pattern — REST fetch + SSE EventSource + exponential backoff (1s, 2s, 4s, 8s cap) + mounted guard.
3. `TimelineViewer` component follows `NotepadViewer` pattern — card shell, ActivityDot connection indicator, empty state, agent filter with count.
4. Color coding by event category: agent (accent/blue), tool (green/ready), file (amber/attention), system (muted).
5. Timestamps formatted as MM:SS from session start. Durations as Xms or X.Xs.
6. Integration: rendered below NotepadViewer, conditionally on `session.workspacePath`.
7. Test counts: Web 2609 passed (27 new), Core 2495 passed, 0 regressions.
8. Post-review fixes applied (see Senior Developer Review below).

## Senior Developer Review

### Review Findings

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| M1 | MEDIUM | `entry.file` not explicitly rendered; no file display test | Fixed |
| M2 | MEDIUM | `_SYSTEM_EVENTS` array is dead code (never read) | Fixed |
| L1 | LOW | `entry.agentType` not displayed in UI | Fixed |
| L2 | LOW | Disconnected ActivityDot test is weak (no behavioral assertion) | Fixed |
| L3 | LOW | `agentFilter.trim()` computed twice per render | Fixed |

### Fixes Applied

**M1 — File path rendering**: Added `<span>` for `entry.file` after action text with monospace font, truncate, max-width, and title tooltip. Added test "displays file path in entries" verifying `src/main.ts` renders.

**M2 — Dead code removal**: Removed unused `_SYSTEM_EVENTS` array. The `getCategory()` function already falls through to `"system"` via the else branch, making the explicit array unnecessary.

**L1 — AgentType badge**: Added `entry.agentType` badge rendering as a small muted pill next to the agent name badge. Added test "displays agentType badge" verifying both "planner" and "executor" type badges appear.

**L2 — Stronger disconnected test**: Updated test to assert `toHaveStyle({ background: "var(--color-status-idle)" })` on the ActivityDot div, distinguishing it from the connected state which uses `var(--color-status-working)`.

**L3 — Trim optimization**: Extracted `const trimmedFilter = agentFilter.trim()` to avoid computing it twice per render (once in filter logic, once in conditional rendering).

### Post-Review Test Results

Web: 2611 passed (29 new), 0 regressions.

### File List

**New files (2 source + 2 test = 4):**
- `packages/web/src/hooks/useTimelineSSE.ts` — SSE hook for timeline data
- `packages/web/src/components/TimelineViewer.tsx` — Timeline viewer component
- `packages/web/src/hooks/__tests__/useTimelineSSE.test.ts` — Hook tests (15 tests)
- `packages/web/src/components/__tests__/TimelineViewer.test.tsx` — Component tests (12 tests)

**Modified files (1):**
- `packages/web/src/components/SessionDetail.tsx` — Added TimelineViewer import and render
