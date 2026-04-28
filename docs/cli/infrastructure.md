---
title: Infrastructure Commands
nav_order: 8
parent: CLI Reference
description: System health checks, provider listing, error log management, dead letter queue operations, metadata verification, retry, and state sync commands.
---

# Infrastructure Commands

Commands for system health monitoring, error handling, metadata verification, and operational diagnostics.

{: .highlight }
**Overlap notice:** Plugin management (`ao plugins` / `ao plugin *`) is documented in [Setup Commands](setup-commands.md). Event bus subcommands (`ao events query/drain/status`) are documented in [Monitoring Commands](monitoring.md). This page covers the remaining infrastructure commands.

## Overview

| Command | Description | JSON Output |
|---------|-------------|-------------|
| `ao health [project]` | Show system health | Yes |
| `ao providers` | List registered session enhancement providers | Yes |
| `ao errors` | Search and display error logs | Yes (`--format json`) |
| `ao dlq <sub>` | Manage dead letter queue | Yes (list, stats) |
| `ao metadata verify` | Verify YAML metadata file integrity | Yes |
| `ao retry` | Retry a failed operation by error ID | No |
| `ao sync [storyId]` | Sync state with BMAD tracker | No |

## ao health

```
ao health [project]
```

> "Show system health — event bus, BMAD tracker, local state, agent registry"

Runs a health check across all system components and reports status.

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--json` | Output as JSON | — |
| `--watch` | Continuous monitoring with alerts on status changes | — |
| `--interval <ms>` | Check interval in ms for watch mode (default: 30000) | `30000` |

### Health Status Badges

| Status | Badge | Color |
|--------|-------|-------|
| `healthy` | `✅` | green |
| `degraded` | `⚠️` | yellow |
| `unhealthy` | `❌` | red |

### Output

The command displays a system health table with component status:

```text
System Health: my-project
────────────────────────────────────────────────────────────
Component         Status    Latency  Details
────────────────────────────────────────────────────────────
Event Bus         ✅        42ms     Connected
BMAD Tracker      ✅        12ms     Available
Local State       ✅        1ms      52 stories
Agent Registry    ✅        3ms      3 agents
────────────────────────────────────────────────────────────
Overall: ✅ healthy

✓ All components are healthy!
```

When one or more components are degraded:

```text
⚠️  One or more components are degraded!
```

When one or more components are unhealthy:

```text
⚠️  One or more components are unhealthy!
```

### Watch Mode

Use `--watch` for continuous monitoring. The command runs health checks at the specified `--interval` (default 30 seconds) and alerts on status changes:

```bash
# Continuous monitoring every 10 seconds
ao health --watch --interval 10000
```

Change detection messages:

- `Health degraded to <status>` — transitioning away from healthy
- `Health recovered to <status>` — transitioning back to healthy
- `Health changed from <old> to <new>` — any other transition

Press `Ctrl+C` to stop. Watch mode handles `SIGINT` and `SIGTERM` for graceful shutdown (exit code 0).

### Exit Codes

The command uses `process.exit(result.exitCode)` for scripting:

- **0** — all components healthy
- **1** — one or more components degraded or unhealthy, or config/project not found

### JSON Output

```json
{
  "overall": "healthy",
  "exitCode": 0,
  "components": [
    {
      "component": "Event Bus",
      "status": "healthy",
      "latencyMs": 42,
      "message": "Connected",
      "details": ["Connected"]
    }
  ]
}
```

### Requirements

- **Config**: `loadConfig()` — requires `agent-orchestrator.yaml`
- **Tracker**: `getTracker()` — checks `trackerPlugin.name === "bmad"`
- **Config error**: `` No config found. Run `ao init` first. ``
- **Project error**: `Project config not found: <projectId>`

### Examples

```bash
# Check health for current project
ao health

# Check specific project
ao health my-project

# JSON output for scripting
ao health --json

