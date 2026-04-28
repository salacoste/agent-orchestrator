---
title: Stories & Sprints
nav_order: 2
parent: Core Concepts
description: How stories and sprints work — the 6-state story lifecycle, sprint tracking, assignment flow, and completion handling.
---

# Stories & Sprints

A **story** is a unit of work in Agent Orchestrator — typically a feature, bug fix, or documentation task that an AI agent can complete autonomously. Stories are grouped into **sprints** tracked in a flat YAML file, and routed to agents through an automated assignment flow.

{: .highlight }
> **TL;DR:** Stories move through 6 states from backlog to done. Sprint progress is tracked in `sprint-status.yaml`. The assignment engine automatically picks the best agent for each story based on priority, dependencies, and complexity.

---

## Story Model

Every story is represented by a `StoryState` object with these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique story identifier (e.g., `my-app-42`) |
| `status` | StoryStatus | Current lifecycle state (6 values — see below) |
| `title` | string | Human-readable story title |
| `description` | string? | Optional detailed description |
| `acceptanceCriteria` | string[]? | Optional list of done-when conditions |
| `dependencies` | string[]? | Optional list of story IDs this depends on |
| `assignedAgent` | string? | Agent ID if currently assigned |
| `urgency` | UrgencyLevel? | Priority urgency (4 values) |
| `version` | string | Optimistic concurrency version token |
| `updatedAt` | string | ISO timestamp of last update |

### Urgency Levels

| Level | Description |
|-------|-------------|
| `critical` | Must be completed immediately |
| `high` | Should be done this sprint |
| `normal` | Default priority |
| `low` | Nice to have, no deadline pressure |

---

## Story Status Lifecycle

Each story moves through **6 states**:

```text
backlog → ready¹ → in-progress → review → done
                          │
                          └→ blocked
```

_¹ `ready` = `ready-for-dev` (abbreviated for diagram width)_

| State | Description |
|-------|-------------|
| `backlog` | Story exists but hasn't been prepared for development |
| `ready-for-dev` | Story has full context and is eligible for assignment |
| `in-progress` | An agent is actively working on the story |
| `review` | Implementation complete, awaiting code review |
| `done` | Story completed and verified |
| `blocked` | Agent failed or dependency is unmet |

{: .highlight }
> **Key distinction:** `StoryStatus` (6 values) tracks the work item's progress. `SessionStatus` (18 values) tracks the agent process lifecycle. See [Sessions](../sessions/) for the full session state machine.

### State Transitions

- **backlog → ready-for-dev** — Story file created with full implementation context
- **ready-for-dev → in-progress** — Agent assigned via the assignment flow
- **in-progress → review** — Agent completes work, code review triggered
- **review → done** — Code review approves and merges
- **in-progress → blocked** — Agent fails, times out, or dependency blocked
- **blocked → ready-for-dev** — Issue resolved, story re-queued for assignment
- **done → ready-for-dev** — (rare) Story re-opened after regression

### Dependency Unblocking

When a story reaches `done`, the completion handler checks all stories that depend on it. If **all** of a dependent story's dependencies are now `done`, it automatically transitions to `ready-for-dev`.

---

## Sprint Lifecycle

Agent Orchestrator uses a flat YAML file — `sprint-status.yaml` — as the source of truth for sprint tracking. No database required.

```yaml
# sprint-status.yaml
generated: 2026-04-20
project: agent-orchestrator
development_status:
  epic-1: done
  1-1-cli-data-model: done
  1-2-story-aware-spawning: done
  epic-2: in-progress
  2-1-tracker-bridge: ready-for-dev
  2-2-event-types: backlog
```

### Epic Hierarchy

Stories are organized into **epics**. An epic is a collection of related stories that share a business goal.

```text
Epic (backlog → in-progress → done)
  ├── Story 1 (backlog → ready → ... → done)
  ├── Story 2 (backlog → ready → ... → done)
  └── Story 3 (backlog → ready → ... → done)
```

- An epic transitions to `in-progress` when its first story is created
- An epic transitions to `done` when all its stories are `done`

### BMAD Workflow Phases

The BMAD method organizes work into four phases:

| Phase | Description |
|-------|-------------|
| `analysis` | Requirements gathering and stakeholder interviews |
| `planning` | PRD, architecture, and UX design |
| `solutioning` | Epic breakdown and story definition |
| `implementation` | Story development, review, and merge |

