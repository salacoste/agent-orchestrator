/**
 * Learning Store Tests (Story 11.2)
 *
 * Tests for JSONL storage, rotation, retention, and startup loading.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createLearningStore } from "../learning-store.js";
import type { SessionLearning } from "../types.js";

function makeLearning(overrides: Partial<SessionLearning> = {}): SessionLearning {
  return {
    sessionId: "ao-test-1",
    agentId: "ao-test-1",
    storyId: "1-1-test",
    projectId: "test-project",
    outcome: "completed",
    durationMs: 60000,
    retryCount: 0,
    filesModified: ["src/index.ts"],
    testsAdded: 1,
    errorCategories: [],
    domainTags: ["backend"],
    completedAt: new Date().toISOString(),
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("LearningStore", () => {
  let tmpDir: string;
  let learningsPath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `ao-learning-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    learningsPath = join(tmpDir, "learnings.jsonl");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("store", () => {
    it("appends learning record to JSONL file", async () => {
      const store = createLearningStore({ learningsPath });
      await store.store(makeLearning({ storyId: "1-1-first" }));
      await store.store(makeLearning({ storyId: "1-2-second" }));

      const content = readFileSync(learningsPath, "utf-8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(2);

      const first = JSON.parse(lines[0]) as SessionLearning;
      const second = JSON.parse(lines[1]) as SessionLearning;
      expect(first.storyId).toBe("1-1-first");
      expect(second.storyId).toBe("1-2-second");
    });

    it("creates directory if it doesn't exist", async () => {
      const deepPath = join(tmpDir, "deep", "nested", "learnings.jsonl");
      const store = createLearningStore({ learningsPath: deepPath });
      await store.store(makeLearning());

      expect(existsSync(deepPath)).toBe(true);
    });
  });

  describe("list", () => {
    it("returns all stored records", async () => {
      const store = createLearningStore({ learningsPath });
      await store.store(makeLearning({ storyId: "1-1" }));
      await store.store(makeLearning({ storyId: "1-2" }));

      const records = store.list();
      expect(records).toHaveLength(2);
      expect(records[0].storyId).toBe("1-1");
      expect(records[1].storyId).toBe("1-2");
    });

    it("returns empty array before any stores", () => {
      const store = createLearningStore({ learningsPath });
      expect(store.list()).toEqual([]);
    });
  });

  describe("start (load from disk)", () => {
    it("loads existing records from JSONL file", async () => {
      // Pre-populate file
      const records = [makeLearning({ storyId: "pre-1" }), makeLearning({ storyId: "pre-2" })];
      writeFileSync(learningsPath, records.map((r) => JSON.stringify(r)).join("\n") + "\n");

      const store = createLearningStore({ learningsPath });
      await store.start();

      expect(store.list()).toHaveLength(2);
      expect(store.list()[0].storyId).toBe("pre-1");
    });

    it("handles empty file gracefully", async () => {
      writeFileSync(learningsPath, "");
      const store = createLearningStore({ learningsPath });
      await store.start();
      expect(store.list()).toEqual([]);
    });

    it("handles non-existent file gracefully", async () => {
      const store = createLearningStore({ learningsPath: join(tmpDir, "nonexistent.jsonl") });
      await store.start();
      expect(store.list()).toEqual([]);
    });

    it("skips malformed lines without crash", async () => {
      const content =
        [
          JSON.stringify(makeLearning({ storyId: "good-1" })),
          "this is not valid json{{{",
          JSON.stringify(makeLearning({ storyId: "good-2" })),
        ].join("\n") + "\n";
      writeFileSync(learningsPath, content);

      const store = createLearningStore({ learningsPath });
      await store.start();

      expect(store.list()).toHaveLength(2);
      expect(store.list()[0].storyId).toBe("good-1");
      expect(store.list()[1].storyId).toBe("good-2");
    });
  });

  describe("retention", () => {
    it("purges records older than retention period on start", async () => {
      const old = makeLearning({
        storyId: "old",
        capturedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days ago
      });
      const recent = makeLearning({
        storyId: "recent",
        capturedAt: new Date().toISOString(),
      });

      writeFileSync(learningsPath, [JSON.stringify(old), JSON.stringify(recent)].join("\n") + "\n");

      const store = createLearningStore({ learningsPath, retentionDays: 90 });
      await store.start();

      expect(store.list()).toHaveLength(1);
      expect(store.list()[0].storyId).toBe("recent");
    });
  });

  describe("rotation", () => {
    it("rotates file when exceeding max size", async () => {
      const store = createLearningStore({ learningsPath, maxFileSize: 500 }); // 500 bytes

      // Store enough records to exceed 500 bytes
      for (let i = 0; i < 10; i++) {
        await store.store(
          makeLearning({
            storyId: `story-${i}`,
            filesModified: Array.from({ length: 10 }, (_, j) => `file-${j}.ts`),
          }),
        );
      }

      // Rotated file should exist
      const { readdirSync } = await import("node:fs");
      const files = readdirSync(tmpDir) as string[];
      const rotatedFiles = files.filter((f: string) => f.startsWith("learnings.jsonl."));
      expect(rotatedFiles.length).toBeGreaterThan(0);
    });
  });

  describe("query", () => {
    it("filters by agentId", async () => {
      const store = createLearningStore({ learningsPath });
      await store.store(makeLearning({ agentId: "ao-1", storyId: "s1" }));
      await store.store(makeLearning({ agentId: "ao-2", storyId: "s2" }));
      await store.store(makeLearning({ agentId: "ao-1", storyId: "s3" }));

      const results = store.query({ agentId: "ao-1" });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.agentId === "ao-1")).toBe(true);
    });

    it("filters by domain tag", async () => {
      const store = createLearningStore({ learningsPath });
      await store.store(makeLearning({ domainTags: ["frontend", "testing"] }));
      await store.store(makeLearning({ domainTags: ["backend"] }));
      await store.store(makeLearning({ domainTags: ["frontend"] }));

      const results = store.query({ domain: "frontend" });
      expect(results).toHaveLength(2);
    });

    it("filters by outcome", async () => {
      const store = createLearningStore({ learningsPath });
      await store.store(makeLearning({ outcome: "completed" }));
      await store.store(makeLearning({ outcome: "failed" }));
      await store.store(makeLearning({ outcome: "failed" }));

      const results = store.query({ outcome: "failed" });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.outcome === "failed")).toBe(true);
    });

    it("filters by time window (sinceMs)", async () => {
      const store = createLearningStore({ learningsPath });
      await store.store(
        makeLearning({
          capturedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        }),
      );
      await store.store(
        makeLearning({
          capturedAt: new Date().toISOString(), // now
        }),
      );

      const results = store.query({ sinceMs: 24 * 60 * 60 * 1000 }); // last 1 day
      expect(results).toHaveLength(1);
    });

    it("applies limit (newest first)", async () => {
      const store = createLearningStore({ learningsPath });
      for (let i = 0; i < 5; i++) {
        await store.store(
          makeLearning({
            storyId: `story-${i}`,
            capturedAt: new Date(Date.now() + i * 1000).toISOString(),
          }),
        );
      }

      const results = store.query({ limit: 2 });
      expect(results).toHaveLength(2);
      // Newest first
      expect(results[0].storyId).toBe("story-4");
      expect(results[1].storyId).toBe("story-3");
    });

    it("combines multiple filters", async () => {
      const store = createLearningStore({ learningsPath });
      await store.store(
        makeLearning({ agentId: "ao-1", outcome: "completed", domainTags: ["frontend"] }),
      );
      await store.store(
        makeLearning({ agentId: "ao-1", outcome: "failed", domainTags: ["frontend"] }),
      );
      await store.store(
        makeLearning({ agentId: "ao-2", outcome: "failed", domainTags: ["frontend"] }),
      );

      const results = store.query({ agentId: "ao-1", outcome: "failed" });
      expect(results).toHaveLength(1);
    });

    it("returns empty array when no matches", async () => {
      const store = createLearningStore({ learningsPath });
      await store.store(makeLearning({ agentId: "ao-1" }));

      const results = store.query({ agentId: "nonexistent" });
      expect(results).toEqual([]);
    });
  });
});
