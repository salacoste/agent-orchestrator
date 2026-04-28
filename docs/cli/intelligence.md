---
title: Intelligence Commands
nav_order: 7
parent: CLI Reference
description: Sprint analytics, forecasting, retrospectives, learning patterns, dependency graphs, and agent intelligence — retro, history, agent-history, learning-patterns, assign-suggest, monte-carlo, compare, workload, goals, deps, collab-graph, standup, and notifications commands.
---

# Intelligence Commands

13 commands for sprint analytics, probabilistic forecasting, retrospectives, failure pattern detection, agent intelligence, dependency graphs, and daily reporting: from Monte Carlo simulations and velocity trends to standup reports and health alerts.

## Command Summary

| Command | Description | `--json` | bmad Required |
|---------|-------------|----------|---------------|
| `ao retro [project]` | Show sprint retrospective analytics — velocity trends, carry-over, cycle times | Yes | Yes |
| `ao history [project]` | Show sprint transition history with optional filters | Yes | Yes |
| `ao agent-history <agent-id>` | View agent learning history | Yes (JSONL) | No |
| `ao learning-patterns` | View detected failure patterns from agent sessions | Yes | No |
| `ao assign-suggest <story-id>` | Recommend optimal agent assignment for a story | Yes | No |
| `ao monte-carlo [project]` | Monte Carlo probabilistic forecast for sprint completion | Yes | Yes |
| `ao compare [project]` | Compare sprint metrics across weeks | Yes | Yes |
| `ao workload [project]` | Show team workload per assignee | Yes | Yes |
| `ao goals [project]` | Show sprint goals and progress | Yes | Yes |
| `ao deps [project]` | Show dependency graph and detect cycles | Yes | Yes |
| `ao collab-graph` | View agent collaboration graph and dependencies | Yes | No |
| `ao standup [project]` | Generate a daily standup report | Yes | Yes |
| `ao notifications [project]` | Show sprint notifications — health alerts, stuck stories, forecast warnings | Yes | Yes |

{: .highlight }
**Tracker requirements:** 9 commands require the bmad tracker plugin (`retro`, `history`, `monte-carlo`, `compare`, `workload`, `goals`, `deps`, `standup`, `notifications`). The remaining 4 (`agent-history`, `learning-patterns`, `assign-suggest`, `collab-graph`) read from local JSONL files and need no tracker.

---

## ao retro

```bash
ao retro [project]
```

Show sprint retrospective analytics — velocity trends, carry-over, cycle times. Displays weekly periods with completion counts, average cycle times, and carry-over stories, plus summary statistics.

### Flags

| Flag | Description |
|------|-------------|
| `[project]` | Project ID (auto-resolves if only one project) |
| `--json` | Output as JSON |

### Output

Displays a `header()` box with `Sprint Retrospective: <projectName>` (falls back to project ID if name is not set), followed by a weekly breakdown.

No data: `  No completed stories yet. Retrospective data will appear as stories are done.` (dim)

When data available:

```text
  Sprint Retrospective: my-project
  Week           Completed   Avg Cycle   Carry-over
  ──────────────────────────────────────────────────
  2026-W16       8           1d 4h       2
  2026-W15       5           2d          4

  Total completed:    13
  Average velocity:   6.5 stories/week
  Velocity change:    +30.0%
  Avg cycle time:     1d 12h
```

Week labels in cyan. Velocity change: green if positive, red if negative. Carry-over count per period.

### Tracker Requirement

Requires bmad tracker plugin: `Retrospective requires the bmad tracker plugin.` (red)

### Examples

```bash
# Show retrospective for default project
ao retro

# Show retrospective for specific project
ao retro my-project

# JSON output for scripting
ao retro --json | jq '.averageVelocity'
```

---

## ao history

```bash
ao history [project]
```

Show sprint transition history with optional filters. Displays chronological list of story status transitions with timestamps, story IDs, and optional comments.

### Flags

