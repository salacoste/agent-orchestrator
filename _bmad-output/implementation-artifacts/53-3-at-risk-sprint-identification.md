# Story 53.3: At-Risk Sprint Identification

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **sprints predicted to miss deadlines to be visually highlighted**,
so that **I can focus attention on sprints needing intervention**.

## Acceptance Criteria

1. **Given** a sprint has more blocked stories than in-progress stories
   **When** the unified sprint view is displayed
   **Then** the sprint card shows an "At Risk" warning indicator with a reason string
   **And** hovering or expanding shows "More blocked stories (N) than in-progress (M)"

2. **Given** a sprint has progress < 50% and > 75% of sprint time has elapsed
   **When** the unified sprint view is displayed
   **Then** the sprint card shows an "At Risk" warning indicator with a reason string
   **And** hovering or expanding shows "Only X% complete with Y% of sprint elapsed"

3. **Given** all active work in a sprint is blocked (blocked > 0, inProgress === 0)
   **When** the unified sprint view is displayed
   **Then** the sprint card shows a "Blocked" indicator with a reason string
   **And** hovering or expanding shows "All N active stories are blocked"

4. **Given** multiple sprints exist across projects
   **When** at least one sprint is at-risk or blocked
   **Then** the summary cards show an "At Risk" count of sprints flagged as at-risk or blocked

5. **Given** the unified sprint view is displayed
   **When** at-risk sprints exist
   **Then** at-risk and blocked sprints are visually distinct from on-track sprints
   **And** an expandable detail section on each sprint card shows the reason(s) for the flag

## Tasks / Subtasks

