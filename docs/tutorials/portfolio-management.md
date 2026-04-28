---
title: Portfolio Management
nav_order: 4
parent: Tutorials
description: Step-by-step tutorial for managing 3+ projects with shared agent pools, cross-project dependencies, portfolio dashboard monitoring, and unified sprint views.
---

# Portfolio Management

This tutorial walks you through managing 3+ projects with shared agent pools, cross-project dependencies, and portfolio-level monitoring. By the end, you'll coordinate multiple AI agent teams across different repositories with full visibility and control.

{: .highlight }
> **Prerequisites:** Complete [Multi-Agent Sprint](multi-agent-sprint/) first, or have the orchestrator running with at least two projects configured. You need `ao` CLI, multiple repositories set up in your config, and familiarity with the sprint lifecycle.

---

## Overview

The **portfolio model** manages multiple projects as a coordinated unit:

1. **Projects** — each repository gets its own config, stories, sprints, and agents
2. **Shared agent pool** — agents work across projects based on demand and affinity
3. **Cross-project dependencies** — stories in one project can depend on stories in another
4. **Portfolio dashboard** — a single view showing all projects, agents, and dependencies

The portfolio workflow follows this cycle:

1. **Configure** — set up multiple projects with shared pools
2. **Link** — create cross-project dependencies where needed
3. **Monitor** — track all projects from the portfolio dashboard
4. **Coordinate** — manage sprints and agents across projects

{: .note }
> Stories with unresolved cross-project dependencies remain blocked until the target story completes. The dependency engine tracks blocking status across project boundaries. See [Dependencies API](../api/dependencies/) for the full API reference.

---

## Step 1: Configure Multiple Projects

### Three-Project Setup

Add all projects to `agent-orchestrator.yaml`:

```yaml
projects:
  frontend:
    repo: org/frontend-app
    path: ~/projects/frontend-app
    defaultBranch: main
    agent: claude-code
    postCreate:
      - "pnpm install"

  backend:
    repo: org/backend-api
    path: ~/projects/backend-api
    defaultBranch: main
    agent: claude-code
    postCreate:
      - "npm install"

  shared-libs:
    repo: org/shared-libs
    path: ~/projects/shared-libs
    defaultBranch: main
    agent: claude-code
    postCreate:
      - "pnpm install"
```

### Verify Configuration

```bash
ao status
```

Expected output (representative):

```text
╔══════════════════════════════════════════════════════════════════╗
║                  AGENT ORCHESTRATOR STATUS                      ║
╚══════════════════════════════════════════════════════════════════╝

0 active sessions across 3 projects
```

All three projects are registered. No agents are running yet.

{: .highlight }
> Each project gets its own `sessionPrefix` auto-derived from the path basename (e.g., `~/projects/frontend-app` → `frontend`). Sessions for different projects never collide. See [Configuration](../getting-started/configuration/) for all project fields.

---

## Step 2: Set Up the Shared Agent Pool

The shared agent pool lets idle agents from one project work on stories in another.

### Basic Pool Configuration

Enable the pool on each project, declaring which other projects can borrow its agents:

```yaml
projects:
  frontend:
    repo: org/frontend-app
    path: ~/projects/frontend-app
    sharedPool:
      enabled: true
      eligibleProjects:
        - backend
        - shared-libs

  backend:
    repo: org/backend-api
    path: ~/projects/backend-api
    sharedPool:
      enabled: true
      eligibleProjects:
        - frontend
        - shared-libs

  shared-libs:
    repo: org/shared-libs
    path: ~/projects/shared-libs
    sharedPool:
      enabled: true
      eligibleProjects:
        - frontend
        - backend
```

### Advanced Pool Configuration

For more control over cross-project assignment:

```yaml
projects:
  frontend:
    repo: org/frontend-app
    path: ~/projects/frontend-app
    sharedPool:
      enabled: true
      eligibleProjects:
        - "*"                # Share with all projects
      maxConcurrent: 5       # Max 5 cross-project assignments
      reservedAgents:
        - senior-opus-agent  # This agent stays exclusive to frontend
      priority: 2            # Higher priority = preferred assignment
      allocationWeights:
        urgency: 0.3
        priority: 0.3
        affinity: 0.25
        workload: 0.15

  backend:
    repo: org/backend-api
    path: ~/projects/backend-api
    sharedPool:
      enabled: true
      eligibleProjects:
        - frontend
        - shared-libs
      maxConcurrent: 3
      priority: 1            # Lower priority than frontend

  shared-libs:
    repo: org/shared-libs
    path: ~/projects/shared-libs
    sharedPool:
      enabled: true
      eligibleProjects:
        - "*"
      maxConcurrent: 2
```

