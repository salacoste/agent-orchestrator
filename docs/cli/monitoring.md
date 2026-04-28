---
title: Monitoring Commands
nav_order: 5
parent: CLI Reference
description: Real-time monitoring and observability — view sessions, fleet agents, burndown charts, agent logs, and event audit trails.
---

# Monitoring Commands

5 commands for real-time monitoring and observability: view multi-session status with PR/CI integration, monitor fleet agents htop-style, track sprint burndown, tail agent logs, and query event audit trails.

## Command Summary

| Command | Description | `--json` | bmad Required |
|---------|-------------|----------|---------------|
| `ao status` | Show all sessions with branch, activity, PR, and CI status | Yes | No |
| `ao fleet` | View fleet status (htop-style agent monitoring) | Yes (`--format json`) | No |
| `ao burndown [project]` | View sprint burndown chart (ASCII) | Yes | No |
| `ao logs [agent-id]` | View agent session logs | Yes | No |
| `ao events query` | Query event audit trail | Yes (JSONL) | No |
| `ao events drain` | Manually drain queued events when event bus is available | Yes | No |
| `ao events status` | Show current event queue status | Yes | No |

{: .highlight }
**Tracker requirements:** None of the Monitoring commands require the bmad tracker plugin. All use `loadConfig()` or read files directly.

---

## ao status

```bash
ao status
```

Show all sessions with branch, activity, PR, and CI status. Displays a multi-session overview grouped by project with 10-column detail table.

### Flags

| Flag | Description |
|------|-------------|
| `-p, --project <id>` | Filter by project ID |
| `-s, --story <id>` | Show detailed status for a specific story |
| `--json` | Output as JSON |

### Output

Displays a `banner()` box with `AGENT ORCHESTRATOR STATUS`, followed by a `header()` per project and a 10-column table:

| Column | Width |
|--------|-------|
| Session | 14 |
| Branch | 24 |
| Story | 12 |
| AgentSt | 8 |
| PR | 6 |
| CI | 6 |
| Rev | 6 |
| Thr | 4 |
| Activity | 9 |
| Age | remaining |

Agent status colors:

| Status | Color |
|--------|-------|
| active | green |
| blocked | red |
| idle | yellow |
| completed | dim |
| spawning | blue |
| disconnected | red |

Summary line: `<N> active sessions across <N> projects`

Session rows may include a second line with:
- Agent-generated summary (truncated to 60 chars)
- Story title with status tag (when tracker available)

### Story Detail Mode

With `-s, --story <id>`, displays detailed status for a specific story:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Story: 62-28-cli-monitoring-commands                                         │
└──────────────────────────────────────────────────────────────────────────────┘

  Sprint Status: in-progress
  Dependencies:
    ✓ 62-27-cli-story-commands — done

  Assigned Agents:
    agent-1 — active — 2h ago
```

Shows sprint status, dependency resolution with check/circle icons, and assigned agents with status and duration.

### Fallback Mode

When no config file is found, `ao status` falls back to discovering tmux sessions directly:

```text
╔══════════════════════════════════════════════════════════════════════════════╗
║                    AGENT ORCHESTRATOR STATUS                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

  2 tmux sessions found

  agent-1 (2h ago)
       Claude: Implementing monitoring commands documentation
```

### Examples

```bash
# Show all sessions
ao status

# Filter by project
ao status --project my-project

# Show story detail
ao status --story 62-28-cli-monitoring-commands

