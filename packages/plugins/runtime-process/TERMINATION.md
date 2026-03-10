# Runtime Plugin Termination Behavior

This document describes how each runtime plugin handles session termination and graceful shutdown.

## Overview

When the orchestrator needs to terminate a session (e.g., during conflict resolution), it calls `runtime.destroy(handle)`. Each plugin implements this differently based on its underlying technology.

## runtime-process

### Termination Strategy

1. **Graceful Phase**: Sends `SIGTERM` to the entire process group
2. **Force Phase**: After 5 seconds, sends `SIGKILL` if process is still alive

### Implementation Details

```typescript
async destroy(handle: RuntimeHandle): Promise<void> {
  const child = entry.process;

  if (child.exitCode === null && child.signalCode === null) {
    // Kill entire process group (negative PID)
    const pid = child.pid;
    if (pid) {
      try {
        process.kill(-pid, "SIGTERM");  // Process group
      } catch {
        child.kill("SIGTERM");  // Fallback to direct kill
      }
    }
  }

  // Wait 5 seconds, then SIGKILL if still alive
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null) {
        process.kill(-pid, "SIGKILL");
      }
      resolve();
    }, 5000);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
```

### Behavior Notes

- Uses `detached: true` when spawning to create a new process group
- Negative PID kills entire process tree (child commands too)
- Supports graceful shutdown if process handles `SIGTERM`
- Force kills unresponsive processes after 5 second timeout

### Best Practices

- Write shell scripts that trap `SIGTERM` for cleanup
- Avoid using `trap '' TERM` unless necessary
- Use `exec` to replace shell with final command when appropriate

## runtime-tmux

### Termination Strategy

1. **Immediate**: Uses `tmux kill-session` to terminate session
2. **No Graceful Period**: tmux handles signal forwarding internally

### Implementation Details

```typescript
async destroy(handle: RuntimeHandle): Promise<void> {
  try {
    await tmux("kill-session", "-t", handle.id);
  } catch {
    // Session may already be dead — that's fine
  }
}
```

### Behavior Notes

- `kill-session` terminates session and all panes immediately
- tmux forwards `SIGTERM` to pane processes before killing
- No configurable graceful shutdown period
- Idempotent — safe to call on already-dead sessions

### Best Practices

- Let tmux handle process lifecycle
- Use pane titles for debugging
- Configure `remain-on-exit` if you need to capture output after exit

## Conflict Resolution Integration

When the conflict resolution service terminates a conflicting agent:

1. **Calls Runtime.destroy()** with the session handle
2. **Updates Agent Registry** to mark assignment as terminated
3. **Publishes `agent.terminated` event** for notification
4. **Cleans up metadata** files

### Example Flow

```
Conflict detected → Priority scores calculated → Loser identified
    ↓
Runtime.destroy(loserHandle) → SIGTERM/SIGKILL sent
    ↓
AgentRegistry.update(storyId, { status: "terminated" })
    ↓
EventBus.publish("agent.terminated", { agentId, reason })
```

## Testing

Runtime termination is tested at multiple levels:

1. **Unit Tests**: Each plugin has tests for `destroy()` behavior
2. **Integration Tests**: Conflict resolution service tests termination flow
3. **E2E Tests**: Full orchestrator shutdown scenarios

## Future Enhancements

- [ ] Configurable graceful shutdown timeout per plugin
- [ ] Custom signal support (SIGINT, SIGUSR1, etc.)
- [ ] Pre-termination hooks for cleanup
- [ ] Termination reason tracking in audit log