| Flag | Description |
|------|-------------|
| `[project]` | Project ID (auto-resolves if only one project) |
| `--story <id>` | Filter by story ID |
| `--epic <id>` | Filter by epic ID |
| `--from <date>` | Start date (YYYY-MM-DD, inclusive) |
| `--to <date>` | End date (YYYY-MM-DD, inclusive) |
| `--status <status>` | Filter by target status |
| `--search <text>` | Search history by text |
| `--limit <n>` | Limit number of entries (default: 50) |
| `--json` | Output as JSON |

### Output

Displays a `header()` box with `Sprint History: <projectName>` (falls back to project ID).

No entries: `  (no matching history entries)` (dim)

When truncated: `  Showing last 20 of 150 entries` (dim)

```text
  Sprint History: my-project
  2026-04-23 10:30:00  62-15-auth   in-progress -> review
                                      "PR opened for review"
  2026-04-23 09:15:00  62-20-scm     ready-for-dev -> in-progress
```

Timestamps in dim, story IDs in cyan (padded to 12), from-status in dim, to-status in white. Transition uses `->` arrow. Optional comments in dim, indented.

### Tracker Requirement

Requires bmad tracker plugin: `History requires the bmad tracker plugin.` (red)

### Examples

```bash
# Show recent history
ao history

# Filter by story
ao history --story 62-15-auth-module

# Filter by date range
ao history --from 2026-04-20 --to 2026-04-24

# Filter by target status
ao history --status review

# Limit to 10 entries
ao history --limit 10

# JSON output
ao history --json | jq '.entries | length'
```

---

## ao agent-history

```bash
ao agent-history <agent-id>
```

View agent learning history. Shows session outcomes, durations, domains, and dates for a specific agent from the local learnings JSONL file.

### Flags

| Flag | Description |
|------|-------------|
| `<agent-id>` | Agent session ID (required) |
| `--since <time>` | Filter by time window (e.g., 7d, 30d) |
| `--limit <n>` | Max records to show (default: 20) |
| `--json` | Output as JSONL (one JSON object per line) |

### Output

```text
  Learning History for agent-1 (5 sessions)

  Story                          Outcome     Duration   Domains                   Date
  ──────────────────────────────────────────────────────────────────────────────────────
  62-15-auth-module              🟢 completed 1h 30m     auth,security             2026-04-23
  62-20-scm-plugin               🔴 failed    45m        api,integration           2026-04-22
```

Agent ID in cyan (bold header). Empty state: `No learning history for agent "<agentId>".` (yellow)

**Outcome indicators:**

| Outcome | Symbol |
|---------|--------|
| completed | 🟢 Green circle |
| failed | 🔴 Red circle |
| blocked | 🟡 Yellow circle |
| abandoned | ⚫ Black circle |

Invalid time format: `Invalid time format: "<value>". Use: 7d, 30d, 2h` (red)

### Examples

```bash
# Show recent history for an agent
ao agent-history agent-1

# Filter to last 7 days
ao agent-history agent-1 --since 7d

# Limit to 5 records
ao agent-history agent-1 --limit 5

# JSONL output for scripting
ao agent-history agent-1 --json
```

---

## ao learning-patterns

```bash
ao learning-patterns
```

View detected failure patterns from agent sessions. Analyzes learnings JSONL data to identify recurring issues with suggested remediation actions.

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### Output

```text
  Failure Patterns (3 detected)

  Pattern                  Count    Stories  Last Seen      Suggested Action
  ──────────────────────────────────────────────────────────────────────────────
  test-timeout             5        3        2h ago         Increase timeout or mock external deps
  merge-conflict           3        2        1d ago         Enable auto-rebase on branch switch
```

Pattern names in red. Column widths: Pattern (25), Count (8), Stories (8), Last Seen (14), Suggested Action (30, dim).

No patterns: `No recurring failure patterns detected.` (yellow)

### Examples

```bash
# Show failure patterns
ao learning-patterns

# JSON output
ao learning-patterns --json | jq '.[].pattern'
```