Each phase tracks its state as `not-started`, `active`, or `done`. The workflow engine uses these phases to recommend next steps in the dashboard.

---

## Assignment Flow

When an agent is available and a story needs work, the assignment engine selects the best match.

```text
Sprint Status (YAML)
  │
  ├─ 1. Scan all stories
  │     └─ Filter: status == "ready-for-dev"
  │
  ├─ 2. Check eligibility
  │     ├─ No active agent assigned?
  │     └─ All dependencies resolved?
  │
  ├─ 3. Sort candidates
  │     ├─ Priority descending (higher = first)
  │     └─ Position ascending (FIFO tiebreak)
  │
  └─ 4. Select top candidate
        └─ Suggest model tier via complexity
```

### Eligibility Rules

A story is **assignable** only if all three conditions are met:

1. **Status is `ready-for-dev`** — backlog stories are excluded (not yet prepared)
2. **No active agent** — `registry.findActiveByStory()` returns null
3. **All dependencies done** — every dependency has status `done`

### Priority Sorting

Candidates are sorted by:
1. **Priority** (descending) — higher number = higher priority
2. **Position** (ascending) — FIFO tiebreak for same priority

### Model Tier Suggestion

Each candidate gets a suggested model tier based on complexity classification:

| Tier | Use Case |
|------|----------|
| `low` | Simple fixes, documentation updates |
| `medium` | Feature implementation, refactoring |
| `high` | Architecture changes, complex algorithms |

### Smart Assignment

The optional smart assignment system adds affinity scoring:

```text
AssignmentScorer queries LearningStore
  → domain + complexity + success rate + avg time
  → Ranked candidate list
  → ao assign-suggest shows scored candidates
```

---

## Completion Flow

When an agent finishes a story, an 11-step completion handler runs automatically:

```text
Agent completes work
  │
  ├─ 1. Capture session logs
  ├─ 2. Store log path in metadata
  ├─ 3. Remove agent from registry
  ├─ 4. Run verification gate
  │     ├─ Passed → continue
  │     ├─ Failed → auto-retry (up to 2 attempts)
  │     └─ Exhausted → blocked or review
  ├─ 5. Update sprint status
  ├─ 6. Publish story.completed event
  ├─ 7. Log audit event
  ├─ 8. Track model usage
  ├─ 9. Capture session learning
  ├─ 10. Bridge cross-session memory
  └─ 11. Unblock dependent stories
```

### Verification Gate

If verification is enabled for the project, the completion handler runs configured checks (tests, linting, build). Failed checks trigger automatic retry up to `maxAttempts` (default: 2). See the [Verification Gate](../verification-gate/) page for full details (page in progress).

### Dependency Unblocking

Step 11 is where the dependency chain propagates: when story A completes, every story that depends on A is checked. If all of their dependencies are now `done`, they automatically transition to `ready-for-dev`.

---

## Failure Handling

When an agent fails, a separate failure handler runs:

```text
Agent fails
  │
  ├─ 1. Capture session logs
  ├─ 2. Store log path in metadata
  ├─ 3. Remove agent from registry
  ├─ 4. Set story status → blocked
  ├─ 5. Publish story.blocked event
  ├─ 6. Store crash details in metadata
  ├─ 7. Log audit event
  ├─ 8. Track model usage (zero-cost)
  ├─ 9. Capture session learning (failures too)
  └─ 10. Send failure notification
```

### Failure Reasons

| Reason | Description |
|--------|-------------|
| `failed` | Agent exited with non-zero code |
| `crashed` | Agent process crashed unexpectedly |
| `timed_out` | Agent exceeded configured time limit |
| `disconnected` | Agent disconnected manually |

On `failed`, `crashed`, or `timed_out`, the story is set to `blocked` and the tracker issue is reset so the story can be re-assigned to a new agent. On `disconnected` (manual disconnect), the story stays in its current status — no blocking notification is sent.

---

## Next Steps

- **[Sessions](../sessions/)** — the 18-state session lifecycle and spawn pipeline
- **[Autopilot](../autopilot/)** — autonomous and supervised agent modes
- **[Reactions](../reactions/)** — complete reaction engine reference
- **[Configuration](../../getting-started/configuration/)** — sprint setup and reaction configuration
