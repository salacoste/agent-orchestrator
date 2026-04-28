/**
 * Persistent execution mode — re-queue persistent sessions on verification failure.
 *
 * Story 61-5.
 */

import type { PersistentConfig, SessionId, VerificationConfig } from "../types.js";
import { readMetadataRaw, updateMetadata } from "../metadata.js";

/**
 * Get the execution mode from session metadata.
 * Returns null if not set (defaults to "standard" at spawn time).
 */
export function getExecutionMode(sessionsDir: string, sessionId: SessionId): string | null {
  try {
    const raw = readMetadataRaw(sessionsDir, sessionId);
    if (!raw) return null;
    const mode = raw["ao:executionMode"];
    if (!mode || typeof mode !== "string") return null;
    return mode;
  } catch {
    return null;
  }
}

/**
 * Get current persistent re-queue count from session metadata.
 */
export function getPersistentRequeueCount(sessionsDir: string, sessionId: SessionId): number {
  try {
    const raw = readMetadataRaw(sessionsDir, sessionId);
    if (!raw) return 0;
    const count = raw["persistent_requeue_count"];
    if (!count || typeof count !== "string") return 0;
    return parseInt(count, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Increment the persistent re-queue count in session metadata.
 */
export function storePersistentRequeueAttempt(sessionsDir: string, sessionId: SessionId): void {
  try {
    const current = getPersistentRequeueCount(sessionsDir, sessionId);
    updateMetadata(sessionsDir, sessionId, {
      persistent_requeue_count: String(current + 1),
    });
  } catch {
    // Storage failure must never block persistent re-queue
  }
}

/**
 * Determine whether a persistent session should be re-queued.
 *
 * Checks execution mode, current re-queue count against config limits,
 * and onFailure mode. Returns `{ shouldRequeue, requeueCount }`.
 *
 * Only activates when `ao:executionMode === "persistent"` AND
 * `onFailure !== "block"`.
 */
export function schedulePersistentRequeue(
  sessionsDir: string,
  sessionId: SessionId,
  config: VerificationConfig,
  preloadedRequeueCount?: number,
): { shouldRequeue: boolean; requeueCount: number } {
  // Only activate for persistent execution mode
  const executionMode = getExecutionMode(sessionsDir, sessionId);
  if (executionMode !== "persistent") {
    return { shouldRequeue: false, requeueCount: 0 };
  }

  // Respect "block" mode — human review required
  if (config.onFailure === "block") {
    return { shouldRequeue: false, requeueCount: 0 };
  }

  const persistentConfig: PersistentConfig = config.persistent ?? {};
  const maxRetries = persistentConfig.persistentMaxRetries ?? 5;
  const currentCount = preloadedRequeueCount ?? getPersistentRequeueCount(sessionsDir, sessionId);

  if (currentCount >= maxRetries) {
    // Retries exhausted
    return { shouldRequeue: false, requeueCount: currentCount };
  }

  return { shouldRequeue: true, requeueCount: currentCount };
}
