# Story 62.34: Sprint Board

Status: done

## Story

As a developer reading the Agent Orchestrator documentation,
I want a comprehensive Sprint Board documentation page that documents the unified sprint grid, sprint cards, summary metrics, filtering, the per-project board with 4 tabs (Board/Analytics/Planning/Team), story columns, drag-drop assignment, WIP limits, sprint metrics, analytics charts, and drill-down navigation,
so that I can understand the sprint board's components, data flow, SSE real-time updates, filtering capabilities, and how each sub-component connects to backend services.

## Acceptance Criteria

1. **Sprint Board page** (`docs/web-dashboard/sprint-board.md`) documents an "Overview" section describing the sprint board as a two-level hierarchy: `/sprints` (unified cross-project sprint grid with summary cards, filtering) and per-project `SprintBoard` with 4 tabs — sourced from `packages/web/src/app/sprints/page.tsx` and `packages/web/src/components/SprintBoard.tsx`
2. **Sprint Board page** documents a "Unified Sprint View" section describing `UnifiedSprintView` with responsive 1/2/3 column grid, `SprintCard` components, empty state message, velocity comparison table — sourced from `packages/web/src/components/UnifiedSprintView.tsx`
3. **Sprint Board page** documents a "Summary Cards" section describing `UnifiedSprintSummaryCards` with 7 metric cards (Total Sprints, Active Sprints, Planning Sprints, Stories Done, Avg Progress, At Risk with warning color, Avg Velocity) — sourced from `packages/web/src/components/UnifiedSprintSummaryCards.tsx`
4. **Sprint Board page** documents a "Sprint Cards" section describing `SprintCard` with health badge (on-track/at-risk/blocked with colors), progress bar (`SprintProgressBar` with health-colored fill), date range display, auto-expand behavior for blocked sprints — sourced from `packages/web/src/components/SprintCard.tsx` and `packages/web/src/components/SprintProgressBar.tsx`
5. **Sprint Board page** documents a "Filtering" section describing `SprintFilterBar` with status dropdown (All/Active/Completed/Planning), health dropdown (All/On Track/At Risk/Blocked), project dropdown (only when multiple projects), date range inputs, count indicator, clear button — sourced from `packages/web/src/components/SprintFilterBar.tsx` and `packages/web/src/lib/sprint-filter.ts`
6. **Sprint Board page** documents a "Per-Project Sprint Board" section describing `SprintBoard` with 4 tabs (Board, Analytics, Planning, Team) and their sub-components — sourced from `packages/web/src/components/SprintBoard.tsx`
7. **Sprint Board page** documents a "Board Tab" section describing story columns (Backlog, Ready, In Progress, Review, Done with colored borders), drag-drop using native HTML5 API, WIP limit enforcement with confirmation dialog, sprint end date countdown — sourced from `packages/web/src/components/SprintBoard.tsx`
8. **Sprint Board page** documents an "Analytics Tab" section describing charts: BurndownChart, CycleTimeChart, VelocityChart, ThroughputChart, CfdChart, SprintComparisonTable, ReworkChart, MonteCarloChart with SimulationConfigPanel, ForecastAccuracyChart, HistorySearchView — sourced from `packages/web/src/components/SprintBoard.tsx`
9. **Sprint Board page** documents a "Planning Tab" section describing PlanningView, CreateStoryForm, EpicManager, DependencyGraphView — sourced from `packages/web/src/components/SprintBoard.tsx` and `packages/web/src/components/CreateStoryForm.tsx`
10. **Sprint Board page** documents a "Team Tab" section describing TeamWorkloadView and AgingHeatmap — sourced from `packages/web/src/components/SprintBoard.tsx`
11. **Sprint Board page** documents a "Story Detail" section describing `StoryDetailModal` with transitions, cycle time, column dwells, and `StoryTimeline` with status-colored timeline entries — sourced from `packages/web/src/components/StoryDetailModal.tsx` and `packages/web/src/components/StoryTimeline.tsx`
12. **Sprint Board page** documents a "Real-Time Updates (SSE)" section describing `useSSEConnection` hook with 5 event types (story.started, story.completed, story.blocked, agent.status_changed, cascade.triggered), plus SprintBoard's polling intervals — sourced from `packages/web/src/hooks/useSSEConnection.ts`
13. **Sprint Board page** documents a "Data Flow" section describing server-side aggregation via `aggregateUnifiedSprints()`, health computation via `computeSprintHealth()`, client-side summary via `computeSprintSummary()`, filtering via `filterSprints()` — sourced from `packages/web/src/lib/unified-sprint-aggregation.ts`, `packages/web/src/lib/unified-sprint-summary.ts`, `packages/web/src/lib/sprint-filter.ts`
14. **Sprint Board page** documents an "API Routes" section listing the key endpoints used by sprint pages with method, purpose, and response shape — sourced from `packages/web/src/app/api/sprint/` route files
15. **Sprint Board page** documents a "Key Types" section listing: `UnifiedSprintEntry` (14 fields), `UnifiedSprintSummary` (10 fields), `SprintFilterState` (4 fields), `SprintHealthStatus` — sourced from `packages/web/src/lib/types.ts`
16. **Page uses correct Just the Docs front matter**: `title: Sprint Board`, `nav_order: 2`, `parent: Web Dashboard`, `description` field
17. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
18. **Cross-links** verified: parent link to Web Dashboard index, sibling links to 6 other Web Dashboard child pages, Getting Started, Configuration

