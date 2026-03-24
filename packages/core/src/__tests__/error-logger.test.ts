/**
 * Tests for ErrorLogger service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  mkdirSync,
  rmSync,
  readFileSync,
  unlinkSync,
  readdirSync,
  existsSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import {
  createErrorLogger,
  registerClassificationRule,
  clearClassificationRules,
  type ErrorLogger,
  type ErrorLoggerConfig,
  type ErrorLogEntry,
  type ErrorSeverity,
} from "../index.js";

// Test utilities
const testLogDir = join(process.cwd(), ".test-error-logs");
const testJsonlPath = join(testLogDir, "errors.jsonl");
let errorLogger: ErrorLogger;

/** Helper to get the first error log entry from the in-memory store */
function getFirstEntry(logger: ErrorLogger): ErrorLogEntry {
  const errors = logger.getErrors();
  return errors[0] as ErrorLogEntry;
}

/** Type assertion helper for severity field */
function assertSeverity(entry: ErrorLogEntry, expected: ErrorSeverity): void {
  expect(entry.severity).toBe(expected);
}

/** Helper to read and parse all lines from a JSONL file */
function readJsonlLines(path: string): unknown[] {
  if (!existsSync(path)) return [];
  const content = readFileSync(path, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").map((line) => JSON.parse(line));
}

describe("ErrorLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Create test log directory
    try {
      mkdirSync(testLogDir, { recursive: true });
    } catch {
      // Directory already exists
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    errorLogger?.close();
    // Clean up test log files
    try {
      const files = readdirSync(testLogDir);
      for (const file of files) {
        unlinkSync(join(testLogDir, file));
      }
      rmSync(testLogDir, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist or can't be cleaned
    }
  });

  describe("initialization", () => {
    it("creates logger with default config", () => {
      const logger = createErrorLogger({ logDir: testLogDir });
      expect(logger).toBeDefined();
      logger.close();
    });

    it("creates logger with custom config", () => {
      const config: Partial<ErrorLoggerConfig> = {
        highErrorRateThreshold: 5,
        highErrorRateWindow: 10000,
      };
      const logger = createErrorLogger({ logDir: testLogDir, config });
      expect(logger).toBeDefined();
      logger.close();
    });

    it("validates high error rate threshold range", () => {
      const config: Partial<ErrorLoggerConfig> = {
        highErrorRateThreshold: 0, // below minimum
      };
      expect(() => createErrorLogger({ logDir: testLogDir, config })).toThrow("between 1 and 100");
    });
  });

  describe("error logging", () => {
    beforeEach(() => {
      errorLogger = createErrorLogger({ logDir: testLogDir });
    });

    it("logs error with all required fields", async () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.js:10:5";

      await errorLogger.logError(error, {
        component: "TestService",
        context: { operation: "testOperation" },
        storyId: "test-story",
        agentId: "test-agent",
      });

      // Read the log file to verify
      const files = readdirSync(testLogDir);
      expect(files.length).toBeGreaterThan(0);

      const logContent = readFileSync(join(testLogDir, files[0]), "utf-8");
      const logEntry = JSON.parse(logContent);

      expect(logEntry).toMatchObject({
        errorId: expect.stringMatching(/^uuid-/),
        timestamp: expect.any(String),
        type: "Error",
        message: "Test error",
        stack: expect.any(String),
        component: "TestService",
        storyId: "test-story",
        agentId: "test-agent",
      });
    });

    it("logs error with custom type", async () => {
      await errorLogger.logError(new Error("Custom error"), {
        type: "CustomError",
        component: "TestService",
      });

      const files = readdirSync(testLogDir);
      const logContent = readFileSync(join(testLogDir, files[files.length - 1]), "utf-8");
      const logEntry = JSON.parse(logContent);

      expect(logEntry.type).toBe("CustomError");
    });

    it("generates unique error ID for each error", async () => {
      const error1 = new Error("Error 1");
      const error2 = new Error("Error 2");

      await errorLogger.logError(error1, { component: "TestService" });
      await errorLogger.logError(error2, { component: "TestService" });

      const files = readdirSync(testLogDir);
      const log1 = JSON.parse(readFileSync(join(testLogDir, files[0]), "utf-8"));
      const log2 = JSON.parse(readFileSync(join(testLogDir, files[1]), "utf-8"));

      expect(log1.errorId).not.toBe(log2.errorId);
    });
  });

  describe("secret redaction", () => {
    beforeEach(() => {
      errorLogger = createErrorLogger({ logDir: testLogDir });
    });

    it("redacts API keys from error context", async () => {
      const error = new Error("API call failed");
      const context = {
        apiKey: "fake-test-key-123",
        url: "https://api.example.com?token=fake-token-xyz",
      };

      await errorLogger.logError(error, {
        component: "APIService",
        context,
      });

      const files = readdirSync(testLogDir);
      const logContent = readFileSync(join(testLogDir, files[0]), "utf-8");
      const logEntry = JSON.parse(logContent);

      expect(logEntry.context.apiKey).toBe("[REDACTED: api_key]");
      expect(logEntry.context.url).not.toContain("secret-token");
    });

    it("redacts passwords from error context", async () => {
      const error = new Error("Authentication failed");
      const context = {
        password: "mySecretPassword123",
        credentials: {
          accessToken: "token-xyz",
          refreshToken: "refresh-abc",
        },
      };

      await errorLogger.logError(error, {
        component: "AuthService",
        context,
      });

      const files = readdirSync(testLogDir);
      const logContent = readFileSync(join(testLogDir, files[0]), "utf-8");
      const logEntry = JSON.parse(logContent);

      expect(logEntry.context.password).toBe("[REDACTED: password]");
      expect(logEntry.context.credentials.accessToken).toBe("[REDACTED: access_token]");
      expect(logEntry.context.credentials.refreshToken).toBe("[REDACTED: refresh_token]");
    });

    it("redacts bearer tokens from error context", async () => {
      const error = new Error("Request failed");
      const context = {
        headers: {
          authorization: "Bearer secret-token-xyz",
        },
      };

      await errorLogger.logError(error, {
        component: "APIService",
        context,
      });

      const files = readdirSync(testLogDir);
      const logContent = readFileSync(join(testLogDir, files[0]), "utf-8");
      const logEntry = JSON.parse(logContent);

      expect(logEntry.context.headers.authorization).toBe("[REDACTED: bearer]");
    });

    it("redacts secrets from state snapshot", async () => {
      const error = new Error("State capture failed");
      const stateSnapshot = {
        dbPassword: "fake-password-xyz",
        apiKey: "fake-api-key-123",
        currentUser: "john.doe", // Should NOT be redacted
        itemsProcessed: 100, // Should NOT be redacted
      };

      await errorLogger.logError(error, {
        component: "StateService",
        stateSnapshot,
      });

      const files = readdirSync(testLogDir);
      const logContent = readFileSync(join(testLogDir, files[0]), "utf-8");
      const logEntry = JSON.parse(logContent);

      // Verify secrets are redacted in stateSnapshot
      expect(logEntry.stateSnapshot.dbPassword).toBe("[REDACTED: password]");
      expect(logEntry.stateSnapshot.apiKey).toBe("[REDACTED: api_key]");
      // Verify non-sensitive data is preserved
      expect(logEntry.stateSnapshot.currentUser).toBe("john.doe");
      expect(logEntry.stateSnapshot.itemsProcessed).toBe(100);
    });
  });

  describe("error rate detection", () => {
    beforeEach(() => {
      errorLogger = createErrorLogger({
        logDir: testLogDir,
        config: {
          highErrorRateThreshold: 10,
          highErrorRateWindow: 5000,
        },
      });
    });

    it("does not trigger high error rate below threshold", async () => {
      const error = new Error("Test error");

      // Log 5 errors (below threshold of 10)
      for (let i = 0; i < 5; i++) {
        await errorLogger.logError(error, { component: "TestService" });
      }

      // Should not have triggered high error rate
      const files = readdirSync(testLogDir);
      expect(files.length).toBe(5);
    });

    it("triggers high error rate when threshold exceeded", async () => {
      const error = new Error("Test error");

      // Log 11 errors (above threshold of 10)
      for (let i = 0; i < 11; i++) {
        await errorLogger.logError(error, { component: "TestService" });
      }

      const files = readdirSync(testLogDir);
      // Should have 11 error logs plus possibly a summary entry
      expect(files.length).toBeGreaterThanOrEqual(11);

      // Check if summary was logged
      const logs = files.map((f) => JSON.parse(readFileSync(join(testLogDir, f), "utf-8")));
      const summary = logs.find((log) => log.type === "ErrorRateSummary");

      expect(summary).toBeDefined();
      expect(summary).toMatchObject({
        errorCount: 11,
        windowMs: 5000,
      });
    });

    it("resets error rate after window expires", async () => {
      const error = new Error("Test error");

      // Log 11 errors to trigger high error rate
      for (let i = 0; i < 11; i++) {
        await errorLogger.logError(error, { component: "TestService" });
      }

      // Advance time beyond window (5 seconds)
      vi.advanceTimersByTime(6000);

      // Log another error - should not trigger summary again
      await errorLogger.logError(error, { component: "TestService" });

      const files = readdirSync(testLogDir);
      const logs = files.map((f) => JSON.parse(readFileSync(join(testLogDir, f), "utf-8")));
      const summaries = logs.filter((log) => log.type === "ErrorRateSummary");

      // Should only have one summary (from before window expiry)
      expect(summaries.length).toBe(1);
    });
  });

  describe("context capture", () => {
    beforeEach(() => {
      errorLogger = createErrorLogger({ logDir: testLogDir });
    });

    it("captures component/service name", async () => {
      await errorLogger.logError(new Error("Test"), {
        component: "SyncService",
      });

      const files = readdirSync(testLogDir);
      const logEntry = JSON.parse(readFileSync(join(testLogDir, files[0]), "utf-8"));

      expect(logEntry.component).toBe("SyncService");
    });

    it("captures related story/agent IDs", async () => {
      await errorLogger.logError(new Error("Test"), {
        storyId: "4-2-error-logging",
        agentId: "ao-4-2-test",
      });

      const files = readdirSync(testLogDir);
      const logEntry = JSON.parse(readFileSync(join(testLogDir, files[0]), "utf-8"));

      expect(logEntry.storyId).toBe("4-2-error-logging");
      expect(logEntry.agentId).toBe("ao-4-2-test");
    });

    it("captures request/correlation ID", async () => {
      await errorLogger.logError(new Error("Test"), {
        component: "APIService",
        correlationId: "req-123-abc",
      });

      const files = readdirSync(testLogDir);
      const logEntry = JSON.parse(readFileSync(join(testLogDir, files[0]), "utf-8"));

      expect(logEntry.correlationId).toBe("req-123-abc");
    });

    it("captures state snapshot", async () => {
      const error = new Error("Test");

      await errorLogger.logError(error, {
        component: "StateService",
        stateSnapshot: {
          currentState: "processing",
          itemsProcessed: 100,
          failureReason: "timeout",
        },
      });

      const files = readdirSync(testLogDir);
      const logEntry = JSON.parse(readFileSync(join(testLogDir, files[0]), "utf-8"));

      expect(logEntry.stateSnapshot).toBeDefined();
      expect(logEntry.stateSnapshot.currentState).toBe("processing");
    });
  });

  describe("operation context storage", () => {
    beforeEach(() => {
      errorLogger = createErrorLogger({ logDir: testLogDir });
    });

    it("stores operation type and payload in error log", async () => {
      const error = new Error("Sync failed");
      await errorLogger.logError(error, {
        component: "SyncService",
        operationType: "bmad_sync",
        operationPayload: { storyId: "4-5-test", action: "update_status" },
      });

      const files = readdirSync(testLogDir);
      const logContent = readFileSync(join(testLogDir, files[0]), "utf-8");
      const logEntry = JSON.parse(logContent);

      expect(logEntry.operationType).toBe("bmad_sync");
      expect(logEntry.operationPayload).toEqual({ storyId: "4-5-test", action: "update_status" });
      expect(logEntry.retryCount).toBe(0);
    });

    it("redacts secrets in operation payload", async () => {
      const error = new Error("API call failed");
      await errorLogger.logError(error, {
        component: "APIService",
        operationType: "event_publish",
        operationPayload: {
          eventType: "story.completed",
          apiKey: "test-fake-key-not-real", // gitleaks:allow
        },
      });

      const files = readdirSync(testLogDir);
      const logContent = readFileSync(join(testLogDir, files[0]), "utf-8");
      const logEntry = JSON.parse(logContent);

      expect(logEntry.operationPayload.apiKey).toBe("[REDACTED: api_key]");
    });

    it("returns retryable errors with operation context", async () => {
      // Log an error with operation context
      await errorLogger.logError(new Error("Error 1"), {
        component: "TestService",
        operationType: "op1",
        operationPayload: { data: "test1" },
      });

      // Log an error without operation context
      await errorLogger.logError(new Error("Error 2"), {
        component: "TestService",
      });

      // Log another error with operation context
      await errorLogger.logError(new Error("Error 3"), {
        component: "TestService",
        operationType: "op3",
        operationPayload: { data: "test3" },
      });

      const retryableErrors = errorLogger.getRetryableErrors();

      expect(retryableErrors.length).toBe(2);
      expect(retryableErrors[0].operationType).toBe("op1");
      expect(retryableErrors[1].operationType).toBe("op3");
    });
  });

  describe("retry handlers", () => {
    beforeEach(() => {
      errorLogger = createErrorLogger({ logDir: testLogDir });
    });

    it("registers and executes retry handler", async () => {
      const handler = vi.fn().mockResolvedValue(true);

      errorLogger.registerRetryHandler("test_op", handler);

      await errorLogger.logError(new Error("Test error"), {
        component: "TestService",
        operationType: "test_op",
        operationPayload: { value: 123 },
        context: { requestId: "req-1" },
      });

      // Get the error ID
      const errors = errorLogger.getErrors();
      const errorId = (errors[0] as { errorId: string }).errorId;

      // Retry the operation
      const result = await errorLogger.retryFromErrorId(errorId);

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalledWith("test_op", { value: 123 });
    });

    it("increments retry count on each retry", async () => {
      errorLogger.registerRetryHandler("test_op", async () => true);

      await errorLogger.logError(new Error("Test error"), {
        component: "TestService",
        operationType: "test_op",
        operationPayload: { value: 123 },
      });

      const errors = errorLogger.getErrors();
      const entry = errors[0] as { errorId: string; retryCount: number };
      expect(entry.retryCount).toBe(0);

      await errorLogger.retryFromErrorId(entry.errorId);
      expect(entry.retryCount).toBe(1);

      await errorLogger.retryFromErrorId(entry.errorId);
      expect(entry.retryCount).toBe(2);
    });

    it("returns error when error not found", async () => {
      const result = await errorLogger.retryFromErrorId("nonexistent-id");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Error not found");
    });

    it("returns error when error has no operation type", async () => {
      await errorLogger.logError(new Error("No op type"), {
        component: "TestService",
      });

      const errors = errorLogger.getErrors();
      const errorId = (errors[0] as { errorId: string }).errorId;

      const result = await errorLogger.retryFromErrorId(errorId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("no operation type");
    });

    it("returns error when no handler registered for operation type", async () => {
      await errorLogger.logError(new Error("Unknown op"), {
        component: "TestService",
        operationType: "unknown_op",
        operationPayload: { data: "test" },
      });

      const errors = errorLogger.getErrors();
      const errorId = (errors[0] as { errorId: string }).errorId;

      const result = await errorLogger.retryFromErrorId(errorId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No retry handler registered");
    });

    it("handles handler errors gracefully", async () => {
      errorLogger.registerRetryHandler("failing_op", async () => {
        throw new Error("Handler failed");
      });

      await errorLogger.logError(new Error("Test error"), {
        component: "TestService",
        operationType: "failing_op",
        operationPayload: { data: "test" },
      });

      const errors = errorLogger.getErrors();
      const errorId = (errors[0] as { errorId: string }).errorId;

      const result = await errorLogger.retryFromErrorId(errorId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Handler failed");
    });
  });

  describe("severity classification", () => {
    beforeEach(() => {
      errorLogger = createErrorLogger({ logDir: testLogDir });
    });

    it("classifies ECONNREFUSED errors as critical", async () => {
      const error = new Error("connect ECONNREFUSED 127.0.0.1:3000");
      await errorLogger.logError(error, { component: "SyncService" });

      const entry = getFirstEntry(errorLogger);
      assertSeverity(entry, "critical");
    });

    it("classifies ECONNRESET errors as critical", async () => {
      const error = new Error("read ECONNRESET");
      await errorLogger.logError(error, { component: "APIService" });

      const entry = getFirstEntry(errorLogger);
      assertSeverity(entry, "critical");
    });

    it("classifies ETIMEDOUT errors as critical", async () => {
      const error = new Error("connect ETIMEDOUT 10.0.0.1:443");
      await errorLogger.logError(error, { component: "APIService" });

      const entry = getFirstEntry(errorLogger);
      assertSeverity(entry, "critical");
    });

    it("classifies ENOSPC errors as fatal", async () => {
      const error = new Error("ENOSPC: no space left on device");
      await errorLogger.logError(error, { component: "StateManager" });

      const entry = getFirstEntry(errorLogger);
      assertSeverity(entry, "fatal");
    });

    it("classifies ENOMEM errors as fatal", async () => {
      const error = new Error("ENOMEM: not enough memory");
      await errorLogger.logError(error, { component: "AgentManager" });

      const entry = getFirstEntry(errorLogger);
      assertSeverity(entry, "fatal");
    });

    it("classifies ConflictError as warning", async () => {
      const error = new Error("Version conflict detected");
      await errorLogger.logError(error, { component: "StateManager", type: "ConflictError" });

      const entry = getFirstEntry(errorLogger);
      assertSeverity(entry, "warning");
    });

    it("classifies SyntaxError as warning", async () => {
      const error = new SyntaxError("Unexpected token in JSON");
      await errorLogger.logError(error, { component: "ConfigLoader" });

      const entry = getFirstEntry(errorLogger);
      assertSeverity(entry, "warning");
    });

    it("classifies unknown errors as warning (safe default)", async () => {
      const error = new Error("Something unexpected happened");
      await errorLogger.logError(error, { component: "Unknown" });

      const entry = getFirstEntry(errorLogger);
      assertSeverity(entry, "warning");
    });

    it("bumps event-bus component errors to critical", async () => {
      const error = new Error("Some random error");
      await errorLogger.logError(error, { component: "event-bus" });

      const entry = getFirstEntry(errorLogger);
      assertSeverity(entry, "critical");
    });

    it("bumps lifecycle component errors to critical", async () => {
      const error = new Error("Lifecycle failure");
      await errorLogger.logError(error, { component: "lifecycle" });

      const entry = getFirstEntry(errorLogger);
      assertSeverity(entry, "critical");
    });

    it("allows manual severity override via options", async () => {
      const error = new Error("Not that bad");
      await errorLogger.logError(error, { component: "TestService", severity: "info" });

      const entry = getFirstEntry(errorLogger);
      assertSeverity(entry, "info");
    });

    it("includes severity in persisted JSON file", async () => {
      const error = new Error("ENOSPC: disk full");
      await errorLogger.logError(error, { component: "StateManager" });

      const files = readdirSync(testLogDir);
      const logContent = readFileSync(join(testLogDir, files[0]), "utf-8");
      const logEntry = JSON.parse(logContent);

      expect(logEntry.severity).toBe("fatal");
    });
  });

  describe("structured error codes", () => {
    beforeEach(() => {
      errorLogger = createErrorLogger({ logDir: testLogDir });
    });

    it("assigns ERR-EVENTBUS-001 for event bus connection errors", async () => {
      const error = new Error("connect ECONNREFUSED 127.0.0.1:3000");
      await errorLogger.logError(error, { component: "event-bus" });

      const entry = getFirstEntry(errorLogger);
      expect(entry.errorCode).toBe("ERR-EVENTBUS-001");
    });

    it("assigns ERR-CONFLICT-001 when ConflictError type takes priority over sync component", async () => {
      const error = new Error("Version conflict detected");
      await errorLogger.logError(error, { component: "sync", type: "ConflictError" });

      const entry = getFirstEntry(errorLogger);
      expect(entry.errorCode).toBe("ERR-CONFLICT-001");
    });

    it("assigns ERR-META-001 for metadata corruption", async () => {
      const error = new Error("Metadata file corrupted");
      await errorLogger.logError(error, { component: "metadata" });

      const entry = getFirstEntry(errorLogger);
      expect(entry.errorCode).toBe("ERR-META-001");
    });

    it("assigns ERR-UNKNOWN-000 for unrecognized errors", async () => {
      const error = new Error("Something completely unknown");
      await errorLogger.logError(error, { component: "SomeService" });

      const entry = getFirstEntry(errorLogger);
      expect(entry.errorCode).toBe("ERR-UNKNOWN-000");
    });

    it("allows manual errorCode override via options", async () => {
      const error = new Error("Custom error");
      await errorLogger.logError(error, { component: "TestService", errorCode: "ERR-CUSTOM-999" });

      const entry = getFirstEntry(errorLogger);
      expect(entry.errorCode).toBe("ERR-CUSTOM-999");
    });

    it("includes errorCode in persisted JSON file", async () => {
      const error = new Error("ENOSPC: no space left on device");
      await errorLogger.logError(error, { component: "StateManager" });

      const files = readdirSync(testLogDir);
      const logContent = readFileSync(join(testLogDir, files[0]), "utf-8");
      const logEntry = JSON.parse(logContent);

      expect(logEntry.errorCode).toBeDefined();
      expect(logEntry.errorCode).toMatch(/^ERR-/);
    });
  });

  describe("JSONL append-only logging", () => {
    beforeEach(() => {
      errorLogger = createErrorLogger({ logDir: testLogDir, jsonlPath: testJsonlPath });
    });

    it("appends error as JSON line to JSONL file", async () => {
      await errorLogger.logError(new Error("Test"), { component: "TestService" });

      const lines = readJsonlLines(testJsonlPath);
      expect(lines.length).toBe(1);
      expect((lines[0] as { message: string }).message).toBe("Test");
    });

    it("appends multiple errors as separate lines", async () => {
      await errorLogger.logError(new Error("Error 1"), { component: "Svc" });
      await errorLogger.logError(new Error("Error 2"), { component: "Svc" });
      await errorLogger.logError(new Error("Error 3"), { component: "Svc" });

      const lines = readJsonlLines(testJsonlPath);
      expect(lines.length).toBe(3);
    });

    it("each JSONL line is valid JSON with severity and errorCode", async () => {
      await errorLogger.logError(new Error("ECONNREFUSED"), { component: "event-bus" });

      const lines = readJsonlLines(testJsonlPath);
      const entry = lines[0] as { severity: string; errorCode: string };
      expect(entry.severity).toBe("critical");
      expect(entry.errorCode).toBe("ERR-EVENTBUS-001");
    });

    it("does not write JSONL when jsonlPath not configured", async () => {
      const logger = createErrorLogger({ logDir: testLogDir });
      await logger.logError(new Error("No JSONL"), { component: "Svc" });

      expect(existsSync(testJsonlPath)).toBe(false);
      await logger.close();
    });

    it("rotates JSONL file when size exceeds threshold", async () => {
      const smallLogger = createErrorLogger({
        logDir: testLogDir,
        jsonlPath: testJsonlPath,
        config: { maxLogFileSizeBytes: 500 },
      });

      // Write enough to exceed 500 bytes
      for (let i = 0; i < 10; i++) {
        await smallLogger.logError(new Error(`Error ${i} with padding`), { component: "Svc" });
      }

      // After rotation, there should be at least one rotated file
      const files = readdirSync(testLogDir).filter(
        (f) => f.startsWith("errors-") && f.endsWith(".jsonl"),
      );
      expect(files.length).toBeGreaterThanOrEqual(1);

      // Current file should still exist and be smaller than threshold
      expect(existsSync(testJsonlPath)).toBe(true);
      const size = statSync(testJsonlPath).size;
      expect(size).toBeLessThan(1000);
      await smallLogger.close();
    });

    it("redacts secrets in JSONL output", async () => {
      await errorLogger.logError(new Error("Fail"), {
        component: "AuthSvc",
        context: { password: "secret123" },
      });

      const lines = readJsonlLines(testJsonlPath);
      const entry = lines[0] as { context: { password: string } };
      expect(entry.context.password).toBe("[REDACTED: password]");
    });

    it("preserves per-file JSON logging alongside JSONL", async () => {
      await errorLogger.logError(new Error("Both"), { component: "Svc" });

      // Per-file JSON still written
      const jsonFiles = readdirSync(testLogDir).filter((f) => f.endsWith(".json"));
      expect(jsonFiles.length).toBe(1);

      // JSONL also written
      const lines = readJsonlLines(testJsonlPath);
      expect(lines.length).toBe(1);
    });
  });

  describe("cleanup", () => {
    it("closes all resources gracefully", async () => {
      const logger = createErrorLogger({ logDir: testLogDir });

      await logger.close();

      // Should not throw on close
      await expect(logger.close()).resolves.not.toThrow();
    });
  });

  describe("custom classification rules", () => {
    afterEach(() => {
      clearClassificationRules();
    });

    it("custom rule matches before hardcoded patterns", async () => {
      registerClassificationRule({
        name: "custom-timeout",
        messagePattern: /custom timeout/i,
        components: ["my-service"],
        severity: "fatal",
        errorCode: "ERR-CUSTOM-001",
        priority: 10,
      });

      const logger = createErrorLogger({ logDir: testLogDir });
      await logger.logError(new Error("Custom timeout occurred"), {
        component: "my-service",
      });

      const errors = logger.getErrors();
      expect(errors.length).toBeGreaterThan(0);
      const last = errors[errors.length - 1];
      expect((last as unknown as Record<string, unknown>).severity).toBe("fatal");
      expect((last as unknown as Record<string, unknown>).errorCode).toBe("ERR-CUSTOM-001");
    });

    it("higher priority rules checked first", async () => {
      registerClassificationRule({
        name: "low-priority",
        messagePattern: /test error/i,
        severity: "info",
        errorCode: "ERR-LOW-001",
        priority: 1,
      });

      registerClassificationRule({
        name: "high-priority",
        messagePattern: /test error/i,
        severity: "critical",
        errorCode: "ERR-HIGH-001",
        priority: 10,
      });

      const logger = createErrorLogger({ logDir: testLogDir });
      await logger.logError(new Error("test error"), { component: "any" });

      const errors = logger.getErrors();
      const last = errors[errors.length - 1];
      expect((last as unknown as Record<string, unknown>).severity).toBe("critical");
      expect((last as unknown as Record<string, unknown>).errorCode).toBe("ERR-HIGH-001");
    });

    it("clearClassificationRules resets to default behavior", async () => {
      registerClassificationRule({
        name: "custom",
        messagePattern: /ECONNREFUSED/i,
        severity: "info",
        errorCode: "ERR-CUSTOM-999",
        priority: 100,
      });

      clearClassificationRules();

      const logger = createErrorLogger({ logDir: testLogDir });
      await logger.logError(new Error("ECONNREFUSED"), { component: "event-bus" });

      const errors = logger.getErrors();
      const last = errors[errors.length - 1];
      // Should use default classification (critical for ECONNREFUSED)
      expect((last as unknown as Record<string, unknown>).severity).toBe("critical");
      expect((last as unknown as Record<string, unknown>).errorCode).toBe("ERR-EVENTBUS-001");
    });

    it("falls back to hardcoded when no custom rules match", async () => {
      registerClassificationRule({
        name: "unrelated",
        messagePattern: /completely different/i,
        components: ["other-service"],
        severity: "fatal",
        errorCode: "ERR-OTHER-001",
      });

      const logger = createErrorLogger({ logDir: testLogDir });
      await logger.logError(new Error("ENOSPC disk full"), {});

      const errors = logger.getErrors();
      const last = errors[errors.length - 1];
      // Default classification: ENOSPC = fatal
      expect((last as unknown as Record<string, unknown>).severity).toBe("fatal");
    });
  });
});
