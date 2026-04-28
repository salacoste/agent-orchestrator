# Story 62.36: Scenario Comparison

Status: done

## Story

As a developer reading the Agent Orchestrator documentation,
I want a comprehensive Scenario Comparison documentation page that documents the scenario creation workflow, what-if parameter editing, Monte Carlo simulation, forecast visualization with histogram, scenario side-by-side comparison, sprint retrospective charts, velocity comparison, rework analysis, and the Monte Carlo forecast API with calibration,
so that I can understand the scenario lifecycle (draft → simulated → applied), the comparison ranking algorithm, the simulation engine's Monte Carlo sampling, configurable simulation parameters, SSE-driven auto-refresh, and how each component connects to backend APIs.

## Acceptance Criteria

1. **Scenario Comparison page** (`docs/web-dashboard/scenario-comparison.md`) documents an "Overview" section describing the three scenario pages: `/scenarios` (listing + creation), `/scenarios/[id]` (detail + parameters + simulation), `/scenarios/compare` (side-by-side ranked comparison) — sourced from `packages/web/src/app/scenarios/page.tsx`, `[id]/page.tsx`, `compare/page.tsx`
2. **Scenario Comparison page** documents a "Scenario Lifecycle" section describing the state machine: `draft` → (PATCH params) → `draft` → (POST simulate) → `simulated` → (POST apply) → `applied`, with transitions enforced by 409 status codes — sourced from API routes under `packages/web/src/app/api/scenarios/`
3. **Scenario Comparison page** documents a "Scenario Listing & Creation" section describing `ScenariosView` with scenario grid (1/2/3 columns responsive), `ScenarioCard` with status badge and relative timestamps, `ScenarioCreator` with project multi-select showing story counts, and validation (name required, ≥1 project, all IDs must exist in config) — sourced from `packages/web/src/components/ScenariosView.tsx`, `ScenarioCard.tsx`, `ScenarioCreator.tsx`
4. **Scenario Comparison page** documents a "Parameter Editor" section describing `ScenarioDetail`'s parameter editor: agent count (1–50, `MIN_AGENT_COUNT`/`MAX_AGENT_COUNT`), capacity limit (1–20, `MIN_CAPACITY`/`MAX_CAPACITY`) with +/– buttons, and story priority list with high/medium/low buttons — sourced from `packages/web/src/components/ScenarioDetail.tsx` and `packages/web/src/lib/scenario-params.ts`
5. **Scenario Comparison page** documents a "Modification Summary" section describing the diff display showing unsaved changes: agent count delta, capacity limit delta, and reprioritized story count — sourced from `ScenarioDetail.tsx` using `ParameterDiff` type
6. **Scenario Comparison page** documents a "Monte Carlo Simulation" section describing: the "Run Simulation" button (disabled when unsaved changes exist or no parameters saved), `simulateSprint()` from `@composio/ao-core` running 1000 iterations (`DEFAULT_ITERATIONS`), story priority sorting (high=0, medium=1, low=2), `applyParallelismScaling()` dividing by `agentCount * capacityLimit`, and result display (p50/p80/p95 days, on-time probability color-coded, confidence label, iterations count) — sourced from `packages/web/src/app/api/scenarios/[id]/simulate/route.ts` and `packages/core/src/sprint-simulator.ts`
7. **Scenario Comparison page** documents a "Monte Carlo Forecast" section describing `MonteCarloChart` with SVG histogram, hover tooltips (date, probability %, cumulative %), percentile vertical dashed lines (P50 green, P80 yellow, P95 red), stat cards for P50/P80/P95 dates and average daily rate, linear comparison section (date + confidence %), forecast calibration section (P50/P80/P95 hit rates, bias), and SSE auto-refresh via `forecast-stale` events with 30-second polling fallback — sourced from `packages/web/src/components/MonteCarloChart.tsx`
8. **Scenario Comparison page** documents a "Simulation Config Panel" section describing `SimulationConfigPanel` with collapsible settings: iterations (1000–100000), confidence levels (P50/P80/P95 checkboxes, min 1), historical data window (0–365 days, 0=all), exclude weekends toggle, "(modified)" badge, reset button — sourced from `packages/web/src/components/SimulationConfigPanel.tsx` and `packages/web/src/lib/useSimulationConfig.ts`
9. **Scenario Comparison page** documents a "Scenario Comparison View" section describing `ScenarioComparisonView` with 2–4 scenario side-by-side ranked comparison, metric table (p50/p80/p95 days, on-time %, confidence), best value per metric highlighted green with checkmark, color dots, "Recommended" badge, warnings in yellow alert box — sourced from `packages/web/src/components/ScenarioComparisonView.tsx`
10. **Scenario Comparison page** documents a "Comparison Ranking Algorithm" section describing: ranking by `onTimeProbability` descending, ties broken by fewer stories (simpler scope preferred), `getSimulationColor()` mapping (>80% green, 50–80% amber, <50% red), `compareScenarios()` pure function from core, and duplicate name detection — sourced from `packages/core/src/scenario-comparator.ts` and `packages/web/src/app/api/scenarios/compare/route.ts`
11. **Scenario Comparison page** documents a "Sprint Comparison Table" section describing `SprintComparisonTable` with 6-week metrics table (velocity, points, cycle time, flow efficiency, WIP, carry, bottleneck), trend badges with arrows (improving/stable/declining) — sourced from `packages/web/src/components/SprintComparisonTable.tsx`
12. **Scenario Comparison page** documents a "Velocity Comparison Table" section describing `VelocityComparisonTable` with sortable columns (rank, project, velocity, progress), trend indicators with colored arrows — sourced from `packages/web/src/components/VelocityComparisonTable.tsx`
13. **Scenario Comparison page** documents a "Retrospective Chart" section describing `RetrospectiveChart` with SVG bar chart of weekly velocity, average velocity dashed line, carry-over indicators, 4 stat cards (total completed, avg velocity, velocity change %, avg cycle time), 30-second polling — sourced from `packages/web/src/components/RetrospectiveChart.tsx`
14. **Scenario Comparison page** documents a "Rework Analysis" section describing rework analysis with 3 stat cards (rework rate, total events, total rework time), horizontal bar chart of rework transitions with SVG, worst offenders list — sourced from `packages/web/src/components/ReworkAnalysis.tsx` (referenced by retro route)
15. **Scenario Comparison page** documents a "Persistence" section describing JSONL-backed storage at `.ao-scenarios/scenarios.jsonl`, event replay on init, revision history tracked in-memory, corrupted line skipping, sort order by `updatedAt` newest first — sourced from `packages/web/src/lib/scenario-persistence.ts`
16. **Scenario Comparison page** documents an "API Routes" section listing the 9 endpoints: `GET/POST /api/scenarios`, `GET/PATCH/DELETE /api/scenarios/[id]`, `POST /api/scenarios/[id]/simulate`, `POST /api/scenarios/[id]/apply`, `GET /api/scenarios/compare`, `GET /api/sprint/[project]/monte-carlo` — with method, purpose, validation rules, and response shapes
17. **Scenario Comparison page** documents a "Key Types" section listing: `WhatIfScenario` (9 fields), `ScenarioParameters` (3 fields), `StoryPriorityOverride` (3 fields), `ScenarioStorySnapshot` (4 fields), `SimulationResult` (6 fields), `SimulationColor` ("green"|"amber"|"red"), `ScenarioStatus` ("draft"|"simulated"|"applied"), `SimulationConfig` (4 fields), `ParameterDiff` (4 fields), `ScenarioProjectInfo` (3 fields) — sourced from `packages/web/src/lib/types.ts` and `packages/core/src/sprint-simulator.ts`
18. **Page uses correct Just the Docs front matter**: `title: Scenario Comparison`, `nav_order: 4`, `parent: Web Dashboard`, `description` field
19. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
20. **Cross-links** verified: parent link to Web Dashboard index, sibling links to other Web Dashboard child pages, Monte Carlo Simulation (62.49), Scenarios API (62.46), Getting Started, Configuration