### SharedPoolConfig Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | Required | Enable shared pool mode |
| `eligibleProjects` | string[] | Required | Target project IDs or `["*"]` for all |
| `maxConcurrent` | number? | — | Max concurrent cross-project assignments |
| `reservedAgents` | string[]? | `[]` | Agents not shared with other projects |
| `priority` | number? | `0` | Project priority (higher = preferred) |
| `allocationWeights` | object? | (defaults) | Custom scoring weights |

### How Cross-Project Assignment Works

```text
1. gatherPoolStories() — collect ready-for-dev stories from all pool projects
2. getAssignableAgents() — union of local idle agents + eligible pool agents
3. buildAllocationRequest() — assemble workload, affinity, and project data
4. executeCrossProjectAssignment() — spawn session, write metadata, register
```

{: .highlight }
> **Same-project bypass:** Agents always work on their own project's stories without pool eligibility checks. Pool rules only apply to cross-project assignments. See [Agent Assignment](../core-concepts/agent-assignment/) for the full allocation algorithm.

### Capacity Checking

| Utilization | Behavior |
|-------------|----------|
| Below 80% | Agent available for assignment |
| 80% or above | Warning logged — agent near capacity |
| 100% | Assignment blocked — agent at max capacity |

---

## Step 3: Cross-Project Dependencies

When a story in one project depends on a story in another, use cross-project dependencies.

### Create a Cross-Project Dependency

```bash
curl -X POST http://localhost:5000/api/dependencies/cross-project \
  -H "Content-Type: application/json" \
  -d '{
    "sourceProjectId": "frontend",
    "sourceStoryId": "42-5-login-page",
    "targetProjectId": "shared-libs",
    "targetStoryId": "10-1-auth-module"
  }'
```

Expected output:

```json
{
  "dependency": {
    "id": "dep-m5x7k2n-1a2b3c4d",
    "sourceProjectId": "frontend",
    "sourceStoryId": "42-5-login-page",
    "targetProjectId": "shared-libs",
    "targetStoryId": "10-1-auth-module",
    "createdAt": "2026-04-28T10:00:00.000Z"
  }
}
```

This means: `frontend/42-5-login-page` is blocked until `shared-libs/10-1-auth-module` is done.

### List Dependencies

```bash
# List all cross-project dependencies
curl http://localhost:5000/api/dependencies/cross-project

# Filter by project
curl "http://localhost:5000/api/dependencies/cross-project?projectId=frontend"

# Show only blocked dependencies
curl "http://localhost:5000/api/dependencies/cross-project?status=blocked"
```

### View the Dependency Graph

```bash
curl http://localhost:5000/api/dependencies/cross-project/graph
```

Expected output (representative):

```json
{
  "graph": {
    "nodes": [
      {
        "id": "frontend::42-5-login-page",
        "storyId": "42-5-login-page",
        "projectId": "frontend",
        "projectName": "frontend",
        "status": "backlog",
        "isBlocked": true
      },
      {
        "id": "shared-libs::10-1-auth-module",
        "storyId": "10-1-auth-module",
        "projectId": "shared-libs",
        "projectName": "shared-libs",
        "status": "in-progress",
        "isBlocked": false
      }
    ],
    "edges": [
      {
        "id": "dep-m5x7k2n-1a2b3c4d",
        "sourceNodeId": "frontend::42-5-login-page",
        "targetNodeId": "shared-libs::10-1-auth-module",
        "isResolved": false
      }
    ],
    "projectGroups": {
      "frontend": ["frontend::42-5-login-page"],
      "shared-libs": ["shared-libs::10-1-auth-module"]
    }
  }
}
```

### Check Blocking Alerts

```bash
curl http://localhost:5000/api/dependencies/cross-project/blocking-status
```

Returns dependencies that have been blocking for longer than the threshold (default: 1 hour).

### Remove a Dependency

```bash
curl -X DELETE http://localhost:5000/api/dependencies/cross-project \
  -H "Content-Type: application/json" \
  -d '{"depId": "dep-m5x7k2n-1a2b3c4d"}'
```

{: .warning }
> Creating a dependency that would form a cycle returns `422 CircularDependencyError`. The orchestrator detects cycles across project boundaries before persisting the dependency. See [Dependencies API](../api/dependencies/) for validation rules.

