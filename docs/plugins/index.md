---
title: Plugins
nav_order: 4
has_children: true
description: Plugin architecture with 8 swappable slots, 24 built-in plugins, PluginModule pattern, discovery and loading, config inheritance, and plugin selection guide.
---

# Plugins

Agent Orchestrator uses a plugin architecture with 8 swappable slots. Every core abstraction — runtime, agent, workspace, tracker, SCM, notifier, terminal, and provider — is implemented as a plugin that can be swapped or extended. There are 24 built-in plugins, and you can create custom plugins by implementing a typed interface.

{: .highlight }
> **TL;DR:** 8 plugin slots, 24 built-in plugins (20 auto-loaded), `PluginModule<T>` pattern with `satisfies` for compile-time safety, config inheritance (global → project → auto-inferred), plugin selection guide per slot.

---

## Plugin Architecture

The system defines 8 plugin slots via the `PluginSlot` type (`"runtime" | "agent" | "workspace" | "tracker" | "scm" | "notifier" | "terminal" | "provider"`). Each slot corresponds to a TypeScript interface that plugins must implement.

```text
+-------------------+   +------------------+
| Orchestrator Core |   | Plugin Registry  |
|                   |   |                  |
| Calls slot APIs  +--->| register()       |
| without knowing  |   | get()            |
| implementation   |   | loadBuiltins()   |
+-------------------+   +------------------+
                              |
                   +----------+----------+
                   |          |          |
                Runtime    Agent    Workspace
                (tmux)   (claude)  (worktree)
                   |          |          |
                 ...        ...        ...
```

A planned future slot — `EventBus` — exists as an interface in `types.ts` but is not yet part of the `PluginSlot` union.

{: .highlight }
> **EventBus is planned:** The `EventBus` interface exists in `types.ts` with 7 methods (6 required + 1 optional: `publish`, `subscribe`, `isConnected`, `isDegraded`, `getQueueSize`, `close`, `ping?`) plus a readonly `name` property, but it is not included in `PluginSlot` and not in `DefaultPlugins`. It will be added in a future release.

---

## PluginModule Pattern

Every plugin follows the same export pattern using `PluginModule<T>` for compile-time type safety.

### PluginManifest (4 fields)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Plugin identifier (e.g., `"tmux"`, `"claude-code"`) |
| `slot` | PluginSlot | Target slot (e.g., `"runtime"`, `"agent"`) |
| `description` | string | Human-readable summary |
| `version` | string | Semantic version (e.g., `"0.1.0"`) |

### PluginModule (4 fields)

| Field | Type | Description |
|-------|------|-------------|
| `manifest` | PluginManifest | Plugin metadata |
| `create` | `(config?: Record<string, unknown>) => T` | Factory function returning the interface implementation |
| `init?` | `() => Promise<void> \| void` | Optional lifecycle hook — called after registration |
| `shutdown?` | `() => Promise<void> \| void` | Optional lifecycle hook — called on teardown |

### Export Pattern

```typescript
import type { PluginModule, Runtime } from "@composio/ao-core";

export const manifest = {
  name: "tmux",
  slot: "runtime" as const,
  description: "Runtime plugin: tmux sessions",
  version: "0.1.0",
};

export function create(): Runtime {
  return {
    name: "tmux",
    async create(config) { /* ... */ },
    async destroy(handle) { /* ... */ },
    // ... implement Runtime interface methods
  };
}

export default { manifest, create } satisfies PluginModule<Runtime>;
```

{: .highlight }
> **`satisfies` is required:** Always use `satisfies PluginModule<T>` on the default export. This provides compile-time type checking without widening the inferred type. Do NOT use `const plugin = { ... }; export default plugin;`.

---

## Plugin Slots

Each slot has a TypeScript interface defining the contract for plugins.

