---
title: Agent Assignment
nav_order: 8
parent: Core Concepts
description: How agent assignment matches stories to agents — affinity scoring, shared pool, allocation algorithm, utilization tracking, capacity checks, and configuration.
---

# Agent Assignment

Agent assignment matches each story to the best available agent using a weighted scoring formula based on past performance, domain expertise, speed, and retry history. For multi-project setups, a shared agent pool enables cross-project assignment with configurable capacity limits and reservation rules.

{: .highlight }
> **TL;DR:** 4-factor affinity score (`successRate×0.4 + domainMatch×0.3 + speedFactor×0.2 - retryPenalty×0.1`), shared pool with reserved agents, 4-factor allocation algorithm (urgency/priority/affinity/workload), 3-level utilization tracking, capacity checks with 80% near-capacity threshold, 3 CLI commands, pluggable scorer API.

---

## How Assignment Works

When a story needs an agent, the orchestrator follows a priority-based pipeline:

```text
Story needs assignment
  |
  +-- getAssignableStories()
  |     +-- Filter: status === "ready-for-dev"
  |     +-- Filter: no active assignment
  |     +-- Filter: all dependencies done
  |     +-- Sort: priority desc, FIFO asc
  |
  +-- selectNextStory()
  |     +-- Returns highest-priority story
  |
  +-- allocateAgents()
  |     +-- Gather pool agents (local + cross-project)
  |     +-- Score each (story, agent) pair
  |     +-- Sort: score desc, priority desc, FIFO asc
  |     +-- Deduplicate: 1 agent per story
  |
  +-- Capacity check
        +-- Skip agents at max concurrent
        +-- Warn at 80% utilization
        +-- Assign top-scoring agent
```

{: .highlight }
> **Dependency gate:** Stories with unresolved dependencies are excluded from assignment. Only `ready-for-dev` stories with all dependencies in `done` status are considered.

---

## Affinity Scoring

The affinity scorer ranks how well-suited each agent is for a given story based on learning history.

### Scoring Formula

```text
score = (successRate * 0.4) + (domainMatch * 0.3)
      + (speedFactor * 0.2) - (retryPenalty * 0.1)
```

The result is clamped to `[0, 1]`. Agents with no history receive a neutral score of `0.5`.

### Factor Computation

| Factor | Range | Computation |
|--------|-------|-------------|
| `successRate` | 0–1 | Completed learnings / total learnings |
| `domainMatch` | 0–1 | Matching story tags / total story tags |
| `speedFactor` | 0.1–0.9 | `1 - (median / maxDuration)` of completed sessions (requires >= 2; defaults to 0.5 otherwise) |
| `retryPenalty` | 0–1 | `totalRetries / (learnings * 3)`, capped at 1 |

### AffinityScore

Each scoring result has **6 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | string | Agent being scored |
| `score` | number | Final weighted score (0–1) |
| `successRate` | number | Historical success rate (0–1) |
| `domainMatch` | number | Domain tag overlap (0–1) |
| `speedFactor` | number | Speed relative to own max (0.1–0.9) |
| `retryPenalty` | number | Retry frequency penalty (0–1) |

### Pluggable Scorer

The default formula can be replaced entirely:

```typescript
import { registerAssignmentScorer } from "@composio/ao-core";

registerAssignmentScorer((agentId, storyDomainTags, agentLearnings) => {
  // Custom scoring logic — return a number 0-1
  return myCustomScore(agentId, storyDomainTags, agentLearnings);
});
```

`clearAssignmentScorers()` resets to the default formula.

---

## Shared Agent Pool

The shared agent pool lets agents work across multiple projects. Each project configures which other projects can borrow its agents and can reserve specific agents for exclusive use.

### SharedPoolConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | Required | Enable shared pool mode |
| `eligibleProjects` | string[] | Required | Target project IDs (`["*"]` for all) |
| `maxConcurrent` | number? | — | Max concurrent cross-project assignments |
| `reservedAgents` | string[]? | `[]` | Agents not shared with other projects |
| `priority` | number? | `0` | Project priority for allocation (higher = preferred) |
| `allocationWeights` | AllocationWeights? | (defaults) | Custom scoring weights |

### Pool Membership

`resolvePoolMemberships()` expands each project's config into a resolved `PoolMembership` with **5 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | string | Project ID |
| `enabled` | boolean | Whether shared pool is enabled |
| `eligibleProjects` | string[] | Expanded list of target project IDs |
| `maxConcurrent` | number? | Max concurrent cross-project assignments |
| `reservedAgents` | string[]? | Agents excluded from sharing |

- Wildcard `"*"` expands to all other project IDs
- Projects without `sharedPool` get `enabled: false`
- Invalid references produce `PoolValidationWarning` entries

### Reserved Agents

Agents listed in `reservedAgents` are excluded from cross-project sharing:

- `isAgentReserved()` — check if an agent is reserved by any project
- `getAvailablePoolAgents()` — filter out reserved agents from sharing
- Duplicate reserved agents across projects trigger validation warnings

---

## Allocation Algorithm

The pool allocation algorithm scores all (story, agent) pairs across projects and picks the best match for each story.

