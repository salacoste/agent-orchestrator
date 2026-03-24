/**
 * Immutable audit log tests (Story 46a.1).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createImmutableAuditLog,
  verifyChain,
  computeEntryHash,
  type AuditLogEntry,
} from "../immutable-audit-log.js";

let tempDir: string;
let auditPath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "audit-test-"));
  auditPath = join(tempDir, "audit.jsonl");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("createImmutableAuditLog", () => {
  it("appends entries with hash chain", async () => {
    const log = createImmutableAuditLog(auditPath);

    const e1 = await log.append({ actor: "user", action: "spawn", target: "agent-1" });
    const e2 = await log.append({ actor: "user", action: "kill", target: "agent-1" });

    expect(e1.previousHash).toBe("0"); // Genesis
    expect(e2.previousHash).toBe(e1.hash);
    expect(e1.hash).not.toBe(e2.hash);
  });

  it("persists entries to JSONL file", async () => {
    const log = createImmutableAuditLog(auditPath);

    await log.append({ actor: "user", action: "spawn", target: "agent-1" });
    await log.append({ actor: "autopilot", action: "resume", target: "agent-2" });

    const content = await readFile(auditPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const parsed = JSON.parse(lines[0]) as AuditLogEntry;
    expect(parsed.actor).toBe("user");
    expect(parsed.action).toBe("spawn");
  });

  it("reads entries with time filter", async () => {
    const log = createImmutableAuditLog(auditPath);

    await log.append({ actor: "user", action: "spawn", target: "a-1" });
    await log.append({ actor: "user", action: "kill", target: "a-1" });

    const entries = await log.readEntries();
    expect(entries).toHaveLength(2);

    // Filter by since — both should be recent
    const filtered = await log.readEntries({ since: "2020-01-01T00:00:00Z" });
    expect(filtered).toHaveLength(2);
  });

  it("reads entries with limit", async () => {
    const log = createImmutableAuditLog(auditPath);

    await log.append({ actor: "user", action: "a1", target: "t1" });
    await log.append({ actor: "user", action: "a2", target: "t2" });
    await log.append({ actor: "user", action: "a3", target: "t3" });

    const limited = await log.readEntries({ limit: 2 });
    expect(limited).toHaveLength(2);
    expect(limited[0].action).toBe("a1"); // Oldest first
  });

  it("returns empty for nonexistent file", async () => {
    const log = createImmutableAuditLog(join(tempDir, "nonexistent.jsonl"));
    const entries = await log.readEntries();
    expect(entries).toHaveLength(0);
  });

  it("includes beforeState and afterState", async () => {
    const log = createImmutableAuditLog(auditPath);

    const entry = await log.append({
      actor: "user",
      action: "status.change",
      target: "story-1",
      beforeState: "in-progress",
      afterState: "done",
    });

    expect(entry.beforeState).toBe("in-progress");
    expect(entry.afterState).toBe("done");
  });

  it("includes metadata", async () => {
    const log = createImmutableAuditLog(auditPath);

    const entry = await log.append({
      actor: "user",
      action: "config.update",
      target: "maxAgents",
      metadata: { oldValue: 3, newValue: 5 },
    });

    expect(entry.metadata?.oldValue).toBe(3);
  });

  it("resumes chain from existing file", async () => {
    const log1 = createImmutableAuditLog(auditPath);
    const e1 = await log1.append({ actor: "user", action: "spawn", target: "a-1" });

    // Create new instance — should resume chain
    const log2 = createImmutableAuditLog(auditPath);
    const e2 = await log2.append({ actor: "user", action: "kill", target: "a-1" });

    expect(e2.previousHash).toBe(e1.hash);
  });

  it("verifies valid chain", async () => {
    const log = createImmutableAuditLog(auditPath);

    await log.append({ actor: "user", action: "a1", target: "t1" });
    await log.append({ actor: "user", action: "a2", target: "t2" });

    const result = await log.verify();
    expect(result.valid).toBe(true);
    expect(result.entriesChecked).toBe(2);
  });
});

describe("computeEntryHash", () => {
  it("produces consistent hash for same input", () => {
    const entry = {
      id: "test-id",
      timestamp: "2026-03-24T10:00:00Z",
      actor: "user",
      action: "spawn",
      target: "agent-1",
      previousHash: "0",
    };

    const hash1 = computeEntryHash(entry);
    const hash2 = computeEntryHash(entry);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it("produces different hash for different input", () => {
    const base = {
      id: "test-id",
      timestamp: "2026-03-24T10:00:00Z",
      actor: "user",
      action: "spawn",
      target: "agent-1",
      previousHash: "0",
    };

    const hash1 = computeEntryHash(base);
    const hash2 = computeEntryHash({ ...base, action: "kill" });
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyChain", () => {
  it("returns valid for empty chain", () => {
    expect(verifyChain([]).valid).toBe(true);
  });

  it("returns valid for correct chain", () => {
    const e1: AuditLogEntry = {
      id: "1",
      timestamp: "2026-03-24T10:00:00Z",
      actor: "user",
      action: "spawn",
      target: "a-1",
      hash: "",
      previousHash: "0",
    };
    e1.hash = computeEntryHash(e1);

    const e2: AuditLogEntry = {
      id: "2",
      timestamp: "2026-03-24T10:01:00Z",
      actor: "user",
      action: "kill",
      target: "a-1",
      hash: "",
      previousHash: e1.hash,
    };
    e2.hash = computeEntryHash(e2);

    expect(verifyChain([e1, e2]).valid).toBe(true);
  });

  it("detects tampered hash", () => {
    const e1: AuditLogEntry = {
      id: "1",
      timestamp: "2026-03-24T10:00:00Z",
      actor: "user",
      action: "spawn",
      target: "a-1",
      hash: "tampered-hash",
      previousHash: "0",
    };

    const result = verifyChain([e1]);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
    expect(result.error).toContain("Hash mismatch");
  });

  it("detects broken chain link", () => {
    const e1: AuditLogEntry = {
      id: "1",
      timestamp: "2026-03-24T10:00:00Z",
      actor: "user",
      action: "spawn",
      target: "a-1",
      hash: "",
      previousHash: "0",
    };
    e1.hash = computeEntryHash(e1);

    const e2: AuditLogEntry = {
      id: "2",
      timestamp: "2026-03-24T10:01:00Z",
      actor: "user",
      action: "kill",
      target: "a-1",
      hash: "",
      previousHash: "wrong-hash", // Should be e1.hash
    };
    e2.hash = computeEntryHash(e2);

    const result = verifyChain([e1, e2]);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
    expect(result.error).toContain("Chain link broken");
  });

  it("detects invalid genesis hash", () => {
    const e1: AuditLogEntry = {
      id: "1",
      timestamp: "2026-03-24T10:00:00Z",
      actor: "user",
      action: "spawn",
      target: "a-1",
      hash: "",
      previousHash: "not-zero", // Should be "0"
    };
    e1.hash = computeEntryHash(e1);

    const result = verifyChain([e1]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid genesis");
  });
});
