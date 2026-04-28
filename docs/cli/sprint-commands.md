---
title: Sprint Commands
nav_order: 3
parent: CLI Reference
description: Sprint lifecycle management — view progress, start/end sprints, generate plans, track velocity, and plan upcoming work.
---

# Sprint Commands

7 commands for managing the sprint lifecycle: view progress, start and end sprints, generate execution plans, track velocity, and plan upcoming work.

## Command Summary

| Command | Description | `--json` | bmad Required |
|---------|-------------|----------|---------------|
| `ao sprint [project]` | Show sprint progress — stories grouped by status column | Yes | Conditional (additive) |
| `ao sprint-start [project]` | Start a new sprint — set dates, goal, and target velocity | Yes | No |
| `ao sprint-end [project]` | End a sprint — generate final metrics report | Yes | Yes |
| `ao sprint-summary [project]` | Show a single-screen sprint summary with key metrics | Yes | Yes |
| `ao sprint-plan` | Generate sprint execution plan from sprint-status.yaml | No | No (YAML only) |
| `ao velocity [project]` | Show weekly velocity history with trend analysis | Yes | Yes |
| `ao plan [project]` | Show sprint planning — recommended stories, capacity, and blockers | Yes | Conditional (two paths) |

{: .highlight }
**Tracker requirements:** `sprint-end`, `sprint-summary`, and `velocity` require the bmad tracker plugin. `sprint` and `plan` have optional bmad features (non-fatal if unavailable). `sprint-start` and `sprint-plan` work without any tracker.

---

## ao sprint

```bash
ao sprint [project]
```

Show sprint progress — stories grouped by status column. Displays a progress bar, column-based story listing, session cross-reference, and (with bmad tracker) dependency graph, WIP limits, and forecast.

### Flags

| Flag | Description |
|------|-------------|
| `--compact` | Show only column counts |
| `--json` | Output as JSON |

### Output

The command displays a `header()` box with `Sprint Progress: <project>`, followed by:

1. **Progress bar** — `[████████████░░░░░░░░] 12/20 stories` using green `█` and dim `░`
2. **Forecast line** (bmad only) — days remaining, projected date, pace (`ahead`, `on-pace`, `behind`), and velocity
3. **Blocked count** — shown in red if any stories are blocked
4. **Column listing** — stories grouped by status column:

| Column | Color |
|--------|-------|
| done | green |
| in-progress | cyan |
| review | blue |
| ready-for-dev | yellow |
| backlog | dim |

With `--compact`, only column headers and counts are shown (no individual stories).

### Bmad-Only Features

When the bmad tracker is configured, `ao sprint` adds:

- **Dependency graph** — `⊘ blocked by: <deps>` shown next to blocked stories
- **WIP limits** — `(3/5)` shown after column name; turns red when at limit
- **Forecast** — days remaining, projected completion date, current velocity
- **Session info** — `← session-id (activity)` shown next to stories with active sessions

These features are non-fatal if unavailable.

### Examples

```bash
# Show sprint progress for default project
ao sprint

# Show compact view (counts only)
ao sprint --compact

# Show sprint for specific project
ao sprint my-project

# JSON output for scripting
ao sprint --json | jq '.blockedCount'
```

### JSON Output Shape

```json
{
  "projectId": "string",
  "totalStories": 20,
  "doneCount": 12,
  "inProgressCount": 3,
  "openCount": 5,
  "blockedCount": 1,
  "columns": {
    "done": [
      { "id": "62-1-title", "title": "Story Title", "sessionInfo": null }
    ],
    "in-progress": [
      { "id": "62-5-title", "title": "Story", "sessionInfo": "sess-1 (active)", "blockedBy": ["62-3-title"] }
    ]
  },
  "wipStatus": { "in-progress": { "current": 3, "limit": 5 } },
  "forecast": { "pace": "on-pace", "daysRemaining": 5 }
}
```

---

## ao sprint-start

```bash
ao sprint-start [project]
```

Start a new sprint — set dates, goal, and target velocity. Writes directly to `agent-orchestrator.yaml` via `readFileSync`/`writeFileSync`.

### Flags

| Flag | Description |
|------|-------------|
| `--goal <text>` | Sprint goal |
| `--velocity <n>` | Target velocity (stories/sprint) |
| `--start-date <date>` | Sprint start date (YYYY-MM-DD, defaults to today) |
| `--end-date <date>` | Sprint end date (YYYY-MM-DD) |
| `--sprint-number <n>` | Sprint number (auto-increments if not set) |
| `--json` | Output as JSON |

