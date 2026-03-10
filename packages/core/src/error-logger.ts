/**
 * Error Logger — Structured error logging with context capture and secret redaction
 *
 * Provides:
 * - Structured error logging with UUID, timestamp, type, message, stack trace
 * - Component/service, related story/agent IDs
 * - Full execution context, state snapshot
 * - Secret redaction (API keys, passwords, tokens)
 * - Error rate detection and summary
 * - Integration with audit trail (JSONL)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

/** Default high error rate threshold (errors per window) */
const DEFAULT_HIGH_ERROR_RATE_THRESHOLD = 10;

/** Default error rate window (milliseconds) - 5 seconds */
const DEFAULT_HIGH_ERROR_RATE_WINDOW = 5000;

/** Minimum high error rate threshold */
const MIN_THRESHOLD = 1;

/** Maximum high error rate threshold */
const MAX_THRESHOLD = 100;

/** Default time format */
const DEFAULT_TIME_FORMAT = "%Y-%m-%dT%H:%M:%S.%3SZ";

export interface ErrorLogEntry {
  /** Unique error identifier (prefixed UUID) */
  errorId: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Error type/class name */
  type: string;

  /** Error message */
  message: string;

  /** Stack trace */
  stack?: string;

  /** Component/service that generated the error */
  component?: string;

  /** Related story ID */
  storyId?: string;

  /** Agent/session ID */
  agentId?: string;

  /** Request/correlation ID */
  correlationId?: string;

  /** Additional context information */
  context?: Record<string, unknown>;

  /** State snapshot at time of error */
  stateSnapshot?: Record<string, unknown>;

  /** Operation type for retry (e.g., 'bmad_sync', 'event_publish', 'state_write') */
  operationType?: string;

  /** Operation payload for retry */
  operationPayload?: Record<string, unknown>;

  /** Number of retry attempts made */
  retryCount?: number;
}

export interface ErrorRateSummary {
  type: "ErrorRateSummary";
  timestamp: string;
  errorCount: number;
  windowMs: number;
  threshold: number;
}

export type ErrorLog = ErrorLogEntry | ErrorRateSummary;

export interface ErrorLoggerConfig {
  /** Number of errors in window to trigger "high error rate" (default: 10, range: 1-100) */
  highErrorRateThreshold?: number;

  /** Time window for error rate calculation in milliseconds (default: 5000ms) */
  highErrorRateWindow?: number;

  /** Time format for timestamps (default: ISO 8601) */
  timeFormat?: string;
}

export interface ErrorLoggerDeps {
  /** Directory to write error log files */
  logDir: string;
  config?: Partial<ErrorLoggerConfig>;

  /** Retry handlers by operation type */
  retryHandlers?: Map<string, RetryHandler>;
}

/** Handler function for retrying an operation */
export type RetryOperationHandler = (
  operationType: string,
  payload: Record<string, unknown>,
) => Promise<boolean>;

export interface ErrorLogger {
  /** Log an error with context information */
  logError(error: Error, options: ErrorLogOptions): Promise<void>;

  /** Get all error log entries */
  getErrors(filter?: ErrorFilter): ErrorLog[];

  /** Find a specific error by error ID */
  getErrorById(errorId: string): ErrorLogEntry | null;

  /** Register a handler for a specific operation type */
  registerRetryHandler(operationType: string, handler: RetryOperationHandler): void;

  /** Retry an operation from an error ID */
  retryFromErrorId(errorId: string): Promise<{ success: boolean; error?: string }>;

  /** Get all errors that have operation context for retry */
  getRetryableErrors(): ErrorLogEntry[];

  /** Close the logger and release resources */
  close(): Promise<void>;
}

export interface ErrorLogOptions {
  /** Component/service name */
  component?: string;

  /** Related story ID */
  storyId?: string;

  /** Agent/session ID */
  agentId?: string;

  /** Request/correlation ID */
  correlationId?: string;

  /** Custom error type (defaults to error.constructor.name) */
  type?: string;

  /** Additional context information */
  context?: Record<string, unknown>;

  /** State snapshot at time of error */
  stateSnapshot?: Record<string, unknown>;

  /** Operation type for retry (e.g., 'bmad_sync', 'event_publish', 'state_write') */
  operationType?: string;

  /** Operation payload for retry */
  operationPayload?: Record<string, unknown>;
}

export interface ErrorFilter {
  /** Filter by error type */
  type?: string;

  /** Filter by component */
  component?: string;

  /** Filter by time range (start timestamp, end timestamp) */
  startTime?: string;
  endTime?: string;

