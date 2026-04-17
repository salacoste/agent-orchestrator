# Story 49.4: Real-Time SSE Updates

Status: done

## Story

As a **project manager**,
I want **the portfolio dashboard to update in real-time without refreshing**,
So that **I always see the current state of all projects**.

## Acceptance Criteria

1. **Given** the portfolio dashboard is open
   **When** any project state changes (agent spawned, story completed, etc.)
   **Then** the affected project card updates within 3 seconds
   **And** aggregated metrics recalculate automatically

2. **Given** the portfolio dashboard is open
   **When** multiple rapid updates occur
   **Then** updates are batched/throttled to prevent UI jank
   **And** the final state is correct after throttling completes

3. **Given** the portfolio dashboard is open
   **When** the SSE connection is lost
   **Then** the UI shows a subtle connection indicator
   **And** automatic reconnection occurs with exponential backoff

4. **Given** the portfolio dashboard receives an SSE update
   **When** the affected project's data changes
   **Then** only that project card re-renders (not the entire page)
   **And** the update is visually smooth (no layout shift)

5. **Given** a project card receives updated data
   **When** a key metric changes (agent count, story status, health score)
   **Then** the change is briefly highlighted to draw attention

## Tasks / Subtasks

- [x] Task 1: Optimize SSE handler for granular updates (AC: #1, #4)
  - [x] 1.1: Analyze current SSE implementation in PortfolioView.tsx
  - [x] 1.2: Replace `router.refresh()` with targeted state updates using `setProjects()`
  - [x] 1.3: Parse SSE event data to identify which project changed
  - [x] 1.4: Update only the affected project in the projects array
  - [x] 1.5: Ensure memoization prevents unnecessary re-renders of unchanged cards

- [x] Task 2: Enhance SSE event data with project context (AC: #1)
  - [x] 2.1: Review `/api/events` route to understand event payload format
  - [x] 2.2: Add `projectId` to `session.activity` events if not present
  - [x] 2.3: Ensure event data includes enough context to update project card

- [x] Task 3: Add connection status indicator (AC: #3)
  - [x] 3.1: Add `connectionStatus` state to PortfolioView ("connected" | "reconnecting" | "disconnected")
  - [x] 3.2: Display subtle indicator (dot or icon) in header when reconnecting
  - [x] 3.3: Use CSS transitions for smooth status changes
  - [x] 3.4: Hide indicator when connected (no distraction)

- [x] Task 4: Implement change highlighting (AC: #5)
  - [x] 4.1: Add `lastUpdated` timestamp to each project in state
  - [x] 4.2: When project updates, set `lastUpdated: Date.now()`
  - [x] 4.3: In ProjectCard, add highlight class when `lastUpdated` is recent (<2s)
  - [x] 4.4: Use CSS animation for brief flash/pulse effect
  - [x] 4.5: Clear highlight after animation completes

- [x] Task 5: Add update batching/throttling (AC: #2)
  - [x] 5.1: Implement 500ms debounce for rapid SSE updates
  - [x] 5.2: Batch multiple project updates into single state update
  - [x] 5.3: Ensure final state is always consistent after throttle

- [x] Task 6: Write tests (AC: #1-5)
  - [x] 6.1: Test SSE event triggers targeted project update (not full refresh)
  - [x] 6.2: Test connection status indicator renders correctly
  - [x] 6.3: Test change highlight appears on project update
  - [x] 6.4: Test rapid updates are throttled correctly
  - [x] 6.5: Test metrics recalculate after project update
  - [x] 6.6: Test graceful degradation when SSE unavailable

## Task Completion Validation

- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no `expect(true).toBe(true)`)
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] File List includes all changed files

## Interface Validation

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags

**Methods Used:**
- [x] `sessionManager.list()` — Already used for session data
- [x] `/api/events` SSE route — Already exists, may need payload enhancement

**Feature Flags:**
- None expected — SSE infrastructure exists from Story 49.2

## Dependency Review

No new dependencies required. Uses existing:
- Next.js 15 (App Router)
- React 19 (useState, useEffect, useCallback, useMemo)
- Existing SSE infrastructure from `/api/events`
- Existing design tokens from globals.css

## CLI Integration Testing

N/A — This is a frontend-only feature with no CLI changes.

## Dev Notes

### Architecture Context

This is **Story 4 of 5** in **Epic 49: Portfolio Dashboard**. It builds on:
- **Story 49.1** (done): Portfolio page structure, ProjectCard, PortfolioGrid, PortfolioView
- **Story 49.2** (done): Aggregated metrics widget with basic SSE subscription
- **Story 49.3** (done): Project drill-down navigation with routing

### Current SSE Implementation (from Story 49.2)

PortfolioView.tsx already has SSE subscription but uses `router.refresh()` for full page updates:

```typescript
// Current implementation (inefficient for granular updates)
es.onmessage = (event: MessageEvent) => {
  try {
    const data = JSON.parse(event.data as string) as { type: string };
    if (data.type === "session.activity") {
      throttledRefresh(); // Calls router.refresh() - full page refresh!
    }
  } catch {
    // Ignore malformed messages
  }
};
```

**Problem:** `router.refresh()` re-renders the entire server component tree, causing all project cards to re-render even when only one project changed.

**Solution:** Parse event data, identify affected project, update only that project in local state.

### Key Architecture Decisions (from architecture.md)

1. **SSE via Redis Event Bus** — Events published to Redis, consumed by `/api/events` route
2. **Polling-based SSE** — Server polls `sessionManager.list()` every 5s, pushes snapshots
3. **Heartbeat** — `: heartbeat\n\n` comments every 15s keep connection alive
4. **Response headers** — `Cache-Control: no-cache`, `X-Accel-Buffering: no`

### Event Payload Analysis

From `/api/events` route, events follow this format:
```typescript
{
  type: "session.activity",
  data: {
    sessionId: string;
    projectId: string; // Should be present for project filtering
    status: string;
    // ... other session fields
  }
}
```

**Task 2** ensures `projectId` is in the payload so we can filter updates to specific projects.

### Granular Update Pattern

Instead of `router.refresh()`, use local state updates:

```typescript
// Proposed implementation
const [projects, setProjects] = useState<PortfolioProject[]>(initialProjects);

es.onmessage = (event: MessageEvent) => {
  try {
    const data = JSON.parse(event.data as string) as {
      type: string;
      data?: { projectId?: string };
    };

    if (data.type === "session.activity" && data.data?.projectId) {
      setProjects(prev => {
        // Update only the affected project
        return prev.map(p =>
          p.id === data.data!.projectId
            ? { ...p, lastUpdated: Date.now() }
            : p
        );
      });
    }
  } catch {
    // Ignore malformed messages
  }
};
```

### Change Highlight Pattern

Use a brief CSS animation when project data changes:

```typescript
// ProjectCard.tsx
interface ProjectCardProps {
  project: PortfolioProject;
  onClick?: () => void;
}

// In component:
const isHighlighted = project.lastUpdated &&
  Date.now() - project.lastUpdated < 2000;

<div className={`
  ...existing classes
  ${isHighlighted ? "animate-highlight" : ""}
`}>
```

```css
/* globals.css or tailwind */
@keyframes highlight {
  0% { background-color: var(--color-bg-surface); }
  50% { background-color: var(--color-bg-info); }
  100% { background-color: var(--color-bg-surface); }
}

.animate-highlight {
  animation: highlight 1s ease-out;
}
```

### Connection Status Indicator

Subtle indicator in header, not intrusive:

```typescript
// PortfolioView.tsx
const [connectionStatus, setConnectionStatus] = useState<"connected" | "reconnecting">("connected");

// In SSE handlers:
es.onopen = () => setConnectionStatus("connected");
es.onerror = () => setConnectionStatus("reconnecting");

// In render:
{connectionStatus === "reconnecting" && (
  <span className="ml-2 text-xs text-yellow-600">
    Reconnecting...
  </span>
)}
```

### Update Batching Pattern

For rapid updates, batch into single state change:

```typescript
const pendingUpdatesRef = useRef<Map<string, PortfolioProject>>(new Map());
const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const scheduleFlush = useCallback(() => {
  if (flushTimeoutRef.current) return;

  flushTimeoutRef.current = setTimeout(() => {
    setProjects(prev => {
      const updates = pendingUpdatesRef.current;
      pendingUpdatesRef.current = new Map();
      flushTimeoutRef.current = null;

      return prev.map(p => {
        const update = updates.get(p.id);
        return update ? { ...p, ...update, lastUpdated: Date.now() } : p;
      });
    });
  }, 500); // 500ms batch window
}, []);
```

### Previous Story Intelligence (49.1, 49.2, 49.3)

**From Story 49.1:**
- `PortfolioProject` interface in `types.ts` - may need `lastUpdated?: number`
- `ProjectCard` already has hover/focus/navigation states
- `PortfolioGrid` renders cards with `onProjectClick`

**From Story 49.2:**
- SSE subscription already exists in PortfolioView
- `calculatePortfolioMetrics()` already recalculates when projects change
- Throttle pattern: `REFRESH_THROTTLE_MS = 2000`

**From Story 49.3:**
- Navigation to `/portfolio/[projectId]` works
- ProjectHeader component exists for detail page

### File Structure to Modify

```
packages/web/src/
├── components/
│   ├── PortfolioView.tsx           # MODIFY: Granular SSE updates, connection status
│   ├── ProjectCard.tsx             # MODIFY: Change highlight animation
│   └── __tests__/
│       ├── PortfolioView.test.tsx  # MODIFY: Add SSE granular update tests
│       └── ProjectCard.test.tsx    # MODIFY: Add highlight tests
├── app/api/events/route.ts         # REVIEW: Ensure projectId in payload
└── lib/types.ts                    # MODIFY: Add lastUpdated to PortfolioProject
```

### Testing Strategy

```typescript
// packages/web/src/components/__tests__/PortfolioView.test.tsx

describe("Real-time SSE updates", () => {
  it("updates only affected project card on SSE event", async () => {
    // Mock EventSource
    const mockES = createMockEventSource();
    vi.spyOn(global, "EventSource").mockImplementation(() => mockES);

    render(<PortfolioView projects={mockProjects} />);

    // Initial render
    expect(screen.getByText("Project Alpha")).toBeInTheDocument();

    // Simulate SSE event for one project
    act(() => {
      mockES.simulateMessage({
        type: "session.activity",
        data: { projectId: "alpha", agentCount: 5 }
      });
    });

    // Verify targeted update (not full refresh)
    // The project card should have new data
    // Other cards should not re-render
  });

  it("shows connection status indicator when reconnecting", () => {
    const mockES = createMockEventSource();
    vi.spyOn(global, "EventSource").mockImplementation(() => mockES);

    render(<PortfolioView projects={mockProjects} />);

    act(() => {
      mockES.simulateError();
    });

    expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
  });

  it("batches rapid SSE updates within throttle window", async () => {
    vi.useFakeTimers();
    // ... test batching logic
    vi.useRealTimers();
  });
});

// packages/web/src/components/__tests__/ProjectCard.test.tsx

describe("Change highlight", () => {
  it("shows highlight animation when lastUpdated is recent", () => {
    const project = { ...mockProject, lastUpdated: Date.now() };
    render(<ProjectCard project={project} />);

    expect(screen.getByRole("listitem")).toHaveClass("animate-highlight");
  });

  it("removes highlight after 2 seconds", async () => {
    vi.useFakeTimers();
    const project = { ...mockProject, lastUpdated: Date.now() };
    render(<ProjectCard project={project} />);

    expect(screen.getByRole("listitem")).toHaveClass("animate-highlight");

    act(() => {
      vi.advanceTimersByTime(2001);
    });

    expect(screen.getByRole("listitem")).not.toHaveClass("animate-highlight");
    vi.useRealTimers();
  });
});
```

### Performance Requirements (NFRs)

- **NFR-P2**: Real-time updates reflect within 3 seconds of state changes
- **NFR-F1-1**: Portfolio loads within 2 seconds for 50 projects
- **Optimization**: Only affected cards re-render, not entire grid

### References

- [Source: epics-cycle-10.md#Story 49.4] — Requirements
- [Source: prd-cycle-10.md#F1: Portfolio Dashboard, FR-F1-4] — Real-time SSE requirement
- [Source: architecture.md#SSE Patterns] — Server-Sent Events architecture
- [Source: project-context.md#SSE Real-Time Updates] — SSE patterns and heartbeat
- [Source: Story 49.2] — Existing SSE subscription implementation
- [Source: packages/web/src/hooks/useSSEConnection.ts] — Reusable hook pattern

### Limitations (Deferred Items)

1. **Partial Session Data in SSE Events**
   - Status: Deferred - Requires backend event enrichment
   - Requires: Full session data in SSE payload (currently has summary only)
   - Current: Will use `router.refresh()` fallback for complex updates
   - Epic: Story 49.5 or backend enhancement epic

### Project Structure Notes

- Follow existing component patterns from Story 49.1-49.3
- Use `var(--color-*)` for theme consistency
- Test file co-location: `__tests__/ComponentName.test.tsx`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None - implementation proceeded smoothly without major blockers.

### Completion Notes List

1. **Task 2 Not Required**: The `/api/events` route already includes `projectId` in session data through the snapshot event type. The `processSnapshot` function correctly groups sessions by `projectId` for granular updates.

2. **Connection Status Timing**: Initial implementation showed "Reconnecting..." on first error before any successful connection. Fixed by adding `hasConnectedRef` to only show the indicator after a successful connection has been established and then lost.

3. **Test Fix**: The "shows connection status indicator when reconnecting" test required updating to first call `simulateOpen()` before `simulateError()`, since the UI correctly doesn't show reconnecting on initial load failures.

4. **CSS Animation**: Used Tailwind's arbitrary value syntax `animate-[highlight-pulse_1s_ease-out]` for the highlight animation instead of adding a utility class, keeping the implementation simpler.

5. **Code Review Fixes** (2026-03-27):
   - **Stale Closure Fix**: Added `projectsRef` to avoid stale closure in `processSnapshot` - the function now uses `projectsRef.current` instead of the closure variable, preventing issues when projects state changes
   - **SSE Graceful Degradation**: Added try/catch around EventSource construction with environment check for EventSource availability
   - **Type Cleanup**: Removed unused "disconnected" status from ConnectionStatus type
   - **Missing Tests Added**: Added tests for batching (Task 6.4), metrics recalculation (Task 6.5), and graceful degradation (Task 6.6)

### File List

**Modified Files:**
- `packages/web/src/components/PortfolioView.tsx` — Granular SSE updates, connection status, batching, projectsRef for stale closure fix, SSE graceful degradation
- `packages/web/src/components/ProjectCard.tsx` — Change highlight animation with useMemo
- `packages/web/src/components/__tests__/PortfolioView.test.tsx` — SSE granular update tests, batching test, metrics test, graceful degradation tests
- `packages/web/src/components/__tests__/ProjectCard.test.tsx` — Highlight animation tests
- `packages/web/src/lib/types.ts` — Added `lastUpdated?: number` to PortfolioProject
- `packages/web/src/app/globals.css` — Added `highlight-pulse` keyframe animation

**No New Files Created** — All changes were modifications to existing files.
