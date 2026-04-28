---
title: Monte Carlo Simulations
nav_order: 2
parent: Advanced Topics
description: Monte Carlo sprint simulation, probabilistic forecasting, what-if scenarios, result interpretation, parallelism scaling, and forecast change detection — two engines, config examples, and behavioral reference.
---

# Monte Carlo Simulations

Probabilistic sprint forecasting powered by historical session data. The Agent Orchestrator provides two simulation engines — a core Monte Carlo simulator for fast iteration, and a plugin-based forecaster for detailed per-project analysis. Both consume `SessionLearning` records matched by domain tags.

**Core modules:** `packages/core/src/sprint-simulator.ts`, `packages/core/src/sprint-forecaster.ts`

**Web-layer modules:** `packages/web/src/lib/scenario-simulation.ts`, `packages/web/src/lib/scenario-params.ts`, `packages/web/src/lib/useSimulationConfig.ts`, `packages/web/src/lib/forecast-change-broadcaster.ts`

**Related API docs:** [Scenarios API](../api/scenarios/)

## Two Engines

| Aspect | Core Engine | Plugin Engine |
|--------|-------------|---------------|
| Function | `simulateSprint()` | `computeMonteCarloForecast()` |
| Source | `packages/core/src/sprint-simulator.ts` | `@composio/ao-plugin-tracker-bmad` |
| Input | Stories + learnings + iterations | Stories + config (simulations, window, weekends) |
| Output | P50/P80/P95 days, probability, confidence | P50/P80/P95 days + histogram + calibration |
| API route | `GET /api/sprint/simulate` | `GET /api/sprint/{project}/monte-carlo` |
| Also used by | `POST /api/scenarios/{id}/simulate` | — |
| Seed support | Yes (deterministic) | No |
| Extras | Color coding | Forecast change detection, LRU cache |

Both engines filter `SessionLearning` records to `outcome: "completed"` and match stories to historical sessions via `domainTags`.

## Core Simulation Engine

The core engine is a pure function — no I/O, deterministic when seeded. It runs N iterations, each sampling a duration for every story from domain-matched historical data, then extracts percentile estimates.

**Source:** `packages/core/src/sprint-simulator.ts`

### Input

```typescript
interface SimStory {
  id: string;
  domainTags: string[];
}

interface SimulationInput {
  stories: SimStory[];
  learnings: SessionLearning[];
  iterations: number;
  sprintEndMs?: number;
  defaultDurationMs?: number;  // Default: 4 hours (14,400,000 ms)
  seed?: number;                // Default: Date.now()
}
```

### Output

```typescript
interface SimulationResult {
  p50Days: number;           // Median completion estimate
  p80Days: number;           // 80th percentile
  p95Days: number;           // 95th percentile
  onTimeProbability: number; // 0-1 (1 if no sprintEndMs)
  confidence: number;        // 0-1 (ratio of stories with matching data)
  iterationsRun: number;     // Actual iterations executed
}

type SimulationColor = "green" | "amber" | "red";
```

### Algorithm

1. Filter learnings to `outcome === "completed"` with valid `domainTags`
2. For each story, pre-compute matching learnings (stories with overlapping domain tags)
3. Create seeded LCG random number generator (deterministic when `seed` provided)
4. For each iteration:
   - For each story, randomly pick a duration from its matched learnings
   - If no matches, use `defaultDurationMs` (4 hours)
   - Guard zero/negative durations by substituting default
   - Sum durations across all stories → iteration total
5. Sort iteration totals ascending
6. Extract P50, P80, P95 from sorted totals (converted to days)
7. If `sprintEndMs` provided, compute on-time probability (ratio of iterations finishing before deadline)
8. Confidence = ratio of stories with at least one matching historical learning

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_DURATION_MS` | 14,400,000 (4h) | Fallback when no historical data |
| `MS_PER_DAY` | 86,400,000 (24h) | Millisecond-to-day conversion |

### Color Coding

```typescript
function getSimulationColor(onTimeProbability: number): SimulationColor {
  if (onTimeProbability > 0.8) return "green";
  if (onTimeProbability >= 0.5) return "amber";
  return "red";
}
```

| Color | Probability | Meaning |
|-------|-------------|---------|
| Green | > 80% | Likely on time |
| Amber | 50-80% | At risk |
| Red | < 50% | Unlikely to meet deadline |

### Empty Input

When `stories` is empty or `iterations` is 0/NaN/non-finite, returns zeros with `onTimeProbability: 1`, `confidence: 0`, `iterationsRun: 0`.

## Sprint Forecaster

The sprint forecaster uses percentile analysis of historical session durations rather than full Monte Carlo iteration. It provides a faster estimate with explicit confidence levels.

**Source:** `packages/core/src/sprint-forecaster.ts`

### Input

```typescript
interface BacklogStory {
  storyId: string;
  domainTags?: string[];
}
```

### Output

```typescript
type ConfidenceLevel = "high" | "medium" | "low" | "insufficient";

