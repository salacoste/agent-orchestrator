---
title: Review & PR Commands
nav_order: 6
parent: CLI Reference
description: Code review analytics, PR monitoring, conflict detection and resolution — review-check, review-stats, rework, resolve, resolve-conflicts, and conflicts commands.
---

# Review & PR Commands

6 commands for code review analytics, PR monitoring, rework detection, and conflict resolution: check PRs for review comments and auto-trigger fix prompts, view review analytics with severity charts, detect sprint rework, and resolve agent assignment and version conflicts.

## Command Summary

| Command | Description | `--json` | bmad Required | SCM Required |
|---------|-------------|----------|---------------|--------------|
| `ao review-check [project]` | Check PRs for review comments and trigger agents to address them | No | No | Yes |
| `ao review-stats` | View code review analytics | Yes | No | No |
| `ao rework [project]` | Show rework/churn detection for sprint stories | Yes | Yes | No |
| `ao resolve [conflictId]` | Resolve agent assignment conflicts | Yes | No | No |
| `ao resolve-conflicts [storyId]` | Detect and resolve version conflicts | Yes (`--format json`) | No | No |
| `ao conflicts` | List and manage agent assignment conflicts | Yes | No | No |

{: .highlight }
**Tracker requirements:** `ao rework` requires the bmad tracker plugin. `ao review-check` requires an SCM plugin (e.g., `scm-github`) for PR detection. All other commands use `loadConfig()` or read files directly.

---

## ao review-check

```bash
ao review-check [project]
```

Check PRs for review comments and trigger agents to address them. Iterates over active sessions, detects open PRs via the SCM plugin, and sends fix prompts to agents with pending reviews.

### Flags

| Flag | Description |
|------|-------------|
| `[project]` | Project ID (checks all if omitted) |
| `--dry-run` | Show what would be done without sending messages |

### Output

Uses an ora spinner: `Checking PRs for review comments...`

The command iterates all active sessions (optionally filtered by project), and for each:

1. Skips sessions whose project has no `repo` configured
2. Gets the SCM plugin and calls `scm.detectPR(session, project)` to find open PR
3. Calls `scm.getPendingComments(pr)` and `scm.getReviewDecision(pr)` in parallel
4. Includes the session if `commentCount > 0` or `reviewDecision === "changes_requested"`

If no pending reviews found: `No pending review comments found.` (green)

When reviews found:

```text
Found 2 sessions with pending reviews:

  agent-1  PR #42
    Decision: changes_requested
    Comments: 3
    -> Fix prompt sent
```

Decision and Comments lines shown in yellow. Fix prompt in green on success.

**Auto-fix message** (sent to agent session):

```
There are review comments on your PR. Check with `gh pr view --comments`
and `gh api` for inline comments. Address each one, push fixes, and reply.
```

### Dry Run Mode

With `--dry-run`, displays what would happen without sending messages:

```text
  agent-1  PR #42
    Decision: changes_requested
    Comments: 3
    (dry run — would send fix prompt)
```

### Error Handling

Unknown project: `Unknown project: <id>` (red)

Send failure: `Failed to send: <error>` (red)

### Examples

```bash
# Check all sessions for pending reviews
ao review-check

# Check specific project
ao review-check my-project

# Preview without sending messages
ao review-check --dry-run
```

---

## ao review-stats

```bash
ao review-stats
```

View code review analytics. Reads from `<sessionsDir>/review-findings.jsonl` and displays severity distribution, top categories, and resolution rate.

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### Output

Displays severity distribution with colored bar charts:

```text
  Code Review Analytics (24 findings)

  Findings by Severity:
    high   ████████████████████        8
    medium ████████████████████████████ 12
    low    ████                        4

  Top Issue Categories:
    1. code-style          8 occurrences
    2. security            5 occurrences
    3. error-handling      4 occurrences
    4. naming              3 occurrences
    5. type-safety         2 occurrences

  Resolution Rate: 67% (16/24 fixed)
```

Severity colors: high = red, medium = yellow, low = green. Bar uses `█` repeated up to 30 times (one `█` per finding, capped at 30).

No data: `No review data available.` (yellow)

### Examples

```bash
# Show review analytics
ao review-stats

# JSON output for scripting
ao review-stats --json | jq '.fixRate'
```

### JSON Output Shape