# Continuous monitoring
ao health --watch

# Custom check interval (15 seconds)
ao health --watch --interval 15000
```

## ao providers

```
ao providers
```

> "List registered session enhancement providers"

Displays all registered provider plugins and their active configuration per scope.

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### Output

Two sections are displayed:

**Registered Providers** — a fixed-width table of all available providers:

```text
Registered Providers
────────────────────────────────────────────────────────────
Name                Version     Description
────────────────────────────────────────────────────────────
raw                 1.0.0       Default raw provider
────────────────────────────────────────────────────────────
```

When no providers are registered:

```text
  No provider plugins registered. (dim)
```

**Active Configuration** — shows which provider is active for each scope:

```text
Active Configuration
────────────────────────────────────────────────────────────
  global: raw
  project:my-app: custom-provider
────────────────────────────────────────────────────────────
```

### JSON Output

```json
{
  "providers": [
    {
      "name": "raw",
      "slot": "provider",
      "description": "Default raw provider",
      "version": "1.0.0"
    }
  ],
  "active": [
    { "scope": "global", "provider": "raw" },
    { "scope": "project:my-app", "provider": "custom-provider" }
  ]
}
```

### Requirements

- **Config**: `loadConfig()` — requires `agent-orchestrator.yaml`
- **Registry**: Uses `createPluginRegistry()` to discover providers
- **Config error**: `` No config found. Run `ao init` first. ``

### Examples

```bash
# List all providers and active configuration
ao providers

# JSON output
ao providers --json
```

## ao errors

```
ao errors
```

> "Search and display error logs"

Searches and displays error logs from the local error log directory. Reads the filesystem directly — does not require a running application or config file.

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--type <type>` | Filter by error type | — |
| `--id <errorId>` | Search by error ID prefix | — |
| `--last <duration>` | Show errors from last duration (e.g., 1h, 30m, 1s) | — |
| `--start <timestamp>` | Show errors after this ISO timestamp | — |
| `--end <timestamp>` | Show errors before this ISO timestamp | — |
| `--component <name>` | Filter by component/service name | — |
| `--story <id>` | Filter by story ID | — |
| `--agent <id>` | Filter by agent ID | — |
| `--dir <path>` | Error log directory (default: .ao-error-logs) | `.ao-error-logs` |
| `--format <format>` | Output format (table, json) | `table` |
| `--detail <errorId>` | Show full details for a specific error | — |

### Table Output

Default output is a table with five columns:

```text
Error ID             Time                 Type            Component       Message
──────────────────────────────────────────────────────────
err_1714012345       4/24/2026, 10:30 AM  RuntimeError    session-mgr     Failed to spawn ...
```

Column widths: Error ID (22), Time (20), Type (15), Component (15), Message (52). Error IDs are truncated to 20 characters in the table. Timestamps use locale format via `toLocaleString()`.

**ErrorRateSummary** entries display specially:

```text
SUMMARY  Rate  -  5 errors in 60s
```

The window duration always uses seconds (`windowMs / 1000` with `s` suffix).

When no errors are found:

```text
No errors found.
```

Post-table summary (dim):

```text
Showing 3 errors
```

The count uses singular `"error"` for 1 and plural `"errors"` otherwise.

### Detail View

Use `--detail <errorId>` to show full error information:

**For ErrorRateSummary:**

```text
=== Error Rate Summary === (yellow, bold)
Type:     ErrorRateSummary (yellow)
Time:     4/24/2026, 10:30:00 AM
Count:    5 (yellow)
Window:   60s (yellow)
Threshold: 10 (yellow)
```

**For ErrorLogEntry:**

```text
=== Error: err_1714012345 === (bold)
Time:           4/24/2026, 10:30:00 AM
Type:           RuntimeError (red)
Message:        Failed to spawn agent (red)
Component:      session-mgr (cyan)
Story:          62-27-foo (cyan)
Agent:          claude-opus (cyan)
Correlation ID: corr_abc123

Stack Trace:    Error: Failed to spawn agent (dim)
                    at SessionManager.start

Context:        { "sessionId": "sess_123" } (dim)

State Snapshot: { "status": "error" } (dim)
```