interface SprintForecast {
  p50Ms: number;              // Median total remaining (ms)
  p80Ms: number;              // 80th percentile (ms)
  p95Ms: number;              // 95th percentile (ms)
  backlogCount: number;       // Stories used in forecast
  sampleCount: number;        // Historical samples
  confidence: ConfidenceLevel;
  p50Date: string;            // ISO date: now + p50Ms
  p80Date: string;
  p95Date: string;
}
```

### Algorithm

1. Filter learnings to `outcome === "completed"` with `durationMs > 0`
2. For each backlog story:
   - Find sessions with overlapping domain tags
   - If fewer than 3 domain matches, fall back to all completed sessions
   - Sort matched durations, pick actual P50/P80/P95 values
   - If no completed sessions, use `defaultDurationMs` (2 hours)
3. Sum per-story percentiles across all stories
4. Convert to dates (`Date.now() + totalMs`)

### Confidence Levels

| Level | Sample Count | Meaning |
|-------|-------------|---------|
| `high` | ≥ 20 | Reliable estimates |
| `medium` | ≥ 10 | Reasonable estimates |
| `low` | ≥ 5 | Use with caution |
| `insufficient` | < 5 | Not enough data |

Default duration when no historical data: **2 hours** (7,200,000 ms).

## What-If Scenario System

Create sandboxed copies of current sprint state for experimentation. Adjust parameters, run simulations, compare results, then apply the best option.

**Source:** `packages/web/src/lib/scenario-simulation.ts`, `packages/web/src/lib/scenario-params.ts`, `packages/web/src/lib/scenario-snapshot.ts`, `packages/web/src/lib/scenario-comparison.ts`

### Lifecycle

Scenarios follow a strict 3-state machine:

```
POST /api/scenarios       → draft
PATCH /api/scenarios/{id} → draft (parameters only)
POST .../simulate         → simulated (has result, no longer editable)
POST .../apply            → applied (committed to production)
```

| State | Editable | Has Result | Transitions |
|-------|----------|------------|-------------|
| `draft` | Yes (parameters) | No | → `simulated` |
| `simulated` | No | Yes | → `applied` |
| `applied` | No | Yes | Terminal |

### Scenario Structure

```typescript
interface WhatIfScenario {
  id: string;                          // crypto.randomUUID()
  name: string;                        // User-provided
  createdAt: string;                   // ISO 8601
  updatedAt?: string;                  // Updated on changes
  projectIds: string[];                // Included projects
  stories: ScenarioStorySnapshot[];    // Captured at creation
  status: ScenarioStatus;              // "draft" | "simulated" | "applied"
  parameters?: ScenarioParameters;     // Undefined until user edits
  result?: SimulationResult;           // Undefined until simulated
}
```

### Parameters

```typescript
interface ScenarioParameters {
  agentCount: number;              // 1-50
  capacityLimit: number;           // 1-20
  storyPriorities: StoryPriorityOverride[];
}