## Tasks / Subtasks

- [x] Task 1: Write Sprint Board page (AC: #1-18)
  - [x] Replace stub content in docs/web-dashboard/sprint-board.md
  - [x] Write front matter (title, nav_order: 2, parent: Web Dashboard, description)
  - [x] Write "Overview" section — two-level hierarchy, server components, force-dynamic (AC #1)
  - [x] Write "Unified Sprint View" section — responsive grid, velocity comparison, empty state (AC #2)
  - [x] Write "Summary Cards" section — 7 metric cards with labels, values, tooltips (AC #3)
  - [x] Write "Sprint Cards" section — health badge, progress bar, dates, auto-expand (AC #4)
  - [x] Write "Filtering" section — status/health/project/date filters, AND logic, count (AC #5)
  - [x] Write "Per-Project Sprint Board" section — 4 tabs overview, common components (AC #6)
  - [x] Write "Board Tab" section — columns, drag-drop, WIP limits, countdown (AC #7)
  - [x] Write "Analytics Tab" section — 10 chart/analytics components (AC #8)
  - [x] Write "Planning Tab" section — story creation, epics, dependency graph (AC #9)
  - [x] Write "Team Tab" section — workload view, aging heatmap (AC #10)
  - [x] Write "Story Detail" section — modal, timeline, status colors (AC #11)
  - [x] Write "Real-Time Updates (SSE)" section — useSSEConnection hook, polling (AC #12)
  - [x] Write "Data Flow" section — aggregation, health, summary, filtering pipeline (AC #13)
  - [x] Write "API Routes" section — key endpoints with method/purpose/response (AC #14)
  - [x] Write "Key Types" section — UnifiedSprintEntry, UnifiedSprintSummary, SprintFilterState (AC #15)
  - [x] Write "Next Steps" cross-links section (AC #18)
  - [x] Verify all cross-links exist
  - [x] Verify no hero font classes

## Task Completion Validation

**Task Completion Criteria:**
- All acceptance criteria met
- All component names verified against actual source code
- All SSE event types verified against useSSEConnection source
- All API endpoint paths verified against route files
- No hero font classes
- Cross-links verified
- All code blocks use correct syntax highlighting
- `{: .highlight }` callout for important notes

## Dev Notes

### Design Decisions

- **This story covers the Sprint Board CHILD page** — the index page (62-32) is done. This is the second of 7 child pages (62-33 through 62-39)
- **The stub file** at `docs/web-dashboard/sprint-board.md` has front matter with `title: Sprint Board`, `nav_order: 2`, `parent: Web Dashboard` — needs `description` added and "Content coming soon — Story 62.18." replaced
- **Sprint Board has TWO levels**: `/sprints` (unified cross-project view using `UnifiedSprintView`) and per-project drill-down within `SprintBoard` (4 tabs: Board, Analytics, Planning, Team)
- **The unified view and per-project board are different components** — `UnifiedSprintView` renders the cross-project grid at `/sprints`, while `SprintBoard` is a per-project component with its own API polling and state
- **SprintBoard uses useSSEConnection hook** — unlike PortfolioView which has inline SSE, SprintBoard uses the shared `useSSEConnection` hook from `packages/web/src/hooks/useSSEConnection.ts`
- **SprintBoard has 14 state variables** — including drag state, WIP confirmation, analytics data, and planning data
- **SprintBoard polls every 30 seconds** for board data via `GET /api/sprint/{projectId}`

### Previous Story Learnings (62-33)

- Source strings must be quoted EXACTLY from source — no paraphrasing
- Front matter needs `description` field for searchability
- Cross-link file existence must be verified
- No hero font classes (`.fs-5`, `.fw-300`)
- `{: .highlight }` callout for important notes
- Syntax highlighting: `bash` for CLI examples, `text` for output examples, `typescript` for code
- Epic definitions may not match actual implementation — always verify against source code
- Default port is 5000 (not 3000) — configurable via `PORT` env var
- `pnpm dev` (next dev) does NOT require prior `pnpm build`
- Capacity badge: describe visible text and aria-label separately, use conditional plural descriptions (no `(s)` notation)

### Source Files

- **packages/web/src/app/sprints/page.tsx** — Sprints page (server component, force-dynamic, metadata "ao | Sprints")
- **packages/web/src/components/UnifiedSprintView.tsx** — Unified cross-project sprint view client component
- **packages/web/src/components/UnifiedSprintSummaryCards.tsx** — 7 metric summary cards with MetricCard helper
- **packages/web/src/components/SprintCard.tsx** — Sprint card with health badge, progress, auto-expand
- **packages/web/src/components/SprintProgressBar.tsx** — Health-colored progress bar with ARIA
- **packages/web/src/components/SprintFilterBar.tsx** — Status/health/project/date filter controls
- **packages/web/src/components/SprintBoard.tsx** — Per-project board with 4 tabs (Board/Analytics/Planning/Team)
- **packages/web/src/components/SprintSummaryCard.tsx** — Per-project summary card (5-column stats)
- **packages/web/src/components/SprintGoalsCard.tsx** — Sprint goals with status colors and confidence
- **packages/web/src/components/SprintCostPanel.tsx** — Cost tracking with sprint clock
- **packages/web/src/components/SprintComparisonTable.tsx** — Weekly period comparison with trends
- **packages/web/src/components/StoryDetailModal.tsx** — Story detail popup with transitions
- **packages/web/src/components/CreateStoryForm.tsx** — Story creation form
- **packages/web/src/components/StoryTimeline.tsx** — Story transition timeline with status colors
- **packages/web/src/lib/unified-sprint-aggregation.ts** — aggregateUnifiedSprints(), computeSprintHealth(), computeVelocity()
- **packages/web/src/lib/unified-sprint-summary.ts** — computeSprintSummary() pure sync function
- **packages/web/src/lib/sprint-filter.ts** — filterSprints(), extractAvailableProjects(), EMPTY_SPRINT_FILTERS
- **packages/web/src/lib/sprint-data-map.ts** — buildSprintDataMap(), flattenEntry()
- **packages/web/src/lib/types.ts** — UnifiedSprintEntry, UnifiedSprintSummary, SprintFilterState, SprintHealthStatus
- **packages/web/src/hooks/useSSEConnection.ts** — Shared SSE hook with 5 event types
- **packages/web/src/hooks/useSprintCost.ts** — Sprint cost polling hook (30s interval)
- **packages/web/src/lib/status-colors.ts** — STATUS_FILL color map
- **docs/web-dashboard/sprint-board.md** — Replace stub with full documentation

### Key Sprint Board Facts (verified against source)

**Page routes:** 1 route + per-project drill-down

| Route | Component | Rendering | Description |
|-------|-----------|-----------|-------------|
| `/sprints` | `UnifiedSprintView` | Server (`force-dynamic`) | Cross-project sprint grid with summary cards, filtering |
| (per-project) | `SprintBoard` | Client | 4-tab board loaded within unified view or navigated to |

**UnifiedSprintView grid:**

| Feature | Detail |
|---------|--------|
| Grid layout | `grid-cols-1` / `md:grid-cols-2` / `lg:grid-cols-3` with `gap-4` |
| Key format | `` `${sprint.projectId}-${sprint.sprintName}` `` |
| Empty state | `"No sprint data found. Configure projects to see unified sprint view."` |
| Heading | `"Unified Sprints"` |
| Velocity table | Rendered when `filteredSprints.length >= 2` |

**Summary cards (7 metrics):**

| Metric | Value | Tooltip | Special |
|--------|-------|---------|---------|
| Total Sprints | `summary.totalSprints` | `"Number of projects with sprint data"` | — |
| Active Sprints | `summary.activeSprints` | `"Projects with status 'active'"` | — |
| Planning Sprints | `summary.planningSprints` | `"Projects with status 'planning' (not yet started)"` | — |
| Stories Done | `` `${done}/${total}` `` | `` `"Total stories: ${total}, Done: ${done}"` `` | — |
| Avg Progress | `` `${pct}%` `` | `"Average completion percentage across all sprints"` | — |
| At Risk | `summary.atRiskSprints` | `"Sprints flagged as at-risk or blocked"` | `text-[var(--color-warning)]` when > 0 |
| Avg Velocity | `` `${avg.toFixed(2)}/day` `` or `"--"` | `` `"Average stories completed per day across active sprints (max: ${max.toFixed(2)})"` `` | — |

**SprintCard health badges:**

| Health | Label | Badge Color | Detail Border |
|--------|-------|-------------|---------------|
| `on-track` | `"On Track"` | `bg-[var(--color-success)]/10 text-[var(--color-success)]` | `border-[var(--color-border)]` |
| `at-risk` | `"At Risk"` | `bg-[var(--color-warning)]/10 text-[var(--color-warning)]` | `border-[var(--color-warning)]` |
| `blocked` | `"Blocked"` | `bg-[var(--color-error)]/10 text-[var(--color-error)]` | `border-[var(--color-error)]` |

**SprintProgressBar health colors:**

| Health | Bar Color |
|--------|-----------|
| `on-track` | `bg-[var(--color-success)]` |
| `at-risk` | `bg-[var(--color-warning)]` |
| `blocked` | `bg-[var(--color-error)]` |

**SprintFilterBar controls:**

| Control | Options | Condition |
|---------|---------|-----------|
| Status | All, Active, Completed, Planning | Always shown |
| Health | All, On Track, At Risk, Blocked | Always shown |
| Project | All Projects + list | Only when `availableProjects.length > 1` |
| From/To | Date inputs | Always shown |
| Count | `"Showing {filtered} of {total} sprints"` or `"{total} sprints"` | With `aria-live="polite"` |
| Clear | `"Clear filters"` | Always shown |

**SprintBoard tabs and sub-components:**

| Tab | Label | Components |
|-----|-------|------------|
| Board | `"Board"` | Column grid, draggable story cards, SprintSummaryCard, NotificationPanel, HealthIndicators, WipStatusWidget, SprintGoalsCard, progress bar, EpicProgress |
| Analytics | `"Analytics"` | BurndownChart, CycleTimeChart, VelocityChart, ThroughputChart, CfdChart, SprintComparisonTable, ReworkChart, SimulationConfigPanel + MonteCarloChart, ForecastAccuracyChart, HistorySearchView |
| Planning | `"Planning"` | PlanningView, CreateStoryForm, EpicManager, DependencyGraphView |
| Team | `"Team"` | TeamWorkloadView, AgingHeatmap |

**Story columns (DEFAULT_COLUMN_LABELS and DEFAULT_COLUMN_COLORS):**

| Column | Label | Border Color |
|--------|-------|-------------|
| `backlog` | `"Backlog"` | `border-zinc-700` |
| `ready-for-dev` | `"Ready"` | `border-yellow-700` |
| `in-progress` | `"In Progress"` | `border-blue-700` |
| `review` | `"Review"` | `border-purple-700` |
| `done` | `"Done"` | `border-green-700` |

**Drag-drop implementation:**
- Native HTML5 drag/drop (NOT a library)
- Data transfer: `JSON.stringify({ storyId, fromCol })`
- Move API: `PATCH /api/sprint/{projectId}/story/{storyId}` with `{ status: targetColumn }`
- WIP limit enforcement: HTTP 409 response triggers confirmation dialog with `"Force Move"` and `"Cancel"` buttons
- Optimistic update with rollback on failure
- Error format: `"Failed to move {storyId}: {error message}"`

**Sprint end date countdown:**
- Shows `"X days left"`, `"(today)"`, or `"Xd overdue"` (red)

**useSSEConnection hook event types:**

| Event Type | Callback | Data Shape |
|------------|----------|------------|
| `story.started` | `onStoryStarted` | `{ storyId: string; agentId: string }` |
| `story.completed` | `onStoryCompleted` | `{ storyId: string }` |
| `story.blocked` | `onStoryBlocked` | `{ storyId: string; reason: string }` |
| `agent.status_changed` | `onAgentStatusChanged` | `{ agentId: string; status: string }` |
| `cascade.triggered` | `onCascadeTriggered` | `{ failureCount: number }` |

**Connection behavior:**
- Endpoint: `/api/events`
- Exponential backoff: `Math.min(1000 * Math.pow(2, attempts), 8000)` — caps at 8s
- Returns `{ connected: boolean, reconnecting: boolean }`

**Sprint health computation rules (from unified-sprint-aggregation.ts):**

| Condition | Health Status | Health Reason |
|-----------|---------------|---------------|
| `blocked > 0 AND inProgress === 0` | `"blocked"` | `"All {N} active stories are blocked"` |
| `blocked > inProgress` | `"at-risk"` | `"More blocked stories ({blocked}) than in-progress ({inProgress})"` |
| `progress < 50% AND elapsed > 75%` | `"at-risk"` | `"Only {pct}% complete with {elapsed}% of sprint elapsed"` |
| Default | `"on-track"` | (none) |

**Velocity computation:**
- Formula: `done / max(1, days)` (stories per day)
- Velocity trend rules:
  - `>=70%` progress → `"stable"`
  - `on-track` + `>=50%` progress → `"improving"`
  - `at-risk/blocked` + `<50%` progress → `"declining"`

**Story status sets (from unified-sprint-aggregation.ts):**

| Category | Statuses |
|----------|----------|
| `DONE_STATUSES` | `done` |
| `IN_PROGRESS_STATUSES` | `in-progress`, `review` |
| `BLOCKED_STATUSES` | `blocked` |
| `BACKLOG_STATUSES` | `backlog`, `ready-for-dev` |

**Data flow:**
1. Server: `aggregateUnifiedSprints(config)` → reads sprint status for all projects → `UnifiedSprintEntry[]`
2. Server: `computeSprintSummary(sprints)` → aggregates totals → `UnifiedSprintSummary`
3. Client: `UnifiedSprintView` receives `initialSprints` + `initialSummary`
4. Client: `filterSprints(sprints, filters)` → AND logic on status/health/project/date → filtered `UnifiedSprintEntry[]`
5. Client SSE: `useSSEConnection` → `/api/events` → story events trigger board refresh
6. Client polling: SprintBoard polls `GET /api/sprint/{projectId}` every 30s

**Key API endpoints used by sprint pages:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sprint/{project}` | GET | Main board data (columns, stories, epics, stats) |
| `/api/sprint/{project}/summary` | GET | Per-project summary (progress, health, velocity, forecast) |
| `/api/sprint/{project}/config` | GET/PATCH | Sprint config (end date, WIP limits) |
| `/api/sprint/{project}/health` | GET | Health indicators |
| `/api/sprint/{project}/goals` | GET | Sprint goals |
| `/api/sprint/{project}/story/{id}` | GET/PATCH | Story detail and move |
| `/api/sprint/{project}/story/create` | POST | Create new story |
| `/api/sprint/{project}/comparison` | GET | Weekly period comparison |
| `/api/sprint/{project}/dependencies` | GET | Dependency graph |
| `/api/sprint/{project}/dependency-cycles` | GET | Cycle detection |
| `/api/sprint/{project}/wip` | GET | WIP status dashboard |
| `/api/sprint/{project}/epics` | GET/POST/PATCH/DELETE | Epic CRUD |
| `/api/sprint/{project}/monte-carlo` | GET | Monte Carlo simulation |
| `/api/sprint/{project}/workload` | GET | Team workload |
| `/api/sprint/{project}/aging` | GET | Story aging heatmap |
| `/api/sprint/{project}/metrics` | GET | Cycle time metrics |
| `/api/sprint/{project}/velocity` | GET | Velocity comparison data |
| `/api/sprint/{project}/forecast` | GET | Sprint forecast |
| `/api/sprint/{project}/cfd` | GET | Cumulative Flow Diagram |
| `/api/sprint/{project}/throughput` | GET | Throughput analytics |
| `/api/sprint/{project}/rework` | GET | Rework detection |
| `/api/sprint/{project}/history` | GET | History search |
| `/api/sprint/{project}/retro` | GET | Retrospective |
| `/api/sprint/{project}/standup` | GET | Daily standup |
| `/api/sprint/{project}/utilization` | GET | Project utilization |
| `/api/sprint/{project}/assignable-agents` | GET | Assignable agents with capacity |
| `/api/sprint/{project}/ceremony/start` | POST | Start sprint ceremony |
| `/api/sprint/{project}/ceremony/end` | POST | End sprint ceremony |
| `/api/events` | SSE | Real-time story events |

**Key types (from types.ts):**

- `SprintHealthStatus` — `"on-track" | "at-risk" | "blocked"`
- `UnifiedSprintEntry` — 14 fields: projectId, projectName, sprintName, startDate, endDate, stories ({ total, done, inProgress, blocked, backlog }), progressPercent, status ("active"|"completed"|"planning"), health (SprintHealthStatus), healthReasons (string[]), velocity (number), velocityTrend ("improving"|"declining"|"stable"|"unknown")
- `UnifiedSprintSummary` — 10 fields: totalSprints, activeSprints, completedSprints, planningSprints, totalStories, storiesDone, avgProgress, atRiskSprints, avgVelocity, maxVelocity
- `SprintFilterState` — 4 fields: status (UnifiedSprintEntry["status"]|null), health (SprintHealthStatus|null), projectId (string|null), dateRange ({ start: string; end: string }|null)

**Sprint name derivation:**
- `completed` → `"Completed Sprint"`
- `planning` → `"Planning Sprint"`
- `active` → `"Active Sprint"`

### Just the Docs Features Used

- `parent: Web Dashboard` on child page
- Markdown tables for routes, metrics, columns, API endpoints
- `text` syntax highlighting for layout examples
- `typescript` syntax highlighting for type definitions
- `{: .highlight }` callout for important notes

### References

- [Source: packages/web/src/app/sprints/page.tsx — Sprints page server component]
- [Source: packages/web/src/components/UnifiedSprintView.tsx — Unified cross-project view]
- [Source: packages/web/src/components/UnifiedSprintSummaryCards.tsx — 7 metric cards]
- [Source: packages/web/src/components/SprintCard.tsx — Sprint card with health badge]
- [Source: packages/web/src/components/SprintProgressBar.tsx — Health-colored progress bar]
- [Source: packages/web/src/components/SprintFilterBar.tsx — Filter controls]
- [Source: packages/web/src/components/SprintBoard.tsx — Per-project 4-tab board]
- [Source: packages/web/src/components/SprintSummaryCard.tsx — Per-project summary]
- [Source: packages/web/src/components/SprintGoalsCard.tsx — Sprint goals]
- [Source: packages/web/src/components/SprintCostPanel.tsx — Cost tracking]
- [Source: packages/web/src/components/SprintComparisonTable.tsx — Weekly comparison]
- [Source: packages/web/src/components/StoryDetailModal.tsx — Story detail popup]
- [Source: packages/web/src/components/CreateStoryForm.tsx — Story creation]
- [Source: packages/web/src/components/StoryTimeline.tsx — Story transition timeline]
- [Source: packages/web/src/lib/unified-sprint-aggregation.ts — aggregateUnifiedSprints()]
- [Source: packages/web/src/lib/unified-sprint-summary.ts — computeSprintSummary()]
- [Source: packages/web/src/lib/sprint-filter.ts — filterSprints(), extractAvailableProjects()]
- [Source: packages/web/src/lib/sprint-data-map.ts — buildSprintDataMap()]
- [Source: packages/web/src/lib/types.ts — UnifiedSprintEntry, UnifiedSprintSummary, SprintFilterState]
- [Source: packages/web/src/hooks/useSSEConnection.ts — Shared SSE hook]
- [Source: packages/web/src/hooks/useSprintCost.ts — Cost polling hook]
- [Source: docs/web-dashboard/sprint-board.md — Stub to replace]
- [Source: Story 62-33 — Previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- 1 documentation file written replacing stub (docs/web-dashboard/sprint-board.md)
- Source accuracy verification: all component names, CSS classes, constants, and function signatures verified against source via parallel subagent analysis
- All 18 ACs satisfied
- 13 sections documented: Overview, Unified Sprint View, Summary Cards, Sprint Cards, Filtering, Per-Project Sprint Board, Board Tab, Analytics Tab, Planning Tab, Team Tab, Story Detail, Real-Time Updates (SSE), Data Flow, API Routes, Key Types, Next Steps
- All SSE event types verified against useSSEConnection source (story.started, story.completed, story.blocked, agent.status_changed, cascade.triggered)
- All 28 API endpoint paths verified against route files
- Health computation rules quoted from source: blocked > 0 AND inProgress === 0; blocked > inProgress; progress < 50% AND elapsed > 75%
- DEFAULT_COLUMN_LABELS and DEFAULT_COLUMN_COLORS verified against SprintBoard.tsx
- Drag-drop format verified: `"text/plain"` MIME with JSON `{ storyId, fromCol }`
- WIP confirmation text verified: `"WIP limit exceeded for "${column}" (${current}/${limit}). Move anyway?"`
- Sprint countdown format verified: `"(X d left)"`, `"(today)"`, `"(X d overdue)"`
- STORY_KEY_PATTERN verified: `/^\d+[a-z]*-\d+-/`
- Status set constants verified: DONE_STATUSES, IN_PROGRESS_STATUSES, BLOCKED_STATUSES, BACKLOG_STATUSES
- UnifiedSprintEntry type: 14 fields verified against types.ts
- UnifiedSprintSummary type: 10 fields verified against types.ts
- SprintFilterState type: 4 fields verified against types.ts
- No hero font classes on page
- All 9 cross-links verified (6 sibling pages + Web Dashboard index + Getting Started + Configuration)
- Front matter correct: title, nav_order: 2, parent: Web Dashboard, description present
- 3 `{: .highlight }` callouts used for important notes
- All code blocks use correct syntax highlighting (text, typescript)
- Data flow diagram included with ASCII text layout

### File List

- `docs/web-dashboard/sprint-board.md` — replace stub with Sprint Board documentation

### Change Log

- **2026-04-24:** Story created — Sprint Board documentation page (1 file to replace)
- **2026-04-24:** Task 1 completed — Sprint Board page written with 13+ sections, all ACs met, all sources verified
- **2026-04-24:** Code review — 4 findings (2 MEDIUM, 2 LOW), all fixed:
  - [M1] Added missing fields (projectId, projectName, hasPoints) to /api/sprint/{project} response shape
  - [M2] Fixed formatDate() null fallback from `"--"` to em-dash `"—"` and date display separator
  - [L1] Added `{: .highlight }` callout for completedSprints field not displayed as a card
  - [L2] Replaced 15 vague API response shapes with specific field names from source code

### Senior Developer Review (AI)

**Review Date:** 2026-04-24
**Review Outcome:** Changes Requested (4 findings, all fixed)
**Reviewer Model:** Claude Opus 4.6

**Action Items:**
- [x] **[MEDIUM]** Add missing fields (projectId, projectName, hasPoints) to /api/sprint/{project} response shape in API Routes table
- [x] **[MEDIUM]** Fix formatDate() null fallback from `"--"` to em-dash `"—"` to match source code
- [x] **[LOW]** Add `{: .highlight }` callout clarifying completedSprints exists in type but isn't displayed
- [x] **[LOW]** Replace all vague API response shape descriptions (15 endpoints) with specific field names verified against route source files