Fields shown conditionally — Component, Story, Agent, Correlation ID, Stack Trace, Context, and State Snapshot only appear when present.

### JSON Output

With `--format json`, outputs the filtered array:

```json
[
  {
    "errorId": "err_1714012345",
    "timestamp": "2026-04-24T10:30:00.000Z",
    "type": "RuntimeError",
    "message": "Failed to spawn agent",
    "stack": "Error: Failed to spawn agent\n    at ...",
    "component": "session-mgr",
    "storyId": "62-27-foo",
    "agentId": "claude-opus",
    "correlationId": "corr_abc123",
    "context": { "sessionId": "sess_123" },
    "stateSnapshot": { "status": "error" }
  }
]
```

**ErrorRateSummary** records in JSON have a different shape: `{ type: "ErrorRateSummary", timestamp, errorCount, windowMs, threshold }`.

### Requirements

- **No config required** — reads filesystem directly using `readdirSync` / `readFileSync`
- **Error directories** searched in order: `.ao-error-logs`, `.error-logs`, `logs/errors`
- **Config error**: `` Error log directory not found: <path> ``
- **Config hint**: `Make sure error logging has been configured.` (dim, follows directory error)
- **Error not found**: `` Error not found: <errorId> ``
- **Duration parse error**: `` Invalid duration format: <duration>. Use format like 1h, 30m, 1s ``

### Examples

```bash
# Show all errors
ao errors

# Errors from last hour
ao errors --last 1h

# Filter by type
ao errors --type RuntimeError

# Filter by story
ao errors --story 62-27-foo

# Full detail for specific error
ao errors --detail err_1714012345

# JSON output
ao errors --format json

# Custom error log directory
ao errors --dir /path/to/error-logs

# Combined filters
ao errors --type RuntimeError --last 30m --component session-mgr
```

## ao dlq

```
ao dlq <subcommand>
```

> "Manage dead letter queue for failed operations"

Manages the dead letter queue (DLQ) for operations that have failed and cannot be automatically retried.

### Subcommands

| Subcommand | Description |
|------------|-------------|
| `ao dlq list` | List all failed operations in the DLQ |
| `ao dlq replay <errorId>` | Replay a failed operation (bypasses circuit breaker) |
| `ao dlq replay-all` | Replay all failed operations in the DLQ |
| `ao dlq purge` | Remove DLQ entries older than specified duration |
| `ao dlq stats` | Show statistics about the DLQ |

### ao dlq list

Lists all entries in the dead letter queue.

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

Output shows each entry with labeled fields:

```text
Dead Letter Queue (3 entries)

Error ID: err_1714012345 (bold)
  Operation: story.stateChange (cyan)
  Failed: 4/24/2026, 10:30:00 AM (dim)
  Reason: connection refused (yellow)
  Retries: 3
  Original: Failed to update state: connection refused (dim)
```

Timestamps use locale format via `toLocaleString()`.

When the DLQ is empty:

```text
✓ DLQ is empty — no failed operations
```

After listing entries, a summary by operation type is shown (dim):

```text
Summary by operation:
  story.stateChange: 2
  event.publish: 1
```

**JSON output**: `DLQEntry[]` array via `JSON.stringify(entries, null, 2)`.

### ao dlq replay

```
ao dlq replay <errorId>
```

> "Replay a failed operation (bypasses circuit breaker)"

Replays a single failed operation by its error ID. No flags — takes the error ID as a positional argument.

Output shows the operation being replayed (bold) and its payload (dim):

```text
Replaying operation: story.stateChange

Payload: { "storyId": "62-27-foo", "status": "in-progress" }
```

On success:

