# Story 10.2: Client-Side SSE Subscription & Auto-Refresh

Status: done

## Story

As a dashboard user,
I want the Workflow page to subscribe to SSE workflow-change events and automatically re-fetch data,
so that I see live updates as BMAD files change on disk without manual page refresh.

## Acceptance Criteria

1. **Given** the Workflow page is mounted with a selected project
   **When** a `workflow-change` SSE event is received on the existing `/api/events` stream
   **Then** the page re-fetches `GET /api/workflow/[project]` and updates all panels with fresh data

2. **Given** the SSE connection drops (network error, server restart)
   **When** the connection is re-established
   **Then** it automatically reconnects with no user action required, and triggers a fresh data fetch on reconnect

3. **Given** a `workflow-change` SSE event triggers a re-fetch
   **When** the API returns fresh `WorkflowResponse` data
   **Then** the UI updates smoothly with no flash/flicker (no loading skeleton shown on SSE-triggered refetches — only on initial page load)

4. **Given** the user navigates away from the Workflow page
   **When** the component unmounts
   **Then** the SSE subscription is cleaned up with no memory leaks (EventSource closed, no dangling callbacks)

5. **Given** the user switches the selected project while connected
   **When** a `workflow-change` event arrives
   **Then** the re-fetch uses the CURRENTLY selected project (not a stale project from closure capture)

6. **Given** multiple rapid `workflow-change` events arrive (e.g., user saves multiple files)
   **When** processing re-fetch requests
   **Then** fetches are debounced or deduplicated — at most one in-flight fetch at a time, latest event wins

## Tasks / Subtasks

- [x] Task 1: Create `useWorkflowSSE` hook (AC: 1, 2, 4, 5, 6)
  - [x] 1.1 Create `packages/web/src/hooks/useWorkflowSSE.ts`
  - [x] 1.2 Subscribe to existing `/api/events` SSE stream via `EventSource`
  - [x] 1.3 Filter for `workflow-change` event type in `onmessage` handler
  - [x] 1.4 Call `onWorkflowChange` callback when event detected
  - [x] 1.5 Implement auto-reconnect with exponential backoff on error (match `useSSEConnection` pattern: 1s, 2s, 4s, 8s cap)
  - [x] 1.6 Return cleanup function that closes `EventSource` on unmount
  - [x] 1.7 Call `onWorkflowChange` on reconnect (to fetch any missed changes)
- [x] Task 2: Integrate hook with WorkflowPage (AC: 1, 3, 5, 6)
  - [x] 2.1 Import and use `useWorkflowSSE` in `WorkflowPage.tsx`
  - [x] 2.2 On `onWorkflowChange` callback, trigger `GET /api/workflow/[project]` re-fetch
  - [x] 2.3 Use `useRef` for `selectedProject` to avoid stale closure in callback
  - [x] 2.4 Skip loading skeleton on SSE-triggered fetches (silent=true skips setLoading)
  - [x] 2.5 Implement fetch deduplication: abort in-flight fetch before starting new one (use `AbortController`)
- [x] Task 3: Write unit tests for `useWorkflowSSE` hook (AC: 1, 2, 4, 5, 6)
  - [x] 3.1 Create `packages/web/src/hooks/__tests__/useWorkflowSSE.test.ts`
  - [x] 3.2 Test: fires callback on `workflow-change` event
  - [x] 3.3 Test: ignores non-workflow-change events (snapshot, session.activity)
  - [x] 3.4 Test: reconnects automatically on error with backoff
  - [x] 3.5 Test: fires callback on reconnect
  - [x] 3.6 Test: cleans up EventSource on unmount
  - [x] 3.7 Test: does not fire after unmount (no state update on unmounted component)
- [x] Task 4: Write integration tests for WorkflowPage SSE behavior (AC: 1, 3, 5, 6)
  - [x] 4.1 Create `packages/web/src/components/__tests__/WorkflowPage.test.tsx`
  - [x] 4.2 Test: SSE workflow-change triggers re-fetch and updates data
  - [x] 4.3 Test: project switch updates ref so next SSE event fetches correct project
  - [x] 4.4 Test: no loading skeleton shown on SSE-triggered re-fetch
  - [x] 4.5 Test: rapid SSE events result in single fetch (deduplication)
