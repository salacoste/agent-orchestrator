---
title: Multi-Agent Sprint
nav_order: 3
parent: Tutorials
description: Step-by-step tutorial for running a multi-agent sprint — spawn 5+ agents in parallel, configure shared pools, monitor fleet status, track sprint progress, and complete the sprint cycle.
---

# Multi-Agent Sprint

This tutorial walks you through running a multi-agent sprint — spawning 5+ agents in parallel, assigning stories, monitoring the fleet, and completing the sprint cycle. By the end, you'll coordinate multiple AI agents working on different stories simultaneously.

{: .highlight }
> **Prerequisites:** Complete [Your First Agent](first-agent/) and [GitHub CI/CD Flow](github-ci-cd-flow/) first, or have the orchestrator running with at least one project configured. You need `ao` CLI, multiple stories ready for development, and at least one notifier set up.

---

## Overview

A **sprint** is a collection of stories tracked in `sprint-status.yaml`. Each story moves through 6 states:

```
backlog → ready-for-dev → in-progress → review → done
                          │
                          └→ blocked
```

The multi-agent workflow follows this cycle:

1. **Plan** — review stories, start sprint, check dependencies
2. **Spawn** — launch agents for stories (batch or individual)
3. **Assign** — match stories to agents using affinity scoring
4. **Monitor** — track fleet status, sprint progress, and individual agents
5. **Complete** — end the sprint with metrics and retrospective

{: .note }
> Stories with unresolved dependencies are excluded from assignment. Only `ready-for-dev` stories with all dependencies in `done` status are assignable. See [Stories & Sprints](../core-concepts/stories-sprints/) for the full lifecycle.

---

## Step 1: Sprint Setup

### Review Available Stories

```bash
# View sprint plan with recommended stories and blockers
ao plan
```

Expected output (representative — actual stories vary):

```text
  Summary: 20 stories (12 done, 3 in-progress, 2 ready-for-dev, 3 backlog)

  READY TO START:
    • 62-26-cli-sprint-commands [priority: 3]
    • 62-27-cli-story-commands [priority: 2]

  IN PROGRESS:
    • 62-25-cli-session-commands
```

To see all stories grouped by epic with status emoji:

```bash
ao plan --full
```

### Check Dependencies

```bash
# View dependency graph and circular dependency warnings
cd _bmad-output/implementation-artifacts
ao sprint-plan
```

Expected output (representative):

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sprint Execution Plan                                                         │
└──────────────────────────────────────────────────────────────────────────────┘

  Total Stories: 20

Dependency Graph:

Blocked Stories (2):
  • 62-26-cli-sprint-commands (blocked by: 62-25-cli-session-commands)

  Ready for Dev (3):
    • 62-28-cli-monitoring-commands [priority: 3]
    • 62-29-cli-review-pr-commands [priority: 2]
    • 62-30-cli-intelligence-commands [priority: 1]
```

### Start the Sprint

```bash
# Start sprint with goal, dates, and velocity target
ao sprint-start --goal "Complete CLI reference docs" --start-date 2026-04-28 --end-date 2026-05-09 --velocity 8
```

Expected output:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sprint Started                                                                │
└──────────────────────────────────────────────────────────────────────────────┘

  Sprint #:    5
  Goal:        Complete CLI reference docs
  Start:       2026-04-28
  End:         2026-05-09
  Velocity:    8 stories/sprint
```

{: .highlight }
> `sprint-start` writes directly to `agent-orchestrator.yaml`. It works without any tracker plugin — only `sprint-end`, `sprint-summary`, and `velocity` require the bmad tracker.

---

## Step 2: Spawn Multiple Agents

Three spawning patterns for different use cases:

### Pattern 1: Single Story (Most Control)

```bash
ao spawn-story --story 62-28-cli-monitoring-commands
```

Expected output:

```text
Spawning Agent for Story: 62-28-cli-monitoring-commands
  Session my-app-62-28-cli-monitoring-commands created
  Worktree:  /path/to/worktree
  Branch:    story/62-28-cli-monitoring-commands
  Attach:    tmux attach -t my-app-62-28-cli-monitoring-commands
```

### Pattern 2: Batch Spawn (All Ready Stories)

```bash
# Auto-discover and spawn agents for all ready-for-dev stories
ao batch-spawn my-app --ready
```

Expected output (representative):

