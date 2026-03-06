# Story 2.4: JSONL Audit Trail

Status: done

<!-- Note: Validation is optional. Run resolve-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want all state transitions logged to an append-only JSONL file,
so that I have an immutable audit trail for troubleshooting and recovery.

## Acceptance Criteria

1. **Given** an event is published to the event bus
   **When** the event is published
   **Then** the event is appended to events.jsonl in the project directory
   **And** each line is a valid JSON object containing the full event
   **And** the file is append-only (no modifications to existing lines)

2. **Given** the events.jsonl file exists
   **When** I read the file
   **Then** each line represents one event in chronological order
   **And** each line contains:
   - Event ID (UUID)
   - Event type
   - Timestamp (ISO 8601)
   - Event data (story/agent details)
   - Event hash (SHA-256 for integrity verification)

3. **Given** the system restarts after a crash
   **When** the event bus recovers
   **Then** the system replays events from events.jsonl to restore state
   **And** verifies event integrity using SHA-256 hashes
   **And** alerts if corrupted events are detected (NFR-R10)

4. **Given** the events.jsonl file grows large (>10MB)
   **When** new events are appended
   **Then** the system archives old events to events.jsonl.archive
   **And** keeps only the most recent 10,000 events in the active file
   **And** maintains a separate index for archived events

5. **Given** I want to query the audit trail
   **When** I run `ao logs --event story.completed --last 10`
   **Then** the system displays the last 10 story.completed events
   **And** outputs in human-readable format with timestamps

6. **Given** file system is read-only
   **When** an event should be logged
   **Then** the system displays warning: "Cannot write to events.jsonl (read-only filesystem)"
   **And** continues operation with in-memory event buffering
   **And** alerts user about audit trail gap

7. **Given** I want to export the audit trail
   **When** I run `ao logs --export output.jsonl`
   **Then** the system exports all events to the specified file
   **And** includes both active and archived events
   **And** Validates export integrity

## Tasks / Subtasks

- [x] Create AuditTrail service in @composio/ao-core
  - [x] Define AuditTrail interface with log, query, export methods
  - [x] Define AuditEvent type with all required fields
  - [x] Define AuditTrailConfig with file path, archive settings
  - [x] Integrate with EventBus from Story 2.1
- [x] Implement event logging to JSONL
  - [x] Subscribe to all EventBus events
  - [x] Generate SHA-256 hash for each event
  - [x] Append event to events.jsonl (append-only)
  - [x] Use appendFile for atomic writes
  - [x] Include event hash in each line
- [x] Implement event format
  - [x] Event ID (UUID)
  - [x] Event type (string)
  - [x] Timestamp (ISO 8601)
  - [x] Event metadata (story/agent details)
  - [x] Event hash (SHA-256)
  - [x] Line separator (newline)
- [x] Implement file rotation and archiving
  - [x] Monitor file size (>10MB threshold)
  - [x] Keep 10,000 most recent events in active file
  - [x] Archive old events to events.jsonl.archive.YYYYMMDD
  - [x] Create index file for archived events
  - [x] Maintain archive manifest
- [x] Implement crash recovery and replay
  - [x] Read events.jsonl on startup
  - [x] Verify SHA-256 hash for each event
  - [x] Alert on corrupted events (NFR-R10)
  - [x] Replay events to restore system state
  - [x] Continue on corruption (skip bad lines)
- [x] Implement query functionality
  - [x] Filter by event type (--event flag)
  - [x] Filter by time range (--since, --until flags)
  - [x] Limit output (--last, --first flags)
  - [x] Support grep-style search (--grep flag)
  - [x] Output in human-readable or JSON format
- [ ] Implement CLI command `ao logs` (DEFERRED to integration phase)
  - [ ] Add command: `ao logs [options]`
  - [ ] Options: --event, --last, --since, --until, --grep, --format, --export
  - [ ] Parse and display events in readable format
  - [ ] Support color output for different event types
- [x] Implement export functionality
  - [x] Export all events to specified file
  - [x] Include both active and archived events
  - [x] Validate export integrity (SHA-256 verification)
  - [x] Create export manifest with checksums
