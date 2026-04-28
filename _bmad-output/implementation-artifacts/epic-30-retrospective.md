# Epic 30 Retrospective: Compound Learning System

**Date:** 2026-04-29
**Epic:** 30 -- Compound Learning System (4 stories)
**Cycle:** 6 (Accessibility, Learning, Integrations, Psychology, Collaboration v2)
**Status:** COMPLETE

---

## Epic Summary

Epic 30 delivered the Compound Learning System -- the infrastructure that makes every sprint better than the last. The system detects recurring patterns across sprints, categorizes and analyzes agent failures, improves recommendations based on accept/dismiss feedback, and surfaces all insights in a dashboard panel.

The core insight driving this epic: "intelligence is graph traversal." The deterministic engine covers 80%+ of cases with zero AI, using pure-function analysis over accumulated JSONL learning data. The four stories form a clean data pipeline: collect error categories across sprints (30.1), group and analyze failures with actionable guidance (30.2), feed recommendation feedback back into the engine (30.3), and visualize everything in the dashboard (30.4).

**Key implementation files:**
- `packages/web/src/lib/workflow/compound-learning.ts` -- `detectCrossSprintPatterns()`, `analyzeFailures()`
- `packages/web/src/lib/workflow/recommendation-feedback.ts` -- `recordFeedback()`, `isOverDismissed()`
- `packages/web/src/app/api/learning/route.ts` -- GET endpoint wiring compound learning to LearningStore
- `packages/web/src/app/api/workflow/feedback/route.ts` -- JSONL persistence for recommendation feedback
- `packages/web/src/components/LearningInsightsPanel.tsx` -- Dashboard panel
- `packages/core/src/learning-patterns.ts` -- Core pattern detection with suggestAction() heuristics

---

## Story Delivery

| Story | Title | Status | Key Deliverable |
|-------|-------|--------|-----------------|
| 30-1 | Cross-Sprint Pattern Detection | done | `detectCrossSprintPatterns()` -- counts error categories across sprints, surfaces patterns with 3+ occurrences, ranks by frequency and assigns impact level (high >= 10, medium >= 5, low < 5) |
| 30-2 | Failure Analysis Knowledge Base | done | `analyzeFailures()` -- groups failures by category with percentage breakdown, associated files, and actionable guidance strings. Core `learning-patterns.ts` adds `suggestAction()` with regex-based heuristics for network, parse, permission, disk, and exit-code errors |
| 30-3 | Recommendation Improvement from Feedback | done | `recordFeedback()` with JSONL persistence via `/api/workflow/feedback`, `isOverDismissed()` with 3-consecutive-dismiss threshold for deprioritization. Consumes feedback data from Cycle 5 Story 25a.2 |
| 30-4 | Learning Dashboard Panel | done | `LearningInsightsPanel` component with total sessions, success rate (color-coded: green >= 80%, yellow >= 50%, red < 50%), top 3 failure patterns, empty state with graceful fallback. Wired to `/api/learning` route |

---

## Party Mode Discussion

**Participants:** R2d2 (Tech Lead), Nova (AI Specialist), Blaze (Backend Engineer), Pax (QA Lead)

### R2d2 (Tech Lead)

The compound learning pipeline is exactly what the product needs for long-term value. Each sprint generates data, and this system ensures that data compounds. The 3-occurrence threshold in `detectCrossSprintPatterns()` is the right call -- two occurrences could be coincidence, three is a pattern worth surfacing. My concern is whether we have enough real learning data flowing through yet. The Cycle 3 learning store (`packages/core/src/learning-store.ts`) is there, but Story 39.4 (compound learning real data connection) had to wire it all together later. This epic built the analysis engine; the data pipeline caught up in Cycle 8.

### Nova (AI Specialist)

The "deterministic engine covers 80%+ of cases" philosophy is spot-on. We could have gone straight to LLM-based pattern recognition, but pure functions with Map-based counting and regex heuristics in `suggestAction()` solve the real problems: TypeScript type errors recurring, auth module stories taking 2x longer, network timeouts clustering. The `isOverDismissed()` function with its 3-consecutive-dismiss check is a simple but powerful feedback loop -- no ML needed, just "if the user dismissed this three times in a row, stop showing it." That is genuine compound learning in the behavioral sense.

### Blaze (Backend Engineer)