```text
╔══════════════════════════════╗
║   BATCH SESSION SPAWNER      ║
╚══════════════════════════════╝
Summary:
  Created: 3 sessions
  Skipped: 1 (duplicate)
  Failed:  0
```

A **500ms delay** between spawns prevents resource contention. Batch-spawn includes two layers of duplicate detection:

1. **Existing sessions** — skips issues with a live session (not `killed`, `done`, or `exited`)
2. **Intra-batch** — skips duplicate issues within the same command

### Pattern 3: Manual Issue Numbers

```bash
# Spawn for specific tracker issues
ao batch-spawn my-app INT-100 INT-101 INT-102

# Or combine explicit issues with auto-discovery
ao batch-spawn my-app INT-100 --ready
```

{: .note }
> `spawn-story` performs full conflict detection — it checks if a story already has an active agent and prompts before proceeding. Use `--force` to skip this check. See [Session Commands](../cli/session-commands/) for all spawn flags.

---

## Step 3: Agent Assignment

### Get Agent Suggestions

Before assigning, check which agent is best for each story:

```bash
ao assign-suggest 62-28-cli-monitoring-commands
```

Expected output (representative):

```text
Assignment Suggestions for 62-28-cli-monitoring-commands
Agent                        Score    Success     Recommendation
-----------------------------------------------------------------
my-app-agent-1               0.87     87%         ★ Recommended
my-app-agent-2               0.72     72%         —
my-app-agent-3               0.45     45%         —
```

The affinity score uses a 4-factor formula:

```text
score = (successRate * 0.4) + (domainMatch * 0.3)
      + (speedFactor * 0.2) - (retryPenalty * 0.1)
```

Agents with no history receive a neutral score of `0.5`.

### Manually Assign a Story

```bash
# Assign a specific story to a specific agent
ao assign 62-28-cli-monitoring-commands my-app-agent-1
```

Expected output:

```text
Assigning Story to Agent: my-app-agent-1
Assigned 62-28-cli-monitoring-commands to agent my-app-agent-1 in 245ms
  Agent session: my-app-agent-1
  Attach: tmux attach -t my-app-agent-1
```

### Auto-Assign Next Story

```bash
# Auto-assign the highest-priority story to an idle agent
ao assign-next my-app-agent-2
```

Expected output (representative):

```text
Auto-Assign: 62-29-cli-review-pr-commands
  Story:     CLI Review & PR Commands
  Story ID:  62-29-cli-review-pr-commands
  Epic:      epic-62
  Priority:  2
  Agent:     my-app-agent-2
Assigned 62-29-cli-review-pr-commands to agent my-app-agent-2 in 180ms
```

Use `--dry-run` to preview the priority queue without assigning:

```bash
ao assign-next my-app-agent-2 --dry-run
```

```text
Assignment Queue (Dry Run)
Story ID                                  Priority   Epic
62-28-cli-monitoring-commands             3          epic-62
62-29-cli-review-pr-commands              2          epic-62
2 assignable stories found.
```

{: .highlight }
> Stories are sorted by priority (descending), then by FIFO position (ascending) as a tiebreaker. Only `ready-for-dev` stories with no active agent and all dependencies resolved appear in the queue.

---

## Step 4: Shared Agent Pool

When you have multiple projects, the shared agent pool lets agents work across project boundaries.

### Basic Pool Configuration

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    sharedPool:
      enabled: true
      eligibleProjects:
        - other-project

  other-project:
    repo: org/other-project
    path: ~/projects/other-project
    sharedPool:
      enabled: true
      eligibleProjects:
        - my-app
```

### Full Pool Configuration

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    sharedPool:
      enabled: true
      eligibleProjects:
        - "*"                # Share with all projects
      maxConcurrent: 5       # Max 5 cross-project assignments
      reservedAgents:
        - senior-opus-agent  # This agent stays exclusive to my-app
      priority: 2            # Higher priority gets preferred assignment
      allocationWeights:
        urgency: 0.3
        priority: 0.3
        affinity: 0.25
        workload: 0.15
```

### How Cross-Project Assignment Works

```
1. gatherPoolStories() — collect ready-for-dev stories from all pool projects
2. getAssignableAgents() — union of local idle agents + eligible pool agents
3. buildAllocationRequest() — assemble workload, affinity, and project data
4. executeCrossProjectAssignment() — spawn session, write metadata, register
```

{: .highlight }
> **Same-project bypass:** Agents always work on their own project's stories without pool eligibility checks. Pool rules only apply to cross-project assignments.

