---
title: Raw
nav_order: 2
parent: Provider Plugins
grand_parent: Plugins
description: Raw provider plugin — no-op default fallback. Zero overhead, all 5 methods are pass-through. Used when no session enhancement is needed.
---

# Raw Provider

The **raw** plugin is the default provider. It implements the `SessionEnhancementProvider` interface as a complete no-op — every method either does nothing or returns the input unchanged. On provider failure, the system automatically falls back to Raw.

{: .highlight }
> **Default fallback:** Raw is the default provider (`provider: raw` in config). It is also used as the automatic fallback when another provider fails its health check. Zero overhead, zero risk.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `raw` |
| **Slot** | `provider` |
| **Package** | `@composio/ao-plugin-provider-raw` |
| **Version** | `0.1.0` |
| **Default** | Yes (default provider) |

---

## How It Works

The raw plugin takes no config and performs no operations:

```text
create()
  |
  +-- Return object with 5 no-op methods

install(worktreePath, config)
  |  No-op

configure(worktreePath, context)
  |  No-op

enhance(session)
  |  Return session (unchanged reference)

teardown(worktreePath)
  |  No-op

healthCheck()
  |  Return { healthy: true, lastCheck: now }
```

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"raw"` |

### Required Methods (5)

#### install(worktreePath, config)

No-op. Parameters are ignored (prefixed with `_`).

#### configure(worktreePath, context)

No-op. Parameters are ignored.

#### enhance(session)

Returns the exact same session reference without any cloning or modification:

- No metadata added
- No session mutation
- Cannot fail

#### teardown(worktreePath)

No-op. Parameter is ignored.

#### healthCheck()

Always returns `{ healthy: true, lastCheck: new Date() }`. Cannot fail.

---

## Configuration

No configuration needed. The raw provider takes no config parameter and has no configurable behavior.

```yaml
sessionEnhancement:
  provider: raw  # explicit (same as default)
```

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| Minimal sessions | Use Raw — zero overhead |
| Default/fallback | Use Raw — active by default |
| Provider failure recovery | System auto-falls back to Raw |
| Multi-agent orchestration | Use OMC — Raw has no enhancement |
| Model routing needed | Use OMC — Raw has no routing |

---

## Next Steps

- [OMC](../omc/) — oh-my-claudecode session enhancement provider
- [Provider Plugins](./) — Provider plugin comparison
- [Plugins](../../) — Plugin comparison and configuration
- [Configuration](../../../../getting-started/configuration/) — Full config reference
