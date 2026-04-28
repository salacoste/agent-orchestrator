---
title: process
nav_order: 2
parent: Runtime Plugins
grand_parent: Plugins
description: process runtime plugin — lightweight child process management with rolling output buffer, graceful shutdown, and no external dependencies. Best for CI and containers.
---

# process Runtime

The **process** plugin is a lightweight runtime that manages agent sessions as child processes. Sessions are tied to the parent process lifecycle — when the orchestrator exits, all sessions terminate. This makes it ideal for CI pipelines, containerized environments, and local development where persistence is not needed.

{: .highlight }
> **No prerequisites:** The process plugin uses Node.js built-in `child_process` module. No external binaries are required.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `process` |
| **Slot** | `runtime` |
| **Package** | `@composio/ao-plugin-runtime-process` |
| **Version** | `0.1.0` |
| **Default** | No (default is tmux) |

---

## How It Works

The process plugin spawns the agent as a child process with `shell: true` and `detached: true`. Output is captured into a rolling buffer. When destroyed, the plugin sends SIGTERM to the entire process group, then SIGKILL after 5 seconds if the process hasn't exited.

```text
create()
  |
  +-- spawn(launchCommand, {
  |     cwd, env, stdio: pipes,
  |     shell: true, detached: true
  |   })
  |
  +-- Attach output listeners
  |     +-- stdout -> buffer (1000 lines)
  |     +-- stderr -> buffer (1000 lines)
  |
  +-- Return RuntimeHandle { id, pid }
```

{: .highlight }
> **`shell: true` is intentional:** The launch command comes from trusted YAML configuration and may contain pipes, redirects, or other shell syntax. `shell: true` enables these features.

### Process Group Isolation

The `detached: true` option creates the child in its own process group. This allows `destroy()` to kill the entire process group (including any sub-processes spawned by the agent), not just the top-level shell.

### Session ID Validation

Session IDs must match `^[a-zA-Z0-9_-]+$` — only alphanumeric characters, hyphens, and underscores. Duplicate session IDs are rejected.

---

## Methods

### create(config)

Spawns a child process and waits for the `spawn` event before returning.

```text
1. Validate sessionId
2. Check for duplicate (atomic, no await)
3. spawn(launchCommand, { shell: true, detached: true })
4. Wait for "spawn" event
5. Attach output listeners to stdout/stderr
6. Return RuntimeHandle { id, pid }
```

If the spawn fails, the session entry is cleaned up automatically.

### destroy(handle)

Gracefully terminates the process:

1. If the process is still running (`exitCode === null && signalCode === null`):
   - Send `SIGTERM` to the process group (negative PID: `process.kill(-pid, "SIGTERM")`)
   - Wait up to 5 seconds for the process to exit
   - If still running after 5s: send `SIGKILL` to the process group
2. Remove the process entry from the internal map

{: .highlight }
> **Process group kill:** The plugin kills the entire process group using negative PID (`process.kill(-pid, ...)`), not just the shell. This ensures child commands spawned by the agent are also terminated.

### sendMessage(handle, message)

Writes the message to the child process's `stdin` followed by a newline. Uses a done-flag pattern to prevent double resolve/reject on concurrent error and drain events.

### getOutput(handle, lines = 50)

Returns the last N lines from the rolling output buffer. Both stdout and stderr are merged into the same buffer.

### isAlive(handle)

Returns `true` if the process entry exists and the child has no `exitCode` or `signalCode`.

### getMetrics(handle)

Returns `RuntimeMetrics` with `uptimeMs` calculated from the session's `createdAt` timestamp.

### getAttachInfo(handle)

Returns `AttachInfo` with `type: "process"` and `target: <pid>`. If the process is no longer running, returns `target: ""` with a comment explaining the session has ended.

### getExitCode(handle)

Returns:
- `null` — process is still running
- `number` — actual exit code from `child.exitCode`
- `undefined` — process entry doesn't exist (never created, or already cleaned up after exit)

{: .highlight }
> **Exit code availability:** The exit handler cleans up the process entry after the child exits (source: `processes.delete(handleId)`). To capture the exit code, call `getExitCode()` before the next event-loop turn after the process exits, or use `destroy()` which waits for exit before cleanup. Unlike tmux, the process plugin **can** return actual exit codes when queried in time.

### getSignal(handle)

Returns:
- `null` — process is still running
- `string` — actual signal from `child.signalCode` (e.g., `"SIGTERM"`, `"SIGKILL"`)
- `undefined` — process entry doesn't exist, or process exited normally without a signal

---

## Output Buffer

The process plugin uses a rolling output buffer to capture agent output:

- **Maximum size:** 1000 lines (`MAX_OUTPUT_LINES`)
- **Per-stream partial buffers:** stdout and stderr each have their own partial-line buffer to prevent interleaved chunks from corrupting output
- **Automatic trimming:** When the buffer exceeds 1000 lines, oldest entries are removed
- **Flush on exit:** Partial lines are flushed when the process exits
- **Exit diagnostic:** When the process exits, a `[process exited with code X]` message is appended to the buffer before cleanup

{: .highlight }
> **1000-line cap:** The rolling buffer prevents unbounded memory growth. For sessions with verbose output, only the most recent 1000 lines are retained.

---

## Configuration

### Enable process Runtime

```yaml
# Global default
defaults:
  runtime: process

# Per-project override
projects:
  my-ci-app:
    repo: org/my-ci-app
    path: ~/projects/my-ci-app
    runtime: process
```

### Use Case: CI Pipeline

```yaml
# agent-orchestrator.yaml for CI
defaults:
  runtime: process
  agent: claude-code

projects:
  main:
    repo: org/main-app
    path: ./
```

In CI, the orchestrator and agents share the same lifecycle — when the pipeline ends, everything shuts down cleanly.

---

## When to Use process

| Scenario | Recommendation |
|----------|---------------|
| CI/CD pipeline | Use process — no tmux dependency |
| Docker containers | Use process — simpler lifecycle management |
| Local development (short tasks) | Use process — lightweight |
| Headless environments | Use process — no terminal multiplexer needed |
| Long-running agents | Use tmux — process sessions die with orchestrator |
| SSH with reconnection | Use tmux — process sessions are not persistent |
| Need to attach and debug | Use tmux — process has no attach mechanism |

---

## Next Steps

- [tmux](../tmux/) — Persistent session management (default runtime)
- [Plugins](../../) — Plugin architecture and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
