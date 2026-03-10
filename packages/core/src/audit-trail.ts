/**
 * Audit Trail Service
 *
 * Append-only JSONL logging for all EventBus events with SHA-256 integrity,
 * automatic rotation, crash recovery, and query capabilities.
 */

import type {
  AuditTrail,
  AuditEvent,
  QueryParams,
  ExportParams,
  ReplayHandler,
  AuditTrailStats,
  EventBus,
  EventBusEvent,
  ConflictHistoryParams as _ConflictHistoryParams,
  ConflictHistoryEntry as _ConflictHistoryEntry,
} from "./types.js";
import { createHash } from "node:crypto";
import { appendFile, stat, writeFile } from "node:fs/promises";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { createInterface } from "node:readline";

/** Default maximum file size before rotation (10MB) */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Default maximum active events to keep in file */
const DEFAULT_MAX_ACTIVE_EVENTS = 10000;

/** Default buffer size for degraded mode */
const DEFAULT_BUFFER_SIZE = 1000;

/** Default recovery retry interval (30 seconds) */
const DEFAULT_RETRY_INTERVAL_MS = 30000;

export interface AuditTrailConfig {
  eventBus: EventBus;
  logPath?: string; // Default: events.jsonl
  archivePath?: string; // Default: events.jsonl.archive
  maxFileSize?: number; // Default: 10MB
  maxActiveEvents?: number; // Default: 10,000
  bufferSize?: number; // Default: 1000 (for degraded mode)
  retryIntervalMs?: number; // Default: 30000
}

/**
 * Audit Trail Implementation
 */
export class AuditTrailImpl implements AuditTrail {
  private config: AuditTrailConfig;
  private eventBuffer: AuditEvent[] = [];
  private isDegraded = false;
  private unsubscribe?: () => void;
  private recoveryTimer?: NodeJS.Timeout;
  private initPromise: Promise<void>;

  constructor(config: AuditTrailConfig) {
    this.config = config;
    this.initPromise = this.initialize();
  }

  /**
   * Initialize audit trail by subscribing to all EventBus events
   */
  private async initialize(): Promise<void> {
    this.unsubscribe = await this.config.eventBus.subscribe(this.handleEvent.bind(this));
  }

  /**
   * Wait for initialization to complete before processing events
   * @internal
   */
  async ready(): Promise<void> {
    await this.initPromise;
  }

  /**
   * Handle incoming event from EventBus
   * @param event - Event from EventBus
   */
  private async handleEvent(busEvent: EventBusEvent): Promise<void> {
    // Ensure initialization is complete before processing events
    await this.initPromise;

    const auditEvent: AuditEvent = {
      eventId: busEvent.eventId,
      eventType: busEvent.eventType,
      timestamp: busEvent.timestamp,
      metadata: busEvent.metadata,
      hash: this.computeHash(busEvent),
    };

    await this.log(auditEvent);
  }

  /**
   * Compute SHA-256 hash of event for integrity verification
   * @param event - Event to hash
   * @returns SHA-256 hash as hex string
   */
  private computeHash(event: EventBusEvent): string {
    const data = JSON.stringify(event);
    return createHash("sha256").update(data).digest("hex");
  }

  /**
   * Log an event to the audit trail
   * @param event - Event to log
   */
  async log(event: AuditEvent): Promise<void> {
    if (this.isDegraded) {
      this.bufferEvent(event);
      return;
    }

    await this.writeToFile(event);
  }

  /**
   * Buffer event in memory during degraded mode
   * @param event - Event to buffer
   */
  private bufferEvent(event: AuditEvent): void {
    this.eventBuffer.push(event);

    const maxSize = this.config.bufferSize ?? DEFAULT_BUFFER_SIZE;
    if (this.eventBuffer.length > maxSize) {
      this.eventBuffer.shift(); // Drop oldest
    }
  }

  /**
   * Write event to JSONL log file
   * @param event - Event to write
   */
  private async writeToFile(event: AuditEvent): Promise<void> {
    const logPath = this.config.logPath ?? "events.jsonl";
    const line = JSON.stringify(event) + "\n";

    try {
      await appendFile(logPath, line, "utf-8");

      // Check file size for rotation
      await this.checkRotation();
    } catch (err) {
      const error = err as NodeJS.ErrnoException;

      if (error.code === "EROFS" || error.code === "EACCES") {
        this.enterDegradedMode(
          `Cannot write to ${logPath} (${error.code === "EROFS" ? "read-only filesystem" : error.code})`,
        );
      } else {
        // eslint-disable-next-line no-console
        console.error("Failed to write to audit trail:", error);
        this.enterDegradedMode(`Failed to write: ${error.message}`);
      }

      // Buffer the event
      this.bufferEvent(event);
    }
  }

