# Story 62.45: Portfolio & Dependencies API

Status: done

## Story

As a developer integrating with the Agent Orchestrator,
I want comprehensive Portfolio API and Dependencies API documentation pages that document all portfolio management endpoints (assignable agents, project utilization, pool cross-references) and cross-project dependency endpoints (CRUD, graph, blocking status, story search, per-project dependency graph, per-project dependency cycles) with their request/response shapes, status codes, and type definitions,
so that I can programmatically manage portfolio resources, inspect cross-project dependencies, detect blocking stories, and understand the complete portfolio and dependency API surface.

## Acceptance Criteria

1. **Portfolio API page** (`docs/api/portfolio.md`) replaces stub with comprehensive content, using Just the Docs front matter: `title: Portfolio API`, `nav_order: 5`, `parent: REST API`, `description` field
2. **Dependencies API page** (`docs/api/dependencies.md`) replaces stub with comprehensive content, using Just the Docs front matter: `title: Dependencies API`, `nav_order: 6`, `parent: REST API`, `description` field
3. **Portfolio Overview section** documents: 2 route files under `/api/sprint/{project}/` (assignable-agents, utilization) plus cross-reference to 2 pool routes already documented in Agents API — 4 endpoints total, all GET
4. **Assignable Agents section** documents: `GET /api/sprint/{project}/assignable-agents` returning agents array with capacity status per agent + summary (total, local, pool), uses `getAssignableAgents()` + `checkCapacity()` from `@composio/ao-core`, 404 on project not found — sourced from `packages/web/src/app/api/sprint/[project]/assignable-agents/route.ts`
5. **Project Utilization section** documents: `GET /api/sprint/{project}/utilization` returning `ProjectAgentUtilization` shape (projectId, totalAgents, activeAgents, utilizationPercent, agentDetails array, poolAgentsTotal, poolAgentsActive, totalActiveTimeMs, totalIdleTimeMs), uses `computeProjectUtilization()` + `getAgentRegistry()`, 404 on project not found — sourced from `packages/web/src/app/api/sprint/[project]/utilization/route.ts`
6. **Pool Routes Cross-Reference section** documents: brief reference to `GET /api/pool/capacity` and `GET /api/pool/utilization` with link to Agents API where they are fully documented, noting these serve the portfolio dashboard
7. **Dependencies Overview section** documents: 6 route files across 2 groups — Cross-Project Dependencies (4 routes under `/api/dependencies/cross-project/`) and Per-Project Dependencies (2 routes under `/api/sprint/{project}/`) — 8 endpoints total (6 GET, 1 POST, 1 DELETE)
8. **Cross-Project Dependencies section** documents: `GET /api/dependencies/cross-project` with query params (projectId, storyId, status=blocked), filtering logic, `POST /api/dependencies/cross-project` with body (sourceProjectId, sourceStoryId, targetProjectId, targetStoryId), validation steps, `DELETE /api/dependencies/cross-project` with body (depId), side effects (notifyCrossProjectDepChange), circular dependency detection — sourced from `packages/web/src/app/api/dependencies/cross-project/route.ts`
9. **Cross-Project Graph section** documents: `GET /api/dependencies/cross-project/graph` returning graph with nodes, edges, projectGroups, uses `buildCrossProjectGraph()` from `@composio/ao-core`, no parameters — sourced from `packages/web/src/app/api/dependencies/cross-project/graph/route.ts`
10. **Cross-Project Blocking Status section** documents: `GET /api/dependencies/cross-project/blocking-status` with query param `threshold` (ms, default 3,600,000 = 1 hour, minimum 1), returns alerts array with blockingDurationMs/Label and thresholdExceeded, uses `createBlockingTimesStore().refresh()` — sourced from `packages/web/src/app/api/dependencies/cross-project/blocking-status/route.ts`
11. **Cross-Project Story Search section** documents: `GET /api/dependencies/cross-project/search-stories` with required query param `q`, returns stories array (id, title, status, projectId), uses `searchCrossProjectStories()` with case-insensitive substring matching — sourced from `packages/web/src/app/api/dependencies/cross-project/search-stories/route.ts`
12. **Per-Project Dependency Graph section** documents: `GET /api/sprint/{project}/dependencies` returning `DependencyGraph` shape (nodes with storyId/dependsOn/blockedBy/blocks/isBlocked, circularWarnings, missingWarnings), requires bmad tracker, graceful empty fallback — sourced from `packages/web/src/app/api/sprint/[project]/dependencies/route.ts`
13. **Per-Project Dependency Cycles section** documents: `GET /api/sprint/{project}/dependency-cycles` returning `DependencyCycleResult` shape (cycles array with cycle/length/statuses, totalCycles, affectedStories) — sourced from `packages/web/src/app/api/sprint/[project]/dependency-cycles/route.ts`
14. **Common Patterns section** documents: no `force-dynamic` on dependencies routes, bmad tracker guard on per-project dependency routes, dynamic import pattern for tracker plugin, graceful empty responses, blocking threshold default (1 hour), cross-project dep change notification side effect
15. **Status Codes section** provides unified table for dependencies: 200, 201 (created), 400 (missing/invalid fields, invalid threshold), 404 (dependency/project not found), 409 (duplicate dependency), 422 (circular dependency), 500
16. **Key Types section** documents relevant types: CrossProjectDependency (6 fields), DependencyWithStatus (8 fields), DependencyGraph, DependencyNode (6 fields), DependencyCycleResult, CycleInfo, DependencyBlockingAlert (9 fields), CrossProjectGraph (nodes/edges/projectGroups), ProjectAgentUtilization, AssignableAgent
17. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
18. **Cross-links** verified: parent link to REST API index, sibling links to other API pages (especially Agents API for pool routes), Getting Started, Configuration
19. **Both pages** have complete content replacing stubs with `description` front matter field (stubs currently lack it)

