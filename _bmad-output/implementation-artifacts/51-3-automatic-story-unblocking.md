# Story 51.3: Automatic Story Unblocking

Status: done

## Story

As a **project manager**,
I want **dependent stories to be automatically unblocked when prerequisites complete**,
so that **work can proceed immediately without manual intervention**.

## Acceptance Criteria

1. **Given** Story X in Project A is blocked by a cross-project dependency on Story Y in Project B
   **When** Story Y is marked as "done" via PATCH `/api/sprint/[project]/story/[id]`
   **Then** the system checks all cross-project deps targeting Story Y
   **And** if Story X's ALL cross-project dependencies are satisfied, Story X is transitioned from "blocked" to "ready-for-dev"
   **And** Story X's sprint history records the transition

2. **Given** Story X has cross-project dependencies on Story Y (done) and Story Z (in-progress)
   **When** Story Y completes
   **Then** Story X remains "blocked" because Story Z is still incomplete
   **And** the unblock check returns early without modifying Story X

3. **Given** Story X in Project A depends on Story Y in Project B, and Story Y is marked "done"
   **When** the auto-unblock runs
   **Then** the PATCH response includes an `unblockedStories` array listing any stories that were automatically unblocked
   **And** each entry includes `{ projectId, storyId, previousStatus, newStatus }`

4. **Given** Stories A → B → C form a cross-project dependency chain across three projects
   **When** Story C is marked "done"
   **Then** Story B is checked and unblocked (if all its deps are satisfied)
   **And** after Story B is unblocked, Story A is NOT auto-unblocked in the same request (single-pass only, no cascading)
   **And** Story A will be unblocked when Story B is later marked "done" through normal workflow

5. **Given** the auto-unblock logic encounters an error while writing status to a source project
   **When** the error occurs
   **Then** the error is logged but does NOT fail the original PATCH request
   **And** other eligible stories are still processed (best-effort, non-blocking)

6. **Given** a cross-project dependency exists where the target project is not configured in the orchestrator config
   **When** auto-unblock runs
   **Then** the dependency is skipped gracefully (treated as "unknown" status)
   **And** no error is thrown

## Tasks / Subtasks

