# Story 16.4: Artifact Scanner Service

Status: done

## Story

As a **developer**,
I want a service that scans `_bmad-output/` and builds the artifact dependency graph,
So that project state is queryable from flat files and the state machine can evaluate transitions.

## Acceptance Criteria

1. **AC1: Dependency graph built from classified artifacts**
   - **Given** `_bmad-output/` contains BMAD artifacts with frontmatter
   - **When** the graph builder runs on scanner output
   - **Then** it produces nodes (one per artifact) and edges (dependency relationships)
   - **And** each node contains: filename, path, phase, type, modifiedAt, dependsOn[], referencedBy[]

2. **AC2: Explicit dependencies detected from YAML frontmatter**
   - **Given** an artifact file with `inputDocuments:` in its YAML frontmatter
   - **When** the graph builder parses the file
   - **Then** each listed input document is recorded as a dependency edge
   - **And** broken references (file not found in artifacts) are logged but don't fail

3. **AC3: Graph built incrementally via file watcher**
   - **Given** the existing `workflow-watcher.ts` detects a file change
   - **When** the change callback fires
   - **Then** the graph updates only the affected artifact (not full rescan)
   - **And** the incremental update completes in <100ms for a single file change

4. **AC4: Performance within target**
   - **Given** a project with <100 artifacts
   - **When** the full graph is built
   - **Then** scanning + graph building completes in <500ms (NFR-WF-P1)
   - **And** `fs.watch()` incremental updates complete in <100ms

5. **AC5: GuardContext produced for state machine**
   - **Given** a built artifact graph
   - **When** the state machine needs to evaluate transitions
   - **Then** a `GuardContext` is produced with `phasePresence` and `artifacts` from the graph
   - **And** `createBmadStateMachine().getAvailableTransitions(phase, context)` works correctly

6. **AC6: Factory function pattern**
   - **Given** the new service
   - **When** instantiated
   - **Then** it follows factory function + impl class pattern (AC-AI-1)
   - **And** uses `fs.watch()` for file watching (consistent with existing workflow-watcher.ts)
   - **And** handles missing directories gracefully (returns empty graph)

7. **AC7: Comprehensive tests**
   - **Given** the artifact graph builder
   - **When** tests run
   - **Then** all graph-building scenarios are covered (empty, single file, full project, broken refs)
   - **And** incremental updates tested
   - **And** all tests pass with `pnpm test`

## Tasks / Subtasks