### Capacity Checking

| Utilization | Behavior |
|-------------|----------|
| Below 80% | Agent available for assignment |
| 80% or above | Warning logged — agent near capacity |
| 100% | Assignment blocked — agent at max capacity |

When an agent is at capacity, the allocation algorithm skips it. Use `--force` with `ao assign` to override.

---

## Step 5: Monitor the Fleet

### View All Sessions

```bash
ao status
```

Expected output (representative — actual values vary):

```text
Session       Branch              Story       AgentSt  PR     CI    Rev   Thr  Activity  Age
agent-1       story/62-28-cli     62-28       active   #45    pend  —     —    writing   12m
agent-2       story/62-29-cli     62-29       active   #46    —     —     —    spawning  2m
agent-3       story/62-30-cli     62-30       idle     —      —     —     —    waiting   45m
```

Key columns for multi-agent monitoring:

| Column | What to Watch |
|--------|---------------|
| AgentSt | `active` = working, `idle` = waiting, `blocked` = stuck |
| CI | `fail` = needs attention, `pass` = green, `pend` = running |
| Activity | Current agent action (writing, fixing, waiting, spawning) |
| Age | How long the session has been running |

### Watch Fleet in Real-Time

```bash
ao fleet --watch
```

This displays an htop-style view of all agents that auto-refreshes. Press `Ctrl+C` to stop.

### Quick Sprint Progress

```bash
ao sprint --compact
```

Expected output (representative):

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sprint Progress: my-app                                                      │
└──────────────────────────────────────────────────────────────────────────────┘

[████████████░░░░░░░░] 12/20 stories

  done: 12 | in-progress: 3 | review: 1 | ready-for-dev: 2 | backlog: 2
```

### Stream Individual Agent Logs

```bash
# Follow a specific agent's output
ao logs agent-1 --follow
```

Representative output (format varies by agent):

```text
[12:00:15] Agent reading repository structure...
[12:01:02] Agent modifying docs/cli/monitoring.md
[12:01:30] Agent running tests...
[12:02:45] Agent creating pull request #45
```

### Check Event Audit Trail

```bash
# Show recent events across all agents
ao events query --since 1h
```

{: .note }
> The Lifecycle Manager polls GitHub every 30 seconds. State changes appear within 30 seconds of GitHub updating. See [Monitoring Commands](../cli/monitoring/) for the full command reference.

---

## Step 6: Track Sprint Progress

### Full Sprint View

```bash
ao sprint
```

Expected output (representative):

```text
Sprint Progress: my-app
[████████████░░░░░░░░] 12/20 stories

Done (12):
  ✅ 62-23-cli-index
  ✅ 62-24-cli-setup-commands
  ✅ 62-25-cli-session-commands
  ...

In Progress (3):
  🔵 62-28-cli-monitoring-commands  ← agent-1 (writing)
  🔵 62-29-cli-review-pr-commands   ← agent-2 (active)
  🔵 62-30-cli-intelligence-commands

Ready for Dev (2):
  🟡 62-31-cli-infrastructure-commands
  🟡 62-32-web-dashboard-index

Backlog (2):
  📋 62-33-portfolio-view
  📋 62-34-sprint-board

  3 active sessions across 1 projects
```

### Sprint Summary

```bash
ao sprint-summary
```

This shows a single-screen overview with key metrics:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sprint #5 Summary: my-app                                                     │
└──────────────────────────────────────────────────────────────────────────────┘

  Goal:        Complete CLI reference docs
  Progress:    [████████████░░░░░░░░░░░░░░░░░░] 40%

  Columns:     done: 12 | in-progress: 3 | review: 1 | ready: 2 | backlog: 2
  Stories:     20 total, 12 done, 3 active, 5 open
  Health:      OK
  Velocity:    6.0/week (stable →)
  Pace:        on-pace
  Days left:   7
```

### Velocity History

```bash
ao velocity
```

Expected output (representative):

```text
    W0421  ████████████████████  8 stories
    W0414  ██████████            4 stories
    W0407  ██████████████        6 stories

  Average: 6.0/week
  Trend:   stable →
  Next week: ~6
```

{: .highlight }
> `sprint-end`, `sprint-summary`, and `velocity` require the bmad tracker plugin. `sprint` and `sprint-plan` work without any tracker. See [Sprint Commands](../cli/sprint-commands/) for tracker requirements.

---