### Default Weights

| Factor | Default Weight | Description |
|--------|---------------|-------------|
| `urgency` | 0.3 | Story urgency level |
| `priority` | 0.3 | Project priority |
| `affinity` | 0.25 | Agent-story affinity score |
| `workload` | 0.15 | Agent availability |

### Urgency Score Mapping

| Urgency | Score |
|---------|-------|
| `critical` | 1.0 |
| `high` | 0.75 |
| `normal` | 0.5 |
| `low` | 0.25 |

### Allocation Flow

```text
For each (story, source-project) pair:
  |
  +-- Get agents from source project
  |     +-- Same-project: use all agents
  |     +-- Cross-project: filter by pool
  |           eligibility, exclude reserved
  |
  +-- Check capacity for each agent
  |     +-- At capacity? Skip (fire callback)
  |
  +-- Score the (story, agent) pair
  |     +-- Urgency, priority, affinity, workload
  |
  +-- Sort all candidates
  |     +-- Score desc, priority desc, FIFO asc
  |
  +-- Deduplicate
        +-- 1 agent per story, 1 story per agent
```

{: .highlight }
> **Same-project bypass:** Agents always work on their own project's stories without pool eligibility checks. Pool rules only apply to cross-project assignments.

### AllocationDecision

Each assignment decision has **6 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `storyId` | string | Story being assigned |
| `agentId` | string | Agent assigned |
| `sourceProjectId` | string | Agent's home project |
| `targetProjectId` | string | Story's project |
| `score` | number | Allocation score (0–1) |
| `factors` | AllocationFactors | Breakdown of scoring factors |

### AllocationFactors

The `factors` field breaks down the allocation score into **4 factors**:

| Field | Type | Description |
|-------|------|-------------|
| `urgency` | number | Story urgency contribution (0–1) |
| `priority` | number | Project priority contribution (0–1) |
| `affinity` | number | Agent-story affinity contribution (0–1) |
| `workload` | number | Agent availability contribution (0–1) |

---

## Cross-Project Assignment

Cross-project assignment lets pool-enabled projects borrow idle agents from other projects.

### Assignment Flow

1. `gatherPoolStories()` — collect `ready-for-dev` stories from all pool projects
2. `getAssignableAgents()` — union of local idle agents + eligible pool agents
3. `buildAllocationRequest()` — assemble workload, affinity, and project agent data
4. `executeCrossProjectAssignment()` — spawn session, write metadata, register assignment

### AssignableAgent

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | string | Agent identifier |
| `projectId` | string | Current project |
| `sourceProjectId` | string? | Home project (if different) |
| `isPoolAgent` | boolean | Whether agent belongs to pool |
| `currentWorkload` | number | Active assignments |

When a cross-project session is spawned, the orchestrator writes `sourceProjectId` and `allocationScore` to session metadata for traceability.

---

## Utilization Tracking

Three levels of utilization metrics provide visibility into agent activity.

### AgentUtilization (9 fields)

Per-agent metrics:

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | string | Agent / session ID |
| `projectId` | string | Agent's current project |
| `isActive` | boolean | Currently active |
| `utilizationPercent` | number | 100 if active, 0 if idle |
| `sessionDurationMs` | number | Time since session creation |
| `storiesWorked` | number | Currently assigned stories |
| `crossProjectAssignments` | number | Non-home project assignments |
| `isPoolAgent` | boolean | Belongs to pool-enabled project |
| `projectTimeBreakdown` | ProjectTimeBreakdown[] | Per-project time allocation |

### ProjectAgentUtilization (9 fields)

Per-project aggregation:

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | string | Project ID |
| `totalAgents` | number | All agents in project |
| `activeAgents` | number | Currently active agents |
| `utilizationPercent` | number | `activeAgents / totalAgents * 100` |
| `agentDetails` | AgentUtilization[] | Per-agent breakdown |
| `poolAgentsTotal` | number | Pool-enabled agents |
| `poolAgentsActive` | number | Active pool agents |
| `totalActiveTimeMs` | number | Aggregated active time |
| `totalIdleTimeMs` | number | Aggregated idle time |

### PoolUtilizationOverview (6 fields)

Cross-project pool overview:

| Field | Type | Description |
|-------|------|-------------|
| `totalPoolAgents` | number | Agents across all pool projects |
| `activePoolAgents` | number | Currently active pool agents |
| `utilizationPercent` | number | Overall pool utilization |
| `reservedAgentCount` | number | Agents excluded from sharing |
| `poolProjectCount` | number | Number of pool-enabled projects |
| `projectBreakdown` | ProjectAgentUtilization[] | Per-project breakdown |

Returns `undefined` when no pool projects are configured.

---

## Capacity Checking

Capacity checks prevent over-allocation of shared agents.

### CapacityResult (7 fields)

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | string | Agent being checked |
| `currentWorkload` | number | Active assignments |
| `maxCapacity` | number | Maximum concurrent allowed |
| `utilizationPercent` | number | `currentWorkload / maxCapacity * 100` |
| `availableSlots` | number | `maxCapacity - currentWorkload` |
| `isAtCapacity` | boolean | `availableSlots <= 0` |
| `isNearCapacity` | boolean | `utilizationPercent >= 80` |

