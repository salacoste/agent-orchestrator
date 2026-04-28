/**
 * Verification Retry core module tests.
 * Story 61-4, AC #2-5, #7-8.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VerificationConfig, VerificationResult } from "../types.js";

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
  getVerificationRetryCount,
  storeVerificationRetryAttempt,
  loadVerificationRetryHistory,
  writeRetryContextToNotepad,
  scheduleVerificationRetry,
} from "../verification/index.js";
import { readMetadataRaw, updateMetadata } from "../metadata.js";
import { appendFileSync, writeFileSync, existsSync } from "node:fs";

const mockReadMetadataRaw = vi.mocked(readMetadataRaw);
const mockUpdateMetadata = vi.mocked(updateMetadata);
const mockAppendFileSync = vi.mocked(appendFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockExistsSync = vi.mocked(existsSync);

const FAILED_RESULT: VerificationResult = {
  passed: false,
  checks: [
    {
      type: "test",
      command: "pnpm test",
      passed: false,
      exitCode: 1,
      stdout: "",
      stderr: "FAIL src/foo.test.ts",
      duration: 100,
      required: true,
    },
    {
      type: "lint",
      command: "pnpm lint",
      passed: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
      duration: 50,
      required: true,
    },
  ],
  ranAt: "2026-04-18T12:00:00Z",
  duration: 150,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getVerificationRetryCount ─────────────────────────────────────────────────

describe("getVerificationRetryCount", () => {
  it("returns 0 when metadata is null", () => {
    mockReadMetadataRaw.mockReturnValue(null);
    expect(getVerificationRetryCount("/sessions", "s1")).toBe(0);
  });

  it("returns 0 when retry count key is missing", () => {
    mockReadMetadataRaw.mockReturnValue({ worktree: "/tmp" });
    expect(getVerificationRetryCount("/sessions", "s1")).toBe(0);
  });

  it("returns parsed count when present", () => {
    mockReadMetadataRaw.mockReturnValue({ verification_retry_count: "2" });
    expect(getVerificationRetryCount("/sessions", "s1")).toBe(2);
  });

  it("returns 0 for non-numeric value", () => {
    mockReadMetadataRaw.mockReturnValue({ verification_retry_count: "abc" });
    expect(getVerificationRetryCount("/sessions", "s1")).toBe(0);
  });

  it("returns 0 when readMetadataRaw throws", () => {
    mockReadMetadataRaw.mockImplementation(() => {
      throw new Error("disk error");
    });
    expect(getVerificationRetryCount("/sessions", "s1")).toBe(0);
  });
});

// ── loadVerificationRetryHistory ──────────────────────────────────────────────

describe("loadVerificationRetryHistory", () => {
  it("returns empty array when metadata is null", () => {
    mockReadMetadataRaw.mockReturnValue(null);
    expect(loadVerificationRetryHistory("/sessions", "s1")).toEqual([]);
  });

  it("returns empty array when no history stored", () => {
    mockReadMetadataRaw.mockReturnValue({ worktree: "/tmp" });
    expect(loadVerificationRetryHistory("/sessions", "s1")).toEqual([]);
  });

  it("returns parsed history when present", () => {
    const history = [{ attempt: 1, ranAt: "2026-04-18T12:00:00Z", result: FAILED_RESULT }];
    mockReadMetadataRaw.mockReturnValue({
      verification_retry_history: JSON.stringify(history),
    });
    expect(loadVerificationRetryHistory("/sessions", "s1")).toEqual(history);
  });

  it("returns empty array for malformed JSON", () => {
    mockReadMetadataRaw.mockReturnValue({
      verification_retry_history: "not-json",
    });
    expect(loadVerificationRetryHistory("/sessions", "s1")).toEqual([]);
  });
});

// ── storeVerificationRetryAttempt ─────────────────────────────────────────────

describe("storeVerificationRetryAttempt", () => {
  it("appends attempt to empty history", () => {
    mockReadMetadataRaw.mockReturnValue({});
    const attempt = { attempt: 1, ranAt: "2026-04-18T12:00:00Z", result: FAILED_RESULT };

    storeVerificationRetryAttempt("/sessions", "s1", attempt);

    expect(mockUpdateMetadata).toHaveBeenCalledWith("/sessions", "s1", {
      verification_retry_count: "1",
      verification_retry_history: JSON.stringify([attempt]),
    });
  });

  it("appends attempt to existing history", () => {
    const existing = [{ attempt: 1, ranAt: "2026-04-18T12:00:00Z", result: FAILED_RESULT }];
    mockReadMetadataRaw.mockReturnValue({
      verification_retry_history: JSON.stringify(existing),
    });
    const newAttempt = { attempt: 2, ranAt: "2026-04-18T12:05:00Z", result: FAILED_RESULT };

    storeVerificationRetryAttempt("/sessions", "s1", newAttempt);

    expect(mockUpdateMetadata).toHaveBeenCalledWith("/sessions", "s1", {
      verification_retry_count: "2",
      verification_retry_history: JSON.stringify([...existing, newAttempt]),
    });
  });

  it("silently handles read failure", () => {
    mockReadMetadataRaw.mockImplementation(() => {
      throw new Error("disk full");
    });

    // Should not throw
    expect(() =>
      storeVerificationRetryAttempt("/sessions", "s1", {
        attempt: 1,
        ranAt: "2026-04-18T12:00:00Z",
        result: FAILED_RESULT,
      }),
    ).not.toThrow();
  });

  it("silently handles update failure", () => {
    mockReadMetadataRaw.mockReturnValue({});
    mockUpdateMetadata.mockImplementation(() => {
      throw new Error("write error");
    });

    expect(() =>
      storeVerificationRetryAttempt("/sessions", "s1", {
        attempt: 1,
        ranAt: "2026-04-18T12:00:00Z",
        result: FAILED_RESULT,
      }),
    ).not.toThrow();
  });
});

// ── writeRetryContextToNotepad ────────────────────────────────────────────────

describe("writeRetryContextToNotepad", () => {
  it("skips when worktreePath is undefined", () => {
    writeRetryContextToNotepad(undefined, FAILED_RESULT, 1);
    expect(mockAppendFileSync).not.toHaveBeenCalled();
  });

  it("creates .omc dir and notepad if missing", () => {
    mockExistsSync.mockReturnValue(false);

    writeRetryContextToNotepad("/tmp/worktree", FAILED_RESULT, 1);

    // Should have created .omc dir
    expect(mockAppendFileSync).toHaveBeenCalled();
    // writeFileSync creates the notepad header for new files
    expect(mockWriteFileSync).toHaveBeenCalled();
    const writeCall = mockWriteFileSync.mock.calls[0]!;
    expect(writeCall[1]).toContain("Session Notepad");
  });

  it("appends retry context with failed check details", () => {
    mockExistsSync.mockReturnValue(true);

    writeRetryContextToNotepad("/tmp/worktree", FAILED_RESULT, 2);

    const lastCall = mockAppendFileSync.mock.calls.at(-1)!;
    const content = lastCall[1] as string;
    expect(content).toContain("Verification Retry Context (Attempt 2)");
    expect(content).toContain("Failed Checks");
    expect(content).toContain("test");
    expect(content).toContain("pnpm test");
    expect(content).toContain("Passing Checks");
    expect(content).toContain("lint");
  });

  it("omits Passing Checks section when all checks fail", () => {
    const allFailed: VerificationResult = {
      passed: false,
      checks: [
        {
          type: "test",
          command: "pnpm test",
          passed: false,
          exitCode: 1,
          stdout: "",
          stderr: "fail",
          duration: 100,
          required: true,
        },
      ],
      ranAt: "2026-04-18T12:00:00Z",
      duration: 100,
    };
    mockExistsSync.mockReturnValue(true);

    writeRetryContextToNotepad("/tmp/worktree", allFailed, 1);

    const lastCall = mockAppendFileSync.mock.calls.at(-1)!;
    const content = lastCall[1] as string;
    expect(content).not.toContain("Passing Checks");
  });

  it("silently handles write failure", () => {
    mockExistsSync.mockImplementation(() => {
      throw new Error("permission denied");
    });

    expect(() => writeRetryContextToNotepad("/tmp/worktree", FAILED_RESULT, 1)).not.toThrow();
  });
});

// ── scheduleVerificationRetry ─────────────────────────────────────────────────

describe("scheduleVerificationRetry", () => {
  const baseConfig: VerificationConfig = {
    enabled: true,
    checks: [{ type: "test", command: "pnpm test", required: true }],
    onFailure: "review",
  };

  it("returns shouldRetry=false with blocked status when onFailure is block", () => {
    const config = { ...baseConfig, onFailure: "block" as const };
    mockReadMetadataRaw.mockReturnValue({});

    const result = scheduleVerificationRetry("/sessions", "s1", config);

    expect(result).toEqual({ shouldRetry: false, backoffMs: 5000 });
  });

  it("returns shouldRetry=true when under retry limit", () => {
    mockReadMetadataRaw.mockReturnValue({ verification_retry_count: "0" });

    const result = scheduleVerificationRetry("/sessions", "s1", baseConfig);

    expect(result).toEqual({ shouldRetry: true, backoffMs: 5000 });
  });

  it("returns shouldRetry=false when retry limit reached", () => {
    mockReadMetadataRaw.mockReturnValue({ verification_retry_count: "2" });

    const result = scheduleVerificationRetry("/sessions", "s1", {
      ...baseConfig,
      retry: { maxAttempts: 2 },
    });

    expect(result).toEqual({ shouldRetry: false, backoffMs: 5000 });
  });

  it("returns shouldRetry=false when retries disabled", () => {
    mockReadMetadataRaw.mockReturnValue({});
    const config = { ...baseConfig, retry: { enabled: false } };

    const result = scheduleVerificationRetry("/sessions", "s1", config);

    expect(result).toEqual({ shouldRetry: false, backoffMs: 5000 });
  });

  it("defaults to maxAttempts=2 when retry config missing", () => {
    mockReadMetadataRaw.mockReturnValue({ verification_retry_count: "1" });

    const result = scheduleVerificationRetry("/sessions", "s1", baseConfig);

    expect(result).toEqual({ shouldRetry: true, backoffMs: 5000 });
  });

  it("allows custom maxAttempts up to 5", () => {
    mockReadMetadataRaw.mockReturnValue({ verification_retry_count: "4" });
    const config = { ...baseConfig, retry: { maxAttempts: 5 } };

    const result = scheduleVerificationRetry("/sessions", "s1", config);

    expect(result).toEqual({ shouldRetry: true, backoffMs: 5000 });
  });

  it("returns custom backoffMs when configured", () => {
    mockReadMetadataRaw.mockReturnValue({ verification_retry_count: "0" });
    const config = { ...baseConfig, retry: { backoffMs: 10_000 } };

    const result = scheduleVerificationRetry("/sessions", "s1", config);

    expect(result).toEqual({ shouldRetry: true, backoffMs: 10_000 });
  });

  it("uses preloadedRetryCount to avoid metadata read", () => {
    const result = scheduleVerificationRetry("/sessions", "s1", baseConfig, 0);

    // Should not call readMetadataRaw since preloaded count provided
    expect(mockReadMetadataRaw).not.toHaveBeenCalled();
    expect(result).toEqual({ shouldRetry: true, backoffMs: 5000 });
  });

  it("respects preloadedRetryCount for limit check", () => {
    const result = scheduleVerificationRetry(
      "/sessions",
      "s1",
      {
        ...baseConfig,
        retry: { maxAttempts: 2 },
      },
      2,
    );

    expect(result).toEqual({ shouldRetry: false, backoffMs: 5000 });
  });
});