  /**
   * Check if log file needs rotation
   */
  private async checkRotation(): Promise<void> {
    const logPath = this.config.logPath ?? "events.jsonl";

    try {
      const stats = await stat(logPath);
      const maxSize = this.config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;

      if (stats.size > maxSize) {
        await this.rotateLogFile();
      }
    } catch {
      // File might not exist yet, ignore
    }
  }

  /**
   * Rotate log file - archive old events and keep recent ones
   */
  private async rotateLogFile(): Promise<void> {
    const logPath = this.config.logPath ?? "events.jsonl";
    const archivePath = this.config.archivePath ?? "events.jsonl.archive";
    const timestamp = new Date().toISOString().split("T")[0];
    const archiveFile = `${archivePath}.${timestamp}`;

    // Read current events
    const events: AuditEvent[] = [];

    try {
      const fileStream = createReadStream(logPath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        try {
          events.push(JSON.parse(line));
        } catch {
          // eslint-disable-next-line no-console
          console.error("Failed to parse event line during rotation");
        }
      }

      // Keep most recent events in active file
      const maxActive = this.config.maxActiveEvents ?? DEFAULT_MAX_ACTIVE_EVENTS;
      const activeEvents = events.slice(-maxActive);
      const archiveEvents = events.slice(0, -maxActive);

      // Write archive
      if (archiveEvents.length > 0) {
        const archiveContent = archiveEvents.map((e) => JSON.stringify(e)).join("\n") + "\n";

        await writeFile(archiveFile, archiveContent, "utf-8");

        // Update archive index
        await this.updateArchiveIndex(archiveFile, archiveEvents.length);
      }

      // Rewrite active file with recent events
      const activeContent = activeEvents.map((e) => JSON.stringify(e)).join("\n") + "\n";

      await writeFile(logPath, activeContent, "utf-8");

      // eslint-disable-next-line no-console
      console.info(
        `Rotated audit log: ${archiveEvents.length} archived, ${activeEvents.length} active`,
      );
    } catch {
      // eslint-disable-next-line no-console
      console.error("Failed to rotate log file");
    }
  }

  /**
   * Update archive index with new archive entry
   * @param archiveFile - Archive file path
   * @param eventCount - Number of events in archive
   */
  private async updateArchiveIndex(archiveFile: string, eventCount: number): Promise<void> {
    const indexPath = `${this.config.archivePath ?? "events.jsonl.archive"}.index`;
    const indexEntry = `${archiveFile}\t${eventCount}\t${new Date().toISOString()}\n`;

    try {
      // Check if this archive file is already in the index to prevent duplicates
      let existingContent = "";
      try {
        existingContent = readFileSync(indexPath, "utf-8");
      } catch {
        // File doesn't exist yet, that's fine
      }

      if (existingContent.includes(`${archiveFile}\t`)) {
        // Archive already indexed, skip duplicate entry
        return;
      }

      await appendFile(indexPath, indexEntry, "utf-8");
    } catch {
      // eslint-disable-next-line no-console
      console.error("Failed to update archive index");
    }
  }

  /**
   * Query events with filters
   * @param params - Query parameters
   * @returns Filtered events
   */
  query(params: QueryParams): AuditEvent[] {
    const results: AuditEvent[] = [];

    // Query active file
    const activeEvents = this.queryFile(this.config.logPath ?? "events.jsonl", params);
    results.push(...activeEvents);

    // Optionally include archived files
    if (params.includeArchived) {
      const archivedEvents = this.queryArchives(params);
      results.push(...archivedEvents);
    }

    // Apply limit filters
    let filtered = results;

    if (params.last) {
      filtered = filtered.slice(-params.last);
    }

    if (params.first) {
      filtered = filtered.slice(0, params.first);
    }

    return filtered;
  }

