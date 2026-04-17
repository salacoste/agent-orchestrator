# Story 60.2: Notepad Dashboard Panel

Status: done

## Story

As a developer using the dashboard,
I want a panel in the session detail view that displays the agent's notepad contents (Priority, Working Memory, Manual) with real-time updates,
so that I can see what the agent is thinking and working on without leaving the dashboard.

## Acceptance Criteria

1. **AC1 — NotepadViewer component**: A new `"use client"` component at `packages/web/src/components/NotepadViewer.tsx` that renders the notepad contents for a session. Accepts `sessionId: string` as a prop.

2. **AC2 — Three-tab layout**: The panel displays three tabs: "Priority", "Working Memory", "Manual" — matching the notepad's `{ priority, working, manual }` structure. Uses the SprintBoard underline tab pattern with design tokens (`border-[var(--color-accent)]`, `text-[var(--color-text-primary)]` for active tab). Active tab is "Priority" by default.

3. **AC3 — Content rendering**: Each tab renders its notepad section as preformatted text (`whitespace-pre-wrap`). Empty sections display a muted message: "No content yet." in `text-[var(--color-text-secondary)] text-[12px]`.

4. **AC4 — useNotepadSSE hook**: A new hook at `packages/web/src/hooks/useNotepadSSE.ts` that:
   - Fetches initial notepad data from `GET /api/session/${sessionId}/notepad`
   - Connects to `GET /api/session/${sessionId}/notepad/stream` via `EventSource`
   - Parses `notepad-update` events to update state
   - Returns `{ notepad: NotepadData | null, exists: boolean, connected: boolean }`
   - Uses `useRef` for the EventSource to avoid stale closures
   - Cleans up EventSource on unmount or sessionId change
   - Implements exponential backoff reconnection (1s, 2s, 4s, 8s cap) following the pattern in `useWorkflowSSE.ts`

5. **AC5 — Collapsible panel**: The notepad panel uses the `detail-card` CSS class pattern from `SessionDetail.tsx` (rounded-[8px], border, p-5, gradient bg). Panel header shows "Agent Notepad" in `text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider`. When `exists === false`, renders a muted empty state message and skips SSE connection.

6. **AC6 — Integration into SessionDetail**: The `NotepadViewer` component is rendered in `SessionDetail.tsx` between the PR Card section and the Terminal section, within the existing `max-w-[900px] px-8 py-6` container. Only rendered when `session.workspacePath` is truthy.

7. **AC7 — Unit tests for useNotepadSSE hook**: Comprehensive vitest tests at `packages/web/src/hooks/__tests__/useNotepadSSE.test.ts` covering:
   - Returns initial null state before fetch completes
   - Fetches initial data from REST endpoint
   - Updates state on SSE `notepad-update` event
   - Cleans up EventSource on unmount
   - Reconnects with exponential backoff on error
   - Handles missing notepad gracefully (exists: false)

8. **AC8 — Unit tests for NotepadViewer component**: Comprehensive vitest tests at `packages/web/src/components/__tests__/NotepadViewer.test.tsx` covering:
   - Renders three tabs
   - Displays content for active tab
   - Shows empty state message when content is empty
   - Shows empty state panel when `exists === false`
   - Tab switching updates displayed content

## Tasks / Subtasks

