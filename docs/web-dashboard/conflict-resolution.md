---
title: Conflict Resolution
nav_order: 5
parent: Web Dashboard
description: Conflict detection across resource types, severity computation, resolution workflows with AI suggestions, policy configuration hierarchy, conflict history with pattern analysis, file-level and agent assignment conflict detection, and real-time SSE updates
---

# Conflict Resolution

The conflict resolution system detects, manages, and resolves resource conflicts across projects. It covers four resource types (repository, file-path, agent, external-service), computes severity based on contention level, generates resolution suggestions per strategy, enforces configurable policies through a 4-level hierarchy, tracks history with pattern analysis, and provides real-time updates via SSE.

{: .highlight }
Conflicts are detected using **O(n) hash map grouping** by (resource type, identifier). When multiple projects compete for the same resource, a conflict is created with severity computed from the resource type and number of competing projects. Policies are resolved through a 4-level hierarchy: project-type override → project-default → global-default → hardcoded "manual".

## Overview

The conflict system spans a single page with three tabs:

| Tab | Component | Description |
|-----|-----------|-------------|
| **Active** | `ConflictAlertDashboard` | Live conflicts with SSE updates, summary cards, filterable list, and detail panel |
| **History** | `ConflictHistoryView` | Filterable conflict history with pattern analysis and JSON export |
| **Policies** | `ConflictPolicyPanel` | Per-resource-type resolution mode configuration |

**Page route:** `/conflicts` (`packages/web/src/app/conflicts/page.tsx`) — server component with `force-dynamic`. Loads initial data via `checkResourceConflicts(config, store)` and passes results to the client component.

**Client layout** (`packages/web/src/app/conflicts/client.tsx`) renders a 3-tab interface with `TabButton` navigation (border-bottom-2 highlight, blue-600 when selected).

## Resource Conflict Detection

The detection engine (`packages/core/src/resource-conflict.ts`) identifies resource conflicts across all configured projects:

1. **Extract resources** — `extractProjectResources(config)` collects `ProjectResource[]` from each project's repository paths, file paths, and shared-pool agent definitions
2. **Detect conflicts** — `detectResourceConflicts(resources)` groups resources by `(type, identifier)` using an O(n) hash map. Groups with >1 competing project become conflicts
3. **Compute severity** — `computeConflictSeverity(resourceType, competingCount)` applies the severity model:
   - `agent`: always critical
   - `repository`: high (critical if >2 projects)
   - `file-path`: medium (high if >2 projects)
   - `external-service`: low (medium if >2 projects)
4. **Persist and audit** — `checkResourceConflicts(config, store)` is the main entry point: runs detection, persists results to YAML store, appends an audit trail entry, and emits callbacks

## Conflict Types

Four resource types are monitored:

| Type | Identifier Example | Typical Conflict |
|------|-------------------|------------------|
| `repository` | Git repo URL | Multiple agents editing same repo |
| `file-path` | File glob pattern | Agents modifying overlapping files |
| `agent` | Shared pool agent ID | Multiple projects assigning work to same agent |
| `external-service` | API endpoint | Competing API rate limits |

**Severity levels:** `critical`, `high`, `medium`, `low` — displayed via `ConflictSeverityBadge` (critical=red, high=orange, medium=yellow, low=green).

## Active Conflicts Dashboard

`ConflictAlertDashboard` (`packages/web/src/components/ConflictAlertDashboard.tsx`) provides the primary conflict monitoring view:

**Real-time updates** — subscribes to SSE via `useConflictSSE` hook. New conflicts are deduplicated against existing IDs and displayed with a blue "New" badge.

**Summary cards** (`ConflictSummaryCards.tsx`) — 4-card grid:
- Total Conflicts count
- Critical / High count (red if >0, green if 0)
- By Severity breakdown (inline labels with counts)
- By Resource Type breakdown

**Filterable list** (`ConflictListView.tsx`) — two `<select>` dropdowns:
- Resource type filter: repository, file-path, agent, external-service
- Severity filter: critical, high, medium, low

Each conflict card shows severity badge, resource type, resource identifier (mono font), competing project count, detection timestamp, and optional "New" badge.

