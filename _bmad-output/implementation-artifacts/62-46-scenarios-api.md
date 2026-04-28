# Story 62.46: Scenarios API

Status: done

## Story

As a developer integrating with the Agent Orchestrator,
I want a comprehensive Scenarios API documentation page that documents all scenario endpoints (CRUD, simulation, comparison, apply) with their request/response shapes, status codes, validation rules, lifecycle state machine, and type definitions,
so that I can programmatically create what-if scenarios, configure parameters, run Monte Carlo simulations, compare results side-by-side, and apply chosen scenarios to production.

## Acceptance Criteria

1. **Scenarios API page** (`docs/api/scenarios.md`) replaces stub with comprehensive content, using Just the Docs front matter: `title: Scenarios API`, `nav_order: 7`, `parent: REST API`, `description` field
2. **Overview section** documents: 5 route files, 8 HTTP endpoints (3 GET, 3 POST, 1 PATCH, 1 DELETE), all export `force-dynamic` — sourced from `packages/web/src/app/api/scenarios/`
3. **Scenario Lifecycle section** documents: 3-state machine (`draft` → `simulated` → `applied`), which endpoints are valid per state, status guards (409 for wrong-state transitions)
4. **List Scenarios section** documents: `GET /api/scenarios`, returns `WhatIfScenario[]` sorted newest first, no query params — sourced from `scenarios/route.ts`
5. **Create Scenario section** documents: `POST /api/scenarios`, request body (name, projectIds), validation pipeline (empty name → 400, empty projectIds → 400, unknown projects → 400), side effects (captures snapshot, generates UUID, persists) — sourced from `scenarios/route.ts`
6. **Get Scenario section** documents: `GET /api/scenarios/{id}`, path param, returns `WhatIfScenario`, 404 when not found — sourced from `scenarios/[id]/route.ts`
7. **Update Parameters section** documents: `PATCH /api/scenarios/{id}`, request body (`ScenarioParameters`), validation via `validateParameters()` (agentCount 1-50, capacityLimit 1-20, priority overrides), 409 when not draft — sourced from `scenarios/[id]/route.ts`
8. **Delete Scenario section** documents: `DELETE /api/scenarios/{id}`, returns `{ ok: true }`, deletable at any status — sourced from `scenarios/[id]/route.ts`
9. **Simulate section** documents: `POST /api/scenarios/{id}/simulate`, no request body, requires parameters configured, runs Monte Carlo via `simulateSprint()` from `@composio/ao-core`, applies parallelism scaling, transitions to `simulated`, enriches response with `color` field — sourced from `scenarios/[id]/simulate/route.ts`
10. **Compare section** documents: `GET /api/scenarios/compare?ids=...`, requires 2-4 unique IDs, filters out draft/no-result scenarios, detects duplicate names, ranking algorithm (onTimeProbability desc, storyCount tiebreaker), enriched response with rank/color/isRecommended — sourced from `scenarios/compare/route.ts`
11. **Apply section** documents: `POST /api/scenarios/{id}/apply`, requires `simulated` status, transitions to `applied`, revision tracking — sourced from `scenarios/[id]/apply/route.ts`
12. **Common Patterns section** documents: `force-dynamic` on all routes, dynamic import of tracker plugin (create), JSONL file-based persistence, parallelism scaling formula, comparison algorithm, revision tracking
13. **Status Codes section** provides consolidated table: 200, 201, 400, 404, 409, 500 with conditions
14. **Key Types section** documents: WhatIfScenario (9 fields), ScenarioStorySnapshot (4 fields), ScenarioParameters (3 fields), StoryPriorityOverride (3 fields), ScenarioStatus (3 values), SimulationResult (6 fields), SimulationColor (3 values), RankedScenario (6 fields), ParameterDiff (4 fields)
15. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
16. **Cross-links** verified: parent link to REST API index, sibling links to other API pages, Getting Started, Configuration

## Tasks / Subtasks

