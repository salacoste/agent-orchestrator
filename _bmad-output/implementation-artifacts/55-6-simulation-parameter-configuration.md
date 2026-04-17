# Story 55.6: Simulation Parameter Configuration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **to adjust simulation parameters like iterations and confidence levels**,
So that **I can balance accuracy vs performance for my needs**.

## Acceptance Criteria

1. **Given** I want more precise (or faster) forecasts
   **When** I adjust simulation parameters
   **Then** I can set iteration count (1,000 to 100,000)
   **And** the change takes effect on the next simulation run
   **And** the simulation completes within NFR-E2-1 time bounds (5s for 10K)

2. **Given** I want to customize which confidence levels to display
   **When** I configure confidence levels in the parameter panel
   **Then** I can toggle P50, P80, P95 visibility independently
   **And** the chart and stat cards update to show only selected levels
   **And** at least one confidence level must remain selected

3. **Given** I want forecasts based on recent performance only
   **When** I set the historical data window
   **Then** I can specify "last N sprints" or "last N days" for throughput sampling
   **And** the simulation only uses data from that window
   **And** the UI shows how many data points are being used

4. **Given** I have configured my preferred simulation parameters
   **When** I navigate away and return to the forecast page
   **Then** my settings are persisted per-project
   **And** I can reset to defaults with a single action

## Tasks / Subtasks

