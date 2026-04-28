# Story 62.33: Portfolio View

Status: done

## Story

As a developer reading the Agent Orchestrator documentation,
I want a comprehensive Portfolio View documentation page that documents the portfolio grid, project cards, filtering, aggregated metrics, cross-project dependency graph, and project drill-down,
so that I can understand the portfolio dashboard's components, data flow, SSE real-time updates, filtering capabilities, and how each sub-component connects to backend services.

## Acceptance Criteria

1. **Portfolio View page** (`docs/web-dashboard/portfolio-view.md`) documents an "Overview" section describing the portfolio as a two-page hierarchy: `/portfolio` (grid overview with metrics, filtering, cross-project graph) and `/portfolio/[projectId]` (drill-down with filtered sessions) — sourced from `packages/web/src/app/portfolio/page.tsx` and `packages/web/src/app/portfolio/[projectId]/page.tsx`
2. **Portfolio View page** documents a "Portfolio Grid" section describing `PortfolioGrid` (responsive 1/2/3 column grid with `ProjectCard` components, `role="list"`) — sourced from `packages/web/src/components/PortfolioGrid.tsx`
3. **Portfolio View page** documents a "Project Cards" section describing `ProjectCard` with: status indicator (active/idle/error with colored dots), agent count with utilization/capacity badges, story count badges (In Progress/Backlog/Done/Blocked), pool agent availability, last activity with relative time, highlight animation on SSE update — sourced from `packages/web/src/components/ProjectCard.tsx`
4. **Portfolio View page** documents a "Metrics Widget" section describing `PortfolioMetricsWidget` with 4 metric cards (Total Agents, Stories done/total, Sprint Health with color thresholds 80/60, Utilization percentage) — sourced from `packages/web/src/components/PortfolioMetricsWidget.tsx` and `packages/web/src/lib/portfolio-metrics.ts`
5. **Portfolio View page** documents a "Filtering" section describing `PortfolioFilterBar` with status dropdown (All/Active/Idle/Error), tag toggle buttons, metadata dropdowns, project count display (`X of Y projects`), clear button — sourced from `packages/web/src/components/PortfolioFilterBar.tsx` and `packages/web/src/lib/portfolio-filter.ts`
6. **Portfolio View page** documents a "Cross-Project Dependency Graph" section describing `CrossProjectGraphView` SVG rendering: project column layout, node colors by status, resolved (green solid) vs unresolved (gray dashed) edges, blocked nodes (red stroke), edge tooltips, refresh button — sourced from `packages/web/src/components/CrossProjectGraphView.tsx`
7. **Portfolio View page** documents a "Project Detail" section describing `/portfolio/[projectId]` with `ProjectBreadcrumb`, `ProjectHeader` (status dot, name, active agents, shared pool info), and `Dashboard` component with enriched sessions — sourced from `packages/web/src/app/portfolio/[projectId]/page.tsx` and `packages/web/src/components/ProjectDetailComponents.tsx`
8. **Portfolio View page** documents a "Real-Time Updates (SSE)" section describing inline SSE in `PortfolioView`: connects to `/api/events`, handles `"snapshot"` events with 500ms batching, `"session.activity"` triggers `router.refresh()`, `"cross-project-dep-changed"` re-fetches graph, exponential backoff reconnection — sourced from `packages/web/src/components/PortfolioView.tsx`
9. **Portfolio View page** documents a "Data Flow" section describing: server-side aggregation via `aggregatePortfolioProjects()` reading sprint-status.yaml + sessionManager, client-side metrics via `calculatePortfolioMetrics()`, filtering via `filterProjects()`, tag/metadata extraction — sourced from `packages/web/src/lib/portfolio-aggregation.ts`, `packages/web/src/lib/portfolio-metrics.ts`, `packages/web/src/lib/portfolio-filter.ts`
10. **Portfolio View page** documents an "API Routes" section listing the endpoints used by portfolio pages: `/api/events`, `/api/dependencies/cross-project/graph`, `/api/dependencies/cross-project`, `/api/dependencies/cross-project/blocking-status`, `/api/dependencies/cross-project/search-stories`, `/api/pool/capacity`, `/api/pool/utilization`, `/api/sprint/[project]`, `/api/sprint/[project]/utilization`, `/api/sprint/[project]/assignable-agents`, `/api/agent/[id]/capacity`, `/api/sprint/digest` — with method, purpose, and response shape
11. **Portfolio View page** documents a "Key Types" section listing: `PortfolioProject` (18 fields including status, stories, sharedPool, poolAgentsAvailable, capacityStatus), `PortfolioMetrics` (7 fields including sprintHealthScore, utilizationPercent, poolUtilization), `FilterState` (status/tags/metadata), `CrossProjectGraph` — sourced from `packages/web/src/lib/types.ts`
12. **Page uses correct Just the Docs front matter**: `title: Portfolio View`, `nav_order: 1`, `parent: Web Dashboard`, `description` field
13. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
14. **Cross-links** verified: parent link to Web Dashboard index, sibling links to 6 other Web Dashboard child pages, Getting Started, Configuration

