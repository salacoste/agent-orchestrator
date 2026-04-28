---
title: Story Commands
nav_order: 4
parent: CLI Reference
description: Story and epic lifecycle management — view story details, track status, manage epics, query history, and review agent learning.
---

# Story Commands

6 commands for managing story and epic lifecycle: view story details, track status across agents, manage epics, create stories, and query transition and learning history.

## Command Summary

| Command | Description | `--json` | bmad Required |
|---------|-------------|----------|---------------|
| `ao story <id> [project]` | Show story detail — transitions, column dwells, cycle time | Yes | Yes |
| `ao story-status [storyId]` | View story and agent status | Yes (`--format json`) | No (reads YAML) |
| `ao epic [project] [epic-id]` | Epic management: list/show epics, or use subcommands (create, rename, delete) | Yes | Yes |
| `ao create [project]` | Create a new story in the BMad tracker | Yes | Yes |
| `ao history [project]` | Show sprint transition history with optional filters | Yes | Yes |
| `ao agent-history <agent-id>` | View agent learning history | Yes (JSONL) | No (reads JSONL) |

{: .highlight }
**Tracker requirements:** `story`, `epic`, `create`, and `history` require the bmad tracker plugin. `story-status` reads `sprint-status.yaml` directly. `agent-history` reads `learnings.jsonl` directly.

---

## ao story

```bash
ao story <id> [project]
```

Show story detail — transitions, column dwells, cycle time. Requires the bmad tracker plugin.

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### Bmad Tracker Requirement

If the tracker is not bmad, the command exits with: `Story detail requires the bmad tracker plugin.`

### Output

Displays a `header()` box with `Story: <storyId>`, followed by:

1. **Status** — current status with color coding:

| Status | Color |
|--------|-------|
| backlog | gray |
| ready-for-dev | yellow |
| in-progress | blue |
| review | magenta |
| done | green |

2. **Epic** — epic identifier (if set)
3. **Cycle time** — total duration for completed stories (e.g., `2d 5h`)
4. **Timeline** — transition history with timestamps:

```text
  Timeline:
    Apr 21 14:30  backlog → ready-for-dev (after 3d 2h)
    Apr 22 09:15  ready-for-dev → in-progress (after 18h 45m)
    Apr 23 16:00  in-progress → review (after 1d 6h)
    Apr 24 10:30  review → done (after 18h 30m)
```

Transition format: `fromStatus → toStatus (after <duration>)` with colors matching the status table above.

5. **Column Dwell Times** — horizontal bar chart showing time spent in each status column:

```text
  Column Dwell Times:
    backlog           ████████████████████░░░░░░░░░░ 3d 2h
    ready-for-dev     ██████░░░░░░░░░░░░░░░░░░░░░░░░ 18h 45m
    in-progress       ██████████████░░░░░░░░░░░░░░░░░ 1d 6h
    review            ██████░░░░░░░░░░░░░░░░░░░░░░░░░ 18h 30m
```

Bar width is scaled relative to the longest dwell (30 chars). Bars use cyan `█` and dim `░`.

### Examples

```bash
# Show story detail
ao story 62-26-cli-sprint-commands

# Show story for specific project
ao story 62-26 my-project

# JSON output for scripting
ao story 62-26 --json | jq '.totalCycleTimeMs'
```

### JSON Output Shape

```json
{
  "storyId": "62-26-cli-sprint-commands",
  "currentStatus": "done",
  "epic": "Epic 62",
  "isCompleted": true,
  "totalCycleTimeMs": 345600000,
  "transitions": [
    {
      "fromStatus": "backlog",
      "toStatus": "ready-for-dev",
      "timestamp": "2026-04-21T14:30:00.000Z",
      "dwellMs": 280800000
    }
  ],
  "columnDwells": [
    {
      "column": "backlog",
      "totalDwellMs": 280800000
    }
  ]
}
```

---

## ao story-status

```bash
ao story-status [storyId]
```

View story and agent status. Reads `sprint-status.yaml` from the current working directory — no tracker plugin required.

### Flags

| Flag | Description |
|------|-------------|
| `--agent <id>` | Show status for specific agent |
| `--format <format>` | Output format (table, json) — default: table |
| `--status <status>` | Filter by story status |
| `--agent-status <status>` | Filter by agent status |
| `--sort-by <field>` | Sort by field (id, status, agent, activity) — default: id |

