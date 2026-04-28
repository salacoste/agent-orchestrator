---
title: Sprint Board
nav_order: 2
parent: Web Dashboard
description: Cross-project sprint board with story columns, drag-drop assignment, WIP limits, sprint metrics, analytics charts, planning tools, and real-time SSE updates
---

# Sprint Board

The Sprint Board provides a cross-project sprint overview with aggregated metrics, interactive filtering, and per-project drill-down into a full kanban board with analytics, planning, and team management tabs.

{: .highlight }
The Sprint Board has **two levels**: `/sprints` (unified cross-project sprint grid with summary cards and filtering) and per-project drill-down via `SprintBoard` with 4 tabs (Board, Analytics, Planning, Team). The `/sprints` page is a server component with `force-dynamic` rendering.

## Overview

| Route | Component | Rendering | Description |
|-------|-----------|-----------|-------------|
| `/sprints` | `UnifiedSprintView` | Server (`force-dynamic`) | Cross-project sprint grid with summary cards, filtering |
| (per-project) | `SprintBoard` | Client | 4-tab board with kanban columns, analytics, planning, team |

The sprints page (`packages/web/src/app/sprints/page.tsx`) is a server component that calls `aggregateUnifiedSprints(config)` to build a `UnifiedSprintEntry[]` array, then calls `computeSprintSummary(sprints)` to compute aggregate statistics. It passes both to the `UnifiedSprintView` client component. Metadata title is `"ao | Sprints"`.

## Unified Sprint View

`UnifiedSprintView` (`packages/web/src/components/UnifiedSprintView.tsx`) renders a heading `"Unified Sprints"`, summary cards, filter bar, and a responsive grid of `SprintCard` components:

```text
grid-cols-1          (mobile)
md:grid-cols-2       (medium breakpoint)
lg:grid-cols-3       (large breakpoint)
gap-4                (spacing between cards)
```

When no sprint data is available, it renders an empty state: `"No sprint data found. Configure projects to see unified sprint view."`. A `VelocityComparisonTable` is rendered when `filteredSprints.length >= 2`.

## Summary Cards

`UnifiedSprintSummaryCards` (`packages/web/src/components/UnifiedSprintSummaryCards.tsx`) renders 7 metric cards in a `grid-cols-2` / `md:grid-cols-7` layout with `role="region"` and `aria-label="Sprint Summary"`.

| Metric | Value Format | Tooltip |
|--------|-------------|---------|
| Total Sprints | `summary.totalSprints` | `"Number of projects with sprint data"` |
| Active Sprints | `summary.activeSprints` | `"Projects with status 'active'"` |
| Planning Sprints | `summary.planningSprints` | `"Projects with status 'planning' (not yet started)"` |
| Stories Done | `"${done}/${total}"` | `"Total stories: ${total}, Done: ${done}"` |
| Avg Progress | `"${pct}%"` | `"Average completion percentage across all sprints"` |
| At Risk | `summary.atRiskSprints` | `"Sprints flagged as at-risk or blocked"` |
| Avg Velocity | `"${avg.toFixed(2)}/day"` or `"\u2014"` | `"Average stories completed per day across active sprints (max: ${max.toFixed(2)})"` |

{: .highlight }
The "At Risk" metric uses `text-[var(--color-warning)]` when `atRiskSprints > 0` to draw attention to problematic sprints.

## Sprint Cards

`SprintCard` (`packages/web/src/components/SprintCard.tsx`) renders a card for each sprint with:

- **Health badge** — colored label using `healthBadgeColor()`:

| Health | Label | Badge Color |
|--------|-------|-------------|
| `on-track` | `"On Track"` | `bg-[var(--color-success)]/10 text-[var(--color-success)]` |
| `at-risk` | `"At Risk"` | `bg-[var(--color-warning)]/10 text-[var(--color-warning)]` |
| `blocked` | `"Blocked"` | `bg-[var(--color-error)]/10 text-[var(--color-error)]` |

