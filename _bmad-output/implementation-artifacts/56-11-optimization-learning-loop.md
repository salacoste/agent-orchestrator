# Story 56.11: Optimization Learning Loop

Status: done

## Story

As a **project manager**,
I want **the system to learn from which optimizations I accept or reject**,
so that **future suggestions become more relevant to my preferences**.

## Acceptance Criteria

1. **Given** I have accepted or rejected optimization suggestions
   **When** new suggestions are generated
   **Then** the system weights suggestions based on past acceptance patterns
   **And** suggestions similar to previously accepted ones are ranked higher

2. **Given** the feedback store has historical accept/dismiss data
   **When** the optimization engine generates suggestions
   **Then** categories with higher acceptance rates receive a ranking boost
   **And** categories with higher dismissal rates receive a ranking penalty
   **And** the boost/penalty is proportional to the acceptance/dismissal rate

3. **Given** I want to start fresh with optimization suggestions
   **When** I click "Reset Learning" in the optimization panel
   **Then** the system clears all accumulated feedback
   **And** subsequent suggestions are ranked without learning adjustments

4. **Given** the learning loop adjusts suggestion rankings
   **When** the computation executes
   **Then** it completes within the existing 15-second NFR budget
   **And** results are deterministic for identical inputs and feedback state

## Tasks / Subtasks

