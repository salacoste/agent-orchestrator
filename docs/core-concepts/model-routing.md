---
title: Model Routing
nav_order: 7
parent: Core Concepts
description: How model routing maps story complexity to optimal AI models — tier classification, auto-escalation, usage tracking, provider health, and configuration.
---

# Model Routing

Model routing automatically matches each story to the best AI model based on complexity. Simple tasks (linting, formatting) get lightweight models; complex work (architecture, debugging) gets more capable ones. When a session fails repeatedly, the orchestrator escalates to a higher-tier model automatically.

{: .highlight }
> **TL;DR:** 3 tiers (`low` → haiku, `medium` → sonnet, `high` → opus), 20 keyword heuristics (11 low + 9 high), auto-escalation after 2 failures, usage tracking via JSONL, provider health with circuit breaker. All configurable per-project.

---

## How Model Routing Works

When a story is assigned to an agent session, the orchestrator determines the appropriate model tier through a priority cascade:

```text
resolveTier(options)
  │
  ├─ 1. explicitTier provided?
  │     └─ Yes → Use it (absolute override)
  │
  ├─ 2. Classify from story key keywords
  │
  ├─ 3. Session has >= 2 failures?
  │     ├─ Yes → Escalate one tier up
  │     │        Return max(escalated, heuristic)
  │     └─ No  → Continue
  │
  ├─ 4. Keyword heuristic matched?
  │     └─ Yes → Use heuristic tier
  │
  ├─ 5. defaultTier from config?
  │     └─ Yes → Use config default
  │
  └─ 6. Fallback → "medium"
```

{: .highlight }
> **In-memory only:** Failure tracking is stored in memory and cleared on process restart. This is intentional — persistent failure state would be over-engineering for a heuristic system.

---

## Tier Classification

Each story is classified into one of **3 tiers** based on keywords in the story key (segments split by `-` and `_`):

| Tier | Default Model | Use Case |
|------|--------------|----------|
| `low` | `haiku` | Quick tasks: exploration, formatting, listing |
| `medium` | `sonnet` | Standard development work |
| `high` | `opus` | Complex tasks: architecture, debugging, refactoring |

### LOW Keywords (11)

Stories containing these keywords in their key are routed to the `low` tier:

`explore`, `search`, `format`, `lint`, `find`, `list`, `scan`, `audit`, `check`, `validate`, `verify`

### HIGH Keywords (9)

Stories containing these keywords are routed to the `high` tier:

`architect`, `design`, `debug`, `debugger`, `fix`, `investigate`, `troubleshoot`, `refactor`, `migrate`

### Classification Rules

- Keywords are matched from the **story key** (e.g., `58-4-model-routing-service`), not from story content
- LOW keywords are checked **first** — if both LOW and HIGH keywords match, LOW wins
- If no keyword matches, the tier falls through to config default or `"medium"`

---

## Auto-Escalation

When a session fails on the same model tier 2 or more times, the orchestrator automatically escalates:

```text
Session fails
  │
  ├─ recordFailure(sessionId, tier)
  │     ├─ Same tier as before? → count++
  │     └─ Different tier? → reset count to 1
  │
  ├─ count >= 2 on next resolveTier()?
  │     ├─ Escalate: low → medium → high
  │     └─ Return max(escalated, heuristic)
  │
  └─ Already at "high"?
        └─ Stay at "high"
```

- `recordFailure()` increments the counter if the **same tier** fails again
- If the **tier changes** (e.g., the heuristic picks a different tier), the counter **resets to 1**
- `resetFailures()` clears the record on success
- `getFailureCount()` returns the current failure count for a session

---

## Usage Tracking

The `ModelUsageAggregator` records model usage events in an append-only JSONL file for cost analysis and reporting.

### ModelUsageEvent

Each usage event has **9 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Session that used the model |
| `storyId` | string | Story being worked on |
| `projectId` | string | Project the session belongs to |
| `modelTier` | `"low" \| "medium" \| "high"` | Tier used |
| `model` | string | Actual model identifier |
| `inputTokens` | number | Input tokens consumed |
| `outputTokens` | number | Output tokens consumed |
| `estimatedCostUsd` | number | Estimated cost in USD |
| `timestamp` | string | ISO timestamp of the event |

### UsageAggregate

Aggregated statistics have **4 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `totalInputTokens` | number | Total input tokens |
| `totalOutputTokens` | number | Total output tokens |
| `totalCostUsd` | number | Total estimated cost |
| `sessionCount` | number | Number of sessions included |

### Aggregator Methods

The `ModelUsageAggregator` provides **6 methods**:

| Method | Description |
|--------|-------------|
| `recordUsage(event)` | Append a usage event to JSONL |
| `getBySession(sessionId)` | Aggregate usage for a session |
| `getByStory(storyId)` | Aggregate usage for a story |
| `getByProject(projectId)` | Aggregate usage for a project |
| `getBySprint(projectPath)` | Aggregate usage for a sprint (async) |
| `getSummary()` | Per-tier breakdown with totals — returns `{ totalTokens, totalCost, byTier }` (not UsageAggregate) |

**Storage:** `{sessionsDir}/audit/model-usage.jsonl` — append-only, with 3 secondary indexes (session, story, project) for fast queries.

---

## Provider Interface

Session enhancement providers implement the `SessionEnhancementProvider` interface. The provider lifecycle follows: **install → configure → enhance → teardown**.

