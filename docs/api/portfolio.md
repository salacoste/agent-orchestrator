---
title: Portfolio API
nav_order: 5
parent: REST API
description: Portfolio management endpoints — assignable agents with capacity status, per-project utilization metrics, and pool route cross-references.
---

# Portfolio API

Portfolio-level agent management and project utilization metrics.

2 route files under `/api/sprint/{project}/` plus 2 pool management routes documented in the [Agents API](agents/).

| Group | Prefix | Routes | Description |
|-------|--------|--------|-------------|
| Project Agents | `/api/sprint/{project}` | 2 | Assignable agents, utilization |
| Pool Management | `/api/pool` | 2 | Capacity, utilization *(see [Agents API](agents/))* |

Source: `packages/web/src/app/api/sprint/[project]/`, `packages/web/src/app/api/pool/`

## Assignable Agents

```
GET /api/sprint/{project}/assignable-agents
```

Returns agents available for assignment to a project — both local idle agents and eligible pool agents from other projects. Each agent includes a capacity status breakdown.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `project` | string | Project identifier |

### Response

```json
{
  "agents": [
    {
      "agentId": "session-abc",
      "projectId": "my-project",
      "sourceProjectId": null,
      "isPoolAgent": false,
      "currentWorkload": 1,
      "capacityStatus": {
        "maxCapacity": 3,
        "availableSlots": 2,
        "isAtCapacity": false,
        "isNearCapacity": false,
        "utilizationPercent": 33
      }
    },
    {
      "agentId": "session-def",
      "projectId": "shared-pool",
      "sourceProjectId": "other-project",
      "isPoolAgent": true,
      "currentWorkload": 0,
      "capacityStatus": {
        "maxCapacity": 3,
        "availableSlots": 3,
        "isAtCapacity": false,
        "isNearCapacity": false,
        "utilizationPercent": 0
      }
    }
  ],
  "summary": {
    "total": 2,
    "local": 1,
    "pool": 1
  }
}
```

Uses `getAssignableAgents()` from `@composio/ao-core` to gather local idle + eligible pool agents, then calls `checkCapacity()` for each to compute workload and capacity flags.

The `sourceProjectId` is `null` for local agents and set to the originating project for pool agents.

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `404` | Project not found |
| `500` | Internal error |

Source: `packages/web/src/app/api/sprint/[project]/assignable-agents/route.ts`

## Project Utilization

```
GET /api/sprint/{project}/utilization
```

Returns per-project agent utilization metrics including per-agent breakdown, active/idle time totals, and pool agent counts.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `project` | string | Project identifier |

### Response

```json
{
  "projectId": "my-project",
  "totalAgents": 3,
  "activeAgents": 2,
  "utilizationPercent": 67,
  "agentDetails": [
    {
      "agentId": "session-abc",
      "projectId": "my-project",
      "isActive": true,
      "utilizationPercent": 100,
      "sessionDurationMs": 3600000,
      "storiesWorked": 1,
      "crossProjectAssignments": 0,
      "isPoolAgent": false,
      "projectTimeBreakdown": [
        { "projectId": "my-project", "durationMs": 3600000, "percent": 100, "isLocal": true }
      ]
    }
  ],
  "poolAgentsTotal": 0,
  "poolAgentsActive": 0,
  "totalActiveTimeMs": 7200000,
  "totalIdleTimeMs": 1800000
}
```

Uses `computeProjectUtilization()` from `@composio/ao-core` which filters sessions by project, computes per-agent metrics, and aggregates totals. `poolAgentsTotal` and `poolAgentsActive` are non-zero only for pool-enabled projects. Note: In pool-enabled projects, all agents in the response have `isPoolAgent: true` — the flag is set per-project, not per-individual-agent assignment.

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | `string` | Project identifier |
| `totalAgents` | `number` | Total sessions for project |
| `activeAgents` | `number` | Sessions with `activity === "active"` or `status === "working"` |
| `utilizationPercent` | `number` | `round((activeAgents / totalAgents) * 100)` |
| `agentDetails` | `AgentUtilization[]` | Per-agent breakdown |
| `poolAgentsTotal` | `number` | Total pool agents (0 if not pool project) |
| `poolAgentsActive` | `number` | Active pool agents |
| `totalActiveTimeMs` | `number` | Sum of active agent session durations |
| `totalIdleTimeMs` | `number` | Sum of idle agent session durations |

### Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `404` | Project not found |
| `500` | Internal error |

Source: `packages/web/src/app/api/sprint/[project]/utilization/route.ts`

## Pool Routes

Pool-level capacity and utilization endpoints are documented in the [Agents API](agents/) under **Pool Capacity** and **Pool Utilization** sections.

| Route | Method | Description | Documentation |
|-------|--------|-------------|---------------|
| `/api/pool/capacity` | GET | Per-agent capacity + aggregate summary | [Agents API — Pool Capacity](agents/#pool-capacity) |
| `/api/pool/utilization` | GET | Pool utilization overview | [Agents API — Pool Utilization](agents/#pool-utilization) |

Both pool routes return `{ "enabled": false }` when no pool-enabled projects are configured (but at least one project exists). Returns `404` with `{ "error": "No projects configured" }` when no projects exist at all.

## Common Patterns

### No `force-dynamic`

Neither route exports `dynamic = "force-dynamic"`. They use Next.js default caching behavior.

### Agent Registry

Both routes build an agent registry from the project's sessions directory using `getAgentRegistry()` from `@composio/ao-core`. The registry tracks agent assignments and enables workload computation.

### Pool Agent Detection

Pool agents are identified by the project's `sharedPool` configuration. Pool-enabled projects contribute their idle agents to the shared pool, which other projects can draw from via `getAssignableAgents()`.

### Capacity Status

The `capacityStatus` object in assignable-agents responses is computed per agent via `checkCapacity()` from `@composio/ao-core`. It resolves per-project capacity configuration and compares current workload against the maximum.

### Project Validation

Both routes validate the project exists in `config.projects` and return `404` if not found.

## Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success |
| `404` | Project not found |
| `500` | Internal error |

## Key Types

### AgentUtilization

| Field | Type |
|-------|------|
| `agentId` | `string` |
| `projectId` | `string` |
| `isActive` | `boolean` |
| `utilizationPercent` | `number` |
| `sessionDurationMs` | `number` |
| `storiesWorked` | `number` |
| `crossProjectAssignments` | `number` |
| `isPoolAgent` | `boolean` |
| `projectTimeBreakdown` | `ProjectTimeBreakdown[]` |

### Capacity Status

| Field | Type |
|-------|------|
| `maxCapacity` | `number` |
| `availableSlots` | `number` |
| `isAtCapacity` | `boolean` |
| `isNearCapacity` | `boolean` |
| `utilizationPercent` | `number` |

---

- **Parent** — [REST API](./)
- **Getting Started** — [Installation](../getting-started/installation/) and [Quick Start](../getting-started/quick-start/)
- **Configuration** — [Configuration Reference](../getting-started/configuration/)
- **Related** — [Agents API](agents/) (pool routes), [Dependencies API](dependencies/), [Sprints API](sprints/)