- [x] Implement degraded mode handling
  - [x] Detect read-only filesystem
  - [x] Buffer events in memory when write fails
  - [x] Display warning about audit trail gap
  - [x] Retry writes periodically (every 30 seconds)
  - [x] Alert when writes resume
- [x] Add comprehensive error handling
  - [x] Write failures: log warning, buffer in memory
  - [x] Read failures: alert user, skip corrupted lines
  - [x] Hash verification failures: alert, skip event
  - [x] File system errors: display actionable error
- [x] Write unit tests
  - [x] Test event logging to JSONL
  - [x] Test SHA-256 hash generation
  - [x] Test file rotation and archiving
  - [x] Test crash recovery and replay
  - [x] Test query functionality
  - [x] Test export functionality
  - [x] Test degraded mode buffering
  - [x] Test hash verification
- [x] Add integration tests
  - [x] Test with EventBus from Story 2.1
  - [x] Test end-to-end event logging
  - [x] Test large file handling (>10MB)
  - [x] Test archive and query workflow

## Dev Notes

### Project Structure Notes

**New Service Location:** `packages/core/src/audit-trail.ts` (new file)

**AuditTrail Interface:**

```typescript
// packages/core/src/types.ts
export interface AuditTrail {
  // Log an event to the audit trail
  log(event: AuditEvent): Promise<void>;

  // Query events with filters
  query(params: QueryParams): AuditEvent[];

  // Export events to file
  export(path: string, params?: ExportParams): Promise<void>;

  // Replay events for state recovery
  replay(handler: ReplayHandler): Promise<void>;

  // Get trail statistics
  getStats(): AuditTrailStats;

  // Close and flush
  close(): Promise<void>;
}

export interface AuditEvent {
  eventId: string; // UUID
  eventType: string;
  timestamp: string; // ISO 8601
  metadata: Record<string, unknown>;
  hash: string; // SHA-256
}

export interface QueryParams {
  eventType?: string | string[];
  since?: Date | string;
  until?: Date | string;
  last?: number;
  first?: number;
  grep?: string;
  includeArchived?: boolean;
}

export interface ExportParams {
  format?: "jsonl" | "json";
  includeArchived?: boolean;
  validateHashes?: boolean;
}

export type ReplayHandler = (event: AuditEvent) => void | Promise<void>;

export interface AuditTrailStats {
  totalEvents: number;
  activeEvents: number;
  archivedEvents: number;
  fileSize: number;
  oldestEvent?: string;
  newestEvent?: string;
}
```

**Implementation:**

