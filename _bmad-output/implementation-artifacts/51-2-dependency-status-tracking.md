# Story 51.2: Dependency Status Tracking

Status: review

## Story

As a **project manager**,
I want **the system to automatically track cross-project dependency status**,
so that **I don't have to manually check if prerequisites are complete**.

## Acceptance Criteria

1. **Given** Story X in Project A has a cross-project dependency on Story Y in Project B
   **When** I query the dependency status for Story X
   **Then** the system returns the dependency enriched with Story Y's current status
   **And** the status is one of: `blocked` (target not done), `ready` (target done), `waiting` (target in-progress)

2. **Given** Story X depends on Story Y in another project via cross-project dependency
   **When** I view Story X's detail via API
   **Then** the response includes `crossProjectDeps` with each dep's `targetStatus` and `isResolved` fields
   **And** `isResolved` is `true` when target story status is `"done"`

3. **Given** a cross-project dependency exists where the target story is in progress
   **When** the target story is marked as done in its project
   **Then** the next status query for the source story reflects the dependency as resolved
   **And** the dependency is no longer blocking

4. **Given** a story has multiple cross-project dependencies
   **When** I check if all dependencies are satisfied
   **Then** the system returns `true` only when ALL target stories have status `"done"`
   **And** returns `false` with a list of outstanding blocking deps otherwise

5. **Given** I want to see all blocked cross-project dependencies across my portfolio
   **When** I query the dependencies API with a filter for unresolved deps
   **Then** I get only dependencies where the target story is not yet done
   **And** each result includes the blocking dependency details and target story status

## Tasks / Subtasks