## Tasks / Subtasks

- [x] Task 1: Write Scenario Comparison page (AC: #1-20)
  - [x] Replace stub content in docs/web-dashboard/scenario-comparison.md
  - [x] Write front matter (title, nav_order: 4, parent: Web Dashboard, description)
  - [x] Write "Overview" section — 3 page routes, server components, data loading (AC #1)
  - [x] Write "Scenario Lifecycle" section — state machine diagram, transitions, 409 enforcement (AC #2)
  - [x] Write "Scenario Listing & Creation" section — grid, cards, creator form, validation (AC #3)
  - [x] Write "Parameter Editor" section — agent count, capacity, priority buttons, bounds (AC #4)
  - [x] Write "Modification Summary" section — diff display, unsaved changes (AC #5)
  - [x] Write "Monte Carlo Simulation" section — engine, iterations, parallelism scaling, results (AC #6)
  - [x] Write "Monte Carlo Forecast" section — histogram, tooltips, percentiles, calibration, SSE (AC #7)
  - [x] Write "Simulation Config Panel" section — settings, localStorage persistence, reset (AC #8)
  - [x] Write "Scenario Comparison View" section — ranked table, highlights, warnings (AC #9)
  - [x] Write "Comparison Ranking Algorithm" section — sorting, color mapping, pure function (AC #10)
  - [x] Write "Sprint Comparison Table" section — weekly metrics, trend badges (AC #11)
  - [x] Write "Velocity Comparison Table" section — sortable columns, trend arrows (AC #12)
  - [x] Write "Retrospective Chart" section — SVG bar chart, velocity stats, polling (AC #13)
  - [x] Write "Rework Analysis" section — stat cards, transition chart, worst offenders (AC #14)
  - [x] Write "Persistence" section — JSONL storage, replay, revision history (AC #15)
  - [x] Write "API Routes" section — 9 endpoints with method/purpose/validation/response (AC #16)
  - [x] Write "Key Types" section — WhatIfScenario, ScenarioParameters, SimulationResult, etc. (AC #17)
  - [x] Write "Next Steps" cross-links section (AC #20)
  - [x] Verify all cross-links exist
  - [x] Verify no hero font classes

## Task Completion Validation

**Task Completion Criteria:**
- All 22 subtasks checked off
- `docs/web-dashboard/scenario-comparison.md` exists with comprehensive content
- Every AC maps to at least one documentation section
- All source file references are accurate
- Cross-links resolve to existing pages

## Source Files

### Page Routes (Server Components)
- `packages/web/src/app/scenarios/page.tsx` — scenario listing
- `packages/web/src/app/scenarios/[id]/page.tsx` — scenario detail
- `packages/web/src/app/scenarios/compare/page.tsx` — comparison view

### Components
- `packages/web/src/components/ScenariosView.tsx` — listing + selection + compare
- `packages/web/src/components/ScenarioCard.tsx` — card in grid
- `packages/web/src/components/ScenarioCreator.tsx` — new scenario form
- `packages/web/src/components/ScenarioDetail.tsx` — full detail/edit page
- `packages/web/src/components/ScenarioComparisonView.tsx` — side-by-side comparison
- `packages/web/src/components/MonteCarloChart.tsx` — SVG histogram forecast
- `packages/web/src/components/SimulationConfigPanel.tsx` — collapsible settings
- `packages/web/src/components/SprintComparisonTable.tsx` — weekly metrics table
- `packages/web/src/components/VelocityComparisonTable.tsx` — cross-project velocity
- `packages/web/src/components/RetrospectiveChart.tsx` — velocity bar chart

### API Routes
- `packages/web/src/app/api/scenarios/route.ts` — GET list, POST create
- `packages/web/src/app/api/scenarios/[id]/route.ts` — GET, PATCH, DELETE
- `packages/web/src/app/api/scenarios/[id]/simulate/route.ts` — POST simulate
- `packages/web/src/app/api/scenarios/[id]/apply/route.ts` — POST apply
- `packages/web/src/app/api/scenarios/compare/route.ts` — GET compare
- `packages/web/src/app/api/sprint/[project]/monte-carlo/route.ts` — GET forecast
- `packages/web/src/app/api/sprint/[project]/retro/route.ts` — GET retrospective
- `packages/web/src/app/api/sprint/[project]/comparison/route.ts` — GET weekly comparison
- `packages/web/src/app/api/sprint/[project]/rework/route.ts` — GET rework data

### Core Engine
- `packages/core/src/sprint-simulator.ts` — Monte Carlo engine, `simulateSprint()`, `getSimulationColor()`
- `packages/core/src/scenario-comparator.ts` — `compareScenarios()`, ranking algorithm

### Lib
- `packages/web/src/lib/scenario-persistence.ts` — JSONL storage
- `packages/web/src/lib/scenario-params.ts` — validation constants
- `packages/web/src/lib/useSimulationConfig.ts` — localStorage config hook

### Types
- `packages/web/src/lib/types.ts` — WhatIfScenario, ScenarioParameters, etc.

## Change Log

- 2026-04-25: Story created from sprint backlog
- 2026-04-25: Wrote comprehensive scenario-comparison.md documentation covering all 20 ACs
- 2026-04-25: Adversarial code review completed — fixed 5 issues: SSE backoff sequence (major), dead link annotation (major), ParameterDiff type notation, SimulationConfig/Result source locations

## Dev Agent Record

### Completion Notes

- Wrote `docs/web-dashboard/scenario-comparison.md` replacing 9-line stub with comprehensive documentation (~350 lines)
- All 20 acceptance criteria covered across 17 documentation sections
- Documented 3 page routes, 9 API endpoints, 11 components, core Monte Carlo engine, ranking algorithm, JSONL persistence
- Front matter includes `description` field (was missing from stub)
- Cross-links: 7 of 8 resolve to existing files; `docs/advanced-topics/monte-carlo-simulation.md` is a forward reference to story 62-49 (backlog)
- No hero font classes used
- Source analysis from 3 parallel subagents provided exhaustive API/component/type coverage

### File List

- `docs/web-dashboard/scenario-comparison.md` — replaced stub with comprehensive documentation
