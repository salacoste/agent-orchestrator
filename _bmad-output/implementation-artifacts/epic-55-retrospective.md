# Epic 55 Retrospective — Monte Carlo Forecasting

**Date**: 2026-04-29
**Epic**: 55 — Monte Carlo Forecasting
**Status**: Complete (all 6 stories done)
**Source**: epics-cycle-10.md (Intelligence phase, Cycle 10 Phase 2)

## Epic Summary

Epic 55 delivered a full Monte Carlo forecasting pipeline: the simulation engine produces probabilistic completion dates at P50/P80/P95 confidence levels, the probability distribution is visualized as an interactive SVG histogram with tooltips and percentile markers, historical velocity learning adds a feedback loop by persisting forecast snapshots to JSONL and computing calibration scores against actual outcomes, automatic forecast updates push recalculation through SSE when story completion counts change, forecast accuracy tracking renders a scatter plot of predicted-vs-actual dates with bias detection, and a configuration panel lets project managers tune iteration count, confidence level visibility, and historical data windows per-project.

The epic leveraged substantial pre-existing infrastructure from Epic 54 (What-If Simulation) — the `computeMonteCarloForecast()` function, `MonteCarloResult` types, the Monte Carlo API route, and the `MonteCarloChart` component all existed before Story 55-1 started. The work was alignment, hardening, and feature extension rather than greenfield development.

## Story Delivery

| Story | Title | Tests | Review Fixes | Status |
|-------|-------|-------|-------------|--------|
| 55-1 | Monte Carlo Simulation Core | 6 new (458 tracker-bmad total) | 0 (alignment story) | Done |
| 55-2 | Probability Distribution Visualization | 12 new (2097 web total) | 3H+3M+1L | Done |
| 55-3 | Historical Velocity Learning | 12 new (3251 total regression) | 1 (markForecastActual wiring) | Done |
| 55-4 | Automatic Forecast Updates | 13 new (2583 total regression) | 5 (severity, auto-dismiss, SSE reconnect, broadcaster tests, SSE auto-refresh tests) | Done |
| 55-5 | Forecast Accuracy Tracking | 5 new | 0 (clean) | Done |
| 55-6 | Simulation Parameter Configuration | 29 new (2148 web total) | 9 (3H+3M+3L) | Done |

**Total new tests**: ~77 across tracker-bmad and web packages
**New modules**: forecast-log.ts, forecast-calibration.ts, forecast-diff.ts, forecast-change-broadcaster.ts, SimulationConfigPanel.tsx, ForecastAccuracyChart.tsx, useSimulationConfig.ts
**New API endpoints**: GET /api/sprint/{project}/forecast-accuracy
**External dependencies added**: 0
**Code reviews**: 5 stories reviewed, ~23 issues caught and fixed

## What Went Well

1. **Substantial pre-existing infrastructure reduced scope** — Epic 54's what-if simulation system built `computeMonteCarloForecast()`, the `MonteCarloResult` type hierarchy, the Monte Carlo API route, and the chart component. Story 55-1 was an alignment story (P85 to P80) rather than a new build, and subsequent stories layered on top of working foundations. This is the clearest example in the project of an epic benefiting from its predecessor's investment.

2. **JSONL forecast persistence pattern** — Story 55-3's `forecast-log.ts` followed the existing `sprint-history.jsonl` pattern, giving forecast snapshots append-only persistence with zero new infrastructure. The `markForecastActual()` integration in the SSE events route (added during code review) closed the feedback loop without requiring a separate persistence mechanism.

3. **Forecast change broadcaster as globalThis singleton** — Story 55-4's `forecast-change-broadcaster.ts` followed the `conflict-broadcaster.ts` pattern exactly: `Set<Callback>` fan-out with unsubscribe, `globalThis` for hot-reload survival. This is now the third instance of the pattern in the codebase (conflict, workflow, forecast), confirming it as a stable architectural primitive for in-process pub/sub.

4. **Clean SSE event type taxonomy** — Story 55-4 introduced `forecast-stale` and `forecast-changed` as new SSE event types alongside existing `snapshot`, `session.activity`, and `cross-project-dep-changed`. The events are well-scoped: `forecast-stale` is a signal to re-fetch, `forecast-changed` is a notification of significant shift. The 5-second SSE polling cycle meant zero new polling infrastructure was needed.

5. **Scatter plot for accuracy visualization** — Story 55-5's predicted-vs-actual scatter plot with a diagonal "perfect prediction" reference line and color-coded data points (green for within P80, yellow for within P95, red for beyond P95) provides immediate visual feedback on forecast quality. The bias indicator (optimistic/pessimistic/neutral) and accuracy trend (improving/stable/degrading) give actionable context.

