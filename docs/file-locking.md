# File Locking Mechanism

This document describes the file locking mechanism used by the Agent Orchestrator to prevent data loss from concurrent writes to YAML files.

## Overview

The Agent Orchestrator uses advisory file locking to serialize writes to `sprint-status.yaml` and other configuration files. This prevents the "last writer wins" problem when multiple processes attempt to write simultaneously.

## Implementation

The file locking is implemented in `packages/core/src/utils/file-lock.ts` using the `proper-lockfile` library, which provides cross-platform advisory locking.

### Key Features

- **Cross-platform**: Works on macOS, Linux, and Windows
- **Advisory locking**: Non-blocking with retry logic
- **Stale lock detection**: Automatically cleans up abandoned locks
- **Configurable retries**: Customizable retry behavior

## Configuration Options

Configure file locking behavior in `StateManagerConfig`:

```typescript
interface StateManagerConfig {
  yamlPath: string;
  eventBus?: EventBus;
  createBackup?: boolean;
  backupPath?: string;
  lockRetries?: number;    // Number of retry attempts (default: 10)
  lockStaleMs?: number;    // Stale lock age in ms (default: 10000)
}
```

### Option Details

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `lockRetries` | number | 10 | Number of times to retry acquiring the lock before failing |
| `lockStaleMs` | number | 10000 | Locks older than this (in ms) are considered stale and can be overwritten |

### Example Configuration

```typescript
import { createStateManager } from "@composio/ao-core";

const stateManager = createStateManager({
  yamlPath: "./sprint-status.yaml",
  lockRetries: 15,        // More retries for busy systems
  lockStaleMs: 30000,     // 30 second stale threshold
  createBackup: true,
});
```

## Usage

### Direct Usage

```typescript
import { FileLock } from "@composio/ao-core/utils/file-lock.js";

const fileLock = new FileLock();

// Acquire lock, do work, release
const release = await fileLock.acquire("/path/to/file.yaml");
try {
  // Perform file operations
} finally {
  await release();
}

// Or use withLock for automatic release
await fileLock.withLock("/path/to/file.yaml", async () => {
  // Perform file operations
  // Lock is automatically released after this completes
});
```

### State Manager Integration

The State Manager automatically uses file locking for all write operations:

```typescript
// This internally acquires a lock, writes, then releases
await stateManager.set("story-1", {
  id: "story-1",
  status: "in-progress",
  title: "My Story",
});
```

## How It Works

1. **Lock Acquisition**: When a write is requested, the system attempts to acquire a lock
2. **Retry Logic**: If the lock is held, it retries with exponential backoff
3. **Stale Detection**: Locks older than `lockStaleMs` are considered abandoned
4. **Atomic Write**: Once locked, the write is performed atomically
5. **Lock Release**: The lock is released after the write completes

## Known Limitations

### 1. Advisory Locking
File locking is **advisory**, not mandatory. Processes that don't use the FileLock class can still write to files. All processes writing to shared files must use the same locking mechanism.

### 2. NFS/Network Filesystems
File locking behavior on network filesystems (NFS, SMB, etc.) may be unreliable due to network latency and caching. For best results, use local filesystems.

### 3. Lock Files
The `proper-lockfile` library creates `.lock` files alongside the target files. These are automatically cleaned up but may remain if a process crashes.

### 4. Single Machine
This locking mechanism works for processes on the same machine. For distributed systems, use a distributed lock manager (e.g., Redis with Redlock).

## Troubleshooting

### Lock Acquisition Timeout

**Symptom**: `LockError: Could not acquire lock after X retries`

**Causes**:
1. Another process is holding the lock for too long
2. A previous process crashed without releasing the lock
3. The stale threshold is too low

**Solutions**:
1. Increase `lockRetries` for busy systems
2. Increase `lockStaleMs` if operations take longer
3. Manually remove `.lock` files if a crash occurred

### Stale Lock Files

**Symptom**: Lock files remain after processes exit

**Solution**: The `stale` option automatically handles this. Stale locks (older than `lockStaleMs`) are automatically cleaned up when a new lock is requested.

### Permission Errors

**Symptom**: `EACCES` or `EPERM` errors when acquiring locks

**Solution**: Ensure the user running the process has write permissions to the directory containing the target file.

### ENOENT Errors

**Symptom**: `ENOENT: no such file or directory` when acquiring lock

**Cause**: The target file doesn't exist. `proper-lockfile` requires the target file to exist.

**Solution**: Create the file before acquiring the lock, or ensure `StateManager.initialize()` is called first.

## Version Conflict Detection (Fallback)

In addition to file locking, the State Manager uses version stamps (optimistic locking) as a secondary defense:

1. Each story has a `version` field (e.g., `v1234567890-abc123`)
2. When updating, you can specify the expected version
3. If versions don't match, the update fails with a conflict error

This provides protection even if file locking fails or is bypassed:

```typescript
// Update with version check
const current = stateManager.get("story-1");
const result = await stateManager.set("story-1", newState, current.version);

if (!result.success && result.conflict) {
  // Handle conflict - another process modified the story
  console.log("Conflict detected, please refresh and retry");
}
```

## Related Files

- `packages/core/src/utils/file-lock.ts` - File locking utility
- `packages/core/src/state-manager.ts` - State Manager with integrated locking
- `packages/core/src/types.ts` - Type definitions for lock configuration