# JSON output for scripting
ao status --json | jq '.[].name'
```

### JSON Output Shape

```json
[
  {
    "name": "agent-1",
    "branch": "feat/62-28-monitoring-commands",
    "status": "working",
    "summary": "Implementing monitoring commands",
    "claudeSummary": "Writing ao fleet documentation",
    "pr": "https://github.com/org/repo/pull/42",
    "prNumber": 42,
    "issue": "62-28",
    "issueTitle": "CLI Monitoring Commands",
    "issueStatus": "in-progress",
    "lastActivity": "2h ago",
    "project": "my-project",
    "ciStatus": "success",
    "reviewDecision": null,
    "pendingThreads": 0,
    "activity": "writing",
    "storyId": "62-28-cli-monitoring-commands",
    "agentStatus": "active"
  }
]
```

---

## ao fleet

```bash
ao fleet
```

View fleet status (htop-style agent monitoring). Shows all agents in a responsive table with status, duration, and activity information.

### Flags

| Flag | Description |
|------|-------------|
| `--watch` | Continuous refresh every 5s |
| `--sort-by <field>` | Sort by field (agent, story, status, activity) — default: status |
| `--status <filter>` | Filter by status (active, idle, blocked, offline) |
| `--reverse` | Reverse sort order |
| `--format <format>` | Output format (table, json) — default: table |

### Output

The command displays an htop-style table with responsive column widths based on terminal width:

```text
╔══════════════════╤═══════════════════════════════╤════════════╤══════════╤════════════════╗
║ Agent            │ Story                         │ Status     │ Duration │ Last Activity  ║
╠══════════════════╪═══════════════════════════════╪════════════╪══════════╪════════════════╣
║ agent-1          │ 62-28 CLI Monitoring Commands │ 🔴 blocked │ 4h 30m   │ 2h ago         ║
║ agent-2          │ 62-29 CLI Review PR Commands  │ 🟢 active  │ 1h 15m   │ working now    ║
║ agent-3          │ —                             │ 🟠 idle    │ —        │ 45m ago        ║
╚══════════════════╧═══════════════════════════════╧════════════╧══════════╧════════════════╝

Last updated: 14:30:00 | Total: 3 | Active: 1 | Idle: 1 | Blocked: 1 | Offline: 0
```

Fixed columns: Agent(18), Status(12), Duration(10), Activity(16). Story column gets remaining width (min 20).

### Sort Order

Default sort by `status`:
1. **blocked** (priority 0) — shown first
2. **idle** (priority 1)
3. **active** (priority 2)
4. **disconnected** (priority 3)

Within the same status, agents are sorted by duration descending (longest-running first).

### Idle Threshold

Agents are considered idle after **10 minutes** of inactivity. Activity shows `working now` in green for agents idle less than 2 minutes.

### Watch Mode

With `--watch`, the table refreshes every 5 seconds:

```bash
ao fleet --watch
```

Clears the terminal and redraws. Exit with Ctrl+C (SIGINT/SIGTERM cleanup).

### Empty Fleet

When no agents match: `No active agents. Use \`ao spawn\` to start one.`

### Examples

```bash
# Show fleet status
ao fleet

# Watch mode (auto-refresh)
ao fleet --watch

# Sort by agent name
ao fleet --sort-by agent

# Filter blocked agents only
ao fleet --status blocked

# Reverse sort (disconnected first)
ao fleet --reverse

# JSON output for scripting
ao fleet --format json | jq '.summary'
```

### JSON Output Shape

```json
{
  "timestamp": "2026-04-24T14:30:00.000Z",
  "agents": [
    {
      "agentId": "agent-1",
      "storyId": "62-28-cli-monitoring-commands",
      "storyTitle": "CLI Monitoring Commands",
      "agentStatus": "active",
      "storyStatus": "in-progress",
      "lastActivity": "2026-04-24T12:15:00.000Z",
      "idleMinutes": 5,
      "notes": "—",
      "retryCount": 0
    }
  ],
  "summary": {
    "total": 3,
    "active": 1,
    "idle": 1,
    "blocked": 1,
    "disconnected": 0
  }
}
```

---

## ao burndown

```bash
ao burndown [project]
```

View sprint burndown chart (ASCII). Renders an ASCII chart showing ideal vs actual progress with pace indicator.

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output raw BurndownResult as JSON |
| `--points` | Show story points instead of story count |

### Output

Displays a `header()` box with `Sprint Burndown — <project>`, followed by an ASCII burndown chart and summary.

Chart characters:

| Character | Meaning |
|-----------|---------|
| `━` | Actual progress line |
| `╌` | Ideal progress line (dashed) |
| `╋` | Both lines overlap |
| `│` | Y-axis |
| `└` | Bottom-left corner |

Pace indicators:

| Pace | Display |
|------|---------|
| ahead | 🟢 Ahead of schedule |
| on-pace | 🟡 On pace |
| behind | 🔴 Behind schedule |
| (no data) | ⚪ No data |

Summary footer:

```text
  🟡 On pace | 12/20 stories done (60%) | 8 remaining
  Sprint: 2026-04-21 → 2026-05-02
  Last updated: 2026-04-24T14:30:00.000Z
```

With `--points`, shows story points instead of count when points data is available.

### No Sprint Data

If no sprint has been started: `No sprint data found. Run \`ao sprint-start\` to begin a sprint.`

### Examples

```bash
# Show burndown for default project
ao burndown

# Show burndown for specific project
ao burndown my-project

# Show story points mode
ao burndown --points

# JSON output for scripting
ao burndown --json | jq '.completionPercentage'
```

