# Story 62.49: Monte Carlo Simulation

Status: done

## Story

As a user planning sprints with the Agent Orchestrator,
I want a comprehensive Monte Carlo Simulation guide that documents the simulation engine, forecasting parameters, scenario system, result interpretation, and configuration with practical examples,
so that I can use probabilistic forecasting to make data-driven decisions about sprint timelines and resource allocation.

## Acceptance Criteria

1. **Monte Carlo Simulations page** (`docs/advanced/monte-carlo.md`) replaces stub with comprehensive content, using Just the Docs front matter: `title: Monte Carlo Simulations`, `nav_order: 2`, `parent: Advanced Topics`, `description` field
2. **Overview section** introduces Monte Carlo simulation in the agent orchestration context — two engines (core simulator + plugin forecaster), links to Scenarios API docs
3. **Core Simulation Engine section** documents: `simulateSprint()` pure function, `SimStory`, `SimulationInput`, `SimulationResult` types, seeded LCG random, domain tag matching, duration sampling, percentile extraction (P50/P80/P95), constants (DEFAULT_DURATION_MS=4h, MS_PER_DAY) — sourced from `packages/core/src/sprint-simulator.ts`
4. **Sprint Forecaster section** documents: `computeForecast()` percentile-based estimation, `SprintForecast`, `BacklogStory`, `ConfidenceLevel` (high/medium/low/insufficient), confidence thresholds (20+/10+/5+/<5), default duration fallback (2h) — sourced from `packages/core/src/sprint-forecaster.ts`
5. **What-If Scenario System section** documents: 3-state lifecycle (draft→simulated→applied), `WhatIfScenario`, `ScenarioParameters` (agentCount 1-50, capacityLimit 1-20, storyPriorities), snapshot capture, parallelism scaling, scenario comparison — sourced from `packages/web/src/lib/scenario-*.ts`
6. **Simulation Parameters section** documents: iterations (1-10000 default 1000 for core, 1000-100000 for plugin), `SimulationConfig` (simulations default 5000, confidenceLevels, throughputWindowDays 0-365, excludeWeekends), parameter validation rules, default/fallback values — sourced from `packages/web/src/lib/scenario-params.ts`, `packages/web/src/lib/useSimulationConfig.ts`
7. **Result Interpretation section** documents: P50/P80/P95 meaning, on-time probability calculation, confidence score (ratio of stories with matching historical data), color coding (green >0.8, amber >=0.5, red <0.5), histogram and calibration (plugin engine) — sourced from `packages/core/src/sprint-simulator.ts`
8. **Forecast Change Detection section** documents: significant change detection (>2 day P50 shift), SSE broadcast via `broadcastForecastChange()`, LRU cache for last forecast, JSONL forecast log — sourced from `packages/web/src/lib/forecast-change-broadcaster.ts`, API route
9. **Session Learning Integration section** documents: `SessionLearning` type, `domainTags` matching, `outcome` filtering (completed only), how historical data feeds both engines — sourced from `packages/core/src/types.ts`
10. **API Endpoints reference** section lists simulation-related endpoints with links to API docs: `/api/sprint/simulate`, `/api/sprint/{project}/monte-carlo`, `/api/scenarios/{id}/simulate`, `/api/scenarios/compare`, `/api/scenarios/{id}/apply` — linking to Scenarios API docs
11. **Config Examples section** provides practical examples: (a) basic simulation via API, (b) scenario creation + simulation + comparison workflow, (c) per-project simulation config
12. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
13. **Cross-links** verified: parent link to Advanced Topics, sibling links to other advanced pages, links to API docs (Scenarios), Getting Started, Configuration
14. **Front matter** includes `description` field

## Tasks / Subtasks

