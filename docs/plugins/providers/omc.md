---
title: OMC
nav_order: 1
parent: Provider Plugins
grand_parent: Plugins
description: OMC provider plugin — oh-my-claudecode filesystem-based session enhancement with 9 specialized agents, model tier routing, JSONC configuration, and CLAUDE.md additions.
---

# OMC Provider

The **omc** (oh-my-claudecode) plugin enhances agent sessions by installing the OMC multi-agent orchestration layer into workspace directories. It creates the `.omc/` directory structure, generates agent model configurations, writes CLAUDE.md additions, and enriches session metadata with agent routing information.

{: .highlight }
> **Error-resilient:** The `enhance` method catches all errors and returns the session unchanged. The `teardown` method silently swallows missing-directory errors. OMC never crashes your session — if anything fails, you get the raw session.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `omc` |
| **Slot** | `provider` |
| **Package** | `@composio/ao-plugin-provider-omc` |
| **Version** | `0.1.0` |
| **Default** | No (raw is default) |

---

## How It Works

The OMC plugin uses filesystem operations to set up session enhancement:

```text
install(worktreePath, config)
  |
  +-- mkdir .omc/state/  (recursive)
  +-- mkdir .omc/plans/
  +-- mkdir .omc/logs/
  +-- writeFile .omc/project-memory.json ("{}")

configure(worktreePath, context)
  |
  +-- Build JSONC config (agents + modelTiers)
  +-- writeFile .claude/omc.jsonc
  +-- createNotepad(worktreePath, context)
  +-- Generate CLAUDE.md additions
  +-- writeFile .omc/provider-claude-md.md

enhance(session)
  |
  +-- Shallow-clone session.metadata
  +-- Set omc:agents, omc:executionMode, omc:configured
  +-- Return enhanced session

teardown(worktreePath)
  |
  +-- rm .omc/ (recursive)
```

---

## Transport

- Uses Node.js `fs/promises` for all filesystem operations
- **No network transport** — purely local filesystem
- Directories created with `{ recursive: true }` for idempotent operation
- `project-memory.json` overwritten every time (idempotent install)

---

## Default Agent Models

OMC ships with 9 built-in agent names (the names are fixed — only their model assignments are configurable):

| Agent | Model | Use Case |
|-------|-------|----------|
| `omc` | `claude-opus-4-6` | Orchestration coordinator |
| `explore` | `claude-haiku-4-5` | Fast codebase exploration |
| `analyst` | `claude-opus-4-6` | Deep analysis |
| `planner` | `claude-opus-4-6` | Architecture planning |
| `architect` | `claude-opus-4-6` | System design |
| `debugger` | `claude-sonnet-4-6` | Debugging and tracing |
| `executor` | `claude-sonnet-4-6` | Code implementation |
| `verifier` | `claude-sonnet-4-6` | Verification and testing |
| `tracer` | `claude-sonnet-4-6` | Code tracing and analysis |

**Model families:** Opus (4 agents), Sonnet (4 agents), Haiku (1 agent)

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"omc"` |

### Required Methods (5)

#### install(worktreePath, config)

Installs the OMC directory structure into the workspace:

- Creates `.omc/state/`, `.omc/plans/`, `.omc/logs/` directories (recursive)
- Writes `.omc/project-memory.json` with initial empty object (`"{}"`)
- Can throw on filesystem errors (not wrapped in try/catch)

#### configure(worktreePath, context)

Configures OMC for a specific story context:

- Builds JSONC configuration file (`.claude/omc.jsonc`) with:
  - Agent model assignments (9 agents)
  - Model routing configuration (LOW/MEDIUM/HIGH tiers)
  - Inline comments for readability
- Delegates notepad creation to `createNotepad()` from `@composio/ao-core`
- Generates CLAUDE.md additions to `.omc/provider-claude-md.md` with agent catalog and delegation instructions
- Can throw on filesystem errors

#### enhance(session)

Enriches session metadata with OMC configuration:

- **Shallow-clones** metadata: `{ ...session.metadata }` (avoids mutating input)
- Sets three metadata keys:
  - `"omc:agents"` — JSON stringified array of enabled agent names
  - `"omc:executionMode"` — `"standard"`
  - `"omc:configured"` — `"true"`
- **Error-resilient**: On any error, returns original session unchanged

#### teardown(worktreePath)

Removes OMC from the workspace:

- Deletes `.omc/` directory recursively
- Silently swallows errors (missing directory is not an error)

#### healthCheck()

Always returns `{ healthy: true, lastCheck: new Date() }`. Never fails.

---

## Configuration

### Basic Setup

```yaml
sessionEnhancement:
  provider: omc
```

### With Custom Agent Models

```yaml
sessionEnhancement:
  provider: omc
  config:
    agents:
      omc:
        model: claude-opus-4-6
      explore:
        model: claude-haiku-4-5
      executor:
        model: claude-sonnet-4-6
    modelTiers:
      low: haiku
      medium: sonnet
      high: opus
```

### Configuration Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `provider` | string | Yes | `"raw"` | Must be `"omc"` |
| `config.agents` | object | No | 9 default agents | Agent name → `{ model: string }` nested object mapping |
| `config.modelTiers` | object | No | `{low:"haiku",medium:"sonnet",high:"opus"}` | Complexity tier → model mapping |

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| Multi-agent orchestration | Use OMC — 9 specialized agents |
| Model cost optimization | Use OMC — LOW/MEDIUM/HIGH tier routing |
| CLAUDE.md enhancement | Use OMC — generates agent catalog and conventions |
| Minimal sessions | Use Raw — OMC adds filesystem overhead |
| Need error resilience | Use OMC — enhance never crashes |

---

## Next Steps

- [Raw](../raw/) — No-op default provider
- [Provider Plugins](./) — Provider plugin comparison
- [Plugins](../../) — Plugin comparison and configuration
- [Configuration](../../../../getting-started/configuration/) — Full config reference