```text
✓ Replay successful
Removed entry err_1714012345 from DLQ
```

On failure:

```text
✗ Replay failed: connection refused
Entry remains in DLQ for future retry
```

When no replay handler exists for the operation type:

```text
⚠ No replay handler for operation type: custom.op
Supported types: story.stateChange, event.publish
To manually replay:
  1. Extract payload: {"storyId":"62-27-foo"}
  2. Run operation: custom.op
  3. If successful, run: ao dlq remove err_1714012345
```

When the error ID is not found:

```text
Error ID not found: err_9999999999

Run 'ao dlq list' to see all failed operations (dim)
```

Service availability warnings (for `event_publish` and `bmad_sync` operations):

```text
⚠ Event publisher not available
Start the application to enable event replay.

⚠ BMAD tracker not available
Start the application to enable BMAD sync replay.
```

### ao dlq replay-all

Replays all supported operations in the DLQ.

| Flag | Description |
|------|-------------|
| `--force` | Skip confirmation prompt |

Without `--force`, prompts for confirmation:

```text
Replay 3 supported operations? (y/N)
```

Before replay, entries are categorized:

```text
Found 3 failed operations
  Supported: 2 (green)
  Unsupported: 1 (yellow)
Unsupported operation types:
  - custom.op (dim)
Operations to replay:
  story.stateChange: connection refused (cyan)
```

During replay, per-entry progress is shown:

```text
  ✓ story.stateChange (err_1714012345) (green)
  ✗ event.publish (err_9988776655): timeout (red)
```

After replay, a summary is displayed:

```text
Replay Summary (bold)
  Successful: 2 (green)
  Failed: 1 (red)

Failed entries remain in DLQ for future retry (dim)
```

When the DLQ is empty:

```text
✓ DLQ is empty — nothing to replay
```

### ao dlq purge

Removes DLQ entries older than the specified duration.

| Flag | Description | Default |
|------|-------------|---------|
| `--older-than <duration>` | Duration threshold (e.g., 7d, 24h, 60m) | `7d` |
| `--yes` | Skip confirmation prompt | — |

Without `--yes`, prompts for confirmation after showing what will be purged:

```text
Will purge 5 of 12 entries (bold)
(older than 7 days) (dim)

Continue with purge? (y/N)
```

When entries exist but none match the age threshold:

```text
✓ No entries older than 7 days to purge
```

On success:

```text
✓ Purged 5 entries from DLQ
```

When the DLQ is empty:

```text
✓ DLQ is empty — nothing to purge
```

**Duration parse error**: `` Invalid duration format: <duration>. Use format like 7d, 24h, 60m, 30s ``

### ao dlq stats

Shows statistics about the dead letter queue.

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

Output:

```text
Dead Letter Queue Statistics

  Total entries: 12 (bold)
  Oldest entry: 4/17/2026, 10:00:00 AM (dim)
  Newest entry: 4/24/2026, 10:30:00 AM (dim)

  By operation:
    story.stateChange: 8 (cyan)
    event.publish: 4 (cyan)
```

Timestamps use locale format via `toLocaleString()`.

When the DLQ is large (`stats.totalEntries > 100`):

```text
⚠ DLQ size is 150 entries (consider purging old entries)
Run: ao dlq purge --older-than 7d
```

**JSON output**: `{ totalEntries, oldestEntry, newestEntry, byOperation }` via `JSON.stringify(stats, null, 2)`.

### Requirements

- **Config**: `loadConfig()` — requires `agent-orchestrator.yaml`
- **Config error**: `` No config found. Run `ao init` first. `` (all subcommands)
- **Interactive prompts**: `replay-all` and `purge` use `@inquirer/prompts` confirmations

### Examples

