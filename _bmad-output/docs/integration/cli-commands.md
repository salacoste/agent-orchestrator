# BMad CLI Commands

## Overview

The Agent Orchestrator CLI (`ao`) includes a suite of sprint analytics commands purpose-built for the BMad file-based tracker plugin. These commands read local `sprint-status.yaml` and `story-*.md` files from the BMad output directory -- no external API calls required.

### Prerequisites

All BMad-specific commands require the `bmad` tracker plugin configured in your project:

```yaml
# agent-orchestrator.yaml
projects:
  my-project:
    tracker:
      plugin: bmad
```

Commands that are BMad-exclusive (`create`, `health`, `metrics`, `retro`, `story`) validate the tracker plugin on startup and exit with a clear error if a different tracker is configured. The `sprint`, `stories`, and `epic` commands work with any tracker that implements `listIssues`, but surface BMad-specific features (forecast, column grouping, epic title resolution) when the bmad plugin is active.

### Common Patterns

**Project resolution.** All commands accept an optional `[project]` argument. When omitted, the CLI auto-selects the project if only one is configured. When multiple projects exist, the command exits with an error listing available project IDs.

**JSON output.** Every command supports `--json` for machine-readable output. JSON mode emits the full data structure to stdout and skips formatted display. Useful for piping into `jq`, dashboards, or CI scripts.

**BMad guard.** Commands that depend on BMad internals (health, metrics, retro, story) check `tracker.name === "bmad"` and exit with a descriptive error like `"Health indicators require the bmad tracker plugin."` if the wrong tracker is configured.

**Session cross-referencing.** The `sprint` and `stories` commands look up active sessions and annotate stories that have a running agent session. Session lookup is non-fatal -- if the session manager is unavailable, the command proceeds without session annotations.

---

## Command Reference

### `ao sprint [project]`

Show sprint progress with stories grouped by BMad status column.

**Syntax:**

```
ao sprint [project] [--compact] [--json]
```

**Options:**

| Option      | Description                          |
| ----------- | ------------------------------------ |
| `--compact` | Show only column counts, no stories  |
| `--json`    | Output full sprint data as JSON      |

**What it displays:**

1. **Progress bar** -- visual bar showing done/total stories: `[████████░░░░░░░░░░░░] 8/20 stories`
2. **Forecast line** -- when velocity data is available, shows days remaining, projected completion date, pace indicator (ahead/on-pace/behind in green/yellow/red), and current velocity (stories/day)
3. **Column breakdown** -- stories grouped under the five BMad columns in order:
   - `backlog` (dim)
   - `ready-for-dev` (yellow)
   - `in-progress` (cyan)
   - `review` (blue)
   - `done` (green)
4. **Session annotations** -- stories with active agent sessions show the session ID and activity state (e.g., `<- s3 (working)`)

**Example output:**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Sprint Progress: my-project                                              │
└────────────────────────────────────────────────────────────────────────────┘

  [████████░░░░░░░░░░░░] 8/20 stories
  Forecast: 5d remaining -- 03/09 -- on-pace -- velocity 1.6/day

  backlog (4)
    STORY-001               Set up auth module
    STORY-002               Design landing page

  ready-for-dev (3)
    STORY-010               Implement search API
    STORY-011               Add pagination

  in-progress (2)
    STORY-020               Build user profile     <- s3 (working)
    STORY-021               Fix login redirect     <- s4 (idle)

  review (3)
    STORY-030               API rate limiting

  done (8)
    STORY-040               Database migrations
    STORY-041               CI pipeline setup
