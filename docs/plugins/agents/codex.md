---
title: Codex
nav_order: 2
parent: Agent Plugins
grand_parent: Plugins
description: codex agent plugin — OpenAI Codex CLI with shell wrapper hooks, JSONL streaming session info, approval policy mapping, and session resume via thread ID.
---

# Codex Agent

The **codex** plugin integrates OpenAI's Codex CLI with Agent Orchestrator. It provides automatic metadata updates via PATH-based shell wrappers (instead of Claude Code's PostToolUse hooks), streaming JSONL session parsing for cost tracking, approval policy mapping, and session resume via Codex's native `resume` subcommand.

{: .highlight }
> **Inline delivery:** codex uses `promptDelivery: "inline"` — the prompt is passed as a positional argument in the launch command (`codex -- "prompt"`). This matches Codex CLI's one-shot invocation model.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `codex` |
| **Slot** | `agent` |
| **Package** | `@composio/ao-plugin-agent-codex` |
| **Version** | `0.1.0` |
| **Default** | No |

---

## How It Works

The codex plugin resolves the Codex binary path on first launch, writes shell wrapper scripts to `~/.ao/bin/` for automatic metadata capture, and monitors activity by checking the mtime of Codex's JSONL session files. Session info is extracted by streaming JSONL files line-by-line to handle potentially large rollout files (100 MB+).

```text
create()
  |
  +-- Resolve binary path
  |     +-- which codex
  |     +-- Fallback: /usr/local/bin, /opt/homebrew, ~/.cargo/bin
  |
  +-- Build launch command
  |     +-- codex --dangerously-bypass-approvals-and-sandbox
  |     +-- --model {model}
  |     +-- -c model_instructions_file={file}
  |     +-- -- "prompt"
  |
  +-- Set environment vars
  |     +-- PATH=~/.ao/bin:$PATH (wrapper interception)
  |     +-- AO_SESSION_ID, AO_ISSUE_ID
  |
  +-- setupWorkspaceHooks()
  |     +-- Write ~/.ao/bin/ao-metadata-helper.sh
  |     +-- Write ~/.ao/bin/gh (wrapper)
  |     +-- Write ~/.ao/bin/git (wrapper)
  |     +-- Append AGENTS.md section
  |
  +-- Monitor via JSONL file mtime
        +-- Activity: session file mtime freshness
        +-- Session info: stream JSONL for tokens, model, threadId
```

### Shell Wrappers

Unlike Claude Code (which uses PostToolUse hooks), the codex plugin uses PATH-based shell wrappers to intercept `gh` and `git` commands. The wrappers are written to `~/.ao/bin/` and prepended to `PATH` via the `getEnvironment()` method.

{: .highlight }
> **Automatic metadata:** The `gh` wrapper intercepts `gh pr create` and `gh pr merge` to extract PR URLs and update session metadata. The `git` wrapper intercepts `git checkout -b` and `git switch -c` to capture branch names. All other commands pass through transparently.

Three files are written to `~/.ao/bin/`:

| File | Purpose |
|------|---------|
| `ao-metadata-helper.sh` | Shared helper providing `update_ao_metadata()` function |
| `gh` | Wrapper that intercepts `gh pr create` and `gh pr merge` |
| `git` | Wrapper that intercepts `git checkout -b` and `git switch -c` |