### Date Validation

Dates must match `YYYY-MM-DD` format. Invalid format produces: `Invalid <start|end> date format. Use YYYY-MM-DD.` and exits with code 1. Invalid date values produce: `Invalid <start|end> date.`

### Auto-Increment

If `--sprint-number` is not provided, the command reads the current `sprintNumber` from config (defaulting to 0) and increments by 1.

### Output

Displays a `header()` box with `Sprint Started: <project>`, followed by:

- Sprint number
- Goal (if provided)
- Start date
- End date (if provided)
- Target velocity (if provided)

### Examples

```bash
# Start sprint with goal and dates
ao sprint-start --goal "Ship portfolio dashboard" --start-date 2026-04-21 --end-date 2026-05-02

# Start sprint with velocity target (auto-increments sprint number)
ao sprint-start --velocity 8

# Explicit sprint number
ao sprint-start --sprint-number 5 --goal "Documentation sprint"

# JSON output
ao sprint-start --json --goal "Ship v1.0"
```

### JSON Output Shape

```json
{
  "projectId": "string",
  "sprintNumber": 5,
  "sprintStartDate": "2026-04-21",
  "sprintEndDate": "2026-05-02",
  "sprintGoal": "Ship portfolio dashboard",
  "targetVelocity": 8
}
```

---

## ao sprint-end

```bash
ao sprint-end [project]
```

End a sprint — generate final metrics report. Requires the bmad tracker plugin.

### Flags

| Flag | Description |
|------|-------------|
| `--clear` | Archive sprint history and clear config dates/goal |
| `--archive-done` | Also remove done stories from sprint-status.yaml (use with --clear) |
| `--json` | Output as JSON |

### Bmad Tracker Requirement

If the tracker is not bmad, the command exits with: `Sprint end requires the bmad tracker plugin.`

### Sprint Report

The report includes:

- **Period** — start date → end date
- **Velocity** — stories completed
- **Completed** — count of done stories
- **Avg cycle time** — hours (or `N/A`)
- **Health** — `OK` (green), `WARNING` (yellow), or `CRITICAL` (red)
- **Pace** — forecast pace indicator

### Archive Behavior

With `--clear`, the command:

1. Archives sprint history to a file (reports archive path)
2. Carries over incomplete stories
3. With `--archive-done`, removes done stories from sprint-status.yaml
4. Clears `sprintStartDate`, `sprintEndDate`, and `sprintGoal` from config

### Examples

```bash
# End sprint and view report
ao sprint-end

# End sprint, archive history, clear config
ao sprint-end --clear

# End sprint, archive and remove done stories
ao sprint-end --clear --archive-done

# JSON output
ao sprint-end --json
```

### JSON Output Shape

```json
{
  "projectId": "string",
  "retrospective": {
    "period": { "startDate": "2026-04-21", "endDate": "2026-05-02" },
    "velocity": 8,
    "completedCount": 8,
    "avgCycleTimeHours": 12.5
  },
  "forecast": { "pace": "ahead" },
  "health": { "overall": "ok", "indicatorCount": 0 },
  "archive": { "archivePath": "path", "carriedOver": 3, "removedDone": 5 },
  "cleared": true
}
```

---

## ao sprint-summary

```bash
ao sprint-summary [project]
```

Show a single-screen sprint summary with key metrics. Requires the bmad tracker plugin.

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### Bmad Tracker Requirement

If the tracker is not bmad, the command exits with: `Sprint summary requires the bmad tracker plugin.`

### Summary Layout

Displays a `header()` box with `Sprint #<n> Summary: <project>` (or `Sprint Summary: <project>` if no sprint number), followed by:

- **Goal** — sprint goal (if set)
- **Progress bar** — `[████████████░░░░░░░░░░░░░░░░░░] 40%` (30 chars wide)
- **Columns** — count per status column (done, in-progress, review, ready-for-dev, backlog)
- **Stories** — total, done, active, open counts
- **Points** — total, done, active (only if points data exists)
- **Health** — `OK`, `WARNING`, or `CRITICAL` with alert count
- **Velocity** — average stories/sprint with trend (`improving`, `stable`, `declining`)
- **Pace** — forecast pace
- **Days remaining** — color-coded (red ≤ 2, yellow ≤ 5, cyan > 5)
- **Stuck stories** — yellow warning section (if any)
- **WIP alerts** — yellow warning section (if any)

### Examples

```bash
# View sprint summary
ao sprint-summary

# View summary for specific project
ao sprint-summary my-project

# JSON output
ao sprint-summary --json
```

