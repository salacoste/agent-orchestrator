/**
 * State snapshot tests (Story 46a.2).
 */
import { describe, expect, it } from "vitest";
import {
  assembleSnapshot,
  validateSnapshot,
  mergeLearnings,
  SNAPSHOT_VERSION,
} from "../state-snapshot.js";

describe("assembleSnapshot", () => {
  it("creates snapshot with all sections", () => {
    const snap = assembleSnapshot({
      sessions: [{ sessionId: "s-1", status: "completed" }],
      learnings: [{ sessionId: "s-1", outcome: "completed" }],
      sprintStatus: { development_status: {} },
      collaboration: { decisions: [{ id: "d-1" }], claims: [] },
    });

    expect(snap.version).toBe(SNAPSHOT_VERSION);
    expect(snap.exportedAt).toBeTruthy();
    expect(snap.sessions).toHaveLength(1);
    expect(snap.learnings).toHaveLength(1);
    expect(snap.sprintStatus).toBeDefined();
    expect(snap.collaboration?.decisions).toHaveLength(1);
  });

  it("handles null optional fields", () => {
    const snap = assembleSnapshot({
      sessions: [],
      learnings: [],
      sprintStatus: null,
      collaboration: null,
    });

    expect(snap.sprintStatus).toBeNull();
    expect(snap.collaboration).toBeNull();
  });

  it("includes version number", () => {
    const snap = assembleSnapshot({
      sessions: [],
      learnings: [],
      sprintStatus: null,
      collaboration: null,
    });

    expect(snap.version).toBe(1);
  });
});

describe("validateSnapshot", () => {
  const validSnapshot = {
    version: 1,
    exportedAt: "2026-03-24T10:00:00Z",
    sessions: [],
    learnings: [],
    sprintStatus: null,
    collaboration: null,
  };

  it("accepts valid snapshot", () => {
    const result = validateSnapshot(validSnapshot);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects null input", () => {
    const result = validateSnapshot(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("JSON object");
  });

  it("rejects wrong version", () => {
    const result = validateSnapshot({ ...validSnapshot, version: 99 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("version");
  });

  it("rejects missing exportedAt", () => {
    const { exportedAt: _, ...noDate } = validSnapshot;
    const result = validateSnapshot(noDate);
    expect(result.valid).toBe(false);
  });

  it("rejects invalid exportedAt", () => {
    const result = validateSnapshot({ ...validSnapshot, exportedAt: "not-a-date" });
    expect(result.valid).toBe(false);
  });

  it("rejects non-array sessions", () => {
    const result = validateSnapshot({ ...validSnapshot, sessions: "not-array" });
    expect(result.valid).toBe(false);
  });

  it("rejects non-array learnings", () => {
    const result = validateSnapshot({ ...validSnapshot, learnings: {} });
    expect(result.valid).toBe(false);
  });

  it("accepts with optional sprintStatus and collaboration", () => {
    const result = validateSnapshot({
      ...validSnapshot,
      sprintStatus: { dev_status: {} },
      collaboration: { decisions: [], claims: [] },
    });
    expect(result.valid).toBe(true);
  });

  it("collects multiple errors", () => {
    const result = validateSnapshot({ version: 99 });
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe("mergeLearnings", () => {
  it("returns only new entries", () => {
    const existing = [{ sessionId: "s-1" }, { sessionId: "s-2" }];
    const imported = [
      { sessionId: "s-2", data: "dup" },
      { sessionId: "s-3", data: "new" },
    ];

    const newEntries = mergeLearnings(existing, imported);
    expect(newEntries).toHaveLength(1);
    expect((newEntries[0] as { sessionId: string }).sessionId).toBe("s-3");
  });

  it("returns empty when all exist", () => {
    const existing = [{ sessionId: "s-1" }];
    const imported = [{ sessionId: "s-1" }];

    expect(mergeLearnings(existing, imported)).toHaveLength(0);
  });

  it("returns all when none exist", () => {
    const newEntries = mergeLearnings([], [{ sessionId: "s-1" }, { sessionId: "s-2" }]);
    expect(newEntries).toHaveLength(2);
  });

  it("skips entries without sessionId", () => {
    const newEntries = mergeLearnings([], [{ noId: true }]);
    expect(newEntries).toHaveLength(0);
  });
});
