# Story 53.5: Sprint Filtering and Aggregation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **to filter sprints by status, project, and date range**,
so that **I can focus on relevant sprints and get aggregated metrics for the filtered set**.

## Acceptance Criteria

1. **Given** the unified sprint view is displayed
   **When** I apply a sprint status filter (active, completed, planning)
   **Then** only sprints matching the selected status are shown
   **And** the sprint card grid updates to show only matching sprints

2. **Given** the unified sprint view is displayed
   **When** I apply a health filter (on-track, at-risk, blocked)
   **Then** only sprints matching the selected health status are shown
   **And** the sprint card grid updates to show only matching sprints

3. **Given** multiple projects have sprint data
   **When** I filter by a specific project
   **Then** only that project's sprint is shown
   **And** all other sprints are hidden

4. **Given** the unified sprint view is displayed
   **When** I apply a date range filter
   **Then** only sprints whose date range overlaps with the selected range are shown
   **And** sprints without dates are hidden when a date filter is active

5. **Given** filters are active
   **When** the sprint card grid updates
   **Then** the summary cards (Total Sprints, Active Sprints, Stories Done, etc.) update to reflect only the filtered sprints
   **And** a "Clear filters" button resets all filters and restores the full view

6. **Given** filters are active
   **When** the user clicks "Clear filters"
   **Then** all filters are reset to their default (no filter) state
   **And** all sprints are shown again
   **And** summary cards show the unfiltered totals

## Tasks / Subtasks