## Conflict Detail Panel

`ConflictDetailPanel` (`packages/web/src/components/ConflictDetailPanel.tsx`) renders a fixed-position slide-over panel (right-aligned, max-w-md) when a conflict is selected:

- Closes on Escape key or backdrop click
- **Severity badge** with color coding
- **Resource type** with label mapping (repository → "Repository", file-path → "File Path", etc.)
- **Resource identifier** in mono font
- **Competing projects** list with count
- **Detected at** timestamp (localized)
- **Metadata** key-value pairs
- **Resolution suggestions** (renders `ConflictSuggestionsList`)
- **Conflict ID** in mono font

## Resolution Suggestions

The suggestion engine (`packages/core/src/resource-conflict-suggestions.ts`) generates actionable recommendations:

**Five resolution strategies:**

| Strategy | Description | Applicable Types |
|----------|-------------|-----------------|
| `sequential-scheduling` | Queue access sequentially | repository, file-path |
| `resource-isolation` | Isolate resources per project | repository, file-path |
| `agent-reassignment` | Move agent to different project | agent (requires shared pool) |
| `increase-capacity` | Add more resources | agent, external-service |
| `stagger-schedules` | Offset project schedules | repository, agent, external-service |

**Recommended strategy by severity:**
- Critical → `resource-isolation`
- High → `sequential-scheduling`
- Medium → `stagger-schedules`
- Low → no suggestion (empty array returned)

**Agent reassignment** is skipped unless at least one competing project has `sharedPool.enabled === true`.

Each suggestion includes:
- `id` — unique suggestion identifier
- `strategy` — one of the 5 strategies
- `description` — human-readable explanation
- `impactEstimate` — heuristic impact text
- `recommended` — boolean (true for the top suggestion)
- `actions` — array of `{ type: "config-change" | "agent-operation" | "schedule-change", description }`

**API endpoint:** `GET /api/conflicts/{conflictId}/suggestions`

**Component:** `ConflictSuggestionsList` (`packages/web/src/components/ConflictSuggestionsList.tsx`) fetches suggestions on mount. Shows loading, error, and empty states. Recommended suggestions have blue background. Each card shows strategy title, description, impact estimate, and action bullets.

## Conflict Resolution

The `POST /api/conflicts/[conflictId]` endpoint resolves a conflict with one of three actions:

| Action | Result |
|--------|--------|
| `keep-existing` | Keeps existing agent, terminates new agent |
| `replace-with-new` | Replaces with new agent, terminates existing |
| `manual` | No automatic action (both `keptAgent` and `terminatedAgent` are null) |

{: .note }
The resolution endpoint currently returns a **mock response** — it is not yet wired to the real `ConflictResolutionService`.

**Resolution service** (`packages/core/src/conflict-resolution.ts`) implements tie-breaker logic:
- **Tie-breaker modes:** `"recent"` (most recent assignment wins) or `"progress"` (agent with most progress wins)
- **Auto-resolve threshold:** 0.3 (30% score difference required for automatic resolution)
- **Project-specific config:** per-project overrides for auto-resolve, tie-breaker, priority weights, and custom factors

## Policy Configuration

`ConflictPolicyPanel` (`packages/web/src/components/ConflictPolicyPanel.tsx`) provides per-resource-type resolution mode configuration:

| Mode | Behavior |
|------|----------|
| `priority-based` | Winner selected via priority order, shared pool priority, or alphabetical tiebreaker |
| `manual` | No automatic action — requires human intervention |
| `isolation` | Builds isolation plan with resource-type-specific strategies (branch-per-project, separate-worktree, dedicated-agent, isolated) |

**Policy resolution hierarchy** (`resolvePolicyForResource()` from `packages/core/src/conflict-policy.ts`):

1. **Project-type override** — `project.conflictResolution.policies[resourceType].resolutionMode`
2. **Project-level default** — `project.conflictResolution.default`
3. **Global default** — `config.conflictResolution.default`
4. **Hardcoded fallback** — `"manual"`

