# Story 51.4: Cross-Project Dependency Graph

Status: done

## Story

As a **project manager**,
I want **a visual graph showing dependencies across projects**,
so that **I can understand the complex relationships in my portfolio**.

## Acceptance Criteria

1. **Given** multiple cross-project dependencies exist across configured projects
   **When** I navigate to the Cross-Project Dependencies view
   **Then** I see an SVG-based graph with nodes representing stories grouped by project
   **And** edges connect dependent stories to their target stories
   **And** nodes are color-coded by story status (backlog, ready-for-dev, in-progress, review, done)
   **And** project grouping is visually indicated (project label or column grouping)

2. **Given** the dependency graph is rendered with cross-project edges
   **When** I click on an edge
   **Then** a detail panel or tooltip shows the dependency information
   **And** it includes source story ID, target story ID, source project, target project, and resolved status

3. **Given** up to 200 cross-project dependencies exist across the portfolio
   **When** I view the dependency graph
   **Then** the graph renders within 2 seconds
   **And** the layout is readable with minimal node overlap

4. **Given** no cross-project dependencies exist
   **When** I view the dependency graph
   **Then** an empty state message is displayed: "No cross-project dependencies defined."

5. **Given** the dependency graph is visible
   **When** a cross-project dependency is added or removed via the API
   **Then** the graph refreshes to reflect the change (SSE or manual refresh)

6. **Given** a cross-project dependency references a project not in the current config
   **When** the graph is rendered
   **Then** the orphaned edge is shown with a "unknown project" label
   **And** no error is thrown

## Tasks / Subtasks