- [x] Task 1: Extend Monte Carlo API to accept all configuration parameters (AC: #1, #3)
  - [x] 1.1: Update `packages/web/src/app/api/sprint/[project]/monte-carlo/route.ts` to accept `simulations`, `throughputWindowDays`, `excludeWeekends`, and `confidenceLevels` query params
  - [x] 1.2: Validate `simulations` clamps to [1000, 100000] range
  - [x] 1.3: Validate `throughputWindowDays` clamps to [0, 365] range (0 = use all data)
  - [x] 1.4: Pass all params through to `computeMonteCarloForecast(project, epicFilter, config)` via the existing `MonteCarloConfig` type
  - [x] 1.5: For `confidenceLevels`, filter the percentile results returned — the engine always computes P50/P80/P95 but the response only includes selected levels
  - [x] 1.6: Return the effective parameters in the API response so the UI can reflect actual values used

- [x] Task 2: Create SimulationConfigPanel component (AC: #1, #2, #3)
  - [x] 2.1: Create `packages/web/src/components/SimulationConfigPanel.tsx`
  - [x] 2.2: Iteration count control: number input with range [1000, 100000], step 1000, default 5000
  - [x] 2.3: Confidence level checkboxes: P50, P80, P95 (all checked by default, at least one must remain checked)
  - [x] 2.4: Historical data window: number input for "last N days" with range [0, 365], where 0 = all available data
  - [x] 2.5: Reset to defaults button
  - [x] 2.6: Style as collapsible panel (collapsed by default) using existing SectionCard pattern — label "Simulation Settings"
  - [x] 2.7: Show data point count from API response: "Using N data points from last M days"

- [x] Task 3: Integrate config panel with MonteCarloChart (AC: #1, #2, #4)
  - [x] 3.1: Lift simulation config state to the sprint dashboard page or use URL params
  - [x] 3.2: When config changes, re-fetch Monte Carlo data with updated query params
  - [x] 3.3: Replace hardcoded `simulations=5000` in MonteCarloChart with the configured value
  - [x] 3.4: Pass `confidenceLevels` to MonteCarloChart to control which percentile lines are rendered
  - [x] 3.5: Render SimulationConfigPanel above or beside MonteCarloChart in SprintBoard

- [x] Task 4: Persist settings per-project (AC: #4)
  - [x] 4.1: Use `localStorage` with key pattern `ao:sim-config:{projectId}` for persistence
  - [x] 4.2: On mount, load saved settings; on change, debounce-save to localStorage
  - [x] 4.3: Reset button clears localStorage entry and restores defaults
  - [x] 4.4: Create shared hook `useSimulationConfig(projectId)` encapsulating load/save/reset logic

- [x] Task 5: Add component and integration tests (AC: all)
  - [x] 5.1: Create `packages/web/src/components/__tests__/SimulationConfigPanel.test.tsx`
  - [x] 5.2: Test: iteration count input clamps to [1000, 100000]
  - [x] 5.3: Test: confidence level toggles work, prevents unchecking last one
  - [x] 5.4: Test: historical data window input validates range
  - [x] 5.5: Test: reset button restores defaults
  - [x] 5.6: Test: Monte Carlo API route accepts new query params and passes them through (9 tests in route.test.ts)
  - [x] 5.7: Test: localStorage persistence round-trips correctly (5 tests in useSimulationConfig.test.ts)

- [x] Task 6: Update sprint-status.yaml (AC: all)
  - [x] 6.1: Update `55-6-simulation-parameter-configuration` to `review` after all tests pass
  - [x] 6.2: Run full regression suite (2132 web tests pass, full monorepo pass)

## Task Completion Validation

**CRITICAL:** Use correct task status notation:
- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true))`)
- No placeholder tests that always pass
- Deferred items explicitly documented (see "Deferred Items Tracking" below)
- No hidden TODOs or FIXMEs in completed tasks
- Documentation updated (Dev Notes, File List)

**Deferred Items Tracking:**

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. **Per-epic parameter overrides**
   - Status: Deferred — Requires project-level config schema extension
   - Requires: Config schema support for per-epic simulation parameters
   - Epic: Future enhancement / Epic 55
   - Current: Parameters apply at project level only
2. **Custom confidence level values (beyond P50/P80/P95)**
   - Status: Deferred — Engine hardcodes P50/P80/P95 percentile extraction
   - Requires: Engine refactor to support arbitrary percentile extraction
   - Epic: Future enhancement / Epic 55
   - Current: Fixed P50/P80/P95 confidence levels
```

**Reference:** See `_bmad/bmm/docs/task-completion-guidelines.md` for complete task completion best practices.

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
- `computeMonteCarloForecast(project, epicFilter?, config?: MonteCarloConfig)` from `@composio/ao-plugin-tracker-bmad` — READ: already supports `simulations`, `throughputWindowDays`, `excludeWeekends` via `MonteCarloConfig`
- `GET /api/sprint/{project}/monte-carlo` — EXISTING: currently accepts `simulations` and `epic` query params (extending to accept more)
- `localStorage` — browser API for per-project setting persistence

**Feature Flags:**
- None required — `MonteCarloConfig` already has all needed fields (`simulations`, `throughputWindowDays`, `excludeWeekends`). This story just wires them through the API and adds UI.

## Dependency Review

No new external dependencies required. All changes use existing React, Next.js API patterns, and the already-defined `MonteCarloConfig` type from tracker-bmad.

## Dev Notes

### Architecture Context

This is **Story 6 of 6** in **Epic 55: Monte Carlo Forecasting**. It is the final story in the Intelligence phase (Cycle 10 Phase 2).

**Dependency chain:** Story 55.1 (done) → Story 55.2 (done) → Story 55.3 (done) → Story 55.4 (done) → Story 55.5 (done) → **Story 55.6 (this story)**

**After this story, Epic 55 is complete.**

### What Already Exists (Do NOT Reinvent)

1. **`packages/plugins/tracker-bmad/src/monte-carlo.ts`** — Core Monte Carlo engine
   - `MonteCarloConfig` interface (lines 16-22): `{ simulations?, excludeWeekends?, randomFn?, throughputWindowDays? }`
   - Defaults applied at lines 93-96: `simulations=10000`, `excludeWeekends=true`, `throughputWindowDays=undefined`
   - Percentile extraction at lines 233-235: hardcoded P50/P80/P95 indices
   - Throughput window applied at lines 187-193: `throughput.splice(0, throughput.length - throughputWindowDays)`
   - **ALL NEEDED CONFIG FIELDS ALREADY EXIST** — this story just wires them through

2. **`packages/web/src/app/api/sprint/[project]/monte-carlo/route.ts`** (~79 lines) — Monte Carlo API
   - Currently accepts `simulations` and `epic` query params (lines 17-20)
   - Calls `computeMonteCarloForecast(project, epicFilter, { simulations })` (line ~40)
   - **EXTEND THIS** to accept and pass through `throughputWindowDays` and `excludeWeekends`

3. **`packages/web/src/components/MonteCarloChart.tsx`** (~440 lines) — Forecast chart
   - Hardcodes `simulations=5000` in fetch URL (line 73): `fetch(\`/api/sprint/${projectId}/monte-carlo?simulations=5000\`)`
   - Renders P50/P80/P95 percentile lines (always all three)
   - Has SSE auto-refresh, SVG histogram, tooltip patterns
   - **MODIFY THIS** to accept config props and use them in the fetch

4. **`packages/web/src/components/SprintBoard.tsx`** — Dashboard page
   - Renders MonteCarloChart and ForecastAccuracyChart
   - **ADD SimulationConfigPanel here**, pass config to MonteCarloChart

5. **`packages/web/src/components/ForecastAccuracyChart.tsx`** (~485 lines) — Accuracy chart
   - Does NOT need simulation parameters — it reads historical accuracy data
   - **DO NOT MODIFY** — this story only affects MonteCarloChart

6. **`packages/cli/src/commands/monte-carlo.ts`** — CLI command
   - Already has `--simulations` flag
   - **OPTIONAL**: Add `--window` and `--no-weekends` flags (defer if CLI changes are out of scope)

### What This Story Actually Does

This is a **wiring + UI story** — the engine already supports all the parameters:

1. **API extension**: Pass `throughputWindowDays`, `excludeWeekends`, `confidenceLevels` through the existing monte-carlo API route
2. **Config panel**: Collapsible UI with iteration count, confidence toggles, data window input
3. **Chart integration**: MonteCarloChart reads from config instead of hardcoded values
4. **Persistence**: localStorage-based per-project setting storage

### Critical Design Decisions

1. **localStorage over server-side config** — Simulation preferences are per-user/per-browser. No need to pollute project config YAML. Simple and sufficient.

2. **Collapsible panel (not modal)** — Settings should be discoverable but not dominating the view. A collapsed "Simulation Settings" section above the chart follows the existing SectionCard pattern.

3. **Engine always computes all percentiles** — Rather than making the engine configurable for which percentiles to compute, always compute P50/P80/P95 and filter at the API/UI level. This keeps the engine simple and deterministic.

4. **Debounced config save** — Don't write to localStorage on every keystroke. Use 300ms debounce.

5. **No custom confidence level values** — Only P50/P80/P95 toggles. The engine hardcodes these indices. Arbitrary percentiles would require engine refactoring (deferred).

### SimulationConfigPanel Layout

```
▼ Simulation Settings (collapsed by default)
  ┌─────────────────────────────────────────────┐
  │ Iterations: [___5000___] (1,000 - 100,000)  │
  │                                              │
  │ Confidence Levels:                           │
  │ ☑ P50  ☑ P80  ☑ P95                         │
  │                                              │
  │ Historical Data Window:                      │
  │ Last [__0__] days (0 = all available)        │
  │ ℹ Using 42 data points                      │
  │                                              │
  │ [Reset to Defaults]                          │
  └─────────────────────────────────────────────┘
```

### API Changes

**Current GET params:** `simulations`, `epic`
**New GET params:** `simulations`, `epic`, `throughputWindowDays`, `excludeWeekends`, `confidenceLevels`

**Example request:**
```
GET /api/sprint/my-project/monte-carlo?simulations=10000&throughputWindowDays=90&excludeWeekends=true&confidenceLevels=p50,p80
```

**New fields in response:**
```json
{
  "effectiveConfig": {
    "simulations": 10000,
    "throughputWindowDays": 90,
    "excludeWeekends": true,
    "dataPointsUsed": 42
  },
  ...existing fields...
}
```

### Testing Strategy

**New tests (~7):**
- SimulationConfigPanel: iteration count input clamping
- SimulationConfigPanel: confidence level toggle (prevents unchecking last)
- SimulationConfigPanel: data window input validation
- SimulationConfigPanel: reset to defaults
- Monte Carlo API: accepts new query params
- Monte Carlo API: validates param ranges
- useSimulationConfig hook: localStorage round-trip

**Test pattern:**
```tsx
// SimulationConfigPanel test
const mockOnChange = vi.fn();
render(<SimulationConfigPanel config={defaultConfig} onChange={mockOnChange} />);

// Change iterations
const input = screen.getByLabelText(/iterations/i);
await userEvent.clear(input);
await userEvent.type(input, "50000");
expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ simulations: 50000 }));
```

### NFRs
- **NFR-E2-1:** Monte Carlo simulation (10,000 iterations) completes within 5 seconds — unchanged, this story only adds UI for existing params
- **NFR-E2-2:** Forecast accuracy target: 80% of actuals within predicted 80% CI — unchanged
- **NFR-P2:** Chart renders within 2 seconds — config panel is lightweight, no concern
- **NFR-R2:** Simulation results are deterministic for identical inputs — unchanged (same params = same results)

### Pre-existing Types (Do NOT modify)
- `MonteCarloConfig` in `packages/plugins/tracker-bmad/src/monte-carlo.ts` — already has all needed fields
- `MonteCarloResult` in `packages/plugins/tracker-bmad/src/monte-carlo.ts` — do not modify
- `ForecastSnapshot`, `CalibrationResult` — defined in tracker-bmad (55-3)
- `MonteCarloData` inline type in MonteCarloChart.tsx — extend with `effectiveConfig` field

### References
- [Source: epics-cycle-10.md#Story 55.6] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-E2-6] — "Users can adjust simulation parameters: iterations, confidence levels, historical data window"
- [Source: prd-cycle-10.md#NFR-E2-1] — "Monte Carlo simulation (10,000 iterations) completes within 5 seconds"
- [Source: prd-cycle-10.md#NFR-R2] — "Simulation results are deterministic for identical inputs"
- [Source: packages/plugins/tracker-bmad/src/monte-carlo.ts] — Engine with MonteCarloConfig (simulations, throughputWindowDays, excludeWeekends)
- [Source: packages/web/src/app/api/sprint/[project]/monte-carlo/route.ts] — API route to extend
- [Source: packages/web/src/components/MonteCarloChart.tsx] — Chart to integrate with (line 73: hardcoded simulations=5000)
- [Source: packages/web/src/components/SprintBoard.tsx] — Dashboard where config panel goes
- [Source: _bmad-output/implementation-artifacts/55-5-forecast-accuracy-tracking.md] — Previous story (done) — created forecast accuracy chart + API

### Project Structure Notes
- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/` pattern
- All existing tests must continue to pass (no regressions)
- No new npm dependencies
- Use localStorage directly (no library needed for simple key-value persistence)

## Dev Agent Record
### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- ESLint iterative fixes: unused imports/variables in route.ts, MonteCarloChart.tsx, SprintBoard.tsx, SimulationConfigPanel.tsx, and test file resolved by wiring params through to consumers
- Test failures: `userEvent.clear()` doesn't reliably clear number inputs in jsdom — fixed by using `fireEvent.change()` for number input tests

### Completion Notes List

1. All 4 acceptance criteria met
2. 15 component tests passing (SimulationConfigPanel) + 9 API route tests + 5 hook tests = 29 new tests
3. Full regression suite passing: 2148 web tests (177 files), full monorepo green
4. Code review completed — all 9 findings (3 HIGH, 3 MEDIUM, 3 LOW) fixed

### Limitations (Deferred Items)

1. **Per-epic parameter overrides**
   - Status: Deferred — Requires project-level config schema extension
   - Requires: Config schema support for per-epic simulation parameters
   - Epic: Future enhancement / Epic 55
   - Current: Parameters apply at project level only

2. **Custom confidence level values (beyond P50/P80/P95)**
   - Status: Deferred — Engine hardcodes P50/P80/P95 percentile extraction
   - Requires: Engine refactor to support arbitrary percentile extraction
   - Epic: Future enhancement / Epic 55
   - Current: Fixed P50/P80/P95 confidence levels

### File List

**Modified:**
- `packages/web/src/app/api/sprint/[project]/monte-carlo/route.ts` — Extended to accept throughputWindowDays, excludeWeekends, confidenceLevels query params; returns effectiveConfig; fixed percentile filtering; added LRU eviction for forecast cache
- `packages/web/src/components/MonteCarloChart.tsx` — Added config props (simulations, confidenceLevels, throughputWindowDays, excludeWeekends, onEffectiveConfig); filtered stat cards, percentile lines, and legend by confidenceLevels
- `packages/web/src/components/SprintBoard.tsx` — Added useSimulationConfig hook, SimulationConfigPanel, wired config + dataPointsUsed feedback to MonteCarloChart

**New:**
- `packages/web/src/lib/useSimulationConfig.ts` — Per-project simulation config hook with localStorage persistence
- `packages/web/src/components/SimulationConfigPanel.tsx` — Collapsible config panel with iteration count, confidence toggles, data window, weekend exclusion
- `packages/web/src/components/__tests__/SimulationConfigPanel.test.tsx` — 15 tests covering all panel functionality including excludeWeekends toggle
- `packages/web/src/app/api/sprint/[project]/monte-carlo/route.test.ts` — 9 API route tests for query param acceptance, clamping, and filtering
- `packages/web/src/lib/__tests__/useSimulationConfig.test.ts` — 5 tests for localStorage round-trip, reset, and project switching