```bash
# List all DLQ entries
ao dlq list

# Replay a specific entry
ao dlq replay err_1714012345

# Replay all without confirmation
ao dlq replay-all --force

# Purge entries older than 24 hours
ao dlq purge --older-than 24h

# Purge without confirmation
ao dlq purge --yes

# Show DLQ statistics
ao dlq stats

# JSON output
ao dlq list --json
ao dlq stats --json
```

## ao metadata verify

```
ao metadata verify
```

> "Verify YAML metadata file integrity"

Verifies the integrity of the sprint-status.yaml metadata file. Detects corruption and can report recovery status.

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |

### Output

The command verifies `_bmad-output/implementation-artifacts/sprint-status.yaml` and reports status with file path:

**Valid:**

```text
YAML Metadata Verification

  Status: ✓ Valid
  File: ./_bmad-output/implementation-artifacts/sprint-status.yaml
```

When the file was recovered from corruption (valid but previously damaged):

```text
YAML Metadata Verification

  Status: ✓ Valid
  ⚠ Recovered from corruption
  File: ./_bmad-output/implementation-artifacts/sprint-status.yaml
```

**Invalid:**

```text
YAML Metadata Verification

  Status: ✗ Invalid
  File: ./_bmad-output/implementation-artifacts/sprint-status.yaml
  Error: YAML parse error at line 42
```

### JSON Output

```json
{
  "valid": true,
  "recovered": false
}
```

When invalid:

```json
{
  "valid": false,
  "error": "YAML parse error at line 42"
}
```

### Requirements

- **Config**: `loadConfig()` — requires `agent-orchestrator.yaml`
- **StateManager**: Uses `createStateManager({ yamlPath })` then `stateManager.verify()`
- **Config error**: `` No config found. Run `ao init` first. ``
- **Exit code 1**: on config error, verification failure, or verify() exception

### Examples

```bash
# Verify metadata integrity
ao metadata verify

# JSON output
ao metadata verify --json
```

## ao retry

```
ao retry
```

> "Retry a failed operation by error ID (bypasses circuit breaker)"

Displays error details and retry eligibility for a specific error. Reads the filesystem directly — does not require a running application or config file.

### Flags

| Flag | Description |
|------|-------------|
| `--error-id <id>` | Error ID to retry |
| `--force` | Force retry even for non-retryable errors |

### Retryable Classification

Errors are classified as retryable or non-retryable:

**Non-retryable error types:**

- `AuthenticationError`
- `AuthorizationError`
- `ValidationError`
- `NotFoundError`
- `ConflictError`

Additional non-retryable conditions:
- `error.context?.nonRetryable === true`
- Message matches patterns: `/unauthorized/i`, `/forbidden/i`, `/not found/i`, `/invalid.*token/i`, `/authentication.*failed/i`, `/validation.*error/i`

### Output

When the error is retryable:

```text
Error Details:
────────────────────────────────────────────────────────────
Error ID:         err_1714012345 (yellow)
Timestamp:        4/24/2026, 10:30:00 AM (yellow)
Type:             RuntimeError (red)
Message:          connection refused (yellow)
Component:        session-mgr (yellow)
Story ID:         62-27-foo (yellow)
Agent ID:         agent-1 (yellow)
Correlation ID:   corr_abc123 (yellow)
Status:           Retryable (green)

Context: (yellow)
  sessionId: sess_123 (dim)

Stack Trace: (yellow)
  Error: connection refused (dim, first 5 lines)
  ...

⟳ Retry Information: (cyan)
  Error ID:         err_1714012345 (dim)
  Retry Status:     Eligible for retry (dim)
  Recommendation: (dim)
  This error can be retried. To retry the operation:
  1. Check if the original issue is resolved
  2. Re-run the operation that produced this error
  3. Verify the fix with your test suite

  Note: The error log contains the error details but not (yellow)
  the operation context. Automatic retry requires storing
  operation context with errors.
────────────────────────────────────────────────────────────
```

Timestamps use locale format via `toLocaleString()`. Stack traces are truncated to the first 5 lines with `...` appended if longer.