The JSONL persistence choice for feedback data is correct for this project. The `recommendation-feedback.ts` module does dual-write: in-memory for instant reads plus fire-and-forget `fetch("/api/workflow/feedback")` for persistence. The non-blocking persistence is important -- if the JSONL write fails, in-memory tracking continues and nothing breaks. The `/api/learning/route.ts` follows the established "always HTTP 200" pattern (WD-FR31) with a graceful `emptyResponse()` fallback. Two things I would flag: the feedback API does `JSON.parse(line)` in a try/catch per line which handles corruption, and the `mkdir(dir, { recursive: true })` is defensive. Both good patterns.

### Pax (QA Lead)

Test coverage is reasonable for the analysis functions. The `compound-learning.test.ts` covers the key cases: 3+ threshold filtering, empty input, frequency sorting, category grouping, percentage calculation, and guidance generation. The `recommendation-feedback.test.ts` has good edge case coverage: fewer-than-3 entries, 3-consecutive-dismiss detection, interspersed accepts breaking the chain, phase isolation, and reset behavior. However, the `LearningInsightsPanel.test.tsx` is testing the data shape rather than rendering -- it verifies calculations (success percentage, pattern limiting, color thresholds) but does not use React Testing Library to test the actual component output. This follows the lean testing pattern from Cycle 6 where later cycles got 5-12 tests per epic instead of 92+. The panel itself renders correctly with its empty state and populated state, but we do not have DOM-level assertions.

---

## What Went Well

### 1. Clean Data Pipeline Architecture

The four stories form a linear, no-backtracking pipeline: pattern detection engine (30.1) produces `SprintPattern[]`, failure analysis (30.2) produces `FailureCategory[]`, feedback loop (30.3) consumes JSONL from Cycle 5's Story 25a.2 and feeds back into the recommendation engine, and the dashboard panel (30.4) visualizes all of it. No story required rework of a predecessor.

### 2. Pure Function Design

Both `detectCrossSprintPatterns` and `analyzeFailures` are pure functions -- array in, structured result out. Zero I/O, no side effects, fully deterministic. This made them trivially testable and easy to wire into the API route later. The pattern has been consistent across all cycles since Cycle 3.

### 3. Graceful Degradation Consistency

The `/api/learning/route.ts` follows the established WD-FR31 pattern: always returns HTTP 200, wraps everything in try/catch, provides `emptyResponse()` with optional error message. The `LearningInsightsPanel` has a clean empty state: "No learning data yet. Insights will appear after agents complete stories." No broken UI when the store is empty or uninitialized.

### 4. Feedback Persistence Strategy

The dual-write approach in `recommendation-feedback.ts` (in-memory + async JSONL via fetch) is well-designed. Persistence failure is non-fatal -- the comment explicitly states "Persistence failure is non-fatal -- in-memory tracking continues." The JSONL route validates required fields (`phase`, `action`, `timestamp`) and returns 400 for malformed requests.

### 5. Regex-Based Heuristic Guidance

The `suggestAction()` function in `learning-patterns.ts` maps error categories to actionable suggestions using regex patterns: network errors get connectivity guidance, parse errors get format validation suggestions, permission errors get credential checks, disk/memory errors get resource checks, exit codes get log review guidance, and everything else gets a generic investigation prompt. Simple, effective, no AI needed.

---

## What Could Be Improved

### 1. Dashboard Panel Tests Do Not Test Rendering

The `LearningInsightsPanel.test.tsx` verifies data shapes and calculations but does not mount the component or assert DOM output. It tests the logic that the component uses, not the component itself. This follows the Cycle 6 lean testing pattern but means we have no verification that the React rendering is correct -- className changes, conditional rendering branches, or event handling could break silently.

### 2. Feedback Improvement Is Not Yet Closed-Loop

Story 30.3 built the feedback recording mechanism (`recordFeedback`, `isOverDismissed`, JSONL persistence) but the actual integration into the recommendation engine -- where `isOverDismissed()` is consulted during recommendation generation to suppress or deprioritize specific recommendations -- was not wired in this epic. The function exists but no code calls it during recommendation generation. Story 25a.3 (state machine recommendation full integration) and Story 39.4 (compound learning real data connection) completed parts of this, but the full closed loop from feedback to adjusted recommendations needs verification.

### 3. Impact Level Thresholds Are Arbitrary

The `detectCrossSprintPatterns` function assigns impact levels based solely on count: high >= 10, medium >= 5, low < 5. These thresholds have no basis in actual sprint data. With the project's learning store accumulating real data, these thresholds should be calibrated against observed failure distributions. A pattern occurring 4 times in a project with 40 failures is different from 4 times in a project with 4 failures.

### 4. No Temporal Analysis

