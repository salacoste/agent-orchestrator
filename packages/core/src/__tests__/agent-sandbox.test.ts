/**
 * Agent sandbox tests (Story 47.2).
 */
import { describe, expect, it } from "vitest";
import { checkAccess, globToRegex, type AgentSandboxConfig } from "../agent-sandbox.js";

describe("globToRegex", () => {
  it("matches exact path", () => {
    expect(globToRegex("src/index.ts").test("src/index.ts")).toBe(true);
    expect(globToRegex("src/index.ts").test("src/other.ts")).toBe(false);
  });

  it("matches single-level wildcard", () => {
    expect(globToRegex("src/*.ts").test("src/index.ts")).toBe(true);
    expect(globToRegex("src/*.ts").test("src/deep/index.ts")).toBe(false);
  });

  it("matches double-star glob (any depth)", () => {
    expect(globToRegex("src/**").test("src/index.ts")).toBe(true);
    expect(globToRegex("src/**").test("src/deep/nested/file.ts")).toBe(true);
    expect(globToRegex("src/**").test("lib/file.ts")).toBe(false);
  });

  it("matches pattern with extension", () => {
    expect(globToRegex("**/*.test.ts").test("src/foo.test.ts")).toBe(true);
    expect(globToRegex("**/*.test.ts").test("deep/nested/bar.test.ts")).toBe(true);
    expect(globToRegex("**/*.test.ts").test("src/foo.ts")).toBe(false);
  });

  it("escapes special regex chars", () => {
    expect(globToRegex("src/file.name.ts").test("src/file.name.ts")).toBe(true);
    expect(globToRegex("src/file.name.ts").test("src/fileXnameXts")).toBe(false);
  });

  it("handles ? single-char wildcard", () => {
    expect(globToRegex("src/?.ts").test("src/a.ts")).toBe(true);
    expect(globToRegex("src/?.ts").test("src/ab.ts")).toBe(false);
    expect(globToRegex("src/?.ts").test("src/.ts")).toBe(false); // ? requires exactly one char
  });

  it("does not throw on unusual glob patterns", () => {
    // Patterns with special chars are escaped — should not throw
    const regex = globToRegex("[invalid");
    expect(regex.test("[invalid")).toBe(true); // Escaped to literal match
    expect(regex.test("anything")).toBe(false);
  });
});

describe("checkAccess", () => {
  it("allows all when no config", () => {
    const result = checkAccess("any/file.ts");
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("No sandbox");
  });

  it("allows all when config has empty arrays", () => {
    const config: AgentSandboxConfig = { allowedPaths: [], deniedPaths: [] };
    const result = checkAccess("any/file.ts", config);
    expect(result.allowed).toBe(true);
  });

  it("allows file matching allowedPaths", () => {
    const config: AgentSandboxConfig = {
      allowedPaths: ["src/components/**"],
      deniedPaths: [],
    };

    expect(checkAccess("src/components/Button.tsx", config).allowed).toBe(true);
    expect(checkAccess("src/db/schema.ts", config).allowed).toBe(false);
  });

  it("denies file matching deniedPaths", () => {
    const config: AgentSandboxConfig = {
      allowedPaths: [],
      deniedPaths: ["src/db/**"],
    };

    expect(checkAccess("src/db/schema.ts", config).allowed).toBe(false);
    expect(checkAccess("src/components/Button.tsx", config).allowed).toBe(true);
  });

  it("deny overrides allow", () => {
    const config: AgentSandboxConfig = {
      allowedPaths: ["src/**"],
      deniedPaths: ["src/db/**"],
    };

    expect(checkAccess("src/components/Button.tsx", config).allowed).toBe(true);
    expect(checkAccess("src/db/schema.ts", config).allowed).toBe(false);
    expect(checkAccess("src/db/schema.ts", config).reason).toContain("Denied");
  });

  it("denies file not in allowedPaths when allowedPaths is non-empty", () => {
    const config: AgentSandboxConfig = {
      allowedPaths: ["src/components/**"],
      deniedPaths: [],
    };

    const result = checkAccess("src/utils/helper.ts", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not in allowedPaths");
  });

  it("includes pattern in reason", () => {
    const config: AgentSandboxConfig = {
      allowedPaths: ["src/components/**"],
      deniedPaths: ["src/db/**"],
    };

    const allowed = checkAccess("src/components/X.tsx", config);
    expect(allowed.reason).toContain("src/components/**");

    const denied = checkAccess("src/db/Y.ts", config);
    expect(denied.reason).toContain("src/db/**");
  });

  it("handles multiple allowed patterns", () => {
    const config: AgentSandboxConfig = {
      allowedPaths: ["src/components/**", "src/hooks/**"],
      deniedPaths: [],
    };

    expect(checkAccess("src/components/A.tsx", config).allowed).toBe(true);
    expect(checkAccess("src/hooks/useX.ts", config).allowed).toBe(true);
    expect(checkAccess("src/lib/utils.ts", config).allowed).toBe(false);
  });

  it("normalizes path traversal before checking", () => {
    const config: AgentSandboxConfig = {
      allowedPaths: ["src/components/**"],
      deniedPaths: [],
    };

    // ../../../etc/passwd should not match src/components/**
    expect(checkAccess("src/components/../../etc/passwd", config).allowed).toBe(false);
    // Traversal that resolves within allowed path should still work
    expect(checkAccess("src/components/sub/../Button.tsx", config).allowed).toBe(true);
  });

  it("ignores empty strings in deniedPaths", () => {
    const config: AgentSandboxConfig = {
      allowedPaths: [],
      deniedPaths: ["", ""],
    };

    // Empty patterns should be filtered out, not block empty-ish paths
    expect(checkAccess("src/file.ts", config).allowed).toBe(true);
  });

  it("ignores empty strings in allowedPaths", () => {
    const config: AgentSandboxConfig = {
      allowedPaths: ["", ""],
      deniedPaths: [],
    };

    // Empty patterns filtered → treated as "no restrictions"
    expect(checkAccess("src/file.ts", config).allowed).toBe(true);
  });

  it("handles malformed glob in config without crashing", () => {
    const config: AgentSandboxConfig = {
      allowedPaths: ["[invalid"],
      deniedPaths: [],
    };

    // Should not throw — malformed pattern = never matches
    const result = checkAccess("src/file.ts", config);
    expect(result.allowed).toBe(false); // No valid pattern matched
  });
});
