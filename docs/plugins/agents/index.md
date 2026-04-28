---
title: Agent Plugins
nav_order: 2
parent: Plugins
has_children: true
description: Agent plugin slot with 5 built-in plugins — claude-code (default), codex, aider, glm, opencode. Comparison table, configuration, and selection guide.
---

# Agent Plugins

The agent plugin manages how AI coding agents are launched, configured, and monitored. It builds the launch command, sets environment variables, detects agent activity, and extracts session information (summary, cost, session ID). Agent Orchestrator ships with **5 agent plugins**: **claude-code** (default) for Claude Code CLI, **codex** for OpenAI Codex, **aider** for Aider, **glm** for Z.ai GLM via yolo, and **opencode** for OpenCode.

{: .highlight }
> **TL;DR:** 5 plugins — claude-code (default, full-featured with JSONL parsing), codex (OpenAI, shell wrapper hooks), aider (lightweight, git-based detection), glm (thin wrapper around claude-code), opencode (lightweight, SQLite storage). Choose claude-code for production, codex for OpenAI shops, aider/opencode for simplicity.

---

## Agent Interface

All agent plugins implement the `Agent` interface from `@composio/ao-core`. The interface defines **2 required properties**, **1 optional property**, **6 required methods**, and **3 optional methods**:

### Properties

| Property | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Agent display name (e.g., `"claude-code"`) |
| `processName` | Yes | Process name for detection (e.g., `"claude"`, `"yolo"`) |
| `promptDelivery?` | No | `"inline"` (in launch command) or `"post-launch"` (via `runtime.sendMessage()`) |

### Methods

| Method | Required | Description |
|--------|----------|-------------|
| `getLaunchCommand(config)` | Yes | Build shell command to launch the agent |
| `getEnvironment(config)` | Yes | Get environment variables for the agent process |
| `detectActivity(output)` | Yes | Detect activity from terminal output (deprecated) |
| `getActivityState(session, threshold?)` | Yes | Get activity via agent-native mechanism (JSONL, git, etc.) |
| `isProcessRunning(handle)` | Yes | Check if agent process is running |
| `getSessionInfo(session)` | Yes | Extract summary, cost, session ID from agent data |
| `getRestoreCommand?(session, project)` | No | Build resume command for previous session |
| `postLaunchSetup?(session)` | No | Run setup after agent launch (e.g., configure hooks) |
| `setupWorkspaceHooks?(path, config)` | No | Set up hooks for automatic metadata updates |

### AgentLaunchConfig

The `getLaunchCommand()` and `getEnvironment()` methods receive a config with **8 fields**:

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Unique session identifier |
| `projectConfig` | object | Project configuration from YAML |
| `issueId?` | string | GitHub issue or story ID |
| `prompt?` | string | Initial prompt for the agent |
| `permissions?` | string | Permission mode (`"skip"` or `"default"`) |
| `model?` | string | Model override (e.g., `"sonnet-4"`) |
| `systemPrompt?` | string | Short system prompt |
| `systemPromptFile?` | string | Path to long system prompt file (avoids shell truncation) |

---

## Plugin Comparison

| Feature | claude-code | codex | aider | glm | opencode |
|---------|-------------|-------|-------|-----|----------|
| **Prompt delivery** | post-launch | inline | inline | post-launch | inline |
| **Activity detection** | JSONL entry type | JSONL file mtime | git commits + chat mtime | JSONL (inherited) | Returns null |
| **Session info** | JSONL tail parsing | JSONL streaming | Returns null | JSONL (inherited) | Returns null |
| **Cost tracking** | Yes (Sonnet 4.5 pricing) | Yes ($2.5M/$10M) | No | Yes (inherited) | No |
| **Session restore** | `claude --resume` | `codex resume` | No | Yes (inherited) | No |
| **Workspace hooks** | PostToolUse hook | Shell wrappers | No | Yes (inherited) | No |
| **Default** | Yes | No | No | No | No |
| **Complexity** | 901 lines | 822 + 505 lines (agent + app-server client) | 216 lines | 26 lines (wrapper) | 151 lines |
| **Package** | `@composio/ao-plugin-agent-claude-code` | `@composio/ao-plugin-agent-codex` | `@composio/ao-plugin-agent-aider` | `@composio/ao-plugin-agent-glm` | `@composio/ao-plugin-agent-opencode` |

---

## Child Pages

- [Claude Code](claude-code/) — Full-featured with JSONL parsing, hooks, cost tracking (default)
- [Codex](codex/) — OpenAI Codex CLI with shell wrapper hooks
- [Aider](aider/) — Lightweight AI pair programmer with git-based detection
- [GLM](glm/) — Z.ai GLM via yolo (inherits claude-code capabilities)
- [OpenCode](opencode/) — Lightweight agent with SQLite storage

---

## Configuration

```yaml
# Global default
defaults:
  agent: claude-code

# Per-project override
projects:
  my-openai-app:
    repo: org/my-openai-app
    path: ~/projects/my-openai-app
    agent: codex
```

See [Plugins](../) for the full plugin configuration reference.
