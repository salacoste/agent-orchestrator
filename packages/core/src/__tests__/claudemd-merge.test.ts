/**
 * Unit tests for claudemd-merge module (Epic 59, Story 59-4).
 *
 * Covers: mergeClaudeMd, readClaudeMd, writeClaudeMd, performMerge
 */

import * as fs from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mergeClaudeMd, readClaudeMd, writeClaudeMd, performMerge } from "../claudemd-merge.js";

let testDir: string;

beforeEach(() => {
  testDir = join(
    tmpdir(),
    `claudemd-merge-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  fs.mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// mergeClaudeMd — format and logic
// ---------------------------------------------------------------------------

describe("mergeClaudeMd", () => {
  it("produces correct merged format with project content and provider additions", () => {
    const project = "# Project Rules\n\nAlways use strict types.";
    const additions = "### Agent Catalog\n\n- **omc**: model=opus";

    const result = mergeClaudeMd(project, additions, "omc");

    expect(result).toContain("# Project Rules");
    expect(result).toContain("Always use strict types.");
    expect(result).toContain("---");
    expect(result).toContain("<!-- Provider: omc -->");
    expect(result).toContain("<!-- /Provider: omc -->");
    expect(result).toContain("## Provider Enhancements (omc)");
    expect(result).toContain("### Agent Catalog");
    expect(result).toContain("- **omc**: model=opus");
  });

  it("is idempotent — re-merge strips old provider section", () => {
    const project = "# Project Rules\n\nUse strict.";
    const additions = "### Agent Catalog\n\nAgent list v1";

    const first = mergeClaudeMd(project, additions, "omc");
    const additionsV2 = "### Agent Catalog\n\nAgent list v2";
    const second = mergeClaudeMd(first, additionsV2, "omc");

    expect(second).toContain("# Project Rules");
    expect(second).toContain("Use strict.");
    expect(second).toContain("Agent list v2");
    expect(second).not.toContain("Agent list v1");

    // Only one provider section marker
    const markerCount = second.split("<!-- Provider: omc -->").length - 1;
    expect(markerCount).toBe(1);

    // Only one closing marker
    const closeCount = second.split("<!-- /Provider: omc -->").length - 1;
    expect(closeCount).toBe(1);
  });

  it("works with empty project content (provider-only)", () => {
    const result = mergeClaudeMd("", "### Agent Catalog\n\nAgents here", "omc");

    expect(result).toContain("<!-- Provider: omc -->");
    expect(result).toContain("<!-- /Provider: omc -->");
    expect(result).toContain("### Agent Catalog");
    expect(result).toContain("Agents here");
    // Should start with --- (no leading blank line)
    expect(result.startsWith("---")).toBe(true);
  });

  it("returns original content when provider additions are empty", () => {
    const project = "# My Project\n\nRules here.";
    const result = mergeClaudeMd(project, "", "omc");

    expect(result).toBe(project);
  });

  it("returns original content when provider additions are whitespace only", () => {
    const project = "# My Project\n\nRules here.";
    const result = mergeClaudeMd(project, "   \n\n  \t  ", "omc");

    expect(result).toBe(project);
  });

  it("strips provider section even when marker is at start of file (legacy format)", () => {
    const previous = "<!-- Provider: omc -->\n## Provider Enhancements (omc)\n\nOld content";
    const newAdditions = "New additions";

    const result = mergeClaudeMd(previous, newAdditions, "omc");

    expect(result).toContain("New additions");
    expect(result).not.toContain("Old content");
  });

  it("strips provider section with closing marker (current format)", () => {
    const previous =
      "# Project\n\n---\n<!-- Provider: omc -->\n## Provider Enhancements (omc)\n\nOld content\n<!-- /Provider: omc -->\n\n## User Added Section\n\nKeep this";
    const newAdditions = "New additions";

    const result = mergeClaudeMd(previous, newAdditions, "omc");

    expect(result).toContain("New additions");
    expect(result).not.toContain("Old content");
    // Content after the closing marker is preserved
    expect(result).toContain("## User Added Section");
    expect(result).toContain("Keep this");
  });

  it("handles different provider names independently", () => {
    const base = "# Project Rules";
    const omcResult = mergeClaudeMd(base, "OMC additions", "omc");
    const customResult = mergeClaudeMd(omcResult, "Custom additions", "custom");

    expect(customResult).toContain("<!-- Provider: omc -->");
    expect(customResult).toContain("<!-- /Provider: omc -->");
    expect(customResult).toContain("<!-- Provider: custom -->");
    expect(customResult).toContain("<!-- /Provider: custom -->");
    expect(customResult).toContain("OMC additions");
    expect(customResult).toContain("Custom additions");
  });

  it("handles hyphenated provider names correctly", () => {
    const result = mergeClaudeMd("# Project", "Additions", "my-provider");

    expect(result).toContain("<!-- Provider: my-provider -->");
    expect(result).toContain("<!-- /Provider: my-provider -->");
    expect(result).toContain("## Provider Enhancements (my-provider)");
    expect(result).toContain("Additions");
  });
});

// ---------------------------------------------------------------------------
// readClaudeMd
// ---------------------------------------------------------------------------

describe("readClaudeMd", () => {
  it("returns null for missing file", () => {
    const result = readClaudeMd(join(testDir, "nonexistent-CLAUDE.md"));
    expect(result).toBeNull();
  });

  it("returns file content for existing file", () => {
    const filePath = join(testDir, "CLAUDE.md");
    fs.writeFileSync(filePath, "# Test Content\n\nHello.", "utf-8");

    const result = readClaudeMd(filePath);
    expect(result).toBe("# Test Content\n\nHello.");
  });
});

// ---------------------------------------------------------------------------
// writeClaudeMd — atomic write
// ---------------------------------------------------------------------------

describe("writeClaudeMd", () => {
  it("writes content to file atomically", async () => {
    const filePath = join(testDir, "CLAUDE.md");
    const content = "# Written\n\nAtomic test.";

    await writeClaudeMd(filePath, content);

    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe(content);
    // No temp files should remain
    const files = await import("node:fs/promises").then((fsp) => fsp.readdir(testDir));
    const tmpFiles = files.filter((f) => f.endsWith(".tmp"));
    expect(tmpFiles).toHaveLength(0);
  });

  it("overwrites existing content", async () => {
    const filePath = join(testDir, "CLAUDE.md");
    fs.writeFileSync(filePath, "old content", "utf-8");

    await writeClaudeMd(filePath, "new content");

    expect(fs.readFileSync(filePath, "utf-8")).toBe("new content");
  });
});

// ---------------------------------------------------------------------------
// performMerge — full integration
// ---------------------------------------------------------------------------

describe("performMerge", () => {
  it("skips merge when provider additions file is missing", async () => {
    const result = await performMerge(testDir, "omc");
    expect(result.merged).toBe(false);
    expect(result.path).toBe(join(testDir, "CLAUDE.md"));
  });

  it("performs full merge end-to-end", async () => {
    // Setup: existing CLAUDE.md
    fs.writeFileSync(join(testDir, "CLAUDE.md"), "# Project Rules\n\nBe strict.", "utf-8");

    // Setup: provider additions
    fs.mkdirSync(join(testDir, ".omc"), { recursive: true });
    fs.writeFileSync(
      join(testDir, ".omc", "provider-claude-md.md"),
      "### Agent Catalog\n\n- omc: opus",
      "utf-8",
    );

    const result = await performMerge(testDir, "omc");

    expect(result.merged).toBe(true);
    expect(result.path).toBe(join(testDir, "CLAUDE.md"));

    // Verify merged content on disk
    const merged = fs.readFileSync(join(testDir, "CLAUDE.md"), "utf-8");
    expect(merged).toContain("# Project Rules");
    expect(merged).toContain("Be strict.");
    expect(merged).toContain("<!-- Provider: omc -->");
    expect(merged).toContain("<!-- /Provider: omc -->");
    expect(merged).toContain("### Agent Catalog");
  });

  it("skips write when merged content equals existing content", async () => {
    // Create an already-merged CLAUDE.md
    const existingMerged = mergeClaudeMd("# Project", "Additions", "omc");
    fs.writeFileSync(join(testDir, "CLAUDE.md"), existingMerged, "utf-8");

    fs.mkdirSync(join(testDir, ".omc"), { recursive: true });
    fs.writeFileSync(join(testDir, ".omc", "provider-claude-md.md"), "Additions", "utf-8");

    const result = await performMerge(testDir, "omc");
    expect(result.merged).toBe(false);
  });

  it("skips merge when provider additions file is empty", async () => {
    fs.writeFileSync(join(testDir, "CLAUDE.md"), "# Project Rules", "utf-8");

    fs.mkdirSync(join(testDir, ".omc"), { recursive: true });
    fs.writeFileSync(join(testDir, ".omc", "provider-claude-md.md"), "   \n  ", "utf-8");

    const result = await performMerge(testDir, "omc");
    expect(result.merged).toBe(false);
  });

  it("works when no CLAUDE.md exists in worktree (empty string)", async () => {
    fs.mkdirSync(join(testDir, ".omc"), { recursive: true });
    fs.writeFileSync(join(testDir, ".omc", "provider-claude-md.md"), "Provider content", "utf-8");

    const result = await performMerge(testDir, "omc");

    expect(result.merged).toBe(true);
    const merged = fs.readFileSync(join(testDir, "CLAUDE.md"), "utf-8");
    expect(merged).toContain("<!-- Provider: omc -->");
    expect(merged).toContain("<!-- /Provider: omc -->");
    expect(merged).toContain("Provider content");
    // No project content — should start directly with provider section
    expect(merged.startsWith("---")).toBe(true);
  });

  it("derives provider additions path from provider name", async () => {
    // Setup: additions for a hypothetical "acme" provider
    fs.mkdirSync(join(testDir, ".acme"), { recursive: true });
    fs.writeFileSync(join(testDir, ".acme", "provider-claude-md.md"), "Acme content", "utf-8");
    fs.writeFileSync(join(testDir, "CLAUDE.md"), "# Project", "utf-8");

    const result = await performMerge(testDir, "acme");

    expect(result.merged).toBe(true);
    const merged = fs.readFileSync(join(testDir, "CLAUDE.md"), "utf-8");
    expect(merged).toContain("<!-- Provider: acme -->");
    expect(merged).toContain("Acme content");
  });

  it("rejects provider names with path separators", async () => {
    await expect(performMerge(testDir, "../etc")).rejects.toThrow("Invalid provider name");
  });

  it("rejects provider names with special characters", async () => {
    await expect(performMerge(testDir, "a b")).rejects.toThrow("Invalid provider name");
  });
});