```json
{
  "total": 24,
  "bySeverity": {
    "high": 8,
    "medium": 12,
    "low": 4
  },
  "byCategory": {
    "code-style": 8,
    "security": 5,
    "error-handling": 4,
    "naming": 3,
    "type-safety": 2
  },
  "fixRate": 0.67
}
```

---

## ao rework

```bash
ao rework [project]
```

Show rework/churn detection for sprint stories. Displays rework rate, transition statistics, and worst offending stories.

### Flags

| Flag | Description |
|------|-------------|
| `[project]` | Project ID (auto-resolves if only one project) |
| `--epic <id>` | Filter by epic ID |
| `--json` | Output as JSON |

### Output

Displays a `header()` box with `Rework Detection: <projectName>` (falls back to project ID if name is not set), followed by summary stats and details.

No rework: `  No rework detected. All transitions were forward.` (dim)

When rework detected:

```text
  Rework rate:     15.0%
  Total events:    48
  Total rework:    6.2h

  Transition Stats:
  From               To                 Count  Avg Time
  in-progress        ready-for-dev      5      1.2h
  review             in-progress        3      2.0h

  Worst Offenders:
    62-15-auth-module   3 rework(s) (4.5h)
    62-20-scm-plugin    2 rework(s) (1.7h)
```

Rework count in red. Time formatted via `formatMs`: hours `< 24` shows `X.Xh`, days shows `X.Xd`. Avg Time shows `-` when 0.

### Tracker Requirement

Requires bmad tracker plugin: `Rework detection requires the bmad tracker plugin.` (red)

### Examples

```bash
# Show rework for default project
ao rework

# Show rework for specific project
ao rework my-project

# Filter by epic
ao rework --epic 62

# JSON output for scripting
ao rework --json | jq '.reworkRate'
```

### JSON Output Shape

```json
{
  "stories": [],
  "reworkRate": 15,
  "totalReworkEvents": 8,
  "totalReworkTimeMs": 22320000,
  "transitionStats": [
    {
      "from": "in-progress",
      "to": "ready-for-dev",
      "count": 5,
      "averageReworkTimeMs": 4320000
    }
  ],
  "worstOffenders": [
    {
      "storyId": "62-15-auth-module",
      "reworkCount": 3,
      "totalReworkTimeMs": 16200000
    }
  ]
}
```

---

## ao resolve

```bash
ao resolve [conflictId]
```

Resolve agent assignment conflicts. Lists pending conflicts or resolves a specific conflict with priority-based or manual agent selection.

### Flags

| Flag | Description |
|------|-------------|
| `[conflictId]` | The conflict ID to resolve |
| `--list` | List all pending conflicts |
| `--agent <id>` | Keep specific agent (overrides priority-based decision) |
| `--tie-breaker <strategy>` | Tie-breaker strategy: recent, progress — default: recent |
| `--json` | Output as JSON |

### Listing Mode

When no `conflictId` is provided or `--list` is used:

```text
Pending Conflicts (3)

  Conflict ID             Story                Existing   Conflicting  Severity  Detected
  conflict-001            62-15-auth-module    agent-1    agent-3      HIGH      2h ago
  conflict-002            62-20-scm-plugin     agent-2    agent-4      MEDIUM    45m ago
```

No conflicts: `✓ No pending conflicts` (green)

Footer hint: `Resolve a conflict: ao resolve <conflict-id>` (dim)

### Conflict Detail

When a `conflictId` is provided:

```text
Conflict: conflict-001
────────────────────────────────────────────────────────────────
  Story:      62-15-auth-module
  Severity:   HIGH
  Type:       agent-assignment
  Detected:   2h ago
  Agents:
    Existing:    agent-1
    Conflicting: agent-3
  Priority Scores:
    agent-1: 72%
    agent-3: 45%
```

Priority scores colored: `> 0.7` green, `> 0.4` yellow, else red.

Severity formatting:

| Severity | Display |
|----------|---------|
| critical | **CRITICAL** (bold red) |
| high | HIGH (red) |
| medium | MEDIUM (yellow) |
| low | LOW (green) |

### Manual Override

With `--agent <id>`, the specified agent's priority is set to 100% and the other to 0%. Shown in blue with bold agent name:

```text
  Manual override: keeping agent-1
```

If the agent is not part of the conflict: `Agent "<id>" is not part of this conflict` (red)

### Tie-Breaker Strategies

| Strategy | Description |
|----------|-------------|
| `recent` (default) | Prioritize the agent with the most recent activity |
| `progress` | Prioritize the agent with more story progress |

