/**
 * Persistent Execution Mode tests.
 * Story 61-5 — persistent re-queue logic in verification-gate.ts.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VerificationConfig } from "../types.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:fs", () => ({
  appendFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:path", () => ({
  join: vi.fn((...args) => args.join("/")),
}));

vi.mock("../metadata.js", () => ({
  readMetadataRaw: vi.fn(),
  updateMetadata: vi.fn(),
}));

import {
  getExecutionMode,
  getPersistentRequeueCount,
  storePersistentRequeueAttempt,
  schedulePersistentRequeue,
} from "../verification/index.js";
import { readMetadataRaw, updateMetadata } from "../metadata.js";

const mockReadMetadataRaw = vi.mocked(readMetadataRaw);
const mockUpdateMetadata = vi.mocked(updateMetadata);

beforeEach(() => {
  vi.clearAllMocks();
});

const SESSIONS_DIR = "/tmp/sessions";
const SESSION_ID = "sess-001" as const;

// ── getExecutionMode ──────────────────────────────────────────────────────────

describe("getExecutionMode", () => {
  it("returns null when metadata is null", () => {
    mockReadMetadataRaw.mockReturnValue(null);
    expect(getExecutionMode(SESSIONS_DIR, SESSION_ID)).toBeNull();
  });

  it("returns null when ao:executionMode is not set", () => {
    mockReadMetadataRaw.mockReturnValue({});
    expect(getExecutionMode(SESSIONS_DIR, SESSION_ID)).toBeNull();
  });

  it("returns the execution mode string when set", () => {
    mockReadMetadataRaw.mockReturnValue({ "ao:executionMode": "persistent" });
    expect(getExecutionMode(SESSIONS_DIR, SESSION_ID)).toBe("persistent");
  });

  it("returns the value when ao:executionMode is a numeric string", () => {
    mockReadMetadataRaw.mockReturnValue({ "ao:executionMode": "42" });
    // It IS a string, so it should return it
    expect(getExecutionMode(SESSIONS_DIR, SESSION_ID)).toBe("42");
  });

  it("returns null on metadata read error", () => {
    mockReadMetadataRaw.mockImplementation(() => {
      throw new Error("read error");
    });
    expect(getExecutionMode(SESSIONS_DIR, SESSION_ID)).toBeNull();
  });
});

// ── getPersistentRequeueCount ─────────────────────────────────────────────────

describe("getPersistentRequeueCount", () => {
  it("returns 0 when metadata is null", () => {
    mockReadMetadataRaw.mockReturnValue(null);
    expect(getPersistentRequeueCount(SESSIONS_DIR, SESSION_ID)).toBe(0);
  });

  it("returns 0 when persistent_requeue_count is not set", () => {
    mockReadMetadataRaw.mockReturnValue({});
    expect(getPersistentRequeueCount(SESSIONS_DIR, SESSION_ID)).toBe(0);
  });

  it("returns parsed count when set", () => {
    mockReadMetadataRaw.mockReturnValue({ persistent_requeue_count: "3" });
    expect(getPersistentRequeueCount(SESSIONS_DIR, SESSION_ID)).toBe(3);
  });

  it("returns 0 for non-numeric value", () => {
    mockReadMetadataRaw.mockReturnValue({ persistent_requeue_count: "abc" });
    expect(getPersistentRequeueCount(SESSIONS_DIR, SESSION_ID)).toBe(0);
  });

  it("returns 0 on read error", () => {
    mockReadMetadataRaw.mockImplementation(() => {
      throw new Error("read error");
    });
    expect(getPersistentRequeueCount(SESSIONS_DIR, SESSION_ID)).toBe(0);
  });
});

// ── storePersistentRequeueAttempt ─────────────────────────────────────────────

describe("storePersistentRequeueAttempt", () => {
  it("increments count from 0 to 1", () => {
    mockReadMetadataRaw.mockReturnValue({ persistent_requeue_count: "0" });
    storePersistentRequeueAttempt(SESSIONS_DIR, SESSION_ID);
    expect(mockUpdateMetadata).toHaveBeenCalledWith(SESSIONS_DIR, SESSION_ID, {
      persistent_requeue_count: "1",
    });
  });

  it("increments count from 2 to 3", () => {
    mockReadMetadataRaw.mockReturnValue({ persistent_requeue_count: "2" });
    storePersistentRequeueAttempt(SESSIONS_DIR, SESSION_ID);
    expect(mockUpdateMetadata).toHaveBeenCalledWith(SESSIONS_DIR, SESSION_ID, {
      persistent_requeue_count: "3",
    });
  });

  it("handles missing count as 0", () => {
    mockReadMetadataRaw.mockReturnValue({});
    storePersistentRequeueAttempt(SESSIONS_DIR, SESSION_ID);
    expect(mockUpdateMetadata).toHaveBeenCalledWith(SESSIONS_DIR, SESSION_ID, {
      persistent_requeue_count: "1",
    });
  });

  it("does not throw on update error", () => {
    mockReadMetadataRaw.mockReturnValue({ persistent_requeue_count: "0" });
    mockUpdateMetadata.mockImplementation(() => {
      throw new Error("write error");
    });
    expect(() => storePersistentRequeueAttempt(SESSIONS_DIR, SESSION_ID)).not.toThrow();
  });
});

// ── schedulePersistentRequeue ─────────────────────────────────────────────────

describe("schedulePersistentRequeue", () => {
  const baseConfig: VerificationConfig = {
    enabled: true,
    checks: [{ type: "test", command: "pnpm test" }],
    persistent: {
      persistentMaxRetries: 5,
      persistentMaxExtensions: 3,
    },
  };

  it("does not requeue when execution mode is not persistent", () => {
    mockReadMetadataRaw.mockReturnValue({ "ao:executionMode": "standard" });
    const result = schedulePersistentRequeue(SESSIONS_DIR, SESSION_ID, baseConfig);
    expect(result).toEqual({ shouldRequeue: false, requeueCount: 0 });
  });

  it("does not requeue when execution mode is null", () => {
    mockReadMetadataRaw.mockReturnValue({});
    const result = schedulePersistentRequeue(SESSIONS_DIR, SESSION_ID, baseConfig);
    expect(result).toEqual({ shouldRequeue: false, requeueCount: 0 });
  });

  it("does not requeue when onFailure is block", () => {
    mockReadMetadataRaw.mockReturnValue({ "ao:executionMode": "persistent" });
    const blockConfig: VerificationConfig = {
      ...baseConfig,
      onFailure: "block",
    };
    const result = schedulePersistentRequeue(SESSIONS_DIR, SESSION_ID, blockConfig);
    expect(result).toEqual({ shouldRequeue: false, requeueCount: 0 });
  });

  it("requeues when persistent and under max retries", () => {
    mockReadMetadataRaw.mockReturnValue({
      "ao:executionMode": "persistent",
      persistent_requeue_count: "2",
    });
    const result = schedulePersistentRequeue(SESSIONS_DIR, SESSION_ID, baseConfig);
    expect(result).toEqual({ shouldRequeue: true, requeueCount: 2 });
  });

  it("does not requeue when persistent and at max retries", () => {
    mockReadMetadataRaw.mockReturnValue({
      "ao:executionMode": "persistent",
      persistent_requeue_count: "5",
    });
    const result = schedulePersistentRequeue(SESSIONS_DIR, SESSION_ID, baseConfig);
    expect(result).toEqual({ shouldRequeue: false, requeueCount: 5 });
  });

  it("does not requeue when persistent and over max retries", () => {
    mockReadMetadataRaw.mockReturnValue({
      "ao:executionMode": "persistent",
      persistent_requeue_count: "10",
    });
    const result = schedulePersistentRequeue(SESSIONS_DIR, SESSION_ID, baseConfig);
    expect(result).toEqual({ shouldRequeue: false, requeueCount: 10 });
  });

  it("uses default max retries (5) when persistent config is absent", () => {
    mockReadMetadataRaw.mockReturnValue({
      "ao:executionMode": "persistent",
      persistent_requeue_count: "4",
    });
    const noPersistentConfig: VerificationConfig = {
      enabled: true,
      checks: [{ type: "test", command: "pnpm test" }],
    };
    const result = schedulePersistentRequeue(SESSIONS_DIR, SESSION_ID, noPersistentConfig);
    expect(result).toEqual({ shouldRequeue: true, requeueCount: 4 });
  });

  it("rejects requeue at default max retries (5) when persistent config is absent", () => {
    mockReadMetadataRaw.mockReturnValue({
      "ao:executionMode": "persistent",
      persistent_requeue_count: "5",
    });
    const noPersistentConfig: VerificationConfig = {
      enabled: true,
      checks: [{ type: "test", command: "pnpm test" }],
    };
    const result = schedulePersistentRequeue(SESSIONS_DIR, SESSION_ID, noPersistentConfig);
    expect(result).toEqual({ shouldRequeue: false, requeueCount: 5 });
  });

  it("accepts preloadedRequeueCount to avoid metadata read", () => {
    mockReadMetadataRaw.mockReturnValue({
      "ao:executionMode": "persistent",
    });
    // Should NOT read persistent_requeue_count from metadata since preloaded
    const result = schedulePersistentRequeue(SESSIONS_DIR, SESSION_ID, baseConfig, 3);
    expect(result).toEqual({ shouldRequeue: true, requeueCount: 3 });
    // Verify it didn't try to read the count from metadata for the count
    // (it still reads for executionMode, but the count param was preloaded)
  });

  it("rejects preloaded count at max", () => {
    mockReadMetadataRaw.mockReturnValue({
      "ao:executionMode": "persistent",
    });
    const result = schedulePersistentRequeue(SESSIONS_DIR, SESSION_ID, baseConfig, 5);
    expect(result).toEqual({ shouldRequeue: false, requeueCount: 5 });
  });

  it("requeues with onFailure review (default)", () => {
    mockReadMetadataRaw.mockReturnValue({
      "ao:executionMode": "persistent",
      persistent_requeue_count: "0",
    });
    const reviewConfig: VerificationConfig = {
      ...baseConfig,
      onFailure: "review",
    };
    const result = schedulePersistentRequeue(SESSIONS_DIR, SESSION_ID, reviewConfig);
    expect(result).toEqual({ shouldRequeue: true, requeueCount: 0 });
  });

  it("handles metadata read error gracefully", () => {
    mockReadMetadataRaw.mockImplementation(() => {
      throw new Error("read error");
    });
    const result = schedulePersistentRequeue(SESSIONS_DIR, SESSION_ID, baseConfig);
    expect(result).toEqual({ shouldRequeue: false, requeueCount: 0 });
  });
});