interface StoryPriorityOverride {
  storyId: string;
  originalPriority: StoryPriority;  // "high" | "medium" | "low"
  newPriority: StoryPriority;
}
```

### Parameter Validation

| Parameter | Min | Max | Type |
|-----------|-----|-----|------|
| `agentCount` | 1 | 50 | integer |
| `capacityLimit` | 1 | 20 | integer |
| `storyPriorities` | 0 | n | array (unique story IDs, valid priorities) |

### Snapshot Capture

`captureScenarioSnapshot()` reads sprint status, filters to `X-Y-name` pattern entries (skips epics/retrospectives), and captures each story's ID, project, status, and domain tags.

### Parallelism Scaling

After simulation, day-based predictions are divided by effective concurrency:

```typescript
effectiveConcurrency = agentCount × capacityLimit
scaledDays = Math.max(1, rawDays / effectiveConcurrency)
```

The `Math.max(1, ...)` clamp prevents sub-day predictions regardless of parallelism.

### Scenario Comparison

`GET /api/scenarios/compare?ids=id1,id2,id3,id4` accepts 2-4 scenario IDs. Scenarios without results or in `draft` status are excluded. Results are ranked by the core `compareScenarios()` function.

## Simulation Parameters

### Core Engine Parameters

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `iterations` | number | 1000* | 1-10,000 | Number of Monte Carlo runs |
| `sprintEndMs` | number | — | any | Optional deadline for on-time probability |
| `defaultDurationMs` | number | 14,400,000 | any | Fallback per-story duration (4h) |
| `seed` | number | `Date.now()` | any | RNG seed (deterministic if provided) |

{\*star\} The core `simulateSprint()` function requires `iterations` — no function-level default. The value 1000 is the default applied by the API route (`GET /api/sprint/simulate`) and the scenario builder (`DEFAULT_ITERATIONS`). API clamps to 1-10,000.

### Plugin Engine Parameters

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `simulations` | number | 5000 | 1,000-100,000 | Monte Carlo iterations |
| `throughputWindowDays` | number | 0 | 0-365 | Historical data window |
| `excludeWeekends` | boolean | true | — | Skip weekends in forecast |
| `confidenceLevels` | string[] | `["p50","p80","p95"]` | — | Which percentiles to return |

{: .note}
> The plugin engine defaults to 5,000 iterations for higher precision. The what-if scenario builder uses 1,000 (`DEFAULT_ITERATIONS`) to keep interactive scenario comparison fast. Both defaults can be overridden.

### Per-Project Configuration

The dashboard stores per-project simulation config in `localStorage`:

```typescript
interface SimulationConfig {
  simulations: number;           // Default: 5000
  confidenceLevels: string[];    // Default: ["p50", "p80", "p95"]
  throughputWindowDays: number;  // Default: 0 (unlimited)
  excludeWeekends: boolean;      // Default: true
}
```

Storage key format: `ao:sim-config:{projectId}`. Config changes are debounced (300ms).

## Result Interpretation

### Percentiles

| Percentile | Meaning | Use Case |
|------------|---------|----------|
| P50 (median) | 50% chance of completing within this time | Optimistic planning |
| P80 | 80% chance | Balanced planning |
| P95 | 95% chance | Conservative planning, risk management |

### On-Time Probability

When `sprintEndMs` is provided, the engine counts how many iterations complete before the deadline:

```
onTimeProbability = iterationsFinishingBeforeDeadline / totalIterations
```

Without a deadline, `onTimeProbability` defaults to `1`.

### Confidence Score

The confidence score measures data quality, not timeline confidence:

```
confidence = storiesWithMatchingHistoricalData / totalStories
```

- **1.0** — Every story has domain-matched historical data
- **0.5** — Half the stories lack historical data (using defaults)
- **0.0** — No historical data at all (all defaults)

Low confidence means predictions rely heavily on the 4-hour default duration rather than actual observations.

### Interpretation Guide

| Scenario | Probability | Confidence | Action |
|----------|-------------|------------|--------|
| Green + high conf | > 80% | > 0.8 | Proceed confidently |
| Green + low conf | > 80% | < 0.5 | Probability looks good but data is thin — gather more history |
| Amber + high conf | 50-80% | > 0.8 | At risk — consider scope reduction or more agents |
| Amber + low conf | 50-80% | < 0.5 | Uncertain — treat as directional, not definitive |
| Red + any conf | < 50% | any | Unlikely to meet deadline — re-plan or extend |

## Forecast Change Detection

The Monte Carlo API route monitors for significant forecast shifts and broadcasts changes via Server-Sent Events.

**Source:** `packages/web/src/lib/forecast-change-broadcaster.ts`

### Detection

- LRU cache stores the last forecast per project (200 entries)
- When a new forecast is computed, P50 is compared to the cached value
- A shift of **more than 2 days** triggers a broadcast

### SSE Broadcast

```typescript
broadcastForecastChange(projectId, diff, newP50);
```

Subscribers receive `(projectId, ForecastDiff, newP50)`. The SSE events route subscribes and forwards to connected clients. Listener errors are caught to prevent fan-out failures.

### Forecast Log

Forecast snapshots are appended to a JSONL log alongside the project's scenario data. Each entry records the project ID, simulation parameters, percentile results, and timestamp. This enables trend analysis across successive forecasts.

## Session Learning Integration

Both simulation engines consume `SessionLearning` records from the learning store.

**Source:** `packages/core/src/types.ts`

### SessionLearning

```typescript
interface SessionLearning {
  sessionId: string;
  agentId: string;
  storyId: string;
  projectId: string;
  outcome: "completed" | "failed" | "blocked" | "abandoned";
  durationMs: number;
  retryCount: number;
  filesModified: string[];
  testsAdded: number;
  errorCategories: string[];
  domainTags: string[];
  completedAt: string;
  capturedAt: string;
}
```

### Data Flow

1. Agent sessions produce `SessionLearning` records on completion
2. Simulation engines filter to `outcome: "completed"` only
3. Stories are matched to historical sessions via `domainTags` overlap
4. The forecaster also requires `durationMs > 0`
5. When fewer than 3 domain matches exist, the forecaster falls back to all completed sessions
6. If no historical data exists, default durations are used (4h core, 2h forecaster)

### Domain Tags

`domainTags` are arrays of strings inferred from file extensions (e.g., `["typescript", "react"]`). Stories with overlapping tags to historical sessions get more accurate predictions.

## API Endpoints

Simulation features are exposed through these API routes. See the linked API docs for full request/response details.

### Simulation

| Method | Endpoint | Engine | Description | Docs |
|--------|----------|--------|-------------|------|
| GET | `/api/sprint/simulate` | Core | Cross-project simulation | [Scenarios API](../api/scenarios/) |
| GET | `/api/sprint/{project}/monte-carlo` | Plugin | Per-project forecast | [Scenarios API](../api/scenarios/) |

### What-If Scenarios

| Method | Endpoint | Description | Docs |
|--------|----------|-------------|------|
| POST | `/api/scenarios` | Create scenario | [Scenarios API](../api/scenarios/) |
| PATCH | `/api/scenarios/{id}` | Update parameters (draft only) | [Scenarios API](../api/scenarios/) |
| POST | `/api/scenarios/{id}/simulate` | Run Monte Carlo on scenario | [Scenarios API](../api/scenarios/) |
| GET | `/api/scenarios/compare` | Compare 2-4 scenarios | [Scenarios API](../api/scenarios/) |
| POST | `/api/scenarios/{id}/apply` | Apply to production | [Scenarios API](../api/scenarios/) |

## Config Examples

### Basic Simulation via API

Run a cross-project Monte Carlo simulation with 2000 iterations:

```bash
# Cross-project simulation (core engine)
curl "http://localhost:3000/api/sprint/simulate?iterations=2000"
```

Response:

```json
{
  "p50Days": 3.2,
  "p80Days": 5.1,
  "p95Days": 7.8,
  "onTimeProbability": 0.72,
  "confidence": 0.85,
  "iterationsRun": 2000
}
```

Interpretation: 85% of stories have historical data. 72% of iterations complete before the deadline. Color: **amber**.

### Per-Project Forecast

```bash
# Per-project Monte Carlo (plugin engine)
curl "http://localhost:3000/api/sprint/my-project/monte-carlo?simulations=5000&excludeWeekends=true"
```

### Scenario Workflow

Complete what-if workflow — create, configure, simulate, compare, apply:

```bash
# 1. Create a scenario
curl -X POST http://localhost:3000/api/scenarios \
  -H "Content-Type: application/json" \
  -d '{"name": "Sprint with 3 agents", "projectIds": ["my-project"]}'