- [x] Task 1: Define learning loop types (AC: #1, #2)
  - [x] 1.1: Add `CategoryAcceptanceRate` interface to `optimization-types.ts` — `{ category, acceptedCount, dismissedCount, total, rate }`
  - [x] 1.2: Add `LearningWeights` interface — `{ categoryBoosts: Map<OptimizationCategory, number>, generatedAt: number }`
  - [x] 1.3: Add `LEARNING_BOOST_MAX` constant (e.g., 1.5 — max 50% boost for a category)
  - [x] 1.4: Add `LEARNING_PENALTY_MAX` constant (e.g., 0.5 — max 50% penalty for a category)
  - [x] 1.5: Add `LEARNING_MIN_SAMPLES` constant (e.g., 3 — minimum feedback entries before learning kicks in)

- [x] Task 2: Create learning computation module (AC: #1, #2, #4)
  - [x] 2.1: Create `packages/web/src/lib/optimization-learning.ts` — pure computation module
  - [x] 2.2: Implement `computeCategoryAcceptanceRates(feedback): CategoryAcceptanceRate[]` — aggregate feedback per category
  - [x] 2.3: Implement `computeLearningWeights(feedback): LearningWeights` — derive boost/penalty multipliers from acceptance rates
  - [x] 2.4: Implement `applyLearningWeights(suggestions, weights): OptimizationSuggestion[]` — adjust priority scores using learning weights
  - [x] 2.5: Clamp boost to `[LEARNING_PENALTY_MAX, LEARNING_BOOST_MAX]` range
  - [x] 2.6: Skip learning adjustment for categories with fewer than `LEARNING_MIN_SAMPLES` feedback entries
  - [x] 2.7: All functions are pure — they take feedback as input, no global state reads

- [x] Task 3: Integrate learning into the optimization pipeline (AC: #1, #2)
  - [x] 3.1: Update `packages/web/src/lib/optimization-engine.ts` — add optional `LearningWeights` parameter to `generateOptimizations()` and `rankSuggestions()`
  - [x] 3.2: When weights provided, multiply priority by category weight after base ranking
  - [x] 3.3: Update `rankSuggestions()` to accept optional `LearningWeights` parameter — when provided, multiply priority by category weight

- [x] Task 4: Update API route to pass feedback into engine (AC: #1, #2)
  - [x] 4.1: Update `packages/web/src/app/api/risk/optimization/route.ts` GET handler
  - [x] 4.2: Import `getOptimizationFeedback`, `computeLearningWeights`, `_resetOptimizationFeedback`
  - [x] 4.3: Before calling engine, retrieve feedback and compute learning weights
  - [x] 4.4: Pass learning weights into all engine calls
  - [x] 4.5: Same for `runObjectiveScenario()` and `runAllObjectives()` paths

- [x] Task 5: Add reset endpoint and UI control (AC: #3)
  - [x] 5.1: Add DELETE handler to `/api/risk/optimization/route.ts` — calls `_resetOptimizationFeedback()`
  - [x] 5.2: Add "Reset Learning" button to `OptimizationPanel.tsx` — calls DELETE endpoint
  - [x] 5.3: Add confirmation prompt before reset (window.confirm)
  - [x] 5.4: After reset, re-fetch baseline suggestions to reflect unlearned rankings

- [x] Task 6: Add tests (AC: all)
  - [x] 6.1: Create `packages/web/src/lib/__tests__/optimization-learning.test.ts` — 22 unit tests for learning computation
  - [x] 6.2: Update `packages/web/src/components/__tests__/OptimizationPanel.test.tsx` — 2 tests for "Reset Learning" button
  - [x] 6.3: Update API route test — 2 tests for DELETE endpoint and learning-adjusted rankings

- [x] Task 7: Update sprint-status.yaml
  - [x] 7.1: Run full test suite — all 2492 tests passing (0 regressions)
  - [x] 7.2: Update `56-11-optimization-learning-loop` status to review

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
1. **Cross-session feedback persistence**
   - Status: Deferred — Feedback is currently in-memory only (globalThis singleton)
   - Requires: JSONL file persistence for feedback entries (similar to learning-kb pattern)
   - Epic: Future enhancement
   - Current: Feedback accumulates within a single server process lifetime
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
- `getOptimizationFeedback(suggestionId?)` from `@/lib/optimization-feedback.js` — EXISTING (56-7): returns `OptimizationFeedback[]`
- `recordOptimizationFeedback(feedback)` from `@/lib/optimization-feedback.js` — EXISTING (56-7): records accept/dismiss action
- `getDismissalRate(category)` from `@/lib/optimization-feedback.js` — EXISTING (56-7): returns 0-1 dismissal rate
- `_resetOptimizationFeedback()` from `@/lib/optimization-feedback.js` — EXISTING (56-7): clears all feedback (test-only, repurposed for reset endpoint)
- `generateOptimizations(input)` from `@/lib/optimization-engine.js` — EXISTING (56-7): returns `OptimizationEngineResult`
- `rankSuggestions(suggestions)` from `@/lib/optimization-engine.js` — EXISTING (56-7): ranks by priority score
- `runObjectiveScenario(input, objective)` from `@/lib/optimization-scenario.js` — EXISTING (56-8): returns `ObjectiveScenarioResult`
- `runAllObjectives(input)` from `@/lib/optimization-scenario.js` — EXISTING (56-8): returns all objective results
- `getServices()` from `@/lib/services` — EXISTING: returns `{ config, registry, sessionManager }`

**Feature Flags:**
- None required — all data sources and feedback mechanisms already exist in the codebase

## Dependency Review

No new external dependencies required. This story uses the existing feedback store from Story 56-7 and the optimization engine pipeline.

## Dev Notes

### Architecture Context

This is **Story 11 of 11** in **Epic 56: Risk & Optimization Dashboard**. It is the final story in the Optimization phase (Phase 2 of Epic 56).

**Dependency chain:** Epic 49 (done) → Epic 54 (done) → **Epic 56 (this epic)** → Epic 57 (backlog)

**Stories 56-1 through 56-10 (ALL DONE) context:**
- 56-1 created `risk-aggregation.ts` with `aggregateRiskFactors()` — produces `RiskFactor[]` with severity scores
- 56-2 created `bottleneck-aggregation.ts` with `aggregateBottlenecks()` — produces `BottleneckItem[]` with impact scores
- 56-3 created `risk-score.ts` with `calculateRiskScore()` + `calculatePortfolioScore()` — composite scoring (NORMALIZATION_CONSTANT = 150)
- 56-4 created `emerging-risk-detection.ts` with `detectEmergingRisks()` — 5 pattern detectors
- 56-5 created risk alert types, evaluation, broadcaster, SSE integration, API endpoints, and banner component
- 56-6 created utilization metrics pipeline: types, snapshot collection, history store, API route, panel component
- 56-7 created optimization engine: types, engine, feedback store, API route, panel component
- 56-8 created optimization scenario engine: objective ranking, multi-objective comparison, API + UI extensions
- 56-9 created underutilized agent analyzer: detection, reallocation suggestions, category integration
- 56-10 created impact analysis: before/after metrics, completion date shift, velocity delta, risk change

### What Already Exists (Do NOT Reinvent)

#### Feedback Store (Story 56-7) — PRIMARY DATA SOURCE
- `optimization-feedback.ts` — globalThis singleton with:
  - `recordOptimizationFeedback(feedback)` — records accept/dismiss actions, caps at `MAX_FEEDBACK_ENTRIES` (1000)
  - `getOptimizationFeedback(suggestionId?)` — retrieves feedback entries, optionally filtered by suggestion ID
  - `getDismissalRate(category)` — returns 0-1 dismissal rate for a category
  - `_resetOptimizationFeedback()` — clears all feedback (currently test-only)
- `OptimizationFeedback` type — `{ suggestionId, category, action, timestamp, reason? }`

#### Optimization Engine (Stories 56-7, 56-8, 56-9, 56-10) — MODIFY TARGET
- `optimization-engine.ts` — `generateOptimizations(input)` runs 5 analyzers, then `rankSuggestions()`:
  ```typescript
  export function rankSuggestions(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
    return suggestions
      .map((s) => ({
        ...s,
        priority:
          s.impact.daysSaved * RANK_WEIGHT_DAYS_SAVED +
          s.impact.riskReductionPercent * RANK_WEIGHT_RISK_REDUCTION +
          Math.abs(s.impact.utilizationDeltaPercent) * RANK_WEIGHT_UTILIZATION_DELTA +
          s.confidence * 0.1,
      }))
      .sort((a, b) => b.priority - a.priority);
  }
  ```
- `optimization-scenario.ts` — `runObjectiveScenario()`, `runAllObjectives()` both call `generateOptimizations()` internally
- `optimization-impact.ts` — `analyzeSuggestionImpact()`, `analyzeAllSuggestions()`

#### API Route (Stories 56-7, 56-8, 56-10)
- `/api/risk/optimization` route — GET (suggestions, objective scenarios, comparison, impact analysis) + PATCH (accept/dismiss)
- GET handler: builds `engineInput`, calls `generateOptimizations()`, optionally applies category filter, objective, impact
- PATCH handler: validates body, calls `recordOptimizationFeedback()`

#### Panel Component (Stories 56-7, 56-8, 56-10)
- `OptimizationPanel.tsx` — dashboard panel with category filter chips, `SuggestionCard`, `ImpactMetrics`, `ObjectiveComparisonPanel`, `ImpactDetail`, `BeforeAfterComparison`

### What This Story Actually Does

1. **New types**: Add `CategoryAcceptanceRate`, `LearningWeights`, and learning constants to `optimization-types.ts`.

2. **New computation module**: Create `optimization-learning.ts` — pure computation module with:
   - `computeCategoryAcceptanceRates(feedback)` — aggregate feedback per category
   - `computeLearningWeights(feedback)` — derive boost/penalty multipliers
   - `applyLearningWeights(suggestions, weights)` — adjust priority scores

3. **Engine integration**: Update `rankSuggestions()` in `optimization-engine.ts` to accept optional `LearningWeights` and multiply priority by category weight. Update `generateOptimizations()` to accept optional feedback parameter.

4. **API integration**: Update GET handler to retrieve feedback, compute learning weights, and pass them into the engine. Same for objective and comparison paths.

5. **Reset endpoint**: Add DELETE handler to the existing route that clears the feedback store.

6. **UI reset control**: Add "Reset Learning" button to `OptimizationPanel.tsx` with confirmation prompt.

### Critical Design Decisions

1. **EXTEND ranking, NOT replace** — The existing `rankSuggestions()` computes a base priority score. Learning weights multiply this score per category. Do NOT change the base ranking formula.

2. **Pure computation** — Same as all other modules. `computeLearningWeights()` takes `OptimizationFeedback[]` as input, returns `LearningWeights`. No global state reads inside the module.

3. **Minimum sample threshold** — Learning only kicks in when a category has >= `LEARNING_MIN_SAMPLES` feedback entries. This prevents a single dismiss from tanking a category.

4. **Weight clamping** — Boost is clamped to `[LEARNING_PENALTY_MAX, LEARNING_BOOST_MAX]` (e.g., [0.5, 1.5]). This prevents extreme ranking distortion.

5. **Feedback retrieval in API, not engine** — The API route retrieves feedback from the store and passes it to the engine. The engine itself remains pure (no global state access).

6. **Reset repurposes existing `_resetOptimizationFeedback()`** — The test-only reset function becomes the backend for the DELETE endpoint. No new reset mechanism needed.

7. **`runObjectiveScenario` and `runAllObjectives` also get learning** — Since they call `generateOptimizations()` internally, the learning weights propagate through. Update `generateOptimizations()` signature to accept optional `LearningWeights`.

### Learning Algorithm

```
computeLearningWeights(feedback):
  1. Compute acceptance rates per category:
     - For each category, count accepted and dismissed entries
     - rate = acceptedCount / totalCount (0-1)
  2. Derive multiplier per category:
     - If total < LEARNING_MIN_SAMPLES: multiplier = 1.0 (no adjustment)
     - Otherwise: multiplier = clamp(rate * LEARNING_BOOST_MAX, LEARNING_PENALTY_MAX, LEARNING_BOOST_MAX)
       - rate = 1.0 → multiplier = LEARNING_BOOST_MAX (1.5)
       - rate = 0.5 → multiplier = 1.0 (neutral)
       - rate = 0.0 → multiplier = LEARNING_PENALTY_MAX (0.5)
  3. Return LearningWeights { categoryBoosts: Map<category, multiplier>, generatedAt: Date.now() }

applyLearningWeights(suggestions, weights):
  For each suggestion:
    - Get multiplier = weights.categoryBoosts.get(suggestion.category) ?? 1.0
    - newPriority = suggestion.priority * multiplier
    - Return suggestion with updated priority
  Sort by newPriority descending
```

### Data Flow

```
GET /api/risk/optimization:
  1. (existing pipeline) → engineInput
  2. feedback = getOptimizationFeedback()         ← NEW
  3. learningWeights = computeLearningWeights(feedback)  ← NEW
  4. result = generateOptimizations(engineInput, learningWeights)  ← MODIFIED (optional 2nd param)
  5. (existing: category filter, impact analysis)
  6. return result

DELETE /api/risk/optimization:
  1. _resetOptimizationFeedback()                 ← NEW
  2. return { success: true }
```

### Integration with Stories 56-1 through 56-10 (MUST Follow)

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

#### `packages/web/src/lib/optimization-learning.ts` (NEW)
Pure computation module. `computeCategoryAcceptanceRates()`, `computeLearningWeights()`, `applyLearningWeights()`. Synchronous, no I/O. Takes `OptimizationFeedback[]`, returns `LearningWeights`.

### Files to Modify

#### `packages/web/src/lib/optimization-types.ts` (MODIFY)
- Add `CategoryAcceptanceRate` interface
- Add `LearningWeights` interface
- Add `LEARNING_BOOST_MAX`, `LEARNING_PENALTY_MAX`, `LEARNING_MIN_SAMPLES` constants

#### `packages/web/src/lib/optimization-engine.ts` (MODIFY)
- Update `rankSuggestions()` to accept optional `LearningWeights` parameter
- Update `generateOptimizations()` to accept optional `LearningWeights` parameter
- When weights provided, multiply priority by category weight after base ranking

#### `packages/web/src/app/api/risk/optimization/route.ts` (MODIFY)
- Import `getOptimizationFeedback`, `computeLearningWeights`
- In GET handler: retrieve feedback, compute weights, pass to engine calls
- Add DELETE handler for reset

#### `packages/web/src/components/OptimizationPanel.tsx` (MODIFY)
- Add "Reset Learning" button with confirmation prompt
- Add `resetLearning()` callback that calls DELETE endpoint
- After reset, re-fetch baseline suggestions

### Testing Strategy

**Unit tests (optimization-learning.test.ts):**
- Computes correct acceptance rates per category
- Returns neutral weights for empty feedback
- Returns neutral weights for categories below min sample threshold
- Boosts categories with high acceptance rate
- Penalizes categories with high dismissal rate
- Clamps weights to [PENALTY_MAX, BOOST_MAX] range
- Handles mixed feedback across multiple categories
- applyLearningWeights adjusts priorities correctly
- applyLearningWeights with no weights returns unchanged priorities
- Deterministic: same inputs produce same outputs

**Component tests (OptimizationPanel.test.tsx updates):**
- "Reset Learning" button renders
- Reset Learning calls DELETE endpoint and re-fetches

**API route tests:**
- DELETE returns success and clears feedback
- GET with feedback history adjusts suggestion rankings

### NFRs
- **NFR-E4-1:** Optimization analysis completes within 15 seconds — learning computation is O(n) on feedback entries (max 1000) + O(m) on suggestions (typically < 20)
- **NFR-P4:** API endpoints respond within 500ms (p95) — same data pipeline with lightweight learning added
- **NFR-S3:** Learning weights do not modify actual system state — pure computation
- **NFR-R2:** Results are deterministic for identical inputs and feedback state

### Pre-existing Types (Use These, Do NOT Modify Unless Adding)
- `OptimizationCategory`, `EstimatedImpact`, `OptimizationSuggestion`, `OptimizationFeedback` — from `optimization-types.ts`
- `OptimizationEngineInput`, `OptimizationEngineResult`, `AgentUtilRaw`, `CapacityRaw` — from `optimization-types.ts`
- `ImpactAnalysis`, `MetricsSnapshot`, `RiskChange`, `SuggestionImpactDetail` — from `optimization-types.ts` (56-10)
- `OptimizationObjective`, `ObjectiveScenarioResult`, `ObjectiveComparisonSummary` — from `optimization-types.ts`
- `UnderutilizedAgentData` — from `optimization-types.ts`
- `VELOCITY_UTILIZATION_RATIO`, `RANK_WEIGHT_*`, `MAX_FEEDBACK_ENTRIES` — from `optimization-types.ts`

### Project Structure Notes
- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/` pattern
- All existing tests must continue to pass (no regressions)
- No new npm dependencies
- Use CSS variables for theming
- `"use client"` directive on components

### References
- [Source: epics-cycle-10.md#Story 56.11] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-E4-1] — "The system provides recommendations for optimal agent allocation"
- [Source: prd-cycle-10.md#FR-E4-5] — "Optimization recommendations include estimated impact analysis"
- [Source: packages/web/src/lib/optimization-feedback.ts] — Existing feedback store with accept/dismiss tracking
- [Source: packages/web/src/lib/optimization-engine.ts] — Base engine with ranking formula
- [Source: packages/web/src/lib/optimization-types.ts] — All existing types and constants
- [Source: packages/web/src/app/api/risk/optimization/route.ts] — Existing API route to extend
- [Source: packages/web/src/components/OptimizationPanel.tsx] — Existing panel to add reset button
- [Source: _bmad-output/implementation-artifacts/56-10-optimization-impact-analysis.md] — Previous story (done)

## Dev Agent Record
### Agent Model Used
Claude Opus 4.6

### Debug Log References

### Completion Notes List
1. Types added to optimization-types.ts: CategoryAcceptanceRate, LearningWeights, LEARNING_BOOST_MAX (1.5), LEARNING_PENALTY_MAX (0.5), LEARNING_MIN_SAMPLES (3)
2. Pure computation module optimization-learning.ts created with computeCategoryAcceptanceRates(), computeLearningWeights(), applyLearningWeights()
3. Optimization engine updated: generateOptimizations() and rankSuggestions() accept optional LearningWeights parameter
4. Optimization scenario updated: runObjectiveScenario() and runAllObjectives() pass learning weights through
5. API route: GET retrieves feedback + computes learning weights for all paths (baseline, objective, compare); DELETE clears feedback
6. UI: "Reset Learning" button with window.confirm, re-fetches baseline after reset
7. 26 new tests across 3 test files, all passing (2492 total)

### Code Review Fixes (Adversarial Review)
8. **SEV-2 fixed**: `applyObjectiveRanking()` was recomputing priorities from scratch, discarding learning weights. Now `applyLearningWeights()` is applied after `applyObjectiveRanking()` in both `runObjectiveScenario()` and `runAllObjectives()`.
9. **SEV-3a fixed**: `applyLearningWeights()` was exported but unused — now imported and used by `optimization-scenario.ts`.
10. **SEV-3b fixed**: Added test verifying suggestion ordering actually changes with learning feedback vs baseline (route.test.ts).
11. **SEV-4 fixed**: Replaced `void projects` with underscore destructuring `projects: _projects` in OptimizationPanel.
12. Post-fix test count: 2493 (1 new ordering-change test), 0 regressions
13. **Second review fix**: Updated _resetOptimizationFeedback JSDoc from "Test-only" to reflect production DELETE endpoint usage
14. **Second review fix**: Added 2 scenario-level tests for learning weights integration with objective ranking
15. **Second review fix**: Updated story File List to include optimization-scenario.ts and optimization-feedback.ts review changes

### Limitations (Deferred Items)
1. **Cross-session feedback persistence**
   - Status: Deferred — Feedback is currently in-memory only (globalThis singleton)
   - Requires: JSONL file persistence for feedback entries (similar to learning-kb pattern)
   - Epic: Future enhancement
   - Current: Feedback accumulates within a single server process lifetime

### File List
- `packages/web/src/lib/optimization-types.ts` (MODIFIED) — Added CategoryAcceptanceRate, LearningWeights interfaces and LEARNING_BOOST_MAX, LEARNING_PENALTY_MAX, LEARNING_MIN_SAMPLES constants
- `packages/web/src/lib/optimization-learning.ts` (NEW) — Pure computation module with computeCategoryAcceptanceRates(), computeLearningWeights(), applyLearningWeights()
- `packages/web/src/lib/optimization-engine.ts` (MODIFIED) — Added LearningWeights param to generateOptimizations() and rankSuggestions()
- `packages/web/src/lib/optimization-scenario.ts` (MODIFIED) — Added LearningWeights param to runObjectiveScenario() and runAllObjectives(); applyLearningWeights() applied after objective ranking (review fix)
- `packages/web/src/lib/optimization-feedback.ts` (MODIFIED) — Updated JSDoc comment on _resetOptimizationFeedback to reflect production use via DELETE endpoint
- `packages/web/src/app/api/risk/optimization/route.ts` (MODIFIED) — Learning weights integration in GET, added DELETE handler for reset
- `packages/web/src/components/OptimizationPanel.tsx` (MODIFIED) — Added resetLearning callback and "Reset Learning" button
- `packages/web/src/lib/__tests__/optimization-learning.test.ts` (NEW) — 22 unit tests for learning computation
- `packages/web/src/lib/__tests__/optimization-scenario.test.ts` (MODIFIED) — 2 tests for learning weights integration with objective ranking (review fix)
- `packages/web/src/components/__tests__/OptimizationPanel.test.tsx` (MODIFIED) — 2 tests for Reset Learning button
- `packages/web/src/app/api/risk/optimization/route.test.ts` (MODIFIED) — 2 tests for DELETE endpoint and learning-adjusted rankings