- [x] Task 1: Write Monte Carlo Simulations page (AC: #1-14)
  - [x] Replace stub content in docs/advanced/monte-carlo.md
  - [x] Write front matter (title, nav_order: 2, parent: Advanced Topics, description) (AC #1, #14)
  - [x] Write "Overview" section — two engines, concept introduction, links to Scenarios API (AC #2)
  - [x] Write "Core Simulation Engine" section — simulateSprint(), types, algorithm, constants (AC #3)
  - [x] Write "Sprint Forecaster" section — percentile estimation, confidence levels, thresholds (AC #4)
  - [x] Write "What-If Scenario System" section — lifecycle, parameters, snapshots, scaling, comparison (AC #5)
  - [x] Write "Simulation Parameters" section — iterations, config, validation, defaults (AC #6)
  - [x] Write "Result Interpretation" section — percentiles, probability, confidence, colors (AC #7)
  - [x] Write "Forecast Change Detection" section — P50 shift, SSE broadcast, cache (AC #8)
  - [x] Write "Session Learning Integration" section — domainTags, outcome filter, data flow (AC #9)
  - [x] Write "API Endpoints" reference section — list with links (AC #10)
  - [x] Write "Config Examples" section — 3 practical examples (AC #11)
  - [x] Write cross-links section (AC #13)
  - [x] Verify all cross-links resolve
  - [x] Verify no hero font classes (AC #12)

## Task Completion Validation

**Task Completion Criteria:**
- All subtasks checked off
- `docs/advanced/monte-carlo.md` exists with comprehensive content replacing stub
- Every AC maps to at least one documentation section
- All source file references are accurate
- Cross-links resolve to existing pages
- No hero font classes used
- Type field counts match source code
- Constants and defaults match source

## Dev Notes

### Architecture Patterns (from Story 62-48 learnings)

- Just the Docs front matter MUST include `description` field (current stub lacks it)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- Cross-links: parent link to Advanced Topics index, sibling links to each advanced sub-page
- Each section should name its source file(s) for traceability
- Verify cross-links resolve to existing files
- Type field counts must match actual TypeScript interfaces
- This is an **advanced guide page** (not an API reference page), so it should focus on concepts, config examples, and behavioral explanations with links to the API docs for endpoint details

### Source Tree — Core Modules (2 files)

| Module | Purpose | Source |
|--------|---------|--------|
| `sprint-simulator.ts` | Core Monte Carlo engine: seeded LCG, domain tag matching, percentile extraction, color coding | `packages/core/src/sprint-simulator.ts` |
| `sprint-forecaster.ts` | Percentile-based forecasting: domain-matched historical analysis, confidence scoring | `packages/core/src/sprint-forecaster.ts` |

### Source Tree — Web-Layer Libraries (7 files)

| Module | Purpose | Source |
|--------|---------|--------|
| `scenario-simulation.ts` | buildSimulationInput(), applyParallelismScaling(), DEFAULT_ITERATIONS=1000 | `packages/web/src/lib/scenario-simulation.ts` |
| `scenario-params.ts` | Parameter validation (agentCount 1-50, capacityLimit 1-20), computeParameterDiff(), applyParameterDefaults() | `packages/web/src/lib/scenario-params.ts` |
| `scenario-store.ts` | Thin async wrapper around file-based persistence | `packages/web/src/lib/scenario-store.ts` |
| `scenario-persistence.ts` | JSONL event sourcing at `.ao-scenarios/scenarios.jsonl` | `packages/web/src/lib/scenario-persistence.ts` |
| `scenario-snapshot.ts` | captureScenarioSnapshot(), createScenario() | `packages/web/src/lib/scenario-snapshot.ts` |
| `scenario-comparison.ts` | mapToComparableScenarios(), getBestMetricIndex() | `packages/web/src/lib/scenario-comparison.ts` |
| `forecast-change-broadcaster.ts` | Pub/sub for forecast changes, broadcastForecastChange() | `packages/web/src/lib/forecast-change-broadcaster.ts` |
| `useSimulationConfig.ts` | React hook for per-project simulation config (localStorage) | `packages/web/src/lib/useSimulationConfig.ts` |

### Source Tree — API Routes (5 route files)

| Route File | Method | Endpoint | Description |
|------------|--------|----------|-------------|
| `sprint/simulate/route.ts` | GET | `/api/sprint/simulate` | Cross-project simulation (core engine) |
| `sprint/[project]/monte-carlo/route.ts` | GET | `/api/sprint/{project}/monte-carlo` | Per-project forecast (plugin engine) |
| `scenarios/route.ts` | GET, POST | `/api/scenarios` | List, create scenarios |
| `scenarios/[id]/route.ts` | GET, PATCH, DELETE | `/api/scenarios/{id}` | Get, update params, delete |
| `scenarios/[id]/simulate/route.ts` | POST | `/api/scenarios/{id}/simulate` | Run Monte Carlo on scenario |
| `scenarios/[id]/apply/route.ts` | POST | `/api/scenarios/{id}/apply` | Apply simulated scenario |
| `scenarios/compare/route.ts` | GET | `/api/scenarios/compare` | Side-by-side comparison |

Note: The Scenarios API (`docs/api/scenarios.md`) already documents these endpoints in detail. This guide page links to that doc rather than duplicating endpoint details.

### Key Types

| Type | Fields | Source |
|------|--------|--------|
| `SimStory` | 2 (id, domainTags) | `packages/core/src/sprint-simulator.ts` |
| `SimulationInput` | 6 (stories, learnings, iterations, sprintEndMs, defaultDurationMs, seed) | `packages/core/src/sprint-simulator.ts` |
| `SimulationResult` | 6 (p50Days, p80Days, p95Days, onTimeProbability, confidence, iterationsRun) | `packages/core/src/sprint-simulator.ts` |
| `SimulationColor` | 3 values: "green", "amber", "red" | `packages/core/src/sprint-simulator.ts` |
| `ConfidenceLevel` | 4 values: "high", "medium", "low", "insufficient" | `packages/core/src/sprint-forecaster.ts` |
| `SprintForecast` | 9 (p50Ms, p80Ms, p95Ms, backlogCount, sampleCount, confidence, p50Date, p80Date, p95Date) | `packages/core/src/sprint-forecaster.ts` |
| `BacklogStory` | 2 (storyId, domainTags) | `packages/core/src/sprint-forecaster.ts` |
| `SessionLearning` | 14 (sessionId, agentId, storyId, projectId, outcome, durationMs, retryCount, filesModified, testsAdded, errorCategories, domainTags, completedAt, capturedAt, ...) | `packages/core/src/types.ts` |
| `ScenarioStatus` | 3 values: "draft", "simulated", "applied" | `packages/web/src/lib/types.ts` |
| `ScenarioParameters` | 3 (agentCount, capacityLimit, storyPriorities) | `packages/web/src/lib/types.ts` |
| `StoryPriority` | 3 values: "high", "medium", "low" | `packages/web/src/lib/types.ts` |
| `WhatIfScenario` | 9 (id, name, createdAt, updatedAt, projectIds, stories, status, parameters, result) | `packages/web/src/lib/types.ts` |
| `SimulationConfig` | 4 (simulations, confidenceLevels, throughputWindowDays, excludeWeekends) | `packages/web/src/lib/useSimulationConfig.ts` |

### Key Behavioral Patterns

- **Seeded RNG**: LCG-based random number generator — deterministic when seed provided, reproducible simulations
- **Domain tag matching**: Stories matched to historical learnings via `domainTags` array — only `outcome: "completed"` sessions used
- **Duration sampling**: Each iteration randomly picks a duration from matched historical sessions for each story
- **Percentile extraction**: Sort iteration totals, pick values at 50th, 80th, 95th percentiles
- **On-time probability**: Ratio of iterations completing before `sprintEndMs` deadline
- **Confidence score**: Ratio of stories with ≥1 matching historical learning (low confidence = many stories without historical data)
- **Color coding**: green (>0.8 probability), amber (>=0.5), red (<0.5)
- **Parallelism scaling**: Day predictions divided by agentCount × capacityLimit, clamped to min 1 day
- **Scenario lifecycle**: draft (editable) → simulated (has result) → applied (committed to production)
- **Forecast change detection**: P50 shift >2 days triggers SSE broadcast to subscribers
- **LRU cache**: Last forecast per project cached (200 entries) for change detection
- **JSONL persistence**: Scenario events and forecast snapshots appended to JSONL files
- **Sprint forecaster fallback**: If <3 domain-matched learnings, falls back to all completed sessions; if still <3, uses default 2h duration
- **Confidence thresholds**: ≥20 samples = "high", ≥10 = "medium", ≥5 = "low", <5 = "insufficient"
- **Validation**: agentCount 1-50, capacityLimit 1-20, simulations 1000-100000 (plugin) or 1-10000 (core)
- **Default durations**: Core engine = 4h (14,400,000ms), forecaster = 2h when no historical data
- **MS_PER_DAY**: 86,400,000ms — used for millisecond-to-day conversion
- **Priority ordering in scenarios**: high=0, medium=1, low=2 — affects simulation input ordering

### Two Engines Architecture

The system has two distinct simulation engines:

1. **Core Engine** (`sprint-simulator.ts`): `simulateSprint()` pure function. Takes stories + historical learnings, runs N iterations sampling from domain-matched durations, produces P50/P80/P95 day estimates, on-time probability, and confidence. Used by `/api/sprint/simulate` (cross-project) and `/api/scenarios/{id}/simulate` (what-if).

2. **Plugin-Based Engine** (`@composio/ao-plugin-tracker-bmad`): `computeMonteCarloForecast()`. Used by `/api/sprint/{project}/monte-carlo` (per-project). Includes throughput-window-based analysis, histogram output, calibration scoring, and forecast change detection. Parameters: simulations (1000-100000), throughputWindowDays (0-365), excludeWeekends (default true), confidenceLevels filter.

Both engines rely on `SessionLearning` data matched via `domainTags`.

### Testing Standards

- Verify YAML/config examples are valid
- Verify type field counts match source
- Verify constants match source (DEFAULT_DURATION_MS=14,400,000, MS_PER_DAY=86,400,000, DEFAULT_ITERATIONS=1000)
- Verify color thresholds (green >0.8, amber >=0.5, red <0.5)
- Verify confidence thresholds (20+/10+/5+/<5)
- Verify validation ranges (agentCount 1-50, capacityLimit 1-20)
- Verify cross-links resolve to existing pages
- Verify no hero font classes

### Project Structure Notes

- Doc file location: `docs/advanced/monte-carlo.md`
- Nav order: 2 (second child under Advanced Topics, after cross-project)
- Parent: Advanced Topics (`docs/advanced/index.md`)
- Sibling pages: cross-project (1), custom-plugins (3), hooks-extensions (4), prompt-layers (5), production-deployment (6)
- Current stub says "Story 62.21" — incorrect, this is Story 62-49
- API endpoint details live in `docs/api/scenarios.md` — link to that, don't duplicate
- This is an **advanced guide** page (concepts + config + behavior + interpretation), NOT an API reference page

### References

- [Source: _bmad-output/planning-artifacts/epics-documentation.md#Story 62.49]
- [Source: packages/core/src/sprint-simulator.ts — Core Monte Carlo engine, simulateSprint(), types]
- [Source: packages/core/src/sprint-forecaster.ts — Percentile forecaster, computeForecast(), confidence levels]
- [Source: packages/core/src/types.ts:1954-1981 — SessionLearning interface]
- [Source: packages/web/src/lib/types.ts:466-549 — Scenario types, WhatIfScenario, ScenarioParameters]
- [Source: packages/web/src/lib/scenario-simulation.ts — buildSimulationInput(), applyParallelismScaling()]
- [Source: packages/web/src/lib/scenario-params.ts — Parameter validation, defaults]
- [Source: packages/web/src/lib/scenario-persistence.ts — JSONL event sourcing]
- [Source: packages/web/src/lib/scenario-snapshot.ts — Snapshot capture]
- [Source: packages/web/src/lib/scenario-comparison.ts — Scenario comparison helpers]
- [Source: packages/web/src/lib/forecast-change-broadcaster.ts — SSE forecast change pub/sub]
- [Source: packages/web/src/lib/useSimulationConfig.ts — Per-project simulation config hook]
- [Source: packages/web/src/app/api/sprint/simulate/route.ts — Cross-project simulation API]
- [Source: packages/web/src/app/api/sprint/[project]/monte-carlo/route.ts — Per-project Monte Carlo API]
- [Source: packages/web/src/app/api/scenarios/ — Scenario CRUD, simulation, comparison, apply]
- [Source: docs/api/scenarios.md — Scenarios API documentation]

## Change Log

- 2026-04-27: Story created from sprint backlog
- 2026-04-27: Replaced 10-line stub in `docs/advanced/monte-carlo.md` with comprehensive Monte Carlo Simulations guide covering 2 core modules, 6 web-layer libraries, 7 API routes, core simulation engine, sprint forecaster, what-if scenario system, simulation parameters, result interpretation, forecast change detection, session learning integration, and 3 config examples
- 2026-04-27: Adversarial code review — 1 MEDIUM, 2 LOW issues found, all fixed. MEDIUM: iterations default attribution clarified (API/scenario default, not core function). LOW: added note explaining 5000 vs 1000 iteration defaults. LOW: expanded Forecast Log section.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7

### Debug Log References

### Completion Notes List

- Replaced `docs/advanced/monte-carlo.md` stub (10 lines) with comprehensive documentation
- All 14 acceptance criteria covered across 12 sections
- Sections: Two Engines (comparison table), Core Simulation Engine (input/output/algorithm/constants/color), Sprint Forecaster (input/output/algorithm/confidence), What-If Scenario System (lifecycle/structure/parameters/validation/snapshot/scaling/comparison), Simulation Parameters (core/plugin/per-project), Result Interpretation (percentiles/probability/confidence/guide), Forecast Change Detection (detection/SSE/log), Session Learning Integration (type/data flow/domain tags), API Endpoints (7 routes with links), Config Examples (3 examples)
- Front matter includes `description` field (was missing from stub)
- Cross-links verified: parent Advanced Topics, 5 sibling pages, Scenarios API, 3 getting-started pages
- No hero font classes used
- All code blocks use correct syntax highlighting (typescript, bash, json)
- API endpoint details linked to existing Scenarios API docs (no duplication)
- 3 practical config examples: basic API simulation, per-project forecast, full scenario workflow
- Type interfaces documented inline with field descriptions matching source code
- Constants verified: DEFAULT_DURATION_MS=14,400,000, MS_PER_DAY=86,400,000, DEFAULT_ITERATIONS=1000
- Color thresholds verified: green >0.8, amber >=0.5, red <0.5
- Confidence thresholds verified: high >=20, medium >=10, low >=5, insufficient <5

### File List

- `docs/advanced/monte-carlo.md` — replaced stub with comprehensive Monte Carlo Simulations guide

## Senior Developer Review (AI)

**Reviewer:** R2d2 (AI-assisted) on 2026-04-27

### Review Findings

**Issues Found:** 0 HIGH, 1 MEDIUM, 2 LOW = 3 total
**Issues Fixed:** 3

#### MEDIUM Issues

1. **`iterations` default attribution misleading**: The "Core Engine Parameters" table listed `iterations` default as 1000, but the core `simulateSprint()` function requires `iterations` as a mandatory parameter with no default. The value 1000 is applied by the API route and scenario builder. **Fixed** — added footnote clarifying the default is API/scenario-level, not function-level.

#### LOW Issues

2. **Simulation defaults discrepancy unexplained**: The plugin engine defaults to 5,000 iterations while the scenario builder uses 1,000. No explanation for the difference. **Fixed** — added Just the Docs `{:.note}` callout explaining the tradeoff (precision vs interactive speed).

3. **Forecast Log section too brief**: Single-line section with no details about log format or location. **Fixed** — expanded to describe what each entry contains (project ID, parameters, results, timestamp) and its purpose (trend analysis).

### Verification Summary

- All 12 type interfaces verified against source code (field counts match)
- All constants verified (DEFAULT_DURATION_MS, MS_PER_DAY, DEFAULT_ITERATIONS)
- Color thresholds verified (green >0.8, amber >=0.5, red <0.5)
- Confidence thresholds verified (>=20, >=10, >=5, <5)
- Parameter validation ranges verified (agentCount 1-50, capacityLimit 1-20)
- Algorithm steps match source logic
- Empty input behavior matches source
- Parallelism scaling formula matches source
- All 14 ACs verified implemented
- All 10 cross-links resolve to existing pages
- No hero font classes

### Outcome

**APPROVED** — All issues fixed. Documentation accurately reflects source code types, constants, and behavior.
