# Story 54.4: Side-by-Side Scenario Comparison

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **to compare multiple scenarios side-by-side**,
so that **I can choose the best strategy based on trade-offs**.

## Acceptance Criteria

1. **Given** I have 2+ scenarios with simulation results (status "simulated")
   **When** I navigate to the scenarios list page
   **Then** I see a "Compare" action available when multiple simulated scenarios exist

2. **Given** I select 2-4 simulated scenarios for comparison
   **When** I click "Compare Selected"
   **Then** a comparison view renders showing all selected scenarios side-by-side
   **And** each scenario shows its key metrics (p50/p80/p95 days, on-time probability, confidence)
   **And** scenarios are ranked by on-time probability (highest first)

3. **Given** the comparison view is displayed
   **When** I examine the metrics
   **Then** the best value for each metric is visually highlighted
   **And** the recommended scenario is marked with a badge/indicator
   **And** differences between scenarios are clearly visible

4. **Given** the comparison view shows ranked scenarios
   **When** I look at the ranking
   **Then** the rank number is displayed for each scenario (1, 2, 3...)
   **And** the recommended scenario (rank 1) has a "Recommended" badge
   **And** each scenario shows a color indicator (green/amber/red) based on on-time probability

5. **Given** I have fewer than 2 simulated scenarios
   **When** the scenarios list page renders
   **Then** the "Compare" button is disabled or hidden
   **And** I see a hint that I need at least 2 simulated scenarios to compare

6. **Given** I attempt to compare scenarios where some have no simulation results
   **When** the comparison is attempted
   **Then** those scenarios are excluded with a warning message
   **And** only scenarios with valid results are included in the comparison

## Tasks / Subtasks