### JSON Output Shape

```json
{
  "totalStories": 20,
  "completedStories": 12,
  "remainingStories": 8,
  "totalPoints": 40,
  "completedPoints": 24,
  "remainingPoints": 16,
  "completionPercentage": 60,
  "currentPace": "on-pace",
  "sprintStart": "2026-04-21",
  "sprintEnd": "2026-05-02",
  "lastUpdated": "2026-04-24T14:30:00.000Z",
  "dailyData": []
}
```

---

## ao logs

```bash
ao logs [agent-id]
```

View agent session logs. Supports tail, follow, time-filtered, and all-agents modes.

### Flags

| Flag | Description |
|------|-------------|
| `--follow` | Stream live output (like tail -f) |
| `--since <time>` | Filter by time window (e.g., 30m, 2h, 1d) |
| `--lines <n>` | Number of lines to show — default: 50 |
| `--json` | Output as JSON |

### Four Modes

**1. Tail mode** (default — agent specified, no `--follow` or `--since`):

```text
  Logs for agent-1 (last 50 lines)

  [output lines...]
```

Shows last N lines from agent log file.

**2. Follow mode** (`--follow`):

```text
  Following logs for agent-1 (Ctrl+C to stop)

  [initial 50 lines...]
  [new lines streamed live...]
```

Polls log file every 1000ms, handles log rotation, exits on Ctrl+C.

**3. Time-filtered mode** (`--since`):

Filters logs by time window. Checks file modification time against the window. If the file is older than the window: `No logs within the specified time window for agent "<id>".`

Invalid time format: `Invalid time format: "<value>". Use: 30s, 5m, 2h, 1d`

**4. All-agents mode** (no agent-id specified):

```text
  Logs from 3 agent(s)

  [agent-1] [output line]
  [agent-2] [output line]
  [agent-3] [output line]
```

Shows interleaved logs from all active agents with agent ID prefixes in cyan.

### Error Handling

Agent not found: `Agent "<id>" not found.` — lists active agents with status and story assignment.

No logs available: `No logs available for agent "<id>". Session may still be starting.`

### Examples

```bash
# Show last 50 lines for agent
ao logs agent-1

# Stream live logs
ao logs agent-1 --follow

# Show logs from last 30 minutes
ao logs agent-1 --since 30m

# Show last 100 lines
ao logs agent-1 --lines 100

# Show logs from all agents
ao logs

# JSON output for scripting
ao logs agent-1 --json | jq '.count'
```

### JSON Output Shape

```json
{
  "agentId": "agent-1",
  "lines": ["line 1", "line 2"],
  "count": 50
}
```

All-agents JSON output:

```json
{
  "agents": {
    "agent-1": ["line 1", "line 2"],
    "agent-2": ["line 1"]
  },
  "count": 3
}
```

---

## ao events

```bash
ao events
```

Manage event publishing and queue. Supports 3 subcommands:

---

### ao events query

```bash
ao events query
```

Query event audit trail. Reads events from `events.jsonl` in project directory, current working directory, or `~/.ao-sessions/`.

**Flags:**

| Flag | Description |
|------|-------------|
| `--type <eventType>` | Filter by event type (e.g., story.completed) |
| `--since <time>` | Filter by time window (e.g., 30m, 2h, 1d) |
| `--limit <n>` | Number of events to show — default: 20 |
| `--json` | Output as JSONL for piping to jq |

**Output:**

```text
  Event Audit Trail (15 events)

  Time           Event Type                   Entity               Details
  ──────────── ──────────────────────────── ──────────────────── ────────────────────
  2h ago        story.completed              62-28-cli-monitoring {"storyId":"62-28"}
  4h ago        conflict.detected            merge-conflict-1     {"conflictId":"mc-1"}
  6h ago        health.check                 agent-1              {"status":"healthy"}

  Showing 15 events (oldest: 6h ago, newest: 2h ago)
```

Event type color coding:

| Prefix | Color |
|--------|-------|
| `story.*` | green |
| `conflict.*` | red |
| `health.*` | yellow |
| `circuit.*` | yellow |
| other | gray |

No events file: `No event audit trail found. Events are logged when agents are active.`

Invalid time format: `Invalid time format: "<value>". Use: 30s, 5m, 2h, 1d`

**Examples:**

```bash
# Show last 20 events
ao events query

# Filter by event type
ao events query --type story.completed

# Show events from last hour
ao events query --since 1h

# Limit to 5 events
ao events query --limit 5

# JSONL output for piping
ao events query --json | jq '.eventType'
```

