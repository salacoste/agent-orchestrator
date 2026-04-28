---
title: Runtime Plugins
nav_order: 1
parent: Plugins
has_children: true
description: Runtime plugin slot with 2 built-in plugins — tmux (persistent sessions) and process (child processes). Comparison table, configuration, and selection guide.
---

# Runtime Plugins

The runtime plugin manages the execution environment for agent sessions. It creates isolated environments, sends commands to agents, captures output, and manages session lifecycle. Agent Orchestrator ships with 2 runtime plugins: **tmux** (default) for persistent sessions and **process** for lightweight child process management.

{: .highlight }
> **TL;DR:** 2 plugins — tmux (default, sessions survive disconnects) and process (lightweight, tied to parent process). Both implement the 9-method `Runtime` interface. Choose tmux for SSH/production, process for CI/containers.

---

## Runtime Interface

All runtime plugins implement the `Runtime` interface from `@composio/ao-core`. The interface defines **9 methods** (5 required + 4 optional):

| Method | Required | Description |
|--------|----------|-------------|
| `create(config)` | Yes | Create a new session, return `RuntimeHandle` |
| `destroy(handle)` | Yes | Destroy a session |
| `sendMessage(handle, message)` | Yes | Send text to the running agent |
| `getOutput(handle, lines?)` | Yes | Capture recent output (default 50 lines) |
| `isAlive(handle)` | Yes | Check if session is still alive |
| `getMetrics?(handle)` | No | Get resource metrics (uptime, memory) |
| `getAttachInfo?(handle)` | No | Get info needed to attach a terminal |
| `getExitCode?(handle)` | No | Get exit code (`null` if alive, `undefined` if unknown) |
| `getSignal?(handle)` | No | Get termination signal (`null` if alive, `undefined` if unknown) |

### RuntimeCreateConfig

The `create()` method receives a config with **4 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Unique session identifier (must match `^[a-zA-Z0-9_-]+$`) |
| `workspacePath` | string | Working directory for the session |
| `launchCommand` | string | Command to start the agent |
| `environment` | Record<string, string> | Environment variables to inject |

---

## Plugin Comparison

| Feature | tmux | process |
|---------|------|---------|
| **Persistence** | Sessions survive disconnects | Tied to parent process lifecycle |
| **Best for** | SSH, production, long-running agents | CI, containers, local development |
| **Prerequisites** | tmux binary (`brew install tmux`) | None (Node.js built-in) |
| **Session attach** | `tmux attach -t <name>` | PID reference only |
| **Output capture** | tmux `capture-pane` (live) | Rolling buffer (1000 lines) |
| **Exit codes** | `undefined` (tmux limitation) | Actual `child.exitCode` (must query before cleanup) |
| **Default** | Yes | No |
| **Package** | `@composio/ao-plugin-runtime-tmux` | `@composio/ao-plugin-runtime-process` |

---

## Child Pages

- [tmux](tmux/) — Persistent tmux session management (default)
- [process](process/) — Child process management

---

## Configuration

```yaml
# Global default
defaults:
  runtime: tmux

# Per-project override
projects:
  my-ci-app:
    repo: org/my-ci-app
    path: ~/projects/my-ci-app
    runtime: process
```

See [Plugins](../) for the full plugin configuration reference.