| Slot | Interface | Key Methods | Default Plugin |
|------|-----------|-------------|---------------|
| `runtime` | `Runtime` | `create`, `destroy`, `sendMessage`, `getOutput`, `isAlive` | tmux |
| `agent` | `Agent` | `getLaunchCommand`, `getEnvironment`, `getActivityState`, `isProcessRunning`, `getSessionInfo` | claude-code |
| `workspace` | `Workspace` | `create`, `destroy`, `list` | worktree |
| `tracker` | `Tracker` | `getIssue`, `isCompleted`, `issueUrl`, `branchName`, `generatePrompt` | github |
| `scm` | `SCM` | `detectPR`, `getPRState`, `mergePR`, `getCIChecks`, `getReviews` | github |
| `notifier` | `Notifier` | `notify`, `notifyWithActions?`, `post?` | composio, desktop |
| `terminal` | `Terminal` | `openSession`, `openAll` | iterm2 |
| `provider` | `SessionEnhancementProvider` | `install`, `configure`, `enhance`, `teardown`, `healthCheck` | raw |

{: .highlight }
> **Notifiers is an array:** Unlike other slots that accept a single plugin, the `notifiers` field in `DefaultPlugins` takes a `string[]` — multiple notifiers can be active simultaneously.

See child pages for detailed documentation of each slot:

- [Runtime Plugins](runtime/) — tmux, process
- [Agent Plugins](agents/) — claude-code, glm, codex, aider, opencode
- [Workspace Plugins](workspace/) — worktree, clone
- [Tracker Plugins](trackers/) — github, linear, bmad
- [SCM Plugins](scm/) — github
- [Notifier Plugins](notifiers/) — composio, desktop, slack, webhook, telegram, discord
- [Terminal Plugins](terminals/) — iterm2, web
- [Provider Plugins](providers/) — raw, omc

---

## Built-in Plugins

Agent Orchestrator ships with **24 built-in plugins** across all 8 slots. The `BUILTIN_PLUGINS` array in `plugin-registry.ts` auto-loads **20** of these; the remaining 4 are available for manual configuration.

### Auto-loaded (20 plugins)

| Slot | Name | Package | Description |
|------|------|---------|-------------|
| runtime | tmux | `@composio/ao-plugin-runtime-tmux` | tmux session management (default) |
| runtime | process | `@composio/ao-plugin-runtime-process` | Child process management |
| agent | claude-code | `@composio/ao-plugin-agent-claude-code` | Claude Code CLI agent (default) |
| agent | glm | `@composio/ao-plugin-agent-glm` | Z.ai GLM agent |
| agent | codex | `@composio/ao-plugin-agent-codex` | OpenAI Codex agent |
| agent | aider | `@composio/ao-plugin-agent-aider` | Aider AI pair programming |
| workspace | worktree | `@composio/ao-plugin-workspace-worktree` | Git worktree isolation (default) |
| workspace | clone | `@composio/ao-plugin-workspace-clone` | Git clone-based isolation |
| tracker | github | `@composio/ao-plugin-tracker-github` | GitHub Issues tracker (default) |
| tracker | linear | `@composio/ao-plugin-tracker-linear` | Linear issue tracker |
| tracker | bmad | `@composio/ao-plugin-tracker-bmad` | BMad file-based tracker |
| scm | github | `@composio/ao-plugin-scm-github` | GitHub PR/CI/review (default) |
| notifier | composio | `@composio/ao-plugin-notifier-composio` | Composio unified notifications (default) |
| notifier | desktop | `@composio/ao-plugin-notifier-desktop` | OS desktop notifications (default) |
| notifier | slack | `@composio/ao-plugin-notifier-slack` | Slack webhook notifications |
| notifier | webhook | `@composio/ao-plugin-notifier-webhook` | Generic HTTP webhook |
| terminal | iterm2 | `@composio/ao-plugin-terminal-iterm2` | macOS iTerm2 tab management |
| terminal | web | `@composio/ao-plugin-terminal-web` | xterm.js web terminal |
| provider | raw | `@composio/ao-plugin-provider-raw` | No-op raw provider (default) |
| provider | omc | `@composio/ao-plugin-provider-omc` | OMC context provider |

### Available but Not Auto-loaded (4 plugins)

| Slot | Name | Package | Description |
|------|------|---------|-------------|
| agent | opencode | `@composio/ao-plugin-agent-opencode` | OpenCode agent |
| notifier | telegram | `@composio/ao-plugin-notifier-telegram` | Telegram bot via grammY |
| notifier | discord | `@composio/ao-plugin-notifier-discord` | Discord webhook notifications |
| event-bus | redis-event-bus | `@composio/ao-plugin-event-bus-redis` | Redis pub/sub event bus |

