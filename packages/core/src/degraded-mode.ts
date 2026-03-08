/**
 * Degraded Mode Service
 *
 * Monitors service availability and manages graceful degradation when
 * Event Bus or BMAD Tracker become unavailable.
 *
 * Features:
 * - Service availability tracking with health checks
 * - Automatic degraded mode entry/exit
 * - Event queue fallback (in-memory + file backup)
 * - Sync operation queue for BMAD unavailability
 * - Recovery with automatic event draining
 */

import { appendFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// =============================================================================
// Types
// =============================================================================

/**
 * Degraded mode states based on which services are unavailable
 */
export type DegradedModeState =
  | "normal"
  | "event-bus-unavailable"
  | "bmad-unavailable"
  | "multiple-services-unavailable";

/**
 * Service types that can be monitored
 */
export type MonitoredService = "event-bus" | "bmad-tracker";

/**
 * Service availability status
 */
export interface ServiceAvailability {
  service: MonitoredService;
  available: boolean;
  lastCheck: Date;
  lastError?: string;
}

/**
 * Queued operation for later execution
 */
export interface QueuedOperation {
  id: string;
  timestamp: Date;
  service: MonitoredService;
  operation: string;
  data: unknown;
}

/**
 * Degraded mode status summary
 */
export interface DegradedModeStatus {
  mode: DegradedModeState;
  services: Record<MonitoredService, ServiceAvailability>;
  queuedEvents: number;
  queuedSyncs: number;
  localStateOperational: boolean;
  enteredAt?: Date;
}

/**
 * Configuration for degraded mode service
 */
export interface DegradedModeConfig {
  /** Path to events backup JSONL file */
  eventsBackupPath: string;
  /** Path to sync operations backup JSONL file */
  syncBackupPath: string;
  /** Maximum queue sizes */
  maxEventQueueSize?: number;
  maxSyncQueueSize?: number;
  /** Health check interval (ms) */
  healthCheckIntervalMs?: number;
  /** Recovery timeout (ms) */
  recoveryTimeoutMs?: number;
}

/**
 * Health check function for a service
 */
export type HealthCheckFn = () => Promise<boolean>;

/**
 * Recovery callback function type - called when services recover
 */
export type RecoveryCallback = (
  eventBusAvailable: boolean,
  bmadAvailable: boolean,
) => void | Promise<void>;

/**
 * Service health check configuration
 */
export interface ServiceHealthCheck {
  service: MonitoredService;
  check: HealthCheckFn;
}

// =============================================================================
// Implementation
// =============================================================================

const DEFAULT_MAX_EVENT_QUEUE = 1000;
const DEFAULT_MAX_SYNC_QUEUE = 500;
const DEFAULT_HEALTH_CHECK_INTERVAL = 5000; // 5 seconds
const DEFAULT_RECOVERY_TIMEOUT = 30000; // 30 seconds

export class DegradedModeServiceImpl {
  private config: DegradedModeConfig;
  private currentState: DegradedModeState = "normal";
  private serviceAvailability: Map<MonitoredService, ServiceAvailability> = new Map();
  private eventQueue: QueuedOperation[] = [];
  private syncQueue: QueuedOperation[] = [];
  private healthCheckInterval?: ReturnType<typeof setInterval>;
  private recoveryTimer?: ReturnType<typeof setTimeout>;
  private healthChecks: Map<MonitoredService, HealthCheckFn> = new Map();
  private enteredAt?: Date;
  private localStateOperational = true;
  private recoveryCallbacks: RecoveryCallback[] = [];

  constructor(config: DegradedModeConfig) {
    this.config = config;
  }

  /**
   * Register a health check function for a service
   */
  registerHealthCheck(service: MonitoredService, check: HealthCheckFn): void {
    this.healthChecks.set(service, check);
  }

  /**
   * Register a callback to be invoked when services recover
   * @param callback - Function to call on recovery (receives availability status)
   */
  onRecovery(callback: RecoveryCallback): void {
    this.recoveryCallbacks.push(callback);
  }

  /**
   * Manually trigger recovery callbacks (for use by CLI or manual operations)
   * This allows external triggering of recovery operations like event drain
   * @param eventBusAvailable - Whether event bus is currently available
   * @param bmadAvailable - Whether BMAD tracker is currently available
   */
  async triggerRecovery(eventBusAvailable: boolean, bmadAvailable: boolean): Promise<void> {
    // eslint-disable-next-line no-console
    console.log("[DegradedMode] Manually triggering recovery callbacks...");
    for (const callback of this.recoveryCallbacks) {
      try {
        await callback(eventBusAvailable, bmadAvailable);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[DegradedMode] Recovery callback error:", error);
      }
    }
  }

  /**
   * Start monitoring services with periodic health checks
   */
  async start(): Promise<void> {
    const interval = this.config.healthCheckIntervalMs ?? DEFAULT_HEALTH_CHECK_INTERVAL;

    // Initialize service availability
    for (const service of this.healthChecks.keys()) {
      await this.checkServiceHealth(service);
    }

    // Start periodic health checks
    this.healthCheckInterval = setInterval(async () => {
      for (const service of this.healthChecks.keys()) {
        await this.checkServiceHealth(service);
      }
      this.updateDegradedMode();
    }, interval);

    // Load queued operations from backup files
    await this.loadQueuedOperations();
  }

  /**
   * Stop monitoring and clean up resources
   */
  async stop(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }

    // Persist queued operations before stopping
    await this.persistQueuedOperations();
  }

  /**
   * Get current degraded mode status
   */
  getStatus(): DegradedModeStatus {
    const services: Record<MonitoredService, ServiceAvailability> = {} as Record<
      MonitoredService,
      ServiceAvailability
    >;

    for (const [service, availability] of this.serviceAvailability) {
      services[service] = availability;
    }

    return {
      mode: this.currentState,
      services,
      queuedEvents: this.eventQueue.length,
      queuedSyncs: this.syncQueue.length,
      localStateOperational: this.localStateOperational,
      enteredAt: this.enteredAt,
    };
  }

  /**
   * Queue an event for later processing when event bus is unavailable
   */
  async queueEvent(event: unknown): Promise<void> {
    const maxSize = this.config.maxEventQueueSize ?? DEFAULT_MAX_EVENT_QUEUE;

    // Drop oldest event if queue is full
    if (this.eventQueue.length >= maxSize) {
      this.eventQueue.shift();
    }

    const queuedOp: QueuedOperation = {
      id: randomUUID(),
      timestamp: new Date(),
      service: "event-bus",
      operation: "publish",
      data: event,
    };

    this.eventQueue.push(queuedOp);

    // Backup to file
    await this.appendOperationToBackup(this.config.eventsBackupPath, queuedOp);
  }

  /**
   * Queue a sync operation for later processing when BMAD is unavailable
   */
  async queueSyncOperation(operation: string, data: unknown): Promise<void> {
    const maxSize = this.config.maxSyncQueueSize ?? DEFAULT_MAX_SYNC_QUEUE;

    // Drop oldest sync if queue is full
    if (this.syncQueue.length >= maxSize) {
      this.syncQueue.shift();
    }

    const queuedOp: QueuedOperation = {
      id: randomUUID(),
      timestamp: new Date(),
      service: "bmad-tracker",
      operation,
      data,
    };

    this.syncQueue.push(queuedOp);

    // Backup to file
    await this.appendOperationToBackup(this.config.syncBackupPath, queuedOp);
  }

  /**
   * Check if we're currently in degraded mode
   */
  isDegraded(): boolean {
    return this.currentState !== "normal";
  }

  /**
   * Check if a specific service is available
   */
  isServiceAvailable(service: MonitoredService): boolean {
    const availability = this.serviceAvailability.get(service);
    return availability?.available ?? true; // Default to available
  }

  // ===========================================================================
  // Private methods
  // ===========================================================================

  /**
   * Check health of a single service
   */
  private async checkServiceHealth(service: MonitoredService): Promise<void> {
    const healthCheck = this.healthChecks.get(service);
    if (!healthCheck) {
      return; // No health check registered, assume available
    }

    const previousAvailability = this.serviceAvailability.get(service);
    const previousAvailable = previousAvailability?.available ?? true;

    try {
      const available = await healthCheck();

      this.serviceAvailability.set(service, {
        service,
        available,
        lastCheck: new Date(),
        lastError: available ? undefined : "Health check returned false",
      });

      // Log state transitions
      if (previousAvailable && !available) {
        // eslint-disable-next-line no-console
        console.warn(`[DegradedMode] Service ${service} became UNAVAILABLE`);
      } else if (!previousAvailable && available) {
        // eslint-disable-next-line no-console
        console.log(`[DegradedMode] Service ${service} is now AVAILABLE`);
      }
    } catch (error) {
      this.serviceAvailability.set(service, {
        service,
        available: false,
        lastCheck: new Date(),
        lastError: error instanceof Error ? error.message : String(error),
      });

      // eslint-disable-next-line no-console
      console.error(`[DegradedMode] Health check failed for ${service}:`, error);
    }
  }

  /**
   * Update degraded mode based on current service availability
   */
  private updateDegradedMode(): void {
    const eventBusAvailable = this.isServiceAvailable("event-bus");
    const bmadAvailable = this.isServiceAvailable("bmad-tracker");

    let newMode: DegradedModeState;

    if (!eventBusAvailable && !bmadAvailable) {
      newMode = "multiple-services-unavailable";
    } else if (!eventBusAvailable) {
      newMode = "event-bus-unavailable";
    } else if (!bmadAvailable) {
      newMode = "bmad-unavailable";
    } else {
      newMode = "normal";
    }

    // State transition handling
    if (newMode !== this.currentState) {
      this.handleStateTransition(newMode, eventBusAvailable, bmadAvailable);
    }

    this.currentState = newMode;
  }

  /**
   * Handle state transitions with recovery logic
   */
  private handleStateTransition(
    newMode: DegradedModeState,
    eventBusAvailable: boolean,
    bmadAvailable: boolean,
  ): void {
    const wasDegraded = this.currentState !== "normal";
    const isDegraded = newMode !== "normal";

    // Entering degraded mode
    if (!wasDegraded && isDegraded) {
      this.enteredAt = new Date();
      // eslint-disable-next-line no-console
      console.warn(`[DegradedMode] Entering degraded mode: ${newMode}`);
    }

    // Exiting degraded mode
    if (wasDegraded && !isDegraded) {
      // eslint-disable-next-line no-console
      console.log("[DegradedMode] Exiting degraded mode, starting recovery...");
      this.startRecovery(eventBusAvailable, bmadAvailable);
    }

    // Mode change within degraded states
    if (wasDegraded && isDegraded && newMode !== this.currentState) {
      // eslint-disable-next-line no-console
      console.log(`[DegradedMode] Degraded mode changed: ${this.currentState} → ${newMode}`);
    }
  }

  /**
   * Start recovery process to drain queued operations
   */
  private startRecovery(eventBusAvailable: boolean, bmadAvailable: boolean): void {
    const timeout = this.config.recoveryTimeoutMs ?? DEFAULT_RECOVERY_TIMEOUT;

    // Clear any existing recovery timer
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }

    // Call registered recovery callbacks (e.g., EventPublisher.flush())
    // eslint-disable-next-line no-console
    console.log("[DegradedMode] Triggering recovery callbacks...");
    for (const callback of this.recoveryCallbacks) {
      try {
        void callback(eventBusAvailable, bmadAvailable);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[DegradedMode] Recovery callback error:", error);
      }
    }

    const startTime = Date.now();

    const drainQueuedOperations = async (): Promise<void> => {
      // Note: Event bus and sync service flushing happens via their respective services
      // This method is called to trigger the draining process
      // The actual draining is done by:
      // - EventPublisher.flush() drains both its own queue AND degraded mode events
      // - SyncService (when implemented) drains sync operations

      // Signal that services should attempt recovery
      // Events will be drained on next EventPublisher.flush() call
      if (eventBusAvailable && this.eventQueue.length > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[DegradedMode] Event recovery in progress: ${this.eventQueue.length} queued events`,
        );
      }

      if (bmadAvailable && this.syncQueue.length > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[DegradedMode] Sync recovery in progress: ${this.syncQueue.length} queued operations`,
        );
      }

      const elapsed = Date.now() - startTime;
      if (elapsed < timeout) {
        // Check again if there are still queued items
        if (this.eventQueue.length > 0 || this.syncQueue.length > 0) {
          this.recoveryTimer = setTimeout(drainQueuedOperations, 1000);
        } else {
          // eslint-disable-next-line no-console
          console.log("[DegradedMode] Recovery complete, all queued operations drained");
          this.enteredAt = undefined;
        }
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[DegradedMode] Recovery timeout after ${timeout}ms, ${this.eventQueue.length} events and ${this.syncQueue.length} syncs remain queued`,
        );
      }
    };

    this.recoveryTimer = setTimeout(drainQueuedOperations, 100);
  }

  /**
   * Load queued operations from backup files on startup
   */
  private async loadQueuedOperations(): Promise<void> {
    // Load events
    if (existsSync(this.config.eventsBackupPath)) {
      try {
        const content = await readFile(this.config.eventsBackupPath, "utf-8");
        const lines = content.trim().split("\n");

        for (const line of lines) {
          if (!line) continue;
          try {
            const op = JSON.parse(line) as QueuedOperation;
            this.eventQueue.push(op);
          } catch {
            // Skip malformed lines
          }
        }

        // eslint-disable-next-line no-console
        console.log(`[DegradedMode] Loaded ${this.eventQueue.length} queued events from backup`);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[DegradedMode] Failed to load events backup:", error);
      }
    }

    // Load sync operations
    if (existsSync(this.config.syncBackupPath)) {
      try {
        const content = await readFile(this.config.syncBackupPath, "utf-8");
        const lines = content.trim().split("\n");

        for (const line of lines) {
          if (!line) continue;
          try {
            const op = JSON.parse(line) as QueuedOperation;
            this.syncQueue.push(op);
          } catch {
            // Skip malformed lines
          }
        }

        // eslint-disable-next-line no-console
        console.log(`[DegradedMode] Loaded ${this.syncQueue.length} queued syncs from backup`);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[DegradedMode] Failed to load syncs backup:", error);
      }
    }
  }

  /**
   * Persist queued operations to backup files
   */
  private async persistQueuedOperations(): Promise<void> {
    // Ensure backup directory exists
    const eventsDir = join(this.config.eventsBackupPath, "..");
    try {
      await mkdir(eventsDir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    const syncDir = join(this.config.syncBackupPath, "..");
    try {
      await mkdir(syncDir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    // Persist events
    if (this.eventQueue.length > 0) {
      const eventsContent = this.eventQueue.map((op) => JSON.stringify(op)).join("\n") + "\n";
      try {
        await writeFile(this.config.eventsBackupPath, eventsContent, "utf-8");
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[DegradedMode] Failed to persist events backup:", error);
      }
    }

    // Persist sync operations
    if (this.syncQueue.length > 0) {
      const syncContent = this.syncQueue.map((op) => JSON.stringify(op)).join("\n") + "\n";
      try {
        await writeFile(this.config.syncBackupPath, syncContent, "utf-8");
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[DegradedMode] Failed to persist syncs backup:", error);
      }
    }
  }

  /**
   * Append a single operation to backup file
   */
  private async appendOperationToBackup(
    backupPath: string,
    operation: QueuedOperation,
  ): Promise<void> {
    try {
      // Ensure directory exists
      const dir = join(backupPath, "..");
      await mkdir(dir, { recursive: true });

      const line = JSON.stringify(operation) + "\n";
      await appendFile(backupPath, line, "utf-8");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[DegradedMode] Failed to append to backup ${backupPath}:`, error);
    }
  }

  /**
   * Get queued events for draining (used by EventPublisher)
   */
  getQueuedEvents(): QueuedOperation[] {
    return [...this.eventQueue];
  }

  /**
   * Clear drained events (used by EventPublisher after successful flush)
   */
  clearDrainedEvents(count: number): void {
    this.eventQueue = this.eventQueue.slice(count);

    // Update backup file
    if (this.eventQueue.length === 0) {
      // Clear file if empty
      writeFile(this.config.eventsBackupPath, "", "utf-8").catch(() => {
        // Ignore errors
      });
    }
  }

  /**
   * Get queued sync operations for draining (used by SyncService)
   */
  getQueuedSyncs(): QueuedOperation[] {
    return [...this.syncQueue];
  }

  /**
   * Clear drained sync operations (used by SyncService after successful sync)
   */
  clearDrainedSyncs(count: number): void {
    this.syncQueue = this.syncQueue.slice(count);

    // Update backup file
    if (this.syncQueue.length === 0) {
      // Clear file if empty
      writeFile(this.config.syncBackupPath, "", "utf-8").catch(() => {
        // Ignore errors
      });
    }
  }

  /**
   * Set local state operational status
   */
  setLocalStateOperational(operational: boolean): void {
    this.localStateOperational = operational;
  }
}

/**
 * Factory function to create a DegradedModeService instance
 */
export function createDegradedModeService(config: DegradedModeConfig): DegradedModeServiceImpl {
  return new DegradedModeServiceImpl(config);
}

// Type export for consumers
export type DegradedModeService = DegradedModeServiceImpl;