```

**JSON structure:**

```json
{
  "projectId": "my-project",
  "totalStories": 20,
  "doneCount": 8,
  "inProgressCount": 2,
  "openCount": 10,
  "columns": {
    "backlog": [{ "id": "STORY-001", "title": "Set up auth module", "sessionInfo": null }],
    "ready-for-dev": [],
    "in-progress": [{ "id": "STORY-020", "title": "Build user profile", "sessionInfo": "s3 (working)" }],
    "review": [],
    "done": []
  },
  "forecast": {
    "currentVelocity": 1.6,
    "daysRemaining": 5,
    "projectedCompletionDate": "2026-03-09",
    "pace": "on-pace"
  }
}
```

---

### `ao health [project]`

Show sprint health indicators that flag problems requiring attention.

**Syntax:**

```
ao health [project] [--json]
```

**Options:**

| Option   | Description                          |
| -------- | ------------------------------------ |
| `--json` | Output health result as JSON         |

**What it displays:**

- **Overall severity** -- the highest severity across all indicators: `OK`, `WARNING`, or `CRITICAL`
- **Individual indicators** -- each with a severity badge and details:
  - Stuck stories (stories in a column longer than expected)
  - WIP limit alerts (too many stories in-progress simultaneously)
  - Throughput drops (velocity declining compared to recent average)
  - Column bottlenecks (disproportionate dwell times)

**Severity badges:**

- `CRITICAL` (red) -- immediate attention required
- `WARNING` (yellow) -- investigate soon
- `OK` (green) -- no issues detected

**Example output:**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Sprint Health: my-project                                                │
└────────────────────────────────────────────────────────────────────────────┘

  Overall: ▲ WARNING

  ▲ WARNING  2 stories stuck in review > 3 days
    -> STORY-030: API rate limiting (4d 6h)
    -> STORY-031: Payment integration (3d 12h)

  ● CRITICAL  WIP limit exceeded: 5 stories in-progress (limit: 3)
    -> STORY-020, STORY-021, STORY-022, STORY-023, STORY-024
```

When no issues are detected:

```
  ✓ Sprint Health: OK
  No issues detected.
```

**BMad guard:** This command requires the bmad tracker. Running with a different tracker produces:

```
Error: Health indicators require the bmad tracker plugin.
```

---

### `ao metrics [project]`

Show cycle time analytics with throughput and column dwell breakdowns.

**Syntax:**

```
ao metrics [project] [--json]
```

**Options:**

| Option   | Description                          |
| -------- | ------------------------------------ |
| `--json` | Output cycle time stats as JSON      |

**What it displays:**

1. **Summary statistics:**
   - Completed stories count
   - Average cycle time (time from first non-backlog transition to done)
   - Median cycle time
   - Throughput over 7 days (stories/day)
   - Throughput over 4 weeks (stories/week)

2. **Column dwell bar chart** -- horizontal bars showing average time spent in each column, with the bottleneck column highlighted in red

**Example output:**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Cycle Time Metrics: my-project                                           │
└────────────────────────────────────────────────────────────────────────────┘

  Completed stories: 12
  Average cycle time: 2d 14h
  Median cycle time:  2d 3h
  Throughput (7d):    1.71 stories/day
  Throughput (4w):    8.5 stories/week

  Column Dwell Times (avg):
    backlog          ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 4h
    ready-for-dev    ████░░░░░░░░░░░░░░░░░░░░░░░░░░ 8h
    in-progress      ██████████████████████████░░░░ 1d 12h
    review           ██████████████████████████████ 1d 18h <- bottleneck
    done             ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0m
```

**Duration formatting:** Values are shown as combinations of days, hours, and minutes (e.g., `2d 14h`, `8h 30m`, `45m`).

When no stories have been completed yet:

```
  No completed stories yet. Metrics will appear as stories are done.
```

**BMad guard:** This command requires the bmad tracker. Running with a different tracker produces:

```
Error: Metrics require the bmad tracker plugin.
```

---

### `ao retro [project]`

Show sprint retrospective analytics with weekly velocity trends and carry-over tracking.

**Syntax:**

```
ao retro [project] [--json]
```

**Options:**

| Option   | Description                             |
| -------- | --------------------------------------- |
| `--json` | Output retrospective result as JSON     |

**What it displays:**

1. **Weekly periods table** -- each row shows:
   - Week start date
   - Completed count for that period
   - Average cycle time for stories completed in that period
   - Carry-over count (stories that rolled into the next period)

2. **Velocity summary:**
   - Total completed across all periods
   - Average velocity (stories/week)
   - Velocity change percentage (green for positive, red for negative)
   - Overall average cycle time

**Example output:**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Sprint Retrospective: my-project                                         │
└────────────────────────────────────────────────────────────────────────────┘

  Week          Completed   Avg Cycle   Carry-over
  --------------------------------------------------
  2026-02-17    3           1d 8h       2
  2026-02-24    5           2d 1h       1
  2026-03-03    4           1d 14h      3

  Total completed:   12
  Average velocity:  4.0 stories/week
  Velocity change:   +12.5%
  Avg cycle time:    1d 18h
```