- **Progress bar** — `SprintProgressBar` (`packages/web/src/components/SprintProgressBar.tsx`) with health-colored fill and ARIA `role="progressbar"` with `aria-valuenow`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-label="${projectName} sprint progress"`. Progress is clamped to `[0, 100]`.

| Health | Bar Color |
|--------|-----------|
| `on-track` | `bg-[var(--color-success)]` |
| `at-risk` | `bg-[var(--color-warning)]` |
| `blocked` | `bg-[var(--color-error)]` |

- **Tooltip** — multi-line format: `"${done} done / ${total} total (${pct}%)\n${inProgress} in-progress\n${blocked} blocked\n${backlog} backlog"`

- **Date range** — `formatDate()` returns `"Mon DD"` or `"\u2014"` (em-dash) for null values, displayed as `"${startDate} \u2014 ${endDate}"`

- **Detail border** — `border-[var(--color-warning)]` for at-risk, `border-[var(--color-error)]` for blocked, `border-[var(--color-border)]` otherwise

- **Auto-expand** — blocked sprints with health reasons (`sprint.health === "blocked" && sprint.healthReasons.length > 0`) automatically expand the detail panel. SSE-driven transitions from non-blocked to blocked also trigger expansion via `useEffect`.

## Filtering

`SprintFilterBar` (`packages/web/src/components/SprintFilterBar.tsx`) provides interactive sprint filtering with `role="search"` and `aria-label="Filter sprints"`.

**Filter controls:**

| Control | Type | Options | Condition |
|---------|------|---------|-----------|
| Status | Dropdown | `All`, `Active`, `Completed`, `Planning` | Always shown |
| Health | Dropdown | `All`, `On Track`, `At Risk`, `Blocked` | Always shown |
| Project | Dropdown | `All Projects` + project list | Only when `availableProjects.length > 1` |
| From | Date input | Date picker | Always shown |
| To | Date input | Date picker | Always shown |

**Behavior:**
- Count indicator displays `"Showing {filtered} of {total} sprints"` when filters are active, or `"{total} sprints"` otherwise — with `aria-live="polite"` for screen readers
- **Clear button** — `"Clear filters"` resets all filters to `EMPTY_SPRINT_FILTERS` (`{ status: null, health: null, projectId: null, dateRange: null }`)
- **AND logic** — `filterSprints()` from `packages/web/src/lib/sprint-filter.ts` applies all filters simultaneously:
  - Status: exact match (if set)
  - Health: exact match (if set)
  - Project: exact match on `projectId` (if set)
  - Date range: overlap check — `sprint.start <= filter.end AND sprint.end >= filter.start`

## Per-Project Sprint Board

`SprintBoard` (`packages/web/src/components/SprintBoard.tsx`) is the per-project board component with 4 tabs. It accepts a `projectId` prop and polls `GET /api/sprint/${projectId}` every 30 seconds for board data.

**Common components** (always visible above tabs):
- `SprintSummaryCard` — 5-column stats grid (Total, Done, Active, Health, Days Left)
- `NotificationPanel` — sprint notifications
- `HealthIndicators` — health status details
- `WipStatusWidget` — WIP limit status
- `SprintGoalsCard` — sprint goals with status colors
- Progress bar — overall sprint progress
- `EpicProgress` — per-epic progress bars

**Tab bar:**

| Tab | Label | Key |
|-----|-------|-----|
| Board | `"Board"` | `board` |
| Analytics | `"Analytics"` | `analytics` |
| Planning | `"Planning"` | `planning` |
| Team | `"Team"` | `team` |

## Board Tab

The Board tab renders 5 story columns using native HTML5 drag-and-drop.

**Story columns** (`DEFAULT_COLUMN_LABELS` and `DEFAULT_COLUMN_COLORS`):

| Column | Label | Border Color |
|--------|-------|-------------|
| `backlog` | `"Backlog"` | `border-zinc-700` |
| `ready-for-dev` | `"Ready"` | `border-yellow-700` |
| `in-progress` | `"In Progress"` | `border-blue-700` |
| `review` | `"Review"` | `border-purple-700` |
| `done` | `"Done"` | `border-green-700` |

Column labels and colors can be overridden via `columnMeta` from the board API response.

**Drag-and-drop:**
- Uses native HTML5 API (`onDragStart`, `onDragOver`, `onDragLeave`, `onDrop`) — NOT a drag-drop library
- Data transfer MIME type: `"text/plain"` with JSON payload `{ storyId: string, fromCol: string }`
- Move request: `PATCH /api/sprint/${projectId}/story/${storyId}` with body `{ status: toCol, force }`
- **Optimistic update** — UI updates immediately, rolls back on API failure
- Error format: `"Failed to move ${storyId}: ${error message}"`

**WIP limit enforcement:**
- When moving a story would exceed a column's WIP limit, the API returns HTTP 409 with `wipExceeded: true`
- SprintBoard shows a confirmation prompt: `WIP limit exceeded for "${column}" (${current}/${limit}). Move anyway?`
- Two buttons: `"Force Move"` (yellow, sends `force: true`) and `"Cancel"` (rolls back)

**Sprint end date countdown:**
- `"(X d left)"` — days remaining (default text color)
- `"(today)"` — sprint ends today (`text-yellow-400`)
- `"(X d overdue)"` — past deadline (`text-red-400`)

## Analytics Tab

The Analytics tab renders 10 chart and analytics components:

| Component | Description |
|-----------|-------------|
| `BurndownChart` | Sprint burndown visualization |
| `CycleTimeChart` | Story cycle time distribution |
| `VelocityChart` | Velocity trend over time |
| `ThroughputChart` | Story throughput analytics |
| `CfdChart` | Cumulative Flow Diagram |
| `SprintComparisonTable` | Weekly period comparison with trend arrows |
| `ReworkChart` | Rework detection and frequency |
| `SimulationConfigPanel` + `MonteCarloChart` | Monte Carlo simulation configuration and results |
| `ForecastAccuracyChart` | Forecast accuracy and calibration |
| `HistorySearchView` | Search through sprint history |

`SimulationConfigPanel` persists configuration to `localStorage` key `"ao:sim-config:${projectId}"` with 300ms debounce. Default config: `{ simulations: 5000, confidenceLevels: ["p50", "p80", "p95"], throughputWindowDays: 0, excludeWeekends: true }`.

## Planning Tab

The Planning tab renders:

- **`PlanningView`** — sprint planning recommendations (fetched from `GET /api/sprint/${projectId}/plan`)
- **`CreateStoryForm`** — story creation form with fields: title (required, validation: `"Title is required"`), description, epic, points. Submits via `POST /api/sprint/${projectId}/story/create`. Button labels: `"Create Story"` / `"Creating..."`. Success format: `"Created ${id}: ${title}"`.
- **`EpicManager`** — epic CRUD management via `GET/POST/PATCH/DELETE /api/sprint/${projectId}/epics`
- **`DependencyGraphView`** — dependency graph visualization (fetched from `GET /api/sprint/${projectId}/dependencies`) with cycle detection (`GET /api/sprint/${projectId}/dependency-cycles`)

## Team Tab

The Team tab renders:

- **`TeamWorkloadView`** — workload distribution per team member (fetched from `GET /api/sprint/${projectId}/workload`)
- **`AgingHeatmap`** — story aging visualization showing how long stories have been in each status (fetched from `GET /api/sprint/${projectId}/aging`)

## Story Detail

`StoryDetailModal` (`packages/web/src/components/StoryDetailModal.tsx`) renders a modal overlay with story details when a story card is clicked. It fetches data from `GET /api/sprint/${projectId}/story/${storyId}`.

**Status colors** (used across story detail and timeline):

| Status | Background Color |
|--------|-----------------|
| `backlog` | `bg-zinc-700` |
| `ready-for-dev` | `bg-yellow-700` |
| `in-progress` | `bg-blue-700` |
| `review` | `bg-purple-700` |
| `done` | `bg-green-700` |

**Modal behavior:**
- Escape key closes the modal
- Clicking the backdrop closes the modal
- Displays transitions, column dwells, and cycle time

`StoryTimeline` (`packages/web/src/components/StoryTimeline.tsx`) renders a timeline of status transitions, each with status-colored `{ border, bg, text }` classes. It polls `GET /api/sprint/${projectId}/story/${storyId}` every 30 seconds for live updates.

## Real-Time Updates (SSE)

SprintBoard uses the **shared `useSSEConnection` hook** (`packages/web/src/hooks/useSSEConnection.ts`) — unlike PortfolioView which implements inline SSE.

**Event handlers:**

| Event Type | Callback | Data Shape |
|------------|----------|------------|
| `story.started` | `onStoryStarted` | `{ storyId: string, agentId: string }` |
| `story.completed` | `onStoryCompleted` | `{ storyId: string }` |
| `story.blocked` | `onStoryBlocked` | `{ storyId: string, reason: string }` |
| `agent.status_changed` | `onAgentStatusChanged` | `{ agentId: string, status: string }` |
| `cascade.triggered` | `onCascadeTriggered` | `{ failureCount: number }` |

**Connection behavior:**
- Endpoint: `/api/events` (global multiplexed SSE stream)
- Exponential backoff: `Math.min(1000 * Math.pow(2, attempts), 8000)` — starts at 1 second, caps at 8 seconds
- Returns `{ connected: boolean, reconnecting: boolean }`
- On reconnection, the `onReconnected` callback fetches missed events

{: .highlight }
In addition to SSE, SprintBoard polls `GET /api/sprint/${projectId}` every 30 seconds for full board data, and `SprintGoalsCard` polls `GET /api/sprint/${projectId}/goals` every 30 seconds.

## Data Flow

The sprint data flows through six stages:

**1. Server-side aggregation** (`packages/web/src/lib/unified-sprint-aggregation.ts`):
`aggregateUnifiedSprints(config)` reads sprint status from the BMAD tracker for all projects, counts stories using `STORY_KEY_PATTERN` (`/^\d+[a-z]*-\d+-/`), and builds `UnifiedSprintEntry[]`. Sprint name is derived from status: `"Completed Sprint"`, `"Planning Sprint"`, or `"Active Sprint"`.

**2. Server-side summary** (`packages/web/src/lib/unified-sprint-summary.ts`):
`computeSprintSummary(sprints)` aggregates totals — a pure sync function safe for client bundles. `avgVelocity` is rounded to 2 decimal places.

**3. Server-side health** (`packages/web/src/lib/unified-sprint-aggregation.ts`):
`computeSprintHealth(entry, elapsedFraction)` evaluates health rules in order:

| Condition | Result |
|-----------|--------|
| `blocked > 0 AND inProgress === 0` | `"blocked"` |
| `blocked > inProgress` | `"at-risk"` |
| `progress < 50% AND elapsed > 75%` | `"at-risk"` |
| Default | `"on-track"` |

`computeHealthReasons()` generates human-readable explanations for at-risk/blocked sprints.

**4. Client-side filtering** (`packages/web/src/lib/sprint-filter.ts`):
`filterSprints(sprints, filters)` applies AND logic on status/health/project/date.

**5. Client SSE** (`useSSEConnection`):
Story events from `/api/events` trigger board refreshes via the shared hook.

**6. Client polling** (`SprintBoard`):
Per-project board polls `GET /api/sprint/${projectId}` every 30 seconds.

```text
Server                              Client
aggregateUnifiedSprints()           UnifiedSprintView
        |                                   |
  UnifiedSprintEntry[]               computeSprintSummary()
        |                                   |
        +------> UnifiedSprintView <-------+
                         |
                  filterSprints()
                         |
                 filteredSprints[]
                         |
        +--------+-------+--------+
        |        |                |
  SummaryCards  FilterBar    SprintCard[]
                                    |
                              SprintBoard (per-project)
                                    |
                      +------+------+------+------+
                      |      |      |      |
                    Board  Analytics Planning Team
