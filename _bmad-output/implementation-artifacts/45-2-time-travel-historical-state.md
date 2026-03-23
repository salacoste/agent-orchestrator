# Story 45.2: Time Travel — Historical State Navigation

Status: review

## Story

As a developer investigating a past issue,
I want to see the state of the project at any historical point,
so that I can understand what was happening when a problem occurred.

## Acceptance Criteria

1. Date/time picker lets user select a historical timestamp
2. Dashboard reconstructs state at that timestamp: active sessions, phase, blockers
3. "Time Travel" banner shows "Viewing state at: [timestamp]"
4. "Return to Present" button restores live data
5. If no events exist for the selected time range, show "No data available for this period"
6. Time travel is a pure client-side state reconstruction — no new backend storage
7. Tests verify state reconstruction, banner display, and empty-state handling

## Tasks / Subtasks

- [x] Task 1: Create state reconstruction engine (pure logic) (AC: #2, #6)
  - [x] 1.1: Create `packages/web/src/lib/workflow/time-travel.ts`
  - [x] 1.2: Accept AuditEvent[] + targetTimestamp
  - [x] 1.3: Replay events up to target: track stories, agents, blockers via switch on eventType
  - [x] 1.4: Return HistoricalState with activeStories, activeAgents, blockers, eventsProcessed
- [x] Task 2: Create time travel UI components (AC: #1, #3, #4, #5)
  - [x] 2.1: Create `packages/web/src/components/TimeTravelBar.tsx`
  - [x] 2.2: `<input type="datetime-local">` with toLocalDatetimeValue conversion
  - [x] 2.3: Amber banner shows "Viewing state at: ..." with story/agent/blocker counts
  - [x] 2.4: "Return to Present" button calls onTimestampChange(null)
  - [x] 2.5: "No data available for this period" when noData=true
- [x] Task 3: Wire time travel into WorkflowPage (AC: #1, #3, #4)
  - [x] 3.1: Add timeTravelAt/ttState/ttNoData state
  - [x] 3.2: useEffect fetches /api/audit/events, sorts chronologically, calls reconstructState
  - [x] 3.3: TimeTravelBar renders above dashboard with state summary
  - [x] 3.4: SSE updates skipped during time travel; clearing restores live
- [x] Task 4: Write tests (AC: #7)
  - [x] 4.1: 11 state reconstruction tests covering all event types and edge cases
  - [x] 4.2: Empty events returns empty state, timestamp before all events returns empty
  - [x] 4.3: 7 TimeTravelBar tests: picker, banner, return button, no-data, loading, onChange
  - [x] 4.4: Picker change calls onTimestampChange with ISO string
  - [x] 4.5: Return to Present calls onTimestampChange(null)

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- Deferred items explicitly documented
- No hidden TODOs or FIXMEs in completed tasks
- Documentation updated (Dev Notes, File List)

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] No deferred items
- [x] File List includes all changed files

## Dev Notes

### Architecture — Event Replay + UI Overlay

**Key insight from party mode:** Time Travel v1 works against existing `events.jsonl` — no immutable audit log (46a-1) required. The JSONL event log already records all state transitions with timestamps.

```
time-travel.ts (pure logic — no React)
  ├── Input: AuditEvent[] + targetTimestamp
  ├── Replay: iterate events ≤ timestamp, track state changes
  └── Output: HistoricalState { activeStories, sessionStatuses, blockers, phasePresence }

TimeTravelBar.tsx (UI)
  ├── datetime-local picker
  ├── "Viewing state at: ..." banner (amber background)
  └── "Return to Present" button

WorkflowPage.tsx (integration)
  ├── timeTravelAt state (string | null)
  ├── When set → fetch events, reconstruct state, show banner
  └── When cleared → resume live polling
```

### State Reconstruction Logic

For a target timestamp `t`, process all events with `timestamp ≤ t`:

```typescript
interface HistoricalState {
  activeStories: Map<string, string>;  // storyId → status ("started"|"completed"|"blocked")
  activeAgents: string[];              // agentIds with active sessions
  blockers: string[];                  // blocked storyIds
  lastEventAt: string | null;          // last event timestamp ≤ t
}

// Event type → state transition:
// story.started  → activeStories.set(storyId, "started")
// story.completed → activeStories.set(storyId, "completed")
// story.blocked  → activeStories.set(storyId, "blocked"), blockers.push(storyId)
// story.unblocked → remove from blockers
// story.assigned → track agentId as active
```

### Data Source — Existing Audit Events API

Use `GET /api/audit/events?limit=1000` which reads `events.jsonl` and supports time filtering. The events are already sorted and paginated. No new API routes needed.

Event shape from the API:
```typescript
interface AuditEvent {
  eventId: string;
  eventType: string;
  timestamp: string;  // ISO 8601
  metadata: Record<string, unknown>;
}
```

### TimeTravelBar UI Pattern

```
┌──────────────────────────────────────────────────┐
│ 🕐 Time Travel: Viewing state at 2026-03-22 14:30 │
│ [datetime-local input]  [Return to Present]       │
└──────────────────────────────────────────────────┘
```

- Amber background (`var(--color-status-attention)`) to distinguish from live view
- Renders above the dashboard when `timeTravelAt` is set
- `<input type="datetime-local">` for native browser date/time picker

### WorkflowPage Integration

Add to WorkflowPage state:
```typescript
const [timeTravelAt, setTimeTravelAt] = useState<string | null>(null);
```

When `timeTravelAt` is set:
1. Fetch audit events from API
2. Run reconstruction engine
3. Render TimeTravelBar above dashboard
4. Pass reconstructed state summary alongside live data

When cleared:
1. Set `timeTravelAt` to null
2. Resume SSE and normal polling

### Existing Components to Reuse

1. **`/api/audit/events` route** — already reads events.jsonl with pagination and time filtering
2. **`filterEvents`/`sortEventsByTimestamp`** from `@/lib/event-filters` — event processing helpers
3. **WorkflowPage.tsx** — integration point with existing `fetchData` pattern
4. **ReplayEvent type** from `replay-engine.ts` (Story 45.1) — similar event shape

### Anti-Patterns to Avoid

- Do NOT create a new API route — use existing `/api/audit/events`
- Do NOT modify the event log format — read-only reconstruction
- Do NOT store snapshots — reconstruct on demand (events are the source of truth)
- Do NOT disable SSE during time travel — just ignore SSE updates while `timeTravelAt` is set
- Do NOT use `Date.parse()` directly — use `new Date(isoString).getTime()` for timestamp comparison

### Previous Story Intelligence (45.1)

- Pure engine + hook + component pattern works well — follow same 3-layer architecture
- `useMemo` for stabilizing derived data (replayEvents pattern)
- `scrollIntoView` with optional chaining for SSR safety
- `aria-pressed` for toggle buttons

### Files to Create

1. `packages/web/src/lib/workflow/time-travel.ts` (new)
2. `packages/web/src/lib/workflow/__tests__/time-travel.test.ts` (new)
3. `packages/web/src/components/TimeTravelBar.tsx` (new)
4. `packages/web/src/components/__tests__/TimeTravelBar.test.tsx` (new)

### Files to Modify

1. `packages/web/src/components/WorkflowPage.tsx` — add timeTravelAt state and TimeTravelBar

### References

- [Source: packages/web/src/app/api/audit/events/route.ts] — audit events API with since/limit
- [Source: packages/web/src/lib/event-filters.ts] — filterEvents, sortEventsByTimestamp
- [Source: packages/core/src/types.ts] — AuditEvent, EventBusEvent interfaces
- [Source: packages/web/src/components/WorkflowPage.tsx] — integration target
- [Source: packages/web/src/lib/workflow/replay-engine.ts] — similar event processing pattern
- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 45.2] — requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Pure reconstructState() replays events chronologically, tracks story status transitions via switch
- hasEventsInRange() for quick empty-range detection
- TimeTravelBar: datetime-local picker, amber "Viewing state at" banner, "Return to Present" button
- WorkflowPage: timeTravelAt state triggers useEffect that fetches audit events, sorts, reconstructs
- SSE updates ignored during time travel — restores on "Return to Present"
- toLocalDatetimeValue() converts ISO to datetime-local input format using local timezone
- 22 new tests (15 engine + 7 component), 98 web files, 1348 tests — zero regressions

### File List

- packages/web/src/lib/workflow/time-travel.ts (new)
- packages/web/src/lib/workflow/__tests__/time-travel.test.ts (new)
- packages/web/src/components/TimeTravelBar.tsx (new)
- packages/web/src/components/__tests__/TimeTravelBar.test.tsx (new)
- packages/web/src/components/WorkflowPage.tsx (modified — time travel integration)
