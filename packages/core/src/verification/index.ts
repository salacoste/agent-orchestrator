/**
 * Verification Gate Service — runs quality checks before story completion.
 *
 * Architecture:
 * - Configured per-project via `verification` section in project config
 * - Runs commands (test, lint, typecheck, custom) via child_process
 * - Stores results in session metadata for API retrieval
 * - Gate is opt-in (disabled by default) and non-fatal (never blocks completion pipeline)
 * - Auto-retry on failure with configurable limits (Story 61-4)
 * - Persistent execution mode re-queues sessions (Story 61-5)
 */

export { runVerification } from "./run-check.js";
export { storeVerificationResult, loadVerificationResult } from "./result-storage.js";
export {
  getVerificationRetryCount,
  storeVerificationRetryAttempt,
  loadVerificationRetryHistory,
  writeRetryContextToNotepad,
  scheduleVerificationRetry,
} from "./retry.js";
export {
  getExecutionMode,
  getPersistentRequeueCount,
  storePersistentRequeueAttempt,
  schedulePersistentRequeue,
} from "./persistent.js";