6. **Configuration panel wired through to engine** — Story 55-6 did not modify the Monte Carlo engine. The `MonteCarloConfig` type already had `simulations`, `throughputWindowDays`, and `excludeWeekends` fields. The story wired these through the API route and added a UI panel, demonstrating that the engine's interface was correctly designed for future configurability.

## What Could Be Improved

1. **P85 to P80 alignment was a pre-epic discrepancy** — Story 55-1's primary work was renaming P85 to P80 across the engine, chart, CLI, and tests. This was a requirement alignment fix, not new functionality. The PRD specified P80 from the start but the initial Epic 54 implementation used P85. Earlier PRD-to-implementation validation would have caught this.

2. **Velocity percentage detection deferred** — Story 55-4's AC #1 specifies "velocity changes significantly (>10%)" as a forecast recalculation trigger, but the implementation only detects story completion count changes. True velocity percentage detection requires a velocity baseline that does not yet exist. The deferred item is noted but AC #1 is only partially met through the count-based proxy.

3. **SSE auto-refresh tests are fragile** — Story 55-4's SSE auto-refresh tests mock `EventSource` and `setTimeout` in ways that are sensitive to component lifecycle timing. Tests that verify exponential backoff reconnection and 30-second polling fallback rely on `vi.useFakeTimers()` and can fail under certain test runner configurations.

4. **userEvent.clear() unreliability with number inputs** — Story 55-6 discovered that `userEvent.clear()` does not reliably clear HTML number inputs in jsdom. The fix was to use `fireEvent.change()` instead. This is a known jsdom limitation but it was not caught until the config panel tests were written, suggesting that number input testing patterns should be documented.

5. **MonteCarloData inline type drift** — The `MonteCarloData` type is defined inline in `MonteCarloChart.tsx` rather than imported from a canonical source. Over the 6 stories, it was extended multiple times (insufficientData, calibration, effectiveConfig). Each extension risked type mismatch with the API response. A shared type in tracker-bmad or core would prevent drift.

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) — project vision, priorities, user outcomes
- Nova (Architect) — system design, interfaces, extensibility
- Blaze (Dev) — implementation, patterns, pain points
- Pax (QA) — test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** Epic 55 delivers the forecasting intelligence layer that makes sprint planning data-driven rather than intuition-based. Project managers now see "P80 completion: April 15" instead of "we think mid-April." The automatic updates via SSE mean the forecast is always current, and the accuracy tracking creates accountability — teams can see whether forecasts are reliable. The config panel giving control over simulation parameters addresses the "black box" concern that stakeholders raised during Cycle 9 planning.

**Nova (Architect):** The JSONL forecast log pattern is the strongest architectural contribution of this epic. It creates a self-contained feedback loop: every forecast is persisted, every sprint completion marks actuals, and calibration reads both to produce accuracy metrics. No database, no migration, no schema — just append-only JSONL following the existing pattern. The `ForecastSnapshot` type with `actualCompletionDate` as an optional field is a clean design for temporal data where the outcome is not yet known at write time.

**Blaze (Dev):** The codebase reuse was exceptional. Story 55-1 was essentially "rename P85 to P80 and add a boolean flag." Story 55-6 was "wire existing config fields through the API and add a UI panel." Neither required engine changes. The engine's `MonteCarloConfig` interface with optional fields (simulations, throughputWindowDays, excludeWeekends, randomFn) was designed with future configurability in mind, and that investment paid off.

**Pax (QA):** 77 new tests across 6 stories, with real assertions covering edge cases (insufficient data, SSE fallback, config clamping, confidence level toggle constraints). Story 55-6's test that verifies you cannot uncheck the last confidence level is a good example of testing a UX constraint, not just a data path. The regression counts (3251 at peak, 2148 web tests at completion) confirm no cross-story breakage.

---

### What Could Be Improved

**R2d2 (Project Lead):** The velocity percentage detection gap in Story 55-4 means we detect story completions but not velocity changes. If a team's throughput drops from 5 stories/day to 2 stories/day without any individual story completing, the forecast will not recalculate until the next story completes. This is a real gap for teams with long-running stories.

**Nova (Architect):** The `MonteCarloData` inline type in MonteCarloChart.tsx is an accident waiting to happen. It has been modified in Stories 55-1, 55-2, 55-3, 55-4, and 55-6. Each modification touched the same file's inline type definition. This should be extracted to a canonical type in tracker-bmad's exports, alongside `MonteCarloResult`.