The panel displays a 2-column grid of cards, one per resource type (Repository, File Path, Agent, External Service). Each card shows current mode badge (blue), mode description, and a `<select>` dropdown to change modes. Updates are applied to in-memory config via `PUT /api/conflicts/policies/{resourceType}`.

## Conflict History

`ConflictHistoryView` (`packages/web/src/components/ConflictHistoryView.tsx`) provides filterable conflict history with pattern analysis:

**Filters** (`ConflictHistoryFilters.tsx`) — 5 filter controls:
- From date (`<input type="date">`)
- To date
- Resource type (repository, agent, file-path, external-service)
- Project ID (text input)
- Outcome (resolved, auto-resolved, dismissed, escalated)

**Pattern summary** (`ConflictPatternSummary.tsx`) — 4-card grid:
- Total Resolved count
- Avg Resolution Time (formatted as hours/minutes)
- Most Conflicted Resource (or "N/A")
- Recurring Conflicts list (resource identifier + count)

**History list** (`ConflictHistoryList.tsx`) — vertical card list with:
- Resource identifier, type, and competing projects
- `OutcomeBadge` (resolved=green, auto-resolved=blue, dismissed=gray, escalated=red)
- Strategy name, resolved-by, formatted date, optional notes

**Export:** "Export JSON" button triggers `GET /api/conflicts/history/export` with current filters, returning a downloadable JSON file with metadata.

**API endpoints:** `GET /api/conflicts/history`, `GET /api/conflicts/history/export`

## Project Conflict Table

`ConflictHistoryTable` (`packages/web/src/components/ConflictHistoryTable.tsx`) provides a per-project conflict listing:

**Summary cards** — 4-column grid: Total, Critical/High, Medium, Low

**Sort options:** `recency` (newest first) or `frequency` (group by story, most conflicts first)

**Export formats:** CSV or JSON file download

**Table columns:** Conflict ID (truncated), Story, Existing Agent, Conflicting Agent, Severity (colored badge), Detected (relative time), Resolution (green "resolved" or yellow "Pending"), Actions ("View Details")

**Detail modal** shows full conflict info, priority scores (percentage), recommendations, and resolution.

**API endpoint:** `GET /api/sprint/{project}/conflicts?sort=recency|frequency&export=csv|json`

## File Conflict Detection

File-level conflict detection (`packages/web/src/lib/workflow/conflict-detector.ts`) identifies overlapping file modifications between agents:

- `detectFileConflicts(changes: AgentFileChange[])` — O(n) hash map detection
- `AgentFileChange` data is merged from the learning store (`getLearningStore()`) and session metadata (`filesModified`, JSON-parsed)
- Falls back to session metadata when learning store has no data for an agent

`useConflictCheckpoint` hook polls `GET /api/sprint/conflicts` every 30 seconds. The endpoint sets `Cache-Control: no-cache, no-store, must-revalidate` and returns `{ conflicts, timeline: null, timestamp }`. The checkpoint timeline is deferred pending git log implementation.

`ConflictCheckpointPanel` (`packages/web/src/components/ConflictCheckpointPanel.tsx`) shows file conflicts with agent pairs and optional rollback buttons per checkpoint.

## Agent Assignment Conflicts

`ConflictDetectionServiceImpl` (`packages/core/src/conflict-detection.ts`) manages agent-assignment conflicts:

**Priority scoring formula:**

```
score = base(0.5 assigned, 0.3 unassigned) + timeBonus(max +0.3, 24h+) + agentTypeBonus(0.1 story, 0.05 CLI) − retryPenalty(max −0.2)
```

Result is clamped to 0–1. Unassigned agents (new agents) start with a base of 0.3; agents with an existing assignment start at 0.5.

**Severity thresholds:**
- Existing agent score > 0.7 → **critical**
- Score difference < 0.2 → **high**
- Score difference < 0.5 → **medium**
- Otherwise → **low**

**Auto-resolution:** Triggers when score difference exceeds threshold 0.3 (30%). Uses `createConflictDetectionService(registry, { enabled: true, autoResolve: { threshold: 0.3 } })` factory.

