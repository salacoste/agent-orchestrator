# Epic 54 Retrospective — What-If Simulation Engine

**Date**: 2026-04-29
**Epic**: 54 — What-If Simulation Engine
**Status**: Complete (all 6 stories done)
**Source**: epics-cycle-10.md
**Phase**: Cycle 10 Phase 2 (Intelligence)

## Epic Summary

Epic 54 built the what-if simulation engine, allowing project managers to create scenarios from live sprint state, configure parameters (agent count, capacity, story priorities), run Monte Carlo simulations, compare scenarios side-by-side, persist results across restarts, and apply chosen configurations to production. The full scenario lifecycle — draft, simulated, applied — is tracked through a JSONL event log with revision history.

## Story Delivery

| Story | Title | Tests | Review Fixes | Status |
|-------|-------|-------|-------------|--------|
| 54-1 | Scenario Creation Interface | 55 (23 unit + 11 API + 21 component) | 2H + 4M + 2L (fixed) / 2 deferred | Done |
| 54-2 | Scenario Parameter Configuration | 40 (23 unit + 4 route + 17 component) | 0 (clean) | Done |
| 54-3 | Simulation Execution Engine | 26 (14 unit + 6 route + 6 component) | 0 (clean) | Done |
| 54-4 | Side-by-Side Scenario Comparison | ~25 (10 unit + 7 route + 8 component + 5 card/view) | 2H + 4M + 4L | Done |
| 54-5 | Scenario Persistence and History | 11 (persistence) + updated mocks | 0 (clean) | Done |
| 54-6 | Apply Scenario to Production | 12 (7 route + 5 component) + 1 persistence | 0 (clean) | Done |

**Total new tests**: ~169 (across all 6 stories)
**New modules**: scenario-snapshot.ts, scenario-store.ts, scenario-params.ts, scenario-simulation.ts, scenario-comparison.ts, scenario-persistence.ts, scenario-helpers.ts
**New components**: ScenarioCreator, ScenarioCard, ScenariosView, ScenarioDetail, ScenarioComparisonView
**New pages**: /scenarios, /scenarios/[id], /scenarios/compare
**New API routes**: GET/POST /api/scenarios, GET/DELETE/PATCH /api/scenarios/[id], POST /api/scenarios/[id]/simulate, GET /api/scenarios/compare, POST /api/scenarios/[id]/apply
**External dependencies added**: 0

## What Went Well

1. **Linear dependency chain with zero rework** — Stories were sequenced so each built exactly on the previous: creation (54-1) produced `WhatIfScenario` and the store; parameters (54-2) added `ScenarioParameters` and PATCH; simulation (54-3) consumed both to call `simulateSprint()`; comparison (54-4) used the results; persistence (54-5) wrapped the store with JSONL; apply (54-6) closed the lifecycle. No story required rewriting a previous story's output.

2. **Clean separation between core and web types** — The core package has `Scenario` (lightweight comparison container) and `SimulationResult` (Monte Carlo output). The web package has `WhatIfScenario` (full dashboard object with stories, parameters, status). Thin mapping functions (`buildSimulationInput`, `mapToComparableScenarios`) bridge between them. This avoided conflating the simulation engine's types with the UI's types.

3. **JSONL persistence pattern consistency** — Story 54-5 followed the established `collaboration-store.ts` pattern for JSONL event logging: append-only writes, event replay on load, graceful handling of corrupted lines, `proper-lockfile` for concurrent write safety. Converting the in-memory `Map` store to async file-backed persistence required updating all API route mocks from `mockReturnValue` to `mockResolvedValue`, which was a clean mechanical change.

4. **Pre-scaled simulation results** — The decision to apply parallelism scaling (`agentCount * capacityLimit`) to simulation results before storing them simplified every downstream consumer: ScenarioDetail just renders the result directly, ScenarioComparisonView compares pre-scaled values, and no re-computation is needed on page load.

5. **Code review catching real issues** — The 54-1 review caught DELETE handler missing from the [id] route and hardcoded story counts in the page component. The 54-4 review caught duplicate name guards, `encodeURIComponent` missing from compare URLs, and `selectedIds` not being cleaned up on delete. These were genuine functional bugs, not style nits.