Pattern detection is purely frequency-based. There is no temporal dimension -- a pattern that occurred 5 times in Cycle 3 but zero times since is treated the same as one that occurred 5 times in the last sprint. The `firstSeen` field is recorded but never used for decay or recency weighting.

### 5. API Route Loads All Learning Data Into Memory

The `/api/learning/route.ts` calls `store.list()` which loads all learning records, then runs `detectCrossSprintPatterns` and `analyzeFailures` on the full dataset. For a project with thousands of sessions, this could become a performance concern. No pagination or streaming is implemented.

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Pure functions for analysis (no class, no state) | Testability, composability, consistent with project architecture since Cycle 3 |
| 3-occurrence threshold for patterns | Below 3 is noise, above 3 is signal. Matches `MIN_PATTERN_THRESHOLD` in core `learning-patterns.ts` |
| In-memory + async JSONL dual-write | Non-blocking persistence, graceful degradation on write failure |
| Always-HTTP-200 API pattern (WD-FR31) | Dashboard never breaks on missing data, shows empty state instead |
| Regex heuristics for guidance instead of AI | Covers 80%+ of real error categories with zero cost and zero latency |
| Fire-and-forget fetch for persistence | Persistence failure must not block UI or recommendation flow |
| Count-based impact levels (5/10 thresholds) | Simplest viable approach; calibrate later with real data |

---

## Lessons Learned

1. **Pure function analysis engines compose naturally.** `detectCrossSprintPatterns` takes `string[]` of error categories and returns `SprintPattern[]`. `analyzeFailures` takes `{ category, file? }[]` and returns `FailureCategory[]`. Both are trivially composable in the API route. This pattern should be the default for all future analysis features.

2. **Feedback loops need explicit wiring.** Building the recording mechanism (30.3) and the analysis engine (30.1/30.2) in the same epic does not guarantee they are connected. The `isOverDismissed()` function was built but nothing calls it during recommendation generation. Future epics should include "wire feedback into recommendation generation" as an explicit acceptance criterion.

3. **Empty state is a feature, not an afterthought.** The `LearningInsightsPanel` empty state ("No learning data yet. Insights will appear after agents complete stories.") sets user expectations correctly. The API's `emptyResponse()` with `totalSessions: 0` ensures the dashboard never shows NaN or broken layouts. This pattern should be followed for every dashboard panel.

4. **Cycle 6 lean testing was appropriate but left gaps.** The compound-learning tests cover the analysis logic well but skip React rendering tests. For infrastructure modules (pure functions), lean testing works. For UI components, at minimum one "renders with data" and one "renders empty state" test should be required.

5. **Compound learning compounds across cycles.** The feedback data from Cycle 5's Story 25a.2 feeds into Cycle 6's Story 30.3. The learning store from Cycle 3's Epic 11 feeds into Cycle 6's `/api/learning` route. The real data connection in Cycle 8's Story 39.4 completes the pipeline. This is genuine compound development -- each cycle builds on previous cycles' data infrastructure.

---

## Action Items

| # | Priority | Action | Target |
|---|----------|--------|--------|
| 1 | HIGH | Wire `isOverDismissed()` into recommendation generation -- closed feedback loop is incomplete | Recommendation engine refactor |
| 2 | MEDIUM | Add React Testing Library tests for `LearningInsightsPanel` (empty state + populated state) | Test debt |
| 3 | MEDIUM | Calibrate impact thresholds against real learning store data | After 10+ sprints accumulated |
| 4 | LOW | Add temporal decay to pattern detection (recent patterns weighted higher) | Future compound learning iteration |
| 5 | LOW | Consider pagination/streaming for `/api/learning` when learning store grows large | Performance |
| 6 | LOW | Standardize spike assessment template for investigation stories (noted in Epic 48 retro) | DX convention |

---

## Metrics

- **Stories**: 4/4 (100%)
- **Analysis functions**: 2 pure functions (`detectCrossSprintPatterns`, `analyzeFailures`)
- **API routes**: 2 (`/api/learning`, `/api/workflow/feedback`)
- **Dashboard components**: 1 (`LearningInsightsPanel`)
- **Core modules extended**: 1 (`learning-patterns.ts` with `suggestAction()` heuristics)
- **Test files**: 3 (`compound-learning.test.ts`, `recommendation-feedback.test.ts`, `LearningInsightsPanel.test.tsx`)
- **FRs covered**: Brainstorm #43, #50, #56, #176
- **Dependencies consumed**: Cycle 5 feedback JSONL (25a.2), Cycle 3 learning store (Epic 11)
- **Downstream consumers**: Cycle 8 Story 39.4 (real data connection), Cycle 9+ recommendation improvement
