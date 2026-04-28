# Epic 51 Retrospective — Cross-Project Dependencies

**Date**: 2026-04-29
**Epic**: 51 — Cross-Project Dependencies
**Status**: Complete (5 done, 1 in review)
**Source**: epics-cycle-10.md

## Epic Summary

Epic 51 delivered the cross-project dependency system: defining dependencies between stories in different projects, tracking their status in real time, automatically unblocking dependent stories when prerequisites complete, rendering a portfolio-wide dependency graph, notifying teams when dependencies block for extended periods, and detecting circular dependency chains before they are created. The system operates entirely through pure sync functions backed by YAML file persistence, with zero external dependencies.

The six stories form a clean dependency chain: definition (51-1) enables status tracking (51-2), which enables auto-unblocking (51-3), visualization (51-4), notifications (51-5), and finally cycle prevention (51-6). Each story built on the pure function pattern established by its predecessor, creating a cohesive module (`cross-project-deps.ts`) that grew from a single type + file store into a 15-export library with 80+ tests.

## Story Delivery

| Story | Title | Tests | Review Fixes | Agent | Status |
|-------|-------|-------|-------------|-------|--------|
| 51-1 | Cross-Project Dependency Definition | 58 (35 core + 9 store + 14 API) | Not recorded | Opus 4.6 | Done |
| 51-2 | Dependency Status Tracking | 33 (19 core + 14 API) | Not recorded | Opus 4.6 | Review |
| 51-3 | Automatic Story Unblocking | 16 (10 core + 6 route) | 6 (1H + 3M + 2L) | Opus 4.6 | Done |
| 51-4 | Cross-Project Dependency Graph | 18 (8 core + 3 API + 7 component) | 8 (3H + 3M + 2L) | Opus 4.6 | Done |
| 51-5 | Dependency Blocking Notifications | ~40 (core + store + notifier + API) | 23 (7H + 10M + 6L) | Sonnet 4.5 | Done |
| 51-6 | Circular Dependency Detection | 17 (13 core + 4 route) | 0 (clean) | Sonnet 4.5 | Review |

**Total new tests**: ~182 (core + web)
**New modules**: cross-project-deps.ts, cross-project-blocking-times.ts, cross-project-blocking-notifier.ts, CrossProjectGraphView.tsx, status-colors.ts
**External dependencies added**: 0
**Code reviews**: 3+ reviews with 37+ issues caught and fixed
**Core module growth**: `cross-project-deps.ts` grew from ~200 lines (51-1) to ~900+ lines (51-6) across the epic

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) — project vision, priorities, user outcomes
- Nova (Architect) — system design, interfaces, extensibility
- Blaze (Dev) — implementation, patterns, pain points
- Pax (QA) — test quality, edge cases, deferred items

---

### What Went Well

**R2d2 (Project Lead):** Epic 51 delivered the single most requested feature for multi-project portfolios — knowing when your story is blocked by work in another project. The dependency graph gives portfolio managers an at-a-glance view of cross-project relationships, and the auto-unblocking means teams do not have to manually poll. The blocking notifications with configurable thresholds hit the right balance between awareness and spam. Six stories, zero external dependencies, and a clean layered architecture.

**Nova (Architect):** Three architectural patterns stood out in this epic:

1. **Pure sync function cascade** — Every story added pure functions that accept pre-fetched data (SprintDataMap, dependency arrays) and return computed results. No I/O in core logic. The file store adapter handles async persistence. This made every function independently testable and composable. `addCrossProjectDependency` -> `resolveDependencyStatus` -> `areCrossProjectDepsSatisfied` -> `autoUnblockCrossProjectDeps` form a clean pipeline.

2. **SprintDataMap as the integration contract** — Rather than each story defining its own cross-project data access pattern, SprintDataMap (`Record<string, { development_status: Record<string, string> }>`) became the shared data contract. Every consumer builds it the same way (iterate projects, call `readSprintStatus`, flatten entries). Extracting `buildSprintDataMap` to a shared utility in 51-3 eliminated code duplication across routes.