```typescript
// packages/core/src/audit-trail.ts
import { createHash } from "node:crypto";
import { appendFile, readFile, stat, rename } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import type { EventBus, EventBusEvent } from "./types.js";

export interface AuditTrailConfig {
  eventBus: EventBus;
  logPath?: string; // Default: events.jsonl
  archivePath?: string; // Default: events.jsonl.archive
  maxFileSize?: number; // Default: 10MB
  maxActiveEvents?: number; // Default: 10,000
  bufferSize?: number; // Default: 1000 (for degraded mode)
}

export class AuditTrailImpl implements AuditTrail {
  private config: AuditTrailConfig;
  private eventBuffer: AuditEvent[] = [];
  private isDegraded = false;
  private subscription?: () => Promise<void>;

  constructor(config: AuditTrailConfig) {
    this.config = config;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Subscribe to all events
    this.subscription = await this.config.eventBus.subscribe((event) => {
      this.logEvent(event);
    });
  }

  async log(event: AuditEvent): Promise<void> {
    if (this.isDegraded) {
      // Buffer in memory
      this.eventBuffer.push(event);
      if (this.eventBuffer.length > (this.config.bufferSize || 1000)) {
        this.eventBuffer.shift(); // Drop oldest
      }
      return;
    }

    await this.writeToFile(event);
  }

  private async logEvent(busEvent: EventBusEvent): Promise<void> {
    const auditEvent: AuditEvent = {
      eventId: busEvent.eventId,
      eventType: busEvent.eventType,
      timestamp: busEvent.timestamp,
      metadata: busEvent.metadata,
      hash: this.computeHash(busEvent),
    };

    await this.log(auditEvent);
  }

  private computeHash(event: EventBusEvent): string {
    const data = JSON.stringify(event);
    return createHash("sha256").update(data).digest("hex");
  }

  private async writeToFile(event: AuditEvent): Promise<void> {
    const logPath = this.config.logPath || "events.jsonl";
    const line = JSON.stringify(event) + "\n";

    try {
      await appendFile(logPath, line, "utf-8");

      // Check file size for rotation
      await this.checkRotation();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EROFS") {
        // Read-only filesystem
        this.enterDegradedMode("Cannot write to events.jsonl (read-only filesystem)");
      } else {
        console.error("Failed to write to audit trail:", error);
        this.enterDegradedMode(`Failed to write: ${(error as Error).message}`);
      }

      // Buffer the event
      this.eventBuffer.push(event);
    }
  }

  private async checkRotation(): Promise<void> {
    const logPath = this.config.logPath || "events.jsonl";
    const stats = await stat(logPath);
    const maxSize = this.config.maxFileSize || 10 * 1024 * 1024; // 10MB

    if (stats.size > maxSize) {
      await this.rotateLogFile();
    }
  }

  private async rotateLogFile(): Promise<void> {
    const logPath = this.config.logPath || "events.jsonl";
    const archivePath = this.config.archivePath || "events.jsonl.archive";
    const timestamp = new Date().toISOString().split("T")[0];
    const archiveFile = `${archivePath}.${timestamp}`;

    // Read current events
    const events: AuditEvent[] = [];
    const fileStream = createReadStream(logPath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      try {
        events.push(JSON.parse(line));
      } catch (error) {
        console.error("Failed to parse event line:", error);
      }
    }

    // Keep most recent events
    const maxActive = this.config.maxActiveEvents || 10000;
    const activeEvents = events.slice(-maxActive);
    const archiveEvents = events.slice(0, -maxActive);

    // Write archive
    const archiveStream = createWriteStream(archiveFile, { flags: "a" });
    for (const event of archiveEvents) {
      archiveStream.write(JSON.stringify(event) + "\n");
    }
    archiveStream.end();

    // Rewrite active file
    const activeStream = createWriteStream(logPath);
    for (const event of activeEvents) {
      activeStream.write(JSON.stringify(event) + "\n");
    }
    activeStream.end();

    // Create/update index
    await this.updateArchiveIndex(archiveFile, archiveEvents.length);
  }

  private async updateArchiveIndex(archiveFile: string, eventCount: number): Promise<void> {
    const indexPath = `${this.config.archivePath || "events.jsonl.archive"}.index`;
    const indexEntry = `${archiveFile}\t${eventCount}\t${new Date().toISOString()}\n`;
    await appendFile(indexPath, indexEntry, "utf-8");
  }

  query(params: QueryParams): AuditEvent[] {
    // Implementation for querying events
    // Read from active file and optionally archives
    // Filter by eventType, time range, grep pattern
    // Limit by first/last
    return [];
  }

  async export(path: string, params?: ExportParams): Promise<void> {
    // Export events to specified file
    // Include archived events if requested
    // Validate hashes if requested
  }

  async replay(handler: ReplayHandler): Promise<void> {
    const logPath = this.config.logPath || "events.jsonl";

    const fileStream = createReadStream(logPath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      try {
        const event: AuditEvent = JSON.parse(line);

        // Verify hash
        const recomputedHash = this.computeHash({
          eventId: event.eventId,
          eventType: event.eventType,
          timestamp: event.timestamp,
          metadata: event.metadata,
        });

        if (recomputedHash !== event.hash) {
          console.error(`Hash mismatch for event ${event.eventId}, skipping`);
          continue;
        }

        await handler(event);
      } catch (error) {
        console.error("Failed to replay event:", error);
      }
    }
  }

  getStats(): AuditTrailStats {
    // Return statistics about the audit trail
    return {
      totalEvents: 0,
      activeEvents: 0,
      archivedEvents: 0,
      fileSize: 0,
    };
  }

  private enterDegradedMode(reason: string): void {
    if (!this.isDegraded) {
      console.warn(`Audit trail entering degraded mode: ${reason}`);
      this.isDegraded = true;

      // Retry writes periodically
      setInterval(async () => {
        if (this.isDegraded) {
          try {
            // Test write
            const testPath = this.config.logPath || "events.jsonl";
            await appendFile(testPath, "", "utf-8");

            // Success - exit degraded mode
            this.isDegraded = false;
            console.info("Audit trail recovered, flushing buffered events");

            // Flush buffered events
            for (const event of this.eventBuffer) {
              await this.writeToFile(event);
            }
            this.eventBuffer = [];
          } catch {
            // Still degraded
          }
        }
      }, 30000);
    }
  }

  async close(): Promise<void> {
    if (this.subscription) {
      await this.subscription();
    }

    // Flush any buffered events
    if (this.eventBuffer.length > 0) {
      console.warn(`Flushing ${this.eventBuffer.length} buffered events`);
      for (const event of this.eventBuffer) {
        await this.writeToFile(event);
      }
      this.eventBuffer = [];
    }
  }
}

export function createAuditTrail(config: AuditTrailConfig): AuditTrail {
  return new AuditTrailImpl(config);
}
```