- [x] Task 1: Create comparison mapping utility (AC: #2, #3, #4)
  - [x] 1.1: Create `packages/web/src/lib/scenario-comparison.ts` with `mapToComparableScenarios()` function
  - [x] 1.2: Map `WhatIfScenario[]` → core `Scenario[]` (extract name, storyCount, result)
  - [x] 1.3: Create `getBestMetricIndex()` helper to identify best value per metric across scenarios
  - [x] 1.4: Write unit tests in `packages/web/src/lib/__tests__/scenario-comparison.test.ts`

- [x] Task 2: Add GET compare API route (AC: #2, #5, #6)
  - [x] 2.1: Create `packages/web/src/app/api/scenarios/compare/route.ts` — GET handler with `?ids=id1,id2,...` query param
  - [x] 2.2: Validate 2-4 IDs provided, all exist, all have "simulated" status with results
  - [x] 2.3: Call `mapToComparableScenarios()` then `compareScenarios()` from core
  - [x] 2.4: Return `ScenarioComparison` with mapped web-layer data
  - [x] 2.5: Write route tests in `packages/web/src/app/api/scenarios/compare/route.test.ts`

- [x] Task 3: Add multi-select and compare trigger to ScenariosView (AC: #1, #5)
  - [x] 3.1: Add checkbox/select state to ScenarioCard for multi-selection
  - [x] 3.2: Add "Compare Selected (N)" button to ScenariosView header
  - [x] 3.3: Disable compare when < 2 simulated scenarios selected, or when non-simulated scenarios selected
  - [x] 3.4: On click, navigate to `/scenarios/compare?ids=id1,id2,...`
  - [x] 3.5: Update ScenarioCard and ScenariosView tests

- [x] Task 4: Create ScenarioComparisonView component and page (AC: #2, #3, #4)
  - [x] 4.1: Create `packages/web/src/components/ScenarioComparisonView.tsx` — client component
  - [x] 4.2: Fetch comparison data from GET `/api/scenarios/compare?ids=...` on mount
  - [x] 4.3: Render side-by-side columns for each ranked scenario with p50/p80/p95, probability, confidence
  - [x] 4.4: Highlight best metric per row (lowest days, highest probability, highest confidence)
  - [x] 4.5: Show rank number, color badge (green/amber/red), and "Recommended" badge for rank 1
  - [x] 4.6: Handle loading, error, and insufficient-data states
  - [x] 4.7: Create page at `packages/web/src/app/scenarios/compare/page.tsx`
  - [x] 4.8: Write component tests in `packages/web/src/components/__tests__/ScenarioComparisonView.test.tsx`

- [x] Task 5: Run full regression suite and verify no breakage (AC: all)
  - [x] 5.1: Run `pnpm --filter @composio/ao-web test` — verify all tests pass
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
1. Scenario persistence
   - Status: Deferred - Requires file-based storage
   - Requires: Story 54.5 (Scenario Persistence and History)
   - Epic: Story 54.4 / Epic 54
   - Current: Comparison works with in-memory scenarios only (lost on server restart)
2. Apply-to-production from comparison
   - Status: Deferred - Requires apply API route
   - Requires: Story 54.6 (Apply Scenario to Production)
   - Epic: Story 54.4 / Epic 54
   - Current: Comparison is view-only; applying requires separate flow
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
- `getScenario(id)` from `@/lib/scenario-store` — READ scenarios for comparison
- `compareScenarios(scenarios)` from `@composio/ao-core` — RUN comparison ranking
- `Scenario`, `RankedScenario`, `ScenarioComparison` from `@composio/ao-core` — TYPES for comparison
- `getSimulationColor()` from `@composio/ao-core` — MAP probability to color

**Feature Flags:**
- None required — comparison is purely additive

## Dependency Review

No new external dependencies required. All changes use existing internal modules:
- `compareScenarios` from `@composio/ao-core` (already built in Story 48.3)
- `Scenario`, `RankedScenario`, `ScenarioComparison` from `@composio/ao-core`
- React `useState`, `useEffect`, `useSearchParams` for client-side state
- Existing CSS custom properties for styling
- Vitest for testing

## Dev Notes

### Architecture Context

This is **Story 4 of 6** in **Epic 54: What-If Simulation Engine**. It is the final story in the Intelligence phase (Cycle 10 Phase 2).

**Story 54.1 (done) created:**
- `WhatIfScenario` type with stories snapshot
- In-memory scenario store (`scenario-store.ts`)
- API routes: `GET/POST /api/scenarios`, `GET/DELETE /api/scenarios/[id]`
- Components: `ScenarioCreator`, `ScenarioCard`, `ScenariosView`
- Page: `/scenarios` with scenario creation form and card grid

**Story 54.2 (done) added:**
- `ScenarioParameters` type and `parameters` field on `WhatIfScenario`
- `PATCH /api/scenarios/[id]` for updating parameters
- Scenario detail page at `/scenarios/[id]` with parameter editor
- Parameter validation and diff computation utilities
- Story priority override controls
- Shared helpers in `scenario-helpers.ts`

**Story 54.3 (done) added:**
- Simulation execution via `simulateSprint()` from core
- `POST /api/scenarios/[id]/simulate` route
- Parameter-to-simulation mapping utility
- "Run Simulation" button and results display in ScenarioDetail
- Status transition: `"draft"` → `"simulated"`

**This story (54.4) adds:**
- Side-by-side comparison using `compareScenarios()` from core (Story 48.3)
- `GET /api/scenarios/compare?ids=id1,id2,...` route
- Multi-select checkboxes on ScenariosView
- ScenarioComparisonView component with ranked metrics
- Page at `/scenarios/compare`

**Story 54.5 (next) will add:**
- File-based scenario persistence
- Scenario history and revision tracking

### Previous Story Intelligence (Story 54.3)

**Key patterns established:**

1. **Pure function pattern**: `mapToComparableScenarios()` MUST be a pure sync function — no I/O, deterministic output from input. Follows same pattern as `buildSimulationInput()` and `applyParallelismScaling()`.

2. **Server/Client component split**: The comparison page is a server component that reads search params, passes IDs to a client component. The client component fetches comparison data via API.

3. **API route pattern**: Use `new URL(request.url)` not `request.nextUrl`. Export `dynamic = "force-dynamic"`. Return `NextResponse.json(...)`. Follow the GET pattern from existing routes.

4. **CSS variable design system**: Use `--color-success`, `--color-warning`, `--color-error`, `--color-text-muted`, `--color-border`, `--color-text-primary`, `--color-accent`. Do NOT introduce new color tokens.

5. **Component testing**: Use `@testing-library/react` with `screen`, `within`, `fireEvent`/`userEvent`. Wrap async clicks in `act()`.

6. **`ScenarioStatus` lifecycle**: `"draft"` → `"simulated"` (Story 54.3) → `"applied"` (54.6). Comparison only works with `"simulated"` or `"applied"` scenarios that have `result` populated.

7. **Type mapping layer**: The core `compareScenarios()` expects `Scenario[]` with `{ name, storyCount, result }`. The web `WhatIfScenario` has different fields. Create a thin mapping function.

### What Already Exists (Do NOT Reinvent)

1. **`compareScenarios()` from core** — Pure function in `packages/core/src/scenario-comparator.ts`. Takes `Scenario[]`, returns `ScenarioComparison`. Built in Story 48.3. Do NOT reimplement comparison logic.

2. **`Scenario` type from core** — `{ name: string; storyCount: number; result: SimulationResult }`. This is the INPUT type for `compareScenarios()`.

3. **`RankedScenario` type from core** — Extends `Scenario` with `rank`, `color`, `isRecommended`. This is the OUTPUT type for comparison display.

4. **`ScenarioComparison` type from core** — `{ scenarios: RankedScenario[]; recommendedIndex: number }`.

5. **`getSimulationColor()` from core** — Maps onTimeProbability to green/amber/red. Already used in `ScenarioDetail` for probability coloring.

6. **`scenario-store.ts`** — Has `getScenario(id)` to fetch individual scenarios. Use it to load selected scenarios for comparison.

7. **`ScenariosView.tsx`** — Already renders grid of `ScenarioCard` components. ADD multi-select and compare button. Do NOT rewrite.

8. **`ScenarioCard.tsx`** — Already has Open/Delete actions. ADD checkbox for multi-select.

9. **`ScenarioDetail.tsx`** — Already renders simulation results (p50/p80/p95, probability, confidence). Use same metric display patterns in comparison view.

10. **`scenario-helpers.ts`** — Shared `statusBadgeColor()` and `statusLabel()`. Use for scenario status display in comparison.

11. **`confidenceLabel()` and `probabilityColor()`** — Module-level functions in `ScenarioDetail.tsx`. These may need to be extracted to `scenario-helpers.ts` or duplicated. Prefer extraction for DRY, but if coupling concerns arise, inline in comparison component is acceptable.

### Comparison Mapping Design

`mapToComparableScenarios(scenarios: WhatIfScenario[]): Scenario[]`

**Input:** Array of WhatIfScenario objects (all with `result` populated)
**Output:** Array of core `Scenario` objects ready for `compareScenarios()`

**Mapping logic:**

```
WhatIfScenario → Scenario:
  name: scenario.name
  storyCount: scenario.stories.length
  result: scenario.result (already SimulationResult)
```

**Validation:**
- Filter out scenarios without `result` (return warning list)
- Filter out scenarios with status "draft" (not yet simulated)
- Throw if fewer than 2 valid scenarios remain

**`getBestMetricIndex()` helper:**
- For day-based metrics (p50, p80, p95): lowest value wins
- For probability: highest value wins
- For confidence: highest value wins
- Returns index of best scenario for each metric

### API Design for GET compare

```
GET /api/scenarios/compare?ids=id1,id2,id3 → { comparison: ScenarioComparison, warnings: string[] } | 400 | 404

  - Parse `ids` query param (comma-separated)
  - Validate 2-4 IDs provided
  - Fetch each scenario via getScenario()
  - Return 400 if < 2 or > 4 IDs
  - Return 404 error listing which IDs not found
  - Return 400 with warning if any scenario lacks results
  - Call mapToComparableScenarios() → compareScenarios()
  - Return full ScenarioComparison with warnings array
```

### ScenarioComparisonView UI Design

**Layout:** Responsive side-by-side columns (2-4 scenarios)

**Per-scenario column:**
- Scenario name (header)
- Rank badge (#1, #2, etc.)
- "Recommended" badge for rank 1
- Color indicator (green/amber/red dot)

**Metrics table (rows):**
| Metric | Scenario A | Scenario B | Scenario C |
|--------|-----------|-----------|-----------|
| p50 Days | 5.0 | **3.2** ✓ | 4.1 |
| p80 Days | 7.0 | **4.5** ✓ | 5.8 |
| p95 Days | 10.0 | **6.8** ✓ | 8.2 |
| On-Time % | 85% | **92%** ✓ | 78% |
| Confidence | High | **High** | Medium |

- Best value per row highlighted with `--color-success` and checkmark
- Color indicator uses `getSimulationColor()` result mapped to CSS variable

**Navigation:**
- "Back to Scenarios" link at top
- Each scenario name links to its detail page

### File Structure to Create/Modify

```
packages/web/src/
├── lib/
│   ├── scenario-comparison.ts                    # NEW: mapToComparableScenarios(), getBestMetricIndex()
│   └── __tests__/
│       └── scenario-comparison.test.ts           # NEW: Unit tests for mapping logic
├── app/
│   ├── api/
│   │   └── scenarios/
│   │       └── compare/
│   │           ├── route.ts                      # NEW: GET handler for comparison
│   │           └── route.test.ts                 # NEW: Route tests
│   └── scenarios/
│       └── compare/
│           └── page.tsx                          # NEW: Comparison page (server component)
├── components/
│   ├── ScenarioComparisonView.tsx                # NEW: Comparison display component
│   ├── ScenariosView.tsx                         # MODIFY: Add multi-select state, compare button
│   ├── ScenarioCard.tsx                          # MODIFY: Add checkbox prop for selection
│   └── __tests__/
│       ├── ScenarioComparisonView.test.tsx       # NEW: Comparison component tests
│       ├── ScenariosView.test.tsx                # MODIFY: Add comparison tests
│       └── ScenarioCard.test.tsx                 # MODIFY: Add checkbox tests
```

### Testing Strategy

**Unit tests (scenario-comparison.test.ts):** ~10 tests
- `mapToComparableScenarios` converts WhatIfScenario[] to Scenario[]
- `mapToComparableScenarios` filters out scenarios without results
- `mapToComparableScenarios` filters out draft scenarios
- `mapToComparableScenarios` throws if fewer than 2 valid scenarios
- `getBestMetricIndex` returns index of lowest days value
- `getBestMetricIndex` returns index of highest probability
- `getBestMetricIndex` handles ties (returns first)
- `mapToComparableScenarios` maps all scenarios correctly with 3 inputs

**API route tests (compare/route.test.ts):** ~7 tests
- GET returns comparison for 2 valid scenarios
- GET returns comparison for 4 valid scenarios
- GET returns 400 for fewer than 2 IDs
- GET returns 400 for more than 4 IDs
- GET returns 404 when scenario not found
- GET returns warnings for scenarios without results
- GET returns ranked scenarios in correct order

**Component tests (ScenarioComparisonView.test.tsx):** ~8 tests
- Renders loading state
- Renders comparison with ranked scenarios
- Highlights best metric per row
- Shows "Recommended" badge for rank 1
- Shows color indicators per scenario
- Handles error state
- Each scenario name links to detail page
- Shows "Back to Scenarios" link

**ScenariosView tests:** ~3 new tests
- Shows "Compare" button when simulated scenarios exist
- Compare button disabled when < 2 selected
- Selecting scenarios enables compare button

**ScenarioCard tests:** ~2 new tests
- Renders checkbox when selectable prop is true
- Checkbox click fires onToggle callback

### NFRs

- **NFR-E1-1:** Comparison renders within 2 seconds (API call + rendering)
- **NFR-SC4:** Comparison supports up to 4 scenarios simultaneously
- **NFR-S3:** Comparison does NOT modify any scenario data — read-only operation
- **NFR-R2:** Comparison results are deterministic for identical inputs

### Pre-existing Types (Do NOT modify)

- `Scenario` from `@composio/ao-core` — `{ name, storyCount, result }` — READ for mapping
- `RankedScenario` from `@composio/ao-core` — extends Scenario with rank, color, isRecommended — READ for display
- `ScenarioComparison` from `@composio/ao-core` — `{ scenarios: RankedScenario[], recommendedIndex }` — READ for API response
- `compareScenarios()` from `@composio/ao-core` — CALL, do not reimplement
- `getSimulationColor()` from `@composio/ao-core` — CALL for color mapping
- `WhatIfScenario` — already has `result?: SimulationResult` field
- `ScenarioStatus` — already has `"simulated"` and `"applied"` values
- `getScenario()` from scenario-store — READ scenarios for comparison
- `ScenarioCard` — MODIFY to add checkbox prop
- `ScenariosView` — MODIFY to add multi-select and compare button
- `Navigation` component — NOT modified (already has `/scenarios` link)

### References

- [Source: epics-cycle-10.md#Story 54.4] — Story definition and ACs
- [Source: prd-cycle-10.md#FR-E1-3] — "Users can compare multiple scenarios side-by-side"
- [Source: prd-cycle-10.md#NFR-E1-1] — "Simulation completes within 10 seconds"
- [Source: packages/core/src/scenario-comparator.ts] — `compareScenarios()`, `Scenario`, `RankedScenario`, `ScenarioComparison`
- [Source: packages/web/src/lib/scenario-store.ts] — Store with `getScenario()`
- [Source: packages/web/src/components/ScenariosView.tsx] — List view to add multi-select
- [Source: packages/web/src/components/ScenarioCard.tsx] — Card to add checkbox
- [Source: packages/web/src/components/ScenarioDetail.tsx] — Metric display patterns to follow
- [Source: packages/web/src/lib/scenario-helpers.ts] — Shared helper functions
- [Source: _bmad-output/implementation-artifacts/54-3-simulation-execution-engine.md] — Previous story patterns

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- New files: `scenario-comparison.ts`, `compare/route.ts`, `compare/route.test.ts`, `ScenarioComparisonView.tsx`, `compare/page.tsx`
- Modified files: `ScenariosView.tsx`, `ScenarioCard.tsx` and their tests
- All existing tests must continue to pass (no regressions)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

- `packages/web/src/lib/scenario-comparison.ts` — NEW: mapToComparableScenarios(), getBestMetricIndex()
- `packages/web/src/lib/__tests__/scenario-comparison.test.ts` — NEW: Unit tests for mapping logic
- `packages/web/src/app/api/scenarios/compare/route.ts` — NEW: GET handler for comparison
- `packages/web/src/app/api/scenarios/compare/route.test.ts` — NEW: Route tests
- `packages/web/src/app/scenarios/compare/page.tsx` — NEW: Comparison page (server component)
- `packages/web/src/components/ScenarioComparisonView.tsx` — NEW: Comparison display component
- `packages/web/src/components/__tests__/ScenarioComparisonView.test.tsx` — NEW: Component tests
- `packages/web/src/components/ScenariosView.tsx` — MODIFIED: Added multi-select state, compare button
- `packages/web/src/components/ScenarioCard.tsx` — MODIFIED: Added checkbox props for selection
- `packages/web/src/components/__tests__/ScenariosView.test.tsx` — MODIFIED: Added comparison tests
- `packages/web/src/components/__tests__/ScenarioCard.test.tsx` — MODIFIED: Added checkbox tests
