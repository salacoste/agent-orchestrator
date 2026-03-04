# BMad Web Dashboard

## Overview

The BMad web dashboard is a local-only sprint management interface built with Next.js 15 (App Router) and React client components styled with Tailwind CSS. It provides a real-time kanban board, burndown and cycle-time charts, sprint health indicators, epic progress tracking, retrospective analytics, and per-story timeline views.

All data is fetched from local API routes under `/api/sprint/{project}/`. Every component polls its endpoint on a 30-second interval (`setInterval(fetchData, 30_000)`). No authentication is required -- the dashboard is designed as a local development tool.

Components are declared with the `"use client"` directive and use `useState`/`useEffect` for data fetching. Each fetch cycle sets a `cancelled` flag on cleanup to prevent state updates after unmount.

---

## Sprint Board

**Component**: `packages/web/src/components/SprintBoard.tsx`

The Sprint Board is the top-level view for a project's sprint. It composes several sub-components and manages the kanban column layout.

### Kanban Columns

The board renders a 5-column grid (`grid-cols-5`) with a colored top border per column:

| Column Key       | Display Label | Border Color  |
|------------------|---------------|---------------|
| `backlog`        | Backlog       | zinc-700      |
| `ready-for-dev`  | Ready         | yellow-700    |
| `in-progress`    | In Progress   | blue-700      |
| `review`         | Review        | purple-700    |
| `done`           | Done          | green-700     |

Column order and keys are sourced from the `BMAD_COLUMNS` constant in `@composio/ao-plugin-tracker-bmad`. Stories that do not match a known column fall back to `backlog`.

### Story Cards

Each card displays:

- **Story ID**: mono-spaced, linked to the issue URL when available (skips `file://` URLs).
- **Title**: clamped to 2 lines (`line-clamp-2`).
- **Epic badge**: shown when the story has an `epic-*` label.
- **Session link**: links to `/sessions/{sessionId}` and shows activity status when an agent session is working on the story.

### Progress Bar

Below the health indicators, a progress bar shows sprint completion as `{done}/{total} stories ({percent}%)`. The fill uses the `--color-status-success` CSS variable.

### Epic Filter

When an epic is selected via the EpicProgress component, the board filters all columns to show only stories belonging to that epic. The progress bar stats also update to reflect the filtered epic's counts.

### Integrated Sub-Components

The Sprint Board renders these children in order:

1. **HealthIndicators** -- always visible at the top.
2. **Progress bar** -- sprint-level or epic-filtered completion.
3. **EpicProgress** -- per-epic breakdown (when epics exist).
4. **Kanban columns** -- the 5-column grid.
5. **Burndown** -- collapsible section toggled by a button (`aria-expanded`).
6. **Cycle Time Metrics** -- collapsible section toggled by a button.

### Data Fetching

- **Endpoint**: `GET /api/sprint/{project}`
- **Interval**: 30 seconds
- **Response shape**: `SprintData` (see API Routes Reference below)

---

## Health Indicators

**Component**: `packages/web/src/components/HealthIndicators.tsx`

Displays sprint health status above the progress bar. The fetch is non-fatal -- if the health endpoint fails, the component renders nothing.

### Display Modes

- **OK state**: A compact single-line green badge reading "Sprint Health: OK" with a green border.
- **Warning/Critical state**: Renders one card per indicator with a severity-colored left icon and border. Each card can be expanded to show detail lines (prefixed with an arrow character).

### Severity Icons

| Severity   | Icon | Color       |
|------------|------|-------------|
| `ok`       | checkmark | green-400 |
| `warning`  | triangle  | yellow-400 |
| `critical` | circle    | red-400   |

### Expandable Details

Each indicator with a non-empty `details` array shows a "Details" toggle button. When expanded, detail lines appear as monospaced text indented under the indicator message.

### Data Fetching

- **Endpoint**: `GET /api/sprint/{project}/health`
- **Interval**: 30 seconds
- **Response shape**: `SprintHealthResult` with `overall`, `indicators[]`, `stuckStories[]`, `wipColumns[]`

---

## Burndown Chart

**Component**: `packages/web/src/components/BurndownChart.tsx`

An SVG line chart that plots remaining stories over time. It fetches two endpoints in parallel: velocity (required) and forecast (supplementary, non-fatal on failure).

### Chart Lines

| Line           | Style                  | Description                                       |
|----------------|------------------------|---------------------------------------------------|
| Ideal          | Dashed, border-default | Straight diagonal from total stories to zero       |
| Actual         | Solid green, 2px       | Cumulative remaining stories per day               |
| Forecast       | Dashed orange, 1.5px   | Projection from last actual point to zero remaining |