**Blaze (Dev):** The forecast-change-broadcaster and forecast-diff modules are only used by the web SSE events route and the monte-carlo API route respectively. They could have been local functions in those route files rather than separate modules. The singleton pattern adds indirection for what is currently a point-to-point communication channel.

**Pax (QA):** Two deferred items carry measurable risk: (1) velocity percentage detection means AC #1 of Story 55-4 is only partially met, and (2) sprint boundary detection in the forecast log means forecasts are not automatically segmented by sprint — all forecasts live in a single JSONL file. The latter is manageable at current scale but becomes a filtering concern as the log grows.

---

### Previous Retro Action Items Review

Epic 54 (What-If Simulation) retrospective action items (if any) are not available — Epic 54 retrospective was not filed. Reviewing against general Cycle 10 concerns:

| # | Action Item | Status | Notes |
|---|------------|--------|-------|
| 1 | Extract MonteCarloData to canonical shared type | Not done | Carried forward |
| 2 | Document number input testing pattern (fireEvent vs userEvent) | Not done | Discovered in 55-6 |
| 3 | Add velocity baseline tracking for percentage-based triggers | Not done | Requires new module |

---

### Deferred Items Forward

| Item | Deferred To | Story |
|------|------------|-------|
| Velocity percentage-based forecast recalculation trigger | Tech debt | 55-4 |
| Sprint boundary detection in forecast log | Tech debt | 55-3 |
| Export simulation results as PDF/CSV | Tech debt | 55-1 |
| Probability curve (smooth line) overlay on histogram | Tech debt | 55-2 |
| Per-epic accuracy breakdown | Tech debt | 55-5 |
| Per-epic simulation parameter overrides | Tech debt | 55-6 |
| Custom confidence level values beyond P50/P80/P95 | Tech debt | 55-6 |
| Extract MonteCarloData inline type to shared canonical type | Tech debt | — |

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 6 |
| Stories with 0 review issues | 2 (55-1, 55-5) |
| Stories with code review | 5 (55-1 skipped — alignment only) |
| Total review issues found | ~23 |
| Total new tests | ~77 |
| External dependencies added | 0 |
| New API endpoints | 1 (forecast-accuracy) |
| New SSE event types | 2 (forecast-stale, forecast-changed) |
| New UI components | 2 (ForecastAccuracyChart, SimulationConfigPanel) |
| New backend modules | 3 (forecast-log, forecast-calibration, forecast-diff) |
| Deferred items | 8 |
| Epic duration | ~4 days |

## Technical Artifacts Created

**Backend (tracker-bmad plugin):**
- `forecast-log.ts` — JSONL append-only persistence for forecast snapshots
- `forecast-calibration.ts` — Calibration scoring (P50/P80/P95 hit rates, bias)
- `forecast-diff.ts` — Forecast comparison with significance detection (>2 day shift)
- `forecast-log.test.ts` — 7 tests
- `forecast-calibration.test.ts` — 5 tests
- `forecast-diff.test.ts` — 5 tests

**Web (API routes):**
- `api/sprint/[project]/forecast-accuracy/route.ts` — Dedicated accuracy endpoint
- `api/sprint/[project]/monte-carlo/route.ts` — Extended with forecast logging, calibration, config params, diff detection, LRU cache eviction
- `api/events/route.ts` — Extended with forecast-stale and forecast-changed SSE events, markForecastActual integration

**Web (components):**
- `ForecastAccuracyChart.tsx` — SVG scatter plot with predicted-vs-actual, calibration cards, trend indicator
- `SimulationConfigPanel.tsx` — Collapsible config panel (iterations, confidence levels, data window, weekend exclusion)
- `MonteCarloChart.tsx` — Enhanced with hover tooltips, percentile legend, SSE auto-refresh, calibration card, config props
- `useSimulationConfig.ts` — Per-project localStorage persistence hook

**CLI:**
- `commands/monte-carlo.ts` — P80 label update

## Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Extract MonteCarloData inline type to shared canonical type in tracker-bmad | Dev | MEDIUM |
| 2 | Add velocity baseline tracking module for percentage-based forecast triggers | Dev | MEDIUM |
| 3 | Document number input testing pattern (fireEvent.change vs userEvent.clear) in test conventions | Dev | LOW |
| 4 | Add sprint boundary segmentation to forecast log (per-sprint JSONL files) | Dev | LOW |
| 5 | Add arbitrary percentile extraction to Monte Carlo engine (beyond hardcoded P50/P80/P95) | Dev | LOW |