- [x] Task 1: Create useNotepadSSE hook (AC: #4, #7)
  - [x] 1.1 Create `packages/web/src/hooks/useNotepadSSE.ts`
  - [x] 1.2 Define NotepadData type: `{ priority: string; working: string; manual: string }`
  - [x] 1.3 Implement initial fetch from `/api/session/${sessionId}/notepad`
  - [x] 1.4 Implement EventSource connection to `/api/session/${sessionId}/notepad/stream`
  - [x] 1.5 Parse `notepad-update` SSE events, update state
  - [x] 1.6 Implement exponential backoff reconnection (1s, 2s, 4s, 8s cap)
  - [x] 1.7 Cleanup EventSource on unmount and sessionId change
  - [x] 1.8 Return `{ notepad, exists, connected }` from hook
  - [x] 1.9 Create `packages/web/src/hooks/__tests__/useNotepadSSE.test.ts` with all AC7 tests

- [x] Task 2: Create NotepadViewer component (AC: #1, #2, #3, #5, #8)
  - [x] 2.1 Create `packages/web/src/components/NotepadViewer.tsx` as `"use client"`
  - [x] 2.2 Implement three-tab layout with SprintBoard underline pattern + design tokens
  - [x] 2.3 Render content with `whitespace-pre-wrap`, empty state messages
  - [x] 2.4 Use detail-card styling (rounded-[8px], border, p-5)
  - [x] 2.5 Show "Agent Notepad" header, handle exists=false with muted message
  - [x] 2.6 Call useNotepadSSE(sessionId) for data
  - [x] 2.7 Create `packages/web/src/components/__tests__/NotepadViewer.test.tsx` with all AC8 tests

- [x] Task 3: Integrate into SessionDetail (AC: #6)
  - [x] 3.1 Import NotepadViewer in `packages/web/src/components/SessionDetail.tsx`
  - [x] 3.2 Add `<NotepadViewer sessionId={session.id} />` between PR Card and Terminal section
  - [x] 3.3 Only render when `session.workspacePath` is truthy

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

Notepad editing (PUT endpoint) is deferred — the notepad is agent-managed, the dashboard is read-only.

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- [x] `GET /api/session/[id]/notepad` — REST endpoint (created in Story 60-1)
- [x] `GET /api/session/[id]/notepad/stream` — SSE endpoint (created in Story 60-1)
- [x] No core service methods needed — purely frontend consuming existing API

**Feature Flags:**
- Notepad panel only works for sessions that have a workspace with `.omc/notepad.md`. Sessions without OMC provider will show the "No notepad content" empty state.

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review (if applicable)

**For stories that add new dependencies:**

- [x] No new external dependencies. Uses existing React, browser EventSource API, and the notepad API endpoints from Story 60-1.

## Dev Notes

### Architecture Context

This story is the frontend counterpart to Story 60-1 (Notepad API Route). The API routes are already built and tested — this story creates the dashboard UI that consumes them.

The notepad panel fits into the Session Detail page, which is the drill-down view when a user clicks on a session in the fleet monitoring matrix.

### API Endpoints Available (from Story 60-1)

**REST:** `GET /api/session/[id]/notepad`
```typescript
// Response (200):
{ sessionId: string; notepad: { priority: string; working: string; manual: string }; exists: boolean }
// Error (404): { error: "Session not found" }
// Error (500): { error: "Internal server error" }
```

**SSE:** `GET /api/session/[id]/notepad/stream`
- Event type: `notepad-update`
- Event data: `{ type: "notepad-update", sessionId: string, notepad: { priority, working, manual }, exists: boolean }`
- Heartbeat: `: heartbeat\n\n` every 15 seconds
- Content changes detected via MD5 hash, polled every 5 seconds

### How Components Work in This Project

Every dashboard component follows this pattern:
1. `"use client"` directive at top of file
2. Props interface defined inline in the same file
3. Uses design token CSS variables (never hard-coded colors)
4. Empty states render muted text, not skeletons
5. Panel sections use `detail-card` CSS class or `border border-[var(--color-border-default)] rounded-[6px]`

### Tab Pattern (from SprintBoard)

Use this exact tab pattern:
```tsx
<div className="flex gap-1 border-b border-[var(--color-border-default)]">
  {tabs.map((tab) => (
    <button
      key={tab.key}
      onClick={() => setActiveTab(tab.key)}
      className={`px-4 py-2 text-[12px] font-semibold transition-colors border-b-2 ${
        activeTab === tab.key
          ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
          : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
      }`}
    >
      {tab.label}
    </button>
  ))}
</div>
```

### SSE Hook Pattern (from useWorkflowSSE)

Create a dedicated `useNotepadSSE(sessionId)` hook. Key pattern from existing hooks:

```tsx
// Use useRef for EventSource to avoid stale closures
const esRef = useRef<EventSource | null>(null);
const retryRef = useRef(0);

// Cleanup function
useEffect(() => {
  // ... setup
  return () => {
    esRef.current?.close();
  };
}, [sessionId]);

// Exponential backoff: 1s, 2s, 4s, 8s cap
const backoff = Math.min(1000 * 2 ** retryRef.current, 8000);
```

**CRITICAL:** Do NOT use the global `/api/events` SSE bus — the notepad has its own dedicated SSE stream at `/api/session/[id]/notepad/stream`.

### Insertion Point in SessionDetail

File: `packages/web/src/components/SessionDetail.tsx`

Insert the `NotepadViewer` between the PR Card section and the Terminal section, within the existing layout:
```tsx
{/* Notepad Panel — only show when session has workspace */}
{session.workspacePath && (
  <NotepadViewer sessionId={session.id} />
)}
```

The session detail layout is: Header → Linked Story Card → PR Card → **Notepad Panel** → Terminal

### Import Conventions (MUST follow)

- **Component imports**: `import { NotepadViewer } from "./NotepadViewer"` — relative for sibling components
- **Hook imports**: `import { useNotepadSSE } from "@/hooks/useNotepadSSE"` — `@/` for hooks
- **NO `.js` extensions** on local imports in the web package

### Testing Standards

- **Framework**: vitest + @testing-library/react
- **Hook testing**: Use `@testing-library/react` `renderHook` for `useNotepadSSE`
- **Component testing**: Use `render` + `screen` from `@testing-library/react`
- **Mocking SSE**: Mock EventSource constructor in hook tests
- **Mocking fetch**: Mock global fetch for initial REST data
- **Location**: Co-located test files (`__tests__/` directories)
- **Run command**: `pnpm test` from repo root, or `pnpm vitest run` in packages/web

### Anti-Patterns to Avoid

- **DO NOT** use hard-coded Tailwind colors (e.g., `text-blue-600`) — always use design tokens `var(--color-*)`
- **DO NOT** create a shared Tab component — inline the tab pattern following SprintBoard's approach
- **DO NOT** use the global SSE bus `/api/events` — use the dedicated notepad SSE stream
- **DO NOT** add external dependencies — use browser's native `EventSource` API
- **DO NOT** forget to clean up EventSource on unmount — memory leak risk
- **DO NOT** render the panel for sessions without `workspacePath` — they can't have notepads
- **DO NOT** use `clsx` or `classnames` — use the project's `cn()` utility from `@/lib/cn`

### Limitations (Deferred Items)

1. **Notepad editing (PUT endpoint)**
   - Status: Deferred — not in scope for this story
   - Requires: API write endpoint + edit UI
   - Current: Dashboard is read-only, notepad writes are agent-only

2. **Notepad content formatting (markdown rendering)**
   - Status: Deferred — plain text display is sufficient for initial implementation
   - Requires: Markdown rendering library or custom renderer
   - Current: Raw text with `whitespace-pre-wrap`

### References

- [Source: `_bmad-output/planning-artifacts/epics-cycle-11.md` — Epic 60, Story 60-2 definition, FR-D1-2]
- [Source: `packages/web/src/components/SessionDetail.tsx` — Session detail page, insertion point]
- [Source: `packages/web/src/components/SprintBoard.tsx` — Tab pattern with design tokens]
- [Source: `packages/web/src/hooks/useWorkflowSSE.ts` — SSE hook pattern with reconnection]
- [Source: `packages/web/src/hooks/useConflictSSE.ts` — Another SSE hook pattern]
- [Source: `packages/web/src/components/SprintCostPanel.tsx` — Panel section pattern]
- [Source: `packages/web/src/app/api/session/[id]/notepad/route.ts` — REST API (Story 60-1)]
- [Source: `packages/web/src/app/api/session/[id]/notepad/stream/route.ts` — SSE API (Story 60-1)]
- [Source: `packages/web/src/app/globals.css` — Design tokens and CSS classes]
- [Source: `_bmad-output/implementation-artifacts/60-1-notepad-api-route.md` — Previous story]

### Previous Story Intelligence (60-1)

**Key learnings from 60-1 that impact this story:**

1. **session.workspacePath is the correct field**: The Session interface uses `workspacePath` (not `worktreePath`). The notepad panel should only render when this is truthy.

2. **readNotepad() returns empty strings for missing files**: The API handles the "no notepad" case by returning `exists: false` with empty strings. The frontend should show an empty state when `exists === false`.

3. **SSE stream sends initial snapshot immediately**: On connection, the stream sends the current notepad data before starting the 5-second poll. The hook should set initial state from this first event.

4. **SSE uses standard EventSource format**: Events are `data: {...}\n\n` format — compatible with the browser's native `EventSource` API. No special parsing needed.

5. **Full test suite: 204 test files, 2539 tests pass**: New tests should follow the established mocking patterns and not break existing tests.

6. **Best-effort pattern**: The API returns graceful empty states rather than errors. The frontend should handle these without showing error UI.

### Git Intelligence

Recent commits show active development on Cycle 11 (Epic 60). The notepad API route was just completed with 12 tests. The frontend panel is the natural next step.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 3 tasks completed: useNotepadSSE hook, NotepadViewer component, SessionDetail integration
- 24 new tests (17 hook + 7 component), all passing with real assertions
- Full suite: 206 files, 2563 tests, 0 regressions
- Hook uses same MockEventSource pattern as useWorkflowSSE.test.ts
- Component tests mock useNotepadSSE via vi.mock

### File List

- `packages/web/src/hooks/useNotepadSSE.ts` — NEW: SSE hook with REST fetch + EventSource + exponential backoff
- `packages/web/src/components/NotepadViewer.tsx` — NEW: Three-tab notepad viewer component
- `packages/web/src/components/SessionDetail.tsx` — MODIFIED: Added NotepadViewer between PR Card and Terminal
- `packages/web/src/hooks/__tests__/useNotepadSSE.test.ts` — NEW: 17 hook tests (AC7)
- `packages/web/src/components/__tests__/NotepadViewer.test.tsx` — NEW: 7 component tests (AC8)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 | **Date:** 2026-04-14 | **Outcome:** Approved

### Findings Fixed

1. **[M1/L1] Connected state not surfaced in UI** — Added `ActivityDot` indicator to panel header showing SSE connection status (active/idle dot) when `exists === true`. Destructures `connected` from hook.
2. **[L2] act() warning in backoff reset test** — Wrapped `simulateError()` in `act()` to eliminate React state update warning in stderr.
3. **[L3] Status promoted to done** — All ACs verified implemented, all tasks complete, 2563 tests passing.

### Verification

- All 8 ACs: IMPLEMENTED
- All 13 subtasks: Verified complete
- No security issues (React auto-escapes `<pre>`, no dangerouslySetInnerHTML)
- No new dependencies
- 206 test files, 2563 tests, 0 regressions