| Method | Description |
|--------|-------------|
| `name` | Readonly provider identifier |
| `install(worktreePath, config)` | One-time setup after workspace creation (idempotent) |
| `configure(worktreePath, context)` | Per-story setup before agent launch |
| `enhance(session)` | Modify session object (reserved for future use) |
| `teardown(worktreePath)` | Best-effort cleanup on session kill |
| `healthCheck()` | Report provider health status |

The default `"raw"` provider is a no-op — it passes everything through unchanged.

### StoryContext

The `configure()` method receives a `StoryContext` with **7 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `storyId` | string | Story identifier |
| `storyTitle` | string? | Story title |
| `acceptanceCriteria` | string[]? | Story acceptance criteria |
| `relevantFiles` | string[]? | Files likely relevant to the story |
| `dependencies` | string[]? | Story dependencies |
| `storyType` | `"exploration" \| "implementation" \| "bugfix" \| "review" \| "default"` | Category of work |
| `agents` | AgentMapping? | Agent configuration for this story |

---

## Provider Health

Provider health monitoring uses a **circuit breaker** pattern to gracefully degrade when a provider becomes unavailable.

### Circuit Breaker States

```text
CLOSED (healthy)
  │
  ├─ Failures reach threshold (3)?
  │     └─ → OPEN
  │
OPEN (unhealthy)
  │
  ├─ Wait openDurationMs (60s)?
  │     └─ → HALF-OPEN
  │
HALF-OPEN (testing)
  │
  ├─ Health check succeeds?
  │     └─ → CLOSED
  │
  └─ Health check fails?
        └─ → OPEN
```

### Health Check Flow

1. Call `provider.healthCheck()`
2. If `healthy` → record success (circuit stays closed)
3. If not healthy → record failure (may open circuit)
4. If health check throws → treat as unhealthy

### ProviderHealthStatus

The `getStatus()` method returns a `ProviderHealthStatus` with **4 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `breakerState` | `"closed" \| "open" \| "half-open"` | Current circuit breaker state |
| `lastHealth` | ProviderHealth? \| null | Last health check result (null if never checked) |
| `monitoring` | boolean | Whether the monitor is currently running |
| `checkCount` | number | Number of health checks performed |

### Provider Health Defaults

These defaults are from the `ProviderHealthConfig` schema, which overrides the raw circuit breaker's internal defaults (failure threshold 5, open duration 30s) when used through session enhancement:

| Setting | Default | Description |
|---------|---------|-------------|
| `healthCheckIntervalMs` | `30000` (30s) | How often to poll provider health |
| `failureThreshold` | `3` | Failures before circuit opens |
| `openDurationMs` | `60000` (60s) | Time before trying half-open |

---

## Cost Dashboard

The web dashboard includes a cost breakdown panel that queries the model usage API.

### API Endpoint

`GET /api/costs/breakdown` — returns model usage aggregated by dimension:

| Dimension | Parameter | Description |
|-----------|-----------|-------------|
| `summary` | (none) | Per-tier breakdown with totals |
| `session` | `sessionId` | Usage for a single session |
| `story` | `storyId` | Usage for a single story |
| `project` | `projectId` | Usage for a project |
| `sprint` | `projectPath` | Usage for a sprint |

### Dashboard Panel

The `CostBreakdownPanel` shows:
- Total tokens and estimated cost
- Per-tier bars (Haiku, Sonnet, Opus) with proportional widths
- Polls the API every 30 seconds
- Retains previous data on fetch failure

---

## CLI

### View registered providers

```bash
ao providers [--json]
```

Displays a table with Name, Version, and Description for all registered providers, plus an Active Configuration section showing global and project-specific provider assignments.

---

## Configuration

Model routing is configured via the `sessionEnhancement` section in `agent-orchestrator.yaml`:

### Basic Model Tiers

```yaml
sessionEnhancement:
  provider: raw
  modelTiers:
    low: haiku
    medium: sonnet
    high: opus
```

### With Provider Health

```yaml
sessionEnhancement:
  provider: omc
  modelTiers:
    low: haiku
    medium: sonnet
    high: opus
  health:
    healthCheckIntervalMs: 30000
    failureThreshold: 3
    openDurationMs: 60000
```

### Per-Project Override

```yaml
projects:
  my-app:
    repo: org/repo
    path: ~/projects/my-app
    sessionEnhancement:
      provider: omc
      modelTiers:
        low: haiku
        medium: sonnet
        high: opus
    agentMappings:
      exploration:
        agents: ["claude-code"]
        executionMode: lightweight
```

### SessionEnhancementConfig Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | `"raw"` | Provider plugin name |
| `config` | Record? | — | Arbitrary provider configuration |
| `modelTiers` | ModelTierMapping? | (see defaults) | Tier-to-model mapping |
| `health` | ProviderHealthConfig? | (see [Provider Health Defaults](#provider-health-defaults)) | Health monitoring config |
| `hookProfile` | HookProfile? | — | Per-project hook profile override |
| `agentMappings` | Record? | — | Per-project agent mapping overrides |

### Tier Resolution Cascade

The model name for a tier is resolved through a 3-level cascade:

1. **Project override:** `project.sessionEnhancement.modelTiers`
2. **Global config:** `config.sessionEnhancement.modelTiers`
3. **Built-in defaults:** `{ low: "haiku", medium: "sonnet", high: "opus" }`

See the [Configuration](../../getting-started/configuration/) page for the full config reference.

---

## Next Steps

- **[Verification Gate](../verification-gate/)** — quality checks before story completion
- **[Memory & Learning](../memory-learning/)** — how agents learn from past sessions
- **[Configuration](../../getting-started/configuration/)** — full config reference and overrides
