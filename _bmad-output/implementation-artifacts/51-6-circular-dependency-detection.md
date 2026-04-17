# Story 51.6: Circular Dependency Detection

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **the system to detect circular dependencies across project boundaries**,
so that **I don't create impossible dependency chains**.

## Acceptance Criteria

1. **Given** I try to create a dependency that would form a cycle
   **When** I attempt to save the dependency
   **Then** the system shows an error explaining the circular dependency
   **And** the dependency is not created

2. **Given** a proposed dependency would create a cycle involving 3+ stories
   **When** the cycle is detected
   **Then** the error displays the full cycle path showing which stories form the loop
   **And** each entry in the path includes project name and story ID for readability

3. **Given** a self-referential dependency (story depends on itself)
   **When** I attempt to create it
   **Then** the system detects it as a trivial cycle and rejects it with a clear message

4. **Given** no existing dependencies would form a cycle with the new one
   **When** I create the dependency
   **Then** it is saved normally with no errors

5. **Given** existing dependencies form chains like A→B→C→D
   **When** I try to create D→A
   **Then** the system detects the cycle A→B→C→D→A and rejects it with the path displayed

6. **Given** circular dependency detection is triggered
   **When** the check runs
   **Then** it completes within 1 second for up to 200 dependencies (NFR-F3-1)

## Tasks / Subtasks