The actual line uses green data point circles (radius 3) at each day. The forecast line only renders when `currentVelocity > 0` and `remainingStories > 0`.

### Bounce Handling

The chart uses a ground-truth `doneCount` from the tracker to cap cumulative completions. This prevents stories that bounce between done and reopened from inflating the count.

### PaceBadge

A small inline badge displayed in the chart footer:

| Pace      | Background    | Text Color  |
|-----------|---------------|-------------|
| `ahead`   | green-900/30  | green-400   |
| `on-pace` | yellow-900/30 | yellow-400  |
| `behind`  | red-900/30    | red-400     |
| `no-data` | zinc-800      | muted       |

### Footer

The footer row shows:
- Stories remaining count (left).
- Pace badge, estimated completion date, and completed count (right).
- A yellow asterisk (`*`) appears beside the estimated date when `confidence < 0.3`.

### SVG Dimensions

- Viewbox: 400 x 150
- Max rendered width: 500px
- Padding: top 20, right 20, bottom 30, left 40

### Data Fetching

- **Velocity endpoint**: `GET /api/sprint/{project}/velocity` (required)
- **Forecast endpoint**: `GET /api/sprint/{project}/forecast` (supplementary)
- **Interval**: 30 seconds

---

## Cycle Time Chart

**Component**: `packages/web/src/components/CycleTimeChart.tsx`

Displays cycle time analytics with stat cards and a horizontal bar chart of average column dwell times.

### Stat Cards

A 4-column grid showing:

| Card           | Value Format             |
|----------------|--------------------------|
| Avg Cycle Time | Duration (e.g., `2d 5h`) |
| Median         | Duration                 |
| Throughput     | `{n}/day`                |
| Completed      | Integer count            |

Duration formatting follows: days+hours if >= 1 day, hours+minutes if >= 1 hour, otherwise minutes only.

### Column Dwell Bar Chart

A horizontal SVG bar chart where each row represents a column (e.g., backlog, ready-for-dev, in-progress, review, done). Bar width is proportional to dwell time relative to the maximum dwell.

- **Bottleneck column**: highlighted in error color (red) with bold label text and 0.8 opacity. The duration label includes "(bottleneck)".
- **Normal columns**: rendered in accent color at 0.6 opacity.

### SVG Dimensions

- Bar height: 24px, gap: 6px
- Label width: 110px, chart width: 300px
- Total width: 490px (label + chart + 80px for duration labels)
- Max rendered width: 600px

### Data Fetching

- **Endpoint**: `GET /api/sprint/{project}/metrics`
- **Interval**: 30 seconds
- **Response shape**: `CycleTimeStats` with averages, median, throughput, dwell array, and bottleneck column

---

## Epic Progress

**Component**: `packages/web/src/components/EpicProgress.tsx`

Renders per-epic completion summaries as clickable filter buttons.

### Epic Cards

Each epic is a full-width button showing:

- **Label row**: Epic ID (mono-spaced) with optional title, plus `{done}/{total} stories ({percent}%)`.
- **Segmented progress bar**: Three-segment horizontal bar with proportional widths for done (green), in progress (blue), and open (gray).

### Filtering Behavior

- Clicking an epic sets it as the active filter. The Sprint Board then filters columns and recalculates stats for that epic only.
- Clicking the active epic again (or the "Show All" button) clears the filter.
- Inactive epics dim to 50% opacity when a filter is active.

### Legend

A row of three dot+label pairs below the epic list: Done (green), In Progress (blue), Open (gray).

### Accessibility

