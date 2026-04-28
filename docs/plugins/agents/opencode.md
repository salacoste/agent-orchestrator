---
title: OpenCode
nav_order: 5
parent: Agent Plugins
grand_parent: Plugins
description: opencode agent plugin — lightweight agent with SQLite storage. Activity detection and session info return null due to shared global database without per-workspace scoping.
---

# OpenCode Agent

The **opencode** plugin integrates OpenCode with Agent Orchestrator. It is a lightweight agent plugin (151 lines) that launches OpenCode and tracks process liveness. Activity detection and session info return `null` because OpenCode stores all session data in a single global SQLite database without per-workspace scoping, making per-session activity detection unreliable when multiple sessions run in parallel.

{: .highlight }
> **Minimal integration:** opencode provides launch, environment, and process detection only. Activity state returns `null` (unknown) when the process is running, and session info is not available. This is a known limitation of OpenCode's shared database architecture.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `opencode` |
| **Slot** | `agent` |
| **Package** | `@composio/ao-plugin-agent-opencode` |
| **Version** | `0.1.0` |
| **Default** | No |

---

## How It Works

The opencode plugin launches OpenCode with the `run` subcommand and model flags. Process liveness is tracked via tmux TTY detection or PID-based checks. Activity detection and session info return `null` due to the shared database limitation.

```text
create()
  |
  +-- Build launch command
  |     +-- opencode run "prompt" --model {model}
  |
  +-- Set environment vars
  |     +-- AO_SESSION_ID, AO_ISSUE_ID
  |
  +-- Monitor via process liveness only
        +-- Process alive? → null (unknown)
        +-- Process exited? → exited
```

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"opencode"` |
| `processName` | `"opencode"` |
| `promptDelivery` | `"inline"` (implicit — no property set) |

### getLaunchCommand(config)

Builds the shell command to launch OpenCode:

```bash
opencode run "Build the feature" --model claude-sonnet-4-20250514
```

- `run`: Subcommand that executes a single prompt
- `--model`: Model override from config

### getEnvironment(config)

Sets environment variables:

| Variable | Purpose |
|----------|---------|
| `AO_SESSION_ID` | Link to orchestrator session |
| `AO_ISSUE_ID` | GitHub issue or story ID |

### getActivityState(session, readyThresholdMs?)

Returns `null` when the process is running, or `{ state: "exited" }` when the process has exited.

{: .highlight }
> **Shared database limitation:** OpenCode stores all session data in a single global SQLite database at `~/.local/share/opencode/opencode.db` without per-workspace scoping. When multiple OpenCode sessions run in parallel, database modifications from any session would cause all sessions to appear active. The plugin returns `null` (unknown) rather than guessing.

### getSessionInfo(session)

Returns `null`. OpenCode does not produce JSONL session files or other machine-readable output suitable for session introspection.

### isProcessRunning(handle)

Uses tmux TTY detection + `ps -eo pid,tty,args` to find the `opencode` process. For non-tmux runtimes, checks process liveness via `kill(pid, 0)`.

---

## Limitations

| Feature | Status |
|---------|--------|
| Activity detection | No — returns `null` (shared database) |
| Session info | No — returns `null` |
| Cost tracking | No — no token data available |
| Session restore | No — no `getRestoreCommand` method |
| Workspace hooks | No — no `setupWorkspaceHooks` method |

---

## Configuration

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    agent: opencode
    agentConfig:
      model: claude-sonnet-4-20250514
```

---

## When to Use OpenCode

| Scenario | Recommendation |
|----------|---------------|
| Prefer minimal agent | Use opencode — lightweight integration |
| Need activity detection | Use claude-code, codex, or aider instead |
| Need cost tracking | Use claude-code or codex instead |
| OpenCode is your primary tool | Use opencode — native integration |
| Production deployment | Use claude-code — most mature integration |

---

## Next Steps

- [Claude Code](../claude-code/) — Full-featured default agent
- [Aider](../aider/) — Lightweight agent with git-based detection
- [Agent Plugins](./) — Agent plugin comparison and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