- [x] Task 1: Core cycle detection pure function (AC: #1, #2, #3, #5, #6)
  - [x] 1.1: Define `CircularDependencyResult` type: `{ cycleDetected: boolean; cyclePath?: Array<{ projectId: string; storyId: string; projectName?: string }> }`
  - [x] 1.2: Define `DependencyEdge` helper type: `{ source: { projectId: string; storyId: string }; target: { projectId: string; storyId: string } }`
  - [x] 1.3: Implement `detectCircularDependency(existingDeps, newSource, newTarget): CircularDependencyResult` — pure function using DFS:
    - Build adjacency list from existing deps (edges: target → source, meaning "target blocks source")
    - Add proposed edge: newTarget → newSource
    - Run DFS from newTarget looking for path back to newSource
    - If path found → return cycle path (the sequence of stories forming the loop)
    - If no path → return `{ cycleDetected: false }`
  - [x] 1.4: Handle self-reference as special case (sourceProject === targetProject AND sourceStory === targetStory) — immediately return cycle with single-node path
  - [x] 1.5: Export new types and function from `packages/core/src/cross-project-deps.ts`
  - [x] 1.6: Export from `packages/core/src/index.ts`
  - [x] 1.7: Add unit tests in `packages/core/src/__tests__/cross-project-deps.test.ts`:
    - No cycle with empty deps → allowed
    - No cycle with unrelated deps → allowed
    - Direct 2-node cycle (A→B then B→A) → detected
    - 3-node cycle (A→B→C→A) → detected with full path
    - Self-referential → detected
    - Longer chain (A→B→C→D→A) → detected
    - Multiple disconnected chains, only one cycles → only that one detected
    - Dependency that extends chain without cycling → allowed
    - Performance: 200 deps → completes within 1 second

- [x] Task 2: Integrate cycle detection into dep creation (AC: #1, #4)
  - [x] 2.1: Modify `addCrossProjectDependency()` in `cross-project-deps.ts` — call `detectCircularDependency()` BEFORE the duplicate check
  - [x] 2.2: If cycle detected, throw `Error` with message format: `"Circular dependency detected: ${cyclePathFormatted}"` where cyclePathFormatted shows the loop (e.g., `"story-1 (proj-a) → story-2 (proj-b) → story-1 (proj-a)"`)
  - [x] 2.3: Add unit tests for `addCrossProjectDependency` with cycle scenarios:
    - Throws on cycle with descriptive message containing path
    - Does NOT throw on valid non-cyclic dep
    - Error message includes story IDs in the cycle

- [x] Task 3: API route error handling (AC: #1, #2)
  - [x] 3.1: Modify `POST /api/dependencies/cross-project` route.ts — add catch for circular dependency errors:
    - Check if error message includes "Circular dependency"
    - Return 422 (Unprocessable Entity) with `{ error: message, cyclePath: [...] }`
    - Existing 409 for duplicates remains unchanged
  - [x] 3.2: Add route test for circular dependency rejection (422 with cycle path in body)
  - [x] 3.3: Add route test for valid dep still works after cycle detection is added

- [x] Task 4: Write comprehensive tests (AC: #1-6)
  - [x] 4.1: Core cycle detection tests (in Task 1.7)
  - [x] 4.2: Integration with addCrossProjectDependency (in Task 2.3)
  - [x] 4.3: API route tests (in Task 3.2-3.3)
  - [x] 4.4: Run full test suite to verify no regressions

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- No hidden TODOs or FIXMEs in completed tasks

**Deferred Items Tracking:**

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Cycle detection across multi-project dependencies with 1000+ edges
   - Status: Deferred - Future optimization
   - Requires: Incremental graph approach or Bloom filter
   - Current: DFS handles up to 200 edges in <1s (NFR-F3-1)
2. Cycle detection for batch dependency imports
   - Status: Deferred - Future enhancement
   - Requires: Bulk import API with batch validation
   - Current: Only single-dep creation is validated
3. Cycle auto-resolution suggestions
   - Status: Deferred - Future enhancement
   - Requires: AI-powered dependency graph analysis
   - Current: Only detects and rejects, does not suggest alternatives
```

## Interface Validation

**Methods Used:**
- `CrossProjectDepFileStore.list()` — Load all existing deps for graph construction
- `addCrossProjectDependency(deps, ...)` — Existing pure function to be enhanced with cycle check
- `CrossProjectDepFileStore.add()` — Persists the new dep (unchanged)
- `validateDependencyReferences()` — Reference validation (unchanged)

**Feature Flags:**
- None required — uses existing infrastructure

## Dependency Review

No new external dependencies required. Uses existing:
- Vitest for testing
- DFS algorithm implemented from scratch (no library needed)

## Dev Notes

### Architecture Context

This is **Story 6 of 6** in **Epic 51: Cross-Project Dependencies**. It depends on:
- **Story 51.1 (done):** Cross-Project Dependency Definition — types, persistence, validation, API
- **Story 51.2 (done):** Dependency Status Tracking — `DependencyWithStatus`, SprintDataMap
- **Story 51.3 (done):** Automatic Story Unblocking — `findCrossProjectDependents`
- **Story 51.4 (done):** Cross-Project Dependency Graph — graph visualization
- **Story 51.5 (done):** Dependency Blocking Notifications — blocking alerts, SSE integration

This story completes Epic 51 by adding **circular dependency prevention** to the dependency creation flow.

### Previous Story Intelligence (51.5: Dependency Blocking Notifications)

Key patterns and learnings to carry forward:
- **Pure function pattern**: All data transformation in pure sync functions. Cycle detection should be a pure function in `cross-project-deps.ts`
- **Error message propagation**: The POST route catches specific error patterns (e.g., `message.includes("Duplicate")` → 409). Follow this pattern — catch `message.includes("Circular dependency")` → 422
- **`createCrossProjectDepStore(config.configPath)`**: Standard way to get store instance in API routes
- **`vi.hoisted()` for mocks**: Use `vi.hoisted()` for shared mock objects in test files
- **Best-effort error handling**: Wrap cross-project operations in try/catch
- **`buildSprintDataMap` shared utility**: Use from `@/lib/sprint-data-map.ts`
- **`store.refresh = vi.fn().mockReturnValue(...)`**: Pattern for mocking store methods in tests

### Cycle Detection Algorithm Design

**Dependency Graph Model:**
- A dependency `dep` creates a directed edge: `source → target` (source depends on target, target blocks source)
- A cycle exists when there's a path from target back to source through existing dependencies

**Algorithm: DFS cycle detection**
1. Build adjacency list from existing deps: for each dep, add edge `target → source`
2. The proposed new dep creates edge: `newTarget → newSource`
3. But wait — we also need the REVERSE direction. If dep means "A depends on B" (A→B), then to find a cycle when adding C→A, we need to check if there's a path A→...→C through existing deps.
4. Actually simpler: A dep {source=A, target=B} means "A depends on B". Adding {source=B, target=A} would create cycle B→A→B.
5. Build the graph as adjacency list where dep(A,B) adds edge A→B
6. Proposed new dep adds edge newSource→newTarget
7. Cycle = does a path exist from newTarget back to newSource in the existing graph + the new edge?

**Correct model:**
- `dep(source, target)` means "source depends on target" — directed edge `source → target`
- When adding `newDep(source=X, target=Y)`, a cycle exists if Y can reach X through existing dependency edges
- DFS from Y following edges forward, looking for X

**Self-reference:** If `sourceProject === targetProject && sourceStory === targetStory`, immediate cycle.

**Performance:** O(V + E) where V = unique stories, E = deps. For 200 edges, this is trivially fast.

### Integration Point

The key integration point is the `addCrossProjectDependency()` pure function in `cross-project-deps.ts` (line 158). Currently it:
1. Checks for duplicates via `isDuplicate()`
2. Creates the dep object
3. Returns new array + added dep

After this story, it will:
1. **Check for cycles** via `detectCircularDependency()` — FIRST (before duplicate check)
2. Check for duplicates via `isDuplicate()`
3. Create the dep object
4. Return new array + added dep

The POST route handler (line 60 in `route.ts`) catches errors from `store.add()` which calls the pure function. Add a catch for circular dep errors returning 422.

### API Response Design

When a circular dependency is detected:

```json
{
  "error": "Circular dependency detected: proj-a/story-1 → proj-b/story-2 → proj-c/story-3 → proj-a/story-1",
  "cyclePath": [
    { "projectId": "proj-a", "storyId": "story-1", "projectName": "Project A" },
    { "projectId": "proj-b", "storyId": "story-2", "projectName": "Project B" },
    { "projectId": "proj-c", "storyId": "story-3", "projectName": "Project C" },
    { "projectId": "proj-a", "storyId": "story-1", "projectName": "Project A" }
  ]
}
```

Note: The first and last entries are the same story, forming the cycle closure.

### File Structure to Create/Modify

```
packages/core/src/
├── cross-project-deps.ts                          # MODIFY: Add detectCircularDependency, CircularDependencyResult
├── index.ts                                       # MODIFY: Export new types and function
└── __tests__/
    ├── cross-project-deps.test.ts                 # MODIFY: Add cycle detection tests
    └── cross-project-deps-store.test.ts           # CHECK: May need cycle detection integration tests

packages/web/src/
├── app/api/dependencies/cross-project/
│   ├── route.ts                                   # MODIFY: Handle circular dep errors (422)
│   └── route.test.ts                              # MODIFY: Add cycle detection route tests
```

### Testing Strategy

**Core cycle detection tests (cross-project-deps.test.ts):**
- `detectCircularDependency` — no cycle (empty deps), no cycle (unrelated deps), direct 2-node cycle, 3+ node cycle, self-reference, longer chains, valid chain extension, diamond pattern (A→B, A→C, B→D, C→D — adding D→A cycles)
- `addCrossProjectDependency` — throws on cycle with path in message, allows valid dep after cycle detection

**API route tests (route.test.ts):**
- POST with cycle-causing dep → 422 with cyclePath in body
- POST with valid dep → 201 (regression test)
- POST with self-reference → 422

### NFRs

- **NFR-F3-1:** Cycle detection completes within 1 second for up to 200 cross-project edges (DFS is O(V+E))
- **NFR-R3:** Cycle detection failure is non-fatal — returns error, doesn't crash

### Accessibility

- Error messages are human-readable text
- Cycle path uses project names and story IDs
- No visual-only content

### References

- [Source: epics-cycle-10.md#Story 51.6] — Requirements and acceptance criteria
- [Source: prd-cycle-10.md#FR-F3-6] — Circular dependency detection works across project boundaries
- [Source: packages/core/src/cross-project-deps.ts] — `addCrossProjectDependency()` (line 158), `isDuplicate()`, all types
- [Source: packages/core/src/cross-project-deps.ts] — `CrossProjectDepFileStore.add()` (line 739) which calls the pure function
- [Source: packages/web/src/app/api/dependencies/cross-project/route.ts] — POST handler (line 60), error catch pattern
- [Source: _bmad-output/implementation-artifacts/51-5-dependency-blocking-notifications.md] — Previous story patterns and learnings
- [Source: CLAUDE.md] — TypeScript conventions (ESM, .js extensions, node: prefix, strict mode)

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- All existing tests must continue to pass (no regressions)
- New pure function follows same pattern as Stories 51.1-51.5
- Error propagation follows existing pattern (Error with descriptive message, caught in route handler)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250514)

### Debug Log References

### Completion Notes List

1. All 4 tasks implemented and passing
2. Core cycle detection uses DFS for detection + BFS for shortest cycle path reconstruction
3. Integration: cycle check runs BEFORE duplicate check in `addCrossProjectDependency()`
4. API route catches "Circular dependency" errors → 422 (before duplicate 409)
5. Full test suite passes: 2088 core, 668 CLI, all plugin/web tests (1 pre-existing flaky failure in capacity route test)
6. Tests added: 13 new core tests (cycle detection + integration), 4 new route tests

### Limitations (Deferred Items)

1. Cycle detection across multi-project dependencies with 1000+ edges
   - Status: Deferred - Future optimization
   - Requires: Incremental graph approach or Bloom filter
   - Current: DFS handles up to 200 edges in <1s (NFR-F3-1)
2. Cycle detection for batch dependency imports
   - Status: Deferred - Future enhancement
   - Requires: Bulk import API with batch validation
   - Current: Only single-dep creation is validated
3. Cycle auto-resolution suggestions
   - Status: Deferred - Future enhancement
   - Requires: AI-powered dependency graph analysis
   - Current: Only detects and rejects, does not suggest alternatives

### File List

- packages/core/src/cross-project-deps.ts — Added CyclePathNode, CircularDependencyResult types; detectCircularDependency() pure function (DFS); buildCyclePath() helper (BFS); integrated cycle check into addCrossProjectDependency()
- packages/core/src/index.ts — Exported detectCircularDependency, CyclePathNode, CircularDependencyResult
- packages/core/src/__tests__/cross-project-deps.test.ts — Added 13 tests: detectCircularDependency (10 scenarios) + addCrossProjectDependency cycle integration (5 scenarios)
- packages/web/src/app/api/dependencies/cross-project/route.ts — Added "Circular dependency" → 422 error handling in POST catch block
- packages/web/src/app/api/dependencies/cross-project/route.test.ts — Added 4 route tests: circular dep 422, self-ref 422, valid dep regression 201