```

## API Routes

The sprint pages use the following API endpoints:

| Endpoint | Method | Purpose | Response Shape |
|----------|--------|---------|---------------|
| `/api/sprint/{project}` | GET | Main board data (columns, stories, epics, stats) | `{ projectId, projectName, columns, columnOrder, columnMeta, epics, hasPoints, stats }` |
| `/api/sprint/{project}/summary` | GET | Per-project summary | `{ projectName, progress, stats, healthOverall, velocity, forecastPace, daysRemaining, stuckStories, wipAlerts, sprintGoal }` |
| `/api/sprint/{project}/config` | GET/PATCH | Sprint config (end date, WIP limits) | `{ sprintEndDate, wipLimits }` |
| `/api/sprint/{project}/health` | GET | Health indicators | `{ overall, indicators, stuckStories, wipColumns }` |
| `/api/sprint/{project}/goals` | GET | Sprint goals | `{ goals: SprintGoal[], overallProgress, onTrack, sprintEndDate }` |
| `/api/sprint/{project}/story/{id}` | GET/PATCH | Story detail / move story | `{ id, title, status, epic, points, transitions, columnDwells, cycleTimeMs }` |
| `/api/sprint/{project}/story/create` | POST | Create new story | `{ id, title }` |
| `/api/sprint/{project}/comparison` | GET | Weekly period comparison | `{ periods, trends, hasPoints }` |
| `/api/sprint/{project}/dependencies` | GET | Dependency graph | `{ nodes, circularWarnings, missingWarnings }` |
| `/api/sprint/{project}/dependency-cycles` | GET | Cycle detection | `{ cycles: string[][] }` from core library |
| `/api/sprint/{project}/wip` | GET | WIP dashboard status | `{ [column]: { current, limit } }` |
| `/api/sprint/{project}/epics` | GET/POST/PATCH/DELETE | Epic CRUD | Epic objects |
| `/api/sprint/{project}/monte-carlo` | GET | Monte Carlo simulation | Simulation results with confidence levels |
| `/api/sprint/{project}/workload` | GET | Team workload | Workload per assignee |
| `/api/sprint/{project}/aging` | GET | Story aging heatmap | Aging data per story |
| `/api/sprint/{project}/metrics` | GET | Cycle time metrics | `{ stories, averageCycleTimeMs, medianCycleTimeMs, averageColumnDwells, bottleneckColumn, throughputPerDay, throughputPerWeek, completedCount }` |
| `/api/sprint/{project}/velocity` | GET | Velocity comparison data | Velocity trends from core library |
| `/api/sprint/{project}/forecast` | GET | Sprint forecast | `{ projectedCompletionDate, daysRemaining, pace, confidence, currentVelocity, requiredVelocity, remainingStories, totalStories, completedStories, hasPoints }` |
| `/api/sprint/{project}/cfd` | GET | Cumulative Flow Diagram | `{ dataPoints, columns, dateRange }` |
| `/api/sprint/{project}/throughput` | GET | Throughput analytics | `{ dailyThroughput, weeklyThroughput, leadTimes, averageLeadTimeMs, medianLeadTimeMs, averageCycleTimeMs, medianCycleTimeMs, flowEfficiency, columnTrends, bottleneckTrend }` |
| `/api/sprint/{project}/rework` | GET | Rework detection | `{ stories, reworkRate, totalReworkEvents, totalReworkTimeMs, transitionStats, worstOffenders }` |
| `/api/sprint/{project}/history` | GET | History search | `{ entries, dailyCompletions, totalStories, doneCount, hasPoints, totalPoints, donePoints }` |
| `/api/sprint/{project}/retro` | GET | Retrospective | `{ periods, velocityTrend, averageVelocity, velocityChange, totalCompleted, overallAverageCycleTimeMs, hasPoints }` |
| `/api/sprint/{project}/standup` | GET | Daily standup | `{ generatedAt, projectName, completedYesterday, inProgress, blocked, health, reworkAlerts, markdown }` |
| `/api/sprint/{project}/utilization` | GET | Project utilization | Utilization metrics from core library |
| `/api/sprint/{project}/assignable-agents` | GET | Assignable agents with capacity | `{ agents, summary }` |
| `/api/sprint/{project}/ceremony/start` | POST | Start sprint ceremony | `{ projectId, sprintStartDate, sprintEndDate, sprintGoal, targetVelocity }` |
| `/api/sprint/{project}/ceremony/end` | POST | End sprint ceremony | `{ projectId, retrospective, forecast, health, cleared? }` |
| `/api/events` | SSE | Real-time story events | Stream of typed events |

## Key Types

All types are defined in `packages/web/src/lib/types.ts`.

**`SprintHealthStatus`:**

```typescript
type SprintHealthStatus = "on-track" | "at-risk" | "blocked";
```

**`UnifiedSprintEntry`** — 14 fields per sprint:

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | `string` | Project identifier |
| `projectName` | `string` | Display name |
| `sprintName` | `string` | Derived sprint name |
| `startDate` | `string \| null` | Sprint start date |
| `endDate` | `string \| null` | Sprint end date |
| `stories` | `{ total, done, inProgress, blocked, backlog }` | Story counts by status |
| `progressPercent` | `number` | Completion percentage |
| `status` | `"active" \| "completed" \| "planning"` | Sprint lifecycle status |
| `health` | `SprintHealthStatus` | Computed health status |
| `healthReasons` | `string[]` | Human-readable health explanations |
| `velocity` | `number` | Stories completed per day |
| `velocityTrend` | `"improving" \| "declining" \| "stable" \| "unknown"` | Velocity trend direction |

**`UnifiedSprintSummary`** — 10 aggregated fields:

| Field | Type | Description |
|-------|------|-------------|
| `totalSprints` | `number` | Total sprint count |
| `activeSprints` | `number` | Sprints with `"active"` status |
| `completedSprints` | `number` | Sprints with `"completed"` status |
| `planningSprints` | `number` | Sprints with `"planning"` status |
| `totalStories` | `number` | Sum of all stories |
| `storiesDone` | `number` | Sum of done stories |
| `avgProgress` | `number` | Average completion percentage |
| `atRiskSprints` | `number` | Sprints with at-risk or blocked health |
| `avgVelocity` | `number` | Average stories/day (rounded to 2 decimals) |
| `maxVelocity` | `number` | Maximum velocity across sprints |

{: .highlight }
`completedSprints` is tracked in the type but not displayed as a summary card — it's available for custom queries and filtering.

**`SprintFilterState`** — 4 filter fields:

| Field | Type | Description |
|-------|------|-------------|
| `status` | `UnifiedSprintEntry["status"] \| null` | Status filter (null = all) |
| `health` | `SprintHealthStatus \| null` | Health filter (null = all) |
| `projectId` | `string \| null` | Project filter (null = all) |
| `dateRange` | `{ start: string; end: string } \| null` | Date range filter (null = all) |

## Next Steps

- [Web Dashboard](.) — dashboard overview, pages, SSE hooks, design system
- [Portfolio View](portfolio-view/) — project grid, cards with status/metrics/health, filtering
- [Session Detail](session-detail/) — timeline, log streaming, agent controls
- [Scenario Comparison](scenario-comparison/) — Monte Carlo interface, forecast visualization
- [Conflict Resolution](conflict-resolution/) — conflict detection and resolution workflows
- [Risk Management](risk-management/) — risk scoring, utilization, optimization
- [Workflow Events & Fleet](workflow-events-fleet/) — workflow builder, event stream, fleet management
- [Getting Started](../getting-started/) — install and run the dashboard
- [Configuration](../getting-started/configuration.md) — configure projects, plugins, and reactions