# 2. Update parameters (draft status only)
curl -X PATCH http://localhost:3000/api/scenarios/{id} \
  -H "Content-Type: application/json" \
  -d '{"agentCount": 3, "capacityLimit": 2, "storyPriorities": []}'

# 3. Run simulation
curl -X POST http://localhost:3000/api/scenarios/{id}/simulate

# 4. Compare scenarios
curl "http://localhost:3000/api/scenarios/compare?ids=id1,id2"

# 5. Apply the winner
curl -X POST http://localhost:3000/api/scenarios/{id}/apply
```

### Per-Project Simulation Config

The dashboard stores per-project config in localStorage. Default values:

```json
{
  "simulations": 5000,
  "confidenceLevels": ["p50", "p80", "p95"],
  "throughputWindowDays": 0,
  "excludeWeekends": true
}
```

Storage key: `ao:sim-config:{projectId}`. Changes are debounced at 300ms.

---

- **Parent** — [Advanced Topics](.)
- **Siblings** — [Cross-Project Orchestration](cross-project/), [Custom Plugin Development](custom-plugins/), [Hooks & Extensions](hooks-extensions/), [Prompt Layers](prompt-layers/), [Production Deployment](production-deployment/)
- **API Reference** — [Scenarios API](../api/scenarios/)
- **Getting Started** — [Installation](../getting-started/installation/), [Quick Start](../getting-started/quick-start/)
- **Configuration** — [Configuration Reference](../getting-started/configuration/)