- Each epic button has `aria-label` and `aria-pressed`.
- The progress bar has `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- Focus-visible ring styling for keyboard navigation.

---

## Retrospective Chart

**Component**: `packages/web/src/components/RetrospectiveChart.tsx`

Displays historical sprint performance with summary cards and a vertical bar chart of weekly velocity.

### Summary Cards

A 4-column grid showing:

| Card             | Value Format                 | Notes                           |
|------------------|------------------------------|---------------------------------|
| Total Completed  | Integer                      |                                 |
| Avg Velocity     | `{n}/wk`                     | One decimal place               |
| Velocity Change  | `+/-{n}%`                    | Green if positive, red if negative |
| Avg Cycle Time   | Duration                     |                                 |

### Velocity Bar Chart

A vertical SVG bar chart with one bar per weekly period.

- **Bars**: Accent color at 0.7 opacity, 36px wide with 12px gaps.
- **Count labels**: Rendered above each bar in bold.
- **Week labels**: MM/DD date below each bar.
- **Carry-over indicator**: A warning-colored label below the week date showing `+N carry` when `carryOverCount > 0`.
- **Average velocity line**: A horizontal dashed line (warning color, 0.7 opacity) spanning the chart width, with an "avg" text label to its right.

### SVG Dimensions

- Chart height: 160px
- Label height: 40px, top padding: 20px, left padding: 30px
- Width: dynamic based on number of periods (36px bar + 12px gap each)
- Max rendered width: 700px

### Data Fetching

- **Endpoint**: `GET /api/sprint/{project}/retro`
- **Interval**: 30 seconds
- **Response shape**: `RetrospectiveResult` with periods, velocity trend, averages, and cycle time

---

## Story Timeline

**Component**: `packages/web/src/components/StoryTimeline.tsx`

A detail view for a single story, showing its status badge, metadata, transition timeline, and column dwell breakdown.

### Header

A card displaying:

- **Story ID**: as a heading.
- **Status badge**: pill-shaped with color-coded border, background, and text matching the story's current column (same color mapping as the Sprint Board).
- **Metadata row**: epic name, cycle time (for completed stories), start timestamp, and completion timestamp.

### Status Color Mapping

| Status         | Border       | Background       | Text         |
|----------------|--------------|------------------|--------------|
| `backlog`      | zinc-700     | zinc-800         | zinc-400     |
| `ready-for-dev`| yellow-700   | yellow-900/30    | yellow-400   |
| `in-progress`  | blue-700     | blue-900/30      | blue-400     |
| `review`       | purple-700   | purple-900/30    | purple-400   |
| `done`         | green-700    | green-900/30     | green-400    |

Unknown statuses fall back to zinc-600/zinc-800/zinc-400.

### Vertical Timeline

Each transition is rendered as a timeline entry with:

- A color-coded dot (11px circle, border matches the target status color).
- Timestamp formatted as `"Mon DD, HH:MM"` (24-hour, en-US locale).
- Dwell duration in the previous status (e.g., "after 2h 15m").
- Transition text showing `fromStatus -> toStatus` with both sides color-coded.

A 1px vertical line connects the dots.

### Column Dwell Summary

Below the timeline, a set of horizontal progress bars showing time spent in each column. Bar width is proportional to the column with the longest dwell. Each row shows the column name (color-coded), a filled bar, and the formatted duration.

### Data Fetching

- **Endpoint**: `GET /api/sprint/{project}/story/{storyId}`
- **Interval**: 30 seconds
- **Response shape**: `StoryDetail` with transitions, column dwells, cycle time, and completion info

---

## API Routes Reference

All routes are under `packages/web/src/app/api/sprint/[project]/`. Every route is a `GET` handler that loads the project config via `getServices()`, validates the project exists and has a tracker configured, then delegates to the appropriate `@composio/ao-plugin-tracker-bmad` function.

| Path                                      | Method | BMad Function Called   | Response Shape                                                                                                    |
|-------------------------------------------|--------|------------------------|-------------------------------------------------------------------------------------------------------------------|
| `/api/sprint/{project}`                   | GET    | `getBmadStatus`, `categorizeStatus`, `readEpicTitle` | `{ projectId, projectName, columns, columnOrder, epics[], stats: { total, done, inProgress, open } }` |
| `/api/sprint/{project}/health`            | GET    | `computeSprintHealth`  | `{ overall, indicators[], stuckStories[], wipColumns[] }`                                                         |
| `/api/sprint/{project}/forecast`          | GET    | `computeForecast`      | `{ projectedCompletionDate, daysRemaining, pace, confidence, currentVelocity, requiredVelocity, remainingStories, totalStories, completedStories }` |
| `/api/sprint/{project}/metrics`           | GET    | `computeCycleTime`     | `{ averageCycleTimeMs, medianCycleTimeMs, throughputPerDay, throughputPerWeek, completedCount, averageColumnDwells[], bottleneckColumn }` |
| `/api/sprint/{project}/retro`             | GET    | `computeRetrospective` | `{ periods[], velocityTrend[], averageVelocity, velocityChange, totalCompleted, overallAverageCycleTimeMs }`       |
| `/api/sprint/{project}/story/{id}`        | GET    | `getStoryDetail`       | `{ storyId, currentStatus, epic, transitions[], columnDwells[], totalCycleTimeMs, startedAt, completedAt, isCompleted }` |
| `/api/sprint/{project}/velocity`          | GET    | `readHistory`, `getBmadStatus`, `categorizeStatus` | `{ entries[], dailyCompletions[], totalStories, doneCount }`                                     |
| `/api/sprint/{project}/story/create`      | POST   | `tracker.createIssue`         | `Issue` (201 on success)                                                                          |

### Story Creation Endpoint

`POST /api/sprint/{project}/story/create` creates a new story in the BMad tracker.

**Request body** (JSON):

```json
{
  "title": "Implement user notifications",
  "description": "Optional story description",
  "epic": "epic-auth"
}
```

| Field         | Type     | Required | Description                            |
|---------------|----------|----------|----------------------------------------|
| `title`       | `string` | Yes      | Story title (used as H1 in markdown)   |
| `description` | `string` | No       | Story description body                 |
| `epic`        | `string` | No       | Epic identifier (e.g., `epic-auth`)    |

**Response** (201):

```json
{
  "id": "s6",
  "title": "Implement user notifications",
  "description": "# Implement user notifications\n\n...",
  "url": "file:///path/to/story-s6.md",
  "state": "open",
  "labels": ["epic-auth", "backlog"]
}
```

**Error responses:**
- **400**: Missing/empty title, invalid request body, tracker doesn't support creation, non-bmad tracker
- **404**: Project not found
- **500**: Internal error during creation

### Error Handling

All routes follow the same pattern:

- **404**: returned when the project is not found in config, the tracker is not configured, or the tracker plugin is missing.
- **500**: returned when an unexpected error occurs; the error message is included in the JSON response body.
- **Empty defaults**: routes for health, forecast, metrics, retro, and story detail return safe empty-state objects when the tracker plugin is not `bmad`, rather than returning an error.

### Velocity Route Details

The velocity route (`/velocity`) is the most complex. It:

1. Reads the full BMad history log via `readHistory(project)`.
2. Computes daily completions by grouping `done` transitions per day, deduplicating by story ID (a story bouncing done-reopened-done counts once per day).
3. Queries the tracker via `listIssues` for ground-truth `totalStories` and `doneCount`.
4. Returns the last 100 history entries along with the daily completions.

---

## Architecture

### Server-Side Data Flow

```
API Route Handler
  --> getServices()          // Singleton: loads config, builds plugin registry, session manager
    --> config.projects[id]  // Project lookup from agent-orchestrator.yaml
    --> registry.get()       // Plugin instance from registry
    --> tracker-bmad fn()    // Pure computation: computeSprintHealth, computeForecast, etc.
  --> NextResponse.json()    // Serialized JSON response
