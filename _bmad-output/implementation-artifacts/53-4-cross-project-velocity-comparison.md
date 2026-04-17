# Story 53.4: Cross-Project Velocity Comparison

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **to compare sprint velocity across projects**,
so that **I can identify high-performing teams and those needing support**.

## Acceptance Criteria

1. **Given** I want to compare team performance
   **When** I view the velocity comparison section
   **Then** I see velocity (stories completed per day) for each project
   **And** I can sort by velocity to see rankings

2. **Given** I want to understand velocity trends
   **When** I view the velocity comparison section
   **Then** I see a trend indicator for each project's velocity
   **And** the trend shows direction (improving, declining, stable)

## Tasks / Subtasks

- [x] Task 1: Add velocity fields to types and computation (AC: #1)
  - [x] 1.1: Add `velocity: number` and `velocityTrend: "improving" | "declining" | "stable" | "unknown"` fields to `UnifiedSprintEntry` in `packages/web/src/lib/types.ts`
  - [x] 1.2: Add `avgVelocity: number` and `maxVelocity: number` fields to `UnifiedSprintSummary` in `packages/web/src/lib/types.ts`
  - [x] 1.3: Create `computeVelocity(entry)` pure function in `packages/web/src/lib/unified-sprint-aggregation.ts` — returns `stories.done / sprintDays` where `sprintDays = max(1, days between startDate and endDate or startDate and now)`. Returns `0` when no dates available.
  - [x] 1.4: Create `computeVelocityTrend(entry)` pure function — returns `"stable"` when progressPercent > 70, `"declining"` when health is "at-risk" or "blocked" AND progressPercent < 50, `"improving"` when health is "on-track" AND progressPercent >= 50, `"unknown"` when no dates available
  - [x] 1.5: Update `aggregateUnifiedSprints()` to compute and assign `velocity` and `velocityTrend` on each entry
  - [x] 1.6: Update `computeSprintSummary()` to compute `avgVelocity` and `maxVelocity` from sprint entries

- [x] Task 2: Create VelocityComparisonTable component (AC: #1, #2)
  - [x] 2.1: Create `packages/web/src/components/VelocityComparisonTable.tsx` — client component showing a sorted table of projects with their velocity, rank, and trend
  - [x] 2.2: Implement sortable table with columns: Rank, Project, Velocity (stories/day), Progress, Trend indicator
  - [x] 2.3: Default sort by velocity descending (highest velocity first = rank 1)
  - [x] 2.4: Click column headers to toggle sort direction (ascending/descending) for Rank, Project, Velocity, Progress columns
  - [x] 2.5: Render trend indicator as colored text: green arrow up (improving), red arrow down (declining), gray dash (stable), gray "?" (unknown)
  - [x] 2.6: Use existing CSS custom properties for colors: `--color-success` (improving), `--color-error` (declining), `--color-text-muted` (stable/unknown)
  - [x] 2.7: Format velocity to 2 decimal places (e.g., "1.25 stories/day")

- [x] Task 3: Integrate into UnifiedSprintView (AC: #1)
  - [x] 3.1: Modify `packages/web/src/components/UnifiedSprintView.tsx` to render `VelocityComparisonTable` below the summary cards and above the sprint card grid, only when `sprints.length >= 2` (comparison needs at least 2 projects)
  - [x] 3.2: Pass sorted sprints array to `VelocityComparisonTable`
  - [x] 3.3: Update `UnifiedSprintSummaryCards` to include "Avg Velocity" metric card (change grid from 6 to 7 columns)

- [x] Task 4: Write tests (AC: #1, #2)
  - [x] 4.1: Create `packages/web/src/lib/__tests__/velocity-computation.test.ts` — unit tests for `computeVelocity` and `computeVelocityTrend`
  - [x] 4.2: Test: `computeVelocity` returns correct stories/day with valid dates
  - [x] 4.3: Test: `computeVelocity` returns 0 when no dates available
  - [x] 4.4: Test: `computeVelocity` clamps sprint days to minimum 1 (division by zero prevention)
  - [x] 4.5: Test: `computeVelocity` uses elapsed days for active sprints, total days for completed
  - [x] 4.6: Test: `computeVelocityTrend` returns "improving" for on-track with >= 50% progress
  - [x] 4.7: Test: `computeVelocityTrend` returns "declining" for at-risk/blocked with < 50% progress
  - [x] 4.8: Test: `computeVelocityTrend` returns "stable" for >= 70% progress
  - [x] 4.9: Test: `computeVelocityTrend` returns "unknown" when no dates
  - [x] 4.10: Test: `computeSprintSummary` computes avgVelocity and maxVelocity correctly
  - [x] 4.11: Create `packages/web/src/components/__tests__/VelocityComparisonTable.test.tsx` — component tests
  - [x] 4.12: Test: renders table with project rows
  - [x] 4.13: Test: renders velocity values formatted to 2 decimal places
  - [x] 4.14: Test: sorts by velocity descending by default
  - [x] 4.15: Test: clicking column header toggles sort direction
  - [x] 4.16: Test: renders trend indicators with correct colors
  - [x] 4.17: Test: displays rank numbers (1, 2, 3...) based on sort order
  - [x] 4.18: Update `packages/web/src/components/__tests__/UnifiedSprintSummaryCards.test.tsx` to verify new "Avg Velocity" card
  - [x] 4.19: Update `packages/web/src/app/api/sprints/unified/route.test.ts` to verify new fields in response

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- No hidden TODOs or FIXMEs in completed tasks
- Deferred items explicitly documented

**Deferred Items Tracking:**

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Velocity trend over last 5 sprints (historical sparkline)
   - Status: Deferred - Requires historical sprint data storage
   - Requires: JSONL or similar persistence for past sprint velocities (Epic 55 Monte Carlo Forecasting will need this too)
   - Current: Trend indicator based on current sprint health/progress (directional, not historical)
2. Velocity in story points (vs stories count)
   - Status: Deferred - Current system tracks stories, not story points
   - Requires: Story point estimation in tracker data model
   - Current: Velocity computed as stories completed per day
```

## Interface Validation

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags
- [x] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- `UnifiedSprintEntry` type from `@/lib/types` — data source, ADDING velocity and velocityTrend fields
- `UnifiedSprintSummary` type from `@/lib/types` — summary, ADDING avgVelocity and maxVelocity fields
- `aggregateUnifiedSprints()` from `@/lib/unified-sprint-aggregation` — MODIFYING to compute velocity
- `computeSprintSummary()` from `@/lib/unified-sprint-aggregation` — MODIFYING to include velocity aggregation
- `UnifiedSprintView` component — MODIFYING to add VelocityComparisonTable
- `UnifiedSprintSummaryCards` component — MODIFYING to add Avg Velocity card

**Feature Flags:**
- None required — extends existing types and functions

## Dependency Review

No new external dependencies required. Uses existing:
- Vitest for testing
- React for UI components
- Tailwind CSS for styling
- `UnifiedSprintEntry` / `UnifiedSprintSummary` types from Story 53-1
- `SprintHealthStatus` type from Story 53-1

## Dev Notes

### Architecture Context

This is **Story 4 of 5** in **Epic 53: Unified Sprint View**. It depends on:
- **Story 53-1 (done):** Unified Sprint Dashboard — provides `UnifiedSprintEntry`, `UnifiedSprintSummary`, `UnifiedSprintView`, `SprintCard`, `UnifiedSprintSummaryCards`, `aggregateUnifiedSprints()`, `computeSprintSummary()`, the `/sprints` page, and the `/api/sprints/unified` route.
- **Story 53-2 (done):** Sprint Progress Visualization — provides `SprintProgressBar` component (not directly used by this story but part of the sprint card).

**Note:** Story 53-3 (at-risk sprint identification) is `ready-for-dev` but NOT yet implemented. This story (53-4) is independent of 53-3's changes. Story 53-3 will add `healthReasons: string[]` to `UnifiedSprintEntry` and `atRiskSprints: number` to `UnifiedSprintSummary`. If 53-3 is implemented first, ensure mock objects in this story's tests include those fields to avoid type errors. If this story is implemented first, 53-3's implementation will need to include `velocity` and `velocityTrend` fields in its mocks.

### Previous Story Intelligence (53-2: Sprint Progress Visualization)

Key patterns and learnings from completed stories:
- **Pure function pattern**: `computeSprintHealth()`, `computeSprintSummary()`, `computeElapsedFraction()` are pure sync functions. Follow the same pattern for `computeVelocity()` and `computeVelocityTrend()`.
- **Component extraction**: SprintProgressBar was extracted from SprintCard into its own file. Follow the same pattern — create VelocityComparisonTable as a standalone component.
- **Test helper pattern**: Use `createProps()` factory functions for component tests with sensible defaults.
- **CSS variable design system**: Use `--color-success`, `--color-warning`, `--color-error`, `--color-text-muted`, `--color-border`, `--color-text-primary` — do NOT introduce new color tokens or Tailwind direct color classes.
- **Type changes cascade**: Adding fields to `UnifiedSprintEntry` or `UnifiedSprintSummary` requires updating ALL test files that construct mock objects. Use grep to find every occurrence.
- **ARIA accessibility**: SprintProgressBar uses `role="progressbar"` with `aria-*` attributes. VelocityComparisonTable should use `role="table"` with appropriate headers.
- **Build before test**: Always rebuild `@composio/ao-core` after adding new exports.

### Velocity Computation Design

**Formula:**
```
velocity = stories.done / sprintDays

Where:
  sprintDays = max(1, calculated_days)
  calculated_days:
    - If status === "completed": endDate - startDate (total sprint duration)
    - If status === "active": now - startDate (elapsed days so far)
    - If status === "planning" or no startDate: 0 velocity (no work happening)
    - If no endDate for active sprint: use elapsed days from startDate
```

**Rationale:** Velocity represents throughput — stories completed per day of sprint time. For active sprints, we measure elapsed time (how fast they're going NOW). For completed sprints, we use total duration (overall pace).

**Edge cases:**
- `sprintDays` clamped to minimum 1 to prevent division by zero
- Planning sprints get velocity = 0 (no stories done, no time elapsed)
- Sprints with no dates get velocity = 0 (can't compute rate without time)
- Very short sprints (< 1 day) still get velocity computed (clamped denominator)

### Velocity Trend Computation

Since we lack historical sprint data (the system only tracks current sprint state), the "trend" is an **inferred direction** based on current sprint indicators, NOT a time-series trend:

| Condition | Trend | Display |
|-----------|-------|---------|
| `progressPercent >= 70` | `"stable"` | Gray dash (—) |
| `health === "on-track" && progressPercent >= 50` | `"improving"` | Green up arrow |
| `("at-risk" or "blocked") && progressPercent < 50` | `"declining"` | Red down arrow |
| No dates or sprint in planning | `"unknown"` | Gray "?" |

**Why this approach:** The AC asks for "velocity trends" but without historical data, a true trend line isn't possible. The inferred direction provides meaningful signal (is this sprint improving or declining?) while being honest about limitations. Historical trends are deferred to when Epic 55 (Monte Carlo Forecasting) adds the necessary data infrastructure.

### VelocityComparisonTable Component Design

```
┌──────────────────────────────────────────────────────────────┐
│  Velocity Comparison                          ↑ Velocity ▼   │
├──────┬─────────────────┬──────────┬──────────┬───────────────┤
│ Rank │ Project         │ Velocity │ Progress │ Trend         │
├──────┼─────────────────┼──────────┼──────────┼───────────────┤
│  1   │ Project Alpha   │ 2.14/d   │ 85%      │ ▲ improving   │
│  2   │ Project Beta    │ 1.50/d   │ 72%      │ — stable      │
│  3   │ Project Gamma   │ 0.80/d   │ 35%      │ ▼ declining   │
│  4   │ Project Delta   │ 0.00/d   │ 0%       │ ? unknown     │
└──────┴─────────────────┴──────────┴──────────┴───────────────┘
```

**Props:**
```typescript
interface VelocityComparisonTableProps {
  sprints: UnifiedSprintEntry[];
}
```

**Sorting:**
- Default: velocity descending (rank 1 = fastest)
- Click "Rank" or "Velocity" header: toggle between ascending/descending
- Click "Project" header: sort alphabetically
- Click "Progress" header: sort by progressPercent
- Trend column: not sortable (it's a visual indicator)

**Accessibility:**
- `role="table"` on the container
- `role="columnheader"` on header cells
- `role="row"` on each row
- `aria-sort="ascending|descending|none"` on sortable columns
- `aria-label` on trend indicators for screen readers (e.g., "improving", "declining")

### UnifiedSprintView Integration

The `UnifiedSprintView` component currently renders:
```
UnifiedSprintView
  ├── UnifiedSprintSummaryCards (5 metric cards)
  └── Grid of SprintCard components
```

After this story:
```
UnifiedSprintView
  ├── UnifiedSprintSummaryCards (6 metric cards — adds "Avg Velocity")
  ├── VelocityComparisonTable  ← NEW (only when sprints.length >= 2)
  └── Grid of SprintCard components
```

The comparison table sits between the summary cards and the individual sprint cards, providing a portfolio-level comparison before drilling into individual sprints.

### File Structure to Create/Modify

```
packages/web/src/
├── lib/
│   ├── types.ts                                          # MODIFY: Add velocity fields to types
│   ├── unified-sprint-aggregation.ts                     # MODIFY: Add velocity computation, update aggregation/summary
│   └── __tests__/
│       └── velocity-computation.test.ts                  # NEW: Unit tests for velocity functions
├── components/
│   ├── VelocityComparisonTable.tsx                       # NEW: Sorted comparison table component
│   ├── UnifiedSprintView.tsx                             # MODIFY: Add VelocityComparisonTable integration
│   ├── UnifiedSprintSummaryCards.tsx                     # MODIFY: Add "Avg Velocity" card, 5→6 columns
│   └── __tests__/
│       ├── VelocityComparisonTable.test.tsx              # NEW: Component tests
│       ├── UnifiedSprintSummaryCards.test.tsx            # MODIFY: Add Avg Velocity card test
│       └── UnifiedSprintView.test.tsx                    # MODIFY: Update for new child component
├── app/
│   ├── sprints/page.tsx                                  # VERIFY: May need updates for new fields
│   └── api/sprints/unified/
│       ├── route.ts                                      # VERIFY: Should auto-include new fields
│       └── route.test.ts                                 # MODIFY: Update mocks for new fields
```

### Testing Strategy

**Unit tests (velocity-computation.test.ts):**
- `computeVelocity`: correct computation with valid dates
- `computeVelocity`: returns 0 for no dates
- `computeVelocity`: clamps denominator to min 1
- `computeVelocity`: uses elapsed days for active, total for completed
- `computeVelocity`: returns 0 for planning sprints
- `computeVelocityTrend`: "improving" for on-track + >= 50%
- `computeVelocityTrend`: "declining" for at-risk/blocked + < 50%
- `computeVelocityTrend`: "stable" for >= 70% progress
- `computeVelocityTrend`: "unknown" when no dates
- `computeSprintSummary`: computes avgVelocity correctly
- `computeSprintSummary`: computes maxVelocity correctly
- `computeSprintSummary`: handles empty sprints array

**Component tests (VelocityComparisonTable.test.tsx):**
- Renders table with project rows
- Renders velocity values formatted to 2 decimal places with "/d" suffix
- Sorts by velocity descending by default
- Clicking column header toggles sort direction
- Renders trend indicators with correct text and color classes
- Displays rank numbers based on current sort order
- Handles single sprint (no comparison — table not rendered, handled in view)
- Handles zero velocity sprints

**Integration tests (updates to existing):**
- `UnifiedSprintSummaryCards.test.tsx`: New "Avg Velocity" card renders
- `UnifiedSprintView.test.tsx`: VelocityComparisonTable rendered when >= 2 sprints
- `UnifiedSprintView.test.tsx`: VelocityComparisonTable NOT rendered when < 2 sprints
- `route.test.ts`: Response includes velocity and velocityTrend fields

### NFRs

- **NFR-F5-1:** Velocity comparison renders as part of the unified sprint view (loaded within 2 seconds per NFR-F5-1)
- **NFR-P1:** Velocity computation is instant (pure math, no async operations)

### Pre-existing Types (Do NOT modify)

- `SprintSummary` in `packages/core/src/types.ts` — core type for single-project sprint summary
- `SprintDataMap` in `packages/core/src/cross-project-deps.ts` — used for dependency resolution
- Do NOT modify `SprintHealthStatus` union type

### References

- [Source: epics-cycle-10.md#Epic 53 Story 53.4] — Story definition and ACs
- [Source: prd-cycle-10.md#F5] — Unified Sprint View requirements (FR-F5-3: velocity comparison)
- [Source: prd-cycle-10.md#NFR-F5-1] — Performance: 2-second load
- [Source: _bmad-output/implementation-artifacts/53-1-unified-sprint-dashboard.md] — Story 53-1: types, aggregation, view
- [Source: _bmad-output/implementation-artifacts/53-2-sprint-progress-visualization.md] — Story 53-2: SprintProgressBar, component extraction pattern
- [Source: packages/web/src/lib/unified-sprint-aggregation.ts] — Velocity computation will be added here
- [Source: packages/web/src/lib/types.ts] — Type definitions to extend
- [Source: packages/web/src/components/UnifiedSprintSummaryCards.tsx] — Metric card pattern to follow
- [Source: packages/web/src/components/UnifiedSprintView.tsx] — Integration point

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- Story 53-1 and 53-2 MUST be implemented before this story (types and view infrastructure dependency)
- All existing tests must continue to pass (no regressions)
- Use CSS custom properties (`var(--color-*)`) for colors
- Velocity comparison only shows when >= 2 projects have sprint data

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No debug sessions required — all implementations were straightforward.

### Completion Notes List

- All 4 tasks completed with no blockers
- Pure function pattern followed for `computeVelocity` and `computeVelocityTrend`
- VelocityComparisonTable supports 4 sortable columns: Rank, Project, Velocity, Progress
- Velocity trend is inferred from health/progress (not historical) — documented as limitation
- UnifiedSprintSummaryCards expanded from 6 to 7 cards with "Avg Velocity" metric
- UnifiedSprintView conditionally renders comparison table only when >= 2 sprints
- All 1845 tests passing after implementation

### Limitations (Deferred Items)

1. Velocity trend over last 5 sprints (historical sparkline)
   - Status: Deferred - Requires historical sprint data storage
   - Requires: JSONL or similar persistence for past sprint velocities (Epic 55 Monte Carlo Forecasting will need this too)
   - Current: Trend indicator based on current sprint health/progress (directional, not historical)
2. Velocity in story points (vs stories count)
   - Status: Deferred - Current system tracks stories, not story points
   - Requires: Story point estimation in tracker data model
   - Current: Velocity computed as stories completed per day

### File List

**Modified:**
- `packages/web/src/lib/types.ts` — Added `velocity`, `velocityTrend` to `UnifiedSprintEntry`; `avgVelocity`, `maxVelocity` to `UnifiedSprintSummary`
- `packages/web/src/lib/unified-sprint-aggregation.ts` — Added `computeVelocity()`, `computeVelocityTrend()`; updated `aggregateUnifiedSprints()`, `computeSprintSummary()`
- `packages/web/src/components/UnifiedSprintSummaryCards.tsx` — Added "Avg Velocity" card, grid 6→7 columns
- `packages/web/src/components/UnifiedSprintView.tsx` — Added VelocityComparisonTable integration
- `packages/web/src/app/sprints/page.tsx` — Fixed fallback summary to include all required fields
- `packages/web/src/components/__tests__/UnifiedSprintSummaryCards.test.tsx` — Added velocity card tests
- `packages/web/src/components/__tests__/UnifiedSprintView.test.tsx` — Updated for multiple text matches
- `packages/web/src/app/api/sprints/unified/route.test.ts` — Added velocity field assertions

**Created:**
- `packages/web/src/components/VelocityComparisonTable.tsx` — Sortable velocity comparison table
- `packages/web/src/lib/__tests__/velocity-computation.test.ts` — 20 unit tests for velocity functions
- `packages/web/src/components/__tests__/VelocityComparisonTable.test.tsx` — 11 component tests