---

## Step 4: Portfolio Dashboard

The portfolio dashboard provides a single view of all projects, agents, and dependencies.

### Portfolio Grid

Navigate to `http://localhost:5000/portfolio` to see the portfolio overview:

- **Project cards** — one card per project showing agent count, story status badges, and utilization
- **Metrics widget** — four cards showing total agents, stories, pool availability, and overall utilization
- **Cross-project dependency graph** — interactive visualization of dependencies between projects

Each project card displays:

| Element | Description |
|---------|-------------|
| Status indicator | Colored dot: active (green), idle (yellow), error (red) |
| Agent count | `activeAgents / totalAgents` |
| Story badges | In Progress, Backlog, Done, Blocked (shown when count > 0) |
| Utilization badge | Circular percentage with color thresholds |
| Capacity badge | Free slots, near capacity, or at full capacity |
| Pool available | Count of agents available from shared pool |

### Project Drill-Down

Click a project card (or navigate to `/portfolio/{projectId}`) to see:

- All sessions for that project
- Enriched session details with PR/CI status
- Per-agent utilization breakdown

### Portfolio API

You can also query portfolio data programmatically:

```bash
# Get assignable agents for a project (local + pool)
curl http://localhost:5000/api/sprint/frontend/assignable-agents

# Get per-project utilization
curl http://localhost:5000/api/sprint/frontend/utilization

# Get pool-wide capacity
curl http://localhost:5000/api/pool/capacity

# Get pool utilization overview
curl http://localhost:5000/api/pool/utilization
```

{: .note }
> Pool routes return `{ "enabled": false }` when no pool-enabled projects are configured, and `404` when no projects exist at all. See [Portfolio API](../api/portfolio/) for full endpoint documentation.

---

## Step 5: Monitor Cross-Project

### View All Sessions Across Projects

```bash
ao status
```

Expected output (representative — actual values vary):

```text
Session       Branch              Story       AgentSt  PR     CI    Rev   Thr  Activity  Age
fe-agent-1    story/42-5-login    42-5        active   #12    pass  —     —    writing   15m
be-agent-1    story/88-3-api      88-3        active   —      —     —     —    spawning  2m
sl-agent-1    story/10-1-auth     10-1        active   #8     pend  —     —    fixing    8m
```

Filter by project:

```bash
ao status --project frontend
```

### Watch the Fleet

```bash
ao fleet --watch
```

This displays an htop-style view of all agents across all projects that auto-refreshes.

### Check Pool Capacity

```bash
curl -s http://localhost:5000/api/pool/capacity | python3 -m json.tool
```

Expected output (representative):

```json
{
  "agents": [
    {
      "agentId": "fe-agent-1",
      "isAtCapacity": false,
      "isNearCapacity": false,
      "utilizationPercent": 33
    },
    {
      "agentId": "be-agent-1",
      "isAtCapacity": false,
      "isNearCapacity": false,
      "utilizationPercent": 0
    }
  ],
  "summary": {
    "total": 5,
    "atCapacity": 0,
    "nearCapacity": 1,
    "available": 4
  }
}
```

### Check Cross-Project Blocking

```bash
curl -s http://localhost:5000/api/dependencies/cross-project/blocking-status | python3 -m json.tool
```

Returns alerts for dependencies that have been unresolved beyond the threshold (default: 1 hour). Each alert includes blocking duration and the involved projects and stories.

---

## Step 6: Unified Sprint View

### Start Sprints Per Project

Each project has its own sprint cycle:

```bash
# Start sprint for frontend
ao sprint-start frontend --goal "Complete auth flow" --start-date 2026-04-28 --end-date 2026-05-09 --velocity 5

# Start sprint for backend
ao sprint-start backend --goal "API v2 endpoints" --start-date 2026-04-28 --end-date 2026-05-09 --velocity 4

# Start sprint for shared-libs
ao sprint-start shared-libs --goal "Auth module + utils" --start-date 2026-04-28 --end-date 2026-05-09 --velocity 3
```

### View Sprint Progress Per Project

```bash
ao sprint frontend --compact
```

Expected output (representative):

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sprint Progress: frontend                                                    │
└──────────────────────────────────────────────────────────────────────────────┘

[██████░░░░░░░░░░░░░░] 3/10 stories

  done: 3 | in-progress: 2 | review: 1 | ready-for-dev: 2 | backlog: 2