### Three Display Modes

**1. Table view** (default — no storyId, no `--agent`):

Displays a `header()` box with `STORY STATUS`, followed by a table:

| Column | Width |
|--------|-------|
| Story ID | 12 |
| Title | 40 |
| Agent | 15 |
| Agent Status | 15 |
| Last Activity | 18 |
| Story Status | remaining |

Agent status uses emoji prefixes:

| Agent Status | Emoji |
|-------------|-------|
| spawning | 🟡 |
| active | 🟢 |
| idle | 🟠 |
| completed | ✅ |
| blocked | 🔴 |
| disconnected | ⚫ |

Story status uses emoji prefixes:

| Story Status | Emoji |
|-------------|-------|
| backlog | 📋 |
| ready-for-dev | 🟡 |
| in-progress | 🔵 |
| review | 👁️ |
| done | ✅ |

Summary line: `Summary: 20 stories | 12 done | 3 in-progress | 2 ready-for-dev | 3 backlog`

**2. Story detail view** (with storyId argument):

Displays story ID, status, agent assignment (agent name, status, assigned time, working duration), dependencies (prerequisites and dependents), and story context hash.

If no agent is assigned: `This story is ready to be picked up.`

**3. Agent detail view** (with `--agent` flag):

Displays agent status, session info, and current assignment (story, assigned time, working duration, context hash).

### Performance Warning

If the query takes longer than 1000ms: `Warning: Status query took <n>ms (>1000ms target)`

### Examples

```bash
# Show all stories in table format
ao story-status

# Show specific story detail
ao story-status 62-26-cli-sprint-commands

# Show agent assignment detail
ao story-status --agent agent-1

# Filter by status
ao story-status --status in-progress

# Sort by activity (most recent first)
ao story-status --sort-by activity

# JSON output for scripting
ao story-status --format json | jq '.summary'
```

### JSON Output Shape (table view)

```json
{
  "stories": [
    {
      "storyId": "62-26-cli-sprint-commands",
      "title": "CLI Sprint Commands",
      "agentId": "agent-1",
      "agentStatus": "active",
      "storyStatus": "done",
      "lastActivity": "2h ago",
      "dependencies": null
    }
  ],
  "summary": {
    "total": 20,
    "done": 12,
    "inProgress": 3,
    "readyForDev": 2,
    "backlog": 3,
    "activeAgents": 2,
    "idleAgents": 1,
    "blockedAgents": 0
  }
}
```

---

## ao epic

```bash
ao epic [project] [epic-id]
```

Epic management: list/show epics, or use subcommands (create, rename, delete). Requires the bmad tracker plugin.

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### Bmad Tracker Requirement

If the tracker is not bmad, the command exits with: `Epic management requires the bmad tracker plugin.`

If the tracker is bmad but does not support listing issues: `Tracker does not support listing issues.`

### Epic List View

Without an epic-id argument, displays a `header()` box with `Epic Progress: <project>`, followed by each epic:

```text
  epic-62  Documentation
          [████████████░░░░] 26/64 stories (41%)
          open: 38  in-progress: 0  done: 26
```

Progress bar uses green `█` and dim `░` (16 chars wide).

### Single Epic Detail

With an epic-id argument, displays progress bar, story counts, and a story listing:

```text
  [████████████░░░░] 26/64 stories (41%)

  Stories:
    62-23-cli-index            CLI Reference Index Page          done
    62-24-cli-setup-commands   CLI Setup Commands Docume...      done
    62-25-cli-session-commands CLI Session Commands Docu...      done
```

Story IDs are padded to 24 chars, titles truncated at 36 chars. States are color-coded: done=green, in-progress=yellow, backlog=dim.

### JSON Output Shape

**List view** (no epic-id):

```json
[
  {
    "id": "epic-62",
    "title": "Documentation",
    "open": 38,
    "inProgress": 0,
    "done": 26,
    "total": 64,
    "stories": [
      { "id": "62-23", "title": "CLI Reference Index Page", "state": "closed" }
    ]
  }
]
```

**Single epic view** (with epic-id): returns the full `EpicSummary` object including `id`, `title`, `open`, `inProgress`, `done`, and `stories` array with complete `Issue` objects.

If epic not found: `{ "error": "Epic not found: <epic-id>" }`

### Subcommands

`ao epic` supports 3 subcommands:

---

#### ao epic create