  /** Search by error ID prefix */
  errorId?: string;

  /** Filter by story ID */
  storyId?: string;

  /** Filter by agent ID */
  agentId?: string;

  /** Filter by operation type */
  operationType?: string;
}

/** Handler function for retrying operations from error context */
export type RetryHandler = (
  operationType: string,
  payload: Record<string, unknown>,
  context: Record<string, unknown>,
) => Promise<{ success: boolean; error?: string }>;

/**
 * Patterns for detecting sensitive information that should be redacted
 * Order matters - more specific patterns must come first
 */
const SECRET_PATTERNS = [
  { name: "bearer", pattern: /Bearer\s+[a-zA-Z0-9_./~=+-]{10,}\b/gi },
  { name: "authorization", pattern: /authorization:\s*[^\s,]+/gi },
  { name: "password", pattern: /"password":\s*["'].*["']|password\s*=\s*[^,}\s]+/gi },
  { name: "access_token", pattern: /\b[a-zA-Z0-9_-]{30,}\b/gi },
  { name: "accessToken", pattern: /\b[a-zA-Z0-9_-]{30,}\b/gi },
  { name: "refreshToken", pattern: /\b[a-zA-Z0-9_-]{30,}\b/gi },
  { name: "api_key", pattern: /\b[a-zA-Z0-9_-]{20,}\b/gi },
  { name: "apiKey", pattern: /\b[a-zA-Z0-9_-]{20,}\b/gi },
  { name: "apikey", pattern: /\b[a-zA-Z0-9_-]{20,}\b/gi },
  { name: "secret", pattern: /\b[a-zA-Z0-9_-]{20,}\b/gi },
  { name: "token", pattern: /\b[a-zA-Z0-9_-]{15,}\b/gi },
  { name: "urlToken", pattern: /token=[a-zA-Z0-9_-]+/gi },
];

/**
 * Create error logger with configuration validation
 */
export function createErrorLogger(deps: ErrorLoggerDeps): ErrorLogger {
  // Validate high error rate threshold
  const highErrorRateThreshold =
    deps.config?.highErrorRateThreshold ?? DEFAULT_HIGH_ERROR_RATE_THRESHOLD;
  if (highErrorRateThreshold < MIN_THRESHOLD || highErrorRateThreshold > MAX_THRESHOLD) {
    throw new Error(`highErrorRateThreshold must be between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}`);
  }

  return new ErrorLoggerImpl(deps);
}

/**
 * Implementation of error logger
 */
class ErrorLoggerImpl implements ErrorLogger {
  private logDir: string;
  private highErrorRateThreshold: number;
  private highErrorRateWindow: number;
  private timeFormat: string;
  private retryHandlers: Map<string, RetryHandler>;

  // Error tracking
  private errors: ErrorLog[] = [];

  // Error rate tracking
  private errorTimestamps: number[] = [];
  private lastSummaryTime: number | null = null;
  private pendingSummaryPromise: Promise<void> | null = null;

  constructor(deps: ErrorLoggerDeps) {
    this.logDir = deps.logDir;
    this.highErrorRateThreshold =
      deps.config?.highErrorRateThreshold ?? DEFAULT_HIGH_ERROR_RATE_THRESHOLD;
    this.highErrorRateWindow = deps.config?.highErrorRateWindow ?? DEFAULT_HIGH_ERROR_RATE_WINDOW;
    this.timeFormat = deps.config?.timeFormat ?? DEFAULT_TIME_FORMAT;
    this.retryHandlers = deps.retryHandlers ? new Map(deps.retryHandlers) : new Map();

    // Create log directory if it doesn't exist
    try {
      mkdirSync(this.logDir, { recursive: true });
    } catch {
      // Directory already exists or creation failed
    }
  }

  async logError(error: Error, options: ErrorLogOptions = {}): Promise<void> {
    const errorId = `uuid-${randomUUID()}`;
    const timestamp = new Date().toISOString();

    // Prepare context with redacted secrets
    const redactedContext = this.redactSecrets(options.context || {});

    // Redact state snapshot to prevent secret leaks (NFR-S2)
    const redactedStateSnapshot = options.stateSnapshot
      ? this.redactSecrets(options.stateSnapshot)
      : undefined;

    // Redact operation payload to prevent secret leaks
    const redactedOperationPayload = options.operationPayload
      ? this.redactSecrets(options.operationPayload)
      : undefined;

    // Create error log entry
    const entry: ErrorLogEntry = {
      errorId,
      timestamp,
      type: options.type || error.constructor.name,
      message: error.message,
      stack: error.stack,
      component: options.component,
      storyId: options.storyId,
      agentId: options.agentId,
      correlationId: options.correlationId,
      context: redactedContext,
      stateSnapshot: redactedStateSnapshot,
      operationType: options.operationType,
      operationPayload: redactedOperationPayload,
      retryCount: 0,
    };

    // Store error in memory
    this.errors.push(entry);

    // Write error to file
    const filePath = join(this.logDir, `${errorId}.json`);
    try {
      writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8");
    } catch (writeError) {
      // eslint-disable-next-line no-console -- This IS the error logger; console.error is the last-resort output when file write fails
      console.error(`Failed to write error log to ${filePath}:`, writeError);
    }

    // Track error for rate detection
    this.trackError();
  }

  getErrors(filter?: ErrorFilter): ErrorLog[] {
    let results: ErrorLog[] = [...this.errors];

    // Helper type guard for ErrorLogEntry
    const isErrorLogEntry = (e: ErrorLog): e is ErrorLogEntry => {
      return e.type !== "ErrorRateSummary";
    };

    // Apply filters (only for ErrorLogEntry)
    if (filter?.type) {
      results = results.filter((e) => isErrorLogEntry(e) && e.type === filter.type);
    }
    if (filter?.component) {
      results = results.filter((e) => isErrorLogEntry(e) && e.component === filter.component);
    }
    if (filter?.storyId) {
      results = results.filter((e) => isErrorLogEntry(e) && e.storyId === filter.storyId);
    }
    if (filter?.agentId) {
      results = results.filter((e) => isErrorLogEntry(e) && e.agentId === filter.agentId);
    }
    if (filter?.errorId) {
      const filterErrorId = filter.errorId;
      results = results.filter((e) => {
        if (!isErrorLogEntry(e)) return false;
        const eid = e.errorId;
        if (eid === undefined) return false;
        return eid.startsWith(filterErrorId);
      });
    }
    if (filter?.startTime || filter?.endTime) {
      const startTime = filter?.startTime ? new Date(filter.startTime).getTime() : 0;
      const endTime = filter?.endTime ? new Date(filter.endTime).getTime() : Date.now();
      results = results.filter((e) => {
        if (!isErrorLogEntry(e)) return false;
        const errorTime = new Date(e.timestamp).getTime();
        return errorTime >= startTime && errorTime <= endTime;
      });
    }
    if (filter?.operationType) {
      results = results.filter(
        (e) => isErrorLogEntry(e) && e.operationType === filter.operationType,
      );
    }

    return results;
  }

  getErrorById(errorId: string): ErrorLogEntry | null {
    for (const e of this.errors) {
      if (e.type !== "ErrorRateSummary") {
        const entry = e as ErrorLogEntry;
        if (entry.errorId === errorId) {
          return entry;
        }
      }
    }
    return null;
  }

  registerRetryHandler(operationType: string, handler: RetryOperationHandler): void {
    // Wrap the simple handler to match our internal RetryHandler signature
    const wrappedHandler: RetryHandler = async (opType, payload, _context) => {
      const success = await handler(opType, payload);
      return { success, error: success ? undefined : "Handler returned false" };
    };
    this.retryHandlers.set(operationType, wrappedHandler);
  }

  async retryFromErrorId(errorId: string): Promise<{ success: boolean; error?: string }> {
    const entry = this.getErrorById(errorId);
    if (!entry) {
      return { success: false, error: `Error not found: ${errorId}` };
    }

    if (!entry.operationType) {
      return { success: false, error: `Error ${errorId} has no operation type for retry` };
    }

    if (!entry.operationPayload) {
      return { success: false, error: `Error ${errorId} has no operation payload for retry` };
    }

    const handler = this.retryHandlers.get(entry.operationType);
    if (!handler) {
      return {
        success: false,
        error: `No retry handler registered for operation type: ${entry.operationType}`,
      };
    }

    try {
      // Increment retry count
      entry.retryCount = (entry.retryCount ?? 0) + 1;

      // Execute the retry handler
      const result = await handler(
        entry.operationType,
        entry.operationPayload,
        entry.context || {},
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getRetryableErrors(): ErrorLogEntry[] {
    const isErrorLogEntry = (e: ErrorLog): e is ErrorLogEntry => {
      return e.type !== "ErrorRateSummary";
    };

    const hasRetryContext = (
      e: ErrorLog,
    ): e is ErrorLogEntry & {
      operationType: string;
      operationPayload: Record<string, unknown>;
    } => {
      return (
        isErrorLogEntry(e) && e.operationType !== undefined && e.operationPayload !== undefined
      );
    };

    return this.errors.filter(hasRetryContext);
  }

  close(): Promise<void> {
    // Note: We don't cancel pendingSummaryPromise here as it may be in progress
    // The promise will complete naturally without side effects

    // Clear error tracking
    this.errors = [];
    this.errorTimestamps = [];
    this.lastSummaryTime = null;
    return Promise.resolve();
  }

  /**
   * Redact sensitive information from context
   */
  private redactSecrets(context: Record<string, unknown>): Record<string, unknown> {
    const redacted = { ...context };

    for (const [key, value] of Object.entries(redacted)) {
      if (typeof value === "string") {
        redacted[key] = this.redactString(key, value);
      } else if (typeof value === "object" && value !== null) {
        redacted[key] = this.redactObject(key, value as Record<string, unknown>);
      }
    }

    return redacted;
  }

  private redactString(key: string, value: string): string {
    // Extract the final part of the key path for pattern matching
    // e.g., "credentials.accessToken" → "accessToken"
    const finalKey = key.includes(".") ? (key.split(".").pop() ?? key) : key;
    const keyLower = finalKey.toLowerCase();

    // Check for specific key patterns first (more specific than generic patterns)
    if (keyLower.includes("password")) {
      return "[REDACTED: password]";
    }
    if (
      keyLower.includes("api_key") ||
      keyLower.includes("apikey") ||
      keyLower.includes("api-key")
    ) {
      return "[REDACTED: api_key]";
    }
    if (keyLower.includes("access_token") || keyLower.includes("accesstoken")) {
      return "[REDACTED: access_token]";
    }
    if (keyLower.includes("refresh_token") || keyLower.includes("refreshtoken")) {
      return "[REDACTED: refresh_token]";
    }
    if (keyLower.includes("secret")) {
      return "[REDACTED: secret]";
    }
    if (
      keyLower.includes("token") &&
      !keyLower.includes("access") &&
      !keyLower.includes("refresh")
    ) {
      return "[REDACTED: token]";
    }

    // For unknown keys, apply pattern matching
    let result = value;
    for (const secret of SECRET_PATTERNS) {
      const pattern = secret.pattern;
      const replacement = `[REDACTED: ${secret.name}]`;
      result = result.replace(pattern, replacement);
    }

    return result;
  }

  private redactObject(key: string, obj: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [subKey, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        redacted[subKey] = this.redactString(`${key}.${subKey}`, value);
      } else if (typeof value === "object" && value !== null) {
        redacted[subKey] = this.redactObject(`${key}.${subKey}`, value as Record<string, unknown>);
      } else {
        redacted[subKey] = value;
      }
    }

    return redacted;
  }

  /**
   * Track error for rate detection
   */
  private trackError(): void {
    const now = Date.now();

    // Add current error timestamp
    this.errorTimestamps.push(now);

    // Clean up old timestamps outside the window
    const windowStart = now - this.highErrorRateWindow;
    this.errorTimestamps = this.errorTimestamps.filter((ts) => ts >= windowStart);

    // Check if we should schedule a summary
    const errorCount = this.errorTimestamps.length;

    // Check if we should schedule a new summary
    // Only schedule if count exceeds threshold (> not >=) to capture full burst
    const shouldScheduleSummary =
      errorCount > this.highErrorRateThreshold &&
      (this.lastSummaryTime === null || now - this.lastSummaryTime >= this.highErrorRateWindow);

    if (shouldScheduleSummary && this.pendingSummaryPromise === null) {
      // Log summary immediately with current count
      this.logErrorRateSummary(errorCount, now);
      this.lastSummaryTime = now;
    }
  }

  /**
   * Log error rate summary
   */
  private logErrorRateSummary(errorCount: number, timestamp: number): void {
    const summaryId = `summary-${randomUUID()}`;
    const summary: ErrorRateSummary = {
      type: "ErrorRateSummary",
      timestamp: new Date(timestamp).toISOString(),
      errorCount,
      windowMs: this.highErrorRateWindow,
      threshold: this.highErrorRateThreshold,
    };

    this.errors.push(summary);

    // Write summary to file
    const filePath = join(this.logDir, `${summaryId}.json`);
    try {
      writeFileSync(filePath, JSON.stringify(summary, null, 2), "utf-8");
    } catch (writeError) {
      // eslint-disable-next-line no-console -- This IS the error logger; console.error is the last-resort output when file write fails
      console.error(`Failed to write error rate summary to ${filePath}:`, writeError);
    }
  }
}
