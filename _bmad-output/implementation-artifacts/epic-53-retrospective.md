# Epic 53 Retrospective — Unified Sprint View

**Date**: 2026-04-29
**Epic**: 53 — Unified Sprint View
**Status**: Complete (all 5 stories done)
**Source**: epics-cycle-10.md

## Epic Summary

Epic 53 delivered a portfolio-wide sprint monitoring view that aggregates sprint data across all configured projects into a single dashboard. The epic progressed through five stories: foundational types and aggregation (53-1), health-colored progress bars (53-2), at-risk sprint identification with expandable detail (53-3), cross-project velocity comparison with sortable rankings (53-4), and client-side filtering with live summary recomputation (53-5). The result is a `/sprints` page with summary cards, filterable sprint grid, velocity comparison table, and per-sprint health diagnostics — all loading within the 2-second NFR target.

The epic introduced two new modules (`unified-sprint-aggregation.ts`, `sprint-filter.ts`), six new components (`UnifiedSprintView`, `UnifiedSprintSummaryCards`, `SprintCard`, `SprintProgressBar`, `SprintFilterBar`, `VelocityComparisonTable`), one API route (`GET /api/sprints/unified`), and zero external dependencies.

## Story Delivery

| Story | Title | Tests Added | Review Issues | Status |
|-------|-------|-------------|---------------|--------|
| 53-1 | Unified Sprint Dashboard | 60 (32 unit + 5 route + 23 component) | No formal review | Done |
| 53-2 | Sprint Progress Visualization | 11 | No formal review | Done |
| 53-3 | At-Risk Sprint Identification | ~15 (8 health + 5 card + 2 summary) | No formal review | Done |
| 53-4 | Cross-Project Velocity Comparison | ~31 (20 unit + 11 component) | No formal review | Done |
| 53-5 | Sprint Filtering and Aggregation | ~44 (24 filter + 12 filter bar + 8 view) | 2H + 4M + 3L (all fixed) | Done |

**Total new tests**: ~161
**Code reviews**: 1 formal review (53-5), 9 issues found and fixed
**External dependencies added**: 0

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) — project vision, user outcomes, quality standards
- Nova (Architect) — system design, type architecture, module boundaries
- Blaze (Dev) — implementation patterns, pain points, learnings
- Pax (QA) — test coverage, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** Five stories shipped in sequence with zero blocker carry-forward. Each story built cleanly on its predecessor: 53-1 established the types and aggregation layer, 53-2 added visual polish, 53-3 added diagnostic depth, 53-4 added cross-project analytics, and 53-5 made the whole view interactive. The dependency graph was linear and well-understood before any implementation began. This is how incremental feature delivery should work — each story is independently valuable and the full set is cohesive.

**Nova (Architect):** Two architectural decisions paid off consistently:

1. **Pure function separation** — `computeSprintHealth()`, `computeSprintSummary()`, `computeHealthReasons()`, `computeVelocity()`, `computeVelocityTrend()`, `filterSprints()` are all pure sync functions in `unified-sprint-aggregation.ts` and `sprint-filter.ts`. Zero I/O, zero side effects, fully testable. Every story added new pure functions to the same module, and the testing pattern (unit tests first, then component tests, then integration) was identical across all five stories.

2. **Type-first development** — Every story started by extending `UnifiedSprintEntry` or `UnifiedSprintSummary` in `types.ts` before touching aggregation or components. The type changes cascaded predictably to test mocks. This made the implementation path mechanical: extend types, update mocks, implement computation, build UI, verify.

**Blaze (Dev):** The `unified-sprint-aggregation.ts` module became a clean computation engine. By Story 53-5 it had 7 exported functions, all pure, all independently testable. The module follows the same pattern as `portfolio-aggregation.ts` from Epic 49 — iterating projects via tracker, computing per-entry stats, and producing a summary aggregate. Reusing this proven pattern reduced design risk.

**Pax (QA):** ~161 new tests across the epic, all with real assertions. The testing discipline was consistent: every computation function got exhaustive unit tests (boundary conditions, edge cases, null inputs), every component got rendering and interaction tests, and every API route got response-shape tests. Story 53-5's formal code review caught 9 issues including a phantom `dateRange: { start: "", end: "" }` detection bug that would have caused incorrect filter behavior — the review paid for itself.

---

### What Could Be Improved

**R2d2 (Project Lead):** Four of five stories (53-1 through 53-4) had no formal code review. The work was verified via test suites and regression runs, but a review might have caught the type duplication issue in 53-1 (two sets of identical types in `types.ts` that had to be deduplicated) earlier. The lightweight verification model worked for this epic because the stories were sequential and each built on verified predecessors, but it's not a pattern to generalize.

**Nova (Architect):** The `UnifiedSprintSummary` type accumulated fields across stories: 53-1 added 6 fields, 53-3 added `atRiskSprints`, 53-4 added `avgVelocity` and `maxVelocity`. Each addition required updating every mock object across every test file. By 53-5, constructing a complete mock `UnifiedSprintSummary` required 10 fields. The type is becoming a God object. A future refactor should split summary into sub-objects (core stats, health stats, velocity stats) to reduce the blast radius of schema changes.

**Blaze (Dev):** The SprintCard component went through three significant modifications (53-1: initial creation, 53-2: inline progress bar replaced with SprintProgressBar, 53-3: expandable risk detail with `useState` toggle, 53-5: composite key fix). Each modification required updating the 12+ existing SprintCard tests. The component is now the most-modified file in the epic. The `useEffect` sync for SSE prop changes added in 53-3 is a code smell — it suggests the component hierarchy could benefit from a controlled/uncontrolled prop pattern.