**Startup detection:** `detectStartupConflicts()` scans all current assignments at orchestrator startup, with `getStartupSummary()` returning `{ totalAssignments, conflictCount, autoResolvedCount, conflictsBySeverity, conflicts }`.

## Real-Time Updates

The conflict system uses two real-time update mechanisms:

**SSE (Server-Sent Events):**
- `useConflictSSE` hook (`packages/web/src/hooks/useConflictSSE.ts`) subscribes to `/api/events`
- Listens for `conflict-detected` event type (from `CONFLICT_SSE_EVENT_TYPE` constant)
- Uses ref pattern to avoid re-subscribing when callback identity changes
- EventSource auto-reconnects on error (default browser behavior)

**Conflict broadcaster** (`packages/web/src/lib/conflict-broadcaster.ts`):
- globalThis singleton pub/sub pattern
- `detectAndBroadcast(config)` runs detection, filters to new-only conflicts by ID deduplication, notifies all subscribers
- `subscribeConflictChanges(callback)` returns an unsubscribe function

**Polling (30-second):**
- `useConflictCheckpoint` hook polls file conflict endpoint every 30 seconds
- Uses AbortController for cancellation, retains previous data on fetch failure

## Persistence

Three persistence files manage conflict state:

| File | Format | Purpose |
|------|--------|---------|
| `resource-conflicts.yaml` | YAML | Active conflict data via `ResourceConflictFileStore` with private cache and validation on read |
| `resource-conflicts-audit.jsonl` | JSONL | Append-only audit trail for all detection runs |
| `conflict-history.jsonl` | JSONL | Resolution history with filtering, pattern computation, and export |

**Conflict ID format:** `conflict-<timestamp-base36>-<random-hex>`
**Suggestion ID format:** `suggestion-<timestamp-base36>-<random-hex>`

The `ResourceConflictFileStore` class (`packages/core/src/resource-conflict.ts`) provides `save()`, `list()`, `getActive()`, and `clear()` methods with file-backed YAML storage and in-memory cache.

## API Routes

### Conflict Detection & Resolution

| Method | Endpoint | Purpose | Key Status Codes |
|--------|----------|---------|------------------|
| `GET` | `/api/conflicts` | Detect and list conflicts (with optional `resourceType` and `projectId` filters) | 200, 500 |
| `POST` | `/api/conflicts/{conflictId}` | Resolve conflict with action (keep-existing, replace-with-new, manual) | 200, 400, 500 |
| `GET` | `/api/conflicts/{conflictId}/suggestions` | Get resolution suggestions for a conflict | 200, 404, 500 |

### History

| Method | Endpoint | Purpose | Key Status Codes |
|--------|----------|---------|------------------|
| `GET` | `/api/conflicts/history` | List history with filters (dateFrom, dateTo, resourceType, projectId, outcome) | 200, 500 |
| `GET` | `/api/conflicts/history/export` | Export filtered history as JSON download | 200, 500 |

### Policies

| Method | Endpoint | Purpose | Key Status Codes |
|--------|----------|---------|------------------|
| `GET` | `/api/conflicts/policies` | Get all policies (with optional `projectId` for resolved overrides) | 200, 500 |
| `GET` | `/api/conflicts/policies/{resourceType}` | Get effective policy for one resource type | 200, 400, 500 |
| `PUT` | `/api/conflicts/policies/{resourceType}` | Update policy (in-memory config only) | 200, 400, 500 |

### Sprint-Level Conflicts

| Method | Endpoint | Purpose | Key Status Codes |
|--------|----------|---------|------------------|
| `GET` | `/api/sprint/conflicts` | File-level conflict detection across active sessions | 200 |
| `GET` | `/api/sprint/{project}/conflicts` | Agent-assignment conflicts per project (with sort and export) | 200, 404, 500 |

**Key validation rules:**
- `resourceType` must be one of: `repository`, `file-path`, `agent`, `external-service`
- `action` must be one of: `keep-existing`, `replace-with-new`, `manual`
- `resolutionMode` must be one of: `priority-based`, `manual`, `isolation`
- `outcome` must be one of: `resolved`, `dismissed`, `escalated`, `auto-resolved`
- Project must exist in config (404 if not found)