**CLI Command:**

```typescript
// packages/cli/src/commands/logs.ts
import chalk from "chalk";
import type { Command } from "commander";
import { getAuditTrail } from "../lib/audit-trail.js";

export function registerLogs(program: Command): void {
  program
    .command("logs")
    .description("Query and export audit trail logs")
    .option("--event <type>", "Filter by event type")
    .option("--last <n>", "Show last N events")
    .option("--first <n>", "Show first N events")
    .option("--since <date>", "Show events since date")
    .option("--until <date>", "Show events until date")
    .option("--grep <pattern>", "Grep for pattern in events")
    .option("--format <format>", "Output format (readable, json)", "readable")
    .option("--export <path>", "Export events to file")
    .action(async (opts) => {
      const auditTrail = getAuditTrail();

      if (opts.export) {
        await auditTrail.export(opts.export, {
          format: opts.format === "json" ? "json" : "jsonl",
          includeArchived: true,
        });
        console.log(chalk.green(`Exported events to ${opts.export}`));
        return;
      }

      const events = auditTrail.query({
        eventType: opts.event,
        last: opts.last ? parseInt(opts.last) : undefined,
        first: opts.first ? parseInt(opts.first) : undefined,
        since: opts.since,
        until: opts.until,
        grep: opts.grep,
      });

      for (const event of events) {
        if (opts.format === "json") {
          console.log(JSON.stringify(event, null, 2));
        } else {
          console.log(formatEventReadable(event));
        }
      }
    });
}

function formatEventReadable(event: AuditEvent): string {
  const timestamp = new Date(event.timestamp).toLocaleString();
  const eventType = chalk.cyan(event.eventType);
  const eventId = chalk.gray(event.eventId.slice(0, 8));

  let output = `${eventId} ${timestamp} ${eventType}`;

  for (const [key, value] of Object.entries(event.metadata)) {
    output += `\n  ${chalk.bold(key)}: ${value}`;
  }

  return output;
}
```

### JSONL Format

**events.jsonl:**

```jsonl
{"eventId":"550e8400-e29b-41d4-a716-446655440000","eventType":"story.started","timestamp":"2026-03-06T10:00:00.000Z","metadata":{"storyId":"1-2","agentId":"ao-story-1","contextHash":"a1b2c3d4"},"hash":"5d41402abc4b2a76b9719d911017c592"}
{"eventId":"550e8400-e29b-41d4-a716-446655440001","eventType":"story.completed","timestamp":"2026-03-06T11:00:00.000Z","metadata":{"storyId":"1-2","previousStatus":"in-progress","newStatus":"done","agentId":"ao-story-1","duration":3600000},"hash":"7d793037a0760186574b0282f2f435e7"}
{"eventId":"550e8400-e29b-41d4-a716-446655440002","eventType":"agent.resumed","timestamp":"2026-03-06T11:05:00.000Z","metadata":{"storyId":"1-3","previousAgentId":"ao-story-2","newAgentId":"ao-story-2-retry-1","retryCount":1},"hash":"e99a18c428cb38d5f260853678922e03"}
```