  /**
   * Query conflict history with time-range filtering
   * @param params - Query parameters for conflicts
   * @returns Conflict history entries
   */
  queryConflicts(params: _ConflictHistoryParams = {}): _ConflictHistoryEntry[] {
    const results: _ConflictHistoryEntry[] = [];

    // Build query params for conflict events
    const queryParams: QueryParams = {
      eventType: ["conflict.detected", "conflict.resolved"],
      since: params.since,
      until: params.until,
      includeArchived: params.includeArchived,
    };

    // Query all conflict-related events
    const events = this.query(queryParams);

    // Group events by conflict ID
    const conflictGroups = new Map<string, { detected?: AuditEvent; resolved?: AuditEvent }>();

    for (const event of events) {
      const conflictId = event.metadata?.conflictId as string | undefined;
      if (!conflictId) continue;

      const group = conflictGroups.get(conflictId) || {};
      if (event.eventType === "conflict.detected") {
        group.detected = event;
      } else if (event.eventType === "conflict.resolved") {
        group.resolved = event;
      }
      conflictGroups.set(conflictId, group);
    }

    // Convert groups to entries
    for (const [conflictId, group] of conflictGroups.entries()) {
      const detectedEvent = group.detected;
      if (!detectedEvent) continue;

      const entry: _ConflictHistoryEntry = {
        event: detectedEvent,
        conflictId,
        storyId: (detectedEvent.metadata?.storyId as string) || "",
        conflictingAgents: (detectedEvent.metadata?.conflictingAgents as string[]) || [],
      };

      // Add resolution info if available
      if (group.resolved) {
        entry.resolution = {
          winner: (group.resolved.metadata?.winner as string) || "",
          strategy: (group.resolved.metadata?.strategy as string) || "",
          timestamp: group.resolved.timestamp,
        };
      }

      // Filter by storyId if specified
      if (params.storyId && entry.storyId !== params.storyId) {
        continue;
      }

      // Filter by agentIds if specified
      if (params.agentIds && params.agentIds.length > 0) {
        const hasAgent = params.agentIds.some((agentId) =>
          entry.conflictingAgents.includes(agentId),
        );
        if (!hasAgent) {
          continue;
        }
      }

      results.push(entry);
    }

    // Sort by timestamp (most recent first)
    results.sort(
      (a, b) => new Date(b.event.timestamp).getTime() - new Date(a.event.timestamp).getTime(),
    );

    // Apply limit
    if (params.limit && results.length > params.limit) {
      return results.slice(0, params.limit);
    }

    return results;
  }

  /**
   * Query events from a single file
   * @param filePath - Path to JSONL file
   * @param params - Query parameters
   * @returns Filtered events
   */
  private queryFile(filePath: string, params: QueryParams): AuditEvent[] {
    const results: AuditEvent[] = [];

    try {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());

      for (const line of lines) {
        try {
          const event: AuditEvent = JSON.parse(line);

          if (this.matchesQuery(event, params)) {
            results.push(event);
          }
        } catch {
          // Skip invalid lines
        }
      }
    } catch {
      // File might not exist
    }