When the error is non-retryable:

```text
✗ Error is non-retryable
  This error type cannot be retried automatically. (dim)
  Use --force to attempt retry anyway. (dim)
```

With `--force`, non-retryable errors show a different message:

```text
  This error requires manual intervention: (dim)
  1. Fix the underlying issue (auth, validation, etc.) (dim)
  2. Re-run the operation after fixing (dim)

  Use --force to bypass this check if needed. (yellow)
```

Stack traces are truncated to the first 5 lines with `...` appended if longer.

### Requirements

- **No config required** — reads filesystem directly from error log directories
- **Error directories** searched in order: `.ao-error-logs`, `.error-logs`, `logs/errors`
- **Exit code 1**: missing `--error-id`, error file not found, parse failure, or non-retryable without `--force`

### Examples

```bash
# Check retry eligibility for an error
ao retry --error-id err_1714012345

# Force retry of a non-retryable error
ao retry --error-id err_1714012345 --force
```

## ao sync

```
ao sync [storyId]
```

> "Sync state with BMAD tracker"

Synchronizes local state with the BMAD tracker. Supports bidirectional sync, push, and pull modes.

### Flags

| Flag | Description |
|------|-------------|
| `--to-bmad` | Push local state to BMAD |
| `--from-bmad` | Pull state from BMAD |
| `--status` | Show sync status |

### Sync Modes

Without flags, performs a bidirectional sync. Use flags to restrict direction:

```bash
# Bidirectional sync (default)
ao sync

# Push local state to BMAD
ao sync --to-bmad

# Pull state from BMAD
ao sync --from-bmad

# Sync a single story
ao sync 62-27-foo

# Show sync status
ao sync --status
```

### ora Spinner

All sync operations use an ora spinner:

- `Syncing <storyId> to BMAD...` — single story push
- `Syncing all stories to BMAD...` — push all
- `Syncing from BMAD...` — pull all
- `Syncing <storyId> with BMAD...` — single story bidirectional
- `Syncing with BMAD...` — bidirectional all

Spinner outcomes: `.succeed()`, `.fail()`, `.warn()`.

### Conflict Resolution

During bidirectional sync, conflicts are resolved automatically and reported:

```text
  Conflicts Resolved:
    62-27-foo: local won (status)
```

The spinner warns when conflicts occur:

```text
⚠ Synced 48 stories (2 conflicts resolved)
```

Failed syncs are reported separately:

```text
  Failed Syncs:
    62-30-bar: tracker unavailable
```

### Sync Status

With `--status`, displays current sync information:

```text
  Sync Status:
  Last Sync: 2026-04-24T10:30:00.000Z (or "Never" in yellow)
  Queue Size: 3
  Failed: 1
  BMAD Connected: Yes (green) / No (red)
```

In degraded mode:

```text
  ⚠ Degraded Mode: Active
```

### Performance Warning

When bidirectional sync of all stories exceeds 1000ms:

```text
Warning: Sync took 1523ms (>1000ms target for 100 stories)
```

### Requirements

- **Config**: `loadConfig()` — requires `agent-orchestrator.yaml`
- **BMAD tracker**: Uses `createFileSystemBMADTracker()` (local file-system tracker, name: `"file-system"`)
- **StateManager**: Uses `createStateManager({ yamlPath })` then `stateManager.initialize()` before operations
- **Config error**: `No agent-orchestrator.yaml found. Run 'ao init' first.` (different from most commands — uses single quotes)
- **Story not found**: `Story "<storyId>" not found in sprint-status.yaml`
- **Exit code 1**: on config error or story not found
- **Resource cleanup**: `stateManager.close()` and `syncService.close()` called in `finally` block

### Examples

```bash
# Bidirectional sync all stories
ao sync

# Sync a single story
ao sync 62-27-foo

# Push local state to BMAD
ao sync --to-bmad

# Pull state from BMAD
ao sync --from-bmad

# Check sync status
ao sync --status
```

