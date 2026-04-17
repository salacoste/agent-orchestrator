# Story 54.3: Simulation Execution Engine

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **to run a simulation on my scenario and get predicted outcomes**,
so that **I can understand the impact of my proposed changes**.

## Acceptance Criteria

1. **Given** a scenario has configured parameters (via 54.2)
   **When** I click "Run Simulation" on the scenario detail page
   **Then** the system runs `simulateSprint()` against the scenario's stories with the configured parameters
   **And** the scenario status transitions from `"draft"` to `"simulated"`

2. **Given** a simulation completes successfully
   **When** I view the scenario detail page
   **Then** I see predicted completion dates at 50%, 80%, and 95% confidence levels
   **And** I see on-time probability as a percentage with color indicator (green/amber/red)
   **And** I see the confidence level of the prediction
   **And** results are stored on the scenario's `result` field

3. **Given** a scenario has `agentCount` configured
   **When** the simulation runs
   **Then** higher agent counts produce faster predicted completion times (parallelism scaling)
   **And** the scaling accounts for `capacityLimit` (max concurrent stories per agent)

4. **Given** a scenario has `storyPriorities` configured
   **When** the simulation runs
   **Then** high-priority stories are scheduled before low-priority stories
   **And** the ordering influences completion time estimates

5. **Given** I attempt to simulate a scenario with status "simulated" or "applied"
   **When** I click "Run Simulation"
   **Then** the button is disabled and I see a message that the scenario has already been simulated

6. **Given** a simulation request fails
   **When** the API returns an error
   **Then** I see an error message on the scenario detail page
   **And** the scenario status remains `"draft"`

## Tasks / Subtasks