- [x] Task 1: Core graph data transformation (AC: #1, #6)
  - [x] 1.1: Create `buildCrossProjectGraph(deps: DependencyWithStatus[], projectNames: Record<string, string>)` in `packages/core/src/cross-project-deps.ts` — pure function that transforms flat dependency list into a graph structure with nodes grouped by project and edges with status info
  - [x] 1.2: Define `CrossProjectGraphNode` type: `{ id: string; storyId: string; projectId: string; projectName: string; status: string; isBlocked: boolean }`
  - [x] 1.3: Define `CrossProjectGraphEdge` type: `{ id: string; sourceNodeId: string; targetNodeId: string; sourceProjectId: string; targetProjectId: string; isResolved: boolean }`
  - [x] 1.4: Define `CrossProjectGraph` type: `{ nodes: CrossProjectGraphNode[]; edges: CrossProjectGraphEdge[]; projectGroups: Record<string, string[]> }`
  - [x] 1.5: Export new types and function from `packages/core/src/index.ts`

- [x] Task 2: API endpoint for graph data (AC: #1, #3, #6)
  - [x] 2.1: Add `GET /api/dependencies/cross-project/graph` route in `packages/web/src/app/api/dependencies/cross-project/graph/route.ts`
  - [x] 2.2: Fetch all cross-project deps via `createCrossProjectDepStore`, enrich with `resolveAllDependencyStatuses` using `buildSprintDataMap`
  - [x] 2.3: Transform enriched deps into `CrossProjectGraph` using `buildCrossProjectGraph`
  - [x] 2.4: Return `{ graph: CrossProjectGraph }` JSON response

- [x] Task 3: Cross-project graph component (AC: #1, #2, #3, #4)
  - [x] 3.1: Create `CrossProjectGraphView` component in `packages/web/src/components/CrossProjectGraphView.tsx`
  - [x] 3.2: Implement project-grouped layout — nodes grouped by project with project label headers, similar column-based approach to existing `DependencyGraphView` but with project dimension
  - [x] 3.3: Render edges between nodes using curved SVG paths (reuse pattern from `DependencyGraphView`)
  - [x] 3.4: Color-code nodes by status using existing `STATUS_FILL` palette
  - [x] 3.5: Implement edge click handler — show tooltip/popover with dependency detail (source/target story, projects, resolved status)
  - [x] 3.6: Implement empty state when no dependencies exist
  - [x] 3.7: Handle orphaned edges (unknown project) gracefully with "unknown project" label

- [x] Task 4: Integration into Portfolio view (AC: #5)
  - [x] 4.1: Add CrossProjectGraphView to the portfolio page or a dedicated tab/section
  - [x] 4.2: Fetch graph data from `/api/dependencies/cross-project/graph` on mount
  - [x] 4.3: Add refresh button for manual graph refresh (SSE auto-refresh deferred to Story 51.5)

- [x] Task 5: Write tests (AC: #1-6)
  - [x] 5.1: Unit tests for `buildCrossProjectGraph` pure function — basic deps, project grouping, empty deps, orphaned edges, resolved vs unresolved
  - [x] 5.2: API route tests for `/api/dependencies/cross-project/graph` — returns graph structure, handles missing deps file, handles empty deps
  - [x] 5.3: Component tests for `CrossProjectGraphView` — renders nodes and edges, shows empty state, edge click shows detail

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
1. SSE auto-refresh for graph
   - Status: Deferred - Story 51.5 (Dependency Blocking Notifications)
   - Requires: SSE event emission for cross-project dep changes
   - Epic: Story 51.5 (Dependency Blocking Notifications)
   - Current: Manual refresh button only — graph does not auto-update when deps change
2. Circular dependency visualization
   - Status: Deferred - Story 51.6 (Circular Dependency Detection)
   - Requires: Cross-project cycle detection algorithm + visual highlighting
   - Epic: Story 51.6 (Circular Dependency Detection)
   - Current: No circular dependency highlighting in cross-project graph
3. Force-directed / interactive layout
   - Status: Deferred - Future enhancement
   - Requires: Graph layout library (d3-force, dagre, elkjs)
   - Epic: Future enhancement
   - Current: Static column-based layout grouped by project
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
- `resolveAllDependencyStatuses(deps, sprintDataMap)` — Enrich deps with target status
- `buildSprintDataMap(config)` — Build SprintDataMap across all projects (from `@/lib/sprint-data-map.ts`)
- `getServices()` — Web API services (config access for project names)
- `buildCrossProjectGraph(deps, projectNames)` — NEW: Transform enriched deps into graph structure

**Feature Flags:**
- Graph rendering is client-side only (SVG) — no server-side rendering of graph visualization
- Maximum tested edge count: 200 (NFR-F3-2). Performance with more edges is not guaranteed.

## Dependency Review

No new dependencies required. Uses existing:
- Vitest for testing
- React for component rendering
- Existing `CrossProjectDepFileStore` and status resolution functions from Stories 51.1-51.2
- Pure SVG rendering (matching `DependencyGraphView` pattern — no graph library needed)
- `buildSprintDataMap` from `@/lib/sprint-data-map.ts`

## Dev Notes

### Architecture Context

This is **Story 4 of 6** in **Epic 51: Cross-Project Dependencies**. It depends on:
- **Story 51.1 (done):** Cross-Project Dependency Definition — types, persistence, validation, API, search
- **Story 51.2 (done):** Dependency Status Tracking — `DependencyWithStatus`, `resolveDependencyStatus`, `areCrossProjectDepsSatisfied`, `getBlockedCrossProjectDeps`, SprintDataMap flattening
- **Story 51.3 (done):** Automatic Story Unblocking — `findCrossProjectDependents`, `autoUnblockCrossProjectDeps`, PATCH route integration

This story adds a **visual graph representation** of cross-project dependencies, showing how stories across different projects depend on each other.

Stories 51.5-51.6 build on this for notifications and cycle detection.

### Previous Story Intelligence (51.3: Automatic Story Unblocking)

Key patterns and learnings:
- **Shared utilities**: `buildSprintDataMap` and `flattenEntry` extracted to `@/lib/sprint-data-map.ts` — reuse for graph data fetching
- **Vitest mock hoisting**: Use `vi.hoisted()` for shared mock objects accessible in both `vi.mock()` factories and test bodies
- **Best-effort error handling**: Cross-project dep operations wrapped in try/catch — graph data fetch should follow same pattern
- **`createCrossProjectDepStore(config.configPath)`**: Standard way to get store instance in API routes

### Existing Graph Pattern (DependencyGraphView.tsx)

The codebase has an established SVG-based graph rendering pattern in `DependencyGraphView.tsx`:
- **Types**: `DependencyNode` (storyId, dependsOn, blockedBy, blocks, isBlocked), `DependencyGraph` (nodes map + circularWarnings + missingWarnings)
- **Layout**: Topological sort → depth layers → grid positioning via `assignLayers()` and `layoutNodes()`
- **Rendering**: SVG with curved path edges (quadratic bezier), `STATUS_FILL` color palette, node rects with text labels
- **Constants**: `NODE_W=120`, `NODE_H=36`, `LAYER_GAP=160`, `NODE_GAP=56`
- **Edge rendering**: Curved path from right side of dep node to left side of dependent node
- **Cycle detection**: `circularEdges` set, red dashed edges, pulsing ring animation

The cross-project graph will follow this same rendering approach but with a key difference:
- **Project grouping**: Instead of topological layers, group nodes by project. Within each project group, apply simple vertical stacking.
- **Cross-project edges**: Connect nodes across project columns, using the same curved path pattern.
- **No external graph library needed**: The existing SVG approach handles up to 200 edges within performance requirements.

### Key Design Decisions

**Project-column layout (not topological):**
Cross-project dependencies connect stories across projects, so the natural grouping is by project (columns), not by dependency depth. Each project gets a vertical column of its story nodes, and edges cross between columns. This is more intuitive for portfolio-level understanding than a topological sort that mixes projects.

**Reuse existing SVG rendering patterns:**
The codebase has a proven pure-SVG graph rendering approach in `DependencyGraphView.tsx`. The cross-project graph will reuse the same rendering primitives (rect nodes, curved path edges, STATUS_FILL palette) with a different layout strategy (project columns vs topological layers). No new graph library needed.

**Pure function for graph data transformation:**
Following the established pattern, `buildCrossProjectGraph()` will be a pure sync function that transforms `DependencyWithStatus[]` into a `CrossProjectGraph` structure. The API route handles I/O (store.list(), buildSprintDataMap), then passes pre-fetched data to the pure function.

**Edge click for details (not node click):**
The AC specifically asks for edge click to show dependency details. This is different from the existing single-project graph. Implement as a tooltip/popover positioned near the clicked edge, showing source/target story, projects, and resolved status.

**Static layout, manual refresh:**
For 200 edges, a static column layout is sufficient. No need for force-directed or interactive layout. Manual refresh button instead of SSE auto-refresh (deferred to Story 51.5).

### File Structure to Modify

```
packages/core/src/
├── cross-project-deps.ts                     # MODIFY: Add buildCrossProjectGraph, CrossProjectGraph types
├── index.ts                                  # MODIFY: Export new types and function
└── __tests__/
    └── cross-project-deps.test.ts            # MODIFY: Add tests for buildCrossProjectGraph

packages/web/src/
├── app/api/dependencies/cross-project/
│   └── graph/
│       └── route.ts                          # NEW: GET /api/dependencies/cross-project/graph
│       └── route.test.ts                     # NEW: API route tests
├── components/
│   └── CrossProjectGraphView.tsx             # NEW: SVG-based cross-project graph component
│   └── __tests__/
│       └── CrossProjectGraphView.test.tsx    # NEW: Component tests
```

### Testing Strategy

**Core tests (cross-project-deps.test.ts):**
- `buildCrossProjectGraph` — basic deps produce nodes+edges, project grouping correct, empty deps → empty graph, orphaned edge (unknown project) → node with "unknown" label, resolved vs unresolved edge status

**Web API tests (route.test.ts):**
- GET returns graph structure with nodes and edges
- GET handles missing deps file gracefully
- GET handles empty deps list

**Component tests (CrossProjectGraphView.test.tsx):**
- Renders nodes with correct project labels
- Renders edges between cross-project nodes
- Shows empty state message when no deps
- Edge click shows dependency detail tooltip

### NFRs

- **NFR-F3-1:** Cross-project dependency checks complete within 1 second (reuse existing SprintDataMap + pure function)
- **NFR-F3-2:** Dependency graph renders with up to 200 cross-project edges within 2 seconds (static SVG layout, no heavy computation)

### Accessibility

- SVG graph includes `role="img"` and `aria-label` describing the graph
- Edge detail tooltip is keyboard-accessible (focusable, Escape to close)
- Status colors have sufficient contrast (WCAG AA)
- Empty state message is accessible to screen readers

### References

- [Source: epics-cycle-10.md#Story 51.4] — Requirements
- [Source: prd-cycle-10.md#FR-F3-4] — The dependency graph visualizes cross-project relationships in the dashboard
- [Source: prd-cycle-10.md#NFR-F3-2] — Dependency graph renders with up to 200 cross-project edges
- [Source: packages/core/src/cross-project-deps.ts] — CrossProjectDependency, DependencyWithStatus, resolveAllDependencyStatuses
- [Source: packages/web/src/components/DependencyGraphView.tsx] — Existing single-project graph rendering pattern
- [Source: packages/web/src/app/api/dependencies/cross-project/route.ts] — Existing cross-project deps API
- [Source: packages/web/src/lib/sprint-data-map.ts] — Shared buildSprintDataMap utility
- [Source: packages/web/src/app/api/sprint/[project]/story/[id]/route.ts] — buildSprintDataMap usage pattern

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- All existing tests must continue to pass (no regressions)
- New functions follow same pure sync pattern as Stories 51.1-51.3
- New component follows same SVG pattern as DependencyGraphView.tsx

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Core rebuild required before web tests can import `buildCrossProjectGraph` from built output
- `vi.hoisted()` pattern used for shared mock state in route tests (consistent with Story 51.3)

### Completion Notes List

1. Task 1 (Core graph transform): Added `CrossProjectGraphNode`, `CrossProjectGraphEdge`, `CrossProjectGraph` types and `buildCrossProjectGraph` pure function to `cross-project-deps.ts`. 8 new tests (74 total in core).
2. Task 2 (API endpoint): Created `GET /api/dependencies/cross-project/graph` route that fetches all deps, enriches with status, builds graph via pure function, and returns JSON. 3 route tests.
3. Task 3 (SVG component): Created `CrossProjectGraphView` with project-column layout, curved SVG edges, status coloring, edge click tooltip, empty state. 7 component tests.
4. Task 4 (Portfolio integration): Added `CrossProjectGraphView` to `PortfolioView` with client-side fetch on mount and manual refresh button. Only shown when >1 project exists.
5. Task 5 (Tests): All 18 new tests passing (8 core + 3 API + 7 component). No regressions in existing test suites.

6. Code Review Fixes (8 issues: 3 HIGH, 3 MEDIUM, 2 LOW — all resolved):
   - H1: `buildCrossProjectGraph` now passes `dep.targetStatus` as `statusHint` to `ensureNode`, so target nodes from DependencyWithStatus get their resolved status instead of "unknown"
   - H2: Added dashed stroke assertion (`stroke-dasharray === "6 3"`) for unresolved edges in component test
   - H3: Replaced O(n) `Array.find()` with O(1) `Map` lookup in `layoutByProject` for 200-edge scale
   - M1+M2: Replaced SVG `foreignObject` tooltip with HTML `div` overlay outside SVG for browser compatibility
   - M3: Route test now uses real `resolveAllDependencyStatuses` and `buildCrossProjectGraph` (integration testing)
   - L1: Extracted shared `STATUS_FILL` to `packages/web/src/lib/status-colors.ts`, imported by both `CrossProjectGraphView` and `DependencyGraphView`
   - L2: Added edge click → tooltip test verifying "Dependency Detail" and "Pending" text

### File List

- `packages/core/src/cross-project-deps.ts` — Added CrossProjectGraphNode, CrossProjectGraphEdge, CrossProjectGraph types and buildCrossProjectGraph pure function
- `packages/core/src/index.ts` — Exported new types and function
- `packages/core/src/__tests__/cross-project-deps.test.ts` — 8 new tests for buildCrossProjectGraph
- `packages/web/src/app/api/dependencies/cross-project/graph/route.ts` — NEW: GET endpoint returning cross-project graph data
- `packages/web/src/app/api/dependencies/cross-project/graph/route.test.ts` — NEW: 3 API route tests
- `packages/web/src/components/CrossProjectGraphView.tsx` — NEW: SVG-based cross-project dependency graph component
- `packages/web/src/components/__tests__/CrossProjectGraphView.test.tsx` — NEW: 8 component tests (7 original + 1 review fix)
- `packages/web/src/components/PortfolioView.tsx` — Integrated CrossProjectGraphView with fetch-on-mount and refresh
- `packages/web/src/lib/status-colors.ts` — NEW: Shared STATUS_FILL palette (DRY refactor from DependencyGraphView + CrossProjectGraphView)
- `packages/web/src/components/DependencyGraphView.tsx` — Updated to import shared STATUS_FILL
