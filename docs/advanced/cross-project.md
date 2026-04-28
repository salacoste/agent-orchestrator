---
title: Cross-Project Orchestration
nav_order: 1
parent: Advanced Topics
description: Shared agent pools, cross-project dependencies, circular dependency detection, auto-unblocking, capacity checks, isolation levels, and agent utilization — config examples and behavioral reference.
---

# Cross-Project Orchestration

Manage agents, dependencies, and capacity across multiple projects. The Agent Orchestrator supports shared agent pools for efficient resource utilization, cross-project story dependencies with cycle detection, and automatic unblocking when dependencies resolve.

**Core modules:** `packages/core/src/shared-pool.ts`, `packages/core/src/pool-allocation.ts`, `packages/core/src/cross-project-deps.ts`, `packages/core/src/capacity-check.ts`, `packages/core/src/isolation-levels.ts`, `packages/core/src/agent-utilization.ts`, `packages/core/src/dependency-resolver.ts`

**Related API docs:** [Dependencies API](../api/dependencies/), [Portfolio API](../api/portfolio/), [Risk API](../api/risk/)

## Shared Agent Pool

The shared agent pool allows agents from one project to work on stories in other projects. Configure it per-project with the `sharedPool` key in your `agent-orchestrator.yaml`.

### Configuration

