# Story 54.2: Scenario Parameter Configuration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **to modify scenario parameters like agent count, priorities, and capacity**,
so that **I can simulate different resource allocation strategies**.

## Acceptance Criteria

1. **Given** I have created a scenario (via 54.1)
   **When** I open the scenario detail page at `/scenarios/[id]`
   **Then** I see the scenario name, status badge, and a parameter editor panel
   **And** I see the list of captured stories with their current priorities

2. **Given** I am viewing a scenario's parameter editor
   **When** I modify the agent count (add or remove agents)
   **Then** the change is reflected immediately in the parameters summary
   **And** I cannot set agent count below 1 or above a reasonable maximum (50)

3. **Given** I am viewing a scenario's parameter editor
   **When** I change story priorities (reorder or set priority levels)
   **Then** I can drag stories to reorder or set priority (high/medium/low)
   **And** the priority change is tracked as a modification from the original

4. **Given** I am viewing a scenario's parameter editor
   **When** I adjust capacity limits (max concurrent stories per agent)
   **Then** I can set a numeric capacity value
   **And** the value is validated to be a positive integer

5. **Given** I have modified scenario parameters
   **When** I click "Save Parameters"
   **Then** changes are validated before saving
   **And** the scenario is updated with the new parameters
   **And** I see a summary of modifications (diff from original snapshot)

6. **Given** I have unsaved parameter changes
   **When** I navigate away from the scenario detail page
   **Then** I see a confirmation prompt warning about unsaved changes

7. **Given** a scenario has been created but no parameters modified
   **When** I view the scenario detail page
   **Then** the parameter editor shows default values (derived from current snapshot)
   **And** the modification summary shows "No modifications"

8. **Given** I attempt to save with invalid parameters
   **When** agent count is below 1, or capacity is non-positive
   **Then** a validation error is shown for each invalid field
   **And** no parameters are saved

## Tasks / Subtasks

