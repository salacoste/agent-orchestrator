---
title: Scenario Comparison
nav_order: 4
parent: Web Dashboard
description: Scenario creation, what-if parameters, Monte Carlo simulation, forecast histogram, side-by-side comparison, sprint retrospective, velocity comparison, and rework analysis
---

# Scenario Comparison

The scenario comparison system provides what-if analysis for sprint planning. Create scenarios with different agent counts and capacity limits, run Monte Carlo simulations, compare outcomes side-by-side, and apply the best configuration to production. The system also includes Monte Carlo forecasting with configurable parameters, sprint retrospective charts, velocity comparison tables, and rework analysis.

{: .highlight }
Scenarios use a **state machine lifecycle**: `draft` → `simulated` → `applied`. Only `draft` scenarios can be edited or simulated. Only `simulated` scenarios can be applied to production. All state transitions are enforced by HTTP 409 responses.

## Overview

The scenario system spans three pages:

| Route | Component | Rendering | Description |
|-------|-----------|-----------|-------------|
| `/scenarios` | `ScenariosPage` → `ScenariosView` | Server component | Scenario listing, creation, and compare selection |
| `/scenarios/[id]` | `ScenarioDetailPage` → `ScenarioDetail` | Server component | Parameter editing, simulation, apply-to-production |
| `/scenarios/compare?ids=...` | `ScenarioComparePage` → `ScenarioComparisonView` | Server component | Side-by-side ranked comparison of 2–4 scenarios |

All page routes are server components (`export const dynamic = "force-dynamic"`) that load initial data and pass it to client components. The listing page loads `ScenarioProjectInfo[]` from config/tracker and `WhatIfScenario[]` from the scenario store. The detail page loads the scenario by ID and derives `defaultAgentCount` from `Object.keys(config.projects).length`.

## Scenario Lifecycle

Scenarios progress through three states with strict transition rules:

```
[draft] --PATCH params--> [draft]
[draft] --POST simulate--> [simulated]
[simulated] --POST apply--> [applied]
```

| Transition | Endpoint | Enforcement |
|------------|----------|-------------|
| Edit parameters | `PATCH /api/scenarios/[id]` | Returns 409 if status ≠ `"draft"` |
| Run simulation | `POST /api/scenarios/[id]/simulate` | Returns 409 if status ≠ `"draft"` |
| Apply to production | `POST /api/scenarios/[id]/apply` | Returns 409 if status ≠ `"simulated"` |
| Delete (any state) | `DELETE /api/scenarios/[id]` | No state restriction |

When a scenario is created (`POST /api/scenarios`), it captures a snapshot of current story state from the selected projects. Only entries matching the story key pattern `/^\d+[a-z]*-\d+-/` are included — epics and retrospectives are excluded.

## Scenario Listing & Creation

The listing page (`packages/web/src/components/ScenariosView.tsx`) renders a responsive grid (1/2/3 columns at md/lg breakpoints) of scenario cards, plus a creation form.

**ScenarioCard** (`packages/web/src/components/ScenarioCard.tsx`) displays:
- Scenario name and status badge (Draft/Simulated/Applied with color coding)
- Creation date and last modified time (via `relativeTime()`: "Xd ago", "Xh ago", "just now")
- Project count and captured story count
- Open and Delete action buttons

**ScenarioCreator** (`packages/web/src/components/ScenarioCreator.tsx`) provides:
- Name input (required, non-empty after trim)
- Project multi-select with Select All / Deselect All, showing per-project story counts (total, done, in-progress, backlog)
- Validation: name required, at least 1 project selected

**Compare toolbar** appears when simulated scenarios exist. Users select 2–4 scenarios via checkboxes, then click "Compare Selected" to navigate to `/scenarios/compare?ids=...`.

## Parameter Editor

The detail page (`packages/web/src/components/ScenarioDetail.tsx`) provides a parameter editor available only when `scenario.status === "draft"`:

**Agent Count** — stepper with −/+/input, range 1–50 (`MIN_AGENT_COUNT` to `MAX_AGENT_COUNT`).

**Capacity Limit** — stepper with −/+/input, range 1–20 (`MIN_CAPACITY` to `MAX_CAPACITY`).