---

## ao assign-suggest

```bash
ao assign-suggest <story-id>
```

Recommend optimal agent assignment for a story. Scores each available agent based on historical affinity with the story's domain tags.

### Flags

| Flag | Description |
|------|-------------|
| `<story-id>` | Story ID (required) |
| `--json` | Output as JSON |
| `--domains <tags>` | Comma-separated domain tags (e.g., frontend,testing) |

### Output

```text
  Assignment Suggestions for 62-15-auth-module

  Agent                     Score    Success    Recommendation
  ──────────────────────────────────────────────────────────────────
  agent-1                   0.85     92%        ★ Recommended
  agent-3                   0.62     78%        —
```

Story ID in cyan (bold header). Top-scoring agent marked `★ Recommended` in green. Other agents show dim `—` (em-dash).

No agents: `No agents available for assignment.` (yellow)

### JSON Output Shape

```json
{
  "storyId": "62-15-auth-module",
  "candidates": [
    {
      "agentId": "agent-1",
      "score": 0.85,
      "successRate": 92
    }
  ]
}
```

### Examples

```bash
# Get assignment suggestions for a story
ao assign-suggest 62-15-auth-module

# Specify domain tags
ao assign-suggest 62-15-auth-module --domains auth,security

# JSON output
ao assign-suggest 62-15-auth-module --json | jq '.candidates[0]'
```

---

## ao monte-carlo

```bash
ao monte-carlo [project]
# or
ao mc [project]
```

Monte Carlo probabilistic forecast for sprint completion. Runs N simulations based on historical throughput to estimate completion dates with confidence intervals.

### Flags

| Flag | Description |
|------|-------------|
| `[project]` | Project ID (auto-resolves if only one project) |
| `--epic <id>` | Filter by epic ID |
| `--simulations <n>` | Number of simulations (default: 10000) |
| `--json` | Output as JSON |

**Alias:** `ao mc`

### Output

```text
  Monte Carlo Forecast: my-project
  Remaining stories: 12
  Simulations:       10000
  Sample size:       14 days
  Avg daily rate:    1.21 stories/day

  Percentile Forecasts:
    P50 (likely):       2026-05-02
    P80 (conservative): 2026-05-06
    P95 (safe):         2026-05-10

  Linear Comparison:
    Linear forecast:    2026-05-04
    Linear confidence:  62.3% of simulations
```

P50 in green, P80 in yellow, P95 in red. Stats values in cyan. Linear comparison shown only when available.

Insufficient data: `Insufficient throughput data — complete more stories to generate a forecast.` (dim). Alternate: `No data available. Complete some stories to generate a forecast.`

### Tracker Requirement

Requires bmad tracker plugin: `Monte Carlo forecast requires the bmad tracker plugin.` (red)

### Examples

```bash
# Run forecast with defaults
ao monte-carlo
ao mc

# Filter by epic
ao mc --epic 62

# Increase simulation count
ao mc --simulations 50000

# JSON output
ao mc --json | jq '.percentiles'
```

---

## ao compare

```bash
ao compare [project]
```

Compare sprint metrics across weeks. Shows velocity, cycle time, flow efficiency, WIP, carry-over, and bottlenecks per week with trend indicators.

### Flags

| Flag | Description |
|------|-------------|
| `[project]` | Project ID (auto-resolves if only one project) |
| `--weeks <n>` | Number of weeks (default: 4) |
| `--epic <id>` | Filter by epic ID |
| `--json` | Output as JSON |

### Output

```text
  Sprint Comparison: my-project
  Trends
    Velocity: improving ↑  Cycle Time: stable →  Flow Eff: improving ↑  WIP: declining ↓

         Week       Vel    CycleT    FlowE     WIP     CO   Bottleneck
  ──────────────────────────────────────────────────────────────────────
    04-15          8      1.2d      78%       3       1     review
    04-08          5      2.0d      65%       5       3     -
```