- [x] Task 5: Lint, typecheck, verify (all ACs)
  - [x] 5.1 Run `pnpm lint` — clean
  - [x] 5.2 Run `pnpm typecheck` — clean
  - [x] 5.3 Run `pnpm test` — all 17 tests pass (12 unit + 5 integration)

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

- [x] No core interface methods used — this story is entirely within `packages/web`
- [x] No feature flags needed — uses built-in browser `EventSource` API

**Methods Used:**
- [x] `EventSource` — Browser built-in, always available
- [x] `fetch()` — Browser built-in, already used in `WorkflowPage.tsx`
- [x] `AbortController` — Browser built-in, already used in `WorkflowPage.tsx`

**Feature Flags:**
- None required

## Dependency Review (if applicable)

**No new dependencies required.** This story uses only browser-native APIs:
- `EventSource` for SSE subscription
- `fetch()` for data re-fetching
- `AbortController` for fetch cancellation
- React hooks (`useState`, `useEffect`, `useRef`, `useCallback`)

## Dev Notes

### Critical Architecture Decisions

**WD-5 (SSE Integration — Client Side):** Story 10-1 built the server side (file watcher → SSE dispatch). This story builds the CLIENT side: `useWorkflowSSE` hook listens for `workflow-change` events and triggers `WorkflowPage` to re-fetch fresh data from the API.

**WD-4 (Frozen API Contract):** The `WorkflowResponse` interface is FROZEN. Do NOT modify it. The SSE event is notification-only (`{ type: "workflow-change" }` — no payload). Client re-fetches `GET /api/workflow/[project]` to get fresh data. This is intentional: keeps SSE events lightweight, avoids data duplication.

**WD-6 (Props-Only Components):** All workflow panels (`PhaseBar`, `AIGuide`, `ArtifactInventory`, `AgentsPanel`, `LastActivity`) receive data as props from `WorkflowDashboard`. They do NOT subscribe to SSE internally. SSE subscription belongs ONLY in `WorkflowPage` (or its hook). When `WorkflowPage` re-fetches and sets new `data` state, React's normal re-render propagates fresh data to all panels.

**WD-7 (LKG State Pattern — Client Layer):** If an SSE-triggered refetch fails (network error), retain previous data in React state. No error toasts, no error banners — stale data is silently acceptable. Loading states ONLY on initial page load, NOT on SSE-triggered refetches. Full LKG caching is deferred to Story 10-3.

### Implementation Guide

#### File: `packages/web/src/hooks/useWorkflowSSE.ts` (NEW)

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Subscribes to SSE workflow-change events and calls onWorkflowChange callback.
 * Auto-reconnects with exponential backoff on connection errors.
 * Calls onWorkflowChange on reconnect to catch missed events.
 */
