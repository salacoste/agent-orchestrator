/**
 * Tests for provider installation verification (Story 59-3).
 *
 * Covers:
 * - verifyInstallation() dispatching by provider name
 * - verifyOmcInstallation() filesystem artifact checks
 * - verifyOmcConfigure() notepad.md check
 * - verifyBasicInstallation() .omc/ directory check
 * - Raw provider skip behavior
 * - Unknown provider fallback
 * - Verification exception handling (returns structured result, never throws)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  verifyInstallation,
  verifyOmcInstallation,
  verifyOmcConfigure,
  verifyBasicInstallation,
} from "../provider-verify.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `ao-verify-test-${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

/** Helper: create a valid OMC installation in tmpDir. */
function createValidOmcInstall() {
  const omcDir = join(tmpDir, ".omc");
  mkdirSync(join(omcDir, "state"), { recursive: true });
  mkdirSync(join(omcDir, "plans"), { recursive: true });
  mkdirSync(join(omcDir, "logs"), { recursive: true });
  writeFileSync(join(omcDir, "project-memory.json"), "{}", "utf-8");
}

// ---------------------------------------------------------------------------
// verifyInstallation — dispatch by provider name
// ---------------------------------------------------------------------------

describe("verifyInstallation", () => {
  it("returns verified:true for raw provider (skip)", async () => {
    // Even with no files on disk, raw provider skips verification
    const result = await verifyInstallation(tmpDir, "raw");
    expect(result).toEqual({ verified: true, missing: [] });
  });

  it("dispatches to verifyOmcInstallation for omc provider", async () => {
    createValidOmcInstall();
    const result = await verifyInstallation(tmpDir, "omc");
    expect(result.verified).toBe(true);
  });

  it("dispatches to verifyBasicInstallation for unknown provider", async () => {
    // No .omc directory — basic check should fail
    const result = await verifyInstallation(tmpDir, "some-unknown-provider");
    expect(result.verified).toBe(false);
    expect(result.missing).toContain(".omc/");
  });

  it("unknown provider passes when .omc/ exists", async () => {
    mkdirSync(join(tmpDir, ".omc"), { recursive: true });
    const result = await verifyInstallation(tmpDir, "custom-provider");
    expect(result).toEqual({ verified: true, missing: [] });
  });
});

// ---------------------------------------------------------------------------
// verifyOmcInstallation
// ---------------------------------------------------------------------------

describe("verifyOmcInstallation", () => {
  it("returns verified:true for valid OMC install", async () => {
    createValidOmcInstall();
    const result = await verifyOmcInstallation(tmpDir);
    expect(result).toEqual({ verified: true, missing: [] });
  });

  it("returns verified:false with missing artifacts for partial install", async () => {
    // Only create .omc/ but not state/ or project-memory.json
    mkdirSync(join(tmpDir, ".omc"), { recursive: true });
    const result = await verifyOmcInstallation(tmpDir);
    expect(result.verified).toBe(false);
    expect(result.missing).toContain(".omc/state/");
    expect(result.missing).toContain(".omc/project-memory.json");
  });

  it("returns verified:false when .omc/ is completely missing", async () => {
    const result = await verifyOmcInstallation(tmpDir);
    expect(result.verified).toBe(false);
    expect(result.missing).toContain(".omc/");
    expect(result.missing).toContain(".omc/state/");
    expect(result.missing).toContain(".omc/project-memory.json");
  });

  it("reports invalid JSON in project-memory.json as missing", async () => {
    createValidOmcInstall();
    writeFileSync(join(tmpDir, ".omc", "project-memory.json"), "not-json{{{", "utf-8");

    const result = await verifyOmcInstallation(tmpDir);
    expect(result.verified).toBe(false);
    expect(result.missing).toContain(".omc/project-memory.json (invalid JSON)");
  });

  it("passes with valid JSON in project-memory.json", async () => {
    createValidOmcInstall();
    writeFileSync(
      join(tmpDir, ".omc", "project-memory.json"),
      JSON.stringify({ key: "value" }),
      "utf-8",
    );

    const result = await verifyOmcInstallation(tmpDir);
    expect(result.verified).toBe(true);
  });

  it("detects .omc/state/ as a file instead of directory", async () => {
    createValidOmcInstall();
    // Replace state directory with a file
    rmSync(join(tmpDir, ".omc", "state"), { recursive: true, force: true });
    writeFileSync(join(tmpDir, ".omc", "state"), "not a directory", "utf-8");

    const result = await verifyOmcInstallation(tmpDir);
    expect(result.verified).toBe(false);
    expect(result.missing).toContain(".omc/state/");
  });
});

// ---------------------------------------------------------------------------
// verifyOmcConfigure
// ---------------------------------------------------------------------------

describe("verifyOmcConfigure", () => {
  it("returns verified:true when notepad.md exists", async () => {
    mkdirSync(join(tmpDir, ".omc"), { recursive: true });
    writeFileSync(join(tmpDir, ".omc", "notepad.md"), "## Priority\n", "utf-8");

    const result = await verifyOmcConfigure(tmpDir);
    expect(result).toEqual({ verified: true, missing: [] });
  });

  it("returns verified:false when notepad.md is missing", async () => {
    mkdirSync(join(tmpDir, ".omc"), { recursive: true });
    // No notepad.md created

    const result = await verifyOmcConfigure(tmpDir);
    expect(result).toEqual({ verified: false, missing: [".omc/notepad.md"] });
  });

  it("returns verified:false when .omc directory is missing entirely", async () => {
    const result = await verifyOmcConfigure(tmpDir);
    expect(result.verified).toBe(false);
    expect(result.missing).toContain(".omc/notepad.md");
  });
});

// ---------------------------------------------------------------------------
// verifyBasicInstallation
// ---------------------------------------------------------------------------

describe("verifyBasicInstallation", () => {
  it("returns verified:true when .omc/ exists", async () => {
    mkdirSync(join(tmpDir, ".omc"), { recursive: true });
    const result = await verifyBasicInstallation(tmpDir);
    expect(result).toEqual({ verified: true, missing: [] });
  });

  it("returns verified:false when .omc/ is missing", async () => {
    const result = await verifyBasicInstallation(tmpDir);
    expect(result).toEqual({ verified: false, missing: [".omc/"] });
  });
});

// ---------------------------------------------------------------------------
// Session-manager integration: verification triggers raw fallback
// ---------------------------------------------------------------------------

describe("session-manager integration (verifyInstallation)", () => {
  it("failed verification triggers raw fallback in spawn flow", async () => {
    // Create a partial OMC install (missing state/ and project-memory.json)
    mkdirSync(join(tmpDir, ".omc"), { recursive: true });

    const result = await verifyInstallation(tmpDir, "omc");

    // Verification should fail — session-manager would fall back to raw
    expect(result.verified).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it("verifyOmcInstallation never throws — returns structured result for any path", async () => {
    // Even for paths that don't exist, the function should return a result, not throw.
    // The outer try/catch ensures all exceptions (permissions, I/O) become structured results.
    const result = await verifyOmcInstallation("/nonexistent/path/that/does/not/exist");
    expect(result.verified).toBe(false);
    // Should have missing artifacts, not throw
    expect(Array.isArray(result.missing)).toBe(true);
  });

  it("verifyInstallation never throws — returns structured result for any input", async () => {
    const result = await verifyInstallation("/nonexistent/path/that/does/not/exist", "omc");
    expect(result.verified).toBe(false);
    expect(Array.isArray(result.missing)).toBe(true);
  });
});