## Tasks / Subtasks

- [x] Task 1: Write Portfolio View page (AC: #1-14)
  - [x] Replace stub content in docs/web-dashboard/portfolio-view.md
  - [x] Write front matter (title, nav_order: 1, parent: Web Dashboard, description)
  - [x] Write "Overview" section — two-page hierarchy, server components, force-dynamic (AC #1)
  - [x] Write "Portfolio Grid" section — responsive grid, role="list", card layout (AC #2)
  - [x] Write "Project Cards" section — status, agents, stories, pool, activity, highlight (AC #3)
  - [x] Write "Metrics Widget" section — 4 metric cards, health color thresholds, tooltips (AC #4)
  - [x] Write "Filtering" section — status/tags/metadata filters, project count, clear (AC #5)
  - [x] Write "Cross-Project Dependency Graph" section — SVG rendering, colors, tooltips (AC #6)
  - [x] Write "Project Detail" section — breadcrumb, header, dashboard with sessions (AC #7)
  - [x] Write "Real-Time Updates (SSE)" section — inline SSE, batching, reconnection (AC #8)
  - [x] Write "Data Flow" section — aggregation pipeline, metrics calculation, filtering (AC #9)
  - [x] Write "API Routes" section — 12 endpoints with method/purpose/response (AC #10)
  - [x] Write "Key Types" section — PortfolioProject, PortfolioMetrics, FilterState (AC #11)
  - [x] Write "Next Steps" cross-links section (AC #14)
  - [x] Verify all cross-links exist
  - [x] Verify no hero font classes

## Task Completion Validation

**Task Completion Criteria:**
- All acceptance criteria met
- All component names verified against actual source code
- All SSE event types verified against PortfolioView source
- All API endpoint paths verified against route files
- No hero font classes
- Cross-links verified
- All code blocks use correct syntax highlighting
- `{: .highlight }` callout for important notes

## Dev Notes

### Design Decisions

- **This story covers the Portfolio View CHILD page** — the index page (62-32) is done. This is the first of 7 child pages (62-33 through 62-39)
- **The stub file** at `docs/web-dashboard/portfolio-view.md` has front matter with `title: Portfolio View`, `nav_order: 1`, `parent: Web Dashboard` — needs `description` added and "Content coming soon -- Story 62.18." replaced
- **Portfolio has TWO page routes**: `/portfolio` (grid overview) and `/portfolio/[projectId]` (project detail) — both are server components with `force-dynamic`
- **PortfolioView implements its OWN SSE** — it does NOT use the `useSSEConnection` hook. It creates an `EventSource` inline with custom batching (500ms), reconnection (exponential backoff 1s→8s), and three event type handlers
- **CrossProjectGraphView renders SVG** — not a canvas or library-based graph. Uses absolute positioning with layout constants (NODE_W=140, NODE_H=36, COL_GAP=200, NODE_GAP=52)

### Previous Story Learnings (62-32)

- Source strings must be quoted EXACTLY from source — no paraphrasing
- Front matter needs `description` field for searchability
- Cross-link file existence must be verified
- No hero font classes (`.fs-5`, `.fw-300`)
- `{: .highlight }` callout for important notes
- Syntax highlighting: `bash` for CLI examples, `text` for output examples, `typescript` for code
- Epic definitions may not match actual implementation — always verify against source code
- Default port is 5000 (not 3000) — configurable via `PORT` env var
- `pnpm dev` (next dev) does NOT require prior `pnpm build`

### Source Files

- **packages/web/src/app/portfolio/page.tsx** — Portfolio page (server component, force-dynamic, aggregates projects)
- **packages/web/src/app/portfolio/[projectId]/page.tsx** — Project detail page (server component, force-dynamic, enriches sessions)
- **packages/web/src/components/PortfolioView.tsx** — Main client component (SSE, batching, filters, navigation)
- **packages/web/src/components/PortfolioGrid.tsx** — Responsive grid (1/2/3 columns, ProjectCard)
- **packages/web/src/components/PortfolioMetricsWidget.tsx** — 4 metric cards (agents, stories, health, utilization)
- **packages/web/src/components/PortfolioFilterBar.tsx** — Filter bar (status, tags, metadata, project count)
- **packages/web/src/components/ProjectCard.tsx** — Project card (status dot, agents, stories, pool, badges, highlight)
- **packages/web/src/components/ProjectDetailComponents.tsx** — ProjectNotFound, ProjectBreadcrumb, ProjectHeader
- **packages/web/src/components/CrossProjectGraphView.tsx** — SVG dependency graph (nodes, edges, tooltips)
- **packages/web/src/lib/portfolio-aggregation.ts** — aggregatePortfolioProjects() server function
- **packages/web/src/lib/portfolio-filter.ts** — filterProjects(), extractAvailableTags/Metadata, EMPTY_FILTERS
- **packages/web/src/lib/portfolio-metrics.ts** — calculatePortfolioMetrics(), getHealthScoreColor/Label
- **packages/web/src/lib/types.ts** — PortfolioProject, PortfolioMetrics, FilterState types
- **packages/web/src/lib/enrich-project-sessions.ts** — enrichProjectSessions() for project detail
- **packages/web/src/lib/status-colors.ts** — STATUS_FILL color map for graph nodes
- **docs/web-dashboard/portfolio-view.md** — Replace stub with full documentation

### Key Portfolio Facts (verified against source)

**Page routes:** 2 routes

| Route | Component | Rendering | Description |
|-------|-----------|-----------|-------------|
| `/portfolio` | `PortfolioView` | Server (force-dynamic) | Grid overview with metrics, filtering, dependency graph |
| `/portfolio/[projectId]` | `Dashboard` + `ProjectHeader` | Server (force-dynamic) | Single project drill-down with enriched sessions |

**PortfolioView SSE events:** 3 event types handled inline (NOT via useSSEConnection)

| Event Type | Handler | Behavior |
|------------|---------|----------|
| `snapshot` | `processSnapshot()` | Groups sessions by projectId, queues updates, 500ms batch flush |
| `session.activity` | `router.refresh()` | Full page refresh fallback |
| `cross-project-dep-changed` | `fetchCpGraph()` | Re-fetches `/api/dependencies/cross-project/graph` |

**MetricsWidget cards:** 4 cards

| Metric | Value Format | Color Logic |
|--------|-------------|-------------|
| Total Agents | `metrics.totalAgents` | Default (text-primary) |
| Stories | `"${done}/${total}"` | Default; tooltip shows backlog/in-progress/done/blocked breakdown |
| Sprint Health | `"${score}%"` | Green >=80, Yellow >=60, Red <60 |
| Utilization | `"${percent}%"` | Default |

**ProjectCard badges:** 4 story types + 3 special badges

| Badge | Color | Condition |
|-------|-------|-----------|
| In Progress | Blue bg + accent text | count > 0 |
| Backlog | Subtle bg + secondary text | count > 0 |
| Done | Green bg + ready text | count > 0 |
| Blocked | Red bg + error text | count > 0 |
| UtilizationBadge | Green >=80%, Blue >=50%, Gray <50% | totalAgents > 0 |
| CapacityBadge | Red (full), Yellow (near), Green (slots) | capacityStatus defined |
| Pool Available | Info text | poolAgentsAvailable.length > 0 |

**CrossProjectGraphView node colors (STATUS_FILL):**

| Status | Color |
|--------|-------|
| backlog | `#3f3f46` |
| ready-for-dev | `#a16207` |
| in-progress | `#1d4ed8` |
| review | `#7e22ce` |
| done | `#15803d` |
| blocked | `#dc2626` |
| unknown | `#52525b` |

**API endpoints used by portfolio pages:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/events` | SSE | Real-time snapshot, activity, dependency updates |
| `/api/dependencies/cross-project/graph` | GET | Cross-project dependency graph |
| `/api/dependencies/cross-project` | GET/POST/DELETE | CRUD cross-project dependencies |
| `/api/dependencies/cross-project/blocking-status` | GET | Blocking alerts |
| `/api/dependencies/cross-project/search-stories` | GET | Search stories across projects |
| `/api/pool/capacity` | GET | Agent capacity status |
| `/api/pool/utilization` | GET | Pool utilization overview |
| `/api/sprint/[project]` | GET | Project sprint data (columns, epics, stats) |
| `/api/sprint/[project]/utilization` | GET | Project utilization metrics |
| `/api/sprint/[project]/assignable-agents` | GET | Agents available for assignment |
| `/api/agent/[id]/capacity` | GET | Per-agent capacity check |
| `/api/sprint/digest` | GET | Portfolio-wide sprint digest |

**Key types (from types.ts):**

- `PortfolioProject` — 18 fields: id, name, status ("active"|"idle"|"error"), activeAgents, totalAgents, stories ({backlog,inProgress,done,blocked}), lastActivity, lastUpdated, tags, metadata, sharedPool ({enabled,eligibleProjects,maxConcurrent,reservedAgents}), poolAgentsAvailable ({agentId,sourceProjectId,sourceProjectName}[]), capacityStatus ({maxCapacity,availableSlots,isAtCapacity,isNearCapacity,utilizationPercent})
- `PortfolioMetrics` — 7 fields: totalAgents, totalConfiguredAgents, stories ({backlog,inProgress,done,blocked,total}), sprintHealthScore (0-100), utilizationPercent, poolUtilization ({totalPoolAgents,activePoolAgents,totalReservedAgents,poolProjectCount})
- `FilterState` — 3 fields: status (PortfolioProject["status"]|null), tags (string[]), metadata (Record<string,string>)

**Sprint health formula:** `Math.round((doneStories / totalStories) * 100 - blockedStories * 5)` clamped to [0, 100]

**Data flow:**
1. Server: `aggregatePortfolioProjects(config, sessionManager, sprintStatusPath)` → reads sprint-status.yaml, counts stories, filters sessions → `PortfolioProject[]`
2. Client: `calculatePortfolioMetrics(projects)` → aggregates totals, computes health/utilization → `PortfolioMetrics`
3. Client: `filterProjects(projects, filters)` → AND logic on status/tags/metadata → filtered `PortfolioProject[]`
4. Client SSE: `snapshot` → `processSnapshot()` → `queueProjectUpdate()` → 500ms batch → `setProjects()` with `lastUpdated: Date.now()`

### Just the Docs Features Used

- `parent: Web Dashboard` on child page
- Markdown tables for routes, metrics, badges, API endpoints
- `text` syntax highlighting for layout examples
- `typescript` syntax highlighting for type definitions
- `{: .highlight }` callout for important notes

### References

- [Source: packages/web/src/app/portfolio/page.tsx — Portfolio page server component]
- [Source: packages/web/src/app/portfolio/[projectId]/page.tsx — Project detail page]
- [Source: packages/web/src/components/PortfolioView.tsx — Main client component with SSE]
- [Source: packages/web/src/components/PortfolioGrid.tsx — Responsive grid layout]
- [Source: packages/web/src/components/PortfolioMetricsWidget.tsx — 4 metric cards]
- [Source: packages/web/src/components/PortfolioFilterBar.tsx — Status/tag/metadata filters]
- [Source: packages/web/src/components/ProjectCard.tsx — Project card with badges]
- [Source: packages/web/src/components/ProjectDetailComponents.tsx — Breadcrumb, Header, NotFound]
- [Source: packages/web/src/components/CrossProjectGraphView.tsx — SVG dependency graph]
- [Source: packages/web/src/lib/portfolio-aggregation.ts — aggregatePortfolioProjects()]
- [Source: packages/web/src/lib/portfolio-filter.ts — filterProjects(), extractAvailableTags()]
- [Source: packages/web/src/lib/portfolio-metrics.ts — calculatePortfolioMetrics()]
- [Source: packages/web/src/lib/types.ts — PortfolioProject, PortfolioMetrics, FilterState]
- [Source: packages/web/src/lib/status-colors.ts — STATUS_FILL color map]
- [Source: docs/web-dashboard/portfolio-view.md — Stub to replace]
- [Source: Story 62-32 — Previous story learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

N/A

### Completion Notes List

- 1 documentation file written replacing stub (docs/web-dashboard/portfolio-view.md)
- Source accuracy verification: all component names, CSS classes, constants, and function signatures verified against source via parallel subagent analysis
- All 14 ACs satisfied
- 13 sections documented: Overview, Portfolio Grid, Project Cards, Metrics Widget, Filtering, Cross-Project Dependency Graph, Project Detail, Real-Time Updates (SSE), Data Flow, API Routes, Key Types, Next Steps
- All SSE event types verified against PortfolioView source (snapshot, session.activity, cross-project-dep-changed)
- All 12 API endpoint paths verified against route files
- Sprint health formula quoted from source: `Math.round((doneStories / totalStories) * 100 - blockedStories * 5)` clamped [0, 100]
- STATUS_FILL color map verified against status-colors.ts (7 statuses)
- PortfolioProject type: 18 fields verified against types.ts
- PortfolioMetrics type: 7 fields verified against types.ts
- FilterState type: 3 fields verified against types.ts
- CrossProjectGraph type verified with node/edge sub-interfaces
- No hero font classes on page
- All 9 cross-links verified (6 sibling pages + Web Dashboard index + Getting Started + Configuration)
- Front matter correct: title, nav_order: 1, parent: Web Dashboard, description present
- 4 `{: .highlight }` callouts used for important notes
- All code blocks use correct syntax highlighting (text, typescript)
- Data flow diagram included with ASCII text layout

### File List

- `docs/web-dashboard/portfolio-view.md` — replace stub with Portfolio View documentation

### Change Log

- **2026-04-24:** Story created — Portfolio View documentation page (1 file to replace)
- **2026-04-24:** Task 1 completed — Portfolio View page written with 13 sections, all ACs met, all sources verified
- **2026-04-24:** Code review — 5 findings (1 HIGH, 3 MEDIUM, 1 LOW), all fixed:
  - [H1] Added response shape column to API Routes table (AC #10 requirement)
  - [M1] Fixed capacity badge to show visible text ("Full"/"{N} free") vs aria-label distinction
  - [M2] Fixed capacity badge to use proper pluralization description instead of `slot(s)` notation
  - [M3] Fixed ProjectHeader agent count to use proper conditional plural instead of `(s)` notation
  - [L1] Updated AC #10 endpoint count from 9 to 12 (docs list all portfolio-related endpoints)

### Senior Developer Review (AI)

**Review Date:** 2026-04-24
**Review Outcome:** Changes Requested (5 findings, all fixed)
**Reviewer Model:** Claude Opus 4.6

**Action Items:**
- [x] **[HIGH]** Add response shape descriptions to API Routes table (AC #10 requires method, purpose, AND response shape)
- [x] **[MEDIUM]** Fix capacity badge: describe visible text ("Full"/"{N} free") separately from aria-label text
- [x] **[MEDIUM]** Fix capacity badge: replace `slot(s)` notation with proper conditional plural description
- [x] **[MEDIUM]** Fix ProjectHeader agent count: replace `(s)` notation with proper conditional plural description
- [x] **[LOW]** Update AC #10 endpoint count from 9 to 12 to match actual documentation
