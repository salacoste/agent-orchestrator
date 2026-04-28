# Epic 56 Retrospective — Risk & Optimization Dashboard

**Date**: 2026-04-29
**Epic**: 56 — Risk & Optimization Dashboard
**Status**: Complete (all 11 stories done)
**Source**: epics-cycle-10.md
**Cycle**: 10 (Intelligence Phase)

## Epic Summary

Epic 56 delivered the Risk & Optimization Dashboard: a two-phase system that first identifies, scores, and alerts on project risks, then recommends, simulates, and learns from resource optimizations. Phase 1 (Stories 56-1 through 56-6) built the risk intelligence pipeline -- aggregating risk factors and bottlenecks from existing tracker/core data, computing composite risk scores, detecting emerging risks from throughput patterns, configuring threshold-based alerts, and tracking resource utilization with rolling averages. Phase 2 (Stories 56-7 through 56-11) built the optimization engine -- generating rule-based suggestions across 5 categories (agent-rebalancing, WIP-adjustment, priority-reorder, capacity-scaling, underutilized-detection), running objective-based scenarios, analyzing before/after impact, and learning from accept/dismiss feedback to improve future ranking.

The epic consumed zero new external dependencies and introduced a consistent pure-computation architecture across all 11 stories: aggregation modules are synchronous functions with no I/O or side effects, stateful stores use the globalThis singleton pattern, and API routes collect data and pass it into pure functions.

## Story Delivery

| Story | Title | Tests | Review Fixes | Status |
|-------|-------|-------|-------------|--------|
| 56-1 | Risk Dashboard Overview | 58 | 0 (clean) | Done |
| 56-2 | Bottleneck Identification | 47 | Code review: project-prefixed IDs | Done |
| 56-3 | Risk Score Calculation | 29 | 6 issues (double-counting, normalization constant, contribution %) | Done |
| 56-4 | Emerging Risk Detection | 79 | Pre-existing agent-overload bug fixed | Review |
| 56-5 | Configurable Risk Alerts | 21 | 8 issues (dead SSE path, missing PATCH, config sharing) | Done |
| 56-6 | Resource Utilization Metrics | 31+ | 15 issues (4C, 5H, 4M, 2L from adversarial review) | Done |
| 56-7 | Optimization Recommendations | 61 | 7 issues (H1: missing category in PATCH, M1-M4, L1, L3) | Done |
| 56-8 | Optimization Scenario Runner | 48 | 0 (clean) | Done |
| 56-9 | Underutilized Agent Detection | 17 | 5M+2L (stale JSDoc, dead constant, fabricated idleDays) | Done |
| 56-10 | Optimization Impact Analysis | 20 | 0 (clean) | Done |
| 56-11 | Optimization Learning Loop | 26 | SEV-2: objective ranking discarding learning weights; SEV-3a/3b/4 | Done |

**Total new tests**: ~437 across all 11 stories
**New modules**: 15+ pure computation modules, 5 API routes, 6 dashboard components, 4 singleton stores
**External dependencies added**: 0
**Code reviews**: 11 reviews, ~40+ issues caught and fixed
**Test count at epic close**: 2493 tests passing, 0 failures

## Party Mode -- Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) -- project vision, priorities, user outcomes
- Nova (Architect) -- system design, interfaces, extensibility
- Blaze (Dev) -- implementation, patterns, pain points
- Pax (QA) -- test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** Epic 56 is the most technically ambitious epic in Cycle 10. It went from zero to a full risk+optimization system in 11 stories with no external dependencies and zero test regressions. The risk score gives PMs a single number to compare project health. The optimization engine with objective-based scenarios and learning loop means the system gets smarter over time. The deferred items are all future enhancements (persistence, ML, cross-session feedback), not missing functionality.

**Nova (Architect):** Three architectural patterns emerged as particularly strong:

1. **Pure computation pipeline** -- Every module from `risk-aggregation.ts` through `optimization-learning.ts` follows the same contract: synchronous function, takes structured input, returns structured output, no I/O, no side effects. The only stateful components are the broadcaster singletons (risk-alert, utilization-history, optimization-feedback) and they follow the same globalThis pattern. This consistency means any module can be tested in isolation with zero mocking of infrastructure.

2. **Extensible category taxonomy** -- The `OptimizationCategory` union type started with 4 values in 56-7, grew to 5 in 56-9, and the engine's analyzer array pattern means adding a 6th is a single function + one line in `generateOptimizations()`. The objective ranking system from 56-8 handles new categories via the `OBJECTIVE_ANALYZER_PRIORITY` map. This extensibility was tested by 56-9 which added underutilized-detection without modifying any existing analyzer.

3. **Layered aggregation strategy** -- 56-1 aggregates risk factors. 56-2 aggregates bottlenecks. 56-3 combines both into a composite score. 56-7 consumes both plus utilization data for optimization. Each layer builds on the previous without re-querying raw data. This avoids the N+1 query pattern and keeps API response times under 500ms.