## Key Types

### ResourceConflict

```typescript
interface ResourceConflict {
  id: string;                              // conflict-<base36>-<hex>
  resourceType: ResourceConflictType;      // "repository" | "file-path" | "agent" | "external-service"
  resourceIdentifier: string;
  competingProjects: string[];
  severity: ResourceConflictSeverity;      // "critical" | "high" | "medium" | "low"
  detectedAt: string;                      // ISO 8601
  metadata: Record<string, unknown>;
}
```

### ResourceConflictPolicy

```typescript
interface ResourceConflictPolicy {
  resourceType: ResourceConflictType;
  resolutionMode: ConflictResolutionMode;  // "priority-based" | "manual" | "isolation"
  priorityOrder?: string[];
  isolationConfig?: { strategy: string };
  source?: string;                         // "project:<id>" | "global" | "hardcoded"
}
```

### ResourceConflictSuggestion

```typescript
interface ResourceConflictSuggestion {
  id: string;
  conflictId: string;
  strategy: ResourceConflictResolutionStrategy;
  description: string;
  impactEstimate: string;
  recommended: boolean;
  actions: SuggestionAction[];
}
```

### ConflictHistoryEntry

```typescript
interface ConflictHistoryEntry {
  id: string;
  conflict: ResourceConflict;
  resolvedAt: string;                      // ISO 8601
  resolutionStrategy: ResourceConflictResolutionStrategy | "manual" | "none";
  resolutionOutcome: ConflictResolutionOutcome;
  resolvedBy: string;
  notes: string;
}
```

### ConflictPatternSummary

```typescript
interface ConflictPatternSummary {
  totalResolved: number;
  byResourceType: Partial<Record<ResourceConflictType, number>>;
  byOutcome: Partial<Record<ConflictResolutionOutcome, number>>;
  byStrategy: Partial<Record<ResourceConflictResolutionStrategy | "manual" | "none", number>>;
  mostConflictedResource: string | null;
  avgResolutionTimeMs: number;
  recurringConflicts: Array<{ resourceIdentifier: string; count: number }>;
}
```

### Supporting Types

| Type | Values/Shape | Description |
|------|-------------|-------------|
| `ResourceConflictType` | `"repository" \| "file-path" \| "agent" \| "external-service"` | Monitored resource categories |
| `ResourceConflictSeverity` | `"critical" \| "high" \| "medium" \| "low"` | Conflict severity level |
| `ConflictResolutionMode` | `"priority-based" \| "manual" \| "isolation"` | Policy resolution mode |
| `ConflictResolutionOutcome` | `"resolved" \| "dismissed" \| "escalated" \| "auto-resolved"` | History entry outcome |
| `ConflictHistoryFilter` | `{ dateFrom?, dateTo?, resourceType?, projectId?, resolutionOutcome? }` | History query filter |
| `SuggestionAction` | `{ type: "config-change" \| "agent-operation" \| "schedule-change", description }` | Suggested action step |
| `FileConflict` | `{ filePath, agentA, agentB }` | File-level conflict between two agents |
| `AgentConflictEvent` | `{ conflictId, storyId, existingAgent, conflictingAgent, type, detectedAt, priorityScores }` | Agent assignment conflict |
| `AgentConflictResolution` | `{ resolution: "keep-existing" \| "replace-with-new" \| "manual", resolvedAt?, resolvedBy? }` | Resolution record |

## Next Steps

- [Web Dashboard Overview](./index.md) — Dashboard architecture and navigation
- [Portfolio View](./portfolio-view.md) — Cross-project portfolio dashboard
- [Sprint Board](./sprint-board.md) — Story columns, assignment, and analytics
- [Session Detail](./session-detail.md) — Individual session deep-dive view
- [Scenario Comparison](./scenario-comparison.md) — What-if analysis and Monte Carlo simulation
- [Conflicts API](../api/conflicts.md) — Full API reference for conflict endpoints *(upcoming)*
- [Getting Started](../getting-started/index.md) — Installation and first steps
- [Configuration](../getting-started/configuration.md) — YAML configuration reference
