# Story 55.4: Automatic Forecast Updates

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **forecasts to update automatically when stories complete or velocity changes**,
So that **I always have current predictions without manual refresh**.

## Acceptance Criteria

1. **Given** an active sprint has a forecast
   **When** a story is completed or velocity changes significantly (>10%)
   **Then** the forecast recalculates within 10 seconds
   **And** the updated forecast is visible in the dashboard
   **And** significant changes (>2 days shift) trigger a notification

2. **Given** the MonteCarloChart is displayed on the dashboard
   **When** the underlying forecast data changes on the server
   **Then** the chart updates automatically without manual page refresh
   **And** the user sees updated percentile dates and histogram

3. **Given** a forecast shifts by more than 2 days after recalculation
   **When** the updated forecast is generated
   **Then** a notification is pushed to the notification panel
   **And** the notification includes: direction (later/earlier), magnitude (days), and new P50 date

4. **Given** the SSE connection is unavailable
   **When** the MonteCarloChart is rendered
   **Then** it falls back to polling at 30-second intervals
   **And** displays data normally (graceful degradation)

## Tasks / Subtasks

- [x] Task 1: Create forecast change detection module (AC: #1)
  - [x] 1.1: Create `packages/plugins/tracker-bmad/src/forecast-diff.ts`
  - [x] 1.2: Export `computeForecastDiff(previous: PercentileResult, current: PercentileResult): ForecastDiff` where `ForecastDiff = { p50Shift: number, p80Shift: number, p95Shift: number, significantChange: boolean, direction: "later" | "earlier" | "unchanged" }`
  - [x] 1.3: `significantChange = true` when `Math.abs(p50Shift) > 2` (days)
  - [x] 1.4: Parse ISO date strings to compute day differences using `Math.round((dateB - dateA) / MS_PER_DAY)`
  - [x] 1.5: Add test: diff detects 3-day later shift as significant
  - [x] 1.6: Add test: diff detects 1-day shift as not significant
  - [x] 1.7: Add test: diff handles identical forecasts (unchanged)

- [x] Task 2: Add forecast recalculation hook to SSE events route (AC: #1)
  - [x] 2.1: In `packages/web/src/app/api/events/route.ts`, add a `forecast-stale` event emission when the polling cycle detects story status changes
  - [x] 2.2: Track the last known count of `done` stories per project in a module-scoped `Map<string, number>`
  - [x] 2.3: On each 5-second polling cycle, compare current `done` count to previous — if changed, emit `forecast-stale` SSE event with `{ type: "forecast-stale", project, timestamp }`
  - [x] 2.4: Reset the done count tracker after emission

- [x] Task 3: Add SSE-driven auto-refresh to MonteCarloChart (AC: #2, #4)
  - [x] 3.1: Add `EventSource` connection to MonteCarloChart following the `PortfolioView.tsx` SSE pattern (lines 171-249)
  - [x] 3.2: Listen for `forecast-stale` event type — on receipt, re-fetch from `/api/sprint/{projectId}/monte-carlo`
  - [x] 3.3: Add SSE connection with exponential backoff reconnection (1s, 2s, 4s, 8s max)
  - [x] 3.4: If `EventSource` fails to connect (after 2 retries), fall back to 30-second polling interval using the standard component polling pattern
  - [x] 3.5: Clean up EventSource and intervals on unmount
  - [x] 3.6: Preserve existing AbortController pattern from Story 55-2 code review

- [x] Task 4: Generate forecast change notifications (AC: #3)
  - [x] 4.1: Create `packages/web/src/lib/forecast-change-broadcaster.ts` — singleton following `conflict-broadcaster.ts` pattern
  - [x] 4.2: Export `broadcastForecastChange(projectId: string, diff: ForecastDiff, newP50: string)` — calls registered callbacks
  - [x] 4.3: Export `subscribeForecastChanges(callback): () => void` — `Set<Callback>` fan-out pattern with unsubscribe
  - [x] 4.4: In `packages/web/src/app/api/sprint/[project]/monte-carlo/route.ts`, after computing forecast, compare with previous result (cached in module scope), and if significant change detected, call `broadcastForecastChange()`
  - [x] 4.5: Wire `subscribeForecastChanges` into the SSE events route to emit `forecast-changed` SSE events with `{ type: "forecast-changed", project, direction, magnitude, newP50, timestamp }`

- [x] Task 5: Display forecast change notifications in NotificationPanel (AC: #3)
  - [x] 5.1: In `packages/web/src/components/NotificationPanel.tsx`, add handling for `forecast-changed` SSE event
  - [x] 5.2: Display notification: "Forecast shifted {direction} by {magnitude} days (new P50: {newP50})"
  - [x] 5.3: Use severity level `info` for < 5 day shifts, `warning` for >= 5 day shifts
  - [x] 5.4: Auto-dismiss after 60 seconds

- [x] Task 6: Add component tests (AC: #2, #3, #4)
  - [x] 6.1: Create test for `forecast-diff.ts` in `packages/plugins/tracker-bmad/src/__tests__/forecast-diff.test.ts` — 5 tests (significant, not significant, earlier, unchanged, boundary)
  - [x] 6.2: Update `packages/web/src/components/__tests__/MonteCarloChart.test.tsx` — add test: SSE event triggers data re-fetch
  - [x] 6.3: Update MonteCarloChart tests — add test: ignores SSE events for other projects, cleanup on unmount
  - [x] 6.4: Create test for `forecast-change-broadcaster.ts` in `packages/web/src/lib/__tests__/forecast-change-broadcaster.test.ts` — 5 tests (subscribe, unsubscribe, multi-subscriber, error isolation, post-unsubscribe)
  - [x] 6.5: Run full regression suite — all existing tests must pass (2583 total)

- [x] Task 7: Update sprint-status.yaml (AC: all)
  - [x] 7.1: Update `55-4-automatic-forecast-updates` to `done` after all tests pass
  - [x] 7.2: Run full regression suite

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

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. **Velocity change detection (>10% threshold)**
   - Status: Deferred — Requires historical velocity baseline tracking
   - Requires: Velocity baseline storage (could leverage Story 55-3's forecast-log pattern)
   - Epic: Future enhancement / Epic 55
   - Current: Forecast recalculation triggers on story completion count changes only (via SSE polling cycle), not velocity percentage changes
```

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

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
- `computeMonteCarloForecast(project, epicFilter?, config?)` from `@composio/ao-plugin-tracker-bmad` — READ: computes forecast (already exists)
- `GET /api/sprint/{project}/monte-carlo` — READ: existing Monte Carlo API endpoint (already exists)
- `GET /api/events` — READ: existing SSE stream (already exists, extend with new event type)

**Feature Flags:**
- None required — all changes use existing interfaces and extend existing patterns

## Dependency Review

No new external dependencies required. All changes use existing React, SSE (EventSource), and internal pub/sub patterns.

## Dev Notes

### Architecture Context

This is **Story 4 of 6** in **Epic 55: Monte Carlo Forecasting**. It is the Intelligence phase (Cycle 10 Phase 2).

**Dependency chain:** Story 55.1 (done) → Story 55.2 (done) → Story 55.3 (ready-for-dev) → **Story 55.4 (this story)**

**Note:** Story 55.3 is `ready-for-dev` but not yet implemented. This story is independent — it does NOT depend on 55-3's forecast persistence or calibration features. It only needs the existing `computeMonteCarloForecast()` from 55-1.

### What Already Exists (Do NOT Reinvent)

1. **`packages/web/src/app/api/events/route.ts`** (~260 lines) — **THE SSE ROUTE**
   - Central SSE stream at `GET /api/events` using `ReadableStream`
   - 5-second polling cycle (lines 162-225) calls `SessionManager.list()` and emits `snapshot` events
   - Already has subscription pattern for workflow changes, collaboration events, cross-project deps
   - **FOLLOW THIS PATTERN** for adding `forecast-stale` event emission
   - In-process pub/sub bridges: `workflow-watcher.ts`, `conflict-broadcaster.ts`

2. **`packages/web/src/components/PortfolioView.tsx`** (lines 171-249) — **SSE CLIENT REFERENCE**
   - `EventSource("/api/events")` with exponential backoff reconnection (1s, 2s, 4s, 8s max)
   - 500ms batching window (`BATCH_WINDOW_MS`)
   - Processes typed events: `snapshot`, `session.activity`, `cross-project-dep-changed`
   - **FOLLOW THIS PATTERN EXACTLY for MonteCarloChart SSE client**

3. **`packages/web/src/lib/conflict-broadcaster.ts`** — **PUB/SUB BRIDGE REFERENCE**
   - Singleton using `globalThis` for persistence across hot reloads
   - `Set<Callback>` fan-out pattern with unsubscribe
   - `detectAndBroadcast()` called from SSE polling loop
   - **FOLLOW THIS PATTERN for forecast-change-broadcaster.ts**

4. **`packages/web/src/components/MonteCarloChart.tsx`** (~326 lines, post 55-2)
   - Currently fetches once on mount via `useEffect` with `AbortController`
   - **NO existing auto-refresh** — this is the gap this story fills
   - `MonteCarloData` inline type — extend with optional fields if needed
   - Fetch URL: `/api/sprint/${projectId}/monte-carlo?simulations=5000`

5. **`packages/web/src/app/api/sprint/[project]/monte-carlo/route.ts`** (43 lines)
   - `GET` handler returns `MonteCarloResult` — extend with forecast diff detection

6. **Standard 30-second polling pattern** — used by 11+ components:
   ```tsx
   useEffect(() => {
     let cancelled = false;
     const fetchData = () => { /* fetch, guard with cancelled */ };
     fetchData();
     const interval = setInterval(fetchData, 30_000);
     return () => { cancelled = true; clearInterval(interval); };
   }, [projectId]);
   ```
   Components: HealthIndicators, DeadLetterQueueViewer, StoryTimeline, SprintGoalsCard, SprintBoard, NotificationPanel, CycleTimeChart, RetrospectiveChart, WipStatusWidget, FocusMode, SessionDetail

7. **`packages/web/src/hooks/useSSEConnection.ts`** — Shared SSE hook
   - Supports `onStoryCompleted` callback
   - Has existing test in `__tests__/useSSEConnection.test.ts`

8. **`packages/core/src/event-publisher.ts`** — Core EventBus publisher
   - `publishStoryCompleted()` already fires on story completion via CLI path
   - **DO NOT USE** for this story — the web SSE route already has its own polling cycle
   - The SSE route polls every 5 seconds and can detect story count changes directly

### What This Story Actually Does

This is a **real-time update story** — no new backend algorithms, no new data storage:

1. **Detect when forecast data is stale**: Track done-story count changes in the SSE polling cycle
2. **Push stale notification via SSE**: Emit `forecast-stale` event so clients know to re-fetch
3. **Auto-refresh MonteCarloChart**: Subscribe to SSE events, re-fetch on `forecast-stale`
4. **Detect significant forecast changes**: Compare new forecast vs previous, compute day shift
5. **Push change notification**: Broadcast significant shifts via SSE → NotificationPanel
6. **Graceful degradation**: Fall back to 30s polling if SSE unavailable

### Critical Design Decisions

1. **Reuse SSE polling cycle (not new event bus subscription)** — The SSE route already polls every 5 seconds. Adding a done-count comparison is zero-cost. No new infrastructure needed.

2. **No velocity percentage detection** — Detecting "velocity changed >10%" requires a velocity baseline that doesn't exist yet. Story completion count change is sufficient for AC #1. Velocity-based triggers are deferred.

3. **Forecast diff at API level** — The monte-carlo route caches its last result in module scope. On next call, it compares old vs new. This is simple and stateless (no database needed).

4. **SSE first, polling fallback** — Follows the PortfolioView pattern. EventSource for real-time, 30s polling as backup.

5. **No forecast caching** — The Monte Carlo simulation is fast (<5s for 10K iterations). Caching adds complexity with no benefit at this scale.

### SSE Event Types (New)

| Event Type | Trigger | Payload |
|------------|---------|---------|
| `forecast-stale` | Done-story count changed in SSE poll cycle | `{ type, project, timestamp }` |
| `forecast-changed` | Forecast recalc shows >2 day P50 shift | `{ type, project, direction, magnitude, newP50, timestamp }` |

### Forecast Diff Algorithm

```
1. Parse previous and current percentile dates to Date objects
2. Compute: p50Shift = daysBetween(current.p50, previous.p50)
3. significantChange = Math.abs(p50Shift) > 2
4. direction = p50Shift > 0 ? "later" : p50Shift < 0 ? "earlier" : "unchanged"
5. Return ForecastDiff { p50Shift, p80Shift, p95Shift, significantChange, direction }
```

### Testing Strategy

**New tests (~7):**
- Forecast diff: significant change detection (3 tests)
- MonteCarloChart: SSE event triggers re-fetch
- MonteCarloChart: fallback polling when EventSource fails
- Forecast change broadcaster: subscribe/unsubscribe/broadcast

**Existing tests to update:**
- `MonteCarloChart.test.tsx` — ensure SSE tests don't break existing fetch-on-mount tests

**Component test pattern (from 55-2):**
```tsx
// Mock EventSource for SSE tests
const mockEventSource = {
  addEventListener: vi.fn(),
  close: vi.fn(),
  readyState: 1,
};
global.EventSource = vi.fn(() => mockEventSource) as unknown as typeof EventSource;
```

### NFRs
- **NFR-E2-1:** Monte Carlo simulation completes within 5 seconds (already achieved — this story doesn't change simulation performance)
- **NFR-E2-4:** Forecast updates within 10 seconds of story completion (SSE poll cycle is 5 seconds + re-fetch < 5 seconds = total < 10 seconds)
- **NFR-P2:** Chart renders within 2 seconds (unchanged from 55-2)

### Pre-existing Types (Do NOT modify)
- `MonteCarloResult`, `PercentileResult`, `HistogramBucket`, `MonteCarloConfig` — defined in `packages/plugins/tracker-bmad/src/monte-carlo.ts`
- `MonteCarloData` inline type in `MonteCarloChart.tsx` — may extend with optional fields
- `ProjectConfig` from `@composio/ao-core`

### References
- [Source: epics-cycle-10.md#Story 55.4] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-E2-4] — "Forecasts are updated automatically as new data arrives"
- [Source: packages/web/src/app/api/events/route.ts] — SSE route to extend with forecast-stale event
- [Source: packages/web/src/components/PortfolioView.tsx:171-249] — SSE client pattern to follow
- [Source: packages/web/src/lib/conflict-broadcaster.ts] — Pub/sub bridge pattern to follow
- [Source: packages/web/src/components/MonteCarloChart.tsx] — Component to add SSE auto-refresh
- [Source: packages/web/src/app/api/sprint/[project]/monte-carlo/route.ts] — API route to add diff detection
- [Source: _bmad-output/implementation-artifacts/55-2-probability-distribution-visualization.md] — Previous story (done)
- [Source: _bmad-output/implementation-artifacts/55-1-monte-carlo-simulation-core.md] — Story 55-1 (done)

### Project Structure Notes
- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/` pattern
- All existing tests must continue to pass (no regressions)
- No new npm dependencies

## Dev Agent Record
### Agent Model Used
Claude Sonnet 4.6

### Debug Log References
- forecast-diff.test.ts: 5 tests, all passing
- MonteCarloChart.test.tsx: 15 tests, all passing (12 original + 3 SSE auto-refresh)
- forecast-change-broadcaster.test.ts: 5 tests, all passing
- Full regression: 2583 tests passing (2106 web + 477 tracker-bmad)

### Completion Notes List
- Forecast diff detection module created with significance threshold >2 days
- SSE `forecast-stale` event emitted when done-story count changes in polling cycle
- MonteCarloChart auto-refreshes via SSE with exponential backoff + 30s polling fallback
- Forecast change broadcaster singleton (globalThis pattern) for pub/sub
- NotificationPanel displays forecast shift alerts with severity based on magnitude (>=5 days = warning)
- Forecast alerts auto-dismiss after 60 seconds
- NotificationPanel SSE reconnect with exponential backoff (1s→2s→4s→8s)
- Velocity percentage detection deferred (requires velocity baseline storage)

### Change Log
- 2026-04-06: Initial implementation — forecast diff, SSE stale events, auto-refresh, notifications, tests
- 2026-04-06: Code review fixes — severity logic (magnitude-based), auto-dismiss (60s), SSE reconnect with backoff, missing broadcaster tests, SSE auto-refresh tests

### File List
- `packages/plugins/tracker-bmad/src/forecast-diff.ts` — Forecast diff computation (NEW)
- `packages/plugins/tracker-bmad/src/forecast-diff.test.ts` — Diff unit tests (NEW)
- `packages/plugins/tracker-bmad/src/sprint-notifications.ts` — Added `sprint.forecast_shifted` type (MODIFIED)
- `packages/plugins/tracker-bmad/src/index.ts` — Exported forecast-diff types (MODIFIED)
- `packages/web/src/lib/forecast-change-broadcaster.ts` — Pub/sub singleton (NEW)
- `packages/web/src/lib/__tests__/forecast-change-broadcaster.test.ts` — Broadcaster tests (NEW)
- `packages/web/src/app/api/events/route.ts` — forecast-stale + forecast-changed SSE events (MODIFIED)
- `packages/web/src/app/api/sprint/[project]/monte-carlo/route.ts` — Diff detection + broadcast (MODIFIED)
- `packages/web/src/components/MonteCarloChart.tsx` — SSE auto-refresh + calibration UI (MODIFIED)
- `packages/web/src/components/__tests__/MonteCarloChart.test.tsx` — SSE auto-refresh tests (MODIFIED)
- `packages/web/src/components/NotificationPanel.tsx` — Forecast alerts + auto-dismiss (MODIFIED)
