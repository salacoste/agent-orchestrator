---
title: Aider
nav_order: 3
parent: Agent Plugins
grand_parent: Plugins
description: aider agent plugin — lightweight AI pair programmer with git-based activity detection and chat history mtime monitoring. No cost tracking or session resume.
---

# Aider Agent

The **aider** plugin integrates Aider (AI pair programmer) with Agent Orchestrator. It is the most lightweight agent plugin at 216 lines, using git commit timestamps and chat history file mtime for activity detection. It does not provide cost tracking or session resume.

{: .highlight }
> **Inline delivery:** aider uses `promptDelivery: "inline"` — the prompt is passed via `--message` in the launch command. Aider processes it and then waits for further input.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `aider` |
| **Slot** | `agent` |
| **Package** | `@composio/ao-plugin-agent-aider` |
| **Version** | `0.1.0` |
| **Default** | No |

---

## How It Works

The aider plugin launches Aider with permission and model flags, then monitors activity by checking for recent git commits (Aider auto-commits changes) and the `.aider.chat.history.md` file modification time.

```text
create()
  |
  +-- Build launch command
  |     +-- aider --yes --model {model}
  |     +-- --system-prompt "$(cat {file})"
  |     +-- --message "prompt"
  |
  +-- Set environment vars
  |     +-- AO_SESSION_ID, AO_ISSUE_ID
  |
  +-- Monitor via git + chat history
        +-- Recent commits? → active
        +-- Chat mtime < 30s → active
        +-- Chat mtime < threshold → ready
        +-- Chat mtime > threshold → idle
```

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"aider"` |
| `processName` | `"aider"` |
| `promptDelivery` | `"inline"` (implicit — no property set) |

### getLaunchCommand(config)

Builds the shell command to launch Aider:

```bash
aider --yes --model gpt-4o --system-prompt "$(cat /tmp/system-prompt.txt)" --message "Build the feature"
```

- `--yes`: Auto-approve all actions (when `permissions: "skip"`)
- `--model`: Model override from config
- `--system-prompt`: System prompt (uses `$(cat file)` for long prompts, inline string for short ones)
- `--message`: Initial prompt for the agent

### getEnvironment(config)

Sets environment variables:

| Variable | Purpose |
|----------|---------|
| `AO_SESSION_ID` | Link to orchestrator session |
| `AO_ISSUE_ID` | GitHub issue or story ID |

### getActivityState(session, readyThresholdMs?)

Uses two signals for activity detection, checked in order:

**1. Recent git commits** — Checks `git log --since="60 seconds ago"` in the workspace. If Aider made commits within the last 60 seconds, the state is `active`.

**2. Chat history mtime** — Checks the modification time of `.aider.chat.history.md` in the workspace:

| Condition | State |
|-----------|-------|
| No chat history file | `null` (unknown) |
| mtime < 30 seconds | `active` |
| mtime < threshold | `ready` |
| mtime > threshold | `idle` |

The active window is capped at 30 seconds (`min(30_000, threshold)`).

{: .highlight }
> **Aider auto-commits:** Aider automatically commits file changes with descriptive messages. The plugin uses this behavior as a reliable activity signal — if there are commits within the last 60 seconds, Aider is actively working.

### getSessionInfo(session)

Returns `null`. Aider does not produce JSONL session files or other machine-readable output suitable for session introspection.

{: .highlight }
> **No session info:** The dashboard will show no summary, cost, or session ID for Aider agents. This is a known limitation.

### isProcessRunning(handle)

Uses tmux TTY detection + `ps -eo pid,tty,args` to find the `aider` process. For non-tmux runtimes, checks process liveness via `kill(pid, 0)`.

---

## Limitations

| Feature | Status |
|---------|--------|
| Activity detection | Yes (git commits + chat history mtime) |
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
    agent: aider
    agentConfig:
      model: gpt-4o
```

---

## When to Use Aider

| Scenario | Recommendation |
|----------|---------------|
| Prefer lightweight agent | Use aider — only 216 lines, minimal overhead |
| Need cost tracking | Use claude-code or codex instead |
| Need session resume | Use claude-code or codex instead |
| Aider is your primary tool | Use aider — native integration |
| Production deployment | Use claude-code — most mature integration |

---

## Next Steps

- [Claude Code](../claude-code/) — Full-featured default agent
- [Codex](../codex/) — OpenAI Codex CLI integration
- [Agent Plugins](./) — Agent plugin comparison and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