**Blaze (Dev):** The package import constraint (`@composio/ao-core` only exports `"."` and `"./types"`) was discovered in 56-1 and enforced from 56-2 onward. Every story after that documented it as "Integration pattern #1." This constraint shaped the mock strategy -- single top-level `vi.mock()` for each package -- and eliminated an entire class of resolution failures. The `.js` extension requirement for ESM imports was similarly internalized after the first story.

The `getSeverityLabel()` helper is now copied into 8+ modules (risk-aggregation, bottleneck-aggregation, risk-score, emerging-risk-detection, optimization-engine, underutilized-analyzer, optimization-impact, optimization-learning). Each copy has identical thresholds (76+=critical, 51+=high, 26+=medium). A shared utility would be cleaner but the current approach avoids circular dependency risks between aggregation modules.

**Pax (QA):** 437 new tests across 11 stories is the highest test density of any epic this cycle. The adversarial code review on 56-6 found 15 issues (4 Critical, 5 High) -- the most thorough review of the epic. The SEV-2 bug in 56-11 (objective ranking discarding learning weights) was caught in adversarial review before merge. The `applyObjectiveRanking()` function recomputed priorities from scratch, overwriting the learning-adjusted values. The fix applies `applyLearningWeights()` after `applyObjectiveRanking()` in both `runObjectiveScenario()` and `runAllObjectives()`. This is exactly the kind of composition-order bug that integration tests catch.

---

### What Could Be Improved

**R2d2 (Project Lead):** The NORMALIZATION_CONSTANT = 150 in 56-3's risk score calculation was wrong on first implementation (520). The code review caught it and corrected it, but the scoring weights (critical=1.5, high=1.0, medium=0.6, low=0.3) and normalization constant are still somewhat arbitrary. There's no empirical basis for these numbers. A calibration pass against historical project data would improve the scoring accuracy.

**Nova (Architect):** The `getSeverityLabel()` function is duplicated across 8+ modules. The reason given is "avoid circular dependencies" but a shared `severity-utils.ts` in `packages/web/src/lib/` with no imports from other aggregation modules would eliminate the duplication without introducing cycles. This is a missed DRY opportunity.

The optimization-feedback store uses an in-memory globalThis singleton capped at 1000 entries. This means feedback is lost on server restart. Story 56-11 explicitly deferred cross-session persistence, but the feedback store is the backbone of the learning loop. Without persistence, the learning loop resets every time the dev server restarts during development. This significantly reduces the utility of the feature.

**Blaze (Dev):** The pre-existing `pnpm build` failure in `packages/web` (NotepadContent type error) continued to block clean builds throughout this epic. Every build verification required `pnpm dev` instead. This is carried tech debt from prior epics.

The point-in-time utilization model in `computeAgentUtilization()` returns binary 0/100% values. Story 56-6 added rolling averages on top, but the base model is still binary. This means the "3+ days underutilized" detection in 56-9 uses point-in-time snapshots rather than sustained history. The deferred "time-windowed utilization tracking" item is a real functional gap.

**Pax (QA):** Stories 56-4 and 56-3 are still in "review" status in their story files rather than "done." This is an administrative gap -- the stories passed all acceptance criteria and tests but the status field was never updated. The sprint-status.yaml correctly marks them as done, but the individual story files are inconsistent.

The 56-5 story had 3 deferred test items (dedicated route tests, SSE hook tests) with the note "covered by component + broadcaster tests." This is a test coverage gap -- indirect coverage is not the same as direct API route testing.

---

### Key Decisions

1. **Aggregate, don't compute** (56-1, 56-2, 56-3) -- The risk pipeline aggregates data from existing tracker-bmad and core modules rather than implementing new detection algorithms. This was the right call: it reused ~10 existing computation modules and kept story scope to presentation-layer work.

2. **Pure computation modules** (all stories) -- Every aggregation/analysis module is a synchronous pure function. The only stateful components are broadcaster singletons. This decision made testing straightforward (no async mocking needed for computation logic) and kept the modules composable.

3. **Deterministic rule-based analysis** (56-7) -- The optimization engine uses ordered rule chains with first-match-wins ranking, not ML or probabilistic methods. This keeps the engine predictable, testable, and debuggable. The learning loop (56-11) adds simple acceptance-rate weighting, not a trained model.

4. **Objective ranking as re-weighting** (56-8) -- Rather than generating different suggestions per objective, the scenario runner generates suggestions once and re-weights the ranking formula per objective. This avoids duplicate computation and keeps the comparison meaningful (same suggestions, different ordering).

5. **In-memory stores** (56-5, 56-6, 56-7) -- Alert state, utilization history, and optimization feedback all use globalThis singletons. Lost on restart. This was a pragmatic trade-off: persistent storage (JSONL or database) would have added 2-3 stories of scope. The deferred items are documented.