### JSON Output Shape

```json
{
  "projectId": "string",
  "projectName": "string",
  "columns": { "done": 12, "in-progress": 3, "review": 1, "ready-for-dev": 2, "backlog": 2 },
  "stats": { "total": 20, "done": 12, "inProgress": 3, "open": 5 },
  "pointsStats": { "total": 40, "done": 24, "inProgress": 6, "open": 10 },
  "healthOverall": "ok",
  "healthIndicators": 0,
  "velocity": 8,
  "velocityTrend": "stable",
  "forecastPace": "on-pace",
  "forecastDaysRemaining": 5,
  "stuckStories": [],
  "wipAlerts": [],
  "sprintGoal": "Ship v1.0",
  "sprintNumber": 5,
  "daysRemaining": 5
}
```

---

## ao sprint-plan

```bash
ao sprint-plan
```

Generate sprint execution plan from sprint-status.yaml. This command reads YAML directly from the current working directory — no config loading, no project argument, and no tracker required.

### Flags

None.

### YAML-Only Operation

`sprint-plan` reads `sprint-status.yaml` from `process.cwd()` using the `yaml` parser. It does not call `loadConfig()` or `resolveProject()`. The file must contain a `development_status` section.

### Dependency Graph

The command builds a dependency graph from the `dependencies` field in sprint-status.yaml:

- Calculates blockers (inverse of dependencies)
- Detects circular dependencies with DFS cycle detection
- Displays `⚠️  Circular Dependencies Detected (<n>):` with `↔` chains
- Shows blocked stories with `(blocked by: <deps>)`

### Status Grouping

Stories are grouped by status and displayed with colors:

| Status | Color |
|--------|-------|
| Backlog | gray |
| Ready for Dev | green |
| In Progress | yellow |
| In Review | blue |
| Done | dim |

Stories within each group are sorted by `priorities` field (higher = more important).

### Performance Warning

If the command takes longer than 500ms, a warning is displayed: `⚠️  Warning: Command took <n>ms (target: <500ms)`

### Examples

```bash
# Run from directory containing sprint-status.yaml
cd _bmad-output/implementation-artifacts
ao sprint-plan
```

### Output

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sprint Execution Plan: agent-orchestrator                                     │
└──────────────────────────────────────────────────────────────────────────────┘

  Total Stories: 20

Dependency Graph:

Blocked Stories (3):
  • 62-26-cli-sprint-commands (blocked by: 62-25-cli-session-commands)

  Ready for Dev (5):
    • 62-26-cli-sprint-commands [priority: 3]
    • 62-27-cli-story-commands [priority: 2]

  In Progress (1):
    • 62-25-cli-session-commands
```

---

## ao velocity

```bash
ao velocity [project]
```

Show weekly velocity history with trend analysis. Requires the bmad tracker plugin.

### Flags

| Flag | Description |
|------|-------------|
| `--weeks <n>` | Number of weeks to show (default: 8) |
| `--json` | Output as JSON |

### Bmad Tracker Requirement

If the tracker is not bmad, the command exits with: `Velocity requires the bmad tracker plugin.`

### Horizontal Bar Chart

Each week is displayed as a horizontal bar chart:

```text
    W0421  ████████████████████  8 stories
    W0414  ██████████            4 stories
    W0407  ██████████████        6 stories
```

Bar width is scaled relative to the highest week (max 20 chars). Week labels use `W<MM><DD>` format.

### Trend Analysis

Below the chart:

- **Average** — `Average: 6.0/week`
- **Trend** — with trend icons: `improving ↑`, `stable →`, `declining ↓`
- **Next week estimate** — `Next week: ~6`
- **Completion estimate** — `At current pace: ~3 weeks to complete 18 remaining stories` (only if remaining > 0)
- **Current week** — `Current week so far: 2 stories completed` (dim, only if > 0)

### Examples

```bash
# Show last 8 weeks of velocity
ao velocity

# Show last 4 weeks
ao velocity --weeks 4

# Show velocity for specific project
ao velocity my-project

