# Story 56.10: Optimization Impact Analysis

Status: done

## Story

As a **project manager**,
I want **to see the estimated impact before accepting an optimization**,
so that **I can make informed decisions about changes**.

## Acceptance Criteria

1. **Given** an optimization suggestion is displayed
   **When** I expand the suggestion details
   **Then** I see estimated impact on completion date, velocity, and risk
   **And** the impact values are computed from the suggestion's `EstimatedImpact` data

2. **Given** an optimization suggestion has affected entities
   **When** I view the suggestion details
   **Then** I see which stories and projects are affected
   **And** affected agents, stories, and projects are listed with counts

3. **Given** I am viewing an optimization suggestion
   **When** I click "Compare Impact"
   **Then** a before/after comparison panel appears
   **And** I see current metrics vs projected metrics side-by-side
   **And** the comparison includes utilization %, estimated completion shift, velocity delta, and risk change

4. **Given** the impact analysis runs
   **When** the computation executes
   **Then** it completes within the existing 15-second NFR budget
   **And** results are deterministic for identical inputs

## Tasks / Subtasks

- [x] Task 1: Define impact analysis types (AC: #1, #3)
  - [x] 1.1: Add `ImpactAnalysis` interface to `optimization-types.ts` — contains `completionDateShift`, `velocityDelta`, `riskChange`, `beforeMetrics`, `afterMetrics`
  - [x] 1.2: Add `MetricsSnapshot` interface — `{ utilizationPercent, velocity, riskScore, activeAgents, storiesAtRisk }` for before/after comparison
  - [x] 1.3: Add `SuggestionImpactDetail` interface — wraps `OptimizationSuggestion` with computed `ImpactAnalysis`

- [x] Task 2: Create impact analysis computation module (AC: #1, #2, #3, #4)
  - [x] 2.1: Create `packages/web/src/lib/optimization-impact.ts` — pure computation module
  - [x] 2.2: Implement `analyzeSuggestionImpact(suggestion, input): ImpactAnalysis` — main function
  - [x] 2.3: Compute completion date shift from `impact.daysSaved` — translate days saved into projected date offset
  - [x] 2.4: Compute velocity delta from `impact.utilizationDeltaPercent` — map utilization change to velocity estimate
  - [x] 2.5: Compute risk change from `impact.riskReductionPercent` — before/after risk score derivation
  - [x] 2.6: Build `beforeMetrics` snapshot from current `OptimizationEngineInput` state
  - [x] 2.7: Build `afterMetrics` snapshot by applying suggestion's estimated impact to before state
  - [x] 2.8: Implement `analyzeAllSuggestions(suggestions, input): SuggestionImpactDetail[]` — batch wrapper
  - [x] 2.9: All functions are pure synchronous computation — no I/O, no side effects

- [x] Task 3: Add impact analysis mode to API route (AC: #1, #3)
  - [x] 3.1: Update `packages/web/src/app/api/risk/optimization/route.ts` — add `?impact=true` query param support
  - [x] 3.2: When `impact=true`, run `generateOptimizations` then `analyzeAllSuggestions` and return enhanced results
  - [x] 3.3: Add optional `?suggestionId=X` param to get impact analysis for a single suggestion

- [x] Task 4: Update OptimizationPanel with impact details and comparison (AC: #1, #2, #3)
  - [x] 4.1: Add `ImpactDetail` sub-component to `OptimizationPanel.tsx` — renders completion date shift, velocity delta, risk change
  - [x] 4.2: Add `BeforeAfterComparison` sub-component — side-by-side before/after metrics display
  - [x] 4.3: Update `SuggestionCard` to include expandable impact detail section
  - [x] 4.4: Add "Compare Impact" button to `SuggestionCard` that toggles `BeforeAfterComparison`
  - [x] 4.5: Add fetch callback for impact analysis: `fetchImpact(suggestionId?)` calling GET with `?impact=true`

- [x] Task 5: Add tests (AC: all)
  - [x] 5.1: Create `packages/web/src/lib/__tests__/optimization-impact.test.ts` — unit tests for impact computation
  - [x] 5.2: Update `packages/web/src/components/__tests__/OptimizationPanel.test.tsx` — add test for impact detail rendering
  - [x] 5.3: Update API route test — add test for `?impact=true` query param

- [x] Task 6: Update sprint-status.yaml
  - [x] 6.1: Run full test suite — all tests passing
  - [x] 6.2: Update `56-10-optimization-impact-analysis` status to review

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
1. **Actual completion date computation**
   - Status: Deferred — Requires sprint end date and story completion tracking data
   - Requires: Sprint timeline with start/end dates and per-story completion estimates
   - Epic: Future enhancement
   - Current: Completion date shift expressed as days offset from `daysSaved`, not absolute dates
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
- `computeImpact(params)` from `@/lib/optimization-engine.js` — EXISTING (56-7): returns `EstimatedImpact`
- `getServices()` from `@/lib/services` — EXISTING: returns `{ config, registry, sessionManager }`
- `computeAgentUtilization(sessions, registry, config)` from `@composio/ao-core` — EXISTING: returns `AgentUtilization[]`
- `getCapacityStatus(agentWorkload, config, agentProjectMap)` from `@composio/ao-core` — EXISTING: returns `CapacityResult[]`

**Feature Flags:**
- None required — all data sources and the optimization engine already exist in the codebase

## Dependency Review

No new external dependencies required. This story extends the existing optimization engine (56-7) with impact analysis computation, using the same data pipeline.

## Dev Notes

### Architecture Context

This is **Story 10 of 11** in **Epic 56: Risk & Optimization Dashboard**. It is the fourth story in the Optimization phase (Phase 2 of Epic 56).

**Dependency chain:** Epic 49 (done) → Epic 54 (done) → **Epic 56 (this epic)** → Epic 57 (backlog)

**Stories 56-1 through 56-9 (ALL DONE) context:**
- 56-1 created `risk-aggregation.ts` with `aggregateRiskFactors()` — produces `RiskFactor[]` with severity scores
- 56-2 created `bottleneck-aggregation.ts` with `aggregateBottlenecks()` — produces `BottleneckItem[]` with impact scores
- 56-3 created `risk-score.ts` with `calculateRiskScore()` + `calculatePortfolioScore()` — composite scoring (NORMALIZATION_CONSTANT = 150)
- 56-4 created `emerging-risk-detection.ts` with `detectEmergingRisks()` — 5 pattern detectors
- 56-5 created risk alert types, evaluation, broadcaster, SSE integration, API endpoints, and banner component
- 56-6 created utilization metrics pipeline: types, snapshot collection, history store, API route, panel component
- 56-7 created optimization engine: types, engine, feedback store, API route, panel component
- 56-8 created optimization scenario engine: objective ranking, multi-objective comparison, API + UI extensions
- 56-9 created underutilized agent analyzer: detection, reallocation suggestions, category integration

### What Already Exists (Do NOT Reinvent)

#### Optimization Engine (Stories 56-7, 56-8, 56-9) — PRIMARY DEPENDENCY
- `optimization-types.ts` — `OptimizationCategory` (5 values), `EstimatedImpact`, `OptimizationSuggestion`, `OptimizationFeedback`, `AgentUtilRaw`, `CapacityRaw`, `OptimizationEngineInput`, `OptimizationEngineResult`, `OptimizationObjective`, objective ranking weights and priorities, `UnderutilizedAgentData`
- `optimization-engine.ts` — `generateOptimizations()` runs 5 analyzers: `analyzeAgentRebalancing`, `analyzeWipAdjustments`, `analyzePriorityReorder`, `analyzeCapacityScaling`, `analyzeUnderutilizedAgents`. Then `rankSuggestions()` and returns result. Also exports `computeImpact(params)` helper.
- `optimization-scenario.ts` — `runObjectiveScenario()`, `runAllObjectives()`, `compareObjectives()`, `applyObjectiveRanking()`, `compareWithBaseline()`. Re-ranks suggestions per objective.
- `optimization-feedback.ts` — globalThis singleton feedback store for accept/dismiss tracking
- `/api/risk/optimization` route — GET (suggestions, objective scenarios, comparison) + PATCH (accept/dismiss)
- `OptimizationPanel.tsx` — dashboard panel with category filter chips, `SuggestionCard`, `ImpactMetrics`, `ObjectiveComparisonPanel`

#### Key Existing Impact Data (ALREADY COMPUTED)
- `OptimizationSuggestion.impact` — `EstimatedImpact` with:
  - `daysSaved: number` — estimated days saved by applying suggestion
  - `riskReductionPercent: number` — estimated risk reduction (0-100)
  - `utilizationDeltaPercent: number` — estimated utilization change
  - `affectedAgents: string[]` — agent IDs affected
  - `affectedProjects: string[]` — project IDs affected
  - `affectedStories: string[]` — story IDs affected
- `OptimizationSuggestion.confidence` — 0-100 confidence score
- `OptimizationSuggestion.priority` — computed ranking score

#### Existing Impact Display (ALREADY WORKING)
- `ImpactMetrics` sub-component in `OptimizationPanel.tsx` — renders `daysSaved`, `riskReductionPercent`, `utilizationDeltaPercent` as a compact metrics row
- `SuggestionCard` sub-component — renders suggestion with title, description, category badge, impact metrics, accept/dismiss buttons

#### Risk Score Computation (Story 56-3)
- `risk-score.ts` — `calculateRiskScore(riskFactors, bottlenecks)` returns composite risk score (0-100)
- `NORMALIZATION_CONSTANT = 150` used for score normalization

#### Utilization Metrics (Story 56-6)
- `utilization-snapshot.ts` — `collectSnapshot()`, `buildProjectSummary()`, `buildPortfolioOverview()`
- `ProjectUtilizationSummary` — `{ projectId, avgUtilization, overutilizedCount, underutilizedCount, agentCount, agentSnapshots }`

### What This Story Actually Does

1. **New types**: Add `ImpactAnalysis`, `MetricsSnapshot`, `SuggestionImpactDetail` to `optimization-types.ts`.

2. **New computation module**: Create `optimization-impact.ts` — pure computation module with `analyzeSuggestionImpact()` and `analyzeAllSuggestions()`. Translates raw `EstimatedImpact` data into human-readable impact dimensions:
   - Completion date shift (days → projected offset)
   - Velocity delta (utilization change → velocity estimate)
   - Risk change (risk reduction → before/after risk scores)
   - Before/after metrics snapshots

3. **API enhancement**: Add `?impact=true` mode to the existing `/api/risk/optimization` GET route. Optionally filter by `suggestionId`.

4. **UI enhancement**: Add expandable impact detail section to `SuggestionCard` and before/after comparison panel.

### Critical Design Decisions

1. **EXTEND existing, NOT replace** — The `ImpactMetrics` sub-component already shows raw values. This story adds a deeper analysis layer that computes derived metrics. Do NOT modify `ImpactMetrics` — add a separate `ImpactDetail` component for the expanded view.

2. **Pure computation** — Same as 56-7, 56-8, and 56-9. The impact analysis is a pure synchronous function. No I/O, no side effects.

3. **Computation approach** — The impact analysis takes the same `OptimizationEngineInput` and an `OptimizationSuggestion`, and computes:
   - `completionDateShift = suggestion.impact.daysSaved` (direct mapping — days saved = earlier completion)
   - `velocityDelta = suggestion.impact.utilizationDeltaPercent * VELOCITY_UTILIZATION_RATIO` (utilization improvement maps to velocity)
   - `riskChange.before = calculateRiskScore(input.riskFactors, input.bottlenecks)` (current risk)
   - `riskChange.after = before * (1 - suggestion.impact.riskReductionPercent / 100)` (projected risk after applying)
   - `beforeMetrics` = snapshot from current input state
   - `afterMetrics` = beforeMetrics with suggestion's impact applied

4. **API route extension** — Use existing `?impact=true` query param on the same GET route. Do NOT create new routes.

5. **UI pattern** — The `SuggestionCard` already has compact impact display. Add an expandable section triggered by a "Compare Impact" button. The expanded view shows the `BeforeAfterComparison` panel.

6. **No new data collection** — All data needed is already in `OptimizationEngineInput` and `OptimizationSuggestion`. No new API calls or data sources.

7. **ID prefixing** — Follow convention: impact analysis results don't need separate IDs since they're computed per-suggestion.

### Analyzer Logic

```
analyzeSuggestionImpact(suggestion, input):
  1. Build beforeMetrics snapshot from input:
     - utilizationPercent = weighted average from input.projectSummaries
     - velocity = compute from avgUtilization * VELOCITY_UTILIZATION_RATIO
     - riskScore = calculateRiskScore(input.riskFactors, input.bottlenecks)
     - activeAgents = count from input.agentUtilizations where isActive
     - storiesAtRisk = count from suggestion.impact.affectedStories
  2. Build afterMetrics by applying suggestion impact:
     - utilizationPercent = before + suggestion.impact.utilizationDeltaPercent
     - velocity = before + velocityDelta
     - riskScore = before * (1 - suggestion.impact.riskReductionPercent / 100)
     - activeAgents = same (suggestions don't change agent count)
     - storiesAtRisk = max(0, before - suggestion.impact.affectedStories.length)
  3. Compute derived metrics:
     - completionDateShift = suggestion.impact.daysSaved (positive = earlier)
     - velocityDelta = after.velocity - before.velocity
     - riskChange = { before: before.riskScore, after: after.riskScore, delta: before - after }
  4. Return ImpactAnalysis
```

### Data Flow

```
GET /api/risk/optimization?impact=true:
  (existing pipeline) → engineInput
  generateOptimizations(engineInput) → baseResult
  analyzeAllSuggestions(baseResult.suggestions, engineInput) → enhancedResults
  return { ...baseResult, suggestions: enhancedResults }

GET /api/risk/optimization?impact=true&suggestionId=opt-rebalancing-a1:
  (existing pipeline) → engineInput
  generateOptimizations(engineInput) → baseResult
  find suggestion by ID → singleSuggestion
  analyzeSuggestionImpact(singleSuggestion, engineInput) → impactAnalysis
  return { suggestion, impactAnalysis }
```

### Downstream Story Contracts (MUST Preserve)

| Downstream Story | Required Interface | Purpose |
|---|---|---|
| **56-11** (Learning Loop) | `ImpactAnalysis` type available for feedback-weighted impact scoring | Learning model considers actual vs predicted impact |

### Integration with Stories 56-1 through 56-9 (MUST Follow)

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

#### `packages/web/src/lib/optimization-impact.ts` (NEW)
Pure computation module. `analyzeSuggestionImpact()`, `analyzeAllSuggestions()`. Synchronous, no I/O. Takes `OptimizationSuggestion` + `OptimizationEngineInput`, returns `ImpactAnalysis`.

### Files to Modify

#### `packages/web/src/lib/optimization-types.ts` (MODIFY)
- Add `MetricsSnapshot` interface
- Add `RiskChange` interface (NOTE: different from existing `RankChange`)
- Add `ImpactAnalysis` interface
- Add `SuggestionImpactDetail` interface
- Add `VELOCITY_UTILIZATION_RATIO` constant (e.g., 0.8 — utilization maps to velocity at 80% efficiency)

#### `packages/web/src/components/OptimizationPanel.tsx` (MODIFY)
- Add `ImpactDetail` inline sub-component
- Add `BeforeAfterComparison` inline sub-component
- Update `SuggestionCard` with expandable impact section and "Compare Impact" button
- Add `fetchImpact()` callback
- Add state for impact results

#### `packages/web/src/app/api/risk/optimization/route.ts` (MODIFY)
- Add `impact` query param handling in GET handler
- Add optional `suggestionId` query param for single-suggestion impact
- Import and call `analyzeSuggestionImpact` / `analyzeAllSuggestions`

### Testing Strategy

**Unit tests (optimization-impact.test.ts):**
- Computes correct completion date shift from daysSaved
- Computes correct velocity delta from utilization change
- Computes correct before risk score from input
- Computes correct after risk score from risk reduction
- Clamps risk scores to 0-100
- Builds correct beforeMetrics snapshot
- Builds correct afterMetrics snapshot
- Returns zero delta for zero-impact suggestions
- Handles empty risk factors and bottlenecks
- analyzeAllSuggestions returns details for all suggestions
- analyzeAllSuggestions returns empty array for empty suggestions
- Deterministic: same inputs produce same outputs

**Component tests (OptimizationPanel.test.tsx updates):**
- Impact detail section renders when expanded
- Before/after comparison shows metrics

**API route tests:**
- `?impact=true` returns enhanced suggestions
- `?impact=true&suggestionId=X` returns single suggestion impact

### NFRs
- **NFR-E4-1:** Optimization analysis completes within 15 seconds — impact analysis is O(n) on suggestions, typically < 20 suggestions
- **NFR-P4:** API endpoints respond within 500ms (p95) — same data pipeline as 56-7 with lightweight computation added
- **NFR-S3:** Impact analysis results do not modify actual system state — pure computation
- **NFR-R2:** Results are deterministic for identical inputs

### Pre-existing Types (Use These, Do NOT Modify Unless Adding)
- `OptimizationCategory`, `EstimatedImpact`, `OptimizationSuggestion`, `OptimizationFeedback` — from `optimization-types.ts`
- `OptimizationEngineInput`, `OptimizationEngineResult`, `AgentUtilRaw`, `CapacityRaw` — from `optimization-types.ts`
- `OptimizationObjective`, `ObjectiveScenarioResult`, `ObjectiveComparisonSummary` — from `optimization-types.ts`
- `UnderutilizedAgentData` — from `optimization-types.ts`
- `AgentUtilization`, `CapacityResult` — from `@composio/ao-core`
- `UtilizationSnapshot`, `ProjectUtilizationSummary`, `PortfolioUtilizationOverview` — from `utilization-metrics-types.ts`
- `RiskFactor`, `BottleneckItem` — from respective aggregation modules

### Project Structure Notes
- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/` pattern
- All existing tests must continue to pass (no regressions)
- No new npm dependencies
- Use CSS variables for theming
- `"use client"` directive on components

### References
- [Source: epics-cycle-10.md#Story 56.10] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-E4-3] — "Optimization suggestions include predicted impact metrics"
- [Source: prd-cycle-10.md#FR-E4-4] — "Users can apply optimizations with one click or manually adjust"
- [Source: packages/web/src/lib/optimization-types.ts] — Existing types with `EstimatedImpact`
- [Source: packages/web/src/lib/optimization-engine.ts] — Base engine with 5 analyzers and `computeImpact()`
- [Source: packages/web/src/lib/optimization-scenario.ts] — Objective ranking (may inform impact dimensions)
- [Source: packages/web/src/lib/underutilized-analyzer.ts] — Newest analyzer (pattern reference)
- [Source: packages/web/src/app/api/risk/optimization/route.ts] — Existing API route to extend
- [Source: packages/web/src/components/OptimizationPanel.tsx] — Existing panel with `SuggestionCard` and `ImpactMetrics`
- [Source: _bmad-output/implementation-artifacts/56-9-underutilized-agent-detection.md] — Previous story (done)
- [Source: _bmad-output/implementation-artifacts/56-8-optimization-scenario-runner.md] — Scenario runner story (done)
- [Source: _bmad-output/implementation-artifacts/56-7-optimization-recommendations.md] — Optimization engine story (done)

## Dev Agent Record
### Agent Model Used

### Debug Log References

### Completion Notes List
1. Types added to optimization-types.ts: MetricsSnapshot, RiskChange, ImpactAnalysis, SuggestionImpactDetail, VELOCITY_UTILIZATION_RATIO
2. Pure computation module optimization-impact.ts created with analyzeSuggestionImpact() and analyzeAllSuggestions()
3. Uses calculateRiskScore() from risk-score.ts for consistency with dashboard risk scores
4. API route extended with ?impact=true and ?suggestionId=X params
5. UI: ImpactDetail and BeforeAfterComparison sub-components added to OptimizationPanel
6. 20 new tests across 3 test files, all passing (2466 total)

### File List
- `packages/web/src/lib/optimization-types.ts` (MODIFIED) — Added MetricsSnapshot, RiskChange, ImpactAnalysis, SuggestionImpactDetail types and VELOCITY_UTILIZATION_RATIO constant
- `packages/web/src/lib/optimization-impact.ts` (NEW) — Pure computation module with analyzeSuggestionImpact() and analyzeAllSuggestions()
- `packages/web/src/app/api/risk/optimization/route.ts` (MODIFIED) — Added ?impact=true and ?suggestionId=X query param support
- `packages/web/src/components/OptimizationPanel.tsx` (MODIFIED) — Added ImpactDetail, BeforeAfterComparison sub-components, "Compare Impact" toggle, fetchImpact callback
- `packages/web/src/lib/__tests__/optimization-impact.test.ts` (NEW) — 15 unit tests for impact computation
- `packages/web/src/components/__tests__/OptimizationPanel.test.tsx` (MODIFIED) — 2 tests for impact detail rendering
- `packages/web/src/app/api/risk/optimization/route.test.ts` (NEW) — 3 API route tests for impact mode