6. **ScenarioStatus lifecycle design** — The three-state lifecycle (`draft` -> `simulated` -> `applied`) was defined in 54-1 and cleanly followed through every subsequent story. Status guards in PATCH, simulate, and apply routes prevented invalid transitions. The `statusBadgeColor` and `statusLabel` helpers handled all three states from the start.

## What Could Be Improved

1. **In-memory to async conversion cascaded widely** — Story 54-5 converting the store from synchronous to asynchronous required updating mock return types in every route test file (6 test files changed from `mockReturnValue` to `mockResolvedValue`). If the store had been async from 54-1, this mechanical change would have been avoided. The lesson: design for persistence from the start, even if the initial implementation is in-memory.

2. **ScenarioCard shows project count instead of names** — Deferred from 54-1 review (L2). The `WhatIfScenario` type stores `projectIds` but not project names. The card displays "2 projects" rather than "Alpha, Beta". This is a UX gap that persists across all stories.

3. **Config write-back deferred** — Story 54-6 applies scenario status to `"applied"` but does not write `agentCount` or `capacityLimit` back to `agent-orchestrator.yaml`. The "apply" is a status transition, not a config mutation. Users must manually copy parameter values. This is the most significant functional gap in the epic.

4. **Story scope modification deferred** — Stories cannot be added to or removed from a scenario after creation (noted in 54-2 limitations). Users must delete and recreate the scenario to change which projects/stories are included.

5. **ScenarioComparisonView fetches data on mount** — The comparison page is a client component that fetches comparison data via `useEffect` on mount. A server component that pre-fetches and passes data as props would have been more aligned with the Next.js App Router pattern used elsewhere (54-1, 54-2 use server components for data fetching).

## Deferred Items Forward

| Item | Deferred To | Story |
|------|------------|-------|
| Config write-back (agentCount/capacityLimit to YAML) | Future epic — requires config mutation API | 54-6 |
| Project names in ScenarioCard | Future enhancement — requires storing names in snapshot | 54-1 |
| Story scope modification (add/remove stories) | Future enhancement | 54-2 |
| Pre-existing resource-conflict.test.ts type errors | Tech debt | — |
| Pre-existing standup-generator.test.ts date failure | Tech debt | — |

## Action Items

| # | Action Item | Owner | Target |
|---|------------|-------|--------|
| 1 | Design async store interface from the start for future features — the sync-to-async conversion in 54-5 touched 6 test files mechanically | Dev | Pattern |
| 2 | Consider pre-fetching data in server components for client-heavy pages (comparison view) | Dev | Pattern |
| 3 | Fix pre-existing standup-generator.test.ts date failure — fails daily | Dev | Tech debt |
| 4 | Fix pre-existing resource-conflict.test.ts type errors | Dev | Tech debt |

## Previous Retro Integration

Epic 53 retrospective (unified sprint view) had no formal retrospective recorded in the artifacts directory. The sprint-status.yaml shows `epic-53: done` with `epic-53-retrospective` not listed. No action items carried forward from Epic 53.

## Next Epics Preview

- **Epic 55** (done): Monte Carlo Forecasting — simulation core, probability visualization, historical velocity learning, automatic forecast updates, accuracy tracking, simulation parameter configuration. 6 stories.
- **Epic 56** (done): Risk and Optimization Dashboard — risk overview, bottleneck identification, risk score calculation, resource optimization. 4 stories.
- **Epic 57** (done): Telegram Bot — notification delivery via Telegram. 4 stories.

All three epics in Cycle 10 Phase 2 (Intelligence) are complete. No blockers.

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 6 |
| Stories with 0 review issues | 3 (54-2, 54-3, 54-5, 54-6) |
| Stories with code review | 2 (54-1: 8 issues, 54-4: 10 issues) |
| Total review issues found | 18 |
| Total new tests | ~169 |
| External dependencies added | 0 |
| New API routes | 6 |
| New components | 5 |
| New pages | 3 |
| New lib modules | 7 |
| Deferred items | 3 (config write-back, project names, story scope) |
| ScenarioStatus lifecycle | draft -> simulated -> applied |