- [x] Task 1: Create simulation parameter mapping utility (AC: #3, #4)
  - [x] 1.1: Create `packages/web/src/lib/scenario-simulation.ts` with `buildSimulationInput()` function
  - [x] 1.2: Map `ScenarioParameters` to `SimulationInput` — agentCount/capacity → parallelism scaling, storyPriorities → story ordering
  - [x] 1.3: Map `ScenarioStorySnapshot[]` to `SimStory[]` using existing `domainTags`
  - [x] 1.4: Write unit tests in `packages/web/src/lib/__tests__/scenario-simulation.test.ts`

- [x] Task 2: Add POST simulate API route (AC: #1, #5, #6)
  - [x] 2.1: Create `packages/web/src/app/api/scenarios/[id]/simulate/route.ts` — POST handler
  - [x] 2.2: Validate scenario exists and status is "draft" (404/409 responses)
  - [x] 2.3: Call `buildSimulationInput()` then `simulateSprint()` from core
  - [x] 2.4: Store result via `updateScenario(id, { result, status: "simulated" })`
  - [x] 2.5: Write route tests in `packages/web/src/app/api/scenarios/[id]/simulate/route.test.ts`

- [x] Task 3: Add "Run Simulation" button and results panel to ScenarioDetail (AC: #1, #2, #5, #6)
  - [x] 3.1: Add "Run Simulation" button (disabled when status !== "draft") to `ScenarioDetail.tsx`
  - [x] 3.2: Add simulation results panel showing p50/p80/p95 days, on-time probability, confidence, color badge
  - [x] 3.3: Handle loading state and error state for simulation
  - [x] 3.4: Update `ScenarioDetail.test.tsx` with simulation tests

- [x] Task 4: Run full regression suite and verify no breakage (AC: all)
  - [x] 4.1: Run `pnpm --filter @composio/ao-web test` — verify all tests pass (2023 tests, 166 files)
  - [x] 4.2: No new TypeScript errors introduced (33 pre-existing only)
  - [x] 4.3: No new ESLint errors introduced

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
1. Monte Carlo parameter tuning
   - Status: Deferred - Requires UI for iteration count, seed configuration
   - Requires: Story 55.6 (Simulation Parameter Configuration)
   - Epic: Story 54.3 / Epic 54
   - Current: Simulation uses sensible defaults (1000 iterations, seeded RNG)
2. Side-by-side comparison
   - Status: Deferred - Requires multi-scenario selection UI
   - Requires: Story 54.4 (Side-by-Side Scenario Comparison)
   - Epic: Story 54.3 / Epic 54
   - Current: Can only view one scenario's results at a time
3. Scenario persistence
   - Status: Deferred - Requires file-based storage
   - Requires: Story 54.5 (Scenario Persistence and History)
   - Epic: Story 54.3 / Epic 54
   - Current: Simulation results stored in-memory only (lost on server restart)
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
- `getScenario(id)` from `@/lib/scenario-store` — READ scenario for simulation
- `updateScenario(id, partial)` from `@/lib/scenario-store` — UPDATE scenario with result + status change
- `simulateSprint(input)` from `@composio/ao-core` — RUN the Monte Carlo simulation
- `getServices()` from `@/lib/services` — GET learning store for historical data
- `getSimulationColor(probability)` from `@composio/ao-core` — MAP probability to green/amber/red

**Feature Flags:**
- None required — simulation execution is purely additive

## Dependency Review

No new external dependencies required. All changes use existing internal modules:
- `simulateSprint` from `@composio/ao-core` (already built in Story 48.1)
- `getSimulationColor` from `@composio/ao-core`
- `SessionLearning` type from `@composio/ao-core`
- React `useState` for client-side state
- Existing CSS custom properties for styling
- Vitest for testing

## Dev Notes

### Architecture Context

This is **Story 3 of 6** in **Epic 54: What-If Simulation Engine**. It is the core story in the Intelligence phase (Cycle 10 Phase 2).

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

**This story (54.3) adds:**
- Simulation execution via `simulateSprint()` from core
- `POST /api/scenarios/[id]/simulate` route
- Parameter-to-simulation mapping utility
- "Run Simulation" button and results display in ScenarioDetail
- Status transition: `"draft"` → `"simulated"`

**Story 54.4 (next) will add:**
- Side-by-side scenario comparison using `compareScenarios()` from core
- Multi-scenario selection UI

### Previous Story Intelligence (Story 54.2)

**Key patterns established:**

1. **Pure function pattern**: `buildSimulationInput()` MUST be a pure sync function — no I/O, deterministic output from input. Follows same pattern as `validateParameters()` and `computeParameterDiff()`.

2. **Server/Client component split**: The ScenarioDetail component is a client component receiving scenario as a prop. The simulate button will call the API and update local state.

3. **API route pattern**: Use `new URL(request.url)` not `request.nextUrl`. Export `dynamic = "force-dynamic"`. Return `NextResponse.json(...)`. Follow the existing POST pattern in `simulate/route.ts`.

4. **CSS variable design system**: Use `--color-success`, `--color-warning`, `--color-error`, `--color-text-muted`, `--color-border`, `--color-text-primary`, `--color-accent`. Do NOT introduce new color tokens.

5. **Component testing**: Use `@testing-library/react` with `screen`, `within`, `fireEvent`/`userEvent`. Wrap async clicks in `act()`.

6. **`ScenarioStatus` lifecycle**: `"draft"` → `"simulated"` (THIS story) → `"applied"` (54.6). Parameters can only be edited while status is `"draft"`. Simulation can only run when status is `"draft"`.

7. **Overrides array pattern**: `storyPriorities` stores only CHANGED priorities — merge with full story list to get complete ordering.

8. **Single component with inline sections**: ScenarioDetail has all UI inline — add simulation button and results as inline sections within the same component.

### What Already Exists (Do NOT Reinvent)

1. **`simulateSprint()` from core** — Pure Monte Carlo function. Takes `SimulationInput`, returns `SimulationResult`. Built in Story 48.1. Do NOT reimplement simulation logic.

2. **`getSimulationColor()` from core** — Maps onTimeProbability to green/amber/red. Built in Story 48.1.

3. **`GET /api/sprint/simulate`** — Existing route that simulates against LIVE sprint data (Story 48.2). Do NOT modify this route. Story 54.3 creates a NEW route for scenario-specific simulation.

4. **`scenario-store.ts`** — Already has `getScenario()`, `updateScenario()`. Use `updateScenario(id, { result, status: "simulated" })` to persist results.

5. **`ScenarioDetail.tsx`** — Already has parameter editor, story list, diff summary. ADD simulation button and results panel. Do NOT rewrite.

6. **`WhatIfScenario` type** — Already has optional `result?: SimulationResult` field and `status: ScenarioStatus`. No type changes needed.

7. **`scenario-params.ts`** — Validation utilities. Use `validateParameters()` to ensure parameters are valid before simulation.

8. **`ScenarioStorySnapshot`** — Already has `domainTags: string[]` which maps directly to `SimStory.domainTags`.

9. **`MonteCarloChart` component** — Existing SVG histogram chart (Story 48.2). Can be referenced for visualization patterns but is designed for the live sprint view. Story 54.3 uses simpler stat cards for scenario results.

10. **`scenario-helpers.ts`** — Shared `statusBadgeColor()` and `statusLabel()`. The `"simulated"` status already maps to accent color and "Simulated" label.

### Simulation Parameter Mapping Design

`buildSimulationInput(scenario, learnings, config?): SimulationInput`

**Input:** WhatIfScenario (with stories + parameters), SessionLearning[], optional config
**Output:** SimulationInput ready for `simulateSprint()`

**Mapping logic:**

```
1. stories: ScenarioStorySnapshot[] → SimStory[]
   - Direct map: { id: snapshot.id, domainTags: snapshot.domainTags }
   - Apply priority ordering: stories with high priority first, then medium, then low
   - Stories NOT in storyPriorities default to "medium"

2. learnings: SessionLearning[] (passed through from learning store)

3. iterations: 1000 (sensible default for scenario simulation)
   - Lower than production Monte Carlo (10,000) for faster interactive results
   - NFR-E1-1: "completes within 10 seconds" — 1000 iterations is sufficient

4. agentCount/capacityLimit → parallelism scaling:
   - baseConcurrency = 1 (default, what the simulator assumes)
   - effectiveConcurrency = agentCount × capacityLimit
   - After simulation, scale p50/p80/p95 days: result / effectiveConcurrency
   - This models the real-world effect: more agents + higher capacity = faster completion
   - Clamp to minimum of 1 day to avoid unrealistic predictions

5. seed: undefined (let the simulator use its default seed for variety)
```

**Why this approach:**
- `simulateSprint()` already handles the complex Monte Carlo logic — we just prepare inputs and adjust outputs
- Priority ordering influences which stories complete first (front-loaded vs back-loaded)
- Parallelism scaling is a simple model — Story 55 (Monte Carlo Forecasting) may refine this
- 1000 iterations balances speed (NFR: <10s) with prediction quality

**Important:** The `result` stored on the scenario should contain the POST-scaling values — what the user actually sees as predictions. Store the raw `SimulationResult` from `simulateSprint()` and apply scaling when displaying, OR pre-scale before storing. Pre-scaling is simpler for display.

**Decision: Pre-scale before storing.** Store the final adjusted `SimulationResult` on the scenario. This way:
- The display component just renders the result directly
- Side-by-side comparison (54.4) compares pre-scaled results
- No re-computation needed on page load

### API Design for POST simulate

```
POST /api/scenarios/[id]/simulate → { scenario: WhatIfScenario } | 404 | 409 | 500
  - No request body needed — uses scenario's current parameters and stories
  - Validates: scenario exists, status is "draft", parameters are present
  - Fetches learnings from learning store via getServices()
  - Calls buildSimulationInput() then simulateSprint()
  - Applies parallelism scaling to result
  - Updates scenario: updateScenario(id, { result, status: "simulated" })
  - Returns updated scenario with result
  - 404 if scenario not found
  - 409 if scenario status is not "draft"
  - 500 if simulation fails unexpectedly
```

### ScenarioDetail Simulation UI Design

**"Run Simulation" button:**
- Positioned after the parameter editor section, before the diff summary
- Only shown when `scenario.status === "draft"`
- Disabled when parameters haven't been saved yet (use `hasUnsaved` from diff)
- Shows loading state ("Simulating...") while API call in progress

**Results panel (shown after simulation):**
- Positioned after the "Run Simulation" button area
- Shown when `scenario.result` is populated (or when local simulation state exists)
- Contains:
  - On-time probability: large percentage with color badge (green/amber/red)
  - Confidence level: "High" / "Medium" / "Low"
  - Completion estimates: p50, p80, p95 days (each as a stat card)
  - Iterations run: small text showing "Based on N simulations"
- Also shown when status is "simulated" or "applied" (viewing past results)

**Status transition UX:**
- After successful simulation, update local state to reflect `"simulated"` status
- This disables the parameter editor (existing behavior for non-draft)
- The "Run Simulation" button is replaced with "Simulation Results" heading

### File Structure to Create/Modify

```
packages/web/src/
├── lib/
│   ├── scenario-simulation.ts                    # NEW: buildSimulationInput(), applyParallelismScaling()
│   └── __tests__/
│       └── scenario-simulation.test.ts           # NEW: Unit tests for mapping logic
├── app/
│   ├── api/
│   │   └── scenarios/
│   │       └── [id]/
│   │           └── simulate/
│   │               ├── route.ts                  # NEW: POST handler for simulation
│   │               └── route.test.ts             # NEW: Route tests
│   └── scenarios/
│       └── [id]/
│           └── page.tsx                          # NO CHANGE (already passes scenario prop)
├── components/
│   ├── ScenarioDetail.tsx                        # MODIFY: Add simulation button + results panel
│   └── __tests__/
│       └── ScenarioDetail.test.tsx               # MODIFY: Add simulation tests
```

### Testing Strategy

**Unit tests (scenario-simulation.test.ts):** ~12 tests
- `buildSimulationInput` converts stories to SimStory[]
- `buildSimulationInput` applies priority ordering (high first)
- `buildSimulationInput` maps stories without overrides as medium priority
- `buildSimulationInput` uses default iterations (1000)
- `buildSimulationInput` passes learnings through
- `applyParallelismScaling` divides days by effectiveConcurrency
- `applyParallelismScaling` clamps minimum to 1 day
- `applyParallelismScaling` with agentCount=1 capacityLimit=1 returns unchanged
- `applyParallelismScaling` with agentCount=4 capacityLimit=2 scales by 8x
- `applyParallelismScaling` handles edge case: result with very low days
- `buildSimulationInput` handles empty stories array
- `buildSimulationInput` handles empty learnings array

**API route tests (simulate/route.test.ts):** ~6 tests
- POST /api/scenarios/[id]/simulate runs simulation and returns result
- POST returns 404 for unknown scenario
- POST returns 409 for non-draft scenario
- POST returns 500 when simulateSprint throws
- POST stores result and updates status to "simulated"
- POST validates parameters exist before simulating

**Component tests (ScenarioDetail.test.tsx):** ~6 new tests
- "Run Simulation" button is shown when status is draft
- "Run Simulation" button is disabled when status is not draft
- Clicking "Run Simulation" calls POST API and shows results
- Simulation results display p50/p80/p95 and probability
- Error state shows error message
- Simulation button hidden for simulated/applied scenarios, results shown instead

### NFRs

- **NFR-E1-1:** Simulation completes within 10 seconds for typical scenarios (1000 iterations with <100 stories)
- **NFR-P4:** POST simulate API responds within 500ms (excluding simulation time)
- **NFR-S3:** Simulation does NOT modify actual system state — only the in-memory scenario copy
- **NFR-R2:** Simulation results are deterministic for identical inputs (if seed is provided)
- **NFR-SC4:** Simulation engine processes scenarios with up to 1000 stories

### Pre-existing Types (Do NOT modify)

- `SimStory` from core — `{ id: string; domainTags: string[] }` — READ for mapping
- `SimulationInput` from core — `{ stories, learnings, iterations, ... }` — READ for building input
- `SimulationResult` from core — `{ p50Days, p80Days, p95Days, ... }` — READ for storing
- `SessionLearning` from core — READ for passing to simulator
- `simulateSprint()` from core — CALL, do not reimplement
- `getSimulationColor()` from core — CALL for color mapping
- `ScenarioStorySnapshot` — READ for story mapping
- `WhatIfScenario` — already has `result?: SimulationResult` field, no change needed
- `ScenarioStatus` — already has `"simulated"` value, no change needed
- `captureScenarioSnapshot()` — NOT used in this story (snapshot already captured in 54.1)
- `createScenario()` — NOT used in this story
- `Navigation` component — NOT modified (already has `/scenarios` link)

### References

- [Source: epics-cycle-10.md#Story 54.3] — Story definition and ACs
- [Source: prd-cycle-10.md#FR-E1-1] — "Users can create what-if scenarios to simulate changes"
- [Source: prd-cycle-10.md#FR-E1-2] — "Simulation engine uses historical data to predict outcomes"
- [Source: prd-cycle-10.md#FR-E1-6] — "Simulation results include confidence intervals"
- [Source: prd-cycle-10.md#NFR-E1-1] — "Simulation completes within 10 seconds"
- [Source: prd-cycle-10.md#NFR-E1-2] — "Simulation accuracy improves over time"
- [Source: prd-cycle-10.md#NFR-S3] — "Scenarios cannot modify actual system state"
- [Source: prd-cycle-10.md#NFR-R2] — "Simulation results are deterministic for identical inputs"
- [Source: packages/core/src/sprint-simulator.ts] — `simulateSprint()`, `SimulationInput`, `SimulationResult`
- [Source: packages/core/src/scenario-comparator.ts] — `compareScenarios()` (for 54.4 reference)
- [Source: packages/web/src/app/api/sprint/simulate/route.ts] — Pattern for calling simulateSprint from API
- [Source: packages/web/src/lib/scenario-params.ts] — Parameter validation and defaults
- [Source: packages/web/src/lib/scenario-store.ts] — Store with updateScenario()
- [Source: packages/web/src/components/ScenarioDetail.tsx] — Component to extend with simulation UI
- [Source: _bmad-output/implementation-artifacts/54-2-scenario-parameter-configuration.md] — Previous story patterns

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- New files: `scenario-simulation.ts`, `simulate/route.ts`, `simulate/route.test.ts`
- Modified files: `ScenarioDetail.tsx`, `ScenarioDetail.test.tsx`
- All existing tests must continue to pass (no regressions)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- All 6 acceptance criteria met
- `buildSimulationInput()` maps scenario stories to SimStory[] with priority ordering (high → medium → low)
- `applyParallelismScaling()` divides p50/p80/p95 by effectiveConcurrency, clamps to 1 day min
- POST `/api/scenarios/[id]/simulate` validates draft status, fetches learnings, runs simulation, stores pre-scaled result
- `SimulationResult` imported from `@composio/ao-core` barrel (not `/types`) — it's exported from `sprint-simulator.ts`
- ScenarioDetail shows "Run Simulation" button (disabled when unsaved params or no params), results panel with p50/p80/p95, probability, confidence, iterations
- 2023 tests pass, 166 files, 0 failures (+26 new tests from baseline 1997)

### File List

**New files:**
- `packages/web/src/lib/scenario-simulation.ts` — buildSimulationInput(), applyParallelismScaling()
- `packages/web/src/lib/__tests__/scenario-simulation.test.ts` — 14 unit tests
- `packages/web/src/app/api/scenarios/[id]/simulate/route.ts` — POST handler
- `packages/web/src/app/api/scenarios/[id]/simulate/route.test.ts` — 6 route tests

**Modified files:**
- `packages/web/src/components/ScenarioDetail.tsx` — Added simulation state, handler, button, and results panel
- `packages/web/src/components/__tests__/ScenarioDetail.test.tsx` — Added 6 simulation tests (25 total)
- `packages/web/src/lib/types.ts` — Fixed SimulationResult import path
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 54-3 status: in-progress