When no stories have been completed yet:

```
  No completed stories yet. Retrospective data will appear as stories are done.
```

**BMad guard:** This command requires the bmad tracker. Running with a different tracker produces:

```
Error: Retrospective requires the bmad tracker plugin.
```

---

### `ao story <id> [project]`

Show detailed information for a single story including its full transition timeline.

**Syntax:**

```
ao story <id> [project] [--json]
```

**Arguments:**

| Argument  | Required | Description                              |
| --------- | -------- | ---------------------------------------- |
| `<id>`    | Yes      | Story identifier (e.g., `STORY-001`)     |
| `[project]` | No    | Project ID (auto-resolved if single)     |

**Options:**

| Option   | Description                          |
| -------- | ------------------------------------ |
| `--json` | Output story detail as JSON          |

**What it displays:**

1. **Status** -- current BMad status with color coding
2. **Epic** -- the epic this story belongs to (if any)
3. **Cycle time** -- total cycle time (only shown for completed stories)
4. **Timeline** -- chronological list of status transitions, each showing:
   - Timestamp (month, day, hour:minute)
   - From status -> to status
   - Dwell duration in the previous status
5. **Column dwell bar chart** -- horizontal bars showing total time spent in each column

**Example output:**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Story: STORY-020                                                         │
└────────────────────────────────────────────────────────────────────────────┘

  Status:  in-progress
  Epic:    epic-auth

  Timeline:
    Feb 20, 09:00  backlog -> ready-for-dev (after 2d)
    Feb 22, 14:30  ready-for-dev -> in-progress (after 2d 5h)
    Feb 24, 10:00  in-progress -> review (after 1d 19h)
    Feb 25, 16:45  review -> in-progress (after 1d 6h)

  Column Dwell Times:
    backlog          ████████░░░░░░░░░░░░░░░░░░░░░░ 2d
    ready-for-dev    ██████████░░░░░░░░░░░░░░░░░░░░ 2d 5h
    in-progress      ██████████████████████████████ 3d 1h
    review           ██████░░░░░░░░░░░░░░░░░░░░░░░░ 1d 6h
```

For completed stories, cycle time is shown:

```
  Status:     done
  Epic:       epic-auth
  Cycle time: 5d 8h
```

When no transitions have been recorded:

```
  No transitions recorded yet.
```

**BMad guard:** This command requires the bmad tracker. Running with a different tracker produces:

```
Error: Story detail requires the bmad tracker plugin.
```

---

### `ao stories [project]`

List all stories with status, epic, and active session cross-references. This is a generic tracker command that works with any tracker implementing `listIssues`, but provides enhanced output when used with BMad.

**Syntax:**

```
ao stories [project] [--state <state>] [--epic <id>] [--json]
```

**Options:**

| Option           | Description                                   | Default |
| ---------------- | --------------------------------------------- | ------- |
| `--state <state>` | Filter by state: `open`, `closed`, `all`     | `open`  |
| `--epic <id>`    | Filter by epic label (e.g., `epic-auth`)      | --      |
| `--json`         | Output stories array as JSON                  | --      |

**What it displays:**

A table grouped by epic with columns:
- **Story** -- story identifier
- **Title** -- story title (truncated to 40 characters)
- **Status** -- issue state with color coding (`open` yellow, `in_progress` blue, `closed` green, `cancelled` dim)
- **Epic** -- epic label or `-` if none
- **Session tag** -- active session ID in magenta brackets (e.g., `[s3]`) if a non-terminal session exists for this story

**Example output:**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ my-project -- Stories                                                    │
└────────────────────────────────────────────────────────────────────────────┘

  Story           Title                                   Status        Epic
  ──────────────────────────────────────────────────────────────────────────────
  STORY-001       Set up auth module                      open          epic-auth
  STORY-020       Build user profile                      in_progress   epic-auth [s3]
  STORY-010       Implement search API                    open          epic-search
  STORY-040       Database migrations                     closed        epic-infra

  4 stories (filter: open)
```