```bash
ao epic create <title> [project]
```

Create a new epic. Requires the bmad tracker plugin.

**Flags:**

| Flag | Description |
|------|-------------|
| `--description <text>` | Epic description |
| `--json` | Output as JSON |

**Output:**

```text
Created epic: epic-62
  File: _bmad-output/planning-artifacts/epic-62.md
```

**Examples:**

```bash
# Create an epic
ao epic create "Dashboard UI"

# Create with description
ao epic create "Auth System" --description "User authentication and authorization"

# JSON output
ao epic create "Auth System" --json
```

---

#### ao epic rename

```bash
ao epic rename <epic-id> <new-title> [project]
```

Rename an epic. Requires the bmad tracker plugin.

**Flags:**

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

**Output:**

```text
Renamed epic-62 → "Documentation v2"
```

**Examples:**

```bash
# Rename an epic
ao epic rename epic-62 "Documentation v2"

# JSON output
ao epic rename epic-62 "New Title" --json
```

---

#### ao epic delete

```bash
ao epic delete <epic-id> [project]
```

Delete an epic. Requires the bmad tracker plugin.

**Flags:**

| Flag | Description |
|------|-------------|
| `--clear-stories` | Clear epic field from associated stories |
| `--json` | Output as JSON |

**Output:**

```text
Deleted epic: epic-62
  Affected stories: 62-1-title, 62-2-title
```

The `Affected stories` line only appears when `--clear-stories` is used and stories were updated.

**Examples:**

```bash
# Delete an epic
ao epic delete epic-62

# Delete and clear stories
ao epic delete epic-62 --clear-stories

# JSON output
ao epic delete epic-62 --json
```

---

## ao create

```bash
ao create [project]
```

Create a new story in the BMad tracker. Requires the bmad tracker plugin.

{: .highlight }
**Note:** `ao create` is also documented in [Setup Commands](./setup-commands.md) since it is part of the project setup workflow.

### Flags

| Flag | Description |
|------|-------------|
| `-t, --title <title>` | Story title |
| `-e, --epic <epic>` | Epic identifier (e.g. epic-auth) |
| `-d, --description <desc>` | Story description |
| `--json` | Output as JSON |

### Bmad Tracker Requirement

If the tracker is not bmad, the command exits with: `Story creation requires the bmad tracker plugin.`

If the tracker lacks issue creation support: `Tracker does not support issue creation.`

Note: `--title` is a required option (registered via `.requiredOption()`).

### Output

Displays a `header()` box with `Story Created`, followed by:

```text
  ID:     <story-id>
  Title:  <story-title>
  State:  backlog
  Epic:   <epic>          (only if --epic provided)

  Story file: story-<id>.md
```

### Examples

```bash
# Create a story with title
ao create --title "Add user authentication"

# Create with epic and description
ao create -t "Fix login bug" -e epic-auth -d "Login fails on special characters"

# JSON output
ao create --title "New feature" --json
```

---

## ao history

```bash
ao history [project]
```

Show sprint transition history with optional filters. Requires the bmad tracker plugin.

### Flags

| Flag | Description |
|------|-------------|
| `--story <id>` | Filter by story ID |
| `--epic <id>` | Filter by epic ID |
| `--from <date>` | Start date (YYYY-MM-DD, inclusive) |
| `--to <date>` | End date (YYYY-MM-DD, inclusive) |
| `--status <status>` | Filter by target status |
| `--search <text>` | Search history by text |
| `--limit <n>` | Limit number of entries (default: 50) |
| `--json` | Output as JSON |

### Bmad Tracker Requirement

If the tracker is not bmad, the command exits with: `History requires the bmad tracker plugin.`

### Output

Displays a `header()` box with `Sprint History: <project>`, followed by timeline entries:

```text
  2026-04-21 14:30:00  62-26-cli-spri  backlog → ready-for-dev
  2026-04-22 09:15:00  62-26-cli-spri  ready-for-dev → in-progress
                              "Started implementation"
  2026-04-24 10:30:00  62-26-cli-spri  review → done
```

Each entry shows: timestamp (ISO format with T and Z stripped), story ID (padded to 12 chars), and transition arrow. Comments appear indented on the next line in dim text.

If results exceed the limit: `Showing last <n> of <total> entries`

### Examples