## Tasks / Subtasks

- [x] Task 1: Write Portfolio API page (AC: #1, #3-6, #19)
  - [x] Replace stub content in docs/api/portfolio.md
  - [x] Write front matter (title, nav_order: 5, parent: REST API, description)
  - [x] Write "Overview" section — 2 direct routes + 2 pool cross-references (AC #3)
  - [x] Write "Assignable Agents" section — GET detail, response shape, capacity status (AC #4)
  - [x] Write "Project Utilization" section — GET detail, ProjectAgentUtilization shape (AC #5)
  - [x] Write "Pool Routes Cross-Reference" section — link to Agents API (AC #6)
  - [x] Write "Common Patterns" section for portfolio (AC #14 partial)
  - [x] Write "Status Codes" section (AC #15 partial)
  - [x] Write "Key Types" section — ProjectAgentUtilization, AssignableAgent (AC #16 partial)
  - [x] Write cross-links section (AC #18)
  - [x] Verify no hero font classes (AC #17)

- [x] Task 2: Write Dependencies API page (AC: #2, #7-16)
  - [x] Replace stub content in docs/api/dependencies.md
  - [x] Write front matter (title, nav_order: 6, parent: REST API, description)
  - [x] Write "Overview" section — 6 routes, 2 groups, 8 endpoints (AC #7)
  - [x] Write "Cross-Project Dependencies" section — GET/POST/DELETE with all params and responses (AC #8)
  - [x] Write "Cross-Project Graph" section — GET graph, nodes/edges/projectGroups (AC #9)
  - [x] Write "Cross-Project Blocking Status" section — GET with threshold param (AC #10)
  - [x] Write "Cross-Project Story Search" section — GET with q param (AC #11)
  - [x] Write "Per-Project Dependency Graph" section — GET DependencyGraph shape (AC #12)
  - [x] Write "Per-Project Dependency Cycles" section — GET DependencyCycleResult shape (AC #13)
  - [x] Write "Common Patterns" section — no force-dynamic, bmad guard, notifications (AC #14)
  - [x] Write "Status Codes" section — unified table (AC #15)
  - [x] Write "Key Types" section — all dependency types (AC #16)
  - [x] Write cross-links section (AC #18)
  - [x] Verify no hero font classes (AC #17)

## Task Completion Validation

**Task Completion Criteria:**
- All 24 subtasks checked off
- Both `docs/api/portfolio.md` and `docs/api/dependencies.md` exist with comprehensive content replacing stubs
- Every AC maps to at least one documentation section
- All source file references are accurate
- Cross-links resolve to existing pages
- No hero font classes used
- Pool route cross-reference correctly links to Agents API
- Route counts verified against actual file listings (6 dependency routes + 2 portfolio routes + 2 pool cross-references)

## Dev Notes

### Architecture Patterns (from Story 62-40/62-41/62-42/62-43/62-44 learnings)

- Just the Docs front matter MUST include `description` field (was missing from original stubs — current stubs lack it)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- Cross-links: parent link to REST API index, sibling links to each API sub-page
- Each section should name its source file(s) for traceability
- Verify cross-links resolve to existing files
- Route counts must be verified against actual file listings (62-42 had inflated epic filter count)
- Type field counts must match actual TypeScript interfaces (62-41 had miscounted fields)
- Response shape details must match source code exactly (adversarial code review found 12 issues in 62-42)
- Issue trend: 62-41 (9) → 62-42 (12) → 62-43 (3) → 62-44 (2) — early investment in source analysis pays off

### Source Tree — Route Inventory (8 route files, 8+ endpoints)

#### Portfolio Routes (2 files under `/api/sprint/{project}/`)

| Route | Method | Description | Auth |
|-------|--------|-------------|------|
| `/api/sprint/{project}/assignable-agents` | GET | Local + pool agents with capacity status | None |
| `/api/sprint/{project}/utilization` | GET | Per-project agent utilization metrics | None |

**Note:** No dedicated `/api/portfolio/` directory exists. Portfolio functionality is served by the above routes + pool routes (documented in Agents API).

#### Cross-Project Dependency Routes (4 files under `/api/dependencies/cross-project/`)

| Route | Method | Description | Side Effects |
|-------|--------|-------------|-------------|
| `/api/dependencies/cross-project` | GET | List/filter dependencies | None |
| `/api/dependencies/cross-project` | POST | Create dependency | `notifyCrossProjectDepChange("created")` |
| `/api/dependencies/cross-project` | DELETE | Remove dependency | `notifyCrossProjectDepChange("deleted")` |
| `/api/dependencies/cross-project/graph` | GET | Dependency graph visualization | None |
| `/api/dependencies/cross-project/blocking-status` | GET | Blocking alerts with threshold | None |
| `/api/dependencies/cross-project/search-stories` | GET | Search stories across projects | None |

#### Per-Project Dependency Routes (2 files under `/api/sprint/{project}/`)

| Route | Method | Description | Tracker Required |
|-------|--------|-------------|-----------------|
| `/api/sprint/{project}/dependencies` | GET | Per-project dependency graph (bmad tracker) | Yes (bmad) |
| `/api/sprint/{project}/dependency-cycles` | GET | Per-project cycle detection (bmad tracker) | Yes (bmad) |

**Note:** Per-project dependency routes use `@composio/ao-plugin-tracker-bmad` (bmad tracker plugin). Cross-project dependency routes use `@composio/ao-core` directly.

### HTTP Method Distribution

| Method | Count | Usage |
|--------|-------|-------|
| GET | 8 | Reads, queries, graphs |
| POST | 1 | Create dependency |
| DELETE | 1 | Remove dependency |

### Pool Routes — Already Documented in Agents API

The following routes were documented in Story 62-43 (Agents API). They should be cross-referenced, NOT re-documented:

| Route | Method | Documentation Location |
|-------|--------|----------------------|
| `/api/pool/capacity` | GET | `docs/api/agents.md` — "Pool Capacity" section |
| `/api/pool/utilization` | GET | `docs/api/agents.md` — "Pool Utilization" section |

### Cross-Project Dependencies CRUD — Request/Response Shapes

#### GET /api/dependencies/cross-project

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | No | Filter to project (source or target) |
| `storyId` | string | No | Filter to story (requires `projectId`) |
| `status` | string | No | Only `"blocked"` — filters to unresolved |

**Filtering Logic:**
- Both `projectId` + `storyId`: `store.getForStory(projectId, storyId)`
- Only `projectId`: `store.list({ projectId })`
- Neither: `store.list()` (all)
- `status=blocked`: `getBlockedCrossProjectDeps()` instead of `resolveAllDependencyStatuses()`

**Response fields vary by enrichment:**
- Basic (blocked filter): `id, sourceProjectId, sourceStoryId, targetProjectId, targetStoryId, createdAt`
- Enriched (no blocked filter): adds `targetStatus, isResolved`

#### POST /api/dependencies/cross-project

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `sourceProjectId` | string | Yes |
| `sourceStoryId` | string | Yes |
| `targetProjectId` | string | Yes |
| `targetStoryId` | string | Yes |

**Validation Pipeline:**
1. All 4 fields truthy → 400 if missing
2. `validateDependencyReferences()` checks project/story existence → 400 with details
3. `store.add()` runs cycle detection (DFS) → 422 `CircularDependencyError`
4. `store.add()` runs duplicate detection → 409

**Side effect:** `notifyCrossProjectDepChange({ action: "created", depId, timestamp })`

#### DELETE /api/dependencies/cross-project

**Request Body:** `{ "depId": "string" }` (required)

**Side effect:** `notifyCrossProjectDepChange({ action: "deleted", depId, timestamp })`

### Cross-Project Graph — Response Shape

```json
{
  "graph": {
    "nodes": [{ "id": "projectId::storyId", "storyId", "projectId", "projectName", "status", "isBlocked" }],
    "edges": [{ "id": "depId", "sourceNodeId", "targetNodeId", "sourceProjectId", "targetProjectId", "isResolved" }],
    "projectGroups": { "projectId": ["nodeId1", "nodeId2"] }
  }
}
```

- Project names resolved from `config.projects`, fallback to project ID
- Nodes deduplicated by `projectId::storyId`
- Edges map 1:1 to dependencies

### Blocking Status — Key Constants

| Constant | Value | Source |
|----------|-------|--------|
| `DEFAULT_BLOCKING_THRESHOLD_MS` | 3,600,000 (1 hour) | `packages/core/src/cross-project-deps.ts` |
| `BLOCKING_TIMES_FILENAME` | `cross-project-blocking-times.yaml` | `packages/core/src/cross-project-blocking-times.ts` |

**Blocking alert fields:** dep (full DependencyWithStatus), blockedStoryId, blockedProjectId, blockingStoryId, blockingProjectId, blockingDurationMs, blockingDurationLabel (human-readable like "2h 30m"), thresholdExceeded

### Per-Project Dependency Routes — bmad Tracker Guard

Both per-project routes check `project.tracker?.plugin === "bmad"`:
- If not bmad tracker: returns empty default response (`{ nodes: {}, circularWarnings: [], missingWarnings: [] }` or `{ cycles: [], totalCycles: 0, affectedStories: [] }`)
- If bmad tracker: reads sprint-status.yaml, parses `dependsOn` arrays, builds graph with DFS cycle detection

### DependencyNode Shape (Per-Project)

| Field | Type | Description |
|-------|------|-------------|
| `storyId` | string | Story identifier |
| `dependsOn` | string[] | Declared dependencies |
| `blockedBy` | string[] | Dependencies not yet done |
| `blocks` | string[] | Stories this one blocks (reverse) |
| `isBlocked` | boolean | `blockedBy.length > 0` |

### DependencyCycleResult Shape (Per-Project)

| Field | Type | Description |
|-------|------|-------------|
| `cycles` | CycleInfo[] | Detected cycles |
| `totalCycles` | number | Count of cycles |
| `affectedStories` | string[] | All story IDs in any cycle |

**CycleInfo:** `{ cycle: string[], length: number, statuses: Record<string, string> }`

### ProjectAgentUtilization Shape

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | string | Project identifier |
| `totalAgents` | number | Total sessions for project |
| `activeAgents` | number | Sessions with `activity === "active"` or `status === "working"` |
| `utilizationPercent` | number | `round((activeAgents / totalAgents) * 100)` |
| `agentDetails` | AgentUtilization[] | Per-agent breakdown |
| `poolAgentsTotal` | number | Total pool agents (0 if not pool project) |
| `poolAgentsActive` | number | Active pool agents |
| `totalActiveTimeMs` | number | Sum of active agent durations |
| `totalIdleTimeMs` | number | Sum of idle agent durations |

### Assignable Agents Response Shape

```json
{
  "agents": [{
    "agentId": "string",
    "projectId": "string",
    "sourceProjectId": "string | null",
    "isPoolAgent": "boolean",
    "currentWorkload": "number",
    "capacityStatus": {
      "maxCapacity": "number",
      "availableSlots": "number",
      "isAtCapacity": "boolean",
      "isNearCapacity": "boolean",
      "utilizationPercent": "number"
    }
  }],
  "summary": { "total": 3, "local": 2, "pool": 1 }
}
```

Uses `getAssignableAgents()` (local idle + eligible pool agents) + `checkCapacity()` per agent.

### Key Behavioral Patterns

- **No `force-dynamic`**: None of the dependency or portfolio routes export `force-dynamic` — they all use Next.js defaults
- **bmad tracker guard**: Per-project dependency routes return empty data when tracker is not bmad — not an error condition
- **Dynamic import pattern**: `buildSprintDataMap()` and `search-stories` route dynamically import `@composio/ao-plugin-tracker-bmad` — individual project failures are caught and logged, not fatal
- **Circular dependency detection**: DFS-based cycle detection in `addCrossProjectDependency()` — prevents creation of cycles. `CircularDependencyError` includes `cyclePath: CyclePathNode[]`
- **Duplicate detection**: Prevents same source→target pair from being added twice
- **Dependency ID format**: `"dep-<timestamp-base36>-<random-8hex>"` — generated via `randomBytes`
- **Blocking times persistence**: `BlockingTimesFileStore` persists to `cross-project-blocking-times.yaml` alongside config — preserves start times across restarts
- **Cross-project dep notifications**: Pub/sub via `notifyCrossProjectDepChange()` — module-level state (single-process only)
- **Project name resolution**: Graph route resolves names from `config.projects`, falls back to project ID
- **Sprint data map**: `buildSprintDataMap()` flattens `SprintStatusEntry` objects to plain string status values
- **Auto-unblock**: `autoUnblockCrossProjectDeps()` finds stories whose ALL cross-project deps are satisfied after completion — single-pass only (no cascading)
- **Validation pipeline**: POST validates missing fields → reference existence → cycle detection → duplicate detection, each with specific error codes

### Source Files for Documentation

#### Portfolio API page sources
- `packages/web/src/app/api/sprint/[project]/assignable-agents/route.ts`
- `packages/web/src/app/api/sprint/[project]/utilization/route.ts`
- `packages/core/src/agent-utilization.ts` — `computeProjectUtilization()`, `ProjectAgentUtilization` type
- `packages/core/src/cross-project-assignment.ts` — `getAssignableAgents()`, `AssignableAgent` type
- `packages/core/src/capacity-check.ts` — `checkCapacity()`
- `packages/web/src/lib/portfolio-aggregation.ts` — `aggregatePortfolioProjects()`
- `packages/web/src/lib/portfolio-filter.ts` — `filterProjects()`, `EMPTY_FILTERS`
- `packages/web/src/lib/portfolio-metrics.ts` — `calculatePortfolioMetrics()`, sprint health score formula

#### Dependencies API page sources
- `packages/web/src/app/api/dependencies/cross-project/route.ts` — CRUD (GET/POST/DELETE)
- `packages/web/src/app/api/dependencies/cross-project/graph/route.ts` — graph visualization
- `packages/web/src/app/api/dependencies/cross-project/blocking-status/route.ts` — blocking alerts
- `packages/web/src/app/api/dependencies/cross-project/search-stories/route.ts` — story search
- `packages/web/src/app/api/sprint/[project]/dependencies/route.ts` — per-project graph
- `packages/web/src/app/api/sprint/[project]/dependency-cycles/route.ts` — per-project cycles
- `packages/core/src/cross-project-deps.ts` — 999 lines, all dependency types and logic
- `packages/core/src/cross-project-blocking-times.ts` — `BlockingTimesFileStore`
- `packages/core/src/cross-project-blocking-notifier.ts` — `checkAndNotifyBlockingDeps()`
- `packages/web/src/lib/cross-project-dep-events.ts` — pub/sub notifications
- `packages/web/src/lib/sprint-data-map.ts` — `buildSprintDataMap()`
- `packages/plugins/tracker-bmad/src/dependencies.ts` — `computeDependencyGraph()`, `detectDependencyCycles()`

### Testing Standards

- Verify documentation accuracy against source code (adversarial code review)
- Check all route counts match actual file listings
- Verify API endpoint parameters and response shapes match route implementations
- Confirm query parameter names, defaults, and validation match source
- Validate status codes match route implementations (especially 409/422 for dependency creation)
- Verify blocking threshold default matches source (3,600,000 = 1 hour)
- Confirm DependencyGraph and DependencyCycleResult shapes match tracker plugin source
- Verify ProjectAgentUtilization shape matches agent-utilization.ts
- Confirm CrossProjectDependency fields (6 fields, not 5 or 7)
- Verify CrossProjectGraphNode/Edge shapes match graph route
- Confirm per-project dependency routes check for bmad tracker
- Verify search-stories dynamic import pattern documented

### Project Structure Notes

**Portfolio API:**
- Doc file location: `docs/api/portfolio.md`
- Nav order: 5 (fifth child under REST API)
- Parent: REST API (`docs/api/index.md`)
- Sibling pages: sessions (1), sprints (2), agents (3), events (4), dependencies (6), scenarios (7), conflicts (8), risk (9)
- Current stub references "Story 62.19" — incorrect, this is Story 62-45
- No `/api/portfolio/` route directory exists — portfolio endpoints live under `/api/sprint/{project}/` and `/api/pool/`

**Dependencies API:**
- Doc file location: `docs/api/dependencies.md`
- Nav order: 6 (sixth child under REST API)
- Parent: REST API (`docs/api/index.md`)
- Sibling pages: sessions (1), sprints (2), agents (3), events (4), portfolio (5), scenarios (7), conflicts (8), risk (9)
- Current stub references "Story 62.19" — incorrect, this is Story 62-45
- Cross-project routes under `/api/dependencies/cross-project/`, per-project under `/api/sprint/{project}/`

### References

- [Source: _bmad-output/planning-artifacts/epics-documentation.md#Story 62.45]
- [Source: packages/web/src/app/api/dependencies/cross-project/route.ts]
- [Source: packages/web/src/app/api/dependencies/cross-project/graph/route.ts]
- [Source: packages/web/src/app/api/dependencies/cross-project/blocking-status/route.ts]
- [Source: packages/web/src/app/api/dependencies/cross-project/search-stories/route.ts]
- [Source: packages/web/src/app/api/sprint/[project]/assignable-agents/route.ts]
- [Source: packages/web/src/app/api/sprint/[project]/utilization/route.ts]
- [Source: packages/web/src/app/api/sprint/[project]/dependencies/route.ts]
- [Source: packages/web/src/app/api/sprint/[project]/dependency-cycles/route.ts]
- [Source: packages/core/src/cross-project-deps.ts — all dependency types, store, pure functions]
- [Source: packages/core/src/cross-project-blocking-times.ts — BlockingTimesFileStore]
- [Source: packages/core/src/agent-utilization.ts — computeProjectUtilization()]
- [Source: packages/plugins/tracker-bmad/src/dependencies.ts — computeDependencyGraph(), detectDependencyCycles()]
- [Source: packages/web/src/lib/cross-project-dep-events.ts — pub/sub notifications]
- [Source: packages/web/src/lib/sprint-data-map.ts — buildSprintDataMap()]

## Change Log

- 2026-04-26: Story created from sprint backlog
- 2026-04-26: Replaced 2 stub files with comprehensive Portfolio API (~120 lines) and Dependencies API (~340 lines) documentation
- 2026-04-26: Adversarial code review — 3 HIGH, 4 MEDIUM, 3 LOW fixes applied across both doc files. Key findings: (H1) utilizationPercent example showed 33.3 but Math.round produces integers, (H2) search-stories filtering described wrong pattern — actual code uses startsWith/endsWith checks not regex, (H3) dependency-cycles route has NO bmad tracker guard unlike dependencies route. All 10 fixes applied.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes

- Replaced `docs/api/portfolio.md` stub (9 lines) with comprehensive documentation (~120 lines)
- Replaced `docs/api/dependencies.md` stub (9 lines) with comprehensive documentation (~340 lines)
- All 19 acceptance criteria covered across both pages
- Portfolio API: Assignable Agents, Project Utilization, Pool Routes cross-reference, Common Patterns, Status Codes, Key Types
- Dependencies API: Cross-Project Dependencies (GET/POST/DELETE), Cross-Project Graph, Blocking Status, Story Search, Per-Project Graph, Per-Project Cycles, Common Patterns, Status Codes, Key Types (8 types documented)
- Front matter includes `description` field (was missing from stubs)
- Cross-links: parent REST API, sibling API pages (agents, events, sprints, portfolio/dependencies cross-link), getting-started pages
- No hero font classes used
- Route counts verified: 2 portfolio routes + 6 dependency routes + 2 pool cross-references = 10 endpoints across 8 route files
- Pool routes correctly cross-referenced to Agents API (not re-documented)
- Per-project dependency routes document bmad tracker guard with graceful empty fallback
- Validation pipeline documented: missing fields → reference validation → cycle detection → duplicate detection

### Code Review Results

- 10 issues found and fixed across both documentation files
- **HIGH (3)**: utilizationPercent decimal impossible (Math.round), search-stories filtering logic wrong, dependency-cycles tracker guard claim wrong
- **MEDIUM (4)**: Pool routes 404 edge case missing, isPoolAgent per-project semantics, Common Patterns bmad guard scope, Graceful Empty Responses bullet
- **LOW (3)**: Graph node isBlocked example mismatch, formatDurationLabel examples incomplete, deriveStoryTitle description over-specified
- All issues fixed in-place in both `docs/api/portfolio.md` and `docs/api/dependencies.md`

### File List

- `docs/api/portfolio.md` — replaced stub with comprehensive Portfolio API documentation
- `docs/api/dependencies.md` — replaced stub with comprehensive Dependencies API documentation