export function useWorkflowSSE(onWorkflowChange: () => void): void {
  const callbackRef = useRef(onWorkflowChange);

  // Keep callback ref in sync without re-triggering effect
  useEffect(() => {
    callbackRef.current = onWorkflowChange;
  }, [onWorkflowChange]);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let unmounted = false;

    function connect() {
      if (unmounted) return;

      // Close any existing connection (defensive against React Strict Mode re-runs)
      if (es) {
        es.close();
      }

      es = new EventSource("/api/events");

      es.onopen = () => {
        if (unmounted) return;
        const wasReconnect = reconnectAttempts > 0;
        reconnectAttempts = 0;
        if (wasReconnect) {
          // Fetch missed changes after reconnection
          callbackRef.current();
        }
      };

      es.onmessage = (event: MessageEvent) => {
        if (unmounted) return;
        try {
          const data = JSON.parse(event.data as string) as { type: string };
          if (data.type === "workflow-change") {
            callbackRef.current();
          }
        } catch {
          // Ignore malformed messages
        }
      };

      es.onerror = () => {
        if (unmounted) return;
        es?.close();
        // Exponential backoff: 1s, 2s, 4s, 8s (cap)
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 8000);
        reconnectAttempts++;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      unmounted = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []); // Empty deps — connect once on mount
}
```

**Key implementation details:**
1. `useRef` for callback avoids re-creating EventSource when callback identity changes.
2. `unmounted` flag prevents state updates after cleanup (React strict mode safe).
3. Reconnect logic mirrors `useSSEConnection.ts` pattern (1s, 2s, 4s, 8s cap).
4. On reconnect, fires callback immediately to fetch any changes missed during disconnection.
5. Only listens for `workflow-change` type — ignores `snapshot`, `session.activity`, etc.

**Why a separate hook (not extending `useSSEConnection`):**
- `useSSEConnection` is used by the Fleet page with different event handlers.
- Adding workflow-specific behavior there violates single responsibility.
- The architecture specifies `useWorkflowSSE` as a separate hook (WD-5 file tree).
- Both hooks connect to the SAME `/api/events` endpoint. The Workflow page only uses `useWorkflowSSE` (not `useSSEConnection`), so there is only ONE EventSource per page. If both hooks were ever used on the same page, that would create duplicate connections — see Limitations below.

#### File: `packages/web/src/components/WorkflowPage.tsx` (MODIFY)

**Current code** (lines 39-66) has fetch logic INLINED in a `useEffect`. You MUST refactor this into a reusable `fetchData` function that both the `useEffect` and SSE callback can call.

**Refactoring required — here is the EXACT diff to apply:**

```typescript
// ADD imports at top (line 3):
import { useState, useEffect, useCallback, useRef } from "react";
// ADD after existing imports:
import { useWorkflowSSE } from "@/hooks/useWorkflowSSE.js";

// INSIDE WorkflowPage component, REPLACE the existing useEffect (lines 39-66) with:

// Ref for selectedProject — avoids stale closure in SSE callback (AC5)
const selectedProjectRef = useRef(selectedProject);
useEffect(() => {
  selectedProjectRef.current = selectedProject;
}, [selectedProject]);

// Ref for in-flight AbortController — enables fetch deduplication (AC6)
const abortRef = useRef<AbortController | null>(null);