**JSON structure:** Each story in the array includes all `Issue` fields plus a `session` field (session ID string or `null`).

```json
[
  {
    "id": "STORY-001",
    "title": "Set up auth module",
    "state": "open",
    "labels": ["epic-auth", "backlog"],
    "session": null
  },
  {
    "id": "STORY-020",
    "title": "Build user profile",
    "state": "in_progress",
    "labels": ["epic-auth", "in-progress"],
    "session": "s3"
  }
]
```

**Tracker guard:** Requires any tracker with `listIssues` support. Without a tracker configured:

```
Error: No tracker configured for project "my-project".
```

---

### `ao epic [project] [epic-id]`

Show epic-level progress with story counts and completion percentages.

**Syntax:**

```
ao epic [project] [epic-id] [--json]
```

**Arguments:**

| Argument     | Required | Description                                   |
| ------------ | -------- | --------------------------------------------- |
| `[project]`  | No       | Project ID (auto-resolved if single)          |
| `[epic-id]`  | No       | Specific epic to drill into (e.g., `epic-auth`) |

**Options:**

| Option   | Description                          |
| -------- | ------------------------------------ |
| `--json` | Output epic data as JSON             |

**What it displays:**

**Without `epic-id` (all epics):**

For each epic:
- Epic ID and title (title resolved from BMad epic files when the bmad tracker is active)
- Progress bar showing done/total stories with percentage
- Breakdown: open, in-progress, done counts

**With `epic-id` (single epic):**

- Progress bar with percentage
- Full story list showing each story's ID, title (truncated to 36 characters), and status

**Example output (all epics):**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Epic Progress: my-project                                                │
└────────────────────────────────────────────────────────────────────────────┘

  epic-auth  Authentication System
          [████████████░░░░] 3/4 stories (75%)
          open: 0  in-progress: 1  done: 3

  epic-search  Search & Discovery
          [████░░░░░░░░░░░░] 1/5 stories (20%)
          open: 3  in-progress: 1  done: 1
```

**Example output (single epic):**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Epic: Authentication System (epic-auth)                                  │
└────────────────────────────────────────────────────────────────────────────┘

  [████████████░░░░] 3/4 stories (75%)

  Stories:
    STORY-001                Set up auth module                  done
    STORY-002                OAuth integration                   done
    STORY-003                Password reset flow                 done
    STORY-020                Build user profile                  in-progress
```

**Tracker guard:** Requires any tracker with `listIssues` support. Epic title resolution from BMad files is only available when `tracker.plugin === "bmad"`.

---

### `ao create [project]`

Create a new story in the BMad tracker with auto-generated ID.

**Syntax:**

```
ao create [project] -t <title> [-e <epic>] [-d <description>] [--json]
```

**Arguments:**

| Argument    | Required | Description                              |
| ----------- | -------- | ---------------------------------------- |
| `[project]` | No       | Project ID (auto-resolved if single)     |

**Options:**

| Option                    | Required | Description                                 |
| ------------------------- | -------- | ------------------------------------------- |
| `-t, --title <title>`     | Yes      | Story title (used as H1 heading in markdown) |
| `-e, --epic <epic>`       | No       | Epic identifier (e.g., `epic-auth`)          |
| `-d, --description <desc>` | No     | Story description body                       |
| `--json`                  | No       | Output created issue as JSON                 |

**What it does:**