**Story Priority List** — tri-state buttons (High/Medium/Low) per captured story. Color coding: high = error red, low = muted gray, medium = accent color. Default priority at creation is "medium".

Validation rules (from `packages/web/src/lib/scenario-params.ts`):
- Agent count: integer, min 1, max 50
- Capacity limit: integer, min 1, max 20
- Story priorities: no duplicate `storyId`, valid values (`"high"`, `"medium"`, `"low"`), each `storyId` must exist in scenario

A lock notice banner displays when the scenario is no longer in draft state: "Parameters cannot be edited — scenario has been {status}."

## Modification Summary

The detail page computes a diff of unsaved parameter changes using `computeParameterDiff()`:

| Diff Field | Type | Description |
|------------|------|-------------|
| `agentCount` | `{ original, modified } \| null` | Change in agent count |
| `capacityLimit` | `{ original, modified } \| null` | Change in capacity limit |
| `priorityChanges` | `StoryPriorityOverride[]` | Stories with changed priority |
| `hasChanges` | `boolean` | Whether any parameter differs |

The modification summary section shows the delta for agent count and capacity, plus the count of reprioritized stories. A `beforeunload` listener prevents accidental navigation when unsaved changes exist.

## Monte Carlo Simulation

The "Run Simulation" button triggers the simulation pipeline (`packages/web/src/app/api/scenarios/[id]/simulate/route.ts`):

1. **Build input** — `buildSimulationInput()` maps stories to `SimStory[]`, sorts by priority (high=0, medium=1, low=2), sets iterations to 1000
2. **Run engine** — `simulateSprint()` from `@composio/ao-core` runs the Monte Carlo simulation using a seeded LCG random number generator, sampling story durations from historical learning data matching domain tags
3. **Scale parallelism** — `applyParallelismScaling()` divides day predictions by `agentCount * capacityLimit`, clamping to minimum 1 day
4. **Store result** — transitions status to `"simulated"`, stores `SimulationResult`
5. **Color indicator** — `getSimulationColor()` maps `onTimeProbability` to green/amber/red

The button is disabled when:
- Unsaved parameter changes exist
- No parameters have been saved yet
- The scenario is not in draft state

**Result display** shows:
- Three-column grid: P50 days, P80 days, P95 days
- On-time probability with color coding (green >80%, amber 50–80%, red <50%)
- Confidence label (High ≥0.8, Medium ≥0.5, Low <0.5)
- Iteration count: "Based on N simulations"

The core Monte Carlo engine (`packages/core/src/sprint-simulator.ts`) is a pure function:
- Default story duration: 4 hours (when no matching learnings exist)
- Pre-computes matching completed learnings per story by domain tag overlap
- For each iteration: samples a duration for each story from matching learnings
- Sorts totals, computes p50/p80/p95 day percentiles
- Confidence = ratio of stories with matching historical data

## Monte Carlo Forecast

`MonteCarloChart` (`packages/web/src/components/MonteCarloChart.tsx`) renders an SVG histogram of completion date probabilities for a project's sprint forecast.

**Stat cards** show P50/P80/P95 dates (configurable) and average daily rate. Column count adapts: 4 columns when all three confidence levels active, 3 for two, 2 for one.

**SVG histogram** with:
- Bar width: `Math.max(12, Math.min(28, 500 / buckets.length))` — scales inversely with bucket count
- Hover tooltips showing date, probability %, and cumulative %
- Percentile vertical dashed lines: P50 green (`var(--color-status-done)`), P80 yellow (`var(--color-status-warning)`), P95 red (`var(--color-status-error)`)
- Date labels rotated -30 degrees, shown every `Math.max(1, Math.floor(buckets.length / 8))` bars

**Linear comparison** section shows the linear projection date and confidence percentage (when `data.linearCompletionDate` is present).

**Forecast calibration** section displays when `data.calibration` exists:
- P50/P80/P95 hit rates and accuracy percentages
- Bias indicator: Optimistic (>0.5), Pessimistic (<0.5), Neutral (0.5)

