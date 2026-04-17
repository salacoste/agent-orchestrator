# Story 54.1: Scenario Creation Interface

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **to create a new what-if scenario by copying current system state**,
so that **I can experiment with changes without affecting production**.

## Acceptance Criteria

1. **Given** I want to simulate changes
   **When** I navigate to the scenarios page
   **Then** I see a "Create Scenario" form with a name input and project selection
   **And** I can name the scenario and select which projects to include

2. **Given** I have filled in the scenario name and selected projects
   **When** I click "Create Scenario"
   **Then** the system captures a snapshot of current sprint state for selected projects
   **And** the scenario is created with status "draft"
   **And** the new scenario appears in the scenario list

3. **Given** the scenario is created
   **When** I view the scenario card
   **Then** I see name, creation date, included project count, story count, and status badge
   **And** the scenario data is isolated from the real system

4. **Given** the scenario creation page is displayed
   **When** I view the project selection
   **Then** all configured projects are listed with checkboxes
   **And** each project shows its current story counts
   **And** I can select/deselect individual projects or "select all"

5. **Given** I attempt to create a scenario without a name
   **When** I click "Create Scenario"
   **Then** a validation error is shown
   **And** no scenario is created

6. **Given** no scenarios exist yet
   **When** I navigate to the scenarios page
   **Then** I see an empty state message encouraging me to create a first scenario
   **And** the "Create Scenario" form is prominently displayed

## Tasks / Subtasks

