---
title: Provider Plugins
nav_order: 8
parent: Plugins
has_children: true
description: Provider plugin slot with 2 built-in plugins — Raw (no-op default fallback) and OMC (oh-my-claudecode filesystem-based session enhancement). Comparison table and selection guide.
---

# Provider Plugins

The provider plugin enhances agent sessions with additional capabilities — installing tools, injecting configuration, enriching session metadata, and managing workspace state. It runs as part of the session spawn pipeline: install → configure → **(enhance — reserved for future use)** → (session runs) → teardown. Agent Orchestrator ships with 2 provider plugins: **Raw** (default, no-op) and **OMC** (oh-my-claudecode session enhancement).

{: .highlight }
> **TL;DR:** 2 plugins — Raw (default, zero-overhead fallback) and OMC (filesystem-based, installs oh-my-claudecode with 9 agents and model routing). Both implement the 5-method `SessionEnhancementProvider` interface. Choose Raw for minimal sessions, OMC for enhanced multi-agent orchestration.

---

## SessionEnhancementProvider Interface

All provider plugins implement the `SessionEnhancementProvider` interface from `@composio/ao-core`. The interface defines **1 property + 5 methods** (all required):

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` (readonly) | Plugin display name |

### Required Methods (5)

| Method | Signature | Description |
|--------|-----------|-------------|
| `install` | `(worktreePath, config) => Promise<void>` | Install provider into worktree |
| `configure` | `(worktreePath, context) => Promise<void>` | Configure provider for a specific story |
| `enhance` | `(session) => Promise<Session>` | Enrich session with provider metadata (reserved — not yet called in pipeline) |
| `teardown` | `(worktreePath) => Promise<void>` | Remove provider from worktree |
| `healthCheck` | `() => Promise<ProviderHealth>` | Check provider health status |

### Supporting Types

**ProviderConfig** — Configuration object passed to `install`:
```typescript
interface ProviderConfig {
  // Agent model assignments, model tiers, etc.
}
```

**StoryContext** — Context about the current story passed to `configure`:
```typescript
interface StoryContext {
  // Story metadata, project info, etc.
}
```

**ProviderHealth** — Health check result:
```typescript
interface ProviderHealth {
  healthy: boolean;
  message?: string; // Set when unhealthy
  lastCheck: Date;
}
```

---

## Plugin Comparison

| Feature | Raw | OMC |
|---------|-----|-----|
| **Package** | `@composio/ao-plugin-provider-raw` | `@composio/ao-plugin-provider-omc` |
| **Default** | Yes | No |
| **Transport** | None (no-op) | Filesystem (`fs/promises`) |
| **Config required** | None | Optional (agents, modelTiers) |
| **install** | No-op | Creates `.omc/` directory structure |
| **configure** | No-op | Generates JSONC config + CLAUDE.md additions |
| **enhance** | Returns session unchanged | Adds `omc:agents`, `omc:executionMode`, `omc:configured` metadata |
| **teardown** | No-op | Removes `.omc/` directory |
| **healthCheck** | Always `{ healthy: true }` | Always `{ healthy: true }` |
| **Error resilience** | Cannot fail | `enhance` returns session unchanged on error |

---

## Configuration

The provider is configured in the `sessionEnhancement` section:

```yaml
sessionEnhancement:
  provider: raw  # default — no-op
```

### With OMC Provider

```yaml
sessionEnhancement:
  provider: omc
```

### Provider Health Config

```yaml
sessionEnhancement:
  provider: omc
  health:
    healthCheckIntervalMs: 30000  # check every 30s (default)
    failureThreshold: 3            # failures before circuit opens (default)
    openDurationMs: 60000          # circuit breaker duration (default)
```

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| Minimal sessions | Use Raw — zero overhead, no-op |
| Default/fallback | Use Raw — active by default |
| Multi-agent orchestration | Use OMC — 9 specialized agents |
| Model routing | Use OMC — LOW/MEDIUM/HIGH tier routing |
| CLAUDE.md enhancement | Use OMC — generates OMC conventions |
| Provider failure recovery | System falls back to Raw automatically |

---

## Next Steps

- [Raw](./raw/) — No-op default provider
- [OMC](./omc/) — oh-my-claudecode session enhancement
- [Plugins](../) — Plugin comparison and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