// Extracted fetch function — called by both initial load AND SSE refresh
const fetchData = useCallback(async (projectId: string, silent = false) => {
  // Abort any in-flight fetch (deduplication)
  if (abortRef.current) {
    abortRef.current.abort();
  }
  const controller = new AbortController();
  abortRef.current = controller;

  if (!silent) {
    setLoading(true);
    setError(null);
  }

  try {
    const res = await fetch(`/api/workflow/${encodeURIComponent(projectId)}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as WorkflowResponse;
    setData(json);
    if (!silent) setLoading(false);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    if (silent) {
      // WD-7 client layer: on silent refetch failure, keep existing data.
      // Do NOT setError, do NOT setLoading — user sees stale-but-valid data.
      return;
    }
    setError(err instanceof Error ? err.message : "Failed to load workflow data");
    setLoading(false);
  }
}, []);

// Initial fetch + re-fetch on project change
useEffect(() => {
  if (!selectedProject) return;
  fetchData(selectedProject);
  return () => {
    abortRef.current?.abort();
  };
}, [selectedProject, fetchData]);

// SSE subscription — re-fetch on workflow-change event
useWorkflowSSE(
  useCallback(() => {
    const project = selectedProjectRef.current;
    if (project) {
      fetchData(project, true); // silent: true → no loading skeleton (AC3)
    }
  }, [fetchData])
);
```

**Critical details for WorkflowPage modification:**
1. `silent` parameter prevents loading skeleton on SSE-triggered refetches (AC3).
2. `selectedProjectRef` ensures the callback always uses the CURRENT project, not a stale closure (AC5).
3. `abortRef` shared across all calls — each new fetch aborts the previous in-flight one (AC6).
4. Silent fetch failure: `return` without calling `setError` or `setLoading` — existing `data` preserved (WD-7).
5. The `useRef` import must be added to the existing import line (currently imports `useState, useEffect, useCallback`).

### Watched Paths (from Story 10-1)

The server-side watcher (already implemented in Story 10-1) monitors:
1. `_bmad-output/planning-artifacts/` — PRD, architecture, epics, UX docs
2. `_bmad-output/research/` — Research reports
3. `_bmad-output/implementation-artifacts/` — Sprint status, story files
4. `_bmad/_config/agent-manifest.csv` — Agent manifest (filtered for this specific file)

### Latency Budget (TS-05: <500ms end-to-end)

| Stage | Budget | Mechanism |
|---|---|---|
| File write → fs.watch detection | ~50ms | OS file system events (FSEvents on macOS) |
| Debounce stabilization | 200ms | Manual setTimeout (Story 10-1) |
| SSE dispatch | <50ms | In-memory callback (Story 10-1) |
| Client EventSource receive | ~10ms | localhost SSE |
| Client fetch + render | ~100ms | `GET /api/workflow/[project]` + React re-render |
| **Total** | **~410ms** | **Within 500ms budget** |

### Existing Code Patterns to Follow

**SSE client hook pattern** (from `hooks/useSSEConnection.ts`):
- `useRef` for handlers (avoids re-creating EventSource on handler change)
- Exponential backoff: `Math.min(1000 * Math.pow(2, attempts), 8000)`
- `onReconnected` callback pattern for fetching missed events
- Cleanup: close EventSource + clear timeout in useEffect return

**WorkflowPage data fetch pattern** (from `components/WorkflowPage.tsx`):
- `AbortController` for fetch cancellation
- `setLoading(true)` / `setLoading(false)` around fetch
- `setError(message)` on failure
- `setData(result)` on success
- Already handles project switching and URL management

**Testing pattern** (from `hooks/__tests__/useSSEConnection.test.ts`):
- Mock `EventSource` class with `onopen`, `onmessage`, `onerror` handlers
- Custom `eventSourceFactory` option for injecting mock
- `renderHook()` + `act()` + `waitFor()` from `@testing-library/react`
- Simulate events via `mockES.simulateOpen()`, `simulateError()`, `simulateMessage()`

### Testing Strategy

**Test file:** `packages/web/src/hooks/__tests__/useWorkflowSSE.test.ts`

**Approach:** Mock `EventSource` to simulate SSE events without real server. Use `renderHook()` from `@testing-library/react` for hook testing.

**Key test scenarios:**
1. **workflow-change fires callback:** Send `{ type: "workflow-change" }` message, verify callback called
2. **Ignores other event types:** Send `{ type: "snapshot" }`, verify callback NOT called
3. **Reconnect with backoff:** Simulate error, verify reconnect attempt after delay
4. **Reconnect fires callback:** After reconnect open, verify callback called (missed changes)
5. **Cleanup on unmount:** Unmount, verify EventSource closed and timeout cleared
6. **No calls after unmount:** Unmount then fire event, verify no callback

**Mocking pattern:**
```typescript
class MockEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  simulateOpen() { this.onopen?.(); }
  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }
  simulateError() { this.onerror?.(); }
}

// In test setup:
let mockES: MockEventSource;
vi.stubGlobal("EventSource", class {
  constructor() { mockES = new MockEventSource(); return mockES; }
});
```

**WorkflowPage integration tests:** `packages/web/src/components/__tests__/WorkflowPage.test.tsx`

Test the integration between SSE hook and page data flow. Mock both `EventSource` and `fetch()` to verify:
- SSE event → fetch triggered → data updated → components re-render
- Project switch → next SSE event fetches new project
- Silent fetch (no loading skeleton)
- Rapid events → only one fetch in flight

### Cross-Story Context

**Story 10-1 (complete):** Built the server-side watcher + SSE dispatch. This story consumes those events on the client.

**Story 10-3 (next):** Will add LKG caching to the API route. This story does NOT implement server-side LKG — it only handles client-side graceful degradation (retain existing data on fetch failure).

**Story 10-4:** Will add comprehensive tests for debounce timing, LKG matrix (30 scenarios), and panel independence. This story includes its own unit tests for the hook and basic WorkflowPage integration.

### Previous Story Learnings (Story 10-1)

From Story 10-1 implementation:
- **Module-level singleton** pattern works well for workflow watcher — export functions, not classes
- **`vi.hoisted()`** required for Vitest mock factories that reference variables (vi.mock is hoisted above declarations)
- **Mock `default` export for `node:fs`**: ESM interop requires `{ ...mod, default: mod }` pattern
- **`_resetForTesting()` export** enables test isolation for module-level state without `vi.resetModules()`
- **Code review caught 6 issues**: Missing error logging (AC6), overly broad directory watching, no cross-watcher debounce test, wrong coverage comment, missing init error test, no watcher cleanup
- **All 20 tests pass** after review fixes, lint clean, typecheck clean

### Limitations (Deferred Items)

1. Shared SSE Connection Manager
   - Status: Deferred - Not needed for current page architecture
   - Requires: Both `useSSEConnection` and `useWorkflowSSE` used on the same page
   - Current: Each hook creates its own EventSource. The Workflow page uses only `useWorkflowSSE`, the Fleet page uses only `useSSEConnection`. No duplicate connections in practice.
   - Future: If a page needs both Fleet and Workflow SSE events, consolidate into a shared EventSource connection manager.

### Project Structure Notes

- All new files go in `packages/web/src/hooks/` (SSE hook) or modify existing files in `packages/web/src/components/`
- ESM imports with `.js` extensions required
- `type` keyword for type-only imports
- Strict TypeScript mode
- No `any` — use `unknown` + type guards
- `"use client"` directive required for hook files using React hooks
- File naming: `kebab-case.ts`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#WD-5 SSE Integration]
- [Source: _bmad-output/planning-artifacts/architecture.md#WD-4 API Design & Contract]
- [Source: _bmad-output/planning-artifacts/architecture.md#WD-6 Component Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#WD-7 LKG State Pattern]
- [Source: _bmad-output/planning-artifacts/epics-workflow-dashboard.md#Epic 4 Story 2]
- [Source: packages/web/src/hooks/useSSEConnection.ts — existing SSE client hook (reconnect pattern)]
- [Source: packages/web/src/hooks/useSessionEvents.ts — existing SSE consumer (different pattern)]
- [Source: packages/web/src/components/WorkflowPage.tsx — current workflow page with fetch logic]
- [Source: packages/web/src/lib/workflow-watcher.ts — server-side watcher (Story 10-1)]
- [Source: packages/web/src/app/api/events/route.ts — SSE endpoint with workflow-change events]
- [Source: packages/web/src/lib/types.ts — SSEWorkflowChangeEvent interface]
- [Source: packages/web/src/lib/workflow/types.ts — frozen WorkflowResponse interface]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None

### Completion Notes List

- Created `useWorkflowSSE` hook with auto-reconnect (exponential backoff 1s→8s cap) and missed-event recovery on reconnect
- Refactored `WorkflowPage` fetch logic into extracted `fetchData(projectId, silent)` callback shared by initial load and SSE refresh
- `silent=true` path skips loading skeleton (AC3) and keeps LKG data on failure (WD-7)
- `selectedProjectRef` prevents stale closure in SSE callback (AC5)
- `AbortController` deduplicates rapid fetches (AC6)
- Code review fixed: loading state stuck when SSE interrupts initial fetch, vacuous test assertions, dedup test missing abort verification

### File List

- `packages/web/src/hooks/useWorkflowSSE.ts` — NEW: SSE subscription hook with reconnect and backoff
- `packages/web/src/hooks/__tests__/useWorkflowSSE.test.ts` — NEW: 12 unit tests for hook
- `packages/web/src/components/WorkflowPage.tsx` — MODIFIED: extracted fetchData, added SSE subscription, refs for dedup and stale closure prevention
- `packages/web/src/components/__tests__/WorkflowPage.test.tsx` — NEW: 5 integration tests for SSE-triggered refetch behavior