Invalid strategy: `Invalid tie-breaker strategy: <value>` (red), hint: `Valid strategies: recent, progress` (dim)

### Resolution Result

```text
  Resolution: replace_existing
  Kept agent:     agent-3 (green)
  Terminated agent: agent-1 (red)
  Reason:         agent-3 has higher priority score (dim)
  ✓ Conflict resolved successfully
```

### Examples

```bash
# List all pending conflicts
ao resolve --list

# Resolve specific conflict
ao resolve conflict-001

# Keep specific agent (manual override)
ao resolve conflict-001 --agent agent-1

# Use progress-based tie-breaker
ao resolve conflict-001 --tie-breaker progress

# JSON output
ao resolve conflict-001 --json
```

---

## ao resolve-conflicts

```bash
ao resolve-conflicts [storyId]
```

Detect and resolve version conflicts. Checks story state version mismatches and provides interactive or automatic resolution for field-level conflicts.

### Flags

| Flag | Description |
|------|-------------|
| `[storyId]` | Story ID to check for conflicts |
| `--auto <strategy>` | Auto-resolve strategy: overwrite, retry, merge |
| `--format <format>` | Output format: human, json — default: human |
| `--expected-version <version>` | Expected version for conflict detection |
| `--proposed-status <status>` | Proposed status value |
| `--proposed-agent <agent>` | Proposed assigned agent value |

### Conflict Detection

Checks if the story's current version matches the expected version. If they differ, displays a side-by-side diff:

```text
  Conflict detected: 62-15-auth-module
  Version Mismatch:
    Expected: 3
    Actual:   2
  Conflicting Fields (Side-by-Side Diff):
  ┌──────────┬───────────────────┬───────────────────┐
  │ Field    │ Current (v2)      │ Proposed (v1)     │
  ├──────────┼───────────────────┼───────────────────┤
  │ status   │ in-progress       │ review            │
  │ agent    │ agent-1           │ agent-3           │
  └──────────┴───────────────────┴───────────────────┘
```

No conflict: `No conflict detected for <storyId>` (green)

### Resolution Options

When a conflict is detected, three resolution strategies are available. The `[O]`, `[R]`, `[M]` prefixes are shown in green:

```text
  Resolution Options:
  [O]verwrite  - Apply my changes (discards current state)
  [R]etry      - Refresh and reapply my changes
  [M]erge      - Manually merge both versions
```

### Auto-Resolve Mode

With `--auto <strategy>`, resolves without interaction:

```text
  Auto-resolving with strategy: overwrite (blue)
  Conflict resolved successfully!
  New version: 4
```

Invalid strategy: `Invalid auto-resolution strategy: <value>` (red), hint: `Valid strategies: overwrite, retry, merge` (dim)

### Interactive Merge

With `--auto merge` (or when no `--auto` is specified), enters field-by-field merge. Header shown in bold:

```text
  Interactive Merge Resolution
  Field: status
  [C]urrent: in-progress
  [P]roposed: review
  Choice (c/p): c
    → Kept current value (gray)
```

On choosing proposed (`p`): `    → Selected proposed value` (green)

On invalid choice: `    → Invalid choice, keeping current` (yellow)

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No conflict detected |
| 1 | Error (story not found, invalid strategy, resolution failed) |
| 2 | Conflict detected (JSON mode only) |

### Performance Warning

If conflict resolution takes longer than 1 second: `Warning: Conflict resolution took <N>ms (>1000ms target)` (yellow)

### No Story Specified

Without a `storyId`: `No story specified.` (yellow), hint: `Use 'ao resolve-conflicts <story-id>' to resolve conflicts for a specific story.` (dim)

### Examples

```bash
# Check for conflicts on a story
ao resolve-conflicts 62-15-auth-module

# Auto-resolve with overwrite strategy
ao resolve-conflicts 62-15-auth-module --auto overwrite

# Auto-resolve with merge strategy (interactive)
ao resolve-conflicts 62-15-auth-module --auto merge

# JSON output (exit code 2 if conflict)
ao resolve-conflicts 62-15-auth-module --format json

# Specify expected version
ao resolve-conflicts 62-15-auth-module --expected-version 3

# Propose new values for conflict detection
ao resolve-conflicts 62-15-auth-module --proposed-status review --proposed-agent agent-3
```

---

## ao conflicts

```bash
ao conflicts
```

List and manage agent assignment conflicts. Displays all active conflicts grouped by story with severity filtering and summary statistics.

### Flags