## Commands Documented Elsewhere

The following infrastructure-related commands are documented on other CLI Reference pages:

| Command | Page | Notes |
|---------|------|-------|
| `ao plugins` | [Setup Commands](setup-commands.md) | List installed plugins with `--json` |
| `ao plugin install` | [Setup Commands](setup-commands.md) | Install from npm or local path |
| `ao plugin uninstall` | [Setup Commands](setup-commands.md) | Uninstall a plugin |
| `ao plugin update` | [Setup Commands](setup-commands.md) | Update to specific version |
| `ao plugin search` | [Setup Commands](setup-commands.md) | Search npm for plugins |
| `ao plugin info` | [Setup Commands](setup-commands.md) | Show plugin details |
| `ao plugin disable` | [Setup Commands](setup-commands.md) | Disable without uninstalling |
| `ao plugin enable` | [Setup Commands](setup-commands.md) | Re-enable a disabled plugin |
| `ao plugin validate` | [Setup Commands](setup-commands.md) | Validate plugin structure |
| `ao plugin publish` | [Setup Commands](setup-commands.md) | Publish to npm registry |
| `ao events query` | [Monitoring Commands](monitoring.md) | Query event audit trail |
| `ao events drain` | [Monitoring Commands](monitoring.md) | Drain queued events |
| `ao events status` | [Monitoring Commands](monitoring.md) | Show event queue status |

## Tracker Requirements

{: .highlight }
**Tracker-dependent commands:**
- `ao health` — requires bmad tracker (`getTracker()`, checks `trackerPlugin.name === "bmad"`)
- `ao sync` — uses file-system BMAD tracker (`createFileSystemBMADTracker()`, name: `"file-system"`)

**Config-free commands** (read filesystem directly):
- `ao errors` — reads `.ao-error-logs/` directory
- `ao retry` — reads `.ao-error-logs/` directory

## Cross-Cutting Patterns

### Config Error Strings

Most commands use `loadConfig()` and display the same error:

```text
No config found. Run `ao init` first.
```

**Exceptions:**

| Command | Config Error |
|---------|-------------|
| `ao sync` | `No agent-orchestrator.yaml found. Run 'ao init' first.` (single quotes, different message) |
| `ao errors` | No config error — reads filesystem directly |
| `ao retry` | No config error — reads filesystem directly |

### ora Spinners

Only `ao sync` uses ora spinners. All other infrastructure commands produce immediate output.

### Interactive Prompts

Two commands use `@inquirer/prompts` confirmations:

| Command | Prompt | Default |
|---------|--------|---------|
| `ao dlq replay-all` | `Replay <N> supported operations?` | `false` |
| `ao dlq purge` | `Continue with purge?` | `false` |

Use `--force` / `--yes` to skip prompts respectively.

### Exit Codes for Scripting

- **0** — success (or watch mode shutdown)
- **1** — failure (config error, component unhealthy, error not found, non-retryable without `--force`)

## Next Steps

- [Setup Commands](setup-commands.md) — `ao init`, `ao start/stop`, `ao plugins` management
- [Session Commands](session-commands.md) — `ao session`, `ao assign`, `ao complete`
- [Sprint Commands](sprint-commands.md) — `ao sprint`, `ao simulate`
- [Story Commands](story-commands.md) — `ao story`, `ao next`
- [Monitoring Commands](monitoring.md) — `ao status`, `ao fleet`, `ao logs`, `ao events`
- [Review & PR Commands](review-pr.md) — `ao review-check`, `ao conflicts`, `ao resolve`
- [Intelligence Commands](intelligence.md) — `ao retro`, `ao history`, `ao monte-carlo`
- [CLI Reference](index.md) — command index and overview
- [Getting Started](../getting-started/) — installation and quick start
- [Configuration](../getting-started/configuration.md) — `agent-orchestrator.yaml` reference