**API endpoint:** `GET /api/sprint/{project}/monte-carlo` with query parameters:
- `simulations` — clamped to [1000, 100000]
- `throughputWindowDays` — clamped to [0, 365], 0 = all available
- `excludeWeekends` — default `true`
- `confidenceLevels` — comma-separated (`"p50,p80,p95"`)
- `epic` — optional epic filter

**Real-time updates:**
- Subscribes to `/api/events` SSE for `forecast-stale` events matching the project ID
- Falls back to 30-second polling if SSE unavailable
- SSE reconnects with exponential backoff (2s → 4s → 8s cap)
- Significant forecast changes (>2 day P50 shift) trigger broadcast via `broadcastForecastChange()`
- LRU cache of last 200 project forecasts for diff detection

## Simulation Config Panel

`SimulationConfigPanel` (`packages/web/src/components/SimulationConfigPanel.tsx`) provides collapsible settings:

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Iterations | 1000–100000, step 1000 | 5000 | Number of Monte Carlo iterations |
| Confidence Levels | P50/P80/P95 checkboxes | All three | Which percentile lines to show (min 1) |
| Historical Data Window | 0–365, step 7 | 0 | Days of history to use (0 = all) |
| Exclude Weekends | Toggle | true | Whether weekends count toward cycle time |

Configuration is persisted per-project to `localStorage` under key `ao:sim-config:{projectId}` via the `useSimulationConfig` hook (`packages/web/src/lib/useSimulationConfig.ts`). Writes are debounced by 300ms. A "(modified)" badge appears when config differs from defaults. The "Reset to Defaults" button clears localStorage and restores defaults.

## Scenario Comparison View

`ScenarioComparisonView` (`packages/web/src/components/ScenarioComparisonView.tsx`) displays a side-by-side ranked comparison of 2–4 scenarios:

**Comparison table** with metric rows:

| Metric | Key | Format | Best value |
|--------|-----|--------|------------|
| p50 Days | `p50Days` | `N.N` | Lowest |
| p80 Days | `p80Days` | `N.N` | Lowest |
| p95 Days | `p95Days` | `N.N` | Lowest |
| On-Time % | `onTimeProbability` | `NN%` | Highest |
| Confidence | `confidence` | High/Medium/Low | Highest |

Best value per metric is highlighted in bold green with a unicode checkmark (✓). Each scenario column shows a color dot (green/amber/red), scenario name as a link to detail, rank number, and "Recommended" badge for rank #1.

Warnings are displayed in an amber-bordered alert box.

## Comparison Ranking Algorithm

The ranking algorithm (`packages/core/src/scenario-comparator.ts`) is a pure function:

1. Sort scenarios by `onTimeProbability` descending
2. Ties (probability difference < 0.01) broken by `storyCount` ascending (simpler scope preferred)
3. Assign rank 1-based, mark first as `isRecommended: true`
4. `recommendedIndex` points to the winner's position in the original input array

**Color mapping** (`getSimulationColor()`):
- `onTimeProbability > 0.8` → green
- `onTimeProbability >= 0.5` → amber
- `onTimeProbability < 0.5` → red

**Validation** (from `packages/web/src/app/api/scenarios/compare/route.ts`):
- Requires 2–4 unique scenario IDs
- All scenarios must exist (404 otherwise)
- No duplicate scenario names (400 with rename suggestion)
- At least 2 scenarios must have valid simulation results
- Drafts and scenarios without results are filtered out with warnings

## Sprint Comparison Table

`SprintComparisonTable` (`packages/web/src/components/SprintComparisonTable.tsx`) shows week-over-week sprint metrics for the past 6 weeks:

| Column | Source Field | Format |
|--------|-------------|--------|
| Week | `weekStart` | MM-DD |
| Velocity | `completedCount` | Integer |
| Points | `completedPoints` | Integer (conditional on `hasPoints`) |
| Cycle Time | `avgCycleTimeMs` | `Nh` or `Nd` |
| Flow Eff | `flowEfficiency` | Percentage, colored green >50%, yellow >30%, red otherwise |
| WIP | `avgWip` | Rounded integer |
| Carry | `carryOverCount` | Integer |
| Bottleneck | `bottleneckColumn` | Column name or "-" |