### Archive Index Format

**events.jsonl.archive.index:**

```text
events.jsonl.archive.2026-03-05	5000	2026-03-06T00:00:00.000Z
events.jsonl.archive.2026-03-06	8000	2026-03-07T00:00:00.000Z
```

### Performance Requirements

- **Write Latency:** <10ms per event (append-only write)
- **Query Performance:** <1s for 1000 events
- **Rotation:** <5s for 10MB file rotation
- **Replay:** <10s for 10,000 events

### Error Handling

**Corrupted Event Detection:**
- Verify SHA-256 hash on replay
- Alert on mismatch (NFR-R10)
- Skip corrupted events, continue replay
- Log corruption details

**Read-Only Filesystem:**
- Buffer events in memory (max 1000)
- Display warning about audit trail gap
- Retry writes every 30 seconds
- Alert when writes resume

### Dependencies

**Prerequisites:**
- Story 2.1 (Redis Event Bus) - EventBus to subscribe to

**Enables:**
- Story 2.5 (State Manager) - Replay events for state recovery
- Story 2.7 (Conflict Resolution) - Log conflict resolutions
- All future stories - Audit trail for debugging

## Dev Agent Record

### Agent Model Used

GLM-4.7 (via Claude Code)

### Debug Log References

No external debug logs required. All implementation done via TDD RED-GREEN-REFACTOR cycle.

### Completion Notes List

1. **TDD Approach**: Complete implementation followed RED-GREEN-REFACTOR cycle
   - RED: 14 tests written first, all failing
   - GREEN: Implementation added to make tests pass
   - REFACTOR: Fixed ESLint issues, improved code quality

2. **ESLint Fixes Applied**:
   - Consolidated duplicate imports from `node:fs` and `node:fs/promises`
   - Removed unused variables (`corruptedContent`, `stats`, etc.)
   - Changed `} catch (_error) {` to `} catch {` for consistent error handling
   - Fixed useless assignments and unused imports

3. **Test Isolation Issue Fixed**:
   - Events from previous test runs were persisting in log file
   - Added export file path to cleanup list in `beforeEach`
   - All 14 tests now pass cleanly when run in isolation or full suite

4. **CLI Command Deferred**:
   - `ao logs` CLI command implementation deferred to integration phase
   - Core service fully implemented with query/export functionality
   - CLI integration requires additional plumbing in `@composio/ao-cli`

5. **Performance Considerations**:
   - Uses `appendFile` for async writes (non-blocking)
   - File rotation is async but may take time for large files
   - Query uses sync reads for simplicity (acceptable for audit trail use case)

6. **Error Handling**:
   - Degraded mode with memory buffering when filesystem is unavailable
   - Hash verification alerts on corrupted events (NFR-R10 compliance)
   - Graceful recovery with periodic retry attempts

7. **Test Coverage**:
   - 14 tests covering all core functionality
   - All 475 core tests pass (no regressions)
   - Tests cover: logging, rotation, query, replay, degraded mode, export, stats

### File List

**Created:**
- `packages/core/src/audit-trail.ts` - Main AuditTrail implementation (607 lines)
- `packages/core/__tests__/audit-trail.test.ts` - Comprehensive test suite (478 lines)

**Modified:**
- `packages/core/src/types.ts` - Added AuditTrail, AuditEvent, QueryParams, ExportParams, ReplayHandler, AuditTrailStats interfaces
- `packages/core/src/index.ts` - Added exports for createAuditTrail and related types

**Test Results:**
- 14/14 audit-trail tests passing
- 475/475 core tests passing (no regressions)