## Step 7: Complete the Sprint

### End the Sprint

```bash
ao sprint-end
```

Expected output (representative):

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sprint #5 Report                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

  Period:      2026-04-28 → 2026-05-09
  Velocity:    8 stories
  Completed:   8
  Avg cycle:   12.5h
  Health:      OK
  Pace:        ahead
```

### Archive and Reset

```bash
# Archive sprint history, carry over incomplete stories, clear config
ao sprint-end --clear

# Also remove done stories from sprint-status.yaml
ao sprint-end --clear --archive-done
```

With `--clear`, the command:

1. Archives sprint history to a file
2. Carries over incomplete stories to the next sprint
3. Clears `sprintStartDate`, `sprintEndDate`, and `sprintGoal` from config

With `--archive-done`, done stories are also removed from `sprint-status.yaml`.

### Transition Flow

```text
sprint-end
  ├── Generate metrics report (velocity, health, pace)
  ├── With --clear: archive history, carry over incomplete
  ├── With --archive-done: remove done stories from YAML
  └── Update sprint-status.yaml
```

{: .warning }
> `sprint-end` requires the bmad tracker plugin. Without it, the command exits with: `Sprint end requires the bmad tracker plugin.`

---

## Troubleshooting

### Agent stuck/blocked

The agent failed or hit an unresolvable dependency.

```bash
# Check what happened
ao logs <session-id> --since 30m

# Resume the story with a new agent
ao resume 62-28-cli-monitoring-commands

# Resume with context for the new agent
ao resume 62-28-cli-monitoring-commands --message "Focus on the API endpoint section first"
```

### Assignment not matching expectations

The affinity scorer has no learning history for the agent.

```bash
# Check scores for all agents
ao assign-suggest 62-28-cli-monitoring-commands

# Filter by domain expertise
ao assign-suggest 62-28-cli-monitoring-commands --domains docs,tutorial
```

Agents with no history receive a neutral score of `0.5`. Scores improve as agents complete more stories.

### Pool capacity exceeded

An agent is at `maxConcurrent` cross-project assignments.

```bash
# Check fleet utilization
ao fleet

# Increase capacity in config
```

```yaml
projects:
  my-app:
    sharedPool:
      maxConcurrent: 10    # Increase from 5
```

### Sprint plan shows circular dependencies

Two stories depend on each other, creating an unresolvable cycle.

```bash
ao sprint-plan
```

```text
⚠️  Circular Dependencies Detected (1):
  62-26-cli-sprint-commands ↔ 62-27-cli-story-commands
```

Fix by removing one of the `dependencies` entries in `sprint-status.yaml` to break the cycle.

### Batch-spawn partial failure

Some stories were skipped because they already had active sessions.

```text
╔══════════════════════════════╗
║   BATCH SESSION SPAWNER      ║
╚══════════════════════════════╝
Summary:
  Created: 2 sessions
  Skipped: 2 (duplicate)
  Failed:  0
```

This is normal — batch-spawn skips stories that already have a live session. Check `ao status` to see active sessions for those stories.

---

## Next Steps

- **[Stories & Sprints](../core-concepts/stories-sprints/)** — 6-state lifecycle, assignment flow, completion handling
- **[Agent Assignment](../core-concepts/agent-assignment/)** — affinity scoring, shared pool, allocation algorithm
- **[Sessions](../core-concepts/sessions/)** — 18-state session lifecycle and spawn pipeline
- **[Configuration](../getting-started/configuration/)** — full config reference including shared pool
- **[Portfolio Management](portfolio-management/)** — managing multiple projects with shared agents
- **[CLI Reference](../cli/)** — all sprint, session, and monitoring commands

---

- **Parent** — [Tutorials](.)
- **Siblings** — [Your First Agent](first-agent/), [GitHub CI/CD Flow](github-ci-cd-flow/), [Portfolio Management](portfolio-management/), [Custom Workflow](custom-workflow/)
- **Core Concepts** — [Stories & Sprints](../core-concepts/stories-sprints/), [Agent Assignment](../core-concepts/agent-assignment/), [Sessions](../core-concepts/sessions/)
- **Getting Started** — [Configuration](../getting-started/configuration/), [Quick Start](../getting-started/quick-start/)
- **Reference** — [CLI Reference](../cli/), [Sprint Commands](../cli/sprint-commands/), [Session Commands](../cli/session-commands/), [Monitoring Commands](../cli/monitoring/)