- [x] Task 1: Write Scenarios API page (AC: #1-16)
  - [x] Replace stub content in docs/api/scenarios.md
  - [x] Write front matter (title, nav_order: 7, parent: REST API, description)
  - [x] Write "Overview" section — 5 routes, 8 endpoints, all force-dynamic (AC #1-2)
  - [x] Write "Scenario Lifecycle" section — 3-state machine with guards (AC #3)
  - [x] Write "List Scenarios" section — GET, array response (AC #4)
  - [x] Write "Create Scenario" section — POST, validation, snapshot (AC #5)
  - [x] Write "Get Scenario" section — GET by ID (AC #6)
  - [x] Write "Update Parameters" section — PATCH, validation rules (AC #7)
  - [x] Write "Delete Scenario" section — DELETE (AC #8)
  - [x] Write "Simulate" section — POST, Monte Carlo, scaling, color (AC #9)
  - [x] Write "Compare" section — GET, 2-4 IDs, ranking algorithm (AC #10)
  - [x] Write "Apply" section — POST, status guard (AC #11)
  - [x] Write "Common Patterns" section — force-dynamic, persistence, scaling (AC #12)
  - [x] Write "Status Codes" section — consolidated table (AC #13)
  - [x] Write "Key Types" section — 9 type definitions (AC #14)
  - [x] Write cross-links section (AC #16)
  - [x] Verify all cross-links resolve
  - [x] Verify no hero font classes (AC #15)

## Task Completion Validation

**Task Completion Criteria:**
- All 18 subtasks checked off
- `docs/api/scenarios.md` exists with comprehensive content replacing stub
- Every AC maps to at least one documentation section
- All source file references are accurate
- Cross-links resolve to existing pages
- No hero font classes used
- WhatIfScenario field count verified against source (9 fields)
- SimulationResult field count verified against source (6 fields)
- RankedScenario field count verified against source (6 fields)

## Dev Notes

### Architecture Patterns (from Story 62-41/62-42/62-43/62-44/62-45 learnings)

- Just the Docs front matter MUST include `description` field (was missing from original stub — current stub lacks it)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- Cross-links: parent link to REST API index, sibling links to each API sub-page
- Each section should name its source file(s) for traceability
- Verify cross-links resolve to existing files
- Route counts must be verified against actual file listings
- Type field counts must match actual TypeScript interfaces
- Response shape details must match source code exactly (adversarial code review found issues in 62-42)

### Source Tree — Route Inventory (5 files, 8 endpoints)

| Route File | Method | Endpoint | Description |
|------------|--------|----------|-------------|
| `scenarios/route.ts` | GET | `/api/scenarios` | List all scenarios |
| `scenarios/route.ts` | POST | `/api/scenarios` | Create scenario with snapshot |
| `scenarios/[id]/route.ts` | GET | `/api/scenarios/{id}` | Get single scenario |
| `scenarios/[id]/route.ts` | PATCH | `/api/scenarios/{id}` | Update parameters (draft only) |
| `scenarios/[id]/route.ts` | DELETE | `/api/scenarios/{id}` | Delete scenario |
| `scenarios/[id]/simulate/route.ts` | POST | `/api/scenarios/{id}/simulate` | Run Monte Carlo simulation |
| `scenarios/[id]/apply/route.ts` | POST | `/api/scenarios/{id}/apply` | Apply to production |
| `scenarios/compare/route.ts` | GET | `/api/scenarios/compare` | Side-by-side comparison |

**All 5 routes export `dynamic = "force-dynamic"`.**

### Scenario Lifecycle State Machine

```
[CREATE] POST /api/scenarios --> status: "draft"
[CONFIGURE] PATCH /api/scenarios/{id} --> update parameters (draft only, 409 otherwise)
[SIMULATE] POST /api/scenarios/{id}/simulate --> status: "simulated" (draft only, 409 otherwise)
[APPLY] POST /api/scenarios/{id}/apply --> status: "applied" (simulated only, 409 otherwise)
[DELETE] DELETE /api/scenarios/{id} --> removed at any status
```

### Validation Constants (from scenario-params.ts)

- `MIN_AGENT_COUNT = 1`, `MAX_AGENT_COUNT = 50`
- `MIN_CAPACITY = 1`, `MAX_CAPACITY = 20`
- `DEFAULT_ITERATIONS = 1000` (from scenario-simulation.ts)

### Key Types Field Counts

| Type | Fields | Source |
|------|--------|--------|
| `WhatIfScenario` | 9 (id, name, createdAt, updatedAt?, projectIds, stories, status, parameters?, result?) | `packages/web/src/lib/types.ts` |
| `ScenarioStorySnapshot` | 4 (id, projectId, status, domainTags) | `packages/web/src/lib/types.ts` |
| `ScenarioParameters` | 3 (agentCount, capacityLimit, storyPriorities) | `packages/web/src/lib/types.ts` |
| `StoryPriorityOverride` | 3 (storyId, originalPriority, newPriority) | `packages/web/src/lib/types.ts` |
| `SimulationResult` | 6 (p50Days, p80Days, p95Days, onTimeProbability, confidence, iterationsRun) | `packages/core/src/sprint-simulator.ts` |
| `RankedScenario` | 6 (name, storyCount, result, rank, color, isRecommended) | `packages/core/src/scenario-comparator.ts` |
| `ParameterDiff` | 4 (agentCount, capacityLimit, priorityChanges, hasChanges) | `packages/web/src/lib/types.ts` |

### Key Behavioral Patterns

- **All routes export `force-dynamic`**: Unlike some other API groups (e.g., dependencies, portfolio), all scenario routes explicitly disable Next.js caching
- **JSONL file-based persistence**: Scenarios stored in `.ao-scenarios/scenarios.jsonl` via `scenario-persistence.ts` — not in-memory, survives server restarts
- **Dynamic import pattern**: Create route dynamically imports `@composio/ao-plugin-tracker-bmad` per project to read sprint status — individual project read failures are non-fatal
- **Parallelism scaling**: `applyParallelismScaling()` divides p50/p80/p95 day predictions by `agentCount * capacityLimit`, clamped to minimum 1 day
- **Comparison ranking**: `compareScenarios()` from `@composio/ao-core` ranks by `onTimeProbability` descending, ties broken by fewer `storyCount`
- **Color assignment**: `getSimulationColor()` maps `onTimeProbability` to green (>0.8), amber (0.5-0.8), red (<0.5)
- **Status guards**: PATCH requires draft (409), simulate requires draft (409), apply requires simulated (409)
- **Snapshot capture**: `captureScenarioSnapshot()` extracts current story state at creation time — snapshot is immutable after creation
- **Revision tracking**: `updateScenario()` tracks revisions (apply route leverages this for audit trail)

### Supporting Libraries (document for import traceability)

| Library | Functions Used | Route(s) |
|---------|---------------|----------|
| `@/lib/scenario-store` | `listScenarios`, `addScenario`, `getScenario`, `updateScenario`, `deleteScenario` | All routes |
| `@/lib/scenario-snapshot` | `captureScenarioSnapshot`, `createScenario` | Create |
| `@/lib/scenario-simulation` | `buildSimulationInput`, `applyParallelismScaling` | Simulate |
| `@/lib/scenario-params` | `validateParameters` | PATCH |
| `@/lib/scenario-comparison` | `mapToComparableScenarios` | Compare |
| `@/lib/services` | `getServices` | Create, Simulate |
| `@composio/ao-core` | `simulateSprint`, `getSimulationColor`, `compareScenarios` | Simulate, Compare |
| `@composio/ao-plugin-tracker-bmad` | `tracker.readSprintStatus()` (dynamic) | Create |

### Testing Standards

- Verify documentation accuracy against source code (adversarial code review)
- Check all route counts match actual file listings (5 files, 8 endpoints)
- Verify API endpoint parameters and response shapes match route implementations
- Confirm status guard messages match source exactly (409 error messages)
- Validate validation constants match source (MIN/MAX values)
- Verify WhatIfScenario has 9 fields, SimulationResult has 6, RankedScenario has 6
- Confirm lifecycle state transitions match route implementations
- Verify all `force-dynamic` exports documented

### Project Structure Notes

- Doc file location: `docs/api/scenarios.md`
- Nav order: 7 (seventh child under REST API)
- Parent: REST API (`docs/api/index.md`)
- Sibling pages: sessions (1), sprints (2), agents (3), events (4), portfolio (5), dependencies (6), conflicts (8), risk (9)
- Current stub references "Story 62.19" — incorrect, this is Story 62-46
- All scenario routes live under `/api/scenarios/` — no other directories involved

### References

- [Source: _bmad-output/planning-artifacts/epics-documentation.md#Story 62.46]
- [Source: packages/web/src/app/api/scenarios/route.ts — CRUD (GET/POST)]
- [Source: packages/web/src/app/api/scenarios/[id]/route.ts — CRUD (GET/PATCH/DELETE)]
- [Source: packages/web/src/app/api/scenarios/[id]/simulate/route.ts — Monte Carlo simulation]
- [Source: packages/web/src/app/api/scenarios/[id]/apply/route.ts — Apply to production]
- [Source: packages/web/src/app/api/scenarios/compare/route.ts — Side-by-side comparison]
- [Source: packages/web/src/lib/types.ts — WhatIfScenario, ScenarioParameters, etc.]
- [Source: packages/web/src/lib/scenario-params.ts — validateParameters, constants]
- [Source: packages/web/src/lib/scenario-simulation.ts — buildSimulationInput, applyParallelismScaling]
- [Source: packages/web/src/lib/scenario-comparison.ts — mapToComparableScenarios]
- [Source: packages/web/src/lib/scenario-snapshot.ts — captureScenarioSnapshot, createScenario]
- [Source: packages/core/src/sprint-simulator.ts — SimulationResult, simulateSprint, getSimulationColor]
- [Source: packages/core/src/scenario-comparator.ts — RankedScenario, compareScenarios]

## Change Log

- 2026-04-26: Story created from sprint backlog
- 2026-04-26: Replaced 9-line stub with comprehensive Scenarios API documentation (~320 lines) covering 5 routes, 8 endpoints, lifecycle state machine, Monte Carlo simulation, comparison algorithm, 9 type definitions
- 2026-04-26: Adversarial code review — 8 issues found and fixed. Key findings: (H1) ParameterDiff agentCount/capacityLimit are nullable objects not plain numbers, (M1) list sort is by updatedAt??createdAt not creation time, (M2) omitted storyId-must-exist validation rule, (M3-M5) color boundary and tiebreaker precision, comparison recommendedIndex scope

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes

- Replaced `docs/api/scenarios.md` stub (9 lines) with comprehensive documentation (~320 lines)
- All 16 acceptance criteria covered across 12+ sections
- Sections: Overview, Scenario Lifecycle, List Scenarios, Create Scenario, Get Scenario, Update Parameters, Delete Scenario, Simulate Scenario, Compare Scenarios, Apply Scenario, Common Patterns, Status Codes, Key Types (9 types documented), cross-links
- Front matter includes `description` field (was missing from stub)
- Cross-links: parent REST API, 4 sibling API pages (sprints, agents, dependencies, events), getting-started pages
- No hero font classes used
- Route counts verified: 5 route files, 8 endpoints (3 GET, 3 POST, 1 PATCH, 1 DELETE), all `force-dynamic`
- WhatIfScenario: 9 fields verified, SimulationResult: 6 fields verified, RankedScenario: 6 fields verified
- Lifecycle state machine documented: draft → simulated → applied with status guards (409)
- Validation constants documented: agentCount 1-50, capacityLimit 1-20, iterations 1000
- Color thresholds documented: green >0.8, amber >=0.5 and <=0.8, red <0.5
- Comparison algorithm documented: ranked by onTimeProbability desc, storyCount tiebreaker
- Parallelism scaling documented: divides by agentCount * capacityLimit, min 1 day

### Code Review Results

- 8 issues found and fixed in `docs/api/scenarios.md`
- **HIGH (1)**: ParameterDiff agentCount/capacityLimit are `{ original: number; modified: number } | null`, not plain `number`
- **MEDIUM (5)**: List sort precision (updatedAt??createdAt), missing storyId validation rule, color boundary explicitness, comparison tiebreaker 0.01 tolerance, recommendedIndex scope (post-filtering)
- **LOW (2)**: Update Parameters 409 error message exact wording, DEFAULT_ITERATIONS grouped separately from validation constants
- All issues fixed in-place

### File List

- `docs/api/scenarios.md` — replaced stub with comprehensive Scenarios API documentation