No data: `No data available.` (dim). Trend arrows: improving = green `↑`, stable = yellow `→`, declining = red `↓`. Cycle time via `formatMs`: hours shows `X.Xh`, days shows `X.Xd`.

### Tracker Requirement

Requires bmad tracker plugin: `Compare requires the bmad tracker plugin.` (red)

### Examples

```bash
# Compare last 4 weeks
ao compare

# Compare last 8 weeks
ao compare --weeks 8

# Filter by epic
ao compare --epic 62

# JSON output
ao compare --json | jq '.trends'
```

---

## ao workload

```bash
ao workload [project]
```

Show team workload per assignee. Displays in-flight stories, point totals, overload status, and unassigned stories.

### Flags

| Flag | Description |
|------|-------------|
| `[project]` | Project ID (auto-resolves if only one project) |
| `--epic <id>` | Filter by epic ID |
| `--json` | Output as JSON |

### Output

```text
  Team Workload: my-project
  Overload threshold: 5
  agent-1
    In-flight: 3  Total points: 8
    in-progress: 62-15-auth, 62-18-worktree
    review: 62-12-memory
  agent-3 OVERLOADED
    In-flight: 6  Total points: 21
    in-progress: 62-20-scm, 62-22-terminal, 62-24-eslint, ...

  Unassigned (2)
    62-25-api      ready-for-dev
    62-26-hooks    backlog
```

Overloaded agents in red. Unassigned in yellow. Column/story details in dim.

No stories: `No active stories.` (dim)

### Tracker Requirement

Requires bmad tracker plugin: `Workload requires the bmad tracker plugin.` (red)

### Examples

```bash
# Show workload for default project
ao workload

# Filter by epic
ao workload --epic 62

# JSON output
ao workload --json | jq '.members[] | select(.overloaded)'
```

---

## ao goals

```bash
ao goals [project]
```

Show sprint goals and progress. Displays each goal with a status badge, progress bar, confidence percentage, and an overall on-track indicator.

### Flags

| Flag | Description |
|------|-------------|
| `[project]` | Project ID (auto-resolves if only one project) |
| `--json` | Output as JSON |

### Output

```text
  Sprint Goals: my-project
  ✓ DONE       Auth module complete
    ████████████████████░░░░ 85% | Confidence: 90%

  ● IN PROGRESS API route production wiring
    ████████████░░░░░░░░░░░░ 52% | Confidence: 68%

  ○ PENDING    Documentation site launch
    ░░░░░░░░░░░░░░░░░░░░░░░░ 0%

  Overall: ████████████░░░░░░░░░░░░ 52%  On Track
```

**Status badges:**

| Status | Badge |
|--------|-------|
| done | Green `✓ DONE` |
| in-progress | Blue `● IN PROGRESS` |
| at-risk | Red `▲ AT RISK` |
| pending | Dim `○ PENDING` |

Progress bar width: 20 characters. Filled blocks (`█`) in green, empty blocks (`░`) in dim.

**Confidence coloring:** `>= 75%` green, `>= 50%` yellow, `< 50%` red.

No goals: `No sprint goals configured.` (dim), hint: `Add 'sprintGoals' to your tracker config.` (dim)

### Tracker Requirement

Requires bmad tracker plugin: `Goals require the bmad tracker plugin.` (red)

### Examples

```bash
# Show sprint goals
ao goals

# JSON output
ao goals --json | jq '.overallProgress'
```

---

## ao deps

```bash
ao deps [project]
```

Show dependency graph and detect cycles. Displays story dependencies with blocking indicators, cycle detection, and missing reference warnings.

### Flags

| Flag | Description |
|------|-------------|
| `[project]` | Project ID (auto-resolves if only one project) |
| `--cycles` | Show only dependency cycles |
| `--json` | Output as JSON |

### Dependency Graph Mode (default)

```text
  Dependencies: my-project
  62-15-auth-module
    depends on: 62-12-memory
    blocks: 62-20-scm-plugin, 62-22-terminal
  62-20-scm-plugin [BLOCKED]
    depends on: 62-15-auth-module
    blocks: (none)
```

