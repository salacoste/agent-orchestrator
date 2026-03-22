/**
 * VS Code extension structure tests (Story 41.2).
 *
 * Validates the extension exports and package.json manifest
 * without requiring a VS Code runtime.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Note: These tests read source files via __dirname. This works because vitest
// runs TypeScript directly (no compilation to dist/). If the test runner changes,
// paths may need to be resolved from the project root instead.

describe("VS Code extension structure", () => {
  it("extension.ts exports activate function", async () => {
    const src = readFileSync(join(__dirname, "extension.ts"), "utf-8");
    expect(src).toContain("export function activate");
  });

  it("extension.ts exports deactivate function", () => {
    const src = readFileSync(join(__dirname, "extension.ts"), "utf-8");
    expect(src).toContain("export function deactivate");
  });

  it("extension.ts registers tree data providers", () => {
    const src = readFileSync(join(__dirname, "extension.ts"), "utf-8");
    expect(src).toContain("registerTreeDataProvider");
    expect(src).toContain('"ao-sprint"');
    expect(src).toContain('"ao-agents"');
  });

  it("extension.ts registers all commands from package.json", () => {
    const src = readFileSync(join(__dirname, "extension.ts"), "utf-8");
    expect(src).toContain('"ao.spawn"');
    expect(src).toContain('"ao.status"');
    expect(src).toContain('"ao.recommend"');
  });
});

describe("VS Code extension package.json manifest", () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8")) as Record<
    string,
    unknown
  >;

  it("has required publisher field", () => {
    expect(pkg.publisher).toBeDefined();
    expect(typeof pkg.publisher).toBe("string");
  });

  it("has required engines.vscode field", () => {
    const engines = pkg.engines as Record<string, string>;
    expect(engines.vscode).toBeDefined();
    expect(engines.vscode).toMatch(/^\^/); // Semver range
  });

  it("has main pointing to dist/extension.js", () => {
    expect(pkg.main).toBe("./dist/extension.js");
  });

  it("has contributes with views and commands", () => {
    const contributes = pkg.contributes as Record<string, unknown>;
    expect(contributes.views).toBeDefined();
    expect(contributes.commands).toBeDefined();
    expect(contributes.viewsContainers).toBeDefined();
  });

  it("has repository field for vsce packaging", () => {
    expect(pkg.repository).toBeDefined();
  });

  it("commands match extension registrations", () => {
    const contributes = pkg.contributes as { commands: Array<{ command: string }> };
    const commandIds = contributes.commands.map((c) => c.command);
    expect(commandIds).toContain("ao.spawn");
    expect(commandIds).toContain("ao.status");
    expect(commandIds).toContain("ao.recommend");
  });
});
