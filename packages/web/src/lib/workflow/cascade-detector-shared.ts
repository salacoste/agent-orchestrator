/**
 * Shared cascade detector instance (Story 40.1).
 *
 * Module-level singleton cached in globalThis so both the SSE events route
 * and the resume API endpoint access the same detector state.
 * Uses globalThis to survive Next.js HMR reloads in development.
 */
import { createWiredCascadeDetector, type WiredCascadeDetector } from "./cascade-detector-wired";

// Cache in globalThis for Next.js HMR stability (same pattern as services.ts)
const globalForCascade = globalThis as typeof globalThis & {
  _aoCascadeDetector?: WiredCascadeDetector;
};

/** Get (or lazily create) the shared cascade detector. */
export function getSharedCascadeDetector(): WiredCascadeDetector {
  if (!globalForCascade._aoCascadeDetector) {
    globalForCascade._aoCascadeDetector = createWiredCascadeDetector();
  }
  return globalForCascade._aoCascadeDetector;
}

/** Reset the shared detector (for testing). */
export function _resetSharedCascadeDetector(): void {
  globalForCascade._aoCascadeDetector?.reset();
  globalForCascade._aoCascadeDetector = undefined;
}