```

`getServices()` is a singleton that initializes once per server process. It loads `agent-orchestrator.yaml`, builds the plugin registry, and creates the session manager. All subsequent API calls reuse this instance.

### Client-Side Data Flow

```
"use client" Component
  --> useEffect()
    --> fetch("/api/sprint/{project}/...")
    --> setData(response)
    --> setInterval(fetch, 30_000)      // Poll every 30 seconds
  --> cleanup: cancelled = true, clearInterval
```

Every component follows an identical fetching pattern:

1. A `cancelled` boolean prevents state updates after the effect is cleaned up.
2. An `initialLoad` flag ensures the loading spinner only shows on the first fetch.
3. `setInterval` re-fetches every 30 seconds for live updates.
4. The cleanup function sets `cancelled = true` and clears the interval.

### Component Hierarchy

```
SprintBoard
  +-- HealthIndicators           (fetches /health)
  +-- Progress Bar               (computed from SprintData.stats)
  +-- EpicProgress               (data passed from SprintBoard)
  +-- Kanban Columns x5          (data passed from SprintBoard)
  |     +-- Story Cards
  +-- BurndownChart (collapsible)
  |     +-- PaceBadge            (fetches /velocity + /forecast)
  +-- CycleTimeChart (collapsible)
  |     +-- Stat Cards           (fetches /metrics)
  |     +-- Column Dwell Bars

StoryTimeline                    (standalone, fetches /story/{id})
  +-- Header + Status Badge
  +-- Transition Timeline
  +-- Column Dwell Bars

RetrospectiveChart               (standalone, fetches /retro)
  +-- Summary Stat Cards
  +-- Weekly Velocity Bars
```

### Key Design Decisions

1. **No shared state management**: Each component fetches its own data independently. There is no Redux, Zustand, or React Context for sprint data. This keeps components self-contained and independently mountable.

2. **Polling over WebSockets**: 30-second polling intervals are sufficient for a local development tool and avoid the complexity of maintaining WebSocket connections.

3. **Non-fatal supplementary fetches**: Health and forecast data are supplementary. If their endpoints fail, the component either renders nothing (health) or omits the forecast line (burndown). The board remains usable.

4. **SVG over charting libraries**: All charts are hand-drawn SVG. This avoids additional dependencies and keeps bundle size minimal. Charts are responsive via `viewBox` and percentage-based widths.

5. **Plugin-agnostic route layer**: API routes check for the `bmad` tracker plugin and return empty defaults for other trackers. This allows the dashboard to degrade gracefully if a different tracker is configured.

6. **Ground-truth done count**: The velocity and burndown components use the tracker's current `doneCount` (from `listIssues`) rather than summing history entries, preventing stories that bounce between statuses from inflating completion numbers.