3. **Separation of persisted types vs. view models** — `CrossProjectDependency` is the persisted type (IDs + timestamps). `DependencyWithStatus` is the view model (enriched with live status). This separation keeps the persistence layer clean and avoids stale data in the YAML file.

**Blaze (Dev):** The `cross-project-deps.ts` module is the cleanest growth story in the codebase. It started with 3 pure functions and a file store (51-1), and grew organically to 15+ exports across 6 stories without ever needing a refactor. The DFS cycle detection in 51-6 was the most interesting algorithm — building the adjacency list, running depth-first search, then using BFS to reconstruct the shortest cycle path for the error message. The cycle path output format (`proj-a/story-1 -> proj-b/story-2 -> proj-a/story-1`) was designed for human readability in API error messages.

**Pax (QA):** ~182 new tests across core and web. The test suite for `cross-project-deps.test.ts` grew from 35 tests (51-1) to 80+ tests (51-6), all with real assertions. Story 51-5 had the most rigorous review — 23 issues (7 HIGH, 10 MEDIUM, 6 LOW) including YAML edge cases (null values, non-string entries, missing keys), alert storm prevention (threshold=0 rejection), and duration formatting edge cases (NaN, negative inputs). The `vi.hoisted()` mock pattern for shared state across `vi.mock()` factories and test bodies proved essential for route testing and was adopted consistently from 51-3 onward.

---

### What Could Be Improved

**R2d2 (Project Lead):** Stories 51-2 and 51-6 are still in "review" status, not "done." While the implementation is complete and tests pass, the review gate was not formally closed. This creates ambiguity about whether these stories are truly production-ready or have unresolved feedback.

**Nova (Architect):** The `cross-project-deps.ts` module is approaching 900 lines. While each function is small and well-scoped, the file handles six distinct responsibilities: type definitions, CRUD operations, status resolution, graph building, blocking notification logic, and cycle detection. A `cross-project/` directory with separate modules (`types.ts`, `crud.ts`, `status.ts`, `graph.ts`, `blocking.ts`, `cycles.ts`) would improve discoverability for future maintainers. The same pattern applied to `verification-gate.ts` in Epic 61.

**Blaze (Dev):** The `buildSprintDataMap` helper was duplicated in two route files before being extracted to `@/lib/sprint-data-map.ts` during the 51-3 code review. Stories 51-1 and 51-2 both had local copies. Earlier extraction would have saved two rounds of duplication. The lesson: when a utility is used in 2+ files, extract immediately, not after the third consumer.

**Pax (QA):** The blocking notifications in 51-5 use an in-memory pub/sub (`cross-project-dep-events.ts`) for SSE integration, which has an explicit architectural limitation: it only works within a single server instance. If the web dashboard runs multiple instances (load-balanced), SSE events will not propagate across instances. This was documented as a known limitation but has no mitigation path.

**Blaze (Dev):** The `SprintDataMap` flattening pattern (`SprintStatusEntry` objects with `.status` field vs. plain strings) was a recurring source of confusion. Every route that builds a SprintDataMap must flatten entries. The `flattenEntry` helper was extracted in 51-3 but the underlying type mismatch between `SprintStatusEntry` and `SprintDataMap` values should be resolved at the type level.

---

### Key Decisions

1. **Cross-project deps as a separate concept from intra-project deps** — `StoryState.dependencies: string[]` remains unchanged. Cross-project deps use a new type stored in `cross-project-deps.yaml`. Avoids breaking existing dependency resolution.

2. **Source depends on target (source blocked by target)** — `sourceProjectId/sourceStoryId` = the blocked story. `targetProjectId/targetStoryId` = the prerequisite. "Source waits for target."

3. **Status resolution at query time, not persisted** — Target status is resolved from SprintDataMap on every query. No staleness, no sync issues.

4. **Single-pass auto-unblocking (no cascading)** — When Story C completes, only stories directly depending on C are checked. No recursive resolution. Matches single-project unblock behavior.