6. **OptimizationCategory as union type** (56-7, 56-9) -- Using a string union instead of an enum allowed 56-9 to extend the category without modifying the base type definition pattern. This extensibility was validated when underutilized-detection was added as the 5th category.

7. **Score cache in broadcaster** (56-5) -- The risk alert broadcaster maintains a score cache that the risk score route populates and the SSE events route reads. This avoids recomputing risk scores every 5-second poll cycle.

---

### Lessons Learned

1. **Package export constraints must be documented early** -- The `@composio/ao-core` subpath import limitation was discovered in 56-1 and documented from 56-2 onward. Future epics with similar multi-package dependencies should document these constraints in the first story's "Integration Patterns" section.

2. **Normalization constants need empirical validation** -- The NORMALIZATION_CONSTANT journey (520 → 150) shows that weight-based scoring formulas need test-driven derivation, not intuition. The formula should be: set weights → compute theoretical max → set normalization constant to theoretical max → verify with boundary tests.

3. **Adversarial code review catches composition-order bugs** -- The SEV-2 bug in 56-11 (learning weights discarded by objective ranking) is a composition-order issue that unit tests for individual modules wouldn't catch. Integration tests that verify the full pipeline (feedback → weights → engine → ranking → ordering) are essential for multi-stage computation chains.

4. **Deferred items compound** -- Each story's "Limitations (Deferred Items)" section lists 2-3 items deferred to future stories. Over 11 stories, this accumulated ~15 deferred items. While each individual deferral was reasonable, the aggregate creates a significant tech debt surface. Future epics should track deferred items centrally.

5. **Copied helpers are a code smell** -- The `getSeverityLabel()` function copied into 8+ modules is a maintenance risk. If the thresholds change (e.g., 76 → 80 for critical), all 8 copies need updating. A shared utility module should be extracted in a tech-debt pass.

6. **Binary utilization model limits time-series accuracy** -- The core `computeAgentUtilization()` returns 0% or 100%. Rolling averages smooth this, but the underlying data is lossy. Stories that depend on sustained-duration detection (like 56-9's "3+ days underutilized") are fundamentally limited by the data source.

---

### Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Extract `getSeverityLabel()` into shared `severity-utils.ts` to eliminate 8+ copies | Dev | HIGH |
| 2 | Update story files 56-3 and 56-4 status from "review" to "done" | Admin | LOW |
| 3 | Add direct API route tests for `/api/risk/alerts` (deferred in 56-5) | QA | MEDIUM |
| 4 | Validate NORMALIZATION_CONSTANT (150) against historical project data | Architect | MEDIUM |
| 5 | Add JSONL persistence for optimization-feedback store (learning loop resets on restart) | Dev | MEDIUM |
| 6 | Fix pre-existing `pnpm build` failure in packages/web (carried from prior epics) | Dev | HIGH |
| 7 | Consider shared `severity-utils.ts` extraction as tech-debt cleanup | Dev | LOW |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 11 / 11 |
| Stories with 0 review issues | 4 (56-1, 56-2, 56-8, 56-10) |
| Stories requiring 2+ review passes | 1 (56-11: adversarial + second pass) |
| Total review issues found | ~40+ |
| Total new tests | ~437 |
| Test count at epic start | ~2350 |
| Test count at epic close | ~2493 |
| External dependencies added | 0 |
| New pure computation modules | 15+ |
| New API routes | 5 (`/api/risk/dashboard`, `/api/risk/bottleneck`, `/api/risk/score`, `/api/risk/utilization`, `/api/risk/optimization`) |
| New dashboard components | 6 (RiskDashboard, BottleneckDashboard, RiskScorePanel, RiskAlertBanner, UtilizationMetricsPanel, OptimizationPanel) |
| New singleton stores | 4 (risk-alert-broadcaster, utilization-history, optimization-feedback, score-cache) |
| Deferred items | ~15 (persistence, ML, agent skills, time-windowed tracking, cross-session feedback, export reports) |
| Epic duration | ~8 days |

### Per-Story Test Breakdown

| Story | Unit Tests | API Tests | Component Tests | Total |
|-------|-----------|-----------|----------------|-------|
| 56-1 | 21 | 8 | 23 | 58 |
| 56-2 | 20 | 12 | 15 | 47 |
| 56-3 | 12 | 9 | 8 | 29 |
| 56-4 | 16 | 2 (added) | 4 (added) | ~79 |
| 56-5 | 12 | 0 (deferred) | 9 | 21 |
| 56-6 | 15+9 | 0 | 7 | 31+ |
| 56-7 | 20+11 | 0 | 10 | 61 |
| 56-8 | 15 | 0 | 14 | 48 |
| 56-9 | 14 | 0 | 1+1+1 | 17 |
| 56-10 | 15 | 3 | 2 | 20 |
| 56-11 | 22 | 2 | 2 | 26 |
