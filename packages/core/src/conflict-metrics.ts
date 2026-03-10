/**
 * Conflict Metrics Service
 *
 * Tracks conflict prevention, auto-resolution, and manual resolution metrics.
 * Provides insights into the effectiveness of conflict management.
 *
 * Features:
 * - Track conflicts prevented proactively
 * - Track auto-resolutions by the system
 * - Track manual resolutions by humans
 * - Calculate resolution efficiency metrics
 * - Export metrics for dashboards
 */

import { createHash } from "node:crypto";
import type { AuditTrail, AuditEvent } from "./types.js";

/**
 * Conflict resolution type
 */
export type ConflictResolutionType = "prevented" | "auto_resolved" | "manual_resolved";

/**
 * Conflict metrics summary
 */
export interface ConflictMetricsSummary {
  /** Period start date */
  periodStart: Date;
  /** Period end date */
  periodEnd: Date;
  /** Total conflicts detected */
  totalDetected: number;
  /** Conflicts prevented proactively */
  prevented: number;
  /** Conflicts auto-resolved by system */
  autoResolved: number;
  /** Conflicts manually resolved by humans */
  manualResolved: number;
  /** Conflicts still pending */
  pending: number;
  /** Prevention rate (prevented / total detected) */
  preventionRate: number;
  /** Auto-resolution rate (auto / (auto + manual)) */
  autoResolutionRate: number;
  /** Average time to resolution (ms) */
  avgResolutionTimeMs: number;
  /** Breakdown by severity */
  bySeverity: Record<"critical" | "high" | "medium" | "low", number>;
  /** Breakdown by resolution type */
  byResolutionType: Record<ConflictResolutionType, number>;
}

/**
 * Individual metric event
 */
export interface ConflictMetricEvent {
  /** Event ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** Type of event */
  type:
    | "conflict_detected"
    | "conflict_prevented"
    | "conflict_auto_resolved"
    | "conflict_manual_resolved";
  /** Story ID involved */
  storyId: string;
  /** Agents involved */
  agents: string[];
  /** Severity (for detected/resolved) */
  severity?: "critical" | "high" | "medium" | "low";
  /** Resolution action (for resolved) */
  resolutionAction?: "keep_existing" | "keep_new" | "manual";
  /** Time to resolution in ms (for resolved) */
  resolutionTimeMs?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Conflict metrics configuration
 */
export interface ConflictMetricsConfig {
  /** Audit trail for persistent storage */
  auditTrail?: AuditTrail;
  /** Max events to keep in memory */
  maxEventsInMemory?: number;
}

/**
 * Conflict metrics service interface
 */
export interface ConflictMetricsService {
  /** Record a conflict detection */
  recordDetection(event: Omit<ConflictMetricEvent, "id" | "timestamp" | "type">): string;
  /** Record a conflict prevention */
  recordPrevention(event: Omit<ConflictMetricEvent, "id" | "timestamp" | "type">): string;
  /** Record an auto-resolution */
  recordAutoResolution(
    event: Omit<ConflictMetricEvent, "id" | "timestamp" | "type" | "resolutionTimeMs"> & {
      detectedEventId: string;
    },
  ): string;
  /** Record a manual resolution */
  recordManualResolution(
    event: Omit<ConflictMetricEvent, "id" | "timestamp" | "type" | "resolutionTimeMs"> & {
      detectedEventId: string;
    },
  ): string;
  /** Get metrics summary for a time period */
  getSummary(periodStart: Date, periodEnd: Date): ConflictMetricsSummary;
  /** Get recent metric events */
  getRecentEvents(limit?: number): ConflictMetricEvent[];
  /** Get event by ID */
  getEvent(id: string): ConflictMetricEvent | undefined;
  /** Export metrics as JSON */
  exportMetrics(): string;
  /** Clear all metrics */
  clear(): void;
}

/**
 * Conflict metrics service implementation
 */
class ConflictMetricsServiceImpl implements ConflictMetricsService {
  private events: Map<string, ConflictMetricEvent> = new Map();
  private config: Required<Pick<ConflictMetricsConfig, "maxEventsInMemory">> &
    Pick<ConflictMetricsConfig, "auditTrail">;
  private eventOrder: string[] = [];

  constructor(config: ConflictMetricsConfig = {}) {
    this.config = {
      auditTrail: config.auditTrail,
      maxEventsInMemory: config.maxEventsInMemory ?? 1000,
    };
  }

  recordDetection(event: Omit<ConflictMetricEvent, "id" | "timestamp" | "type">): string {
    return this.addEvent({
      ...event,
      type: "conflict_detected",
    });
  }

  recordPrevention(event: Omit<ConflictMetricEvent, "id" | "timestamp" | "type">): string {
    return this.addEvent({
      ...event,
      type: "conflict_prevented",
    });
  }

