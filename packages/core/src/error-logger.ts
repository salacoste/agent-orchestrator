/**
 * Error Logger — Structured error logging with context capture and secret redaction
 *
 * Provides:
 * - Structured error logging with UUID, timestamp, type, message, stack trace
 * - Component/service, related story/agent IDs
 * - Full execution context, state snapshot
 * - Secret redaction (API keys, passwords, tokens)
 * - Error rate detection and summary
 * - Error severity classification and structured error codes
 * - JSONL append-only logging with rotation
 * - Integration with audit trail (JSONL)
 */

import { appendFileSync, mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

/** Default max JSONL file size before rotation (10MB) */
const DEFAULT_MAX_LOG_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Error severity levels */
export type ErrorSeverity = "fatal" | "critical" | "warning" | "info";

/**
 * Structured error codes for categorization and lookup.
 * Format: ERR-{COMPONENT}-{NUMBER}
 */
export const ERROR_CODES = {
  // Event Bus
  "ERR-EVENTBUS-001": "Event bus connection failed",
  "ERR-EVENTBUS-002": "Event publish timeout",
  "ERR-EVENTBUS-003": "Event bus backlog exceeded",
  // Sync
  "ERR-SYNC-001": "BMAD tracker sync failed",
  "ERR-SYNC-002": "State conflict during sync",
  "ERR-SYNC-003": "Sync latency exceeded threshold",
  // Notification
  "ERR-NOTIFY-001": "Notification delivery failed",
  "ERR-NOTIFY-002": "All notification plugins unavailable",
  // Metadata
  "ERR-META-001": "Metadata file corrupted",
  "ERR-META-002": "Metadata backup recovery failed",
  "ERR-META-003": "Metadata write failed",
  // Agent
  "ERR-AGENT-001": "Agent blocked (inactivity timeout)",
  "ERR-AGENT-002": "Agent process crashed",
  "ERR-AGENT-003": "Agent spawn failed",
  // Conflict
  "ERR-CONFLICT-001": "Version conflict detected",
  "ERR-CONFLICT-002": "Conflict resolution failed",
  // General
  "ERR-UNKNOWN-000": "Unclassified error",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

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

  /** Error severity classification */
  severity?: ErrorSeverity;

  /** Structured error code (ERR-{COMPONENT}-{NUMBER}) */
  errorCode?: string;
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

  /** Maximum JSONL file size in bytes before rotation (default: 10MB) */
  maxLogFileSizeBytes?: number;
}

export interface ErrorLoggerDeps {
  /** Directory to write error log files */
  logDir: string;
  config?: Partial<ErrorLoggerConfig>;

  /** Path to JSONL append-only error log file (opt-in) */
  jsonlPath?: string;

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

  /** Manual severity override (skips auto-classification) */
  severity?: ErrorSeverity;

  /** Manual error code override (skips auto-assignment) */
  errorCode?: string;
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

// =============================================================================
// Custom Classification Rules Registry
// =============================================================================

/**
 * Custom error classification rule
 */
export interface ErrorClassificationRule {
  /** Unique rule name */
  name: string;
  /** Pattern to match against error message */
  messagePattern?: RegExp;
  /** Component(s) this rule applies to */
  components?: string[];
  /** Resulting severity if matched */
  severity?: ErrorSeverity;
  /** Resulting error code if matched */
  errorCode?: string;
  /** Priority for rule ordering (higher = checked first, default: 0) */
  priority?: number;
}

/** Module-level registry of custom classification rules */
const customClassificationRules: ErrorClassificationRule[] = [];

/**
 * Register a custom error classification rule.
 * Custom rules are checked before hardcoded patterns.
 */
export function registerClassificationRule(rule: ErrorClassificationRule): void {
  customClassificationRules.push(rule);
  customClassificationRules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/**
 * Clear all custom classification rules (for testing).
 */
export function clearClassificationRules(): void {
  customClassificationRules.length = 0;
}

/**
 * Check if a custom rule matches an error.
 */
function matchesCustomRule(
  rule: ErrorClassificationRule,
  message: string,
  component?: string,
): boolean {
  // A rule must have at least one matching criterion
  if (!rule.messagePattern && !rule.components) return false;
  if (rule.messagePattern && !rule.messagePattern.test(message)) return false;
  if (rule.components && component && !rule.components.some((c) => c.toLowerCase() === component))
    return false;
  if (rule.components && !component) return false;
  return true;
}

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
  private jsonlPath: string | undefined;
  private maxLogFileSizeBytes: number;
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
    this.jsonlPath = deps.jsonlPath;
    this.maxLogFileSizeBytes = deps.config?.maxLogFileSizeBytes ?? DEFAULT_MAX_LOG_FILE_SIZE_BYTES;
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

    // Ensure JSONL parent directory exists (may differ from logDir)
    if (this.jsonlPath) {
      try {
        mkdirSync(dirname(this.jsonlPath), { recursive: true });
      } catch {
        // Directory already exists or creation failed
      }
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

    // Classify the error (severity + error code)
    const classification = this.classifyError(error, options);

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
      severity: classification.severity,
      errorCode: classification.errorCode,
    };

    // Store error in memory
    this.errors.push(entry);

    // Write error to per-file JSON
    const filePath = join(this.logDir, `${errorId}.json`);
    try {
      writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8");
    } catch (writeError) {
      // eslint-disable-next-line no-console -- This IS the error logger; console.error is the last-resort output when file write fails
      console.error(`Failed to write error log to ${filePath}:`, writeError);
    }

    // Append to JSONL file (if configured)
    this.appendToJsonl(entry);

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
   * Classify an error by severity and error code.
   * Manual overrides in options take precedence over auto-classification.
   */
  private classifyError(
    error: Error,
    options: ErrorLogOptions,
  ): { severity: ErrorSeverity; errorCode: string } {
    const severity = options.severity ?? this.classifySeverity(error, options);
    const errorCode = options.errorCode ?? this.assignErrorCode(error, options);
    return { severity, errorCode };
  }

  /**
   * Auto-classify severity from error patterns and component context.
   */
  private classifySeverity(error: Error, options: ErrorLogOptions): ErrorSeverity {
    const message = error.message;
    const errorType = options.type || error.constructor.name;
    const component = options.component?.toLowerCase();

    // Check custom rules first (higher priority)
    for (const rule of customClassificationRules) {
      if (rule.severity && matchesCustomRule(rule, message, component)) {
        return rule.severity;
      }
    }

    // Fatal: resource exhaustion
    if (/ENOSPC|ENOMEM|out of memory/i.test(message)) {
      return "fatal";
    }

    // Critical: network/connectivity failures
    if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|service unavailable/i.test(message)) {
      return "critical";
    }

    // Component-based bump to critical
    if (component === "event-bus" || component === "lifecycle") {
      return "critical";
    }

    // Warning: parse/conflict errors
    if (
      errorType === "ConflictError" ||
      errorType === "SyntaxError" ||
      error instanceof SyntaxError ||
      /parse error|invalid YAML/i.test(message)
    ) {
      return "warning";
    }

    // Safe default
    return "warning";
  }

  /**
   * Auto-assign structured error code from error patterns.
   */
  private assignErrorCode(error: Error, options: ErrorLogOptions): string {
    const message = error.message;
    const errorType = options.type || error.constructor.name;
    const component = options.component?.toLowerCase();

    // Check custom rules first (higher priority)
    for (const rule of customClassificationRules) {
      if (rule.errorCode && matchesCustomRule(rule, message, component)) {
        return rule.errorCode;
      }
    }

    // Event bus errors
    if (component === "event-bus") {
      if (/ECONNREFUSED|ECONNRESET|connection failed/i.test(message)) {
        return "ERR-EVENTBUS-001";
      }
      if (/timeout|ETIMEDOUT/i.test(message)) {
        return "ERR-EVENTBUS-002";
      }
      if (/backlog|overflow/i.test(message)) {
        return "ERR-EVENTBUS-003";
      }
    }

    // Metadata errors
    if (component === "metadata" || /metadata/i.test(message)) {
      if (/corrupt/i.test(message)) {
        return "ERR-META-001";
      }
      if (/backup.*recov|recov.*backup/i.test(message)) {
        return "ERR-META-002";
      }
      if (/write failed|ENOSPC/i.test(message)) {
        return "ERR-META-003";
      }
    }

    // Conflict errors
    if (errorType === "ConflictError" || /conflict/i.test(message)) {
      if (/resolution failed/i.test(message)) {
        return "ERR-CONFLICT-002";
      }
      return "ERR-CONFLICT-001";
    }

    // Sync errors
    if (component === "sync") {
      if (/ECONNREFUSED|ECONNRESET|failed/i.test(message)) {
        return "ERR-SYNC-001";
      }
      if (/latency|threshold/i.test(message)) {
        return "ERR-SYNC-003";
      }
      return "ERR-SYNC-001";
    }

    // Notification errors
    if (component === "notification") {
      if (/unavailable|all.*plugin/i.test(message)) {
        return "ERR-NOTIFY-002";
      }
      return "ERR-NOTIFY-001";
    }

    // Agent errors
    if (component === "agent" || component === "agent-manager" || component === "agent-spawner") {
      if (/blocked|inactiv|timeout/i.test(message)) {
        return "ERR-AGENT-001";
      }
      if (/crash/i.test(message)) {
        return "ERR-AGENT-002";
      }
      if (/spawn|start/i.test(message)) {
        return "ERR-AGENT-003";
      }
    }

    return "ERR-UNKNOWN-000";
  }

  /**
   * Append error entry to JSONL file with rotation.
   */
  private appendToJsonl(entry: ErrorLogEntry): void {
    if (!this.jsonlPath) return;

    // Check rotation before append
    try {
      const stats = statSync(this.jsonlPath);
      if (stats.size > this.maxLogFileSizeBytes) {
        const rotatedPath = this.jsonlPath.replace(".jsonl", `-${Date.now()}.jsonl`);
        renameSync(this.jsonlPath, rotatedPath);
      }
    } catch {
      // File doesn't exist yet — will be created on append
    }

    const line = JSON.stringify(entry) + "\n";
    try {
      appendFileSync(this.jsonlPath, line, "utf-8");
    } catch (err) {
      // eslint-disable-next-line no-console -- This IS the error logger; console.error is the last-resort output when JSONL write fails
      console.error(`Failed to append to JSONL ${this.jsonlPath}:`, err);
    }
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