**Pax (QA):** The `request.nextUrl` pitfall from 53-1 (using `NextRequest`-specific property on plain `Request` in route tests) was caught during implementation but not documented as a dev note until after the fact. This same issue appeared in Story 52.5 — it's a recurring pattern that should be documented in CLAUDE.md as a testing convention. Also, the `@testing-library/user-event` dependency was added in 53-3 specifically for expand/collapse interaction tests — this should have been added in 53-1 when the component testing pattern was established.

---

### Previous Retro Action Items Review

Epic 52 retrospective (or nearest predecessor) action items:

| # | Action Item | Status | Notes |
|---|------------|--------|-------|
| — | No action items carried from predecessor epic | — | Epic 53 was the first in its sequence |

**Note**: No prior action items were tracked for this epic's predecessor in the available retrospective files.

---

### Technical Learnings

1. **Type field additions cascade across all test files.** Every field added to `UnifiedSprintEntry` or `UnifiedSprintSummary` required updating mock objects in every test file that constructs those types. By Story 53-4, this meant touching 6+ test files per field addition. Mitigation: use a `createMockEntry()` factory function in a shared test utility, rather than inline object literals in every test.

2. **Pure function pattern scales well.** Seven pure functions in `unified-sprint-aggregation.ts` with zero coupling to each other. Each was testable in isolation, and composition in `aggregateUnifiedSprints()` was straightforward. This pattern should be the default for all data transformation modules.

3. **SprintFilterState as a standalone type avoids cascade.** Story 53-5 created `SprintFilterState` as a new standalone type rather than extending existing types. This meant zero impact on existing test mocks — only new test files needed it. Lesson: additive types (new interfaces) are cheaper than additive fields (extending existing interfaces).

4. **Velocity trend without historical data is limited.** The velocity trend indicator in 53-4 is inferred from current sprint health/progress, not from historical data. This is honest but means the trend is a proxy, not a measurement. True trend analysis requires the data infrastructure planned for Epic 55 (Monte Carlo Forecasting).

5. **CSS custom properties as design tokens.** All five stories used `var(--color-*)` for styling with zero new color tokens introduced. The design system held up well across health indicators, progress bars, risk detail borders, and filter controls.

---

### Deferred Items Forward

| Item | Deferred To | Source |
|------|------------|--------|
| Sprint SSE real-time updates | Tech debt | 53-1 |
| Sprint date range filtering | Completed in 53-5 | 53-1 |
| Animated progress bar transitions | Tech debt | 53-2 |
| Progress bar comparison overlay (target vs actual) | Tech debt | 53-2 |
| Historical velocity trend (last 5 sprints) | Epic 55 | 53-4 |
| Velocity in story points (vs story count) | Tech debt | 53-4 |
| Owner/assignee filtering | Tech debt | 53-5 |
| Tag-based filtering | Tech debt | 53-5 |
| Split `UnifiedSprintSummary` into sub-objects | Tech debt | This retro |
| Document `request.nextUrl` pitfall in CLAUDE.md | Immediate | This retro |
| Add `createMockEntry()` test utility | Tech debt | This retro |

---

## Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Document `request.nextUrl` vs `new URL(request.url)` pitfall in CLAUDE.md testing conventions | Dev | MEDIUM |
| 2 | Create shared `createMockEntry()` / `createMockSummary()` test factories for unified sprint types | Dev | LOW |
| 3 | Consider splitting `UnifiedSprintSummary` into sub-objects to reduce mock update blast radius | Dev | LOW |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 5 |
| New files created | 18 (2 modules, 1 route, 1 page, 6 components, 8 test files) |
| Modified files | 12 (types, aggregation, existing components, existing tests) |
| Total new tests | ~161 |
| External dependencies added | 0 |
| Code reviews | 1 formal (53-5), 9 issues found and fixed |
| Stories with zero review issues | 0 (no formal review on 53-1 through 53-4) |
| Deferred items | 6 (2 completed by later stories, 4 remain) |
| Final test count (web) | 1,888 passing |
| Epic duration | ~5 stories |

## Key Files Created

| File | Purpose |
|------|---------|
| `packages/web/src/lib/types.ts` | `UnifiedSprintEntry`, `UnifiedSprintSummary`, `SprintHealthStatus`, `SprintFilterState` |
| `packages/web/src/lib/unified-sprint-aggregation.ts` | Sprint aggregation, health, summary, velocity computation |
| `packages/web/src/lib/sprint-filter.ts` | Client-side filter logic with AND semantics |
| `packages/web/src/app/api/sprints/unified/route.ts` | GET /api/sprints/unified endpoint |
| `packages/web/src/app/sprints/page.tsx` | Server component for /sprints page |
| `packages/web/src/components/UnifiedSprintView.tsx` | Main client component with filter state |
| `packages/web/src/components/UnifiedSprintSummaryCards.tsx` | 7 metric cards (total, active, completed, done, progress, at-risk, avg velocity) |
| `packages/web/src/components/SprintCard.tsx` | Per-sprint card with progress bar, health badge, expandable risk detail |
| `packages/web/src/components/SprintProgressBar.tsx` | Health-colored progress bar with ARIA accessibility |
| `packages/web/src/components/SprintFilterBar.tsx` | Filter controls: status, health, project, date range |
| `packages/web/src/components/VelocityComparisonTable.tsx` | Sortable cross-project velocity comparison |
