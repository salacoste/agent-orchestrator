# Story 53.1: Unified Sprint Dashboard

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **project manager**,
I want **to see all active sprints across projects in a single view**,
so that **I can monitor portfolio-wide sprint progress without switching contexts**.

## Acceptance Criteria

1. **Given** multiple projects have active sprints
   **When** I navigate to the unified sprint view
   **Then** I see all active sprints with name, project, start/end dates, and progress
   **And** the view loads within 2 seconds for up to 50 projects

## Tasks / Subtasks

- [x] Task 1: Define unified sprint types (AC: #1)
  - [x] 1.1: Define `UnifiedSprintEntry` interface: `{ projectId, projectName, sprintName, startDate, endDate, stories: { total, done, inProgress, blocked, backlog }, progressPercent, status: "active" | "completed" | "planning", health: "on-track" | "at-risk" | "blocked" }`
  - [x] 1.2: Define `UnifiedSprintSummary` interface: `{ totalSprints, activeSprints, completedSprints, totalStories, storiesDone, avgProgress }`
  - [x] 1.3: Define `SprintHealthStatus` type: `"on-track" | "at-risk" | "blocked"`
  - [x] 1.4: Export new types from `packages/web/src/lib/types.ts`

- [x] Task 2: Implement sprint aggregation logic (AC: #1)
  - [x] 2.1: Create `packages/web/src/lib/unified-sprint-aggregation.ts` — sprint aggregation module
  - [x] 2.2: Implement `aggregateUnifiedSprints(config, sessionManager): Promise<UnifiedSprintEntry[]>` — iterate over all configured projects, collect sprint status per project using tracker-bmad `readSprintStatus()`, compute progress and health per sprint
  - [x] 2.3: Implement `computeSprintSummary(sprints): UnifiedSprintSummary` — pure function computing total/active/completed counts, aggregate story stats, average progress
  - [x] 2.4: Implement `computeSprintHealth(entry): SprintHealthStatus` — pure function: "at-risk" if blocked > 0 or progress < 50% with > 75% elapsed time, "blocked" if all stories blocked, else "on-track"
  - [x] 2.5: Write unit tests for aggregation, summary, and health computation functions

- [x] Task 3: Add unified sprint API route (AC: #1)
  - [x] 3.1: Create `packages/web/src/app/api/sprints/unified/route.ts` — GET endpoint returning aggregated sprint data across all projects
  - [x] 3.2: Handle edge cases: no projects configured (200 with empty array), tracker read errors per project (skip with console.warn)
  - [x] 3.3: Write route tests

- [x] Task 4: Create unified sprint dashboard page and components (AC: #1)
  - [x] 4.1: Create `packages/web/src/app/sprints/page.tsx` — server component that fetches unified sprint data and renders `UnifiedSprintView`
  - [x] 4.2: Create `packages/web/src/components/UnifiedSprintView.tsx` — main client component rendering the sprint grid with summary cards and sprint list
  - [x] 4.3: Create `packages/web/src/components/UnifiedSprintSummaryCards.tsx` — summary cards: total sprints, active sprints, total stories done, average progress
  - [x] 4.4: Create `packages/web/src/components/SprintCard.tsx` — individual sprint card showing project name, sprint name, dates, progress bar with health coloring, story breakdown
  - [x] 4.5: Add navigation link to `/sprints` in the Navigation component
  - [x] 4.6: Write component tests for UnifiedSprintView, UnifiedSprintSummaryCards, SprintCard

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
- Deferred items explicitly documented

**Deferred Items Tracking:**

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. Sprint SSE real-time updates
   - Status: Deferred - Initial implementation uses on-demand fetch
   - Requires: SSE event broadcasting for sprint state changes across projects
   - Current: Manual page refresh to update sprint data
2. Sprint date range filtering
   - Status: Deferred - Part of Story 53.5 (Sprint Filtering and Aggregation)
   - Requires: Date picker components, filter state management
   - Current: All sprints shown without date filtering
```

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- `OrchestratorConfig.projects` — iterate configured projects
- `SessionManager.list()` — get active sessions per project (optional, for agent context)
- `readSprintStatus(project)` from `@composio/ao-plugin-tracker-bmad` — read sprint-status.yaml per project
- `buildSprintDataMap(config)` from `@/lib/sprint-data-map` — existing utility for cross-project sprint data
- `getServices()` from `@/lib/services` — service access in API routes
- `Tracker.listIssues()` — optional: list issues for story count enrichment

**Feature Flags:**
- None required — uses existing project configuration and tracker infrastructure

## Dependency Review

No new external dependencies required. Uses existing:
- Vitest for testing
- `@composio/ao-core` for types
- `@composio/ao-plugin-tracker-bmad` for sprint status reading
- React hooks for UI components
- Tailwind CSS for styling

## Dev Notes

### Architecture Context

This is **Story 1 of 5** in **Epic 53: Unified Sprint View**. It depends on:
- **Epic 49 (done):** Portfolio Dashboard — project aggregation pattern, `PortfolioProject` type, `aggregatePortfolioProjects()` function
- **Epic 51 (done):** Cross-Project Dependencies — `SprintDataMap` type, `buildSprintDataMap()` utility

This story builds the **unified sprint aggregation layer** — collecting sprint data from all configured projects into a single view with summary statistics and health indicators.

### Previous Story Intelligence (52.5: Conflict History Tracking)

Key patterns and learnings from the most recently completed story:
- **Pure function pattern**: `filterConflictHistory()`, `computeConflictPatterns()` are pure sync functions. Follow the same pattern for `computeSprintSummary()` and `computeSprintHealth()` — pure functions, no I/O
- **Route testing with plain Request**: Use `new URL(request.url)` instead of `request.nextUrl` (which only exists on `NextRequest`). This is critical for testable routes.
- **Server/Client component split**: Server component (`page.tsx`) fetches data, passes to client component wrapper for interactivity. Follow same pattern for `/sprints/page.tsx` → `UnifiedSprintView`.
- **Build before test**: Always rebuild `@composio/ao-core` after adding new exports
- **Component test pattern**: Use `vi.stubGlobal("fetch", ...)` for mocking fetch in view component tests. Use `render()` + `screen.getByText()` + `waitFor()` for async loading states.

### Sprint Data Access Pattern

**How sprint data flows:**

1. Each configured project has a `tracker` plugin (typically BMAD)
2. BMAD tracker reads `sprint-status.yaml` from the project's `_bmad-output/` directory
3. `readSprintStatus(project)` returns `SprintStatusResult` with `development_status` record
4. Each entry in `development_status` maps a story key (e.g., "53-1-unified-sprint-dashboard") to a status string or `SprintStatusEntry` object

**Existing utilities to reuse:**
- `buildSprintDataMap(config)` in `packages/web/src/lib/sprint-data-map.ts` — already iterates all projects and flattens sprint status. This is the foundation for unified sprint aggregation.
- `flattenEntry(entry)` — handles both string and object sprint status entries
- `countStoriesByStatus()` in `packages/web/src/lib/portfolio-aggregation.ts` — counts stories by status. Similar pattern needed but per-project.
- `getWorkflowColumns(project)` and `getColumns(project)` from tracker-bmad — provide column definitions for sprint board display

**Sprint status YAML structure (per project):**
```yaml
development_status:
  epic-53: in-progress
  53-1-unified-sprint-dashboard: backlog
  53-2-sprint-progress-visualization: backlog
```

Each project's sprint-status.yaml contains ALL stories for that project. The unified view needs to aggregate across multiple projects.

### Unified Sprint Entry Shape

Each sprint entry represents one project's current sprint:
```typescript
interface UnifiedSprintEntry {
  projectId: string;           // e.g., "web-platform"
  projectName: string;         // e.g., "Web Platform"
  sprintName: string;          // derived from config or "Sprint N"
  startDate: string | null;    // ISO date, from sprint config if available
  endDate: string | null;      // ISO date, from sprint config if available
  stories: {
    total: number;
    done: number;
    inProgress: number;
    blocked: number;
    backlog: number;
  };
  progressPercent: number;     // done / total * 100
  status: "active" | "completed" | "planning";
  health: "on-track" | "at-risk" | "blocked";
}
```

### Health Computation Logic

`computeSprintHealth(entry)`:
- **"blocked"**: `stories.blocked > 0 && stories.inProgress === 0` (all active work is blocked)
- **"at-risk"**: Either:
  - `progressPercent < 50` AND more than 75% of sprint time has elapsed (if dates available)
  - OR `stories.blocked > stories.inProgress` (more blocked than working)
- **"on-track"**: everything else

### API Route Design

**Endpoint: `GET /api/sprints/unified`**
- No query params (this story — no filtering, that's 53.5)
- Response: `{ sprints: UnifiedSprintEntry[], summary: UnifiedSprintSummary }`
- Returns 200 with empty array if no projects configured
- Skips projects where tracker read fails (logs warning, continues)

### Page Structure

```
/sprints (page.tsx — server component)
  └── UnifiedSprintView.tsx (client component)
        ├── UnifiedSprintSummary.tsx  — summary cards row
        │     ├── Total Sprints: 5
        │     ├── Active: 3
        │     ├── Stories Done: 42
        │     └── Avg Progress: 67%
        └── SprintCard[] grid
              └── SprintCard.tsx — per-project sprint card
                    ├── Project: Web Platform
                    ├── Sprint 12 — Mar 15 to Mar 28
                    ├── Progress bar: 72% (green/yellow/red by health)
                    └── Stories: 18 total, 13 done, 3 active, 2 blocked
```

### Component Design

**UnifiedSprintSummary** — 4 summary metric cards in a grid row:
- Total Sprints (count of all projects with sprint data)
- Active Sprints (status === "active")
- Stories Done (aggregate across all sprints)
- Average Progress (mean of all progressPercent, formatted as %)

**SprintCard** — Individual project sprint card:
- Header: project name, sprint name
- Date range (if available)
- Progress bar: width = progressPercent%, color by health (green=on-track, yellow=at-risk, red=blocked)
- Story breakdown: total, done, in-progress, blocked
- Health indicator badge

**Empty state**: "No sprint data found. Configure projects to see unified sprint view."

### File Structure to Create/Modify

```
packages/web/src/
├── lib/
│   ├── types.ts                                        # MODIFY: Add UnifiedSprintEntry, UnifiedSprintSummary, SprintHealthStatus
│   ├── unified-sprint-aggregation.ts                   # NEW: Sprint aggregation, summary, health computation
│   └── __tests__/
│       └── unified-sprint-aggregation.test.ts          # NEW: Unit tests for aggregation functions
├── app/
│   ├── sprints/
│   │   └── page.tsx                                    # NEW: Server component for unified sprint page
│   └── api/
│       └── sprints/
│           └── unified/
│               ├── route.ts                            # NEW: GET /api/sprints/unified
│               └── route.test.ts                       # NEW: Route tests
├── components/
│   ├── UnifiedSprintView.tsx                           # NEW: Main client component
│   ├── UnifiedSprintSummary.tsx                        # NEW: Summary cards
│   ├── SprintCard.tsx                                  # NEW: Individual sprint card
│   ├── Navigation.tsx                                  # MODIFY: Add /sprints nav link
│   └── __tests__/
│       ├── UnifiedSprintView.test.tsx                  # NEW: View component tests
│       ├── UnifiedSprintSummary.test.tsx               # NEW: Summary component tests
│       └── SprintCard.test.tsx                         # NEW: Card component tests
```

### Testing Strategy

**Core unit tests (unified-sprint-aggregation.test.ts):**
- `computeSprintSummary` returns correct totals for multiple sprints
- `computeSprintSummary` handles empty sprint array
- `computeSprintSummary` calculates average progress correctly
- `computeSprintHealth` returns "on-track" for healthy sprint
- `computeSprintHealth` returns "at-risk" for low progress with high elapsed time
- `computeSprintHealth` returns "blocked" when all active work is blocked
- `computeSprintHealth` returns "at-risk" when more blocked than in-progress
- `flattenEntry` handles string entries (reuse existing pattern)

**API route tests:**
- GET /api/sprints/unified returns sprint data
- GET /api/sprints/unified returns empty array when no projects
- GET /api/sprints/unified handles tracker read errors gracefully

**Component tests:**
- `UnifiedSprintView` renders loading state, then sprint data
- `UnifiedSprintView` renders empty state when no sprints
- `UnifiedSprintView` renders error state on fetch failure
- `UnifiedSprintSummary` renders all 4 metric cards
- `UnifiedSprintSummary` handles zero sprints
- `SprintCard` renders project name and sprint name
- `SprintCard` renders progress bar with correct width
- `SprintCard` renders health indicator
- `SprintCard` shows story breakdown

### NFRs

- **NFR-P1:** Page loads within 2 seconds for up to 50 projects
- **NFR-F5-1:** Unified sprint view loads within 2 seconds
- **NFR-F5-2:** Real-time updates reflect within 3 seconds of state changes (deferred to later story)

### Pre-existing Types (Do NOT modify)

- `SprintSummary` in `packages/core/src/types.ts` — core type for single-project sprint summary. Do NOT extend this; create new dashboard-specific types.
- `SprintDataMap` in `packages/core/src/cross-project-deps.ts` — used for cross-project dependency resolution. Use as-is via `buildSprintDataMap()`.
- `SprintStatusData` in `packages/core/src/assignment-service.ts` — internal sprint status shape. Access through `readSprintStatus()` instead.

### References

- [Source: epics-cycle-10.md#Epic 53 Story 53.1] — Story definition and ACs
- [Source: prd-cycle-10.md#F5] — Unified Sprint View requirements (FR-F5-1 to FR-F5-5)
- [Source: prd-cycle-10.md#NFR-F5-1, NFR-F5-2] — Performance NFRs
- [Source: packages/web/src/lib/portfolio-aggregation.ts] — Existing portfolio aggregation pattern to follow
- [Source: packages/web/src/lib/sprint-data-map.ts] — Existing cross-project sprint data utility
- [Source: packages/web/src/app/portfolio/page.tsx] — Portfolio page pattern (server component + data fetch)
- [Source: packages/web/src/app/api/sprint/[project]/route.ts] — Single-project sprint route pattern
- [Source: packages/web/src/components/PortfolioView.tsx] — Portfolio view component pattern
- [Source: CLAUDE.md] — TypeScript conventions (ESM, .js extensions, node: prefix, strict mode)

### Project Structure Notes

- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/`
- New file `unified-sprint-aggregation.ts` follows same module pattern as `portfolio-aggregation.ts`
- API route follows same pattern as existing `/api/sprint` routes
- New page at `/sprints` follows same pattern as `/portfolio` page
- All existing tests must continue to pass (no regressions)

## Dev Agent Record

### Agent Model Used

Claude claude-sonnet-4-20250514

### Debug Log References

- Types duplicate: types.ts had two sets of the same types (one after PortfolioMetrics, one at end of file). Removed the first set to resolve TypeScript duplicate identifier errors.
- Route test: `request.nextUrl` is undefined on plain `Request` objects — used `new URL(request.url)` instead (pattern from Story 52.5).
- Component tests: `getByText("0")` matched multiple elements when multiple metrics were zero. Fixed by using more specific assertions.

### Completion Notes List

1. Types: Added `SprintHealthStatus`, `UnifiedSprintEntry`, `UnifiedSprintSummary` to `packages/web/src/lib/types.ts` (after PortfolioMetrics, deduplicated)
2. Aggregation: Created `packages/web/src/lib/unified-sprint-aggregation.ts` with 4 exported functions: `computeSprintHealth`, `computeSprintSummary`, `countStories`, `aggregateUnifiedSprints`
3. Aggregation tests: 32 unit tests covering health computation, summary computation, story counting, and async aggregation
4. API route: Created `GET /api/sprints/unified` returning `{ sprints, UnifiedSprintEntry[], summary: UnifiedSprintSummary }` — 5 route tests
5. Dashboard components: `UnifiedSprintView`, `UnifiedSprintSummaryCards`, `SprintCard` — 23 component tests
6. Navigation: Added `/sprints` link between Portfolio and Conflicts
7. Full regression suite: 1,784 web tests + 2,209 core tests — zero failures

### Limitations (Deferred Items)

1. Sprint SSE real-time updates
   - Status: Deferred - Initial implementation uses on-demand fetch (page refresh)
   - Requires: SSE event broadcasting for sprint state changes across projects
   - Current: Manual page refresh to update sprint data
2. Sprint date range filtering
   - Status: Deferred - Part of Story 53.5 (Sprint Filtering and Aggregation)
   - Requires: Date picker components, filter state management
   - Current: All sprints shown without date filtering

### File List

**New Files (lib):**
- `packages/web/src/lib/unified-sprint-aggregation.ts` — Sprint aggregation, summary, health computation
- `packages/web/src/lib/__tests__/unified-sprint-aggregation.test.ts` — 32 unit tests

**New Files (API route):**
- `packages/web/src/app/api/sprints/unified/route.ts` — GET /api/sprints/unified
- `packages/web/src/app/api/sprints/unified/route.test.ts` — 5 route tests

**New Files (page & components):**
- `packages/web/src/app/sprints/page.tsx` — Server component for unified sprint page
- `packages/web/src/components/UnifiedSprintView.tsx` — Main client component
- `packages/web/src/components/UnifiedSprintSummaryCards.tsx` — Summary metric cards
- `packages/web/src/components/SprintCard.tsx` — Individual sprint card with health/progress
- `packages/web/src/components/__tests__/UnifiedSprintView.test.tsx` — 4 tests
- `packages/web/src/components/__tests__/UnifiedSprintSummaryCards.test.tsx` — 7 tests
- `packages/web/src/components/__tests__/SprintCard.test.tsx` — 12 tests

**Modified Files:**
- `packages/web/src/lib/types.ts` — Added Unified Sprint Dashboard types (removed duplicates)
- `packages/web/src/components/Navigation.tsx` — Added /sprints nav link
