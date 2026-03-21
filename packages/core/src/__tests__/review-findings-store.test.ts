/**
 * Review Findings Store Tests (Story 14.1)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createReviewFindingsStore } from "../review-findings-store.js";

describe("ReviewFindingsStore", () => {
  let tmpDir: string;
  let findingsPath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `ao-review-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    findingsPath = join(tmpDir, "review-findings.jsonl");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("stores finding and appends to JSONL", async () => {
    const store = createReviewFindingsStore({ findingsPath });
    const id = await store.store({
      storyId: "1-1-test",
      agentId: "ao-1",
      severity: "high",
      category: "type-safety",
      description: "return undefined as T",
      file: "service-wrapper.ts",
      resolution: "fixed",
    });

    expect(id).toBeDefined();
    const content = readFileSync(findingsPath, "utf-8");
    expect(content).toContain("type-safety");
    expect(content).toContain("return undefined as T");
  });

  it("lists all stored findings", async () => {
    const store = createReviewFindingsStore({ findingsPath });
    await store.store({
      storyId: "s1",
      agentId: "a1",
      severity: "high",
      category: "c1",
      description: "d1",
      resolution: "fixed",
    });
    await store.store({
      storyId: "s2",
      agentId: "a2",
      severity: "low",
      category: "c2",
      description: "d2",
      resolution: "accepted",
    });

    expect(store.list()).toHaveLength(2);
  });

  it("queries by storyId", async () => {
    const store = createReviewFindingsStore({ findingsPath });
    await store.store({
      storyId: "s1",
      agentId: "a1",
      severity: "high",
      category: "c",
      description: "d",
      resolution: "fixed",
    });
    await store.store({
      storyId: "s2",
      agentId: "a1",
      severity: "low",
      category: "c",
      description: "d",
      resolution: "fixed",
    });

    expect(store.query({ storyId: "s1" })).toHaveLength(1);
  });

  it("queries by severity", async () => {
    const store = createReviewFindingsStore({ findingsPath });
    await store.store({
      storyId: "s1",
      agentId: "a1",
      severity: "high",
      category: "c",
      description: "d",
      resolution: "fixed",
    });
    await store.store({
      storyId: "s2",
      agentId: "a1",
      severity: "high",
      category: "c",
      description: "d",
      resolution: "fixed",
    });
    await store.store({
      storyId: "s3",
      agentId: "a1",
      severity: "low",
      category: "c",
      description: "d",
      resolution: "fixed",
    });

    expect(store.query({ severity: "high" })).toHaveLength(2);
  });

  it("loads from disk on start", async () => {
    const store1 = createReviewFindingsStore({ findingsPath });
    await store1.store({
      storyId: "s1",
      agentId: "a1",
      severity: "medium",
      category: "c",
      description: "d",
      resolution: "fixed",
    });

    const store2 = createReviewFindingsStore({ findingsPath });
    await store2.start();
    expect(store2.list()).toHaveLength(1);
    expect(store2.list()[0].storyId).toBe("s1");
  });
});
