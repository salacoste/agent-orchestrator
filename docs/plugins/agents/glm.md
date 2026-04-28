---
title: GLM
nav_order: 4
parent: Agent Plugins
grand_parent: Plugins
description: glm agent plugin — thin wrapper (26 lines) that reuses claude-code via createClaudeCompatibleAgent factory. Launches Z.ai GLM through yolo -api with post-launch prompt delivery.
---

# GLM Agent

The **glm** plugin is a thin wrapper (26 lines) that provides Z.ai GLM integration by reusing the claude-code plugin's `createClaudeCompatibleAgent` factory. It inherits all claude-code capabilities — JSONL session parsing, PostToolUse hooks, cost tracking, and session resume — while launching via the `yolo` binary instead of `claude`.

{: .highlight }
> **Factory-based:** The glm plugin delegates entirely to `createClaudeCompatibleAgent()` from `@composio/ao-plugin-agent-claude-code`. It overrides only the launch command (`yolo -api`) and process name (`yolo`). All other behavior (activity detection, session info, hooks) is inherited from claude-code.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `glm` |
| **Slot** | `agent` |
| **Package** | `@composio/ao-plugin-agent-glm` |
| **Version** | `0.1.0` |
| **Default** | No |

---

## How It Works

The glm plugin calls `createClaudeCompatibleAgent()` with options that override the default command and process name. The factory returns a full claude-code agent instance with these substitutions:

```text
createClaudeCompatibleAgent({
    name: "glm",
    defaultCommand: "yolo -api",
    defaultProcessName: "yolo",
  })
  |
  +-- getLaunchCommand()
  |     +-- yolo -api --dangerously-skip-permissions
  |     +-- --model {model}
  |     +-- --append-system-prompt "$(cat {file})"
  |
  +-- getEnvironment()
  |     +-- CLAUDECODE="" (suppress UI)
  |     +-- AO_SESSION_ID, AO_ISSUE_ID
  |     +-- YOLO_HEADLESS=1
  |
  +-- All other methods inherited from claude-code
        +-- getActivityState() — JSONL entry type classification
        +-- getSessionInfo() — JSONL tail parsing + cost
        +-- postLaunchSetup() — PostToolUse hooks
        +-- getRestoreCommand() --resume support
```

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"glm"` |
| `processName` | `"yolo"` |
| `promptDelivery` | `"post-launch"` |

### getLaunchCommand(config)

Builds the shell command to launch GLM via yolo:

```bash
yolo -api --dangerously-skip-permissions --model glm-4 --append-system-prompt "$(cat /tmp/system-prompt.txt)"
```

All flags are identical to claude-code — only the base command changes from `claude` to `yolo -api`.

### Inherited Methods

The following methods are inherited from `createClaudeCompatibleAgent()` and behave identically to the [Claude Code](../claude-code/) plugin:

| Method | Behavior |
|--------|----------|
| `getEnvironment(config)` | Same as claude-code (CLAUDECODE, AO_SESSION_ID, AO_AGENT_PROCESS_NAME, YOLO_HEADLESS) |
| `detectActivity(output)` | Same as claude-code (prompt chars, approval patterns) |
| `getActivityState(session)` | Same as claude-code (JSONL entry type classification) |
| `getSessionInfo(session)` | Same as claude-code (JSONL tail parsing, cost tracking) |
| `isProcessRunning(handle)` | Same as claude-code (tmux TTY + ps detection) |
| `getRestoreCommand(session)` | Same as claude-code (`--resume` support) |
| `postLaunchSetup(session)` | Same as claude-code (PostToolUse hooks) |
| `setupWorkspaceHooks(path)` | Same as claude-code (metadata-updater.sh, settings.json) |

---

## Cost Tracking

Identical to claude-code — the plugin aggregates token usage from JSONL entries. Pricing defaults to Sonnet 4.5 rates ($3/M input, $15/M output) unless the JSONL file includes `costUSD`.

---

## Configuration

```yaml
projects:
  my-glm-app:
    repo: org/my-glm-app
    path: ~/projects/my-glm-app
    agent: glm
```

### Custom Binary

```yaml
projects:
  my-glm-app:
    repo: org/my-glm-app
    path: ~/projects/my-glm-app
    agent: glm
    agentConfig:
      command: /usr/local/bin/yolo  # custom binary path
```

---

## When to Use GLM

| Scenario | Recommendation |
|----------|---------------|
| Using Z.ai GLM models | Use glm — native yolo integration |
| Need all claude-code features | Use glm — inherits everything |
| Using Claude models | Use claude-code directly |
| Need cost tracking | Use glm — inherited from claude-code |
| Using OpenAI models | Use codex instead |

---

## Next Steps

- [Claude Code](../claude-code/) — The parent factory that glm builds on
- [Codex](../codex/) — OpenAI Codex CLI alternative
- [Agent Plugins](./) — Agent plugin comparison and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