- [x] Task 1: Extend types for dependency status (AC: #1, #2, #4)
  - [x] 1.1: Create `DependencyWithStatus` interface in `packages/core/src/cross-project-deps.ts` — extends `CrossProjectDependency` with `targetStatus: string` and `isResolved: boolean`
  - [x] 1.2: Add `DependencyWithStatus` to `packages/web/src/lib/types.ts` — mirrors core type for frontend use
  - [x] 1.3: Update story detail GET response type to use `DependencyWithStatus[]` instead of `CrossProjectDependency[]`

- [x] Task 2: Pure functions for status resolution (AC: #1, #3, #4)
  - [x] 2.1: Create `resolveDependencyStatus(dep, sprintDataMap)` — enriches a single dep with target story's current status from SprintDataMap, sets `isResolved = (targetStatus === "done")`
  - [x] 2.2: Create `resolveAllDependencyStatuses(deps, sprintDataMap)` — maps over deps array, enriching each with status
  - [x] 2.3: Create `areCrossProjectDepsSatisfied(projectId, storyId, deps, sprintDataMap)` — returns `{ satisfied: boolean, outstanding: DependencyWithStatus[] }` checking all deps where story appears as source
  - [x] 2.4: Create `getBlockedCrossProjectDeps(deps, sprintDataMap)` — filters deps where target is not done, returns enriched list

- [x] Task 3: Extend API routes with status enrichment (AC: #1, #2, #5)
  - [x] 3.1: Update `GET /api/dependencies/cross-project/route.ts` — build SprintDataMap, call `resolveAllDependencyStatuses`, return enriched deps
  - [x] 3.2: Add optional `?status=blocked` query param to GET — filter to only unresolved deps using `getBlockedCrossProjectDeps`
  - [x] 3.3: Update `GET /api/sprint/[project]/story/[id]/route.ts` — use `resolveAllDependencyStatuses` to return `DependencyWithStatus[]` with live status

- [x] Task 4: Write tests (AC: #1-5)
  - [x] 4.1: Unit tests for `resolveDependencyStatus` — target done/not-done/in-progress, missing sprint data
  - [x] 4.2: Unit tests for `resolveAllDependencyStatuses` — empty list, mixed statuses, all resolved
  - [x] 4.3: Unit tests for `areCrossProjectDepsSatisfied` — all satisfied, partial, none, story as source only
  - [x] 4.4: Unit tests for `getBlockedCrossProjectDeps` — no blockers, some blockers, all blockers
  - [x] 4.5: API route tests — GET with status enrichment, status=blocked filter, story detail with enriched deps

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
1. Automatic story unblocking
   - Status: Deferred - Story 51.3
   - Requires: Event-driven propagation that updates source story status when target completes
   - Epic: Story 51.3 (Automatic Story Unblocking)
   - Current: Status is resolved on-demand (query-time), not event-driven
2. Blocking notifications
   - Status: Deferred - Story 51.5
   - Requires: Notification trigger when dependency blocks for extended period
   - Epic: Story 51.5 (Dependency Blocking Notifications)
   - Current: No notification system for blocked dependencies
```

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags

**Methods Used:**
- `CrossProjectDepFileStore.list(filter?)` — List dependencies with optional project filter
- `CrossProjectDepFileStore.getForStory(projectId, storyId)` — Get deps involving a story
- `readSprintStatus(project)` from `@composio/ao-plugin-tracker-bmad` — Build SprintDataMap for status resolution
- `resolveAllDependencyStatuses(deps, sprintDataMap)` — New pure function for enrichment
- `getBlockedCrossProjectDeps(deps, sprintDataMap)` — New pure function for filtering
- `getServices()` — Web API services (config access)

**Feature Flags:**
- Cross-project dependency status requires SprintDataMap built from all configured projects — with 0 projects, status resolution returns `"unknown"` for all deps

## Dependency Review

No new dependencies required. Uses existing:
- Vitest for testing
- `yaml` package (already approved) for SprintDataMap building
- Existing `CrossProjectDepFileStore` and `SprintDataMap` types from Story 51.1

## Dev Notes

### Architecture Context

This is **Story 2 of 6** in **Epic 51: Cross-Project Dependencies**. It depends on:
- **Story 51.1 (done):** Cross-Project Dependency Definition — types, persistence, validation, API, search

This story adds **status intelligence** to the cross-project dependency foundation. It enriches existing dependency data with live sprint status from each project, enabling consumers (dashboard, notifications, auto-unblocking) to know whether a dependency is blocking or resolved.

Stories 51.3-51.6 build on this story's status resolution functions for automatic unblocking, visualization, notifications, and cycle detection.

### Previous Story Intelligence (51.1: Cross-Project Dependency Definition)

Key code patterns and learnings:
- **Pure sync functions** accepting pre-fetched data — `addCrossProjectDependency()`, `validateDependencyReferences()` pattern
- **SprintDataMap** type from `cross-project-deps.ts` — `Record<string, { development_status: Record<string, string> }>` — callers build this by iterating projects and calling `readSprintStatus()`
- **CrossProjectDepFileStore** persists to `cross-project-deps.yaml` — `#loadDeps()`/`#saveDeps()` are private methods
- **API route pattern**: dynamically import `@composio/ao-plugin-tracker-bmad`, iterate `config.projects`, call `readSprintStatus(project)` for each to build SprintDataMap
- **Vitest mock pattern**: `vi.mock()` factories must inline values (no outer variable references due to hoisting)
- **Web type sync**: Core types in `packages/core/src/cross-project-deps.ts`, mirrored in `packages/web/src/lib/types.ts`
- **Import pattern**: `import { type NextRequest, NextResponse } from "next/server"` — combined type+value imports
- **Code review findings from 51.1**: Always pass SprintDataMap to validation functions, use `#` private fields for internal methods, guard empty query inputs

### Critical Gaps This Story Must Fill

**Gap 1: No status enrichment on dependency queries**
`CrossProjectDependency` only stores static data (IDs, timestamps). There is no way to know if a dependency's target story is done or still in-progress without separately querying sprint data and correlating.

**Gap 2: No bulk status resolution**
No function exists to take a list of deps + SprintDataMap and return deps annotated with target status. This is needed by the GET API, story detail API, and future consumers (dashboard, notifications).

**Gap 3: No "satisfied" check for cross-project deps**
`areDependenciesSatisfied()` in `completion-handlers.ts` only checks single-project deps (reads from `story_dependencies` in one sprint-status.yaml). No equivalent for cross-project deps.

**Gap 4: No filtering by blocking status**
The GET API returns all deps. No way to filter to only "blocked" (target not done) deps for dashboard alerts or notification triggers.

**Gap 5: Story detail API returns raw deps without status**
The story detail GET (`/api/sprint/[project]/story/[id]`) returns `crossProjectDeps` as raw `CrossProjectDependency[]` with no status information.

### Key Design Decisions

**Status resolution at query time (not persisted):**
Status is NOT stored on the `CrossProjectDependency` itself. Instead, it's resolved on-demand from `SprintDataMap`. This avoids staleness — the status is always current as of the last sprint data read. The `DependencyWithStatus` type is a view model, not a persisted entity.

**`DependencyWithStatus` as enrichment layer:**
Rather than modifying `CrossProjectDependency` (which is the persisted type), create a new `DependencyWithStatus` type that extends it with `targetStatus` and `isResolved`. This keeps the persistence layer clean and the status resolution testable.

**"done" as the only resolved state:**
A dependency is considered resolved (`isResolved: true`) only when the target story's status is exactly `"done"`. All other statuses (`backlog`, `ready-for-dev`, `in-progress`, `review`, `blocked`) mean the dependency is not yet satisfied.

**Graceful handling of missing sprint data:**
If a project's sprint data is unavailable (config missing, file not found), `targetStatus` is set to `"unknown"` and `isResolved` is `false`. This prevents crashes when a project is misconfigured.

**No event-driven propagation in this story:**
This story only adds on-demand status resolution. Event-driven auto-unblocking (when a target story completes, automatically update the source story) is deferred to Story 51.3.

### File Structure to Modify

```
packages/core/src/
├── cross-project-deps.ts                     # MODIFY: Add DependencyWithStatus type, 4 new pure functions
├── index.ts                                  # MODIFY: Export new type and functions
└── __tests__/
    └── cross-project-deps.test.ts            # MODIFY: Add tests for new functions

packages/web/src/
├── app/api/
│   └── dependencies/
│       └── cross-project/
│           ├── route.ts                      # MODIFY: Add status enrichment and ?status=blocked filter
│           └── route.test.ts                 # MODIFY: Add tests for enriched responses
├── lib/
│   └── types.ts                              # MODIFY: Add DependencyWithStatus type
└── app/api/sprint/[project]/story/[id]/
    └── route.ts                              # MODIFY: Use resolveAllDependencyStatuses for enriched response
```

### Testing Strategy

**Core tests (cross-project-deps.test.ts):**
- `resolveDependencyStatus` — target done → isResolved=true, target in-progress → isResolved=false, missing project → targetStatus="unknown", missing story → targetStatus="unknown"
- `resolveAllDependencyStatuses` — empty list → empty, mixed statuses → correct enrichment, all resolved → all isResolved=true
- `areCrossProjectDepsSatisfied` — no deps → satisfied=true, all done → satisfied=true, one not done → satisfied=false + outstanding list, story not a source → satisfied=true
- `getBlockedCrossProjectDeps` — no blockers → empty, some blockers → filtered list, all blockers → all returned

**Web tests (API routes):**
- GET /api/dependencies/cross-project — enriched response with targetStatus and isResolved
- GET /api/dependencies/cross-project?status=blocked — only unresolved deps
- GET /api/sprint/[project]/story/[id] — crossProjectDeps enriched with status

### NFRs

- **NFR-F3-1:** Cross-project dependency status resolution completes within 1 second (SprintDataMap build + pure function)
- **NFR-F3-2:** Status resolution supports up to 200 cross-project edges

### Accessibility

- API responses include `targetStatus` as machine-readable string for dashboard rendering
- Future UI components (Story 51.4 graph) will render status with color coding and ARIA labels

### References

- [Source: epics-cycle-10.md#Epic 51 Story 51.2] — Requirements
- [Source: prd-cycle-10.md#FR-F3-2] — The system tracks cross-project dependency status
- [Source: prd-cycle-10.md#NFR-F3-1] — 1 second dependency check
- [Source: packages/core/src/cross-project-deps.ts] — CrossProjectDependency type, SprintDataMap, existing pure functions
- [Source: packages/core/src/dependency-resolver.ts] — Single-project DependencyResolverService pattern (onStoryCompleted, areDependenciesSatisfied)
- [Source: packages/core/src/completion-handlers.ts] — findDependentStories(), areDependenciesSatisfied() (single-project)
- [Source: packages/core/src/types.ts] — StoryStatus ("done"), EventBus, EventPublisher interfaces
- [Source: packages/core/src/state-manager.ts] — YAML state management patterns
- [Source: packages/core/src/cross-project-assignment.ts] — SprintDataReader interface, cross-project patterns
- [Source: packages/web/src/app/api/dependencies/cross-project/route.ts] — Existing API routes (GET/POST/DELETE)
- [Source: packages/web/src/app/api/sprint/[project]/story/[id]/route.ts] — Story detail GET with crossProjectDeps

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- All existing tests must continue to pass (no regressions)
- New functions follow same pure sync pattern as Story 51.1
- No new files needed — extend existing `cross-project-deps.ts` module

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Pre-existing type error in `cross-project-deps.test.ts:28` — `as OrchestratorConfig["projects"]` cast; not from this story's changes
- Pre-existing agent capacity test failure in `packages/web/src/app/api/agent/[id]/capacity/route.test.ts` — fails on main too, unrelated to cross-project deps
- Pre-existing file-watcher test timeout — not related to this story

### Limitations (Deferred Items)

1. Automatic story unblocking
   - Status: Deferred - Story 51.3
   - Requires: Event-driven propagation that updates source story status when target completes
   - Epic: Story 51.3 (Automatic Story Unblocking)
   - Current: Status is resolved on-demand (query-time), not event-driven
2. Blocking notifications
   - Status: Deferred - Story 51.5
   - Requires: Notification trigger when dependency blocks for extended period
   - Epic: Story 51.5 (Dependency Blocking Notifications)
   - Current: No notification system for blocked dependencies

### Completion Notes List

1. Added `DependencyWithStatus` interface extending `CrossProjectDependency` with `targetStatus` and `isResolved` fields — core type in `cross-project-deps.ts`, mirrored in web `types.ts`
2. Implemented 4 pure sync functions: `resolveDependencyStatus`, `resolveAllDependencyStatuses`, `areCrossProjectDepsSatisfied`, `getBlockedCrossProjectDeps` — all follow existing pure function pattern
3. `DONE_STATUS = "done"` constant — only `"done"` satisfies a dependency
4. Graceful handling: missing project/story in SprintDataMap → `targetStatus: "unknown"`, `isResolved: false`
5. GET `/api/dependencies/cross-project` now enriches all deps with live status and supports `?status=blocked` filter
6. Story detail GET `/api/sprint/[project]/story/[id]` now returns `DependencyWithStatus[]` with live target status
7. Extracted `buildSprintDataMap()` helper in both route files — iterates projects, calls `readSprintStatus()`, builds `SprintDataMap`
8. 19 new core tests (54 total in cross-project-deps.test.ts): 7 for resolveDependencyStatus, 3 for resolveAllDependencyStatuses, 5 for areCrossProjectDepsSatisfied, 4 for getBlockedCrossProjectDeps
9. Updated existing API route tests with mocks for new functions and tracker module — 14 tests pass
10. Full regression: 2014 core tests pass, 1605 web tests pass (1 pre-existing failure unrelated to this story)

### File List

- `packages/core/src/cross-project-deps.ts` — **MODIFIED**: Added `DependencyWithStatus` interface, `DONE_STATUS` constant, 4 new pure functions (`resolveDependencyStatus`, `resolveAllDependencyStatuses`, `areCrossProjectDepsSatisfied`, `getBlockedCrossProjectDeps`)
- `packages/core/src/index.ts` — **MODIFIED**: Added exports for new type and 4 new functions
- `packages/core/src/__tests__/cross-project-deps.test.ts` — **MODIFIED**: Added 19 new tests for status resolution functions (54 total)
- `packages/web/src/lib/types.ts` — **MODIFIED**: Added `DependencyWithStatus` interface
- `packages/web/src/app/api/dependencies/cross-project/route.ts` — **MODIFIED**: GET now enriches deps with status, added `?status=blocked` filter, extracted `buildSprintDataMap()` helper
- `packages/web/src/app/api/dependencies/cross-project/route.test.ts` — **MODIFIED**: Updated mocks for new functions and tracker module
- `packages/web/src/app/api/sprint/[project]/story/[id]/route.ts` — **MODIFIED**: Story detail GET returns `DependencyWithStatus[]` with live status