- [x] Task 1: Add sprint filter types (AC: #1, #2, #3, #4)
  - [x] 1.1: Add `SprintFilterState` interface to `packages/web/src/lib/types.ts`
  - [x] 1.2: Add `EMPTY_SPRINT_FILTERS: SprintFilterState` constant to `packages/web/src/lib/types.ts`
  - [x] 1.3: Update all existing test mock objects to include no new required fields (SprintFilterState is standalone, no changes to existing types needed)

- [x] Task 2: Implement sprint filter logic (AC: #1, #2, #3, #4, #5)
  - [x] 2.1: Create `packages/web/src/lib/sprint-filter.ts` with exported functions
  - [x] 2.2: Filter logic rules for `filterSprints` (AND logic, all filters)
  - [x] 2.3: Write unit tests in `packages/web/src/lib/__tests__/sprint-filter.test.ts` (24 tests)

- [x] Task 3: Create SprintFilterBar component (AC: #1, #2, #3, #4, #6)
  - [x] 3.1: Create `packages/web/src/components/SprintFilterBar.tsx`
  - [x] 3.2: Render a status `<select>` dropdown with options: All, Active, Completed, Planning
  - [x] 3.3: Render a health `<select>` dropdown with options: All, On Track, At Risk, Blocked
  - [x] 3.4: Render a project `<select>` dropdown with options: All Projects, then each available project
  - [x] 3.5: Render date range inputs: two `<input type="date">` for start and end
  - [x] 3.6: Render a filtered count display with `aria-live="polite"`
  - [x] 3.7: Render a "Clear filters" button (only when filters active)
  - [x] 3.8: Style using existing CSS custom properties
  - [x] 3.9: Write component tests (12 tests)

- [x] Task 4: Integrate filtering into UnifiedSprintView (AC: #1-#6)
  - [x] 4.1: Update `packages/web/src/components/UnifiedSprintView.tsx` with filter state, useMemo, SprintFilterBar
  - [x] 4.2: Update `UnifiedSprintView` tests (8 tests including filter integration)

- [x] Task 5: Run full regression suite and verify no breakage (AC: all)
  - [x] 5.1: Run `pnpm --filter @composio/ao-web test` — 1887 tests passing (156 test files)
  - [x] 5.2: No new TypeScript errors introduced
  - [x] 5.3: No new ESLint errors introduced

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
1. Owner/assignee filtering
   - Status: Deferred - Requires owner/assignee field in data model
   - Requires: `owner: string | null` field on `UnifiedSprintEntry`, sourced from project config or tracker
   - Epic: Story 53.5 / Epic 53
   - Current: Filter supports status, health, project, and date range only
2. Tag-based filtering
   - Status: Deferred - Requires tags on sprint entries
   - Requires: `tags: string[]` field on `UnifiedSprintEntry` from project config
   - Epic: Story 53.5 / Epic 53
   - Current: No tag metadata on sprint entries
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
- `UnifiedSprintEntry` type from `@/lib/types` — filter target, READ ONLY
- `UnifiedSprintSummary` type from `@/lib/types` — recomputed from filtered data, READ ONLY
- `SprintHealthStatus` type from `@/lib/types` — filter option, READ ONLY
- `computeSprintSummary()` from `@/lib/unified-sprint-aggregation` — recompute summary on filtered data, CALL ONLY
- `PortfolioFilterBar` component pattern — reference pattern for SprintFilterBar, NO DIRECT USE

**Feature Flags:**
- None required — pure client-side filtering with no new external dependencies

## Dependency Review

No new external dependencies required. All changes use existing internal modules:
- React `useState` and `useMemo` for client-side state
- Existing CSS custom properties for styling
- Vitest for testing
- Follows `PortfolioFilterBar` + `portfolio-filter.ts` as internal reference patterns

## Dev Notes

### Architecture Context

This is **Story 5 of 5** (FINAL STORY) in **Epic 53: Unified Sprint View**. It depends on:
- **Story 53.1 (done):** Unified Sprint Dashboard — provides `UnifiedSprintEntry`, `UnifiedSprintSummary`, `UnifiedSprintView`, `aggregateUnifiedSprints()`, `computeSprintSummary()`, the `/sprints` page, and the `/api/sprints/unified` route.
- **Story 53.2 (done):** Sprint Progress Visualization — provides `SprintProgressBar` component.
- **Story 53.3 (done):** At-Risk Sprint Identification — provides `healthReasons`, `atRiskSprints`, and the expandable detail section on SprintCard.

**Note:** Story 53.4 (Cross-Project Velocity Comparison) is `ready-for-dev` and may or may not be implemented before this story. If 53.4 is implemented first, `UnifiedSprintEntry` will also have `velocity` and `velocityTrend` fields — this story's filter logic and tests must include those fields in mocks. If this story is implemented first, 53.4 will need to include filter-aware tests.

This story adds **client-side state management** to `UnifiedSprintView` which is currently stateless. This is a significant change — the component transitions from a pure presentational component to a stateful interactive component.

### Previous Story Intelligence (53.3: At-Risk Sprint Identification)

Key patterns and learnings:
- **Pure function pattern**: All computation functions are pure sync. Filter functions MUST follow this pattern — `filterSprints()` is pure, no I/O.
- **Type changes cascade**: Adding fields to `UnifiedSprintEntry` or `UnifiedSprintSummary` requires updating ALL test files. This story adds a NEW type (`SprintFilterState`) which is standalone and does NOT modify existing types.
- **CSS variable design system**: Use `--color-success`, `--color-warning`, `--color-error`, `--color-text-muted`, `--color-border`, `--color-text-primary` — do NOT introduce new color tokens.
- **Component testing**: Use `@testing-library/react` with `screen`, `within`, `fireEvent`/`userEvent`. Follow existing test patterns.
- **Test count**: 1,814+ web tests must continue passing.

### What Already Exists (Do NOT Reinvent)

1. **`PortfolioFilterBar.tsx`** — THE reference pattern for SprintFilterBar. It has: status dropdown, tag toggle buttons, metadata dropdowns, filtered count with `aria-live="polite"`, and a "Clear filters" button. **Follow this pattern exactly** but adapt for sprint-specific filters.

2. **`portfolio-filter.ts`** — THE reference pattern for sprint-filter.ts. It has: `hasActiveFilters()`, `filterProjects()` (AND logic), `extractAvailableTags()`, `extractAvailableMetadata()`, `EMPTY_FILTERS`. **Follow this pattern exactly** but adapt for sprint data.

3. **`FilterState` interface** — portfolio-specific type. DO NOT modify. CREATE a new `SprintFilterState` alongside it.

4. **`UnifiedSprintView`** — currently stateless, renders `<UnifiedSprintSummaryCards>` + grid of `<SprintCard>`. MODIFY to add filter state and SprintFilterBar.

5. **`computeSprintSummary()`** — already pure, takes `UnifiedSprintEntry[]`. Call it on the filtered subset to recompute summary. DO NOT modify the function.

6. **`sprints/page.tsx`** — server component that fetches data. No changes needed — filtering is entirely client-side.

7. **`/api/sprints/unified/route.ts`** — API route. No changes needed — returns all data, client filters.

### SprintFilterState Design

```typescript
interface SprintFilterState {
  status: UnifiedSprintEntry["status"] | null;     // "active" | "completed" | "planning" | null
  health: SprintHealthStatus | null;               // "on-track" | "at-risk" | "blocked" | null
  projectId: string | null;                         // project ID from available projects
  dateRange: { start: string; end: string } | null; // ISO date strings for range, null = no filter
}

const EMPTY_SPRINT_FILTERS: SprintFilterState = {
  status: null,
  health: null,
  projectId: null,
  dateRange: null,
};
```

**Why this shape:** Mirrors the AC requirements (status, health, project, date range). Owner/assignee is deferred (no field in data model). Tags are deferred (no tags on sprint entries).

### Filter Logic Rules

`filterSprints(sprints, filters)` applies **AND logic** — all active filters must match:

| Filter | Rule | Null = No Filter |
|--------|------|------------------|
| `status` | `sprint.status === filters.status` | ✓ |
| `health` | `sprint.health === filters.health` | ✓ |
| `projectId` | `sprint.projectId === filters.projectId` | ✓ |
| `dateRange` | Overlap: `sprint.startDate <= range.end && sprint.endDate >= range.start`. Sprints without dates are EXCLUDED when this filter is active. | ✓ |

**Date range overlap logic:**
```
Two ranges [A_start, A_end] and [B_start, B_end] overlap if:
  A_start <= B_end AND A_end >= B_start

Where:
  A = sprint date range (startDate, endDate)
  B = filter date range (start, end)
```

**Edge cases:**
- Sprint with null startDate or endDate → excluded when dateRange filter is active (can't determine overlap)
- dateRange with only start set → treat as "from start onwards" (end = far future like "9999-12-31")
- dateRange with only end set → treat as "up to end" (start = far past like "1970-01-01")
- Both start and end set → normal range overlap
- Empty filter → return all sprints unchanged

### SprintFilterBar Component Design

```
┌──────────────────────────────────────────────────────────────────────┐
│ Status: [All ▼]  Health: [All ▼]  Project: [All Projects ▼]        │
│ From: [____-__-__]  To: [____-__-__]    Showing 3 of 5 sprints  ✕ Clear │
└──────────────────────────────────────────────────────────────────────┘
```

**Layout:** Single-row flex with wrapping on smaller screens. Follows PortfolioFilterBar's responsive layout.

**Controls:**
1. **Status select**: Options from `UnifiedSprintEntry["status"]` — All, Active, Completed, Planning
2. **Health select**: Options from `SprintHealthStatus` — All, On Track, At Risk, Blocked
3. **Project select**: Options from `extractAvailableProjects(sprints)` — All Projects, then each project by name
4. **Date range**: Two `<input type="date">` — From and To. Either can be set independently.
5. **Filtered count**: `aria-live="polite"` text: "Showing {filtered} of {total} sprints"
6. **Clear button**: Visible only when filters are active. Calls `onFiltersChange(EMPTY_SPRINT_FILTERS)`.

**Accessibility (follow PortfolioFilterBar pattern):**
- `aria-label` on each control
- `aria-live="polite"` on filtered count
- "Clear filters" button has `aria-label="Clear all sprint filters"`

### UnifiedSprintView Integration

**Before this story:**
```
UnifiedSprintView (stateless)
  Props: initialSprints, initialSummary
  Renders:
    ├── Heading
    ├── UnifiedSprintSummaryCards (summary)
    └── Grid of SprintCard (all sprints)
```

**After this story:**
```
UnifiedSprintView (stateful)
  Props: initialSprints, initialSummary
  State: filters = useState(EMPTY_SPRINT_FILTERS)
  Computed:
    ├── availableProjects = useMemo(extractAvailableProjects, [initialSprints])
    ├── filteredSprints = useMemo(filterSprints, [initialSprints, filters])
    └── filteredSummary = useMemo(computeSprintSummary, [filteredSprints])
  Renders:
    ├── Heading
    ├── SprintFilterBar (filters, onFiltersChange, availableProjects, filteredCount)
    ├── UnifiedSprintSummaryCards (filteredSummary)  ← recomputed
    └── Grid of SprintCard (filteredSprints)          ← filtered
```

**Key change:** Summary cards now show metrics for the **filtered** set, not the full set. This means users see accurate aggregated data for their current view.

### Date Range Edge Cases

The date range filter needs careful handling:

1. **Both dates set**: Standard overlap check. `sprint.startDate <= filterEnd && sprint.endDate >= filterStart`.
2. **Only start set**: Show sprints ending on or after the start date. Treat filterEnd as `undefined` → only check `sprint.endDate >= filterStart`.
3. **Only end set**: Show sprints starting on or before the end date. Treat filterStart as `undefined` → only check `sprint.startDate <= filterEnd`.
4. **Neither set but dateRange object exists**: This shouldn't happen — treat as no date filter (null check first).
5. **Sprint without dates**: Excluded when dateRange is active. Included when dateRange is null.

**Implementation note:** The `dateRange` field stores `{ start: string, end: string }` where either field can be an empty string `""`. The filter logic checks for empty strings and treats them as unbounded.

### File Structure to Create/Modify

```
packages/web/src/
├── lib/
│   ├── types.ts                                        # MODIFY: Add SprintFilterState, EMPTY_SPRINT_FILTERS
│   ├── sprint-filter.ts                                # NEW: Filter logic (filterSprints, hasActiveSprintFilters, extractAvailableProjects)
│   └── __tests__/
│       └── sprint-filter.test.ts                       # NEW: Unit tests for filter logic
├── components/
│   ├── SprintFilterBar.tsx                             # NEW: Filter bar component
│   ├── UnifiedSprintView.tsx                           # MODIFY: Add filter state, SprintFilterBar, filtered rendering
│   └── __tests__/
│       ├── SprintFilterBar.test.tsx                    # NEW: Component tests for filter bar
│       └── UnifiedSprintView.test.tsx                  # MODIFY: Add tests for filter integration
```

### Testing Strategy

**Unit tests (sprint-filter.test.ts):**
- `filterSprints` returns all sprints when no filters active
- `filterSprints` filters by status (active, completed, planning)
- `filterSprints` filters by health (on-track, at-risk, blocked)
- `filterSprints` filters by projectId
- `filterSprints` filters by dateRange with both dates set (overlap logic)
- `filterSprints` filters by dateRange with only start date set
- `filterSprints` filters by dateRange with only end date set
- `filterSprints` excludes sprints without dates when dateRange is active
- `filterSprints` combines multiple filters (AND logic)
- `filterSprints` returns empty array when no matches
- `filterSprints` returns all sprints when filter has all null fields
- `hasActiveSprintFilters` returns false for empty filters
- `hasActiveSprintFilters` returns true when status is set
- `hasActiveSprintFilters` returns true when health is set
- `hasActiveSprintFilters` returns true when projectId is set
- `hasActiveSprintFilters` returns true when dateRange is set
- `extractAvailableProjects` returns unique projects sorted by name
- `extractAvailableProjects` returns empty array for no sprints
- `extractAvailableProjects` deduplicates same project appearing in multiple sprints

**Component tests (SprintFilterBar.test.tsx):**
- Renders status, health, project dropdowns and date inputs
- Changing status dropdown calls `onFiltersChange` with correct status
- Changing health dropdown calls `onFiltersChange` with correct health
- Changing project dropdown calls `onFiltersChange` with correct projectId
- Setting start date calls `onFiltersChange` with dateRange containing start
- Setting end date calls `onFiltersChange` with dateRange containing end
- Clearing a date input removes that end of the range
- "Clear filters" button calls `onFiltersChange` with EMPTY_SPRINT_FILTERS
- "Clear filters" button is hidden when no filters active
- Displays correct "Showing X of Y sprints" count
- Has accessible labels on all controls

**Integration tests (UnifiedSprintView.test.tsx updates):**
- SprintFilterBar is rendered within the view
- Summary cards show filtered metrics after applying a filter
- Sprint grid shows only filtered sprints after applying a filter
- Clearing filters restores full view with all sprints
- Empty state shows when all sprints are filtered out

### NFRs

- **NFR-F5-1:** Filtering is client-side (instant, no server round-trip). No impact on 2-second page load.
- **NFR-F5-2:** Real-time updates continue to work — SSE pushes new data via `initialSprints` prop changes (handled by existing patterns).
- **NFR-P1:** `filterSprints` is a pure function operating on in-memory data — O(n) where n = number of sprints (typically < 50).

### Pre-existing Types (Do NOT modify)

- `UnifiedSprintEntry` — do not modify, only READ for filter comparisons
- `UnifiedSprintSummary` — do not modify, only recompute via `computeSprintSummary(filteredSprints)`
- `SprintHealthStatus` — do not modify, use as filter option type
- `FilterState` (portfolio) — do not modify, create separate `SprintFilterState`
- `computeSprintSummary()` — do not modify, call on filtered data
- `aggregateUnifiedSprints()` — do not modify

### References

- [Source: epics-cycle-10.md#Epic 53 Story 53.5] — Story definition and ACs
- [Source: prd-cycle-10.md#FR-F5-4] — "Filtering by project tags, sprint status, date range, owner/assignee" requirement
- [Source: prd-cycle-10.md#FR-F5-5] — "Sprint metrics aggregate across selected projects" requirement
- [Source: prd-cycle-10.md#NFR-F5-1] — Page loads within 2 seconds
- [Source: prd-cycle-10.md#NFR-F5-2] — Real-time updates within 3 seconds
- [Source: _bmad-output/implementation-artifacts/53-3-at-risk-sprint-identification.md] — Previous story patterns and Dev Notes
- [Source: _bmad-output/implementation-artifacts/53-4-cross-project-velocity-comparison.md] — Sibling story (may affect mocks)
- [Source: packages/web/src/components/PortfolioFilterBar.tsx] — Reference pattern for SprintFilterBar
- [Source: packages/web/src/lib/portfolio-filter.ts] — Reference pattern for sprint-filter.ts
- [Source: packages/web/src/lib/unified-sprint-aggregation.ts] — Existing aggregation to use for filtered summary
- [Source: packages/web/src/lib/types.ts] — Types to extend with SprintFilterState
- [Source: packages/web/src/components/UnifiedSprintView.tsx] — Component to modify for filter integration

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- New files: `sprint-filter.ts`, `SprintFilterBar.tsx`, and their tests
- Modified files: `types.ts`, `UnifiedSprintView.tsx`, `UnifiedSprintView.test.tsx`
- All existing tests must continue to pass (no regressions)
- This is the FINAL story in Epic 53 — after completion, epic-53 status can be set to `done`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No debug sessions required — all implementations were straightforward.

### Completion Notes List

- All 5 tasks completed with no blockers
- Pure function pattern followed for `filterSprints`, `hasActiveSprintFilters`, `extractAvailableProjects`
- SprintFilterBar follows PortfolioFilterBar pattern exactly with status, health, project, date range controls
- UnifiedSprintView transitions from stateless to stateful with `useState<SprintFilterState>`
- Summary cards recompute from filtered sprints using `computeSprintSummary(filteredSprints)`
- All 1888 tests passing after implementation + review fixes (156 test files)
- Project dropdown hidden when only one project available

### Code Review (2026-04-03)

**Reviewer:** Adversarial Code Review (Claude Opus 4.6)
**Issues Found:** 2 High, 4 Medium, 3 Low — all fixed

- **H1+H2 Fixed:** `hasActiveSprintFilters` now detects phantom `dateRange: { start: "", end: "" }` as inactive. Added test coverage.
- **M1 Fixed:** Removed redundant local variable aliases in `filterSprints` — uses `sprint.startDate`/`sprint.endDate` directly.
- **M2 Fixed:** SprintCard now uses composite key `${sprint.projectId}-${sprint.sprintName}` to prevent key collisions.
- **M3 Fixed:** Filter value handlers in SprintFilterBar now validate against known option values before setting on state.
- **L1 Fixed:** Consistent variable naming in date range comparison.
- **L2 Fixed:** STATUS_OPTIONS and HEALTH_OPTIONS typed via `as const` with runtime validation.
- **L3 Fixed:** Test "Clear filters" and "filtered count" tests now use `{ ...EMPTY_SPRINT_FILTERS, status: "active" }` spread pattern for future-proofing.

### Limitations (Deferred Items)

1. Owner/assignee filtering
   - Status: Deferred - Requires owner/assignee field in data model
   - Requires: `owner: string | null` field on `UnifiedSprintEntry`, sourced from project config or tracker
   - Current: Filter supports status, health, project, and date range only
2. Tag-based filtering
   - Status: Deferred - Requires tags on sprint entries
   - Requires: `tags: string[]` field on `UnifiedSprintEntry` from project config
   - Current: No tag metadata on sprint entries

### File List

**Modified:**
- `packages/web/src/lib/types.ts` — Added `SprintFilterState` interface and `EMPTY_SPRINT_FILTERS` constant
- `packages/web/src/components/UnifiedSprintView.tsx` — Added filter state, SprintFilterBar, useMemo for filtered sprints/summary
- `packages/web/src/components/__tests__/UnifiedSprintView.test.tsx` — Added SprintFilterBar integration tests

**Created:**
- `packages/web/src/lib/sprint-filter.ts` — Sprint filtering utilities (filterSprints, hasActiveSprintFilters, extractAvailableProjects)
- `packages/web/src/lib/__tests__/sprint-filter.test.ts` — 24 unit tests for filter logic
- `packages/web/src/components/SprintFilterBar.tsx` — Filter bar component with status, health, project, date range controls
- `packages/web/src/components/__tests__/SprintFilterBar.test.tsx` — 12 component tests