- [x] Task 1: Add scenario types to web types (AC: #1, #2, #3)
  - [x] 1.1: Add `WhatIfScenario` interface to `packages/web/src/lib/types.ts`
  - [x] 1.2: Add `ScenarioStorySnapshot` interface to `packages/web/src/lib/types.ts`
  - [x] 1.3: Add `ScenarioStatus` type and `EMPTY_SCENARIO_PARAMS` constant
  - [x] 1.4: Update `packages/web/src/components/Navigation.tsx` to add `/scenarios` link

- [x] Task 2: Create scenario snapshot utility (AC: #2, #3)
  - [x] 2.1: Create `packages/web/src/lib/scenario-snapshot.ts` with `captureScenarioSnapshot()` and `createScenario()` functions
  - [x] 2.2: Write unit tests in `packages/web/src/lib/__tests__/scenario-snapshot.test.ts` (23 tests)

- [x] Task 3: Create scenario API routes (AC: #2, #3)
  - [x] 3.1: Create `packages/web/src/app/api/scenarios/route.ts` — GET (list) and POST (create)
  - [x] 3.2: Create `packages/web/src/lib/scenario-store.ts` — in-memory scenario storage (to be replaced with file persistence in Story 54.5)
  - [x] 3.3: Write route tests in `packages/web/src/app/api/scenarios/route.test.ts` (7 tests)

- [x] Task 4: Create ScenarioCreator component (AC: #1, #4, #5)
  - [x] 4.1: Create `packages/web/src/components/ScenarioCreator.tsx` — form with name input, project checkboxes, create button
  - [x] 4.2: Include validation (name required, at least one project selected)
  - [x] 4.3: Write component tests in `packages/web/src/components/__tests__/ScenarioCreator.test.tsx` (12 tests)

- [x] Task 5: Create ScenarioCard and scenarios page (AC: #3, #6)
  - [x] 5.1: Create `packages/web/src/components/ScenarioCard.tsx` — displays scenario name, date, project count, story count, status badge
  - [x] 5.2: Create `packages/web/src/app/scenarios/page.tsx` — server component fetching projects, rendering client wrapper
  - [x] 5.3: Create `packages/web/src/components/ScenariosView.tsx` — client component managing scenario list + ScenarioCreator + ScenarioCard grid
  - [x] 5.4: Write component tests for ScenarioCard (9 tests) and ScenariosView (5 tests)

- [x] Task 6: Run full regression suite and verify no breakage (AC: all)
  - [x] 6.1: Run `pnpm --filter @composio/ao-web test` — 161 files, 1944 tests passing
  - [x] 6.2: No new TypeScript errors introduced
  - [x] 6.3: No new ESLint errors introduced

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
   - Requires: JSON file storage for scenarios (Story 54.5)
   - Epic: Story 54.1 / Epic 54
   - Current: Scenarios stored in-memory only (lost on server restart)
2. Scenario parameter modification
   - Status: Deferred - Requires parameter editor UI
   - Requires: Story 54.2 (Scenario Parameter Configuration)
   - Epic: Story 54.1 / Epic 54
   - Current: Scenarios capture state but parameters cannot be modified
3. Simulation execution
   - Status: Deferred - Requires simulation runner UI
   - Requires: Story 54.3 (Simulation Execution Engine)
   - Epic: Story 54.1 / Epic 54
   - Current: No simulation can be run on created scenarios
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
- `simulateSprint()` from `@composio/ao-core` — NOT used in this story (deferred to 54.3)
- `Scenario` type from `@composio/ao-core/scenario-comparator` — READ ONLY for reference (do NOT reuse for web types)
- `SimulationResult` type from `@composio/ao-core/sprint-simulator` — referenced but NOT used in this story
- `aggregateUnifiedSprints()` from `@/lib/unified-sprint-aggregation` — CALL for capturing current state
- `readSprintStatus()` from `@composio/ao-plugin-tracker-bmad` — CALL via aggregation functions
- `getServices()` from `@/lib/services` — CALL in API routes for config access
- `Navigation` component — MODIFY to add /scenarios link

**Feature Flags:**
- None required — scenario creation is purely additive with no impact on existing features

## Dependency Review

No new external dependencies required. All changes use existing internal modules:
- React `useState` and `useMemo` for client-side state
- Existing CSS custom properties for styling
- Vitest for testing
- Follows `PortfolioFilterBar` + `SprintFilterBar` as internal component patterns
- Follows `/sprints/page.tsx` as page pattern

## Dev Notes

### Architecture Context

This is **Story 1 of 6** in **Epic 54: What-If Simulation Engine**. It is the **first story in the Intelligence phase** (Cycle 10 Phase 2), which builds on the Foundation phase (Epics 49-53, all done).

**Key dependency:** Epic 53 (Unified Sprint View) provides the sprint data aggregation layer that this story uses to capture current state snapshots. Specifically:
- `aggregateUnifiedSprints(config)` — reads all project sprint data and returns `UnifiedSprintEntry[]`
- `UnifiedSprintEntry` type — the shape of sprint data used in the dashboard
- `buildSprintDataMap(config)` from core — maps project configs to sprint data

**Core simulation engine is already built** (Epic 48):
- `simulateSprint()` in `packages/core/src/sprint-simulator.ts` — pure Monte Carlo function
- `compareScenarios()` in `packages/core/src/scenario-comparator.ts` — ranks scenarios
- `Scenario` type: `{ name: string; storyCount: number; result: SimulationResult }`
- `SimulationInput` type: `{ stories: SimStory[]; learnings: SessionLearning[]; iterations: number; ... }`
- `SimulationResult` type: `{ p50Days, p80Days, p95Days, onTimeProbability, confidence, iterationsRun }`

**None of these core types are used directly in 54.1** — they will be consumed by 54.3 (Simulation Execution). Story 54.1 only creates the scenario container that will hold the data for later stories.

### Previous Story Intelligence (Epic 53 Stories)

Key patterns from Epic 53 (all 5 stories done):

1. **Pure function pattern**: All computation functions are pure sync. `captureScenarioSnapshot()` MUST follow this pattern — no I/O, deterministic output from input.

2. **Server/Client component split**: Server component (`page.tsx`) calls `getServices()` and aggregation functions, passes data to client component. Client component handles interactivity. This is the pattern for `/scenarios/page.tsx`.

3. **API route pattern**: Use `new URL(request.url)` instead of `request.nextUrl` (which only exists on NextRequest). Export `dynamic = "force-dynamic"`. Return `NextResponse.json(...)`.

4. **Type changes cascade widely**: Adding fields to types requires updating ALL test files. This story adds NEW types (`WhatIfScenario`, `ScenarioStorySnapshot`) which are standalone — does NOT modify existing types.

5. **CSS variable design system**: Use `--color-success`, `--color-warning`, `--color-error`, `--color-text-muted`, `--color-border`, `--color-text-primary`, `--color-accent` — do NOT introduce new color tokens.

6. **Component testing**: Use `@testing-library/react` with `screen`, `within`, `fireEvent`/`userEvent`. Follow existing test patterns.

7. **Build before test**: Always rebuild `@composio/ao-core` after adding new exports to core.

8. **Test count**: 1888+ web tests must continue passing.

### What Already Exists (Do NOT Reinvent)

1. **`/api/sprints/unified/route.ts`** — Returns unified sprint data for all projects. Pattern reference for scenario API routes.

2. **`aggregateUnifiedSprints(config)`** — Already reads all project sprint data. USE THIS to capture current state for scenarios. Do NOT reimplement sprint data reading.

3. **`UnifiedSprintEntry`** — The web type for sprint data. USE as the basis for `ScenarioStorySnapshot` (which captures the relevant fields).

4. **`SimStory`** from core (`{ id: string; domainTags: string[] }`) — The core simulator's story format. `ScenarioStorySnapshot` should include enough data to later convert to `SimStory[]` (in 54.3).

5. **`Scenario`** from core (`{ name: string; storyCount: number; result: SimulationResult }`) — This is a lightweight comparison container. Do NOT extend this for the web. CREATE a separate `WhatIfScenario` type for the web dashboard.

6. **`/sprints/page.tsx`** — Pattern for how server pages work. Follow this pattern for `/scenarios/page.tsx`.

7. **`SprintFilterBar.tsx`** — Pattern for form controls (select, validation, clear). Follow for ScenarioCreator form.

8. **`SprintCard.tsx`** — Pattern for info cards with status badges. Follow for ScenarioCard.

### WhatIfScenario Type Design

```typescript
type ScenarioStatus = "draft" | "simulated" | "applied";

interface ScenarioStorySnapshot {
  id: string;           // Story key (e.g., "54-1-scenario-creation-interface")
  projectId: string;
  status: string;       // Story status at snapshot time ("backlog", "in-progress", "done", etc.)
  domainTags: string[];
}

interface WhatIfScenario {
  id: string;                              // UUID (crypto.randomUUID())
  name: string;                            // User-provided name
  createdAt: string;                       // ISO 8601 timestamp
  projectIds: string[];                    // Selected projects
  stories: ScenarioStorySnapshot[];        // Captured story state
  status: ScenarioStatus;                  // Lifecycle status
  result?: import("@composio/ao-core").SimulationResult;  // Filled by 54.3
}
```

**Why this shape:**
- `id` is a UUID for unique identification (not sequential — scenarios can be deleted)
- `stories` captures a flat snapshot of all stories in selected projects at creation time
- `status` tracks lifecycle: "draft" (just created), "simulated" (54.3 ran simulation), "applied" (54.6 applied to prod)
- `result` is optional — null until 54.3 runs the simulation
- `projectIds` is separate from `stories` to enable project-level filtering without scanning all stories
- No `parameters` field yet — that comes in 54.2 (Scenario Parameter Configuration)

**Important naming distinction:** The core package has `Scenario` (lightweight comparison container). The web package has `WhatIfScenario` (full dashboard scenario object). These serve different purposes and must NOT be conflated.

### Scenario Snapshot Logic

`captureScenarioSnapshot(entries: UnifiedSprintEntry[], projectIds: string[]): ScenarioStorySnapshot[]`

1. Filter `entries` to only those matching `projectIds`
2. For each sprint entry, iterate its stories (derived from `stories.total`, `stories.done`, etc.)
3. Map to `ScenarioStorySnapshot` with id, projectId, status, domainTags

**Important:** `UnifiedSprintEntry` aggregates stories at the sprint level (total/done/inProgress/blocked/backlog counts). Individual story-level detail isn't in `UnifiedSprintEntry`. For the snapshot, we need to get the raw sprint status data.

**Better approach:** Use `readSprintStatus(project)` directly (via `buildSprintDataMap(config)`) to get the per-story status data, then map to `ScenarioStorySnapshot`. The `aggregateUnifiedSprints` function already uses this internally.

**Implementation:** The API route should:
1. Call `getServices()` to get `config`
2. Iterate `projectIds` and call `readSprintStatus(project)` for each
3. From each project's `development_status`, extract individual story entries
4. Map to `ScenarioStorySnapshot[]`
5. Create `WhatIfScenario` with the snapshot

### Scenario Store Design

For Story 54.1, scenarios are stored in-memory. Story 54.5 adds file-based persistence.

```typescript
// packages/web/src/lib/scenario-store.ts
// In-memory store — will be replaced with file persistence in 54.5
const scenarios = new Map<string, WhatIfScenario>();

export function listScenarios(): WhatIfScenario[] { ... }
export function getScenario(id: string): WhatIfScenario | undefined { ... }
export function addScenario(scenario: WhatIfScenario): void { ... }
export function deleteScenario(id: string): boolean { ... }
```

**Why in-memory:** The orchestrator is stateless (flat files + JSONL). Scenarios are exploratory and temporary. File persistence (54.5) will write to `_bmad-output/scenarios/<id>.json`. Until then, in-memory is sufficient for the creation UI and keeps this story's scope tight.

### ScenarioCreator Component Design

```
┌──────────────────────────────────────────────────────────────┐
│ Create New Scenario                                          │
│                                                              │
│ Scenario Name: [________________________]                    │
│                                                              │
│ Select Projects:                                             │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ ☑ Alpha  (15 stories: 5 done, 3 in-progress, 7 backlog) │ │
│ │ ☑ Beta   (8 stories: 2 done, 1 in-progress, 5 backlog)  │ │
│ │ ☐ Gamma  (12 stories: 8 done, 4 backlog)                 │ │
│ │ [Select All] [Deselect All]                              │ │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ [Create Scenario]                                            │
└──────────────────────────────────────────────────────────────┘
```

**Layout:** Card-style form with clear sections. Follows PortfolioFilterBar's clean styling.

**Controls:**
1. **Name input**: Text input with `aria-label="Scenario name"`. Required.
2. **Project checkboxes**: List of projects with story counts. At least one must be selected.
3. **Select All / Deselect All**: Quick toggle buttons.
4. **Create button**: Disabled until valid. Shows spinner during creation.
5. **Validation errors**: Inline below each field.

### ScenarioCard Component Design

```
┌─────────────────────────────────────────┐
│ 📋 "Add 2 More Agents"          [draft] │
│ Created: 2026-04-03                      │
│ Projects: Alpha, Beta                    │
│ Stories: 23 captured                     │
│                                          │
│ [Open] [Delete]                          │
└─────────────────────────────────────────┘
```

**Status badges:**
- `draft` → gray badge
- `simulated` → blue badge (54.3)
- `applied` → green badge (54.6)

### Scenarios Page Structure

```
/scenarios/page.tsx (server component)
  ├── getServices() → config
  ├── Get list of all configured projects with story counts
  ├── Pass to ScenariosView (client component)
  └── ScenariosView
      ├── Heading: "What-If Scenarios"
      ├── ScenarioCreator (create form)
      ├── ScenarioCard grid (existing scenarios)
      └── Empty state (when no scenarios)
```

### API Route Design

```
GET /api/scenarios → WhatIfScenario[]
  - Returns all stored scenarios
  - Empty array if none exist

POST /api/scenarios → WhatIfScenario
  - Body: { name: string; projectIds: string[] }
  - Validates: name non-empty, at least one projectId, all projectIds exist in config
  - Captures snapshot of current story state for selected projects
  - Creates WhatIfScenario with id, name, createdAt, stories, status="draft"
  - Stores in scenario store
  - Returns created scenario

GET /api/scenarios/[id] → WhatIfScenario | 404
  - Returns specific scenario (needed for 54.2, 54.3)
```

### File Structure to Create/Modify

```
packages/web/src/
├── lib/
│   ├── types.ts                              # MODIFY: Add WhatIfScenario, ScenarioStorySnapshot, ScenarioStatus
│   ├── scenario-snapshot.ts                  # NEW: Snapshot capture logic
│   ├── scenario-store.ts                     # NEW: In-memory scenario storage
│   └── __tests__/
│       └── scenario-snapshot.test.ts         # NEW: Unit tests for snapshot logic
├── app/
│   ├── api/
│   │   └── scenarios/
│   │       ├── route.ts                      # NEW: GET/POST for scenarios
│   │       ├── [id]/
│   │       │   └── route.ts                  # NEW: GET single scenario
│   │       └── route.test.ts                 # NEW: API route tests
│   └── scenarios/
│       └── page.tsx                          # NEW: Scenarios page (server component)
├── components/
│   ├── ScenarioCreator.tsx                   # NEW: Create scenario form
│   ├── ScenarioCard.tsx                      # NEW: Scenario display card
│   ├── ScenariosView.tsx                     # NEW: Client wrapper component
│   ├── Navigation.tsx                        # MODIFY: Add /scenarios nav link
│   └── __tests__/
│       ├── ScenarioCreator.test.tsx          # NEW: Form component tests
│       ├── ScenarioCard.test.tsx             # NEW: Card component tests
│       └── ScenariosView.test.tsx            # NEW: View integration tests
```

### Testing Strategy

**Unit tests (scenario-snapshot.test.ts):**
- `captureScenarioSnapshot` returns empty array for no matching projects
- `captureScenarioSnapshot` filters to only selected projects
- `captureScenarioSnapshot` maps stories correctly with id, projectId, status, domainTags
- `captureScenarioSnapshot` handles sprint entries with no stories
- `createScenario` generates UUID and sets createdAt
- `createScenario` sets status to "draft"
- `createScenario` sets result to undefined
- `createScenario` validates name is non-empty
- `createScenario` validates at least one projectId
- Scenario store: add, list, get, delete operations
- Scenario store: get returns undefined for unknown id
- Scenario store: delete returns false for unknown id

**API route tests (route.test.ts):**
- GET /api/scenarios returns empty array initially
- POST /api/scenarios creates scenario with valid input
- POST /api/scenarios rejects empty name
- POST /api/scenarios rejects empty projectIds
- POST /api/scenarios rejects unknown projectId
- GET /api/scenarios/[id] returns scenario by id
- GET /api/scenarios/[id] returns 404 for unknown id

**Component tests (ScenarioCreator.test.tsx):**
- Renders name input and project checkboxes
- Shows project names with story counts
- "Select All" selects all projects
- "Deselect All" deselects all projects
- "Create Scenario" button disabled when name empty
- "Create Scenario" button disabled when no projects selected
- Submitting calls onCreated callback with scenario data
- Shows validation error for empty name on blur
- Shows validation error when no project selected on submit

**Component tests (ScenarioCard.test.tsx):**
- Renders scenario name, date, project count, story count
- Shows correct status badge for "draft"
- Shows correct status badge for "simulated"
- Delete button calls onDelete
- Open button calls onOpen

**Component tests (ScenariosView.test.tsx):**
- Shows empty state when no scenarios
- Shows ScenarioCreator and scenario grid
- Creating a scenario adds it to the grid
- Deleting a scenario removes it from the grid

### NFRs

- **NFR-E1-1:** Scenario creation completes within 2 seconds (API round-trip + snapshot capture)
- **NFR-P1:** Scenarios page loads within 2 seconds
- **NFR-P4:** API endpoints respond within 500ms
- **NFR-S3:** Simulation scenarios do not modify actual system state — snapshots are read-only copies
- **NFR-R2:** Snapshot capture is deterministic — same state always produces same snapshot

### Pre-existing Types (Do NOT modify)

- `UnifiedSprintEntry` — do not modify, only READ for snapshot source
- `UnifiedSprintSummary` — do not modify
- `Scenario` (from core/scenario-comparator.ts) — do not extend or modify. Create separate `WhatIfScenario`
- `SimStory` — do not modify (will be used in 54.3, not this story)
- `SimulationResult` — do not modify (used as optional field in WhatIfScenario)
- `SimulationInput` — do not modify (used in 54.3)
- `computeSprintSummary()` — do not modify
- `aggregateUnifiedSprints()` — do not modify, USE for reading current state

### References

- [Source: epics-cycle-10.md#Epic 54 Story 54.1] — Story definition and ACs
- [Source: prd-cycle-10.md#FR-E1-1] — "Create what-if scenarios" requirement
- [Source: prd-cycle-10.md#NFR-E1-1] — "Simulation completes within 10 seconds"
- [Source: prd-cycle-10.md#NFR-S3] — "Scenarios cannot modify actual system state"
- [Source: packages/core/src/sprint-simulator.ts] — Core simulation engine (for understanding, not used in this story)
- [Source: packages/core/src/scenario-comparator.ts] — Core Scenario type (do NOT extend, create separate WhatIfScenario)
- [Source: packages/web/src/lib/unified-sprint-aggregation.ts] — Sprint data aggregation to use for snapshot
- [Source: packages/web/src/lib/types.ts] — Types to extend with scenario types
- [Source: packages/web/src/components/UnifiedSprintView.tsx] — Pattern for server/client split
- [Source: packages/web/src/components/SprintFilterBar.tsx] — Pattern for form controls
- [Source: packages/web/src/components/SprintCard.tsx] — Pattern for info cards
- [Source: _bmad-output/implementation-artifacts/53-5-sprint-filtering-aggregation.md] — Previous story patterns
- [Source: _bmad-output/implementation-artifacts/53-1-unified-sprint-dashboard.md] — Sprint data flow patterns

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- New files: `scenario-snapshot.ts`, `scenario-store.ts`, `ScenarioCreator.tsx`, `ScenarioCard.tsx`, `ScenariosView.tsx`, and their tests
- New routes: `/api/scenarios/`, `/api/scenarios/[id]/`, `/scenarios/` page
- Modified files: `types.ts`, `Navigation.tsx`
- All existing tests must continue to pass (no regressions)
- Story 54.2 will add parameter editing, 54.3 simulation execution, 54.5 file persistence

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No debug sessions required — all implementations were straightforward.

### Completion Notes List

- All 6 tasks completed with no blockers
- Pure function pattern followed for `captureScenarioSnapshot` and `createScenario`
- ScenarioCreator follows PortfolioFilterBar form pattern with validation
- ScenarioCard follows SprintCard card pattern with status badges
- ScenariosView uses server/client component split per existing patterns
- In-memory scenario store (Map-based) — file persistence deferred to 54.5
- All 1944 tests passing (161 test files), no regressions
- Navigation updated with `/scenarios` link

### Limitations (Deferred Items)

1. Scenario persistence
   - Status: Deferred - Requires file-based storage
   - Requires: JSON file storage for scenarios (Story 54.5)
   - Epic: Story 54.1 / Epic 54
   - Current: Scenarios stored in-memory only (lost on server restart)

2. Scenario parameter modification
   - Status: Deferred - Requires parameter editor UI
   - Requires: Story 54.2 (Scenario Parameter Configuration)
   - Epic: Story 54.1 / Epic 54
   - Current: Scenarios capture state but parameters cannot be modified

3. Simulation execution
   - Status: Deferred - Requires simulation runner UI
   - Requires: Story 54.3 (Simulation Execution Engine)
   - Epic: Story 54.1 / Epic 54
   - Current: No simulation can be run on created scenarios

### File List

**Modified:**
- `packages/web/src/lib/types.ts` — Added `ScenarioStatus`, `ScenarioStorySnapshot`, `WhatIfScenario`, `ScenarioProjectInfo` types; added `SimulationResult` import
- `packages/web/src/components/Navigation.tsx` — Added `/scenarios` nav link
- `packages/web/src/components/__tests__/Navigation.test.tsx` — Added scenarios link assertion
- `packages/web/src/lib/scenario-snapshot.ts` — Removed unnecessary `as ScenarioStatus` cast (L1)
- `packages/web/src/components/ScenarioCreator.tsx` — Moved `ScenarioProjectInfo` to types.ts, re-exports (L3)
- `packages/web/src/components/ScenariosView.tsx` — Added delete error state + error alert (M3)
- `packages/web/src/app/scenarios/page.tsx` — Real story counts from readSprintStatus (H2), import from types.ts (L3)
- `packages/web/src/app/api/scenarios/[id]/route.ts` — Added DELETE handler (H1)
- `packages/web/src/app/api/scenarios/route.test.ts` — Removed unsafe `as never[]` casts (M2), properly typed mocks
- `packages/web/src/components/__tests__/ScenarioCreator.test.tsx` — Wrapped async clicks in `act()` (M5)
- `packages/web/src/components/__tests__/ScenariosView.test.tsx` — Added delete failure test (M3)

**Created:**
- `packages/web/src/lib/scenario-snapshot.ts` — Snapshot capture and scenario creation utilities
- `packages/web/src/lib/scenario-store.ts` — In-memory scenario storage (Map-based)
- `packages/web/src/lib/__tests__/scenario-snapshot.test.ts` — 23 unit tests for snapshot logic
- `packages/web/src/app/api/scenarios/route.ts` — GET/POST API routes for scenarios
- `packages/web/src/app/api/scenarios/[id]/route.ts` — GET/DELETE single scenario by ID
- `packages/web/src/app/api/scenarios/[id]/route.test.ts` — 4 tests for GET and DELETE endpoints (M1)
- `packages/web/src/app/api/scenarios/route.test.ts` — 7 API route tests
- `packages/web/src/components/ScenarioCreator.tsx` — Create scenario form component
- `packages/web/src/components/ScenarioCard.tsx` — Scenario display card component
- `packages/web/src/components/ScenariosView.tsx` — Client wrapper for scenarios page
- `packages/web/src/components/__tests__/ScenarioCreator.test.tsx` — 12 component tests
- `packages/web/src/components/__tests__/ScenarioCard.test.tsx` — 9 component tests
- `packages/web/src/components/__tests__/ScenariosView.test.tsx` — 6 integration tests (5 original + 1 delete error)
- `packages/web/src/app/scenarios/page.tsx` — Scenarios page (server component)

### Code Review Record (2026-04-03)

**Reviewer:** Claude Opus 4.6 (adversarial code review)
**Issues Found:** 2 HIGH, 5 MEDIUM, 3 LOW
**Issues Fixed:** 2 HIGH, 4 MEDIUM, 2 LOW (7 of 10)

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| H1 | HIGH | DELETE handler missing from [id]/route.ts — delete button broken | Fixed |
| H2 | HIGH | Story counts hardcoded to 0 in page.tsx — AC#4 not met | Fixed |
| M1 | MEDIUM | No test file for [id]/route.ts GET endpoint | Fixed |
| M2 | MEDIUM | `as never[]` type casts bypass type safety in route.test.ts | Fixed |
| M3 | MEDIUM | Delete errors silently swallowed — no user feedback | Fixed |
| M4 | MEDIUM | Hardcoded BMAD tracker dynamic import | Deferred (acceptable for 54.1 — follows existing pattern in codebase) |
| M5 | MEDIUM | act() warnings in ScenarioCreator tests | Fixed |
| L1 | LOW | Unnecessary `as ScenarioStatus` cast | Fixed |
| L2 | LOW | ScenarioCard shows project count instead of names | Deferred (data limitation — projectIds only, no names stored) |
| L3 | LOW | Type coupling between page and component | Fixed (ScenarioProjectInfo moved to types.ts) |

**Test Results:** 162 files, 1949 tests passing, 0 regressions