These plugins exist as packages in `packages/plugins/` but are not listed in the `BUILTIN_PLUGINS` array. To use them, specify them explicitly in your configuration.

{: .highlight }
> **`event-bus-redis` targets a planned slot:** This plugin implements the `EventBus` interface, which is not yet part of the `PluginSlot` union. It cannot be loaded through the standard registry until the `EventBus` slot is formally added.

---

## Discovery and Loading

The `PluginRegistry` manages plugin lifecycle: discovery, validation, registration, and initialization.

{: .highlight }
> **Advanced loading:** Beyond the built-in array, the codebase includes a `PluginLoader` system (`plugin-loader.ts`) for YAML manifest-based discovery, and a `PluginInstaller` for marketplace integration. See [Custom Plugin Development](../advanced/custom-plugins/) for details.

### Loading Flow

```text
loadBuiltins()
  |
  +-- BUILTIN_PLUGINS array (20 entries)
  |     +-- Dynamic import of each package
  |     +-- Validate manifest (name, slot, version)
  |     +-- Register with createPluginRegistry()
  |
  +-- loadFromConfig()
  |     +-- Read config for plugin overrides
  |     +-- Dynamic import of specified packages
  |     +-- Validate and register
  |
  +-- Init phase
        +-- Call init?() lifecycle hook
        +-- Plugin is ready for use
```

### PluginRegistry Interface (10 methods)

| Method | Description |
|--------|-------------|
| `register(plugin, config?)` | Register a plugin module with optional config |
| `get<T>(slot, name)` | Retrieve a registered plugin by slot and name |
| `list(slot)` | List all registered plugins for a slot |
| `loadBuiltins(config?, importFn?)` | Auto-load all 20 built-in plugins (async) |
| `loadFromConfig(config, importFn?)` | Load built-ins with config context, then config-specified plugins (async) |
| `shutdown(slot, name)` | Gracefully shut down a specific plugin; returns `boolean` indicating success (async) |
| `shutdownAll()` | Shut down all registered plugins (async) |
| `reload(slot, name, importFn?)` | Hot-reload a plugin at runtime (async) |
| `getPluginState(slot, name)` | Get runtime state for a registered plugin |
| `isRegistered(slot, name)` | Check if a plugin is registered |

### Hot Reload

The `reload()` method supports hot-reloading plugins at runtime without restarting the orchestrator. It calls `shutdown()` on the existing instance, re-imports the module, validates the manifest, and calls `init()` on the new instance.

{: .highlight }
> **Hot reload uses cache invalidation:** The reload mechanism clears the module cache to re-import the plugin. This relies on CommonJS-style cache clearing, which may not work for pure ESM modules.

{: .highlight }
> **Silent failures on load:** If a built-in plugin's package fails to import (missing dependency, invalid module), `loadBuiltins()` silently skips it. Use `list(slot)` or `isRegistered(slot, name)` to verify which plugins loaded successfully.

---

## Default Configuration

### DefaultPlugins (4 fields)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `runtime` | string | `"tmux"` | Session runtime |
| `agent` | string | `"claude-code"` | AI coding agent |
| `workspace` | string | `"worktree"` | Workspace isolation strategy |
| `notifiers` | string[] | `["composio", "desktop"]` | Notification channels |

{: .highlight }
> **Not all slots have defaults entries:** `tracker`, `scm`, `terminal`, and `provider` are not in `DefaultPlugins`. Tracker and SCM are auto-inferred from the `repo` field. Terminal and provider defaults come from the plugin loading order and Zod schema defaults respectively.

### Per-Project Overrides

Each project can override plugin selections via `agent-orchestrator.yaml`:

| Field | Description |
|-------|-------------|
| `runtime` | Override the runtime plugin |
| `agent` | Override the agent plugin |
| `workspace` | Override the workspace plugin |
| `tracker` | Override the tracker plugin (object: `{ plugin: name }`) |
| `scm` | Override the SCM plugin (object: `{ plugin: name }`) |
| `sessionEnhancement` | Override session enhancement provider per-project |

### Auto-Inference

The `applyProjectDefaults()` function automatically sets:

- **tracker** → `"github"` (always, if not explicitly set)
- **scm** → `"github"` (when `repo` field contains a `"/"`)

Additionally, the **provider** slot defaults to `"raw"` via the `sessionEnhancement.provider` Zod schema default (not through `applyProjectDefaults`).

This means projects with a `repo` field get GitHub tracker and SCM plugins automatically — no manual configuration needed.

---

## Configuration

### Global Defaults

```yaml
# agent-orchestrator.yaml
defaults:
  runtime: tmux
  agent: claude-code
  workspace: worktree
  notifiers:
    - composio
    - desktop
```

### Per-Project Overrides

```yaml
projects:
  my-app:
    repo: org/repo
    path: ~/projects/my-app
    runtime: process
    agent: codex
    workspace: clone
  other-app:
    repo: org/other
    path: ~/projects/other-app
    agent: aider
    tracker:
      plugin: linear
      teamId: "your-team-id"
    scm:
      plugin: github
```

### Notifier Channels

```yaml
# Top-level notifier channel configuration
notifiers:
  slack:
    plugin: slack
    webhook: ${SLACK_WEBHOOK_URL}
    channel: "#agent-updates"
  telegram:
    plugin: telegram
    botToken: ${TELEGRAM_BOT_TOKEN}
    defaultChatId: ${TELEGRAM_CHAT_ID}
```

### Notification Routing

```yaml
notificationRouting:
  urgent: [desktop, slack]
  action: [desktop, slack]
  warning: [slack]
  info: [slack]
```

See [Configuration](../getting-started/configuration/) for the full config reference.

---

## Plugin Selection Guide

Choose the right plugin for your use case:

### Runtime

| Plugin | Best For | Notes |
|--------|----------|-------|
| **tmux** | Persistent sessions, SSH, production | Default. Sessions survive disconnect. |
| **process** | Local development, CI, containers | Lightweight. Sessions tied to process. |

### Agent

| Plugin | Best For | Notes |
|--------|----------|-------|
| **claude-code** | General development (default) | Full Claude capabilities. |
| **glm** | Z.ai GLM integration | Alternative AI provider. |
| **codex** | OpenAI Codex integration | OpenAI-based coding. |
| **aider** | Pair programming workflow | Terminal-driven AI pair programming. |
| **opencode** | OpenCode integration | Available but not auto-loaded. |

### Workspace

| Plugin | Best For | Notes |
|--------|----------|-------|
| **worktree** | Git-based isolation (default) | Fast, space-efficient. Shared `.git`. |
| **clone** | Full copy isolation | Complete independence. More disk usage. |

### Tracker

| Plugin | Best For | Notes |
|--------|----------|-------|
| **github** | GitHub Issues (default) | Auto-inferred from `repo` field. |
| **linear** | Linear issue tracking | Requires Linear API key. |
| **bmad** | File-based tracking | Local markdown files. No API needed. |

### SCM

| Plugin | Best For | Notes |
|--------|----------|-------|
| **github** | GitHub PR/CI/review (default) | Auto-inferred from `repo` field. |

### Notifier

| Plugin | Best For | Notes |
|--------|----------|-------|
| **composio** | Unified notifications (default) | Multi-channel via Composio. |
| **desktop** | Local development (default) | macOS/Linux desktop alerts. |
| **slack** | Team notifications | Via Slack webhooks. |
| **webhook** | Custom integrations | Generic HTTP POST. |
| **telegram** | Mobile notifications | Available but not auto-loaded. |
| **discord** | Team chat notifications | Available but not auto-loaded. |

### Terminal

| Plugin | Best For | Notes |
|--------|----------|-------|
| **iterm2** | macOS development (default) | iTerm2 tab management. |
| **web** | Browser-based terminal | xterm.js. For web dashboard. |

### Provider

| Plugin | Best For | Notes |
|--------|----------|-------|
| **raw** | No-op passthrough (default) | No session enhancement. |
| **omc** | OMC context provider | Adds context and configuration. |

---

## Next Steps

- **[Architecture](../getting-started/architecture/)** — system design and data flow
- **[Configuration](../getting-started/configuration/)** — full config reference
- **[Custom Plugin Development](../advanced/custom-plugins/)** — building your own plugins