**Trend badges** show improving (green ↑), stable (yellow →), or declining (red ↓) for velocity, cycle time, flow efficiency, and WIP.

**API endpoint:** `GET /api/sprint/{project}/comparison?weeks=6`

## Velocity Comparison Table

`VelocityComparisonTable` (`packages/web/src/components/VelocityComparisonTable.tsx`) provides a sortable table comparing sprint velocity across projects:

| Column | Sort | Description |
|--------|------|-------------|
| Rank | By velocity | Numeric position |
| Project | Alphabetical | Project name |
| Velocity | Default desc | Stories per day (2 decimal) |
| Progress | Numeric | Completion percentage |
| Trend | — | Arrow indicator with color |

**Sort controls:** Click column headers to sort ascending/descending. Default sort is velocity descending.

**Trend indicators:**
- Improving: green triangle-up
- Declining: red triangle-down
- Stable: yellow em-dash
- Unknown: gray question mark

## Retrospective Chart

`RetrospectiveChart` (`packages/web/src/components/RetrospectiveChart.tsx`) renders a weekly velocity visualization:

**Four stat cards:**
- Total Completed
- Avg Velocity (stories/week)
- Velocity Change % (green when positive, red when negative)
- Avg Cycle Time (formatted as `Xd Xh` or `Xh Xm`)

**SVG bar chart** of weekly velocity:
- Bar width 36px, gap 12px, chart height 160px
- Average velocity dashed line in warning color
- Count labels above each bar
- Week labels (MM-DD format) below bars
- Carry-over indicators: `+N carry` in warning color

**API endpoint:** `GET /api/sprint/{project}/retro`

**Polling:** 30-second interval for live updates.

## Rework Analysis

The rework analysis component (`packages/web/src/components/ReworkChart.tsx`) tracks backward story transitions:

**Three stat cards:**
- Rework Rate (red >30%, yellow >15%, green otherwise)
- Total Events
- Total Rework Time (formatted duration)

**SVG horizontal bar chart** of rework transitions:
- Each bar shows `From → To` label, count, and average rework time
- Bar height 24px, gap 6px, chart width 500px
- Bars colored with error color

**Worst offenders list** — stories with most rework events, showing story ID, rework count, and total rework time.

**API endpoint:** `GET /api/sprint/{project}/rework`

## Persistence

Scenarios are persisted via JSONL event-sourcing (`packages/web/src/lib/scenario-persistence.ts`):

- **Storage location:** `.ao-scenarios/scenarios.jsonl`
- **Format:** Each mutation (create, update, simulate, apply, delete) appends a JSONL event
- **Init:** Events are replayed to rebuild an in-memory `Map<string, WhatIfScenario>`
- **Corrupted lines:** Silently skipped (non-fatal)
- **Revision history:** Each mutation generates a `ScenarioRevision` entry stored in-memory, tracking field-level changes with previous/current values
- **Sort order:** `updatedAt` newest first, then `createdAt`

The `ScenarioRevision` type tracks:
- `scenarioId`, `timestamp`
- `action`: "created" | "updated" | "simulated" | "applied" | "deleted"
- `changes`: array of `{ field, previous?, current }`

The scenario store (`packages/web/src/lib/scenario-store.ts`) is a thin async wrapper delegating to the persistence layer.

## API Routes

### Scenario CRUD

| Method | Endpoint | Purpose | Status Codes |
|--------|----------|---------|--------------|
| `GET` | `/api/scenarios` | List all scenarios (newest first) | 200, 500 |
| `POST` | `/api/scenarios` | Create scenario with name + projectIds | 201, 400, 500 |
| `GET` | `/api/scenarios/[id]` | Get single scenario | 200, 404 |
| `PATCH` | `/api/scenarios/[id]` | Update parameters (draft only) | 200, 400, 404, 409 |
| `DELETE` | `/api/scenarios/[id]` | Delete scenario (any state) | 200, 404 |

### Simulation & Apply

| Method | Endpoint | Purpose | Status Codes |
|--------|----------|---------|--------------|
| `POST` | `/api/scenarios/[id]/simulate` | Run Monte Carlo simulation | 200, 400, 404, 409 |
| `POST` | `/api/scenarios/[id]/apply` | Apply scenario to production | 200, 400, 404, 409 |