Blocked stories show red `[BLOCKED]`. Dependency and block lists in dim.

Circular warnings: `⚠ 2 cycle(s) detected` (red), with per-cycle chains using `→` arrows.

Missing references: `Missing references: 62-99-nonexistent` (yellow)

### Cycle Mode (`--cycles`)

```text
  Dependency Cycles: my-project
  ● 2 cycle(s) detected
    62-15-auth [in-progress] → 62-20-scm [ready] → 62-15-auth
    62-30-intel [backlog] → 62-31-infra [backlog] → 62-30-intel
  Affected stories: 62-15-auth, 62-20-scm, 62-30-intel, 62-31-infra
```

No cycles: `✓ No dependency cycles detected.` (green)

No dependencies: `No dependencies configured.` (dim)

### Tracker Requirement

Requires bmad tracker plugin: `Dependencies require the bmad tracker plugin.` (red)

### Examples

```bash
# Show dependency graph
ao deps

# Show only cycles
ao deps --cycles

# JSON output
ao deps --json | jq '.nodes[] | select(.blocked)'
```

---

## ao collab-graph

```bash
ao collab-graph
```

View agent collaboration graph and dependencies. Shows which agents are working on which stories and what they are waiting on.

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### Output

```text
  Agent Collaboration Graph (4 entries)

  Agent                  Story                      Status      Waiting On
  ──────────────────────────────────────────────────────────────────────
  agent-1                62-15-auth-module          active
  agent-2                62-15-auth-module          waiting     agent-1
  agent-3                62-20-scm-plugin           completed
  agent-4                                           active
```

**Status colors:**

| Status | Color |
|--------|-------|
| active | Green |
| waiting | Yellow |
| completed | Gray |
| blocked | Red |

No graph: `No active agent dependencies.` (yellow)

### Examples

```bash
# Show collaboration graph
ao collab-graph

# JSON output
ao collab-graph --json | jq '.[] | select(.status == "waiting")'
```

---

## ao standup

```bash
ao standup [project]
```

Generate a daily standup report. Shows completed stories, in-progress work, blocked items, rework alerts, and sprint health summary.

### Flags

| Flag | Description |
|------|-------------|
| `[project]` | Project ID (auto-resolves if only one project) |
| `--epic <id>` | Filter by epic ID |
| `--json` | Output as JSON |
| `--markdown` | Output raw markdown |

### Output

```text
  Standup: my-project

  Completed Yesterday
    + 62-15-auth  Auth module implementation

  In Progress
    > 62-20-scm   SCM plugin wiring (in-progress, 2.5h) [agent-1]
    > 62-22-term  Terminal plugin (review, 4.0d)

  Blocked
    ! 62-25-api   Dependency not met: 62-15-auth

  Rework Alerts
    ~ 62-18-wt    in-progress -> ready-for-dev

  Sprint Health
    Pace: On pace
    Progress: 15/30 (15 remaining)
    Projected: 2026-05-01
```

**Section indicators:**

| Section | Symbol | Color |
|---------|--------|-------|
| Completed | `+` | Green |
| In Progress | `>` | Blue |
| Blocked | `!` | Red |
| Rework Alerts | `~` | Yellow |

Blocked and Rework Alerts sections only shown when non-empty. Story IDs padded to 10. Session IDs in dim brackets.

**Pace colors:** `ahead` = green, `on-pace` = cyan, `behind` = red.

Completed Yesterday and In Progress show dim messages when empty (e.g., `No stories completed in the last 24h.`). Blocked and Rework Alerts are hidden entirely when empty.

### Tracker Requirement

Requires bmad tracker plugin: `Standup requires the bmad tracker plugin.` (red)

### Examples

```bash
# Generate standup report
ao standup

# Filter by epic
ao standup --epic 62

# Raw markdown for Slack/paste
ao standup --markdown

# JSON output
ao standup --json | jq '.blocked'
```