```bash
# Show all history
ao history

# Filter by story
ao history --story 62-26-cli-sprint-commands

# Filter by date range
ao history --from 2026-04-20 --to 2026-04-24

# Filter by epic and status
ao history --epic epic-62 --status done

# Search history text
ao history --search "sprint-commands"

# Limit results
ao history --limit 10

# JSON output
ao history --json
```

### JSON Output Shape

```json
{
  "entries": [
    {
      "storyId": "62-26-cli-sprint-commands",
      "fromStatus": "backlog",
      "toStatus": "ready-for-dev",
      "timestamp": "2026-04-21T14:30:00.000Z",
      "comment": null
    }
  ],
  "total": 150
}
```

---

## ao agent-history

```bash
ao agent-history <agent-id>
```

View agent learning history. Reads `learnings.jsonl` directly — no tracker plugin required.

### Flags

| Flag | Description |
|------|-------------|
| `--since <time>` | Filter by time window (e.g., 7d, 30d) |
| `--limit <n>` | Max records to show (default: 20) |
| `--json` | Output as JSONL |

### Output

Displays a bold header with the agent ID and record count, followed by a columnar table:

```text
  Learning History for agent-1 (3 sessions)

  Story                           Outcome      Duration   Domains                   Date
  ────────────────────────────── ──────────── ────────── ───────────────────────── ────────────
  62-26-cli-sprint-commands      🟢 completed 2h 30m     frontend, documentation   2026-04-24
  62-25-cli-session-commands     🟢 completed 4h 15m     testing                   2026-04-23
  62-24-cli-setup-commands       🔴 failed    1h 10m     cli, typescript           2026-04-22
```

Outcome emojis:

| Outcome | Emoji |
|---------|-------|
| completed | 🟢 |
| failed | 🔴 |
| blocked | 🟡 |
| abandoned | ⚫ |
| (unknown) | ❓ |

### Time Filter

The `--since` flag accepts time deltas: `7d` (7 days), `30d` (30 days), `2h` (2 hours). Invalid format produces: `Invalid time format: "<value>". Use: 7d, 30d, 2h`

### JSON Output

With `--json`, outputs one JSON object per line (JSONL format):

```text
{"storyId":"62-26-cli-sprint-commands","outcome":"completed","durationMs":9000000,"domainTags":["frontend","documentation"],"completedAt":"2026-04-24T16:00:00.000Z"}
```

### Examples

```bash
# Show learning history for an agent
ao agent-history agent-1

# Show last 7 days
ao agent-history agent-1 --since 7d

# Limit to 5 records
ao agent-history agent-1 --limit 5

# JSONL output for processing
ao agent-history agent-1 --json
```

---

## Tracker Requirements

{: .highlight }
**Which commands need which tracker:**

| Tracker | Commands |
|---------|----------|
| **bmad required** (exit with error) | `story`, `epic` (all subcommands), `create`, `history` |
| **No tracker needed** | `story-status` (reads YAML from cwd), `agent-history` (reads JSONL) |

---

## Cross-Cutting Patterns

- 4 of 6 commands use `loadConfig()` + `resolveProject()` — `story-status` and `agent-history` do not use `resolveProject()`
- No ora spinners in any Story command — all output via direct `chalk`/`console.log`
- Config error strings vary between commands — some use backtick quotes `` `ao init` ``, others use single quotes `'ao init'`
- `story-status` reads `sprint-status.yaml` from `process.cwd()` directly — no config path resolution
- `agent-history` reads `learnings.jsonl` from the sessions directory — no tracker dependency
- Performance warning threshold: `story-status` uses >1000ms (vs >500ms in `sprint-plan`)

---

## Next Steps

- [CLI Reference](./index.md) — command category index
- [Setup Commands](./setup-commands.md) — init, start, stop, create, plugins, sprint-config
- [Session Commands](./session-commands.md) — spawn, pause, resume, session, send, open, agent, assign
- [Sprint Commands](./sprint-commands.md) — sprint, sprint-start, sprint-end, velocity, plan
- [Monitoring Commands](./monitoring.md) — fleet, burndown, logs, events
- [Review & PR Commands](./review-pr.md) — review and PR management
- [Intelligence Commands](./intelligence.md) — learning, patterns, history
- [Infrastructure Commands](./infrastructure.md) — health, diagnostics
- [Getting Started](../getting-started.md) — installation and quick start
- [Configuration](../configuration.md) — agent-orchestrator.yaml reference
