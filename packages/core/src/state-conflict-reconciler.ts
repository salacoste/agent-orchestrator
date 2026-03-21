/**
 * State Conflict Reconciler
 *
 * Orchestrates conflict detection, auto-retry with exponential backoff,
 * JSONL audit logging, and human notification for unresolved conflicts.
 * Coordinates existing services: ConflictResolver, StateManager, AuditTrail,
 * EventPublisher, and NotificationService.
 */

import type {
  StateManager,
  ConflictResolver,
  Conflict,
  AuditTrail,
  AuditEvent,
  EventPublisher,
  NotificationService,
  StoryState,
} from "./types.js";
import { createHash, randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Interfaces (co-located, not in types.ts to avoid bloat)
// ---------------------------------------------------------------------------

export interface StateConflictReconcilerConfig {
  stateManager: StateManager;
  conflictResolver: ConflictResolver;
  auditTrail?: AuditTrail;
  eventPublisher?: EventPublisher;
  notificationService?: NotificationService;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Delay between retries in ms (default: [100, 200, 400]) */
  retryDelays?: number[];
}

export interface ReconcileResult {
  success: boolean;
  version?: string;
  retryCount: number;
  escalated: boolean;
  error?: string;
}

export interface StateConflictReconciler {
  /**
   * Attempt a state update with automatic conflict reconciliation.
   * Detects version conflicts, retries with exponential backoff,
   * and escalates to human notification if all retries fail.
   */
  reconcile(
    storyId: string,
    updates: Partial<StoryState>,
    expectedVersion: string,
  ): Promise<ReconcileResult>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAuditEvent(
  eventType: string,
  conflict: Conflict,
  extra?: Record<string, unknown>,
): AuditEvent {
  const eventId = `conflict-${randomUUID()}`;
  const timestamp = new Date().toISOString();
  const metadata: Record<string, unknown> = {
    storyId: conflict.storyId,
    expectedVersion: conflict.expectedVersion,
    actualVersion: conflict.actualVersion,
    conflictFields: conflict.conflicts.map((c) => c.field),
    ...extra,
  };

  const hash = createHash("sha256")
    .update(eventId + timestamp + JSON.stringify(metadata))
    .digest("hex");

  return { eventId, eventType, timestamp, metadata, hash };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAYS = [100, 200, 400];

/**
 * Create a StateConflictReconciler instance.
 */
export function createStateConflictReconciler(
  config: StateConflictReconcilerConfig,
): StateConflictReconciler {
  const {
    stateManager,
    conflictResolver,
    auditTrail,
    eventPublisher,
    notificationService,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelays = DEFAULT_RETRY_DELAYS,
  } = config;

  async function logConflict(
    eventType: string,
    conflict: Conflict,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    if (!auditTrail) return;
    try {
      const event = buildAuditEvent(eventType, conflict, extra);
      await auditTrail.log(event);
    } catch {
      // Non-fatal: audit logging is an enhancement
    }
  }

  async function publishEscalation(conflict: Conflict): Promise<void> {
    if (!eventPublisher) return;
    try {
      await eventPublisher.publishStoryBlocked({
        storyId: conflict.storyId,
        agentId: "system",
        reason: `State conflict unresolved after ${maxRetries} retries: version ${conflict.expectedVersion} vs ${conflict.actualVersion}. Fields: ${conflict.conflicts.map((c) => c.field).join(", ")}`,
      });
    } catch {
      // Non-fatal: event publishing is an enhancement
    }
  }

  async function notifyHuman(conflict: Conflict): Promise<void> {
    if (!notificationService) return;
    try {
      await notificationService.send({
        eventId: `conflict-escalation-${randomUUID()}`,
        eventType: "state.conflict_unresolved",
        title: "State Conflict Requires Human Resolution",
        message: `Story ${conflict.storyId}: version conflict (expected ${conflict.expectedVersion}, found ${conflict.actualVersion}). Fields: ${conflict.conflicts.map((c) => c.field).join(", ")}. Auto-retry exhausted after ${maxRetries} attempts.`,
        priority: "critical",
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-fatal: notification is an enhancement
    }
  }

  return {
    async reconcile(
      storyId: string,
      updates: Partial<StoryState>,
      expectedVersion: string,
    ): Promise<ReconcileResult> {
      // 1. Detect conflict
      let conflict = conflictResolver.detect(storyId, expectedVersion, updates);

      if (!conflict) {
        // No conflict — apply directly
        const current = stateManager.get(storyId);
        if (!current) {
          return {
            success: false,
            retryCount: 0,
            escalated: false,
            error: `Story ${storyId} not found`,
          };
        }

        const result = await stateManager.set(storyId, { ...current, ...updates }, expectedVersion);

        return {
          success: result.success,
          version: result.version,
          retryCount: 0,
          escalated: false,
          error: result.error,
        };
      }

      // 2. Log conflict detection
      await logConflict("state.conflict_detected", conflict);

      // 3. Auto-retry loop
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Exponential backoff
        const delay = retryDelays[attempt] ?? retryDelays[retryDelays.length - 1] ?? 400;
        await sleep(delay);

        // Log retry attempt
        await logConflict("state.conflict_retried", conflict, { attempt: attempt + 1 });

        // Attempt resolution via retry strategy
        const resolveResult = await conflictResolver.resolve(conflict, "retry");

        if (resolveResult.success) {
          await logConflict("state.conflict_resolved", conflict, {
            attempt: attempt + 1,
            newVersion: resolveResult.newVersion,
          });

          return {
            success: true,
            version: resolveResult.newVersion,
            retryCount: attempt + 1,
            escalated: false,
          };
        }

        // Refresh conflict state for next attempt
        const refreshed = conflictResolver.detect(storyId, expectedVersion, updates);
        if (refreshed) {
          conflict = refreshed;
        }
        if (!refreshed) {
          // Conflict resolved externally
          const current = stateManager.get(storyId);
          return {
            success: true,
            version: current?.version,
            retryCount: attempt + 1,
            escalated: false,
          };
        }
      }

      // 4. All retries exhausted — escalate
      await logConflict("state.conflict_unresolved", conflict, {
        totalAttempts: maxRetries,
      });
      await publishEscalation(conflict);
      await notifyHuman(conflict);

      return {
        success: false,
        retryCount: maxRetries,
        escalated: true,
        error: `State conflict unresolved after ${maxRetries} retries`,
      };
    },
  };
}