| Flag | Description |
|------|-------------|
| `--story <id>` | Filter conflicts by story ID |
| `--json` | Output as JSON |
| `--severity <level>` | Filter by severity (critical, high, medium, low) |

### Output

Conflicts are grouped by story and sorted by severity (critical first), then by detected time (newest first):

```text
Found 3 active conflict(s)

Story: 62-15-auth-module
────────────────────────────────────────────────────────────────
  Conflict ID: conflict-001
  Severity:    HIGH
  Type:        agent-assignment
  Detected:    2h ago
  Agents:
    Existing:    agent-1
    Conflicting: agent-3
  Priority Scores:
    agent-1: 72%
    agent-3: 45%
  Resolution: Pending
```

No conflicts: `✓ No active conflicts` (green)

Existing agent shown in yellow, conflicting agent in cyan. Priority scores colored: `> 0.7` green, `> 0.4` yellow, else red.

Resolved conflicts show: `Resolution: <resolution>` (green) and `Resolved at: <timestamp>` (dim).

### Summary Table

After all conflicts, a summary table is displayed:

```text
Summary
────────────────────────────────────────────────────────────────
  Story                Conflicts  Highest Severity
  62-15-auth-module    2          HIGH
  62-20-scm-plugin     1          MEDIUM
```

### Resolution Hints

```text
To resolve conflicts, use:
  ao conflicts --story <id>          # View conflicts for a story
  --force flag with spawn-story      # Override conflict warning
```

### Examples

```bash
# Show all active conflicts
ao conflicts

# Filter by story
ao conflicts --story 62-15-auth-module

# Filter by severity
ao conflicts --severity high

# JSON output for scripting
ao conflicts --json | jq '.[].conflictId'
```

---

## Tracker Requirements

{: .highlight }
**Which commands need which tracker:**

| Tracker/Plugin | Commands |
|----------------|----------|
| **bmad tracker** | `ao rework` — requires bmad tracker for sprint data |
| **SCM plugin** | `ao review-check` — requires SCM for PR detection |
| **No plugin needed** | `ao review-stats`, `ao resolve`, `ao resolve-conflicts`, `ao conflicts` |

All commands use `loadConfig()` for project resolution.

---

## Cross-Cutting Patterns

- All 6 commands use `loadConfig()` — config error strings vary by command
- `ao review-check` is the only command with an ora spinner in this category
- `ao resolve-conflicts` uses `StateManager` + `ConflictResolver` (different from `ConflictDetectionService` used by `resolve` and `conflicts`)
- Two conflict types: **agent assignment** conflicts (`resolve`, `conflicts`) vs **version/state** conflicts (`resolve-conflicts`)
- `ao resolve-conflicts` has exit code 2 for detected conflicts in JSON mode (unique across all CLI commands)
- `ao resolve-conflicts` has a performance warning when resolution takes > 1000ms
- `ao resolve` and `ao conflicts` share `formatSeverity()` and `formatDuration()` helpers
- Config errors:
  - `ao review-check`: `No agent-orchestrator.yaml found. Run 'ao init' first.`
  - `ao review-stats`, `ao rework`: `No config found. Run 'ao init' first.` + `Not in a project directory.`
  - `ao resolve`, `ao conflicts`: `No agent-orchestrator.yaml found. Run 'ao init' first.` + `Could not determine project ID. Run from a project directory.`
  - `ao resolve-conflicts`: `No agent-orchestrator.yaml found. Run 'ao init' first.`
- `ao review-stats` reads from `<sessionsDir>/review-findings.jsonl` — no tracker needed
- `ao rework` validates `project.tracker.plugin === "bmad"` before proceeding

---

## Next Steps

- [CLI Reference](./index.md) — command category index
- [Setup Commands](./setup-commands.md) — init, start, stop, create, plugins, sprint-config
- [Session Commands](./session-commands.md) — spawn, pause, resume, session, send, open, agent, assign
- [Sprint Commands](./sprint-commands.md) — sprint, sprint-start, sprint-end, velocity, plan
- [Story Commands](./story-commands.md) — story lifecycle commands
- [Monitoring Commands](./monitoring.md) — status, fleet, burndown, logs, events
- [Intelligence Commands](./intelligence.md) — learning, patterns, history
- [Infrastructure Commands](./infrastructure.md) — health, diagnostics
- [Getting Started](../getting-started.md) — installation and quick start
- [Configuration](../configuration.md) — agent-orchestrator.yaml reference