    return results;
  }

  /**
   * Query archived files
   * @param params - Query parameters
   * @returns Filtered events from archives
   */
  private queryArchives(params: QueryParams): AuditEvent[] {
    const results: AuditEvent[] = [];

    try {
      const indexPath = `${this.config.archivePath ?? "events.jsonl.archive"}.index`;
      const indexContent = readFileSync(indexPath, "utf-8");
      const lines = indexContent.split("\n").filter((l) => l.trim());

      for (const line of lines) {
        const parts = line.split("\t");
        if (parts.length >= 1) {
          const archiveFile = parts[0];
          const archiveEvents = this.queryFile(archiveFile, params);
          results.push(...archiveEvents);
        }
      }
    } catch {
      // Index might not exist
    }

    return results;
  }

  /**
   * Check if event matches query parameters
   * @param event - Event to check
   * @param params - Query parameters
   * @returns true if event matches
   */
  private matchesQuery(event: AuditEvent, params: QueryParams): boolean {
    // Filter by event type
    if (params.eventType) {
      const types = Array.isArray(params.eventType) ? params.eventType : [params.eventType];
      if (!types.includes(event.eventType)) {
        return false;
      }
    }

    // Filter by time range
    if (params.since) {
      const since = new Date(params.since);
      const eventTime = new Date(event.timestamp);
      if (eventTime < since) {
        return false;
      }
    }

    if (params.until) {
      const until = new Date(params.until);
      const eventTime = new Date(event.timestamp);
      if (eventTime > until) {
        return false;
      }
    }

    // Grep pattern
    if (params.grep) {
      const eventStr = JSON.stringify(event);
      if (!eventStr.includes(params.grep)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Export events to file
   * @param path - Export file path
   * @param params - Export parameters
   */
  async export(path: string, params?: ExportParams): Promise<void> {
    const allEvents: AuditEvent[] = [];

    // Add active events
    const activeEvents = this.queryFile(this.config.logPath ?? "events.jsonl", {});
    allEvents.push(...activeEvents);

    // Add archived events if requested
    if (params?.includeArchived) {
      const archivedEvents = this.queryArchives({});
      allEvents.push(...archivedEvents);
    }

    // Validate hashes if requested
    if (params?.validateHashes) {
      for (const event of allEvents) {
        const recomputed = this.computeHash({
          eventId: event.eventId,
          eventType: event.eventType,
          timestamp: event.timestamp,
          metadata: event.metadata,
        });

        if (recomputed !== event.hash) {
          // eslint-disable-next-line no-console
          console.warn(`Hash mismatch for event ${event.eventId} during export`);
        }
      }
    }

    // Write export
    const format = params?.format ?? "jsonl";
    const content =
      format === "json"
        ? JSON.stringify(allEvents, null, 2)
        : allEvents.map((e) => JSON.stringify(e)).join("\n") + "\n";

    await writeFile(path, content, "utf-8");
  }

  /**
   * Replay events for state recovery
   * @param handler - Handler for each replayed event
   */
  async replay(handler: ReplayHandler): Promise<void> {
    const logPath = this.config.logPath ?? "events.jsonl";

    try {
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
            // eslint-disable-next-line no-console
            console.error(
              `Hash mismatch for event ${event.eventId}, skipping (corrupted data detected - NFR-R10)`,
            );
            continue;
          }

          await handler(event);
        } catch {
          // eslint-disable-next-line no-console
          console.error("Failed to replay event");
        }
      }
    } catch {
      // eslint-disable-next-line no-console
      console.error("Failed to read audit log for replay");
    }
  }

  /**
   * Get audit trail statistics
   * @returns Statistics
   */
  getStats(): AuditTrailStats {
    let activeEvents = 0;
    let archivedEvents = 0;
    let fileSize = 0;
    let oldestEvent: string | undefined;
    let newestEvent: string | undefined;

    try {
      const logPath = this.config.logPath ?? "events.jsonl";
      const stats = statSync(logPath);
      fileSize = stats.size;

      const content = readFileSync(logPath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());
      activeEvents = lines.length;

      if (lines.length > 0) {
        const first = JSON.parse(lines[0]);
        const last = JSON.parse(lines[lines.length - 1]);
        oldestEvent = first.timestamp;
        newestEvent = last.timestamp;
      }
    } catch {
      // File might not exist
    }

    // Count archived events from index
    try {
      const indexPath = `${this.config.archivePath ?? "events.jsonl.archive"}.index`;
      const indexContent = readFileSync(indexPath, "utf-8");
      const lines = indexContent.split("\n").filter((l) => l.trim());

      for (const line of lines) {
        const parts = line.split("\t");
        if (parts.length >= 2) {
          archivedEvents += parseInt(parts[1], 10);
        }
      }
    } catch {
      // Index might not exist
    }

    const totalEvents = activeEvents + archivedEvents;

    return {
      totalEvents,
      activeEvents,
      archivedEvents,
      fileSize,
      oldestEvent,
      newestEvent,
    };
  }

  /**
   * Enter degraded mode when writes fail
   * @param reason - Reason for degraded mode
   */
  private enterDegradedMode(reason: string): void {
    if (!this.isDegraded) {
      // eslint-disable-next-line no-console
      console.warn(`Audit trail entering degraded mode: ${reason}`);
      this.isDegraded = true;

      // Retry writes periodically
      const retryInterval = this.config.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS;

      this.recoveryTimer = setInterval(async () => {
        if (this.isDegraded) {
          try {
            // Test write
            const testPath = this.config.logPath ?? "events.jsonl";
            await appendFile(testPath, "", "utf-8");

            // Success - exit degraded mode and clear timer
            this.isDegraded = false;
            // eslint-disable-next-line no-console
            console.info("Audit trail recovered, flushing buffered events");

            // Clear the recovery timer to prevent memory leak
            if (this.recoveryTimer) {
              clearInterval(this.recoveryTimer);
              this.recoveryTimer = undefined;
            }

            // Flush buffered events
            const buffered = [...this.eventBuffer];
            this.eventBuffer = [];

            for (const event of buffered) {
              await this.writeToFile(event);
            }
          } catch {
            // Still degraded
          }
        }
      }, retryInterval);
    }
  }

  /**
   * Close audit trail and cleanup resources
   */
  async close(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
    }

    // Flush any buffered events
    if (this.eventBuffer.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`Flushing ${this.eventBuffer.length} buffered events during close`);

      const buffered = [...this.eventBuffer];
      this.eventBuffer = [];

      // Try to flush, but don't fail if we can't
      for (const event of buffered) {
        try {
          await this.writeToFile(event);
        } catch {
          // eslint-disable-next-line no-console
          console.error("Failed to flush buffered event");
        }
      }
    }
  }
}

/**
 * Factory function to create an AuditTrail instance
 * @param config - Configuration for the audit trail
 * @returns Configured AuditTrail instance
 */
export async function createAuditTrail(config: AuditTrailConfig): Promise<AuditTrail> {
  const impl = new AuditTrailImpl(config);
  await impl.ready();
  return impl;
}