**JSON Output:** With `--json`, outputs one JSON object per line (JSONL format).

---

### ao events drain

```bash
ao events drain
```

Manually drain queued events when event bus is available. Has two code paths depending on whether EventPublisher is registered (running application vs standalone).

**Flags:**

| Flag | Description |
|------|-------------|
| `--force` | Force drain even if event bus is unavailable |
| `--timeout <ms>` | Timeout in milliseconds (default: 30000) |
| `--json` | Output as JSON |

**EventPublisher registered (running application):**

Shows event bus status, degraded mode, queue count:

```text
Event Drain Status

  Event bus: Connected
  Degraded mode: Normal
  Queued events: 12
```

If `Dropped events` count is greater than zero, an additional `Dropped events: N` line appears (in red).

If no queued events: `✓ No queued events to drain`

If queued events and no `--force`:

```text
  Event drain is handled automatically by EventPublisher
  when the event bus reconnects. Use --force to drain manually.
```

With `--force`, calls `eventPublisher.flush(timeoutMs)` and reports:

```text
Force draining queued events...

✓ Drain completed in 150ms
  Events drained: 12
```

Event bus unavailable (without `--force`): `Event bus is currently unavailable` with queue counts. Use `--force` to attempt drain anyway.

**EventPublisher not registered (standalone):**

Shows queue status from backup files with degraded mode indicator. Recommends starting the application for full drain functionality.

**Examples:**

```bash
# Check drain status
ao events drain

# Force drain queued events
ao events drain --force

# Force drain with custom timeout
ao events drain --force --timeout 60000

# JSON output
ao events drain --json
```

---

### ao events status

```bash
ao events status
```

Show current event queue status. Displays degraded mode, service availability, and queue counts.

**Flags:**

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

**Output (EventPublisher registered):**

```text
Event Queue Status

  Degraded mode: Normal
  Local state: Operational
  Publisher registered: Yes

Service Availability:
  event-bus: Available

Queued Operations:
  Events: 0
  Syncs: 0
```

When in degraded mode:

```text
  ⚠ Currently in degraded mode: degraded
  Events are being queued and will flush when services recover
```

**Output (EventPublisher not registered):**

Shows basic status from backup files. Publisher registered shows "No". Queued events and syncs from file counts.

**Examples:**

```bash
# Show event queue status
ao events status

# JSON output
ao events status --json
```

---

## Tracker Requirements

{: .highlight }
**Which commands need which tracker:**

| Tracker | Commands |
|---------|----------|
| **No tracker needed** | All Monitoring commands — `status`, `fleet`, `burndown`, `logs`, `events` |

All Monitoring commands use `loadConfig()` for project resolution. `ao status` additionally has a fallback mode that discovers tmux sessions without any config.

---

## Cross-Cutting Patterns

- All 5 commands use `loadConfig()` — `ao status` has fallback when config not found
- No ora spinners — all output via direct `chalk`/`console.log`
- Watch/follow modes use `setInterval` with SIGINT/SIGTERM cleanup handlers
- Config error: `` No config found. Run `ao init` first. `` (backtick quotes, used by fleet, burndown, logs, events)
- `ao status` uses `chalk.yellow` for config error and falls back (no `process.exit`)
- `ao fleet` and `ao logs` check project directory: `Not in a project directory.`
- `ao burndown` resolves project: `Project not found. Specify project name or run from project directory.`
- `ao events` parent command description: `Manage event publishing and queue`
- Idle threshold in `ao fleet`: 10 minutes
- Follow interval in `ao logs`: 1000ms
- Watch interval in `ao fleet`: 5000ms

---

## Next Steps

- [CLI Reference](./index.md) — command category index
- [Setup Commands](./setup-commands.md) — init, start, stop, create, plugins, sprint-config
- [Session Commands](./session-commands.md) — spawn, pause, resume, session, send, open, agent, assign
- [Sprint Commands](./sprint-commands.md) — sprint, sprint-start, sprint-end, velocity, plan
- [Story Commands](./story-commands.md) — story lifecycle commands
- [Review & PR Commands](./review-pr.md) — review and PR management
- [Intelligence Commands](./intelligence.md) — learning, patterns, history
- [Infrastructure Commands](./infrastructure.md) — health, diagnostics
- [Getting Started](../getting-started.md) — installation and quick start
- [Configuration](../configuration.md) — agent-orchestrator.yaml reference
