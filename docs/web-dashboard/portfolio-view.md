---
title: Portfolio View
nav_order: 1
parent: Web Dashboard
description: Portfolio dashboard with project grid, aggregated metrics, filtering, cross-project dependency graph, and project drill-down — real-time SSE updates
---

# Portfolio View

The Portfolio View provides a multi-project overview with aggregated metrics, interactive filtering, a cross-project dependency graph, and per-project drill-down. It spans two page routes and is the primary view for monitoring your agent fleet across all configured projects.

{: .highlight }
Portfolio has **two page routes**: `/portfolio` (grid overview with metrics, filtering, and cross-project graph) and `/portfolio/[projectId]` (single project drill-down with enriched sessions). Both are server components with `force-dynamic` rendering.

## Overview

| Route | Component | Rendering | Description |
|-------|-----------|-----------|-------------|
| `/portfolio` | `PortfolioView` | Server (`force-dynamic`) | Grid overview with metrics, filtering, dependency graph |
| `/portfolio/[projectId]` | `Dashboard` + `ProjectHeader` | Server (`force-dynamic`) | Single project drill-down with enriched sessions |

The portfolio page (`packages/web/src/app/portfolio/page.tsx`) is a server component that calls `aggregatePortfolioProjects()` to build a `PortfolioProject[]` array, then passes it to the `PortfolioView` client component. Metadata title is `"ao | Portfolio"`.

The project detail page (`packages/web/src/app/portfolio/[projectId]/page.tsx`) looks up the project in `agent-orchestrator.yaml`, filters sessions by `projectId`, enriches them via `enrichProjectSessions()`, and renders `ProjectBreadcrumb`, `ProjectHeader`, and `Dashboard`. Metadata title is `"ao | ${projectId}"`.

## Portfolio Grid

`PortfolioGrid` (`packages/web/src/components/PortfolioGrid.tsx`) renders a responsive grid of `ProjectCard` components:

```text
grid-cols-1          (mobile)
md:grid-cols-2       (medium breakpoint)
lg:grid-cols-3       (large breakpoint)
gap-4                (spacing between cards)
```

The grid container uses `role="list"` for accessibility. When no projects are configured, `PortfolioView` renders an empty state with a `"No Projects Configured"` heading and a YAML configuration example.

## Project Cards

`ProjectCard` (`packages/web/src/components/ProjectCard.tsx`) renders a card for each project with the following elements:

- **Status indicator** — colored dot using `statusColors`:
  - `active` → `bg-[var(--color-status-working)]`
  - `idle` → `bg-[var(--color-status-attention)]`
  - `error` → `bg-[var(--color-status-error)]`
- **Project name and ID**
- **Agent count** — displays `activeAgents` / `totalAgents`
- **Story badges** — four badge types with conditional rendering (shown only when count > 0):

| Badge | Background | Text Color |
|-------|-----------|------------|
| In Progress | `bg-[rgba(88,166,255,0.15)]` | `text-[var(--color-accent)]` |
| Backlog | `bg-[var(--color-bg-subtle)]` | `text-[var(--color-text-secondary)]` |
| Done | `bg-[rgba(63,185,80,0.15)]` | `text-[var(--color-status-ready)]` |
| Blocked | `bg-[rgba(239,68,68,0.15)]` | `text-[var(--color-status-error)]` |

- **Utilization badge** — circular percentage indicator with color thresholds:
  - >=80% → green
  - >=50% → blue
  - <50% → subtle gray
- **Capacity badge** — three states with distinct visible text and `aria-label`:
  - Visible `"Full"`, aria-label `"At full capacity"` (red) when `isAtCapacity` is true
  - Visible `"{availableSlots} free"`, aria-label `"Near capacity ({utilizationPercent}%)"` (yellow) when `isNearCapacity` is true
  - Visible `"{availableSlots} free"`, aria-label `"{availableSlots} slots available"` (green) otherwise
- **Pool available** — shown when `poolAgentsAvailable.length > 0`
- **Last activity** — relative time via `formatRelativeTime()`: `"just now"`, `"{X}m ago"`, `"{X}h ago"`, `"{X}d ago"`, or the locale date
- **Highlight animation** — when `lastUpdated` changes (from SSE), the card pulses with `animate-[highlight-pulse_1s_ease-out]` for `HIGHLIGHT_DURATION_MS` (1000ms)

{: .highlight }
ProjectCard uses `role={onClick ? "button" : "listitem"}` for keyboard accessibility. Enter key triggers navigation; Space is intentionally not handled.

## Metrics Widget

`PortfolioMetricsWidget` (`packages/web/src/components/PortfolioMetricsWidget.tsx`) renders four metric cards in a `grid-cols-2` / `md:grid-cols-4` layout with `role="region"` and `aria-label="Portfolio Metrics"`.

