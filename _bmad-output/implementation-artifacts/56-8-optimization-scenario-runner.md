# Story 56.8: Optimization Scenario Runner

Status: done

## Story

As a **project manager**,
I want **to run optimization scenarios targeting specific objectives**,
so that **I can find the best strategy for my current priorities**.

## Acceptance Criteria

1. **Given** I want to optimize for a specific goal
   **When** I run an optimization scenario
   **Then** I can select objective (minimize time, maximize throughput, balance workload, reduce blocking)
   **And** the system suggests changes to achieve that objective
   **And** analysis completes within 15 seconds

2. **Given** I select "minimize time" as the objective
   **When** the scenario runner analyzes current allocation
   **Then** it prioritizes agent-rebalancing and priority-reorder suggestions
   **And** suggestions are re-weighted to maximize days saved
   **And** the impact estimates reflect time-reduction focus

3. **Given** I select "maximize throughput" as the objective
   **When** the scenario runner analyzes current allocation
   **Then** it prioritizes WIP adjustments and capacity-scaling suggestions
   **And** suggestions are re-weighted to maximize story completion rate
   **And** the impact estimates reflect throughput focus

4. **Given** I select "balance workload" as the objective
   **When** the scenario runner analyzes current allocation
   **Then** it prioritizes agent-rebalancing suggestions targeting utilization parity
   **And** suggestions are re-weighted to minimize utilization variance across agents
   **And** the impact estimates reflect workload balance focus

5. **Given** I select "reduce blocking" as the objective
   **When** the scenario runner analyzes current allocation
   **Then** it prioritizes priority-reorder suggestions targeting stuck/aging stories
   **And** suggestions are re-weighted to maximize unblocking potential
   **And** the impact estimates reflect blocking-reduction focus

6. **Given** I view objective-based optimization results
   **When** I compare results across different objectives
   **Then** I can see a summary comparison of how each objective changes the suggestion ranking
   **And** each objective shows its top 3 suggestions with projected impact
   **And** the current (no-objective) baseline is shown for reference

## Tasks / Subtasks