---

## ao notifications

```bash
ao notifications [project]
```

Show sprint notifications — health alerts, stuck stories, forecast warnings. Displays active notifications with severity badges and detail lines.

### Flags

| Flag | Description |
|------|-------------|
| `[project]` | Project ID (auto-resolves if only one project) |
| `--json` | Output as JSON |

### Output

```text
  Sprint Notifications: my-project
  ● CRITICAL  Story 62-25-api stuck for 48h
    Story has not progressed in 2 days
    → Check agent status and dependencies

  ▲ WARNING  Velocity below target
    Current velocity 3.2 stories/week vs target 5.0
    → Consider rebalancing agent assignments
```

**Severity badges:**

| Severity | Badge |
|----------|-------|
| critical | Red `● CRITICAL` |
| warning | Yellow `▲ WARNING` |
| info | Dim `ℹ INFO` |

Detail lines prefixed with dim `→`. Notification titles on the badge line, messages indented below.

No notifications: `✓ No notifications.` (green)

### Tracker Requirement

Requires bmad tracker plugin: `Notifications require the bmad tracker plugin.` (red)

### Examples

```bash
# Show sprint notifications
ao notifications

# JSON output
ao notifications --json | jq '.[] | select(.severity == "critical")'
```

---

## Tracker Requirements

{: .highlight }
**Which commands need which tracker:**

| Tracker/Plugin | Commands |
|----------------|----------|
| **bmad tracker** | `retro`, `history`, `monte-carlo`, `compare`, `workload`, `goals`, `deps`, `standup`, `notifications` |
| **No plugin needed** | `agent-history`, `learning-patterns`, `assign-suggest`, `collab-graph` |

The 4 no-plugin commands read from local JSONL files (`learnings.jsonl`, agent registry) under the sessions directory.

---

## Cross-Cutting Patterns

- **9 commands require bmad tracker** — validated via `project.tracker.plugin === "bmad"` or `getTracker()` helper
- **9 commands accept `[project]` positional arg** — resolved via `resolveProject()` (auto-picks if only one project)
- **4 commands do not accept project arg** — `agent-history`, `learning-patterns`, `assign-suggest`, `collab-graph` (use CWD matching)
- **All 13 commands support `--json`** — `agent-history` outputs JSONL (one JSON per line), all others output formatted JSON array/object
- **No ora spinners** in this category — all commands render output directly
- **2 commands have unique output modes**: `standup` has `--markdown`, `agent-history` has JSONL output
- **1 command has an alias**: `monte-carlo` can be called as `ao mc`
- **`header()` function** used by 9 commands for box-drawing headers (76 chars wide, from `lib/format.ts`)
- Config errors:
  - 11 commands: `` No config found. Run `ao init` first. ``
  - Project not found (8 commands): `Project config not found: <projectId>`
  - Project not found (5 commands via CWD): `Not in a project directory.`
- **Tracker error strings vary** per command: `Retrospective requires the bmad tracker plugin.`, `History requires the bmad tracker plugin.`, `Monte Carlo forecast requires the bmad tracker plugin.`, etc.

---

## Next Steps

- [CLI Reference](./index.md) — command category index
- [Setup Commands](./setup-commands.md) — init, start, stop, create, plugins, sprint-config
- [Session Commands](./session-commands.md) — spawn, pause, resume, session, send, open, agent, assign
- [Sprint Commands](./sprint-commands.md) — sprint, sprint-start, sprint-end, velocity, plan
- [Story Commands](./story-commands.md) — story lifecycle commands
- [Monitoring Commands](./monitoring.md) — status, fleet, burndown, logs, events
- [Review & PR Commands](./review-pr.md) — review-check, review-stats, rework, resolve, resolve-conflicts, conflicts
- [Infrastructure Commands](./infrastructure.md) — health, diagnostics
- [Getting Started](../getting-started.md) — installation and quick start
- [Configuration](../configuration.md) — agent-orchestrator.yaml reference