```

```bash
ao sprint backend --compact
```

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sprint Progress: backend                                                     │
└──────────────────────────────────────────────────────────────────────────────┘

[████░░░░░░░░░░░░░░░░] 2/8 stories

  done: 2 | in-progress: 1 | review: 0 | ready-for-dev: 3 | backlog: 2
```

### Compare Velocity Across Projects

```bash
ao velocity frontend
```

Expected output (representative):

```text
    W0421  ██████████████        6 stories
    W0414  ██████████            4 stories
    W0407  ████████              3 stories

  Average: 4.3/week
  Trend:   improving ↗
  Next week: ~5
```

```bash
ao velocity backend
```

```text
    W0421  ██████████████████    8 stories
    W0414  ██████████████        6 stories
    W0407  ██████████            4 stories

  Average: 6.0/week
  Trend:   improving ↗
  Next week: ~7
```

{: .highlight }
> `sprint-end`, `sprint-summary`, and `velocity` require the bmad tracker plugin. `sprint` and `sprint-plan` work without any tracker. See [Sprint Commands](../cli/sprint-commands/) for tracker requirements per command.

---

## Troubleshooting

### Cross-project dependency cycle

Creating a dependency that would form a cycle across projects.

```text
422 CircularDependencyError: Cycle detected: frontend/A → backend/B → frontend/A
```

**Solution:** Remove one dependency in the cycle to break it:

```bash
curl -X DELETE http://localhost:5000/api/dependencies/cross-project \
  -H "Content-Type: application/json" \
  -d '{"depId": "dep-abc123"}'
```

### Pool agent not shared

An agent is idle but not appearing in another project's assignable agents.

Check the source project's `sharedPool` config:

```yaml
projects:
  frontend:
    sharedPool:
      enabled: true             # Must be true
      eligibleProjects:
        - backend               # Must include the target project
      reservedAgents:
        - my-agent              # Remove from this list if agent should be shared
```

Also verify the agent is actually idle — agents in `active`, `blocked`, or `spawning` states are not available for cross-project assignment.

### Project not appearing in portfolio

A configured project doesn't show on the portfolio dashboard.

1. Verify the project exists in `agent-orchestrator.yaml` under `projects:`
2. Check YAML syntax — indentation errors can silently skip entries
3. Ensure `path` points to an existing directory
4. Restart the web server after config changes

### Capacity mismatch between projects

The pool shows "at capacity" but you expected available slots.

```bash
# Check per-agent capacity
curl http://localhost:5000/api/pool/capacity
```

Each project's `maxConcurrent` controls how many cross-project assignments it can handle. If the limit is too low:

```yaml
projects:
  backend:
    sharedPool:
      maxConcurrent: 10    # Increase from default
```

### Utilization shows 0%

A project shows 0% utilization despite having configured agents.

This means no active sessions exist for that project. Spawn agents first:

```bash
ao batch-spawn backend --ready
```

Utilization is computed as `activeAgents / totalAgents * 100`. Without spawned sessions, `totalAgents` is 0.

---

## Next Steps

- **[Agent Assignment](../core-concepts/agent-assignment/)** — affinity scoring, shared pool, allocation algorithm
- **[Configuration](../getting-started/configuration/)** — full config reference including shared pool
- **[Dependencies API](../api/dependencies/)** — cross-project dependency CRUD, graph, blocking
- **[Portfolio API](../api/portfolio/)** — assignable agents, utilization, pool routes
- **[Multi-Agent Sprint](multi-agent-sprint/)** — single-project multi-agent coordination
- **[CLI Reference](../cli/)** — all sprint, session, and monitoring commands

---

- **Parent** — [Tutorials](.)
- **Siblings** — [Your First Agent](first-agent/), [GitHub CI/CD Flow](github-ci-cd-flow/), [Multi-Agent Sprint](multi-agent-sprint/), [Custom Workflow](custom-workflow/)
- **Core Concepts** — [Agent Assignment](../core-concepts/agent-assignment/), [Stories & Sprints](../core-concepts/stories-sprints/), [Sessions](../core-concepts/sessions/)
- **Getting Started** — [Configuration](../getting-started/configuration/), [Quick Start](../getting-started/quick-start/)
- **Reference** — [CLI Reference](../cli/), [Dependencies API](../api/dependencies/), [Portfolio API](../api/portfolio/), [Sprint Commands](../cli/sprint-commands/)