1. Auto-generates a story ID by finding the highest numeric suffix across existing story IDs and incrementing it (e.g., if `s5` is the highest, the new story is `s6`).
2. Adds the story entry to `sprint-status.yaml` with status `backlog`.
3. Creates a `story-{id}.md` file with the title, description, and a placeholder acceptance criteria section.
4. Records a history entry in `sprint-history.jsonl`.

**Example output:**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Story Created                                                            │
└────────────────────────────────────────────────────────────────────────────┘

  ID:    s6
  Title: Implement user notifications
  State: backlog
  Epic:  epic-auth

  Story file: story-s6.md
```

**JSON structure:**

```json
{
  "id": "s6",
  "title": "Implement user notifications",
  "description": "# Implement user notifications\n\nTODO: Add story description\n\n## Acceptance Criteria\n\n- [ ] TODO: Define acceptance criteria\n",
  "url": "file:///path/to/project/_bmad-output/implementation-artifacts/story-s6.md",
  "state": "open",
  "labels": ["epic-auth", "backlog"]
}
```

**BMad guard:** This command requires the bmad tracker. Running with a different tracker produces:

```
Error: Story creation requires the bmad tracker plugin.
```

---

## Integration with Session Management

### Pre-spawn Story Validation

When `ao spawn` is invoked with a story ID, the session manager validates the story through the tracker's `validateIssue` method before creating any resources. For the BMad tracker, validation checks:

1. **Story file exists** -- `story-{id}.md` must be present in the BMad output directory
2. **Story file is not empty** -- the file must have content
3. **Story has a title** -- a `# heading` must be present
4. **Story has acceptance criteria** -- at least one acceptance criterion is required
5. **Story status is valid for spawning** -- stories in `done`, `in-progress`, or `review` status are rejected (only `backlog` and `ready-for-dev` are spawnable)
6. **Tech spec presence** -- a missing tech spec file triggers a warning (non-blocking)

If validation fails, spawn aborts with a descriptive error:

```
Error: Story validation failed for STORY-001:
  - Story has no acceptance criteria
  - Story is already in progress
```

### Auto-transition on Spawn

When a session is successfully spawned with a resolved story, the session manager automatically transitions the story's tracker status to `in_progress`. This update is non-fatal -- if the tracker update fails, the session is still created.

### Sprint Board Session Annotations

`ao sprint` cross-references active sessions with stories by looking up the session manager for the project. Each story with a running session shows the session ID and current activity state (e.g., `working`, `idle`, `waiting`). Session lookup failure is non-fatal -- the sprint board renders without annotations.

### Batch Spawn with Ready Discovery

`ao batch-spawn` supports a `--ready` flag that auto-discovers stories with `ready-for-dev` status from the tracker:

```
ao batch-spawn my-project --ready
```

This queries the tracker for open issues with the `ready-for-dev` label, deduplicates against explicitly provided issue IDs and existing active sessions, and spawns sessions for all eligible stories. Stories that already have a non-terminal session are skipped with a message.

---

## BMad Sprint Columns

All BMad commands operate on a fixed set of five ordered sprint columns:

| Column          | Color   | Category      |
| --------------- | ------- | ------------- |
| `backlog`       | dim     | open          |
| `ready-for-dev` | yellow  | open          |
| `in-progress`   | cyan    | in-progress   |
| `review`        | blue    | in-progress   |
| `done`          | green   | done          |

The `categorizeStatus()` helper maps these into three buckets (`open`, `in-progress`, `done`) used for progress calculations and forecast computations. Stories with unrecognized status labels are placed in `backlog`.

---

## Error Handling

All commands follow the same error handling pattern:

1. **Config not found** -- `"No config found. Run ao init first."` (exit 1)
2. **Project not found** -- `"Project config not found: {id}"` or `"Unknown project: {id}"` with available projects listed (exit 1)
3. **Tracker not configured** -- `"No tracker configured for this project."` (exit 1)
4. **Wrong tracker** -- BMad-specific commands show `"{Command} require(s) the bmad tracker plugin."` (exit 1)
5. **Tracker operation failure** -- `"Failed to {operation}: {error message}"` (exit 1)
6. **Session lookup failure** -- silently continues without session data (non-fatal)