Wrappers are versioned via `~/.ao/bin/.ao-version` and only rewritten when the version changes. All writes are atomic (write to temp file, then rename).

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"codex"` |
| `processName` | `"codex"` |
| `promptDelivery` | `"inline"` (implicit — no property set) |

### getLaunchCommand(config)

Builds the shell command to launch Codex CLI:

```bash
codex --dangerously-bypass-approvals-and-sandbox --model gpt-4o -c model_instructions_file=/tmp/instructions.txt -- "Build the feature"
```

- `--dangerously-bypass-approvals-and-sandbox`: Auto-approve all tool uses (when `permissions: "skip"`)
- `--model`: Model override from config
- `-c model_instructions_file=`: System prompt via config override (reads from file)
- `-c developer_instructions=`: Inline system prompt (fallback when no file)
- `--`: Ends option parsing so prompts starting with `-` aren't treated as flags

{: .highlight }
> **Approval policy mapping:** `permissions: "skip"` maps to `--dangerously-bypass-approvals-and-sandbox`, `"auto-edit"` maps to `--ask-for-approval never`, and `"suggest"` maps to `--ask-for-approval untrusted`.

### getEnvironment(config)

Sets environment variables:

| Variable | Purpose |
|----------|---------|
| `AO_SESSION_ID` | Link to orchestrator session |
| `AO_ISSUE_ID` | GitHub issue or story ID |
| `PATH` | Prepends `~/.ao/bin` for wrapper interception |

### getActivityState(session, readyThresholdMs?)

Uses Codex's JSONL session file mtime as an activity proxy. Codex continuously appends to its rollout JSONL file while working, so a recently modified file indicates the agent is active.

| Session file found? | mtime age | State |
|---------------------|-----------|-------|
| No | — | `null` (unknown) |
| Yes | <= threshold | `active` |
| Yes | > threshold | `idle` |

Session files are located at `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`. The plugin scans this directory recursively (max depth 4) and matches files by checking the `session_meta` entry's `cwd` field against the workspace path. Results are cached for 30 seconds.

### getSessionInfo(session)

Streams the matched JSONL session file line-by-line to extract:

- **Model**: `session_meta.model` entry
- **Thread ID**: Used for `codex resume` command
- **Token counts**: Aggregates `input_tokens` and `output_tokens` from `event_msg` entries with `token_count` subtype
- **Summary**: Fallback string `"Codex session ({model})"`
- **Cost**: Calculated at $2.5/M input, $10/M output (OpenAI pricing)

{: .highlight }
> **Streaming, not buffering:** Codex rollout files can be 100 MB+. The plugin streams them line-by-line via `readline` instead of loading them entirely into memory.

### isProcessRunning(handle)

Uses tmux TTY detection + `ps -eo pid,tty,args` to find the `codex` process. For non-tmux runtimes, checks process liveness via `kill(pid, 0)`.

### getRestoreCommand(session, project)

Returns a resume command using Codex's native `resume` subcommand:

```bash
codex resume --dangerously-bypass-approvals-and-sandbox {threadId}
```

Returns `null` if no session file or thread ID is found.

### postLaunchSetup(session) / setupWorkspaceHooks(path, config)

Writes the shell wrapper scripts to `~/.ao/bin/` (see Shell Wrappers above) and appends an `## Agent Orchestrator (ao) Session` section to the workspace's `AGENTS.md` file.

---

## Cost Tracking

The plugin tracks costs by streaming Codex JSONL session files:

| Metric | Source |
|--------|--------|
| Input tokens | `event_msg.msg.input_tokens` from JSONL |
| Output tokens | `event_msg.msg.output_tokens` from JSONL |
| Estimated cost | $2.5/M input, $10/M output (OpenAI pricing) |

---

## Binary Resolution

The plugin resolves the Codex binary path on first launch using this search order:

1. `which codex` — system PATH lookup
2. Common locations — `/usr/local/bin/codex`, `/opt/homebrew/bin/codex`, `~/.cargo/bin/codex`, `~/.npm/bin/codex`
3. Fallback — `"codex"` (let the shell resolve it)

The resolved path is cached for the agent instance lifetime.

---

## App-Server Client

The codex package also exports `CodexAppServerClient` — a JSON-RPC 2.0 client for Codex's `app-server` mode. It manages a `codex app-server` subprocess and communicates via newline-delimited JSON over stdin/stdout.

{: .highlight }
> **Advanced integration:** The app-server client is an optional utility for programmatic Codex control. Most users don't need it — the standard agent interface (launch, monitor, resume) is sufficient.

Key capabilities:

| Capability | Description |
|------------|-------------|
| Thread management | Start, resume, and list conversation threads |
| Turn execution | Send messages and receive responses within threads |
| Model discovery | List available models from the Codex server |
| Approval handling | Intercept and respond to approval requests |
| Event notifications | Subscribe to server-side events via `EventEmitter` |

Imported from `@composio/ao-plugin-agent-codex`:

```typescript
import { CodexAppServerClient } from "@composio/ao-plugin-agent-codex";
import type { AppServerClientOptions, NotificationHandler } from "@composio/ao-plugin-agent-codex";
```

---

## Configuration

### Per-Project

```yaml
projects:
  my-openai-app:
    repo: org/my-openai-app
    path: ~/projects/my-openai-app
    agent: codex
```

### Approval Policy

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    agent: codex
    agentConfig:
      permissions: skip       # --dangerously-bypass-approvals-and-sandbox
      # permissions: auto-edit  # --ask-for-approval never
      # permissions: suggest    # --ask-for-approval untrusted
```

---

## When to Use Codex

| Scenario | Recommendation |
|----------|---------------|
| OpenAI-focused team | Use codex — native Codex CLI integration |
| Need cost tracking | Use codex — streaming JSONL token counting |
| Need session resume | Use codex — `codex resume` via thread ID |
| Using o-series models | Use codex — auto-enables `model_reasoning_effort=high` |
| Using Claude models | Use claude-code instead |

---

## Next Steps

- [Claude Code](../claude-code/) — Default agent with JSONL parsing and PostToolUse hooks
- [Aider](../aider/) — Lightweight AI pair programmer with git-based detection
- [Agent Plugins](./) — Agent plugin comparison and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