### Max Capacity Resolution

```text
resolveMaxCapacity(config, projectId?)
  |
  +-- Project-level sharedPool.maxConcurrent?
  |     +-- Yes -> Use it
  |
  +-- Global maxConcurrentAgents?
  |     +-- Yes -> Use it
  |
  +-- Fallback -> DEFAULT_MAX_CONCURRENT (10)
```

The near-capacity threshold is **80%**. Agents at or above 80% utilization trigger warnings but can still receive assignments. Agents at 100% (max capacity) are skipped during allocation.

### GuardResult

The `guardAssignment()` function returns a `GuardResult` with **4 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `allowed` | boolean | Whether assignment proceeds |
| `reason` | string | Denial reason (empty if allowed) |
| `capacity` | CapacityResult | Agent capacity details |
| `forced` | boolean | Whether `--force` was used to override |

### CapacityExceededError

When a non-forced assignment is blocked by capacity limits, the orchestrator throws a `CapacityExceededError` with **4 properties**:

| Property | Type | Description |
|----------|------|-------------|
| `agentId` | string | Agent that was at capacity |
| `currentWorkload` | number | Workload at the time of the check |
| `maxCapacity` | number | Maximum allowed concurrent assignments |
| `availableSlots` | number | Slots remaining (always 0 when thrown) |

The error message includes the agent ID and current/max ratio for logging and upstream error reporting.

---

## CLI

### Assign a specific story to an agent

```bash
ao assign <story-id> <agent-id> [--force] [--unassign]
```

Manual assignment. Validates story exists, checks dependencies, verifies agent session, and delivers story context. Use `--unassign` to remove an assignment.

### Auto-select next story for an agent

```bash
ao assign-next <agent-id> [--dry-run] [--force]
```

Calls `selectNextStory()` to pick the highest-priority assignable story. Checks pool eligibility for cross-project agents. Use `--dry-run` to preview the priority queue without assigning.

### Suggest best agents for a story

```bash
ao assign-suggest <story-id> [--json] [--domains <tags>]
```

Scores all agents via `scoreAffinity()`, ranks by score, and displays a table. Use `--json` for machine-readable output. `--domains` overrides the story's domain tags.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sprint/[project]/assignable-agents` | Local + pool agents with capacity status |
| GET | `/api/sprint/[project]/utilization` | Per-project agent utilization |
| GET | `/api/pool/utilization` | Cross-project pool overview |
| GET | `/api/pool/capacity` | All agents with capacity summary |
| POST | `/api/agent/[id]/reassign` | Kill session, return story to queue |

### Assignable Agents Response

```json
{
  "agents": [
    { "agentId": "agent-1", "projectId": "my-app", "isPoolAgent": false }
  ],
  "summary": { "total": 3, "local": 2, "pool": 1 }
}
```

### Pool Capacity Response

```json
{
  "agents": [
    { "agentId": "agent-1", "isAtCapacity": false, "isNearCapacity": true }
  ],
  "summary": { "total": 5, "atCapacity": 1, "nearCapacity": 1, "available": 3 }
}
```

---

## Configuration

Agent assignment is configured per-project in `agent-orchestrator.yaml`:

### Shared Pool (Basic)

```yaml
projects:
  my-app:
    repo: org/repo
    path: ~/projects/my-app
    sharedPool:
      enabled: true
      eligibleProjects:
        - other-project
```

### Shared Pool with All Options

```yaml
projects:
  my-app:
    repo: org/repo
    path: ~/projects/my-app
    sharedPool:
      enabled: true
      eligibleProjects:
        - "*"
      maxConcurrent: 5
      reservedAgents:
        - senior-opus-agent
      priority: 2
      allocationWeights:
        urgency: 0.3
        priority: 0.3
        affinity: 0.25
        workload: 0.15
```

### Global Capacity Limit

```yaml
maxConcurrentAgents: 8
```

### SharedPoolConfig Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | Required | Enable shared pool mode |
| `eligibleProjects` | string[] | Required | Target project IDs or `["*"]` |
| `maxConcurrent` | number? | — | Max concurrent cross-project assignments |
| `reservedAgents` | string[]? | `[]` | Agents for exclusive use |
| `priority` | number? | `0` | Project priority (higher = preferred) |
| `allocationWeights` | AllocationWeights? | (defaults) | Custom allocation scoring weights |

### AllocationWeights Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `urgency` | number? | `0.3` | Story urgency factor (0–1) |
| `priority` | number? | `0.3` | Project priority factor (0–1) |
| `affinity` | number? | `0.25` | Agent affinity factor (0–1) |
| `workload` | number? | `0.15` | Agent workload factor (0–1) |

See the [Configuration](../../getting-started/configuration/) page for the full config reference.

---

## Next Steps

- **[Model Routing](../model-routing/)** — how model tiers are matched to story complexity
- **[Stories & Sprints](../stories-sprints/)** — story model, assignment flow, completion handling
- **[Configuration](../../getting-started/configuration/)** — full config reference and overrides