```yaml
projects:
  api-service:
    name: "API Service"
    repo: "org/api-service"
    path: "~/projects/api-service"
    defaultBranch: main
    sessionPrefix: "api"
    sharedPool:
      enabled: true
      eligibleProjects: ["web-app", "shared-lib"]
      maxConcurrent: 5
      reservedAgents: ["api-agent-1"]
      priority: 10
      allocationWeights:
        urgency: 0.3
        priority: 0.3
        affinity: 0.25
        workload: 0.15
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enabled` | `boolean` | Yes | Enable shared pool for this project |
| `eligibleProjects` | `string[]` | Yes | Projects whose stories can use this pool. `"*"` = all projects except self |
| `maxConcurrent` | `number` | No | Maximum concurrent cross-project assignments (default: 10) |
| `reservedAgents` | `string[]` | No | Agent IDs reserved for this project only (excluded from pool sharing) |
| `priority` | `number` | No | Higher priority projects get agents first (default: 0) |
| `allocationWeights` | `object` | No | Custom scoring weights (see [Allocation Algorithm](#allocation-algorithm)) |

### Wildcard Eligibility

Set `eligibleProjects: ["*"]` to allow all configured projects to use this pool. The project itself is always excluded — agents never loop back.

### Agent Reservation

Agents listed in `reservedAgents` work only on their home project's stories. They are excluded from cross-project allocation but still count toward capacity calculations.

### Pool Membership Resolution

`resolvePoolMemberships()` builds a `PoolMembership` map for all projects:

```typescript
interface PoolMembership {
  projectId: string;
  enabled: boolean;
  eligibleProjects: string[];
  maxConcurrent?: number;
  reservedAgents?: string[];
}
```

Invalid project references in `eligibleProjects` are caught by `validatePoolReferences()`, which returns warnings for non-existent project IDs and duplicate reserved agents.

## Allocation Algorithm

When multiple stories compete for shared agents, the orchestrator scores and ranks (story, agent) pairs.

### Scoring Factors

| Factor | Default Weight | Description |
|--------|---------------|-------------|
| Urgency | 0.30 | Story urgency: critical=1.0, high=0.75, normal=0.5, low=0.25 |
| Priority | 0.30 | Project priority normalized against max across all pool projects |
| Affinity | 0.25 | Agent-story affinity (pre-computed, fallback 0.5) |
| Workload | 0.15 | `1 - (activeAssignments / maxConcurrent)`, at-capacity agents score 0 |

Final score = weighted sum (weights normalized to sum to 1).

### Resolution Order

1. Gather `ready-for-dev` stories from all pool-enabled projects
2. For each story, find available agents across all pool projects (excluding reserved agents)
3. Skip agents at max capacity (unless forced)
4. Compute score per (story, agent) pair
5. Sort by score descending, then story priority descending, then FIFO position ascending
6. Greedy assignment: first story gets its best agent, then next, until exhausted

Each story gets at most one agent; each agent gets at most one story per allocation run.

### Custom Weights

Override the default weights per-project:

```yaml
sharedPool:
  enabled: true
  eligibleProjects: ["*"]
  allocationWeights:
    urgency: 0.5    # Prioritize urgent stories
    priority: 0.2
    affinity: 0.2
    workload: 0.1
```

The first pool-enabled project with custom weights provides the weights for the entire allocation run (consistency).

## Cross-Project Dependencies

Stories in one project can depend on stories in another. Dependencies are stored in a YAML file (`cross-project-deps.yaml`) alongside the orchestrator config.

### Dependency Structure

```typescript
interface CrossProjectDependency {
  id: string;              // "dep-<timestamp-base36>-<random-hex>"
  sourceProjectId: string; // Project with the blocked story
  sourceStoryId: string;   // Story blocked until target completes
  targetProjectId: string; // Project with the prerequisite story
  targetStoryId: string;   // Story that must complete first
  createdAt: string;       // ISO timestamp
}
```

### Lifecycle

1. **Create** — `POST /api/dependencies/cross-project` — Validates references, checks for duplicates, runs cycle detection
2. **List** — `GET /api/dependencies/cross-project` — Returns all dependencies, optionally filtered by project
3. **Delete** — `DELETE /api/dependencies/cross-project` — Removes a dependency by ID

{: .note}
> Dependencies persist to `cross-project-deps.yaml`. The file is created automatically on first write.

See [Dependencies API](../api/dependencies/) for full endpoint documentation.

### Reference Validation

`validateDependencyReferences()` checks that both projects exist in config and both stories exist in sprint data. Returns structured errors:

```json
{
  "valid": false,
  "errors": [
    { "field": "targetProjectId", "message": "Target project \"nonexistent\" not found in config" }
  ]
}
```

## Circular Dependency Detection

Adding a dependency that would create a cycle is blocked at creation time.

### Detection Algorithm

DFS-based cycle detection runs before any dependency is added:

1. Build a directed adjacency graph from existing dependencies
2. From the proposed target, follow edges forward looking for the proposed source
3. If the source is reachable, a cycle exists
4. Self-reference (same project + same story) is caught immediately

If a cycle is detected, `CircularDependencyError` is thrown with the full cycle path:

```typescript
interface CyclePathNode {
  projectId: string;
  storyId: string;
}

class CircularDependencyError extends Error {
  readonly cyclePath: CyclePathNode[];
}
```

### Cycle Path Reconstruction

When DFS detects a cycle, BFS reconstructs the shortest path from target back to source using parent pointers. The path starts and ends with the same node.

### API Endpoint

```
GET /api/sprint/{project}/dependency-cycles
```

Returns detected cycles for a specific project. See [Dependencies API](../api/dependencies/).

## Auto-Unblocking

When a story completes, the orchestrator automatically checks whether any blocked stories can proceed.

### Resolution Flow

1. Story completion fires a `story.completed` event
2. `DependencyResolverService.onStoryCompleted()` finds all dependencies where the completed story is the target
3. For each dependent (source) story, checks if ALL its cross-project dependencies are satisfied
4. Stories with all dependencies resolved are unblocked (status changed to `ready-for-dev`)
5. `story.unblocked` event is published

### Single-Pass Only

Auto-unblocking is single-pass: only direct dependents of the completed story are checked. If unblocking story B would also satisfy story A's dependencies, story A is not returned — it will be unblocked when story B is later marked done.

### Status Resolution

```typescript
interface DependencyWithStatus extends CrossProjectDependency {
  readonly targetStatus: string;   // Current status of the target story
  readonly isResolved: boolean;    // true when targetStatus === "done"
}
```

### Dependency Graph

`buildCrossProjectGraph()` transforms flat dependencies into a visualization structure:

```typescript
interface CrossProjectGraph {
  readonly nodes: CrossProjectGraphNode[];      // Unique stories
  readonly edges: CrossProjectGraphEdge[];      // Dependencies
  readonly projectGroups: Record<string, string[]>;  // Stories by project
}
```

See [Dependencies API — Graph](../api/dependencies/) for the graph endpoint.

## Capacity Checks

The capacity system prevents over-allocation of shared agents.

### Capacity Result

```typescript
interface CapacityResult {
  agentId: string;
  currentWorkload: number;
  maxCapacity: number;
  utilizationPercent: number;  // 0-100+
  availableSlots: number;
  isAtCapacity: boolean;       // workload >= maxCapacity, or maxCapacity <= 0
  isNearCapacity: boolean;     // utilization >= 80% but not at capacity
}
```

### Resolution Order

Max concurrent capacity is resolved in order:

1. Project-level `sharedPool.maxConcurrent`
2. Global `maxConcurrentAgents`
3. Default: 10

### Assignment Guard

```typescript
interface GuardResult {
  allowed: boolean;
  reason: string;
  capacity: CapacityResult;
  forced: boolean;   // true when force override applied
}
```

Use `force: true` to assign an agent even when at capacity. The assignment proceeds but is flagged for audit logging.

### Error Class

When an assignment is blocked and not forced, `CapacityExceededError` is thrown with full capacity details.

## Isolation Levels

Control what agents can access per-project. Three levels define security boundaries.

### Level Matrix

| Permission | Shared | Isolated | Quarantined |
|-----------|--------|----------|-------------|
| Own worktree | No | Yes | Yes |
| Git push | Yes | Yes | No |
| Network access | Yes | Yes | No |
| Cross-project access | Yes | No | No |

### Configuration

```yaml
projects:
  secure-service:
    name: "Secure Service"
    repo: "org/secure-service"
    path: "~/projects/secure-service"
    defaultBranch: main
    sessionPrefix: "sec"
    isolation: "quarantined"
```

Default level is `shared` (no restrictions). Set per-project with the `isolation` field.

### Isolation Policy

```typescript
interface IsolationPolicy {
  level: "shared" | "isolated" | "quarantined";
  ownWorktree: boolean;
  gitPushAllowed: boolean;
  networkAccess: boolean;
  crossProjectAccess: boolean;
}
```

{: .note}
> Enforcement is handled by workspace/runtime plugins. The `resolveIsolation()` function returns the policy; runtime plugins enforce it.

## Agent Utilization

Track agent activity across projects at three levels: per-agent, per-project, and pool-wide.

### Per-Agent Metrics

```typescript
interface AgentUtilization {
  agentId: string;
  projectId: string;
  isActive: boolean;               // activity === "active" || status === "working"
  utilizationPercent: number;      // 100 if active, 0 if idle
  sessionDurationMs: number;
  storiesWorked: number;           // 0 or 1 (current assignments)
  crossProjectAssignments: number; // Sessions with sourceProjectId metadata
  isPoolAgent: boolean;
  projectTimeBreakdown: ProjectTimeBreakdown[];
}
```

An agent is "active" when `activity === "active"` or `status === "working"`. Utilization is binary: 100% if active, 0% if idle.

### Per-Project Metrics

```typescript
interface ProjectAgentUtilization {
  projectId: string;
  totalAgents: number;
  activeAgents: number;
  utilizationPercent: number;
  agentDetails: AgentUtilization[];
  poolAgentsTotal: number;
  poolAgentsActive: number;
  totalActiveTimeMs: number;
  totalIdleTimeMs: number;
}
```

### Pool Overview

```typescript
interface PoolUtilizationOverview {
  totalPoolAgents: number;
  activePoolAgents: number;
  utilizationPercent: number;
  reservedAgentCount: number;
  poolProjectCount: number;
  projectBreakdown: ProjectAgentUtilization[];
}
```

Returns `undefined` when no pool projects are configured.

## Blocking Alerts

Dependencies that block beyond a threshold trigger alerts.

### Alert Structure

```typescript
interface DependencyBlockingAlert {
  readonly dep: DependencyWithStatus;
  readonly blockedStoryId: string;
  readonly blockedProjectId: string;
  readonly blockingStoryId: string;
  readonly blockingProjectId: string;
  readonly blockingDurationMs: number;
  readonly blockingDurationLabel: string;  // e.g., "2h 30m", "1d 5h"
  readonly thresholdExceeded: boolean;
}
```

Default threshold: **1 hour** (`DEFAULT_BLOCKING_THRESHOLD_MS = 3_600_000`).

### Duration Format

| Duration | Label |
|----------|-------|
| < 1 minute | `<1m` |
| 5 minutes | `5m` |
| 90 minutes | `1h 30m` |
| 2 days + 5 hours | `2d 5h` |

## API Endpoints

Cross-project features are exposed through these API routes. See the linked API docs for full request/response details.

### Pool Management

| Method | Endpoint | Description | Docs |
|--------|----------|-------------|------|
| GET | `/api/pool/capacity` | Pool capacity status | [Agents API](../api/agents/) |
| GET | `/api/pool/utilization` | Pool utilization overview | [Agents API](../api/agents/) |
| GET | `/api/sprint/{project}/assignable-agents` | Local + pool agents | [Portfolio API](../api/portfolio/) |
| GET | `/api/sprint/{project}/utilization` | Project-level utilization | [Portfolio API](../api/portfolio/) |

### Cross-Project Dependencies

| Method | Endpoint | Description | Docs |
|--------|----------|-------------|------|
| GET | `/api/dependencies/cross-project` | List dependencies | [Dependencies API](../api/dependencies/) |
| POST | `/api/dependencies/cross-project` | Create dependency | [Dependencies API](../api/dependencies/) |
| DELETE | `/api/dependencies/cross-project` | Delete dependency | [Dependencies API](../api/dependencies/) |
| GET | `/api/dependencies/cross-project/graph` | Dependency graph | [Dependencies API](../api/dependencies/) |
| GET | `/api/dependencies/cross-project/blocking-status` | Blocking status with alerts | [Dependencies API](../api/dependencies/) |
| GET | `/api/dependencies/cross-project/search-stories` | Search stories across projects | [Dependencies API](../api/dependencies/) |
| GET | `/api/sprint/{project}/dependency-cycles` | Cycle detection | [Dependencies API](../api/dependencies/) |

### Risk & Utilization

| Method | Endpoint | Description | Docs |
|--------|----------|-------------|------|
| GET | `/api/risk/utilization` | Risk-aware utilization metrics | [Risk API](../api/risk/) |
| GET | `/api/agent/{id}/capacity` | Per-agent capacity check | [Agents API](../api/agents/) |

## Config Examples

### Basic Shared Pool

Two projects sharing agents bidirectionally:

```yaml
projects:
  backend:
    name: "Backend Service"
    repo: "org/backend"
    path: "~/projects/backend"
    defaultBranch: main
    sessionPrefix: "be"
    sharedPool:
      enabled: true
      eligibleProjects: ["frontend"]

  frontend:
    name: "Frontend App"
    repo: "org/frontend"
    path: "~/projects/frontend"
    defaultBranch: main
    sessionPrefix: "fe"
    sharedPool:
      enabled: true
      eligibleProjects: ["backend"]
```

### Pool with Reserved Agents and Custom Weights

Production API reserves a critical agent and prioritizes urgency:

```yaml
projects:
  api-prod:
    name: "Production API"
    repo: "org/api-prod"
    path: "~/projects/api-prod"
    defaultBranch: main
    sessionPrefix: "aprod"
    sharedPool:
      enabled: true
      eligibleProjects: ["*"]
      maxConcurrent: 8
      reservedAgents: ["aprod-1"]      # Dedicated to production only
      priority: 20
      allocationWeights:
        urgency: 0.5
        priority: 0.2
        affinity: 0.2
        workload: 0.1

  api-staging:
    name: "Staging API"
    repo: "org/api-staging"
    path: "~/projects/api-staging"
    defaultBranch: main
    sessionPrefix: "astg"
    sharedPool:
      enabled: true
      eligibleProjects: ["*"]
      maxConcurrent: 3
      priority: 5
```

### Cross-Project Dependency

When a backend story must complete before a frontend story starts, the dependency is created via the API:

```bash
# Create a cross-project dependency
curl -X POST http://localhost:3000/api/dependencies/cross-project \
  -H "Content-Type: application/json" \
  -d '{
    "sourceProjectId": "frontend",
    "sourceStoryId": "3-1-implement-settings-page",
    "targetProjectId": "backend",
    "targetStoryId": "2-4-add-settings-endpoint"
  }'
```

The dependency is persisted to `cross-project-deps.yaml`:

```yaml
dependencies:
  - id: dep-m5xk9abc-1a2b3c4d
    sourceProjectId: frontend
    sourceStoryId: 3-1-implement-settings-page
    targetProjectId: backend
    targetStoryId: 2-4-add-settings-endpoint
    createdAt: "2026-04-27T10:30:00.000Z"
```

When `2-4-add-settings-endpoint` is marked done, the dependency resolver automatically unblocks `3-1-implement-settings-page`.

---

- **Parent** — [Advanced Topics](.)
- **Siblings** — [Monte Carlo Simulation](monte-carlo/), [Custom Plugin Development](custom-plugins/), [Hooks & Extensions](hooks-extensions/), [Prompt Layers](prompt-layers/), [Production Deployment](production-deployment/)
- **API Reference** — [Dependencies API](../api/dependencies/), [Portfolio API](../api/portfolio/), [Risk API](../api/risk/), [Agents API](../api/agents/)
- **Getting Started** — [Installation](../getting-started/installation/), [Quick Start](../getting-started/quick-start/)
- **Configuration** — [Configuration Reference](../getting-started/configuration/)