### Comparison & Forecast

| Method | Endpoint | Purpose | Status Codes |
|--------|----------|---------|--------------|
| `GET` | `/api/scenarios/compare?ids=...` | Compare 2–4 scenarios | 200, 400, 404 |
| `GET` | `/api/sprint/[project]/monte-carlo` | Monte Carlo forecast with config | 200, 404 |

**Key validation rules:**
- Create: name non-empty, ≥1 projectId, all IDs exist in config
- PATCH: agent count 1–50, capacity 1–20, valid priorities, no duplicate story IDs
- Simulate: parameters must be configured, agent count and capacity ≥ 1
- Compare: 2–4 IDs, no duplicate names, ≥2 with valid results

## Key Types

### WhatIfScenario

```typescript
interface WhatIfScenario {
  id: string;                          // UUID
  name: string;                        // User-provided name
  createdAt: string;                   // ISO 8601
  updatedAt?: string;                  // Updated on create/param change/simulate
  projectIds: string[];                // Included projects
  stories: ScenarioStorySnapshot[];    // Captured story state at creation
  status: "draft" | "simulated" | "applied";
  parameters?: ScenarioParameters;     // Undefined until user edits
  result?: SimulationResult;           // Undefined until simulation runs
}
```

### ScenarioParameters

```typescript
interface ScenarioParameters {
  agentCount: number;                    // 1-50
  capacityLimit: number;                 // 1-20
  storyPriorities: StoryPriorityOverride[];
}
```

### StoryPriorityOverride

```typescript
interface StoryPriorityOverride {
  storyId: string;
  originalPriority: "high" | "medium" | "low";
  newPriority: "high" | "medium" | "low";
}
```

### ScenarioStorySnapshot

```typescript
interface ScenarioStorySnapshot {
  id: string;           // Story key (e.g., "54-1-scenario-creation")
  projectId: string;
  status: string;       // Sprint status at snapshot time
  domainTags: string[]; // Domain tags for simulation matching
}
```

### SimulationResult

{: .note }
Defined in `packages/core/src/sprint-simulator.ts`, re-exported by `packages/web/src/lib/types.ts`.

```typescript
interface SimulationResult {
  p50Days: number;              // 50th percentile completion estimate
  p80Days: number;              // 80th percentile completion estimate
  p95Days: number;              // 95th percentile completion estimate
  onTimeProbability: number;   // 0-1 probability of meeting sprint deadline
  confidence: number;           // Ratio of stories with matching historical data
  iterationsRun: number;        // Number of Monte Carlo iterations executed
}
```

### Supporting Types

| Type | Values/Shape | Description |
|------|-------------|-------------|
| `SimulationColor` | `"green" \| "amber" \| "red"` | Color indicator based on on-time probability |
| `ScenarioStatus` | `"draft" \| "simulated" \| "applied"` | Scenario lifecycle state |
| `SimulationConfig` | `{ simulations, confidenceLevels[], throughputWindowDays, excludeWeekends }` | Per-project Monte Carlo config (`useSimulationConfig.ts`) |
| `ParameterDiff` | `{ agentCount \| null, capacityLimit \| null, priorityChanges[], hasChanges }` | Diff between saved and unsaved params |
| `ScenarioProjectInfo` | `{ id, name, storyCounts }` | Project info for the creator form |

## Next Steps

- [Web Dashboard Overview](./index.md) — Dashboard architecture and navigation
- [Portfolio View](./portfolio-view.md) — Cross-project portfolio dashboard
- [Sprint Board](./sprint-board.md) — Story columns, assignment, and analytics
- [Session Detail](./session-detail.md) — Individual session deep-dive view
- [Monte Carlo Simulation](../advanced/monte-carlo.md) — In-depth simulation engine documentation
- [Scenarios API](../api/scenarios.md) — Full API reference for scenario endpoints
- [Getting Started](../getting-started/index.md) — Installation and first steps
- [Configuration](../getting-started/configuration.md) — YAML configuration reference