| Metric | Value Format | Color Logic | Tooltip |
|--------|-------------|-------------|---------|
| Total Agents | `metrics.totalAgents` | Default (`text-primary`) | `"Total active agents across all projects"` |
| Stories | `"${done}/${total}"` | Default | `"Backlog: ${backlog}, In Progress: ${inProgress}, Done: ${done}, Blocked: ${blocked}"` |
| Sprint Health | `"${score}%"` | >=80 → green, >=60 → yellow, <60 → red | `"Sprint health: ${label}. Based on completion rate minus blocked penalty."` |
| Utilization | `"${percent}%"` | Default | `"Percentage of active projects across portfolio"` |

**Sprint health score formula** (from `packages/web/src/lib/portfolio-metrics.ts`):

```typescript
// Health = completion rate minus blocked penalty
const score = Math.round((doneStories / totalStories) * 100 - blockedStories * 5);
// Clamped to [0, 100]
```

Health label thresholds: >=80 → `"Healthy"`, >=60 → `"Moderate"`, <60 → `"At Risk"`.

## Filtering

`PortfolioFilterBar` (`packages/web/src/components/PortfolioFilterBar.tsx`) provides interactive project filtering with `role="search"` and `aria-label="Filter projects"`.

**Filter controls:**

| Control | Type | Options |
|---------|------|---------|
| Status | Dropdown | `All`, `Active`, `Idle`, `Error` |
| Tags | Toggle buttons | Dynamically extracted from project `tags[]` via `extractAvailableTags()` |
| Metadata | Dropdowns | Dynamically extracted from project `metadata` via `extractAvailableMetadata()` |

**Behavior:**
- Project count displays `"{filtered} of {total} projects"` when filters are active, or `"{total} projects"` otherwise — with `aria-live="polite"` for screen readers
- **Clear button** — resets all filters to `EMPTY_FILTERS` (`{ status: null, tags: [], metadata: {} }`)
- **AND logic** — `filterProjects()` from `packages/web/src/lib/portfolio-filter.ts` applies all filters simultaneously:
  - Status: exact match (if set)
  - Tags: all selected tags must be present on the project
  - Metadata: all key-value pairs must match

## Cross-Project Dependency Graph

`CrossProjectGraphView` (`packages/web/src/components/CrossProjectGraphView.tsx`) renders an SVG-based dependency graph with absolute positioning.

**Layout constants:**

| Constant | Value | Purpose |
|----------|-------|---------|
| `NODE_W` | 140 | Node width in pixels |
| `NODE_H` | 36 | Node height in pixels |
| `COL_GAP` | 200 | Horizontal gap between project columns |
| `NODE_GAP` | 52 | Vertical gap between nodes |
| `HEADER_H` | 28 | Column header height |

**Node colors** — from `STATUS_FILL` in `packages/web/src/lib/status-colors.ts`:

| Status | Fill Color |
|--------|-----------|
| `backlog` | `#3f3f46` |
| `ready-for-dev` | `#a16207` |
| `in-progress` | `#1d4ed8` |
| `review` | `#7e22ce` |
| `done` | `#15803d` |
| `blocked` | `#dc2626` |
| `unknown` | `#52525b` |

**Edge styling:**
- **Resolved edges** (`isResolved === true`) — green (`#15803d`), solid stroke, `opacity: 0.5`
- **Unresolved edges** — `var(--color-text-muted)`, dashed stroke (`strokeDasharray: "6 3"`), `opacity: 0.7`
- **Blocked nodes** — red stroke (`#ef4444`, width 2) with `"blocked"` text label

Edges are drawn as quadratic Bezier curves from source node right edge to target node left edge. Edge tooltips show source/target story IDs and project names, with resolved/pending status. Tooltips toggle on click and dismiss on outside click or Escape key.

{: .highlight }
The graph is only rendered when `projects.length > 1` — a single project has no cross-project dependencies to display. Empty state shows `"No cross-project dependencies defined."`.

## Project Detail

The project detail page (`/portfolio/[projectId]`) renders three components:

1. **`ProjectBreadcrumb`** — navigation with `"← Portfolio"` link and current project name (`aria-current="page"`)
2. **`ProjectHeader`** — status dot, project name, status badge, active agent count (`"{activeAgents} active agent"` with conditional plural), and shared pool info (eligible projects, `maxConcurrent`, reserved agents)
3. **`Dashboard`** — the main dashboard component with enriched sessions filtered for this project

`ProjectNotFound` is rendered when the `projectId` does not match any configured project — shows a warning icon, `"Project Not Found"` heading, the invalid ID in a `<code>` tag, and a `"Return to Portfolio"` link.