# JSON output
ao velocity --json
```

### JSON Output Shape

```json
{
  "averageVelocity": 6.0,
  "trend": "stable",
  "nextWeekEstimate": 6,
  "completionWeeks": 3,
  "remainingStories": 18,
  "currentWeekSoFar": 2,
  "weeks": [
    { "weekStart": "2026-04-21", "completedCount": 8 }
  ]
}
```

---

## ao plan

```bash
ao plan [project]
```

Show sprint planning — recommended stories, capacity, and blockers. Has two code paths depending on tracker configuration.

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |
| `--accept` | Accept plan: move recommended stories to ready-for-dev |
| `--full` | Show all stories grouped by epic |

### Two Code Paths

**Path 1: bmad tracker configured** (`project.tracker.plugin === "bmad"`)

Full sprint planning with:
- Sprint config (goal, start/end dates)
- Capacity analysis (target velocity, historical velocity)
- Load status (`under`, `at-capacity`, `over`, `no-data`) with color coding
- Recommended stories (unblocked backlog stories)
- Blocked stories with `⊘ blocked by: <deps>` indicators
- `--accept` moves recommended stories from `backlog` to `ready-for-dev`

**Path 2: YAML fallback** (no bmad tracker or any other tracker)

Reads `sprint-status.yaml` from `<project.path>/<storyDir>/` and displays:
- Summary line with counts by status
- Progress percentage
- READY TO START section (backlog + ready-for-dev stories)
- IN PROGRESS section
- IN REVIEW section
- BLOCKED section
- `--full` groups all stories by epic number

### --accept Behavior

Only available with bmad tracker. Calls `acceptPlan()` which moves recommended backlog stories to `ready-for-dev` in sprint-status.yaml. Output:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Plan Accepted                                                                  │
└──────────────────────────────────────────────────────────────────────────────┘

  ✓ 62-26-cli-sprint-commands: backlog → ready-for-dev
  ✓ 62-27-cli-story-commands: backlog → ready-for-dev

  2 stories moved to ready-for-dev.
```

Without bmad tracker: `--accept is only supported with the bmad tracker plugin.`

### --full Epic Grouping

Shows all stories grouped by `Epic <n>` (sorted by epic number), with status emoji:

| Status | Emoji |
|--------|-------|
| backlog | 📋 |
| ready-for-dev | 🟡 |
| in-progress | 🔵 |
| review | 👁️ |
| done | ✅ |
| optional | ⚪ |

### Examples

```bash
# View sprint plan (bmad or YAML fallback)
ao plan

# Accept recommended stories
ao plan --accept

# Show all stories by epic
ao plan --full

# JSON output
ao plan --json

# Plan for specific project
ao plan my-project --full
```

### JSON Output Shape (bmad path)

```json
{
  "projectName": "string",
  "summary": { "totalStories": 20, "byStatus": {}, "completionPercentage": 60 },
  "actionable": [{ "id": "62-26-title", "title": "Title", "status": "backlog", "dependencies": [], "isBlocked": false }],
  "blocked": [],
  "inProgress": [],
  "review": [],
  "done": [],
  "epicGroups": { "Epic 62": [] }
}
```

The YAML fallback path returns the same `SprintPlanView` structure, populated from `sprint-status.yaml` instead of the bmad tracker service.

---

## Tracker Requirements

{: .highlight }
**Which commands need which tracker:**

| Tracker | Commands |
|---------|----------|
| **bmad required** (exit with error) | `sprint-end`, `sprint-summary`, `velocity` |
| **bmad conditional** (additive features) | `sprint` (dependency graph, WIP, forecast), `plan` (full planning, `--accept`) |
| **Any tracker** | `sprint-start` |
| **No tracker needed** | `sprint-plan` (reads YAML from cwd) |

---

## Cross-Cutting Patterns

- 6 of 7 commands use `loadConfig()` + `resolveProject()` — `sprint-plan` does not
- No ora spinners in any Sprint command — all output via direct `chalk`/`console.log`
- `[project]` argument is inline in `.command()` for all 6 commands that take it
- Config error: `` "No config found. Run `ao init` first." ``
- `sprint-start` writes directly to YAML config file via `readFileSync`/`writeFileSync`

---

## Next Steps

- [CLI Reference](./index.md) — command category index
- [Setup Commands](./setup-commands.md) — init, start, stop, create, plugins, sprint-config
- [Session Commands](./session-commands.md) — spawn, pause, resume, session, send, open, agent, assign
- [Story Commands](./story-commands.md) — story lifecycle commands
- [Monitoring Commands](./monitoring.md) — fleet, burndown, logs, events
- [Review & PR Commands](./review-pr.md) — review and PR management
- [Intelligence Commands](./intelligence.md) — learning, patterns, history
- [Infrastructure Commands](./infrastructure.md) — health, diagnostics
- [Getting Started](../getting-started.md) — installation and quick start
- [Configuration](../configuration.md) — agent-orchestrator.yaml reference