- [x] Task 1: Define artifact graph types (AC: #1)
  - [x] 1.1: Add `ArtifactNode` interface (extends ClassifiedArtifact with dependsOn/referencedBy)
  - [x] 1.2: Add `ArtifactDependencyGraph` interface (nodes Map, edges array)
  - [x] 1.3: Add `ArtifactGraphService` interface (build, getGraph, getGuardContext, dispose)

- [x] Task 2: Implement frontmatter dependency parser (AC: #2)
  - [x] 2.1: Create `packages/web/src/lib/workflow/artifact-graph.ts`
  - [x] 2.2: Implement `parseFrontmatterDeps(content)` — regex-based YAML frontmatter extraction
  - [x] 2.3: Handles malformed/missing frontmatter (returns empty array)

- [x] Task 3: Implement graph builder (AC: #1, #5)
  - [x] 3.1: Implement `buildArtifactGraph(artifacts, projectRoot)` — parallel file reads via Promise.all
  - [x] 3.2: Bidirectional edges: dependsOn + referencedBy
  - [x] 3.3: `buildGuardContext(graph)` produces GuardContext for state machine
  - [x] 3.4: Broken references silently skipped (no edges created)

- [-] Task 4: Implement incremental update (AC: #3)
  - [-] 4.1: Deferred — service uses full rebuild via `build()`. Incremental per-file update deferred to Story 16.5.
  - [-] 4.2: Deferred — remove artifact deferred to Story 16.5.
  - [x] 4.3: Service `dispose()` clears cache; watcher integration deferred to 16.5.

- [x] Task 5: Implement service factory (AC: #6)
  - [x] 5.1: `createArtifactGraphService(projectRoot, bmadOutputDir?)` factory
  - [x] 5.2: Service manages: build, getGraph, getGuardContext, dispose
  - [x] 5.3: Lazy initialization — graph built on first `getGraph()` call
  - [x] 5.4: Missing directories handled gracefully via scanner's error swallowing

- [x] Task 6: Write tests (AC: #7)
  - [x] 6.1: Created `artifact-graph.test.ts` — 21 tests
  - [x] 6.2: Graph building with mocked readFile (no real I/O)
  - [x] 6.3: Frontmatter parsing: valid, missing, malformed, empty, quoted paths (7 tests)
  - [x] 6.4: Broken references don't crash (1 test)
  - [x] 6.5: GuardContext production (2 tests)
  - [-] 6.6: Incremental update tests deferred (Task 4 deferred)
  - [x] 6.7: Performance test (<500ms for 100 artifacts)

- [x] Task 7: Validate backward compatibility
  - [x] 7.1: Existing scanAllArtifacts unchanged — all scan-artifacts tests pass
  - [x] 7.2: API route unchanged (graph service is additive)
  - [x] 7.3: `pnpm test` — web: 44 files, 858 tests pass
  - [x] 7.4: `pnpm build` — all packages build

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions
- No placeholder tests
- Deferred items explicitly documented
- No hidden TODOs or FIXMEs

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] No hidden TODOs/FIXMEs
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [ ] `scanAllArtifacts()` from scan-artifacts.ts — verified exists, unchanged
- [ ] `buildPhasePresence()` from scan-artifacts.ts — verified exists, use as reference
- [ ] `classifyArtifact()` from artifact-rules.ts — verified exists, used by scanner
- [ ] `subscribeWorkflowChanges()` from workflow-watcher.ts — verified exists, for incremental updates
- [ ] `GuardContext` from types.ts — verified exists (Story 16.2)

**Feature Flags:**
- [ ] None — additive service, doesn't modify existing behavior

## Dev Notes

### Architecture Patterns & Constraints

**CRITICAL — Follow these patterns exactly:**

1. **EXTEND, don't replace** — Keep `scanAllArtifacts()` exactly as-is. The graph builder takes scanner output as input:
   ```typescript
   // ✅ CORRECT — graph builds ON TOP of scanner
   const artifacts = await scanAllArtifacts(projectRoot);
   const graph = await buildArtifactGraph(artifacts, projectRoot);

   // ❌ WRONG — don't merge scanner and graph into one function
   const graph = await scanAndBuildGraph(projectRoot);
   ```

2. **Factory function + impl class** pattern (AC-AI-1):
   ```typescript
   export function createArtifactGraphService(
     projectRoot: string,
     bmadOutputDir?: string,
   ): ArtifactGraphService {
     return new ArtifactGraphServiceImpl(projectRoot, bmadOutputDir);
   }
   ```

3. **Frontmatter parsing** — BMAD artifacts use YAML frontmatter with `inputDocuments:` array:
   ```yaml
   ---
   inputDocuments:
     - _bmad-output/planning-artifacts/prd.md
     - _bmad-output/planning-artifacts/architecture.md
   ---
   ```
   Parse with simple regex or YAML parser. Don't add new dependencies (AC-AI-2).

4. **Existing YAML dependency** — The `yaml` package (v2.8.2) is already approved in core. Check if it's available in web package, otherwise use regex parsing for frontmatter.

5. **Error handling** — Same pattern as existing scanner: swallow all errors, return partial results:
   ```typescript
   // ✅ CORRECT — never throw from graph builder
   try {
     const content = await readFile(artifact.path, "utf-8");
     const deps = parseFrontmatterDeps(content);
     // ... build edges
   } catch {
     // File unreadable — skip, return partial graph
   }
   ```

6. **fs.watch() for incremental** — Consistent with existing workflow-watcher.ts. Don't introduce chokidar in web package.

### Source Tree Components to Touch

| File | Action | Notes |
|------|--------|-------|
| `packages/web/src/lib/workflow/types.ts` | ADD | ArtifactNode, ArtifactDependencyGraph, ArtifactGraphService interfaces |
| `packages/web/src/lib/workflow/artifact-graph.ts` | CREATE | Graph builder, frontmatter parser, service factory |
| `packages/web/src/lib/workflow/__tests__/artifact-graph.test.ts` | CREATE | Comprehensive graph tests |

### What NOT to Touch

- `scan-artifacts.ts` — keep existing scanner unchanged
- `artifact-rules.ts` — keep classification rules unchanged
- `workflow-watcher.ts` — existing watcher is fine; graph service subscribes to it
- `route.ts` (API) — don't modify API route; graph service is consumed by future stories (16.5, 17.x)
- `compute-state.ts` — phase inference algorithm unchanged
- `recommendation-engine.ts` — unchanged until Story 17.3

### Frontmatter Format in Existing Artifacts

Existing BMAD artifacts use this frontmatter pattern:
```yaml
---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
workflowType: architecture
project_name: agent-orchestrator
---
```

**Key field for dependencies:** `inputDocuments` — array of relative paths to source documents.

Not all artifacts have this field. Implementation artifacts (story specs) often have it; some planning artifacts don't. Handle absence gracefully.

### GuardContext Production

The graph service must produce a `GuardContext` compatible with the state machine:

```typescript
function buildGuardContext(graph: ArtifactDependencyGraph): GuardContext {
  const artifacts = Array.from(graph.nodes.values());
  return {
    phasePresence: buildPhasePresence(artifacts), // Reuse existing function
    artifacts,
  };
}
```

This connects the graph to the state machine from Story 16.2.

### Performance Requirements

- NFR-WF-P1: <500ms for <100 artifacts (full build including file reads)
- Incremental: <100ms for single file change
- The existing scanner runs in ~10ms for 100 files (metadata only). File reading for frontmatter adds ~50-100ms for 100 files. Total should be well under 500ms.

### Dependency Graph Edges

Two types of edges:
1. **Explicit** — from `inputDocuments` frontmatter field
2. **Implicit** — future enhancement (markdown link parsing). NOT in scope for this story — keep it simple.

### Testing Standards

- Use vitest `describe/it` with helper functions for creating mock artifacts
- Mock file system for unit tests (no real I/O in fast tests)
- One integration-style test reading real `_bmad-output/` if it exists
- Follow patterns from scan-artifacts.test.ts (vi.mock for fs operations)

### References

- [Source: packages/web/src/lib/workflow/scan-artifacts.ts] — Existing scanner (keep unchanged)
- [Source: packages/web/src/lib/workflow/__tests__/scan-artifacts.test.ts] — Existing scanner tests (pattern reference)
- [Source: packages/web/src/lib/workflow/workflow-watcher.ts] — Existing file watcher
- [Source: packages/web/src/lib/workflow/types.ts] — GuardContext, ClassifiedArtifact types
- [Source: packages/web/src/lib/workflow/state-machine.ts] — State machine consuming GuardContext
- [Source: epics-cycle-3-4.md#Epic 6a, Story 6a.4] — Epic/story requirements

### Project Structure Notes

- New file in `packages/web/src/lib/workflow/` (consistent with existing modules)
- No core package changes needed
- Graph service is web-only (dashboard consumption)
- Service is stateful (holds graph in memory) — one instance per project

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- vi.mock shared reference pattern needed for readFile — mock factory creates new vi.fn() that doesn't match test's vi.mocked() reference
- Solution: declare shared `mockReadFileFn = vi.fn()` before vi.mock, use same ref in factory and tests
- mockImplementation with filename matching needed for multi-file mocks (Promise.all makes order non-deterministic)
- Temporary DEBUG_GRAPH env var used to diagnose silent catch swallowing TypeError (removed after fix)

### Completion Notes List

- Created artifact-graph.ts: parseFrontmatterDeps, buildArtifactGraph, buildGuardContext, createArtifactGraphService
- 4 new types in types.ts: ArtifactNode, ArtifactEdge, ArtifactDependencyGraph, ArtifactGraphService
- Frontmatter parsing uses regex (no new deps — AC-AI-2)
- Graph builder reads files in parallel via Promise.all
- Service factory with lazy init and cache
- 21 tests covering: frontmatter parsing (7), graph building (5), GuardContext (2), service (5), performance (1), error handling (1)
- DEFERRED: Incremental per-file update (Task 4) — service uses full rebuild. Per-file updates deferred to Story 16.5 where watcher integration happens.

### Limitations (Deferred Items)

1. Incremental per-file graph update
   - Status: Deferred — full rebuild used instead
   - Requires: Story 16.5 (workflow events + watcher integration)
   - Current: `build()` does full rescan, `dispose()` clears cache

### File List

- `packages/web/src/lib/workflow/types.ts` — MODIFIED (added ArtifactNode, ArtifactEdge, ArtifactDependencyGraph, ArtifactGraphService)
- `packages/web/src/lib/workflow/artifact-graph.ts` — CREATED (graph builder + service factory)
- `packages/web/src/lib/workflow/__tests__/artifact-graph.test.ts` — CREATED (21 tests)
