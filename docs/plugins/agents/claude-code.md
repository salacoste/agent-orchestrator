---
title: Claude Code
nav_order: 1
parent: Agent Plugins
grand_parent: Plugins
description: claude-code agent plugin — default agent with JSONL session parsing, PostToolUse hooks, cost tracking, and session resume. Best for production use.
---

# Claude Code Agent

The **claude-code** plugin is the default agent for Agent Orchestrator. It provides full-featured integration with the Claude Code CLI, including JSONL-based session introspection, automatic metadata updates via PostToolUse hooks, cost tracking with token-level accuracy, and session resume support.

{: .highlight }
> **Default plugin:** claude-code is the default agent plugin. It uses `promptDelivery: "post-launch"` — the prompt is sent via `runtime.sendMessage()` after the agent starts, keeping Claude in interactive mode rather than one-shot mode.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `claude-code` |
| **Slot** | `agent` |
| **Package** | `@composio/ao-plugin-agent-claude-code` |
| **Version** | `0.1.0` |
| **Default** | Yes |

---

## How It Works

The claude-code plugin uses a factory function (`createClaudeCompatibleAgent`) that other plugins (like glm) can reuse. It launches Claude Code with permission-skipping flags, sets up PostToolUse hooks for metadata automation, and monitors activity by parsing Claude's JSONL session files.

```text
create()
  |
  +-- Build launch command
  |     +-- --dangerously-skip-permissions
  |     +-- --model {model}
  |     +-- --append-system-prompt "$(cat file)"
  |
  +-- Set environment vars
  |     +-- CLAUDECODE="" (suppress UI)
  |     +-- AO_SESSION_ID, AO_ISSUE_ID
  |
  +-- postLaunchSetup()
  |     +-- Write .claude/settings.json
  |     +-- Write metadata-updater.sh
  |
  +-- Monitor via JSONL files
        +-- Activity: last entry type
        +-- Cost: aggregate costUSD
        +-- Summary: last summary entry
```

### Prompt Delivery

Claude Code uses **post-launch** delivery. Instead of passing the prompt via the `-p` flag (which causes one-shot/exit behavior), the prompt is sent via `runtime.sendMessage()` after the agent starts. This keeps Claude in interactive mode, allowing follow-up messages and multi-turn conversations.

### Claude Project Path Encoding

Claude stores session data at `~/.claude/projects/{encoded-path}/`. The encoding strips the leading `/` and replaces `/` and `.` with `-`. For example, `/home/user/projects/my-app` becomes `home-user-projects-my-app`.

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"claude-code"` |
| `processName` | `"claude"` |
| `promptDelivery` | `"post-launch"` |

### getLaunchCommand(config)

Builds the shell command to launch Claude Code:

```bash
claude --dangerously-skip-permissions --model sonnet-4 --append-system-prompt "$(cat /tmp/system-prompt.txt)"
```

- `--dangerously-skip-permissions`: Auto-approve all tool uses
- `--model`: Model override from config
- `--append-system-prompt`: Orchestrator context (uses `$(cat file)` for long prompts to avoid shell truncation)

### getEnvironment(config)

Sets environment variables:

| Variable | Purpose |
|----------|---------|
| `CLAUDECODE=""` | Suppress Claude Code's own orchestrator UI |
| `AO_SESSION_ID` | Link to orchestrator session |
| `AO_AGENT_PROCESS_NAME` | Process name for detection |
| `YOLO_HEADLESS=1` | Enable headless mode |
| `AO_ISSUE_ID` | GitHub issue or story ID |

### getActivityState(session, readyThresholdMs?)

Reads Claude's JSONL session files and classifies the last entry:

| Last entry type | State |
|----------------|-------|
| `user`, `tool_use`, `progress` | active (or idle if stale) |
| `assistant`, `system`, `summary`, `result` | ready (or idle if stale) |
| `permission_request` | waiting_input |
| `error` | blocked |

JSONL files are located at `~/.claude/projects/{encoded-path}/`. The plugin reads only the last 128KB for efficiency.

### getSessionInfo(session)

Parses JSONL session tail to extract:

- **Summary**: Last `type: "summary"` entry. Fallback: first user message truncated at 120 chars.
- **Cost**: Aggregates `costUSD` from entries. Fallback pricing: Sonnet 4.5 rates ($3/M input, $15/M output).
- **Agent session ID**: Used for `--resume` command.

### detectActivity(terminalOutput)

Pattern-based terminal output classification (deprecated in favor of `getActivityState`):

- Prompt chars `^[❯>$#]\s*$` → idle
- Approval prompts ("Do you want to proceed?") → waiting_input
- Default → active

### isProcessRunning(handle)

Uses tmux TTY detection + `ps -eo pid,tty,args` to find the agent process. Results are cached for 5 seconds (`PS_CACHE_TTL_MS`) to avoid spawning concurrent `ps` processes.

### getRestoreCommand(session, project)

Returns a resume command:

```bash
claude --resume {sessionUuid} --dangerously-skip-permissions --model {model}
```

Returns `null` if no previous session is found (caller falls back to `getLaunchCommand`).

### postLaunchSetup(session) / setupWorkspaceHooks(path, config)

Writes two files:

1. **`.claude/metadata-updater.sh`** — Bash script that auto-updates session metadata when the agent runs:
   - `gh pr create` → extracts PR URL, writes to metadata
   - `git checkout -b` / `git switch -c` → writes branch name to metadata
   - `gh pr merge` → updates PR status in metadata

2. **`.claude/settings.json`** — Registers the script as a `PostToolUse` hook so it runs automatically after every tool use.

{: .highlight }
> **Automatic metadata:** The dashboard depends on this hook. Without it, PRs created by agents never show up. The hook is installed during `ao init` and `ao start`.

---

## Cost Tracking

The plugin tracks costs by aggregating token usage from JSONL entries:

| Metric | Source |
|--------|--------|
| Input tokens | `usage.input_tokens` from JSONL |
| Output tokens | `usage.output_tokens` from JSONL |
| Estimated cost | `costUSD` from JSONL, or Sonnet 4.5 fallback ($3/M input, $15/M output) |

---

## Configuration

### Global Default

```yaml
defaults:
  agent: claude-code
```

claude-code is the default — you only need to specify it if overriding from a different agent.

### Per-Project Override

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    agent: claude-code  # explicit, though already default
```

### Custom Command

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    agent: claude-code
    agentConfig:
      command: /usr/local/bin/claude  # custom binary path
      processName: claude              # custom process name
```

---

## When to Use Claude Code

| Scenario | Recommendation |
|----------|---------------|
| Production deployment | Use claude-code — most mature integration |
| Need cost tracking | Use claude-code — JSONL-based token counting |
| Need session resume | Use claude-code — `claude --resume` support |
| Need automatic metadata | Use claude-code — PostToolUse hooks |
| Using other AI tools | Consider codex (OpenAI), aider, or opencode |

---

## Next Steps

- [Codex](../codex/) — OpenAI Codex CLI alternative
- [GLM](../glm/) — Z.ai GLM via yolo (inherits claude-code features)
- [Plugins](../../) — Plugin architecture and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
