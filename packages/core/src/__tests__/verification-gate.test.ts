/**
 * Verification Gate core module tests.
 * Story 61-3, AC #4, #7, #9, #10.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { execFile } from "node:child_process";
import type { VerificationConfig, VerificationResult } from "../types.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("../metadata.js", () => ({
  readMetadataRaw: vi.fn(),
  updateMetadata: vi.fn(),
}));

import {
  runVerification,
  storeVerificationResult,
  loadVerificationResult,
} from "../verification/index.js";
import { readMetadataRaw, updateMetadata } from "../metadata.js";

const mockExecFile = vi.mocked(execFile);
const mockReadMetadataRaw = vi.mocked(readMetadataRaw);
const mockUpdateMetadata = vi.mocked(updateMetadata);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExecCallback = (err: any, result: { stdout: string; stderr: string }) => void;

const SAMPLE_CONFIG: VerificationConfig = {
  enabled: true,
  checks: [
    { type: "test", command: "pnpm test", required: true },
    { type: "lint", command: "pnpm lint", required: true },
    { type: "typecheck", command: "pnpm typecheck", required: false },
  ],
  onFailure: "review",
};

function mockExecSuccess(stdout = "", stderr = "") {
  mockExecFile.mockImplementation(((
    _cmd: string,
    _args: string[],
    _opts: unknown,
    cb: ExecCallback,
  ) => {
    cb(null, { stdout, stderr });
  }) as unknown as typeof execFile);
}

function mockExecTimeout() {
  mockExecFile.mockImplementation(((
    _cmd: string,
    _args: string[],
    _opts: unknown,
    cb: ExecCallback,
  ) => {
    const err = new Error("Timed out") as Error & {
      killed: boolean;
      stdout: string;
      stderr: string;
    };
    err.killed = true;
    err.stdout = "";
    err.stderr = "Command timed out";
    cb(err, { stdout: "", stderr: "" });
  }) as unknown as typeof execFile);
}

/** Make a mock that succeeds on some calls and fails on others, based on failIndices */
function mockExecMixed(failIndices: number[]) {
  let callCount = 0;
  mockExecFile.mockImplementation(((
    _cmd: string,
    _args: string[],
    _opts: unknown,
    cb: ExecCallback,
  ) => {
    callCount++;
    if (failIndices.includes(callCount)) {
      const err = new Error("fail") as Error & {
        stderr: string;
        stdout: string;
        killed?: boolean;
      };
      err.stderr = "error";
      err.stdout = "";
      err.killed = false;
      cb(err, { stdout: "", stderr: "" });
    } else {
      cb(null, { stdout: "ok", stderr: "" });
    }
  }) as unknown as typeof execFile);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runVerification", () => {
  it("passes when all required checks pass", async () => {
    mockExecSuccess("ok", "");

    const result = await runVerification("/tmp/project", SAMPLE_CONFIG);

    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(3);
    expect(result.checks.every((c) => c.passed)).toBe(true);
    expect(result.ranAt).toBeTruthy();
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("fails when a required check fails", async () => {
    // First check (test) fails, rest pass
    mockExecMixed([1]);

    const result = await runVerification("/tmp/project", SAMPLE_CONFIG);

    expect(result.passed).toBe(false);
    expect(result.checks[0]!.passed).toBe(false);
    expect(result.checks[0]!.exitCode).toBe(1);
    expect(result.checks[1]!.passed).toBe(true);
  });

  it("passes when only optional checks fail", async () => {
    // Third check (typecheck, optional) fails
    mockExecMixed([3]);

    const result = await runVerification("/tmp/project", SAMPLE_CONFIG);

    expect(result.passed).toBe(true);
    expect(result.checks[2]!.passed).toBe(false);
    expect(result.checks[2]!.required).toBe(false);
  });

  it("handles check timeout with exitCode -1", async () => {
    mockExecTimeout();

    const result = await runVerification("/tmp/project", {
      enabled: true,
      checks: [{ type: "test", command: "pnpm test", required: true }],
    });

    expect(result.passed).toBe(false);
    expect(result.checks[0]!.exitCode).toBe(-1);
  });

  it("truncates stdout and stderr to ~500 chars", async () => {
    const longOutput = "x".repeat(2000);
    mockExecFile.mockImplementation(((
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: ExecCallback,
    ) => {
      cb(null, { stdout: longOutput, stderr: longOutput });
    }) as unknown as typeof execFile);

    const result = await runVerification("/tmp/project", {
      enabled: true,
      checks: [{ type: "custom", command: "echo hi", required: true }],
    });

    expect(result.checks[0]!.stdout.length).toBeLessThanOrEqual(500);
    expect(result.checks[0]!.stderr.length).toBeLessThanOrEqual(500);
  });

  it("computes passed correctly — only required checks matter", async () => {
    const config: VerificationConfig = {
      enabled: true,
      checks: [
        { type: "test", command: "pnpm test", required: true },
        { type: "lint", command: "pnpm lint", required: false },
      ],
    };

    // lint (optional, call 2) fails
    mockExecMixed([2]);

    const result = await runVerification("/tmp/project", config);

    expect(result.passed).toBe(true);
    expect(result.checks[0]!.passed).toBe(true);
    expect(result.checks[1]!.passed).toBe(false);
  });

  it("uses shell: true and cwd for execution", async () => {
    mockExecSuccess();

    await runVerification("/tmp/my-project", {
      enabled: true,
      checks: [{ type: "test", command: "pnpm test", required: true }],
    });

    expect(mockExecFile).toHaveBeenCalledWith(
      "pnpm test",
      [],
      expect.objectContaining({ cwd: "/tmp/my-project", shell: true, timeout: 120_000 }),
      expect.any(Function),
    );
  });
});

describe("storeVerificationResult", () => {
  it("stores result via updateMetadata", async () => {
    mockReadMetadataRaw.mockReturnValue({ worktree: "/tmp/wt" });
    const result: VerificationResult = {
      passed: true,
      checks: [],
      ranAt: "2026-04-18T00:00:00Z",
      duration: 100,
    };

    await storeVerificationResult("/sessions", "session-1", result);

    expect(mockUpdateMetadata).toHaveBeenCalledWith("/sessions", "session-1", {
      verification_result: JSON.stringify(result),
    });
  });

  it("skips silently when metadata unavailable", async () => {
    mockReadMetadataRaw.mockReturnValue(null);

    await storeVerificationResult("/sessions", "session-1", {
      passed: true,
      checks: [],
      ranAt: "2026-04-18T00:00:00Z",
      duration: 0,
    });

    expect(mockUpdateMetadata).not.toHaveBeenCalled();
  });

  it("handles updateMetadata throwing", async () => {
    mockReadMetadataRaw.mockReturnValue({ worktree: "/tmp" });
    mockUpdateMetadata.mockImplementation(() => {
      throw new Error("disk full");
    });

    // Should not throw
    await expect(
      storeVerificationResult("/sessions", "session-1", {
        passed: true,
        checks: [],
        ranAt: "2026-04-18T00:00:00Z",
        duration: 0,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("loadVerificationResult", () => {
  it("returns parsed result when present", () => {
    const stored: VerificationResult = {
      passed: false,
      checks: [
        {
          type: "test",
          command: "pnpm test",
          passed: false,
          exitCode: 1,
          stdout: "",
          stderr: "fail",
          duration: 50,
          required: true,
        },
      ],
      ranAt: "2026-04-18T00:00:00Z",
      duration: 50,
    };
    mockReadMetadataRaw.mockReturnValue({ verification_result: JSON.stringify(stored) });

    const result = loadVerificationResult("/sessions", "session-1");

    expect(result).toEqual(stored);
  });

  it("returns null when no result stored", () => {
    mockReadMetadataRaw.mockReturnValue({ worktree: "/tmp" });

    const result = loadVerificationResult("/sessions", "session-1");

    expect(result).toBeNull();
  });

  it("returns null when metadata missing", () => {
    mockReadMetadataRaw.mockReturnValue(null);

    const result = loadVerificationResult("/sessions", "session-1");

    expect(result).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    mockReadMetadataRaw.mockReturnValue({ verification_result: "not-json{" });

    const result = loadVerificationResult("/sessions", "session-1");

    expect(result).toBeNull();
  });

  it("round-trips store and load", async () => {
    const original: VerificationResult = {
      passed: true,
      checks: [
        {
          type: "lint",
          command: "pnpm lint",
          passed: true,
          exitCode: 0,
          stdout: "",
          stderr: "",
          duration: 200,
          required: true,
        },
      ],
      ranAt: "2026-04-18T12:00:00Z",
      duration: 200,
    };

    let storedData: Record<string, string> = {};
    mockReadMetadataRaw.mockImplementation(() => storedData);
    mockUpdateMetadata.mockImplementation(
      (_dir: string, _id: string, updates: Record<string, string>) => {
        storedData = { ...storedData, ...updates };
      },
    );

    await storeVerificationResult("/sessions", "s1", original);

    // Reset readMetadataRaw to return the stored data
    mockReadMetadataRaw.mockReturnValue(storedData);

    const loaded = loadVerificationResult("/sessions", "s1");
    expect(loaded).toEqual(original);
  });
});