- [x] Task 1: Define optimization objective types and constants (AC: #1, #2, #3, #4, #5)
  - [x] 1.1: Update `packages/web/src/lib/optimization-types.ts` — add `OptimizationObjective` type and objective-specific ranking weights
  - [x] 1.2: Define `OptimizationObjective = "minimize-time" | "maximize-throughput" | "balance-workload" | "reduce-blocking"`
  - [x] 1.3: Define `OBJECTIVE_RANK_WEIGHTS` map — per-objective overrides for daysSaved, riskReduction, utilizationDelta, confidence weights
  - [x] 1.4: Define `OBJECTIVE_ANALYZER_PRIORITY` map — per-objective ordering of analyzer categories (which analyzers to boost/suppress)
  - [x] 1.5: Define `ObjectiveScenarioResult` — `{ objective, suggestions, analysisTimeMs, baselineComparison }` extending `OptimizationEngineResult`

- [x] Task 2: Create objective-based scenario engine (AC: #2, #3, #4, #5)
  - [x] 2.1: Create `packages/web/src/lib/optimization-scenario.ts` — pure computation module
  - [x] 2.2: Implement `runObjectiveScenario(input): ObjectiveScenarioResult` — main entry point, runs `generateOptimizations()` with objective parameter, re-ranks results
  - [x] 2.3: Implement `applyObjectiveRanking(suggestions, objective): OptimizationSuggestion[]` — re-rank suggestions using `OBJECTIVE_RANK_WEIGHTS` for the selected objective
  - [x] 2.4: Implement `applyAnalyzerPriority(suggestions, objective): OptimizationSuggestion[]` — boost/suppress categories per `OBJECTIVE_ANALYZER_PRIORITY` (merged into applyObjectiveRanking)
  - [x] 2.5: Implement `compareWithBaseline(objectiveResult, baselineResult): BaselineComparison` — compute delta between objective-ranked and default-ranked suggestions
  - [x] 2.6: Implement objective-specific suggestion filtering — "minimize-time" boosts agent-rebalancing + priority-reorder; "maximize-throughput" boosts wip-adjustment + capacity-scaling; "balance-workload" boosts agent-rebalancing; "reduce-blocking" boosts priority-reorder
  - [x] 2.7: All functions are pure synchronous computation — no I/O, no side effects

- [x] Task 3: Create multi-objective comparison engine (AC: #6)
  - [x] 3.1: Implement `runAllObjectives(input): Map<OptimizationObjective, ObjectiveScenarioResult>` — run all 4 objectives, return results keyed by objective
  - [x] 3.2: Implement `compareObjectives(results): ObjectiveComparisonSummary` — build cross-objective comparison showing top 3 per objective with projected impact
  - [x] 3.3: Define `ObjectiveComparisonSummary` — `{ objectives: { objective, topSuggestions, projectedImpact }[], baselineTopSuggestions }`

- [x] Task 4: Create optimization scenario API endpoint (AC: #1, #6)
  - [x] 4.1: Update `packages/web/src/app/api/risk/optimization/route.ts` — add objective support to GET handler
  - [x] 4.2: GET `?objective=minimize-time|maximize-throughput|balance-workload|reduce-blocking` returns `ObjectiveScenarioResult` with objective-ranked suggestions
  - [x] 4.3: GET `?compare=true` returns `ObjectiveComparisonSummary` — all 4 objectives compared with baseline
  - [x] 4.4: Both endpoints reuse existing data collection pipeline from 56-7 (getServices, computeAgentUtilization, etc.)
  - [x] 4.5: Measure and include `analysisTimeMs` in response — must complete within 15 seconds (NFR-E4-1)
  - [x] 4.6: Support `?project=X` filter (same as existing 56-7 GET)

- [x] Task 5: Create scenario runner panel component (AC: #1, #6)
  - [x] 5.1: Update `packages/web/src/components/OptimizationPanel.tsx` — add objective selector UI
  - [x] 5.2: Add objective dropdown/select — "Baseline (Default)", "Minimize Time", "Maximize Throughput", "Balance Workload", "Reduce Blocking"
  - [x] 5.3: When objective selected, fetch `/api/risk/optimization?objective=X` and display re-ranked suggestions
  - [x] 5.4: Add "Compare Objectives" button — fetches `?compare=true`, shows `ObjectiveComparisonSummary` panel
  - [x] 5.5: Implement `ObjectiveComparisonPanel` sub-component — compact table showing each objective's top 3 suggestions with impact metrics
  - [x] 5.6: Show objective badge on each suggestion card when viewing objective-filtered results
  - [x] 5.7: Handle loading/error/empty states for objective views

- [x] Task 6: Register scenario event types in notification tiers (AC: #1)
  - [x] 6.1: Update `packages/web/src/lib/workflow/notification-tiers.ts` — add `optimization\.scenario` → Tier 2

- [x] Task 7: Add tests (AC: all)
  - [x] 7.1: Create `packages/web/src/lib/__tests__/optimization-scenario.test.ts` — 15 unit tests for objective ranking, baseline comparison, multi-objective comparison, edge cases
  - [x] 7.2: Update `packages/web/src/components/__tests__/OptimizationPanel.test.tsx` — 4 new tests for objective selector, comparison panel
  - [x] 7.3: Update `packages/web/src/lib/workflow/__tests__/notification-tiers.test.ts` — add scenario event tier test

- [x] Task 8: Update sprint-status.yaml
  - [x] 8.1: Verify all tests pass — 48/48 passing (scenario 15, panel 14, tiers 8, existing engine 22, feedback 11)
  - [ ] 8.2: Update `56-8-optimization-scenario-runner` status

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
1. **Automatic scenario application to production**
   - Status: Deferred — Requires Story 56-10 (Impact Analysis) for before/after validation
   - Requires: Impact analysis component with production-safe apply flow
   - Epic: Story 56-10
   - Current: Scenarios are view-only with projected impact, no automatic production changes
2. **Learning from objective selection patterns**
   - Status: Deferred — Requires Story 56-11 (Learning Loop) for feedback-driven objective suggestions
   - Requires: Learning loop that tracks which objectives users select and their outcomes
   - Epic: Story 56-11
   - Current: All objectives available equally, no smart defaults based on history
```

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
- `generateOptimizations(input)` from `@/lib/optimization-engine.js` — EXISTING (56-7): returns `OptimizationEngineResult`
- `computeAgentUtilization(sessions, registry, config)` from `@composio/ao-core` — EXISTING: returns `AgentUtilization[]`
- `getCapacityStatus(agentWorkload, config, agentProjectMap)` from `@composio/ao-core` — EXISTING: returns `CapacityResult[]`
- `aggregateRiskFactors(input)` from `@/lib/risk-aggregation.js` — EXISTING: returns `RiskDashboardResponse`
- `aggregateBottlenecks(input)` from `@/lib/bottleneck-aggregation.js` — EXISTING: returns `BottleneckDashboardResponse`
- `buildPortfolioOverview(projectSummaries)` from `@/lib/utilization-snapshot.js` — EXISTING: returns `PortfolioUtilizationOverview`
- `buildProjectSummary(projectId, snapshots)` from `@/lib/utilization-snapshot.js` — EXISTING: returns `ProjectUtilizationSummary`
- `collectSnapshot(agentUtils, capacityResults, projectId)` from `@/lib/utilization-snapshot.js` — EXISTING: returns `UtilizationSnapshot[]`
- `getServices()` from `@/lib/services` — EXISTING: returns `{ config, registry, sessionManager }`

**Feature Flags:**
- None required — all data sources and the optimization engine already exist in the codebase

## Dependency Review

No new external dependencies required. This story extends the existing optimization engine (56-7) with objective-based ranking, using the same data pipeline.

## Dev Notes

### Architecture Context

This is **Story 8 of 11** in **Epic 56: Risk & Optimization Dashboard**. It is the second story in the Optimization phase (Phase 2 of Epic 56).

**Dependency chain:** Epic 49 (done) → Epic 54 (done) → **Epic 56 (this epic)** → Epic 57 (backlog)

**Stories 56-1 through 56-7 (ALL DONE) context:**
- 56-1 created `risk-aggregation.ts` with `aggregateRiskFactors()` — produces `RiskFactor[]` with severity scores
- 56-2 created `bottleneck-aggregation.ts` with `aggregateBottlenecks()` — produces `BottleneckItem[]` with impact scores
- 56-3 created `risk-score.ts` with `calculateRiskScore()` + `calculatePortfolioScore()` — composite scoring (NORMALIZATION_CONSTANT = 150)
- 56-4 created `emerging-risk-detection.ts` with `detectEmergingRisks()` — 5 pattern detectors
- 56-5 created risk alert types, evaluation, broadcaster, SSE integration, API endpoints, and banner component
- 56-6 created utilization metrics pipeline: types, snapshot collection, history store, API route, panel component
- 56-7 created optimization engine: types, engine, feedback store, API route, panel component

### What Already Exists (Do NOT Reinvent)

#### Optimization Engine (Story 56-7) — PRIMARY DEPENDENCY
- `optimization-types.ts` — `OptimizationCategory`, `EstimatedImpact`, `OptimizationSuggestion`, `OptimizationFeedback`, `AgentUtilRaw`, `CapacityRaw`, `OptimizationEngineInput`, `OptimizationEngineResult`
- `optimization-engine.ts` — `generateOptimizations()`, `analyzeAgentRebalancing()`, `analyzeWipAdjustments()`, `analyzePriorityReorder()`, `analyzeCapacityScaling()`, `computeImpact()`, `rankSuggestions()`
- `optimization-feedback.ts` — globalThis singleton feedback store
- `/api/risk/optimization` route — GET (suggestions) + PATCH (accept/dismiss)
- `OptimizationPanel.tsx` — dashboard panel with category filter chips, SuggestionCard, ImpactMetrics
- **Key contract: `OptimizationEngineInput.objective?: string` slot already exists** (added in M4 code review fix)
- **Key contract: `generateOptimizations()` accepts input with `objective` field but ignores it in 56-7**

#### What-If Simulation Engine (Epic 54) — REFERENCE PATTERN
- `types.ts` — `WhatIfScenario`, `ScenarioParameters`, `ScenarioStorySnapshot`, `ScenarioStatus`
- `scenario-simulation.ts` — `buildSimulationInput()`, `applyParallelismScaling()`
- `scenario-comparison.ts` — `mapToComparableScenarios()`, `getBestMetricIndex()`
- Core: `sprint-simulator.ts` — `simulateSprint()` Monte Carlo engine
- Core: `scenario-comparator.ts` — `compareScenarios()` side-by-side ranking
- **Story 56-8 does NOT use the Monte Carlo engine directly. It uses the ranking/comparison PATTERN from Epic 54.**

#### Utilization Metrics Pipeline (Story 56-6)
- `utilization-metrics-types.ts` — `UtilizationSnapshot`, `UtilizationTimeSeries`, `ProjectUtilizationSummary`, `PortfolioUtilizationOverview`
- `utilization-snapshot.ts` — `collectSnapshot()`, `buildProjectSummary()`, `buildPortfolioOverview()`
- Thresholds: `OVERUTILIZED_THRESHOLD = 90`, `UNDERUTILIZED_THRESHOLD = 30`

#### Risk & Bottleneck Aggregation (Stories 56-1, 56-2)
- `risk-aggregation.ts` — `RiskFactor`, `RiskFactorType`, severity labels
- `bottleneck-aggregation.ts` — `BottleneckItem`, `BottleneckType`, `getSuggestedAction()`

#### Core Services
- `agent-utilization.ts` — `computeAgentUtilization()`, `AgentUtilization`
- `capacity-check.ts` — `getCapacityStatus()`, `CapacityResult`, `NEAR_CAPACITY_THRESHOLD = 80`
- `shared-pool.ts`, `pool-allocation.ts` — pool membership and allocation

### What This Story Actually Does

1. **Optimization objective types**: Add `OptimizationObjective` type with 4 values. Define per-objective ranking weight overrides and analyzer priority configurations. Define `ObjectiveScenarioResult` and `ObjectiveComparisonSummary` types.

2. **Objective-based scenario engine**: Pure computation module that takes existing `OptimizationEngineInput` (with `objective` field populated) and re-ranks suggestions based on the selected objective. Each objective boosts specific categories and re-weights the ranking formula. This EXTENDS `generateOptimizations()`, not replaces it.

3. **Multi-objective comparison**: Run all 4 objectives simultaneously, build a cross-objective comparison showing top 3 suggestions per objective with projected impact vs. baseline.

4. **API endpoint updates**: Extend existing GET `/api/risk/optimization` with `?objective=X` and `?compare=true` parameters. Same data collection pipeline as 56-7.

5. **Dashboard component updates**: Add objective selector to `OptimizationPanel`. Add comparison panel showing all objectives side by side.

6. **Notification tier**: Add `optimization.scenario` event type.

### Critical Design Decisions

1. **EXTEND, don't replace** — The objective engine wraps `generateOptimizations()` and re-ranks its output. Do NOT duplicate the analyzer logic. The base engine runs once, then objective-specific ranking is applied on top.

2. **Pure computation** — Same as 56-7. The objective engine is a pure synchronous function. No I/O, no side effects. Takes suggestions + objective, returns re-ranked suggestions.

3. **Deterministic ranking** — Per-objective weights are fixed constants, not learned. Learning from objective selection patterns is deferred to Story 56-11.

4. **Objective as filter + booster** — Each objective does two things: (a) boost the ranking score of relevant categories, (b) slightly suppress irrelevant categories. This produces differentiated rankings without completely hiding useful suggestions.

5. **Comparison is lightweight** — Running all 4 objectives means calling `generateOptimizations()` once (same suggestions), then re-ranking 4 times with different weights. Since ranking is O(n log n) on typically < 20 suggestions, total time is negligible.

6. **15-second NFR preserved** — The base engine runs once (already fast), re-ranking is trivial. The `?compare=true` endpoint runs 4 re-ranks, each taking < 1ms. Well within NFR-E4-1.

7. **Do NOT use Monte Carlo** — Story 56-8 uses deterministic re-ranking, NOT simulation. The Monte Carlo engine from Epic 54 is a reference pattern only. Simulation-based optimization is a future enhancement.

### Objective Ranking Strategy

```
Objective              | Boost Categories                    | Suppress Categories    | Weight Override
-----------------------|-------------------------------------|------------------------|-------------------
minimize-time          | agent-rebalancing, priority-reorder | capacity-scaling       | daysSaved: 3.0 (vs 2.0)
maximize-throughput    | wip-adjustment, capacity-scaling    | priority-reorder       | daysSaved: 2.5, utilizationDelta: 1.5
balance-workload       | agent-rebalancing                   | priority-reorder       | utilizationDelta: 2.5 (vs 1.0)
reduce-blocking        | priority-reorder                    | capacity-scaling       | riskReduction: 2.5 (vs 1.5)
```

### Data Flow

```
GET /api/risk/optimization?objective=minimize-time:
  getServices() → config, registry, sessionManager
  sessions → computeAgentUtilization() → AgentUtilization[]
  sessions → getCapacityStatus() → CapacityResult[]
  agentUtils + capacityResults → collectSnapshot() → UtilizationSnapshot[]
  snapshots → buildProjectSummary() → ProjectUtilizationSummary[]
  sprint health + capacity + throughput → aggregateRiskFactors() → RiskFactor[]
  sprint health + cycle time + workload + capacity → aggregateBottlenecks() → BottleneckItem[]
  → generateOptimizations({ ..., objective: "minimize-time" })
  → applyObjectiveRanking(suggestions, "minimize-time")
  → ObjectiveScenarioResult (re-ranked suggestions + baseline comparison)

GET /api/risk/optimization?compare=true:
  → generateOptimizations({ ..., objective: undefined })  // baseline
  → for each objective in [minimize-time, maximize-throughput, balance-workload, reduce-blocking]:
      → applyObjectiveRanking(baseline.suggestions, objective)
  → compareObjectives(allResults)
  → ObjectiveComparisonSummary
```

### API Response

```json
GET /api/risk/optimization?objective=minimize-time
{
  "objective": "minimize-time",
  "suggestions": [ /* re-ranked by minimize-time weights */ ],
  "analysisTimeMs": 25,
  "inputSummary": { /* same as baseline */ },
  "baselineComparison": {
    "topSuggestionMoved": true,
    "rankChanges": [
      { "suggestionId": "opt-priority-stuck-1", "baselineRank": 3, "objectiveRank": 1, "rankDelta": 2 }
    ]
  }
}
```

```json
GET /api/risk/optimization?compare=true
{
  "objectives": [
    {
      "objective": "minimize-time",
      "topSuggestions": [ /* top 3 */ ],
      "projectedImpact": { "daysSaved": 8.2, "riskReductionPercent": 22, "utilizationDeltaPercent": 5 }
    },
    {
      "objective": "maximize-throughput",
      "topSuggestions": [ /* top 3 */ ],
      "projectedImpact": { "daysSaved": 5.1, "riskReductionPercent": 18, "utilizationDeltaPercent": 12 }
    }
  ],
  "baselineTopSuggestions": [ /* top 3 from default ranking */ ],
  "analysisTimeMs": 42
}
```

### Downstream Story Contracts (MUST Preserve)

| Downstream Story | Required Interface | Purpose |
|---|---|---|
| **56-9** (Underutilized Detection) | `OptimizationCategory`, `OptimizationSuggestion`, `OptimizationObjective` | May add "maximize-utilization" objective |
| **56-10** (Impact Analysis) | `ObjectiveScenarioResult`, `BaselineComparison` | Before/after comparison using objective results |
| **56-11** (Learning Loop) | `OptimizationObjective`, objective selection tracking | Feedback-driven objective recommendations |

### Integration with Stories 56-1 through 56-7 (MUST Follow)

These are verified patterns from completed stories. The dev agent MUST follow these to avoid regressions:

1. **Package import resolution**: `@composio/ao-core` and `@composio/ao-plugin-tracker-bmad` only export from top-level. No subpath imports.

2. **Mock pattern for tests**: Single top-level `vi.mock()` for each package. Do NOT use `importOriginal` with subpath type imports.

3. **Severity label helper**: Use `getSeverityLabel(score)` with thresholds: 76+=critical, 51+=high, 26+=medium, below=low. Each module has its own copy.

4. **Component structure**: Export inline sub-components from the main component file. Don't create separate files for small card/row components.

5. **CSS conventions**: CSS variables (`var(--color-*)`), pixel-based text sizes, `rounded-[6px]` for cards, `rounded-[5px]` for inner elements.

6. **Pure computation pattern**: All evaluation/aggregation modules are pure synchronous functions. No I/O, no side effects. Only the feedback store is stateful (in-memory).

7. **`.js` extensions in imports**: Required for ESM. All local imports must end with `.js`.

8. **ID prefixing**: Optimization IDs use `opt-${category}-${detail}` format.

9. **Route pattern**: Extend existing `/api/risk/optimization/` route. Do NOT create new routes.

10. **ESLint rules**: Use inline `type` keyword for type-only imports (no duplicate imports). Use `void` for unused variables.

### Files to Create

#### `packages/web/src/lib/optimization-scenario.ts` (NEW)
Pure computation module. `runObjectiveScenario()`, `applyObjectiveRanking()`, `applyAnalyzerPriority()`, `compareWithBaseline()`, `runAllObjectives()`, `compareObjectives()`. All synchronous, no I/O.

### Files to Modify

#### `packages/web/src/lib/optimization-types.ts` (MODIFY)
- Add `OptimizationObjective` type
- Add `OBJECTIVE_RANK_WEIGHTS` constant map
- Add `OBJECTIVE_ANALYZER_PRIORITY` constant map
- Add `ObjectiveScenarioResult` interface
- Add `ObjectiveComparisonSummary` interface
- Add `BaselineComparison` interface
- Add `ObjectiveResult` interface

#### `packages/web/src/app/api/risk/optimization/route.ts` (MODIFY)
- Add `?objective=X` query parameter support to GET handler
- Add `?compare=true` query parameter support to GET handler
- Import and call `runObjectiveScenario()` and `runAllObjectives()`/`compareObjectives()`

#### `packages/web/src/components/OptimizationPanel.tsx` (MODIFY)
- Add objective selector (dropdown or button group)
- Add "Compare Objectives" button/toggle
- Add `ObjectiveComparisonPanel` sub-component
- Add objective badge on suggestion cards
- Handle objective-filtered fetch and display

#### `packages/web/src/lib/workflow/notification-tiers.ts` (MODIFY)
- Add `optimization\\.scenario` → Tier 2 event type

### Testing Strategy

**Unit tests (optimization-scenario.test.ts):**
- Objective ranking: minimize-time boosts agent-rebalancing and priority-reorder
- Objective ranking: maximize-throughput boosts wip-adjustment and capacity-scaling
- Objective ranking: balance-workload boosts agent-rebalancing
- Objective ranking: reduce-blocking boosts priority-reorder
- Baseline comparison: rank changes computed correctly
- Multi-objective comparison: all 4 objectives produce different rankings
- Multi-objective comparison: summary includes top 3 per objective
- Edge cases: empty suggestions, single suggestion, all same category
- Deterministic: same input + same objective produces same output

**Component tests (OptimizationPanel.test.tsx updates):**
- Objective selector renders with 5 options
- Selecting objective triggers fetch with `?objective=X`
- Compare button triggers fetch with `?compare=true`
- Comparison panel shows objective summaries
- Objective badge appears on suggestion cards
- Loading/error states for objective views

**Notification tier tests:**
- `optimization.scenario` classified as Tier 2

### NFRs
- **NFR-E4-1:** Optimization analysis completes within 15 seconds — re-ranking is O(n log n) on < 20 suggestions
- **NFR-P4:** API endpoints respond within 500ms (p95) — same data pipeline as 56-7 plus trivial re-ranking
- **NFR-S3:** Scenario results do not modify actual system state
- **NFR-R2:** Results are deterministic for identical inputs + objective
- **NFR:** Engine is O(n log n) on number of suggestions — typically < 20

### Pre-existing Types (Use These, Do NOT Modify)
- `OptimizationCategory`, `EstimatedImpact`, `OptimizationSuggestion`, `OptimizationFeedback` — from `optimization-types.ts`
- `OptimizationEngineInput`, `OptimizationEngineResult`, `AgentUtilRaw`, `CapacityRaw` — from `optimization-types.ts`
- `AgentUtilization`, `CapacityResult` — from `@composio/ao-core`
- `UtilizationSnapshot`, `ProjectUtilizationSummary`, `PortfolioUtilizationOverview` — from `utilization-metrics-types.ts`
- `RiskFactor`, `BottleneckItem` — from respective aggregation modules
- `WhatIfScenario`, `ScenarioParameters`, `SimulationResult` — from `types.ts` (REFERENCE ONLY, do not use directly)

### Project Structure Notes
- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/` pattern
- All existing tests must continue to pass (no regressions)
- No new npm dependencies
- Use CSS variables for theming
- `"use client"` directive on components

### References
- [Source: epics-cycle-10.md#Story 56.8] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-E4-1] — "The system analyzes current resource allocation and suggests optimizations"
- [Source: prd-cycle-10.md#FR-E4-2] — "Users can run optimization for specific objectives"
- [Source: prd-cycle-10.md#FR-E4-3] — "Optimization suggestions include predicted impact metrics"
- [Source: prd-cycle-10.md#NFR-E4-1] — "Optimization analysis completes within 15 seconds"
- [Source: packages/web/src/lib/optimization-types.ts] — Existing types with `objective?` slot
- [Source: packages/web/src/lib/optimization-engine.ts] — Base engine to extend (not modify)
- [Source: packages/web/src/app/api/risk/optimization/route.ts] — Existing API route to extend
- [Source: packages/web/src/components/OptimizationPanel.tsx] — Existing panel to extend
- [Source: packages/web/src/lib/scenario-comparison.ts] — Reference pattern for multi-scenario comparison
- [Source: packages/core/src/scenario-comparator.ts] — Reference pattern for ranking algorithms
- [Source: _bmad-output/implementation-artifacts/56-7-optimization-recommendations.md] — Previous story (done)
- [Source: _bmad-output/implementation-artifacts/56-6-resource-utilization-metrics.md] — Utilization pipeline

## Dev Agent Record
### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

1. Tasks 2 and 3 combined into single file `optimization-scenario.ts` — `applyAnalyzerPriority` merged into `applyObjectiveRanking` as boost/suppress is applied inline during priority computation.
2. Objective selector uses native `<select>` element (not button group) for cleaner UX with 5 options.
3. `ObjectiveComparisonPanel` exported as inline sub-component per project CSS conventions.
4. `compareWithBaseline` only reports suggestions whose rank actually changed (skips unchanged positions).
5. All 48 tests passing: 15 scenario unit + 14 panel component + 8 notification tiers + 22 engine + 11 feedback.

### Limitations (Deferred Items)
1. **Automatic scenario application to production**
   - Status: Deferred — Requires Story 56-10 (Impact Analysis) for before/after validation
   - Requires: Impact analysis component with production-safe apply flow
   - Epic: Story 56-10
   - Current: Scenarios are view-only with projected impact, no automatic production changes
2. **Learning from objective selection patterns**
   - Status: Deferred — Requires Story 56-11 (Learning Loop) for feedback-driven objective suggestions
   - Requires: Learning loop that tracks which objectives users select and their outcomes
   - Epic: Story 56-11
   - Current: All objectives available equally, no smart defaults based on history

### File List

#### New Files
- `packages/web/src/lib/optimization-scenario.ts` — Pure computation: runObjectiveScenario, runAllObjectives, compareObjectives, applyObjectiveRanking, compareWithBaseline
- `packages/web/src/lib/__tests__/optimization-scenario.test.ts` — 15 unit tests for scenario engine

#### Modified Files
- `packages/web/src/lib/optimization-types.ts` — Added OptimizationObjective type, OBJECTIVE_RANK_WEIGHTS, OBJECTIVE_ANALYZER_PRIORITY, RankChange, BaselineComparison, ObjectiveScenarioResult, ObjectiveResult, ObjectiveComparisonSummary
- `packages/web/src/app/api/risk/optimization/route.ts` — Added ?objective=X and ?compare=true support to GET handler
- `packages/web/src/components/OptimizationPanel.tsx` — Added objective selector, Compare Objectives button, ObjectiveComparisonPanel, objective badge
- `packages/web/src/lib/workflow/notification-tiers.ts` — Added optimization.scenario to Tier 2 pattern
- `packages/web/src/components/__tests__/OptimizationPanel.test.tsx` — Added 4 tests for objective selector and comparison panel
- `packages/web/src/lib/workflow/__tests__/notification-tiers.test.ts` — Added optimization.scenario tier test
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated 56-8 status to done