- [x] Task 1: Add scenario parameter types to web types (AC: #1, #2, #3, #4, #5)
  - [x] 1.1: Add `ScenarioParameters` interface to `packages/web/src/lib/types.ts`
  - [x] 1.2: Add `StoryPriorityOverride` interface to types.ts
  - [x] 1.3: Add `parameters` field to `WhatIfScenario` interface (optional, default `undefined`)
  - [x] 1.4: Add `EMPTY_SCENARIO_PARAMS` constant to types.ts

- [x] Task 2: Create parameter validation and diff utility (AC: #5, #7, #8)
  - [x] 2.1: Create `packages/web/src/lib/scenario-params.ts` with `validateParameters()`, `computeParameterDiff()`, `applyParameterDefaults()` functions
  - [x] 2.2: Write unit tests in `packages/web/src/lib/__tests__/scenario-params.test.ts`

- [x] Task 3: Add PATCH API route for scenario parameters (AC: #5, #8)
  - [x] 3.1: Add `updateScenario()` function to `packages/web/src/lib/scenario-store.ts`
  - [x] 3.2: Add PATCH handler to `packages/web/src/app/api/scenarios/[id]/route.ts`
  - [x] 3.3: Write route tests in `packages/web/src/app/api/scenarios/[id]/route.test.ts` (extend existing file)

- [x] Task 4: Create scenario detail page (AC: #1)
  - [x] 4.1: Create `packages/web/src/app/scenarios/[id]/page.tsx` — server component fetching scenario data
  - [x] 4.2: Create `packages/web/src/components/ScenarioDetail.tsx` — client component with parameter editor + story list

- [x] Task 5: Parameter editor section in ScenarioDetail (AC: #2, #3, #4, #5, #6, #8)
  - [x] 5.1: Inline parameter editor section in `ScenarioDetail.tsx` — agent count and capacity inputs with +/- buttons
  - [x] 5.2: Inline validation using `validateParameters()` from `scenario-params.ts`
  - [x] 5.3: "Save Parameters" button with loading state and success/error feedback
  - [x] 5.4: Unsaved changes warning via `beforeunload` event listener
  - [x] 5.5: Tested via `ScenarioDetail.test.tsx` (parameter editing, save, validation tests)

- [x] Task 6: Diff summary section in ScenarioDetail (AC: #5, #7)
  - [x] 6.1: Inline diff summary section in `ScenarioDetail.tsx` — shows parameter changes vs saved baseline
  - [x] 6.2: Tested via `ScenarioDetail.test.tsx` (diff display, "No modifications" tests)

- [x] Task 7: Story priority list section in ScenarioDetail (AC: #3)
  - [x] 7.1: Inline story priority list section in `ScenarioDetail.tsx` — stories with high/medium/low priority buttons
  - [x] 7.2: Tested via `ScenarioDetail.test.tsx` (priority change, save enables after change tests)

- [x] Task 8: Run full regression suite and verify no breakage (AC: all)
  - [x] 8.1: Run `pnpm --filter @composio/ao-web test` — verify all tests pass (currently 1993+)
  - [x] 8.2: No new TypeScript errors introduced
  - [x] 8.3: No new ESLint errors introduced

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
1. Simulation execution
   - Status: Deferred - Requires simulation runner
   - Requires: Story 54.3 (Simulation Execution Engine)
   - Epic: Story 54.2 / Epic 54
   - Current: Parameters can be configured but no simulation can be run
2. Scenario persistence
   - Status: Deferred - Requires file-based storage
   - Requires: Story 54.5 (Scenario Persistence and History)
   - Epic: Story 54.2 / Epic 54
   - Current: Parameters stored in-memory only (lost on server restart)
3. Story scope modification
   - Status: Deferred - Not critical for MVP parameter editor
   - Requires: Future enhancement
   - Epic: Story 54.2 / Epic 54
   - Current: Cannot add/remove stories from a scenario after creation
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
- `getScenario(id)` from `@/lib/scenario-store` — READ scenario for detail page
- `updateScenario(id, partial)` from `@/lib/scenario-store` — NEW function to add
- `getServices()` from `@/lib/services` — CALL in scenario detail page for config
- `readSprintStatus(project)` from `@composio/ao-plugin-tracker-bmad` — NOT used in this story (snapshot already captured)
- `Navigation` component — NOT modified (already has `/scenarios` link from 54.1)

**Feature Flags:**
- None required — parameter configuration is purely additive

## Dependency Review

No new external dependencies required. All changes use existing internal modules:
- React `useState` and `useMemo` for client-side state
- Existing CSS custom properties for styling
- Vitest for testing
- Follows `ScenarioCreator` as internal component pattern for form controls
- Follows `ScenarioCard` as internal component pattern for info display

## Dev Notes

### Architecture Context

This is **Story 2 of 6** in **Epic 54: What-If Simulation Engine**. It is the second story in the Intelligence phase (Cycle 10 Phase 2).

**Story 54.1 (done) created:**
- `WhatIfScenario` type with stories snapshot but NO parameters field
- In-memory scenario store (`scenario-store.ts`)
- API routes: `GET/POST /api/scenarios`, `GET/DELETE /api/scenarios/[id]`
- Components: `ScenarioCreator`, `ScenarioCard`, `ScenariosView`
- Page: `/scenarios` with scenario creation form and card grid
- `handleOpen` in ScenariosView navigates to `/scenarios/${id}` — placeholder for THIS story

**This story (54.2) adds:**
- `ScenarioParameters` type and `parameters` field on `WhatIfScenario`
- `PATCH /api/scenarios/[id]` for updating parameters
- Scenario detail page at `/scenarios/[id]` with parameter editor
- Parameter validation and diff computation utilities
- Story priority override controls

**Story 54.3 (next) will add:**
- Simulation execution using `simulateSprint()` from core
- The `parameters` from this story feed into `SimulationInput` for the simulator
- Specifically: `agentCount` maps to WIP limits, `storyPriorities` maps to story ordering, `capacityLimit` maps to concurrency constraints

### Previous Story Intelligence (Story 54.1)

Key patterns established:

1. **Pure function pattern**: All computation functions are pure sync. `validateParameters()` and `computeParameterDiff()` MUST follow this pattern.

2. **Server/Client component split**: The detail page (`/scenarios/[id]/page.tsx`) is a server component that fetches the scenario from the store and passes it to `ScenarioDetail` client component. Follow the same pattern as `/scenarios/page.tsx`.

3. **API route pattern**: Use `new URL(request.url)` not `request.nextUrl`. Export `dynamic = "force-dynamic"`. Return `NextResponse.json(...)`. The PATCH handler follows the existing pattern in `[id]/route.ts`.

4. **CSS variable design system**: Use `--color-success`, `--color-warning`, `--color-error`, `--color-text-muted`, `--color-border`, `--color-text-primary`, `--color-accent`. Do NOT introduce new color tokens.

5. **Component testing**: Use `@testing-library/react` with `screen`, `within`, `fireEvent`/`userEvent`. Wrap async clicks in `act()`.

6. **Type changes cascade**: Adding `parameters` to `WhatIfScenario` will affect existing test files that create mock scenarios. Update ALL affected test files.

7. **Build before test**: Rebuild `@composio/ao-core` after any changes to core exports (unlikely in this story — only web types change).

8. **`ScenarioStatus` lifecycle**: `"draft"` → `"simulated"` (54.3) → `"applied"` (54.6). Parameters can only be edited while status is `"draft"`.

### What Already Exists (Do NOT Reinvent)

1. **`/api/scenarios/[id]/route.ts`** — Already has GET and DELETE handlers. ADD a PATCH handler to this file. Do NOT create a new route file.

2. **`scenario-store.ts`** — Already has `getScenario()`, `addScenario()`, `deleteScenario()`, `listScenarios()`. ADD an `updateScenario()` function. Do NOT rewrite the store.

3. **`scenario-snapshot.ts`** — Snapshot capture logic. NOT modified in this story — parameters are separate from the snapshot.

4. **`WhatIfScenario` type** — ADD a `parameters` field. The existing fields (`id`, `name`, `createdAt`, `projectIds`, `stories`, `status`, `result`) are NOT modified.

5. **`ScenariosView.tsx`** — Already has `handleOpen` that navigates to `/scenarios/${id}`. NOT modified in this story.

6. **`ScenarioCard.tsx`** — Already has an "Open" button that calls `onOpen`. NOT modified in this story.

7. **`SimStory` type from core** — `{ id: string; domainTags: string[] }`. The `ScenarioStorySnapshot` already includes both fields. In 54.3, converting `stories` + `parameters.storyPriorities` into `SimStory[]` is straightforward.

8. **`SimulationInput` type from core** — `{ stories, learnings, iterations, sprintEndMs?, defaultDurationMs?, seed? }`. NOT used in this story (deferred to 54.3). But `ScenarioParameters` must be designed to feed into `SimulationInput` conversion.

### ScenarioParameters Type Design

```typescript
/** Priority level for a story within a scenario. */
export type StoryPriority = "high" | "medium" | "low";

/** Priority override for a specific story in a scenario. */
export interface StoryPriorityOverride {
  /** Story key (e.g., "54-1-scenario-creation-interface"). */
  storyId: string;
  /** Original priority (always "medium" — the default). */
  originalPriority: StoryPriority;
  /** New priority set by the user. */
  newPriority: StoryPriority;
}

/** Parameters that can be modified in a what-if scenario. */
export interface ScenarioParameters {
  /** Number of agents to simulate. Default: current agent count from config. */
  agentCount: number;
  /** Maximum concurrent stories per agent. Default: 1. */
  capacityLimit: number;
  /** Story priority overrides (only stories with changed priorities). */
  storyPriorities: StoryPriorityOverride[];
}
```

**Why this shape:**
- `agentCount` is a simple numeric slider — maps to WIP limits in the simulator (54.3)
- `capacityLimit` controls concurrency — maps to max concurrent assignments per agent
- `storyPriorities` is an overrides array (not a full list) — only stores CHANGED priorities, reducing data volume and making the diff trivial (if it's in the array, it was changed)
- `StoryPriority` is `"high" | "medium" | "low"` — maps to the simulator's priority weighting (54.3)
- `originalPriority` is always captured so the diff can show before/after
- Empty `storyPriorities` means no priority changes — default is all "medium"

**What gets added to `WhatIfScenario`:**
```typescript
export interface WhatIfScenario {
  // ... existing fields ...
  /** Configured parameters — null until user edits parameters. */
  parameters?: ScenarioParameters;
}
```

**Important:** `parameters` is optional. When `undefined`, the scenario uses defaults (derived from snapshot). This avoids bloating scenarios that were just created and never edited.

### Parameter Validation Design

`validateParameters(params: ScenarioParameters): string[]`

Returns an array of error messages. Empty array = valid.

Rules:
- `agentCount` must be >= 1 and <= 50
- `capacityLimit` must be >= 1 and <= 20
- `storyPriorities` must reference story IDs that exist in the scenario's `stories` array
- `storyPriorities.newPriority` must be a valid `StoryPriority` value
- No duplicate `storyId` entries in `storyPriorities`

### Parameter Diff Design

`computeParameterDiff(original: ScenarioParameters, modified: ScenarioParameters): ParameterDiff`

```typescript
interface ParameterDiff {
  agentCount: { original: number; modified: number } | null;  // null if unchanged
  capacityLimit: { original: number; modified: number } | null;
  priorityChanges: StoryPriorityOverride[];  // only stories with changed priority
  hasChanges: boolean;
}
```

If `original === undefined`, treat all fields as defaults (agentCount from config, capacityLimit=1, no priority overrides).

### API Design for PATCH

```
PATCH /api/scenarios/[id] → WhatIfScenario | 404 | 400
  - Body: { parameters: ScenarioParameters }
  - Validates: scenario exists, parameters pass validation
  - Updates scenario.parameters in store
  - Returns updated scenario
  - 400 if validation fails (with error details)
  - 404 if scenario not found
  - 409 if scenario status is not "draft" (can't edit parameters after simulation)
```

### Scenario Detail Page Structure

```
/scenarios/[id]/page.tsx (server component)
  ├── Fetch scenario from store via getScenario(id)
  ├── Fetch config via getServices() for defaultAgentCount
  ├── If scenario not found → 404
  └── Pass to ScenarioDetail (client component)
      └── ScenarioDetail (single component with inline sections)
          ├── Header: scenario name, status badge, created date
          ├── Parameter Editor (inline section)
          │   ├── Agent Count: number input with +/- buttons
          │   ├── Capacity Limit: number input
          │   ├── Save Parameters button
          │   └── Validation errors
          ├── Story Priority List (inline section)
          │   ├── List of captured stories
          │   └── Priority selector (high/medium/low) for each story
          └── Diff Summary (inline section)
              ├── Agent count change (if any)
              ├── Capacity change (if any)
              └── Priority changes (if any)
```

### Component Design Details

**ScenarioDetail** (single client component with inline sections):

All UI sections are inline within `ScenarioDetail.tsx` — no separate sub-components needed.

*Parameter Editor section:*
- Number inputs for `agentCount` and `capacityLimit`
- `agentCount` shows current value with increment/decrement buttons (min 1, max 50)
- `capacityLimit` shows current value with increment/decrement buttons (min 1, max 20)
- "Save Parameters" button — disabled if no changes or validation errors
- Loading state while saving (PATCH request)
- Error display for API errors
- Parameter state managed locally via `useState`

*Story Priority List section:*
- Displays all stories from the scenario snapshot
- Each story shows: ID (truncated) with priority selector
- Priority selector is a button group: high (red) / medium (default) / low (gray)
- Only stores overrides for stories where priority differs from default ("medium")
- Uses `handlePriorityChange` callback to update `storyPriorities` state

*Diff Summary section:*
- Shows summary of all modifications vs saved baseline (`savedParams` state)
- Agent count: "original → modified" (green if increase, amber if decrease)
- Capacity: "original → modified" (if changed)
- Priority changes: "N stories reprioritized"
- "No modifications" message when nothing changed

*ScenarioDetail overall:*
- Client component managing the full scenario detail view
- Receives scenario and `defaultAgentCount` as props from server component
- Uses `savedParams` state to track saved baseline (avoids prop mutation)
- Manages parameter state locally (not saved until "Save" click)
- Unsaved changes warning via `beforeunload` event
- Disabled controls when scenario status is not "draft"

### File Structure to Create/Modify

```
packages/web/src/
├── lib/
│   ├── types.ts                              # MODIFY: Add ScenarioParameters, StoryPriorityOverride, StoryPriority
│   ├── scenario-store.ts                     # MODIFY: Add updateScenario() function
│   ├── scenario-params.ts                    # NEW: Validation, diff, defaults
│   └── __tests__/
│       └── scenario-params.test.ts           # NEW: Unit tests for parameter logic
├── app/
│   ├── api/
│   │   └── scenarios/
│   │       └── [id]/
│   │           ├── route.ts                  # MODIFY: Add PATCH handler
│   │           └── route.test.ts             # MODIFY: Add PATCH tests
│   └── scenarios/
│       └── [id]/
│           └── page.tsx                      # NEW: Scenario detail page (server component)
├── components/
│   ├── ScenarioDetail.tsx                    # NEW: Client component with parameter editor, story list, diff summary (all inline)
│   └── __tests__/
│       └── ScenarioDetail.test.tsx           # NEW: Component tests covering all sections
```

### Testing Strategy

**Unit tests (scenario-params.test.ts):** ~20 tests
- `validateParameters` returns empty array for valid params
- `validateParameters` catches agentCount < 1
- `validateParameters` catches agentCount > 50
- `validateParameters` catches capacityLimit < 1
- `validateParameter` catches capacityLimit > 20
- `validateParameters` catches invalid story IDs in priorities
- `validateParameters` catches duplicate story ID entries
- `computeParameterDiff` returns no changes for identical params
- `computeParameterDiff` detects agentCount change
- `computeParameterDiff` detects capacityLimit change
- `computeParameterDiff` detects priority changes
- `computeParameterDiff` handles undefined original (defaults)
- `computeParameterDiff` sets hasChanges correctly
- `applyParameterDefaults` returns defaults from config

**API route tests ([id]/route.test.ts):** ~6 new tests (add to existing 4)
- PATCH /api/scenarios/[id] updates parameters
- PATCH returns 404 for unknown scenario
- PATCH returns 400 for invalid parameters
- PATCH returns 409 if scenario status is not "draft"

**Component tests (ScenarioDetail.test.tsx):** 17 tests (all sections tested through single component)
- Renders scenario header with name, status badge, date
- Shows "Back to Scenarios" link
- Parameter editor: agent count +/- buttons work, clamped to range
- Parameter editor: capacity +/- buttons work, clamped to range
- Save button disabled when no changes, enabled after edit
- Save calls PATCH API and shows success/error feedback
- Non-draft scenarios show read-only warning and disabled controls
- Story priority list renders all stories with priority buttons
- Changing priority updates storyPriorities state
- Diff summary shows "No modifications" when unchanged
- Diff summary shows changes after parameter edits
- Existing parameters display correctly when scenario has saved params

### NFRs

- **NFR-P1:** Scenario detail page loads within 2 seconds
- **NFR-P4:** PATCH API endpoint responds within 500ms
- **NFR-S3:** Parameter changes do NOT modify actual system state — only the in-memory scenario copy
- **NFR-R2:** Parameter validation is deterministic — same input always produces same validation result

### Pre-existing Types (Do NOT modify)

- `ScenarioStorySnapshot` — do not modify, only READ for story list display
- `ScenarioStatus` — do not modify, only READ for status check (draft-only editing)
- `SimulationResult` — do not modify (used as optional field, populated by 54.3)
- `SimStory` from core — do not modify (will be derived from stories + priorities in 54.3)
- `SimulationInput` from core — do not modify (54.3 converts parameters to SimulationInput)
- `captureScenarioSnapshot()` — do not modify (not used in this story)
- `createScenario()` — do not modify (not used in this story)

### References

- [Source: epics-cycle-10.md#Story 54.2] — Story definition and ACs
- [Source: prd-cycle-10.md#FR-E1-2] — "Scenarios can modify: agent count, priority, capacity, story scope"
- [Source: prd-cycle-10.md#NFR-S3] — "Scenarios cannot modify actual system state"
- [Source: prd-cycle-10.md#NFR-R2] — "Simulation results are deterministic for identical inputs"
- [Source: packages/core/src/sprint-simulator.ts] — SimulationInput shape (for understanding, not used this story)
- [Source: packages/core/src/scenario-comparator.ts] — Scenario comparison types (for understanding)
- [Source: packages/web/src/lib/types.ts] — Types to extend with parameter types
- [Source: packages/web/src/lib/scenario-store.ts] — Store to extend with updateScenario()
- [Source: packages/web/src/app/api/scenarios/[id]/route.ts] — Route to extend with PATCH
- [Source: packages/web/src/components/ScenariosView.tsx] — handleOpen navigates to detail page
- [Source: packages/web/src/components/ScenarioCreator.tsx] — Pattern for form controls
- [Source: _bmad-output/implementation-artifacts/54-1-scenario-creation-interface.md] — Previous story patterns and deferred items

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- New files: `scenario-params.ts`, `ScenarioDetail.tsx`, and its test file
- New route: `/scenarios/[id]/page.tsx`
- Modified files: `types.ts`, `scenario-store.ts`, `[id]/route.ts`, `[id]/route.test.ts`
- All existing tests must continue to pass (no regressions)
- Story 54.3 will use the parameters to build SimulationInput for the simulator

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

1. Tasks 1-2 completed in previous session (types, validation, diff, defaults utilities).
2. Task 3: Added `updateScenario()` to scenario-store, PATCH handler to `[id]/route.ts`, 4 new route tests (8 total).
3. Tasks 4-7 consolidated into `ScenarioDetail.tsx` single client component with inline parameter editor, story priority list, and diff summary sections. Created `/scenarios/[id]/page.tsx` server component. 17 component tests all pass.
4. Task 8: Full regression 1993 tests pass, no new TS/lint errors in changed files. Pre-existing TS errors in core (resource-conflict.test.ts) and web (SimulationResult import, ConflictPatternSummary, SprintFilterBar) are from other stories.

### Limitations (Deferred Items)

1. Simulation execution
   - Status: Deferred - Requires simulation runner
   - Requires: Story 54.3 (Simulation Execution Engine)
   - Current: Parameters can be configured but no simulation can be run

2. Scenario persistence
   - Status: Deferred - Requires file-based storage
   - Requires: Story 54.5 (Scenario Persistence and History)
   - Current: Parameters stored in-memory only (lost on server restart)

3. Story scope modification
   - Status: Deferred - Not critical for MVP parameter editor
   - Requires: Future enhancement
   - Current: Cannot add/remove stories from a scenario after creation

### File List

**New files:**
- `packages/web/src/app/scenarios/[id]/page.tsx` — Server component for scenario detail page
- `packages/web/src/components/ScenarioDetail.tsx` — Client component with parameter editor, story priority list, diff summary (all inline)
- `packages/web/src/components/__tests__/ScenarioDetail.test.tsx` — 17 component tests
- `packages/web/src/lib/scenario-params.ts` — Parameter validation, diff computation, defaults
- `packages/web/src/lib/__tests__/scenario-params.test.ts` — 23 unit tests
- `packages/web/src/lib/scenario-helpers.ts` — Shared status badge and date formatting helpers

**Modified files:**
- `packages/web/src/lib/types.ts` — Added ScenarioParameters, StoryPriorityOverride, StoryPriority, ParameterDiff, EMPTY_SCENARIO_PARAMS, parameters field on WhatIfScenario
- `packages/web/src/lib/scenario-store.ts` — Added updateScenario() function
- `packages/web/src/app/api/scenarios/[id]/route.ts` — Added PATCH handler
- `packages/web/src/app/api/scenarios/[id]/route.test.ts` — Extended with 4 PATCH tests
- `packages/web/src/components/ScenarioCard.tsx` — Removed duplicated helpers, now imports from scenario-helpers.ts