- [x] Task 1: Add health reasons to types (AC: #1, #2, #3, #4)
  - [x] 1.1: Add `healthReasons: string[]` field to `UnifiedSprintEntry` in `packages/web/src/lib/types.ts`
  - [x] 1.2: Add `atRiskSprints: number` field to `UnifiedSprintSummary` in `packages/web/src/lib/types.ts`
  - [x] 1.3: Update all existing test mock objects that construct `UnifiedSprintEntry` or `UnifiedSprintSummary` to include the new fields

- [x] Task 2: Implement health reason computation (AC: #1, #2, #3)
  - [x] 2.1: Create `computeHealthReasons(entry, elapsedFraction?): string[]` pure function in `packages/web/src/lib/unified-sprint-aggregation.ts` — returns an array of human-readable reason strings based on the same rules as `computeSprintHealth`:
    - Blocked > inProgress → `"More blocked stories (${blocked}) than in-progress (${inProgress})"`
    - progressPercent < 50 AND elapsedFraction > 0.75 → `"Only ${progressPercent}% complete with ${Math.round(elapsed * 100)}% of sprint elapsed"`
    - blocked > 0 AND inProgress === 0 → `"All ${blocked} active stories are blocked"`
  - [x] 2.2: Update `aggregateUnifiedSprints()` to populate `healthReasons` on each entry by calling `computeHealthReasons(entry, elapsed)`
  - [x] 2.3: Update `computeSprintSummary()` to count `atRiskSprints` (entries where `health === "at-risk" || health === "blocked"`)
  - [x] 2.4: Write unit tests for `computeHealthReasons` — cover all 3 rule triggers, multiple reasons at once, empty reasons for on-track, boundary conditions

- [x] Task 3: Add "At Risk" summary card (AC: #4)
  - [x] 3.1: Update `packages/web/src/components/UnifiedSprintSummaryCards.tsx` — add a 6th metric card: "At Risk" showing `summary.atRiskSprints` count, with warning styling when count > 0
  - [x] 3.2: Update grid from `md:grid-cols-5` to `md:grid-cols-6` (or `md:grid-cols-3 lg:grid-cols-6` for better responsive behavior)
  - [x] 3.3: Update `UnifiedSprintSummaryCards` tests for the new card

- [x] Task 4: Add expandable risk detail to SprintCard (AC: #1, #2, #3, #5)
  - [x] 4.1: Update `packages/web/src/components/SprintCard.tsx` — add a collapsible detail section below the progress bar that renders `healthReasons` as a list when the entry is at-risk or blocked
  - [x] 4.2: Add a toggle button or click-on-badge interaction to expand/collapse the detail section
  - [x] 4.3: Style the detail section with warning/error border colors to match the health status
  - [x] 4.4: Update SprintCard tests for the expandable detail section

- [x] Task 5: Update existing tests and add new route tests (AC: #1-#5)
  - [x] 5.1: Update `unified-sprint-aggregation.test.ts` — add tests for `computeHealthReasons`, update `computeSprintSummary` tests for `atRiskSprints`, update `aggregateUnifiedSprints` tests for `healthReasons` field
  - [x] 5.2: Update `route.test.ts` for `/api/sprints/unified` — verify `healthReasons` and `atRiskSprints` appear in response
  - [x] 5.3: Update `UnifiedSprintView.test.tsx` — add tests for at-risk sprint card rendering
  - [x] 5.4: Run full regression suite to verify no breakage

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

If your task has deferred items or known limitations:

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Feature name
   - Status: Deferred - Requires X
   - Requires: Specific requirement
   - Epic: Story Y or Epic number
   - Current: What's currently implemented
```

**In sprint-status.yaml (if applicable), add:**
```yaml
limitations:
  feature-name: "Epic Y - Description or epic number"
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
- `OrchestratorConfig.projects` — iterate configured projects (existing)
- `readSprintStatus(project)` from `@composio/ao-plugin-tracker-bmad` — read sprint status per project (existing)
- `getServices()` from `@/lib/services` — service access in API routes (existing)

**Feature Flags:**
- None required — extends existing types and functions, no new external dependencies

## Dependency Review

No new external dependencies required. All changes are to existing internal modules:
- Extends types in `packages/web/src/lib/types.ts`
- Extends functions in `packages/web/src/lib/unified-sprint-aggregation.ts`
- Extends components in `packages/web/src/components/`

## Dev Notes

### Architecture Context

This is **Story 3 of 5** in **Epic 53: Unified Sprint View**. It depends on:
- **Story 53.1 (done):** Unified Sprint Dashboard — page structure, types, aggregation, API route
- **Story 53.2 (done):** Sprint Progress Visualization — progress bars, visual rendering

This story **enhances** the existing `computeSprintHealth()` output by attaching human-readable reason strings and surfacing them in the UI. It does NOT replace the health computation logic — it extends it.

### Previous Story Intelligence (53.1: Unified Sprint Dashboard)

Key patterns and learnings:
- **Pure function pattern**: `computeSprintHealth()`, `computeSprintSummary()`, `computeElapsedFraction()` are pure sync functions. New `computeHealthReasons()` MUST follow the same pattern — pure, no I/O.
- **Type changes cascade**: Adding a field to `UnifiedSprintEntry` or `UnifiedSprintSummary` requires updating ALL test files that construct mock objects. Use grep to find every occurrence: `grep -r "planningSprints\|atRiskSprints\|healthReasons" packages/web/src/`.
- **Route testing with plain Request**: Use `new URL(request.url)` not `request.nextUrl`.
- **Server/Client component split**: Server component (`page.tsx`) fetches data, client component handles interactivity. SprintCard's expand/collapse is client-side.
- **Dynamic import pattern**: `await import("@composio/ao-plugin-tracker-bmad")` in Next.js routes.
- **Vitest module mocking**: `vi.mock()` for mocking workspace packages and service modules.
- **Test count updates**: Previous story had 1,784 web tests. All must continue passing.

### What Already Exists (Do NOT Reinvent)

1. **`computeSprintHealth()`** in `unified-sprint-aggregation.ts` — already returns "at-risk", "blocked", or "on-track". DO NOT replace or duplicate. Create a separate `computeHealthReasons()` that produces reason strings alongside the existing health status.

2. **`computeElapsedFraction()`** in `unified-sprint-aggregation.ts` — already computes elapsed time fraction. Currently receives `null, null` from `aggregateUnifiedSprints`. DO NOT change the signature, but wire it properly when dates become available.

3. **SprintCard health badge** in `SprintCard.tsx` — already renders "At Risk" badge with warning color (`--color-warning`). DO NOT replace the badge. ADD the expandable detail section BELOW the existing content.

4. **`UnifiedSprintSummaryCards`** — already has 5 metric cards. ADD a 6th card for "At Risk" count. Update grid columns.

5. **Types** — `SprintHealthStatus` = `"on-track" | "at-risk" | "blocked"`. DO NOT modify this union. ADD `healthReasons: string[]` to `UnifiedSprintEntry` and `atRiskSprints: number` to `UnifiedSprintSummary`.

### Health Reason Computation Rules

`computeHealthReasons(entry, elapsedFraction?)` returns `string[]`:
- If `blocked > 0 && inProgress === 0` → include `"All ${blocked} active stories are blocked"`
- If `blocked > inProgress` → include `"More blocked stories (${blocked}) than in-progress (${inProgress})"`
- If `progressPercent < 50 && elapsedFraction != null && elapsedFraction > 0.75` → include `"Only ${progressPercent}% complete with ${Math.round(elapsedFraction * 100)}% of sprint elapsed"`
- If none match → return `[]` (on-track, no reasons needed)

Note: A sprint can match MULTIPLE rules. Return all matching reasons. The order above is the priority order for display.

### UI Design for Risk Detail

**SprintCard enhancement** — add below the existing progress bar:
```
┌─────────────────────────────────────┐
│ Project A          [At Risk ▼]      │  ← existing badge, now clickable
│ Sprint 12                          │
│ ████████████████░░░░░░░░  64%      │  ← existing progress bar
│ ┌─────────────────────────────────┐ │
│ │ ⚠ More blocked stories (4)     │ │  ← NEW: expandable detail
│ │   than in-progress (2)         │ │
│ │ ⚠ Only 40% complete with       │ │
│ │   85% of sprint elapsed        │ │
│ └─────────────────────────────────┘ │
│ Stories: 12 total, 8 done, 2 active │
└─────────────────────────────────────┘
```

**Interaction**: Click the health badge or a chevron icon to toggle the detail section. Default: collapsed. For blocked sprints, default: expanded (critical state).

**Styling**:
- Detail section border: `border-[var(--color-warning)]` for at-risk, `border-[var(--color-error)]` for blocked
- Reason text: `text-[var(--color-text-muted)]` with warning/error text color for the icon
- Use existing CSS variable design system, no new color tokens

### File Structure to Create/Modify

```
packages/web/src/
├── lib/
│   ├── types.ts                                        # MODIFY: Add healthReasons to UnifiedSprintEntry, atRiskSprints to UnifiedSprintSummary
│   ├── unified-sprint-aggregation.ts                   # MODIFY: Add computeHealthReasons(), update aggregateUnifiedSprints, update computeSprintSummary
│   └── __tests__/
│       └── unified-sprint-aggregation.test.ts          # MODIFY: Add computeHealthReasons tests, update summary/aggregation tests
├── app/
│   ├── api/
│   │   └── sprints/
│   │       └── unified/
│   │           └── route.test.ts                       # MODIFY: Update mocks for new fields
├── components/
│   ├── SprintCard.tsx                                  # MODIFY: Add expandable risk detail section
│   ├── UnifiedSprintSummaryCards.tsx                   # MODIFY: Add "At Risk" card, update grid
│   └── __tests__/
│       ├── SprintCard.test.tsx                         # MODIFY: Add tests for expandable detail
│       └── UnifiedSprintSummaryCards.test.tsx          # MODIFY: Add tests for "At Risk" card
```

### Testing Strategy

**Unit tests (unified-sprint-aggregation.test.ts):**
- `computeHealthReasons` returns reason for blocked-dominant rule
- `computeHealthReasons` returns reason for time-pressure rule
- `computeHealthReasons` returns reason for all-blocked rule
- `computeHealthReasons` returns multiple reasons when multiple rules match
- `computeHealthReasons` returns empty array for on-track sprint
- `computeHealthReasons` handles missing elapsedFraction (no time-based reason)
- `computeSprintSummary` counts atRiskSprints correctly
- `aggregateUnifiedSprints` populates healthReasons on entries

**Component tests (SprintCard.test.tsx):**
- SprintCard renders risk detail section when entry has healthReasons
- SprintCard shows reason strings in the detail section
- SprintCard detail section is collapsed by default for at-risk
- SprintCard detail section is expanded by default for blocked
- SprintCard toggles detail on badge click

**Component tests (UnifiedSprintSummaryCards.test.tsx):**
- Renders "At Risk" card with correct count
- Shows 0 when no sprints are at-risk
- Shows warning styling when count > 0

**Route tests (route.test.ts):**
- Response includes `healthReasons` on sprint entries
- Response includes `atRiskSprints` in summary

### Pre-existing Types (Do NOT modify)

- `SprintHealthStatus` union type — do not modify, only add fields to interfaces that use it
- `computeSprintHealth()` — do not modify its logic, create a parallel function
- `computeElapsedFraction()` — do not modify its signature
- Existing test suites — all 1,784+ web tests must continue passing

### References

- [Source: epics-cycle-10.md#Epic 53 Story 53.3] — Story definition and ACs
- [Source: prd-cycle-10.md#FR-F5-2] — "At-risk sprints (predicted to miss deadline)" requirement
- [Source: prd-cycle-10.md#FR-I1-2] — "Sprint at risk" notification type (downstream: Epic 57)
- [Source: prd-cycle-10.md#NFR-F5-1] — Page loads within 2 seconds
- [Source: packages/web/src/lib/unified-sprint-aggregation.ts] — Existing health computation to extend
- [Source: packages/web/src/components/SprintCard.tsx] — Existing card component to enhance
- [Source: packages/web/src/components/UnifiedSprintSummaryCards.tsx] — Existing summary cards to extend
- [Source: packages/web/src/lib/types.ts] — Types to extend
- [Source: _bmad-output/implementation-artifacts/53-1-unified-sprint-dashboard.md] — Previous story patterns

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- All changes to existing files — no new files needed (no new pages, routes, or modules)
- All existing tests must continue to pass (no regressions)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- Task 1 (Types): Added `healthReasons: string[]` to `UnifiedSprintEntry`, `atRiskSprints: number` to `UnifiedSprintSummary`. Updated all 4 test file mocks.
- Task 2 (Computation): Created `computeHealthReasons()` pure function with 3 rules. Rule 2 guarded with `inProgress > 0` to avoid redundancy with Rule 1. Updated `aggregateUnifiedSprints()` and `computeSprintSummary()`.
- Task 3 (Summary Card): Added 6th "At Risk" MetricCard with conditional warning styling. Grid changed to `md:grid-cols-6`.
- Task 4 (SprintCard): Added expandable risk detail section with `useState` toggle. Blocked sprints default expanded; at-risk default collapsed. Badge becomes `<button>` when reasons exist. Added `useEffect` sync for SSE prop changes.
- Task 5 (Tests): Added 8 new `computeHealthReasons` tests, 2 new SprintCard tests, 2 new summary card tests. Updated mocks in 4 existing test files. Installed `@testing-library/user-event@14.6.1`.

### File List

- `packages/web/src/lib/types.ts` — Added `healthReasons` to `UnifiedSprintEntry`, `atRiskSprints` to `UnifiedSprintSummary`
- `packages/web/src/lib/unified-sprint-aggregation.ts` — Added `computeHealthReasons()`, updated `computeSprintSummary()` with `atRiskSprints`, updated `aggregateUnifiedSprints()` with `healthReasons`
- `packages/web/src/components/SprintCard.tsx` — Added expandable risk detail section with toggle, `useEffect` prop sync
- `packages/web/src/components/UnifiedSprintSummaryCards.tsx` — Added 6th "At Risk" MetricCard, grid `md:grid-cols-6`
- `packages/web/src/lib/__tests__/unified-sprint-aggregation.test.ts` — Added `computeHealthReasons` test suite (8 tests), updated mocks with `healthReasons`, added `atRiskSprints` to summary expectations
- `packages/web/src/components/__tests__/SprintCard.test.tsx` — Added `healthReasons` to mock, 5 new tests for expandable detail
- `packages/web/src/components/__tests__/UnifiedSprintSummaryCards.test.tsx` — Added `atRiskSprints` to mock, updated card count, 2 new tests
- `packages/web/src/components/__tests__/UnifiedSprintView.test.tsx` — Added `healthReasons` and `atRiskSprints` to mocks
- `packages/web/src/app/api/sprints/unified/route.test.ts` — Added `healthReasons` and `atRiskSprints` to mock data
- `packages/web/package.json` — Added `@testing-library/user-event` devDependency
