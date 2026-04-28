---
title: tmux
nav_order: 1
parent: Runtime Plugins
grand_parent: Plugins
description: tmux runtime plugin — persistent session management, long-command handling, environment injection, attach support. Default runtime for production use.
---

# tmux Runtime

The **tmux** plugin is the default runtime for Agent Orchestrator. It creates persistent tmux sessions that survive network disconnects, SSH session drops, and terminal closures — ideal for long-running AI coding agents.

{: .highlight }
> **Default plugin:** tmux is the default runtime plugin. It is auto-loaded from `BUILTIN_PLUGINS` and requires the `tmux` binary to be installed.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `tmux` |
| **Slot** | `runtime` |
| **Package** | `@composio/ao-plugin-runtime-tmux` |
| **Version** | `0.1.0` |
| **Default** | Yes |

---

## Prerequisites

- **tmux** must be installed and available in `$PATH`
- Install on macOS: `brew install tmux`
- Install on Linux: `sudo apt install tmux` or `sudo dnf install tmux`

Verify installation:

```bash
tmux -V
```

---

## How It Works

The tmux plugin manages sessions through the `tmux` CLI using `execFile` (no shell injection risk). Each agent session maps to a tmux session.

```text
create()
  |
  +-- tmux new-session -d -s <id> -c <workspace>
  |     +-- Env: -e KEY=VALUE for each var
  |
  +-- Send launch command
        +-- <= 200 chars: send-keys <cmd> Enter
        +-- >  200 chars: load/paste-buffer
```

{: .highlight }
> **Long commands (>200 chars):** The tmux/zsh `send-keys` mechanism truncates commands longer than ~200 characters. The plugin automatically uses `load-buffer`/`paste-buffer` for long commands, writing them to a temp file and pasting into the tmux session.

### Session ID Validation

Session IDs must match `^[a-zA-Z0-9_-]+$` — only alphanumeric characters, hyphens, and underscores. Invalid IDs are rejected immediately.

---

## Methods

### create(config)

Creates a detached tmux session and sends the launch command.

```text
1. Validate sessionId
2. tmux new-session -d -s <id> -c <ws>
3. Send launchCommand:
   - <= 200 chars: send-keys <cmd> Enter
   - >  200 chars: load/paste-buffer
4. Return RuntimeHandle { id, data }
```

If the launch command fails, the session is cleaned up automatically.

### destroy(handle)

Kills the tmux session. Errors are silently ignored (session may already be dead).

### sendMessage(handle, message)

Sends a text message to the running agent:

1. Clears any partial input with `Ctrl-U` (`C-u`)
2. For long/multiline messages (>200 chars or contains `\n`): uses `load-buffer`/`paste-buffer` with a temp file
3. For short single-line messages: uses `send-keys -l` (literal mode — text like "Enter" or "Space" is not interpreted as tmux key names)
4. 300ms delay (lets tmux process the text), then presses `Enter`

{: .highlight }
> **Literal mode:** The `-l` flag ensures text is sent literally. Without it, words like "Enter", "Space", or "Escape" would be interpreted as tmux key names.

### getOutput(handle, lines = 50)

Uses `tmux capture-pane -p -S -<lines>` to capture the last N lines of visible terminal output.

### isAlive(handle)

Uses `tmux has-session -t <id>`. Returns `true` if the session exists, `false` otherwise.

### getMetrics(handle)

Returns `RuntimeMetrics` with `uptimeMs` calculated from `handle.data.createdAt`.

### getAttachInfo(handle)

Returns the tmux attach command:

```bash
tmux attach -t <session-name>
```

### getExitCode(handle)

Returns:
- `null` — session is still alive
- `undefined` — session is dead (tmux does not track exit codes natively)

{: .highlight }
> **tmux limitation:** Unlike the process plugin, tmux does not natively capture the exit code of the shell running inside a session. The return value is `undefined` when the session is dead.

### getSignal(handle)

Returns:
- `null` — session is still alive
- `undefined` — session is dead (tmux does not track termination signals)

---

## Security

- All tmux commands use `execFile("tmux", args)` — never `exec()` — preventing shell injection
- Temp files for long commands use `randomUUID()` names to prevent collisions
- Temp files are created with mode `0o600` (owner read/write only)
- Temp files and tmux buffers are cleaned up in `finally` blocks

---

## Configuration

### Global Default

```yaml
defaults:
  runtime: tmux
```

tmux is the default — you only need to specify it if overriding from a different runtime.

### Per-Project Override

```yaml
projects:
  my-app:
    repo: org/my-app
    path: ~/projects/my-app
    runtime: tmux  # explicit, though tmux is already default
```

---

## When to Use tmux

| Scenario | Recommendation |
|----------|---------------|
| SSH into a remote server | Use tmux — sessions survive disconnects |
| Long-running agents (hours) | Use tmux — persistence is critical |
| Production deployment | Use tmux — robust session management |
| Attaching to debug an agent | Use tmux — `tmux attach` gives full terminal |
| CI/CD pipeline | Consider process — no tmux dependency needed |
| Docker containers | Consider process — simpler lifecycle |

---

## Next Steps

- [process](../process/) — Lightweight alternative for CI and containers
- [Plugins](../../) — Plugin architecture and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