5. **Warning priority for blocking notifications** — Dependency blocking is `"warning"` (not `"critical"`) in the notification trigger map, with a 30-minute dedup window. Less urgent than agent crashes.

6. **DFS cycle detection before duplicate check** — Cycle detection runs first in `addCrossProjectDependency()`, before the duplicate check. Cycle errors throw with the full path; API returns 422 (Unprocessable Entity).

7. **Static SVG graph, no graph library** — The cross-project dependency graph uses pure SVG with a project-column layout, matching the existing `DependencyGraphView` pattern. No d3-force, dagre, or elkjs dependency.

---

### Lessons Learned

1. **Extract shared utilities after the second consumer, not the third.** `buildSprintDataMap` was duplicated in 51-1, duplicated again in 51-2, and only extracted in 51-3. The pattern should be: first use is local, second use triggers extraction.

2. **`vi.hoisted()` is the correct pattern for shared mock state in Vitest.** Route tests that need shared mock stores accessible in both `vi.mock()` factories and test bodies require `vi.hoisted()`. This was discovered during 51-3 and adopted consistently afterward.

3. **Type mismatches between layers compound silently.** `SprintStatusEntry` (from tracker plugin) vs. `SprintDataMap` values (plain strings) required flattening in every consumer. The mismatch was not caught in 51-1 and propagated through 51-2 before `flattenEntry` was extracted.

4. **Pure function growth scales well.** Adding functions to `cross-project-deps.ts` across 6 stories without architectural refactoring shows that pure sync functions with pre-fetched data are a sustainable growth pattern. The module never needed a redesign.

5. **DFS + BFS combination for cycle detection is elegant.** DFS detects the cycle efficiently (O(V+E)), BFS reconstructs the shortest cycle path for readable error messages. Two algorithms, one function, clean separation of detection vs. reporting.

6. **Adversarial code review catches real bugs.** Story 51-5's 23 review issues included YAML edge cases (null, non-string values), alert storm prevention (threshold=0), and NaN handling in duration formatting. These were real bugs that would have manifested in production.

---

### Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Close review status on stories 51-2 and 51-6 — verify final state | PM | HIGH |
| 2 | Extract `cross-project-deps.ts` into `cross-project/` directory module | Dev | MEDIUM |
| 3 | Resolve `SprintStatusEntry` vs `SprintDataMap` type mismatch at the type level | Dev | MEDIUM |
| 4 | Document single-instance SSE limitation with mitigation path (Redis pub/sub) | Architect | LOW |
| 5 | Fix pre-existing `pnpm build` failure — NotepadContent type error in packages/web | Dev | HIGH |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 6 (5 done, 2 in review) |
| Stories with 0 review issues | 1 (51-6) |
| Stories with most review issues | 51-5 (23 issues) |
| Total review issues found | ~37 |
| Total new tests | ~182 |
| External dependencies added | 0 |
| New core module | 1 (cross-project-deps.ts, ~900 lines) |
| New web components | 1 (CrossProjectGraphView.tsx) |
| New API endpoints | 5 (CRUD + search + graph + blocking-status) |
| Deferred items carried forward | 3 (cascading unblock, batch validation, auto-resolution) |
| Epic duration | Cycle 10 |

## Deferred Items Forward

| Item | Deferred To | Notes |
|------|------------|-------|
| Cascading auto-unblock (A->B->C chain resolution) | Future enhancement | Single-pass only, no recursive resolution |
| Cycle detection for batch dependency imports | Future enhancement | Only single-dep creation validated |
| Cycle auto-resolution suggestions | Future enhancement | Detects and rejects only, no alternatives |
| Force-directed/interactive graph layout | Future enhancement | Static column layout, no d3-force |
| Per-project blocking thresholds | Future enhancement | Single global threshold (1 hour default) |
| SSE for multi-instance deployments | Future enhancement | In-memory pub/sub, single instance only |