Session enrichment (`packages/web/src/lib/enrich-project-sessions.ts`) adds PR metadata (state, CI checks, review decision, mergeability) and session metadata to each session. Terminal statuses (`"merged"`, `"killed"`, `"cleanup"`, `"done"`, `"terminated"`) skip PR refresh.

## Real-Time Updates (SSE)

`PortfolioView` (`packages/web/src/components/PortfolioView.tsx`) implements its **own inline SSE connection** — it does NOT use the shared `useSSEConnection` hook. It creates an `EventSource` to `"/api/events"` with custom batching and reconnection logic.

**Event handlers:**

| Event Type | Handler | Behavior |
|------------|---------|----------|
| `snapshot` | `processSnapshot()` | Groups sessions by `projectId`, counts active agents, tracks `lastActivityAt`, queues updates via `queueProjectUpdate()` with 500ms batch window (`BATCH_WINDOW_MS`), then flushes with `lastUpdated: Date.now()` |
| `session.activity` | `router.refresh()` | Full page refresh fallback |
| `cross-project-dep-changed` | `fetchCpGraph()` | Re-fetches `/api/dependencies/cross-project/graph` |

**Batching pattern:**
1. `processSnapshot()` groups incoming sessions by `projectId`
2. Each project update is queued via `queueProjectUpdate(projectId, update)`
3. Updates accumulate in `pendingUpdatesRef` (a `Map`)
4. `scheduleFlush()` sets a `setTimeout(flushUpdates, 500)`
5. `flushUpdates()` merges all pending updates into state with `lastUpdated: Date.now()`

**Reconnection:**
- Exponential backoff: `Math.min(1000 * Math.pow(2, reconnectAttempts), 8000)` — starts at 1 second, caps at `RECONNECT_MAX_DELAY_MS` (8 seconds)
- A `"Reconnecting..."` badge with `animate-pulse` yellow dot is shown when `connectionStatus === "reconnecting"`
- Cleanup closes the EventSource and clears all timeouts

{: .highlight }
`PortfolioView` SSE is independent from the dashboard's other SSE hooks. The three event types (`snapshot`, `session.activity`, `cross-project-dep-changed`) are handled inline with custom batching logic — no shared hooks are used.

## Data Flow

The portfolio data flows through four stages:

**1. Server-side aggregation** (`packages/web/src/lib/portfolio-aggregation.ts`):
`aggregatePortfolioProjects(config, sessionManager, sprintStatusPath)` reads `sprint-status.yaml`, counts stories by status using `STORY_KEY_PATTERN` (`/^\d+-\d+-/`), filters sessions by project, and builds `PortfolioProject[]`. Per-project status: `"active"` if agents > 0, `"error"` if any session has `status === "errored"`, otherwise `"idle"`.

**2. Client-side metrics** (`packages/web/src/lib/portfolio-metrics.ts`):
`calculatePortfolioMetrics(projects)` aggregates totals across all projects, computes sprint health score and utilization percent, and optionally computes pool utilization.

**3. Client-side filtering** (`packages/web/src/lib/portfolio-filter.ts`):
`filterProjects(projects, filters)` applies AND logic on status/tags/metadata. Tags and metadata are extracted dynamically via `extractAvailableTags()` and `extractAvailableMetadata()`.

**4. Client-side SSE updates** (`PortfolioView`):
`snapshot` events trigger `processSnapshot()` → `queueProjectUpdate()` → 500ms batch → `setProjects()` with `lastUpdated: Date.now()`, causing card highlight animations.

```text
Server                          Client
aggregatePortfolioProjects()    calculatePortfolioMetrics()
        |                               |
  PortfolioProject[]             PortfolioMetrics
        |                               |
        +-----> PortfolioView <---------+
                       |
                filterProjects()
                       |
               filteredProjects[]
                       |
        +----------+---+----------+
        |          |              |
  MetricsWidget  FilterBar    PortfolioGrid
                                    |
                              ProjectCard[]
```

## API Routes

The portfolio pages use the following API endpoints:

| Endpoint | Method | Purpose | Response Shape |
|----------|--------|---------|---------------|
| `/api/events` | SSE | Real-time snapshot, activity, and dependency updates | Stream of `{ type, sessions[] }` events |
| `/api/dependencies/cross-project/graph` | GET | Cross-project dependency graph | `{ graph: CrossProjectGraph }` or `{ graph: { nodes: [], edges: [], projectGroups: {} } }` |
| `/api/dependencies/cross-project` | GET/POST/DELETE | CRUD cross-project dependencies | Array of dependency objects |
| `/api/dependencies/cross-project/blocking-status` | GET | Blocking status alerts | Blocking status summaries |
| `/api/dependencies/cross-project/search-stories` | GET | Search stories across projects | Matching story results |
| `/api/pool/capacity` | GET | Agent capacity status | `{ agents: CapacityResult[], summary: { total, atCapacity, nearCapacity, available } }` or `{ enabled: false }` |
| `/api/pool/utilization` | GET | Pool utilization overview | Utilization overview object or `{ enabled: false }` |
| `/api/sprint/[project]` | GET | Project sprint data | Sprint columns, epics, and stats |
| `/api/sprint/[project]/utilization` | GET | Per-project utilization metrics | Project utilization breakdown |
| `/api/sprint/[project]/assignable-agents` | GET | Local + pool agents for assignment | `{ agents: AgentInfo[], summary: { total, local, pool } }` |
| `/api/agent/[id]/capacity` | GET | Single agent capacity | `{ maxCapacity, availableSlots, isAtCapacity, isNearCapacity, utilizationPercent }` |
| `/api/sprint/digest` | GET | Portfolio-wide sprint digest | `{ completedStories, activeAgents, blockers, totalStories, doneStories }` |

## Key Types

All types are defined in `packages/web/src/lib/types.ts` unless noted.

**`PortfolioProject`** — 18 fields per project:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Project identifier |
| `name` | `string` | Display name |
| `status` | `"active" \| "idle" \| "error"` | Computed from session activity |
| `activeAgents` | `number` | Sessions with `activity === "active" \|\| status === "working"` |
| `totalAgents` | `number` | All sessions for this project |
| `stories` | `{ backlog, inProgress, done, blocked }` | Story counts from sprint-status.yaml |
| `lastActivity` | `string` (optional) | ISO timestamp of latest session activity |
| `lastUpdated` | `number` (optional) | Client-side timestamp for highlight animation |
| `tags` | `string[]` (optional) | Project tags for filtering |
| `metadata` | `Record<string, string>` (optional) | Project metadata for filtering |
| `sharedPool` | `{ enabled, eligibleProjects[], maxConcurrent?, reservedAgents? }` (optional) | Shared pool configuration |
| `poolAgentsAvailable` | `{ agentId, sourceProjectId, sourceProjectName }[]` (optional) | Idle agents from other eligible projects |
| `capacityStatus` | `{ maxCapacity, availableSlots, isAtCapacity, isNearCapacity, utilizationPercent }` (optional) | Agent capacity status |

**`PortfolioMetrics`** — 7 aggregated fields:

| Field | Type | Description |
|-------|------|-------------|
| `totalAgents` | `number` | Sum of active agents |
| `totalConfiguredAgents` | `number` | Sum of all configured agents |
| `stories` | `{ backlog, inProgress, done, blocked, total }` | Aggregated story counts |
| `sprintHealthScore` | `number` | 0–100, based on completion rate minus blocked penalty |
| `utilizationPercent` | `number` | Percentage of active agents |
| `poolUtilization` | `{ totalPoolAgents, activePoolAgents, totalReservedAgents, poolProjectCount }` (optional) | Pool-wide utilization |

**`FilterState`** — 3 filter fields:

| Field | Type | Description |
|-------|------|-------------|
| `status` | `PortfolioProject["status"] \| null` | Status filter (null = all) |
| `tags` | `string[]` | Tags that must all be present |
| `metadata` | `Record<string, string>` | Key-value pairs that must all match |

**`CrossProjectGraph`** (from `@composio/ao-core`):

| Field | Type | Description |
|-------|------|-------------|
| `nodes` | `CrossProjectGraphNode[]` | Story nodes with `{ id, storyId, projectId, projectName, status, isBlocked }` |
| `edges` | `CrossProjectGraphEdge[]` | Dependencies with `{ id, sourceNodeId, targetNodeId, sourceProjectId, targetProjectId, isResolved }` |
| `projectGroups` | `Record<string, string[]>` | Mapping of project ID to node IDs |

## Next Steps

- [Web Dashboard](.) — dashboard overview, pages, SSE hooks, design system
- [Sprint Board](sprint-board/) — story columns, assignment interface, sprint metrics
- [Session Detail](session-detail/) — timeline, log streaming, agent controls
- [Scenario Comparison](scenario-comparison/) — Monte Carlo interface, forecast visualization
- [Conflict Resolution](conflict-resolution/) — conflict detection and resolution workflows
- [Risk Management](risk-management/) — risk scoring, utilization, optimization
- [Workflow Events & Fleet](workflow-events-fleet/) — workflow builder, event stream, fleet management
- [Getting Started](../getting-started/) — install and run the dashboard
- [Configuration](../getting-started/configuration.md) — configure projects, plugins, and reactions