  recordAutoResolution(
    event: Omit<ConflictMetricEvent, "id" | "timestamp" | "type" | "resolutionTimeMs"> & {
      detectedEventId: string;
    },
  ): string {
    const detectedEvent = this.events.get(event.detectedEventId);
    const resolutionTimeMs = detectedEvent ? Date.now() - detectedEvent.timestamp.getTime() : 0;

    return this.addEvent({
      ...event,
      type: "conflict_auto_resolved",
      resolutionAction: "keep_existing",
      resolutionTimeMs,
    });
  }

  recordManualResolution(
    event: Omit<ConflictMetricEvent, "id" | "timestamp" | "type" | "resolutionTimeMs"> & {
      detectedEventId: string;
    },
  ): string {
    const detectedEvent = this.events.get(event.detectedEventId);
    const resolutionTimeMs = detectedEvent ? Date.now() - detectedEvent.timestamp.getTime() : 0;

    return this.addEvent({
      ...event,
      type: "conflict_manual_resolved",
      resolutionAction: "manual",
      resolutionTimeMs,
    });
  }

  getSummary(periodStart: Date, periodEnd: Date): ConflictMetricsSummary {
    const relevantEvents = Array.from(this.events.values()).filter(
      (e) => e.timestamp >= periodStart && e.timestamp <= periodEnd,
    );

    const detected = relevantEvents.filter((e) => e.type === "conflict_detected");
    const prevented = relevantEvents.filter((e) => e.type === "conflict_prevented");
    const autoResolved = relevantEvents.filter((e) => e.type === "conflict_auto_resolved");
    const manualResolved = relevantEvents.filter((e) => e.type === "conflict_manual_resolved");

    const totalDetected = detected.length;
    const totalResolved = autoResolved.length + manualResolved.length;
    const pending = Math.max(0, totalDetected - totalResolved);

    // Calculate resolution times
    const resolutionTimes = [...autoResolved, ...manualResolved]
      .filter((e) => e.resolutionTimeMs !== undefined)
      .map((e) => e.resolutionTimeMs as number);

    const avgResolutionTimeMs =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((sum, t) => sum + t, 0) / resolutionTimes.length
        : 0;

    // Calculate rates
    const preventionRate = totalDetected > 0 ? prevented.length / totalDetected : 0;
    const autoResolutionRate = totalResolved > 0 ? autoResolved.length / totalResolved : 0;

    // Breakdown by severity
    const bySeverity: Record<"critical" | "high" | "medium" | "low", number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const event of detected) {
      if (event.severity) {
        bySeverity[event.severity]++;
      }
    }

    // Breakdown by resolution type
    const byResolutionType: Record<ConflictResolutionType, number> = {
      prevented: prevented.length,
      auto_resolved: autoResolved.length,
      manual_resolved: manualResolved.length,
    };

    return {
      periodStart,
      periodEnd,
      totalDetected,
      prevented: prevented.length,
      autoResolved: autoResolved.length,
      manualResolved: manualResolved.length,
      pending,
      preventionRate,
      autoResolutionRate,
      avgResolutionTimeMs,
      bySeverity,
      byResolutionType,
    };
  }

  getRecentEvents(limit = 50): ConflictMetricEvent[] {
    const recentIds = this.eventOrder.slice(-limit).reverse();
    return recentIds
      .map((id) => this.events.get(id))
      .filter((e): e is ConflictMetricEvent => e !== undefined);
  }

  getEvent(id: string): ConflictMetricEvent | undefined {
    return this.events.get(id);
  }

  exportMetrics(): string {
    const events = Array.from(this.events.values());
    return JSON.stringify(events, null, 2);
  }

  clear(): void {
    this.events.clear();
    this.eventOrder = [];
  }

  private addEvent(event: Omit<ConflictMetricEvent, "id" | "timestamp">): string {
    const id = `metric-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const fullEvent: ConflictMetricEvent = {
      ...event,
      id,
      timestamp: new Date(),
    };

    this.events.set(id, fullEvent);
    this.eventOrder.push(id);

    // Prune old events if over limit
    while (this.eventOrder.length > this.config.maxEventsInMemory) {
      const oldestId = this.eventOrder.shift();
      if (oldestId) {
        this.events.delete(oldestId);
      }
    }

    // Write to audit trail if configured
    if (this.config.auditTrail) {
      const eventType = `conflict_metric.${event.type}`;
      const timestamp = fullEvent.timestamp.toISOString();
      const metadata = { ...fullEvent };

      // Create hash for audit event
      const hash = createHash("sha256")
        .update(id + timestamp + JSON.stringify(metadata))
        .digest("hex");

      const auditEvent: AuditEvent = {
        eventId: id,
        eventType,
        timestamp,
        metadata,
        hash,
      };

      this.config.auditTrail.log(auditEvent).catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.error("Failed to write conflict metric to audit trail:", error);
      });
    }

    return id;
  }
}

/**
 * Factory function to create a conflict metrics service
 */
export function createConflictMetricsService(
  config?: ConflictMetricsConfig,
): ConflictMetricsService {
  return new ConflictMetricsServiceImpl(config);
}
