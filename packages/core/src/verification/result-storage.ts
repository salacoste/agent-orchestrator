/**
 * Verification result storage — persists results to session metadata.
 *
 * Story 61-3, AC #7, #9.
 */

import type { SessionId, VerificationResult } from "../types.js";
import { readMetadataRaw, updateMetadata } from "../metadata.js";

/**
 * Store verification result in session metadata.
 *
 * Uses the existing flat-file metadata system with a JSON-stringified
 * `verification_result` key. Non-fatal: silently skips if metadata unavailable.
 */
export async function storeVerificationResult(
  sessionsDir: string,
  sessionId: SessionId,
  result: VerificationResult,
): Promise<void> {
  try {
    const raw = readMetadataRaw(sessionsDir, sessionId);
    if (!raw) return;
    updateMetadata(sessionsDir, sessionId, {
      verification_result: JSON.stringify(result),
    });
  } catch {
    // Storage failure must never block completion
  }
}

/**
 * Load verification result from session metadata.
 *
 * Returns null if no result stored (story completed before verification was enabled).
 */
export function loadVerificationResult(
  sessionsDir: string,
  sessionId: SessionId,
): VerificationResult | null {
  try {
    const raw = readMetadataRaw(sessionsDir, sessionId);
    if (!raw) return null;
    const stored = raw["verification_result"];
    if (!stored || typeof stored !== "string") return null;
    return JSON.parse(stored) as VerificationResult;
  } catch {
    return null;
  }
}