- [x] Task 1: Core auto-unblock pure function (AC: #1, #2, #4, #6)
  - [x] 1.1: Create `findCrossProjectDependents(completedProjectId, completedStoryId, allDeps)` in `packages/core/src/cross-project-deps.ts` — returns deps where `targetProjectId === completedProjectId && targetStoryId === completedStoryId`
  - [x] 1.2: Create `autoUnblockCrossProjectDeps(completedProjectId, completedStoryId, deps, sprintDataMap, config)` — finds dependents, checks satisfaction via `areCrossProjectDepsSatisfied`, returns list of `{ projectId, storyId }` eligible for unblocking (pure function, no I/O)
  - [x] 1.3: Export new functions from `packages/core/src/index.ts`

- [x] Task 2: Wire auto-unblock into PATCH route (AC: #1, #3, #5)
  - [x] 2.1: In `packages/web/src/app/api/sprint/[project]/story/[id]/route.ts`, add post-completion auto-unblock step after `writeStoryStatus` + `appendHistory` when `newStatus === "done"`
  - [x] 2.2: Call `autoUnblockCrossProjectDeps()` with SprintDataMap to find eligible stories
  - [x] 2.3: For each eligible story, call `writeStoryStatus(sourceProject, sourceStoryId, "ready-for-dev")` and `appendHistory(sourceProject, sourceStoryId, "blocked", "ready-for-dev")` — wrapped in try/catch per story (best-effort, AC #5)
  - [x] 2.4: Return `unblockedStories` array in PATCH response (AC #3)

- [x] Task 3: Write tests (AC: #1-6)
  - [x] 3.1: Unit tests for `findCrossProjectDependents` — matching deps, no matches, multiple matches
  - [x] 3.2: Unit tests for `autoUnblockCrossProjectDeps` — all deps satisfied → eligible, partial deps → not eligible, empty deps → empty result, missing project → skipped
  - [x] 3.3: API route tests — PATCH to "done" triggers auto-unblock, partial deps remain blocked, error during unblock doesn't fail request, response includes unblockedStories

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
1. Cascading auto-unblock
   - Status: Deferred - Out of scope (single-pass only)
   - Requires: Event-driven chain propagation or recursive resolution
   - Epic: Future enhancement
   - Current: Single-pass — only direct dependents of the completed story are checked
2. Event-driven propagation
   - Status: Deferred - Story 51.5 (Dependency Blocking Notifications)
   - Requires: SSE event emission for story.unblocked cross-project events
   - Epic: Story 51.5 (Dependency Blocking Notifications)
   - Current: No SSE event emitted for cross-project auto-unblock
3. Circular dependency handling
   - Status: Deferred - Story 51.6 (Circular Dependency Detection)
   - Requires: Cross-project cycle detection before unblocking
   - Epic: Story 51.6 (Circular Dependency Detection)
   - Current: No circular dependency check during auto-unblock
```

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags

**Methods Used:**
- `CrossProjectDepFileStore.list()` — List all cross-project dependencies
- `areCrossProjectDepsSatisfied(projectId, storyId, deps, sprintDataMap)` — Check if all deps satisfied (from Story 51.2)
- `writeStoryStatus(project, storyId, newStatus)` from `@composio/ao-plugin-tracker-bmad` — Write new status to sprint-status.yaml
- `appendHistory(project, storyId, fromStatus, toStatus)` from `@composio/ao-plugin-tracker-bmad` — Record transition in sprint-history.jsonl
- `getServices()` — Web API services (config access)
- `buildSprintDataMap(config)` — Build SprintDataMap across all projects (pattern from Story 51.2)

**Feature Flags:**
- Auto-unblock only triggers on PATCH to "done" status — other transitions (e.g., "review" → "done" via completion handler) are out of scope for web API layer

## Dependency Review

No new dependencies required. Uses existing:
- Vitest for testing
- `yaml` package (already approved) for SprintDataMap building
- Existing `CrossProjectDepFileStore` and status resolution functions from Stories 51.1-51.2
- `writeStoryStatus` / `appendHistory` from tracker plugin (already used in PATCH route)

## Dev Notes

### Architecture Context

This is **Story 3 of 6** in **Epic 51: Cross-Project Dependencies**. It depends on:
- **Story 51.1 (done):** Cross-Project Dependency Definition — types, persistence, validation, API, search
- **Story 51.2 (done):** Dependency Status Tracking — `DependencyWithStatus`, `resolveDependencyStatus`, `areCrossProjectDepsSatisfied`, `getBlockedCrossProjectDeps`, SprintDataMap flattening

This story adds **event-driven auto-unblocking** — when a story is moved to "done" via the PATCH API, the system automatically checks if any cross-project dependents are now fully satisfied and transitions them from "blocked" to "ready-for-dev".

Stories 51.4-51.6 build on this for visualization, notifications, and cycle detection.

### Previous Story Intelligence (51.2: Dependency Status Tracking)

Key code patterns and learnings:
- **SprintDataMap flattening**: `readSprintStatus()` returns `SprintStatusEntry` objects (with `.status` field) but `SprintDataMap` expects plain strings. Both route files have `buildSprintDataMap()` helpers that flatten entries — MUST follow this same pattern
- **Pure sync functions for status resolution**: `resolveDependencyStatus`, `areCrossProjectDepsSatisfied`, `getBlockedCrossProjectDeps` — all accept pre-built `SprintDataMap`, no I/O
- **`DependencyWithStatus` interface**: `readonly targetStatus: string`, `readonly isResolved: boolean` — view model, not persisted
- **`DONE_STATUS = "done"`**: Only `"done"` satisfies a dependency
- **API route pattern**: dynamically import `@composio/ao-plugin-tracker-bmad`, iterate `config.projects`, call `readSprintStatus(project)` for each
- **Vitest mock hoisting**: `vi.mock()` factories must inline mock implementations (no outer variable references)
- **Type re-export**: `types.ts` uses `export type { DependencyWithStatus } from "@composio/ao-core"` — not duplicated
- **Diagnostic logging**: `console.warn()` in `buildSprintDataMap` catch blocks for observability

### Single-Project Dependency Unblocking Pattern (completion-handlers.ts)

The existing single-project unblock follows this pattern:
1. `findDependentStories(sprintStatus, completedStoryId)` — scans `story_dependencies` map
2. `areDependenciesSatisfied(storyId, sprintStatus)` — checks ALL deps of the dependent story
3. `updateSprintStatus(projectPath, storyId, "ready-for-dev")` — writes new status

Cross-project auto-unblock follows the SAME pattern but:
- Uses `CrossProjectDepFileStore.list()` instead of `story_dependencies` map
- Uses `areCrossProjectDepsSatisfied()` instead of `areDependenciesSatisfied()`
- Uses `writeStoryStatus()` + `appendHistory()` from tracker plugin (web API layer)
- Does NOT cascade (single-pass only) — the single-project resolver also does single-pass

### Key Design Decisions

**Single-pass only (no cascading):**
When Story C completes, only stories directly depending on C are checked. If unblocking Story B would also satisfy Story A's deps, Story A is NOT auto-unblocked in the same request. Story A will be unblocked when Story B is later marked "done" through normal workflow. This matches the single-project unblock behavior and avoids recursive complexity.

**Best-effort, non-blocking:**
Errors during auto-unblock (e.g., source project not found, write failure) are caught per-story and logged. They do NOT fail the original PATCH request. The user's status change succeeds regardless.

**Trigger point: PATCH route only:**
Auto-unblock is wired into the web PATCH handler (`/api/sprint/[project]/story/[id]`). The core completion handler (`completion-handlers.ts`) already has single-project unblocking but does NOT have cross-project awareness. Adding cross-project unblocking to the core handler would require loading the web config layer into core, which violates the architecture. The PATCH route already has config access and `buildSprintDataMap`.

**SprintDataMap reuse:**
The `buildSprintDataMap()` helper already exists in the PATCH route file. Auto-unblock reuses it for status resolution — no new SprintDataMap builder needed.

**"ready-for-dev" as unblock target:**
When a blocked story's deps are satisfied, it transitions to `"ready-for-dev"` (not `"in-progress"`). This matches the single-project unblock behavior and ensures a human/agent explicitly picks up the work.

### File Structure to Modify

```
packages/core/src/
├── cross-project-deps.ts                     # MODIFY: Add findCrossProjectDependents, autoUnblockCrossProjectDeps
├── index.ts                                  # MODIFY: Export new functions
└── __tests__/
    └── cross-project-deps.test.ts            # MODIFY: Add tests for new functions

packages/web/src/
├── app/api/sprint/[project]/story/[id]/
│   ├── route.ts                              # MODIFY: Add auto-unblock after done transition
│   └── route.test.ts                         # MODIFY: Add tests for auto-unblock behavior
```

### Testing Strategy

**Core tests (cross-project-deps.test.ts):**
- `findCrossProjectDependents` — finds deps targeting completed story, no matches, multiple dependents across projects
- `autoUnblockCrossProjectDeps` — all satisfied → eligible list, partial → empty, empty deps → empty, missing project data → skipped, single-pass verification (no cascade)

**Web tests (route.test.ts):**
- PATCH to "done" with satisfied cross-project dep → response includes `unblockedStories`
- PATCH to "done" with unsatisfied dep → no unblock, empty array
- Error during unblock → original PATCH still succeeds
- PATCH to non-"done" status → no auto-unblock check

### NFRs

- **NFR-F3-1:** Cross-project dependency checks complete within 1 second (reuse existing SprintDataMap + pure function)
- **NFR-R3:** Cross-project dependency tracking recovers from partial failures (best-effort per-story error handling)

### Accessibility

- `unblockedStories` array in PATCH response is machine-readable for dashboard rendering
- Future UI components will render auto-unblock events with ARIA announcements

### References

- [Source: epics-cycle-10.md#Story 51.3] — Requirements
- [Source: prd-cycle-10.md#FR-F3-3] — When a prerequisite story completes, dependent stories are automatically unblocked
- [Source: prd-cycle-10.md#NFR-F3-1] — 1 second dependency check
- [Source: prd-cycle-10.md#NFR-R3] — Recovery from partial failures
- [Source: packages/core/src/cross-project-deps.ts] — CrossProjectDependency, DependencyWithStatus, areCrossProjectDepsSatisfied, SprintDataMap
- [Source: packages/core/src/completion-handlers.ts] — Single-project unblock pattern (findDependentStories, areDependenciesSatisfied, updateSprintStatus)
- [Source: packages/core/src/dependency-resolver.ts] — DependencyResolverService.onStoryCompleted event-driven pattern
- [Source: packages/web/src/app/api/sprint/[project]/story/[id]/route.ts] — PATCH handler with buildSprintDataMap
- [Source: packages/web/src/app/api/dependencies/cross-project/route.ts] — buildSprintDataMap pattern
- [Source: packages/plugins/tracker-bmad/src/auto-transition.ts] — writeStoryStatus signature
- [Source: packages/plugins/tracker-bmad/src/history.ts] — appendHistory signature

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- All existing tests must continue to pass (no regressions)
- New functions follow same pure sync pattern as Stories 51.1-51.2
- No new files needed — extend existing `cross-project-deps.ts` module and PATCH route

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Vitest mock hoisting issue: `vi.mock()` factories are hoisted above `const` declarations. Used `vi.hoisted()` to create shared mock store accessible in both factories and test bodies.

### Completion Notes List

1. Task 1 (Core pure functions): `findCrossProjectDependents`, `autoUnblockCrossProjectDeps`, `UnblockCandidate` implemented as pure sync functions. 10 new tests added to `cross-project-deps.test.ts` (66 total).
2. Task 2 (PATCH route wiring): Auto-unblock block added after `writeStoryStatus`/`appendHistory` when `newStatus === "done"`. Best-effort error handling with per-story try/catch. Returns `unblockedStories` array in response.
3. Task 3 (Route tests): 6 tests covering all ACs. Key challenge was `vi.hoisted()` pattern for shared mock store across hoisted factory and test bodies.
4. Code Review Fixes (6 issues): H1: documented GET handler scope; M1: extracted `buildSprintDataMap` to shared `@/lib/sprint-data-map.ts`; M2: added `types.ts` to File List; M3: refactored tests to use `vi.hoisted()` mock refs; L1: extracted `flattenEntry` helper; L2: added `createCrossProjectDepStore` call assertion.

### File List

- `packages/core/src/cross-project-deps.ts` — Added `findCrossProjectDependents`, `autoUnblockCrossProjectDeps`, `UnblockCandidate`
- `packages/core/src/index.ts` — Exported new functions and types
- `packages/core/src/__tests__/cross-project-deps.test.ts` — 10 new tests for auto-unblock pure functions
- `packages/web/src/app/api/sprint/[project]/story/[id]/route.ts` — Added auto-unblock block in PATCH handler; GET handler enriched with crossProjectDeps (carried from 51.2)
- `packages/web/src/app/api/sprint/[project]/story/[id]/route.test.ts` — 6 route tests for auto-unblock behavior
- `packages/web/src/lib/types.ts` — Re-exported `DependencyWithStatus` from ao-core (carried from 51.2 review fix)
- `packages/web/src/lib/sprint-data-map.ts` — Shared `buildSprintDataMap` and `flattenEntry` utilities (extracted from duplicate route-local definitions)
- `packages/web/src/app/api/dependencies/cross-project/route.ts` — Updated to use shared `buildSprintDataMap`
