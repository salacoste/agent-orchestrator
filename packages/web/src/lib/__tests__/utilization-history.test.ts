import { describe, it, expect, beforeEach } from "vitest";
import {
  recordSnapshots,
  getAgentHistory,
  getProjectHistory,
  getAllHistory,
  pruneHistory,
  _resetUtilizationHistory,
} from "../utilization-history.js";
import type { UtilizationSnapshot } from "../utilization-metrics-types.js";

function makeSnapshot(
  overrides: Partial<UtilizationSnapshot> & { agentId: string; projectId: string },
): UtilizationSnapshot {
  return {
    timestamp: Date.now(),
    utilizationPercent: 50,
    isActive: true,
    storiesWorked: 0,
    isPoolAgent: false,
    isAtCapacity: false,
    isNearCapacity: false,
    ...overrides,
  };
}

describe("utilization-history", () => {
  beforeEach(() => {
    _resetUtilizationHistory();
  });

  describe("recordSnapshots", () => {
    it("appends snapshots to the store", () => {
      const snap = makeSnapshot({ agentId: "a1", projectId: "p1" });
      recordSnapshots([snap]);
      expect(getAllHistory()).toHaveLength(1);
    });

    it("appends multiple snapshots", () => {
      recordSnapshots([
        makeSnapshot({ agentId: "a1", projectId: "p1" }),
        makeSnapshot({ agentId: "a2", projectId: "p1" }),
      ]);
      expect(getAllHistory()).toHaveLength(2);
    });
  });

  describe("getAgentHistory", () => {
    it("filters by agentId", () => {
      recordSnapshots([
        makeSnapshot({ agentId: "a1", projectId: "p1" }),
        makeSnapshot({ agentId: "a2", projectId: "p1" }),
        makeSnapshot({ agentId: "a1", projectId: "p2" }),
      ]);
      const history = getAgentHistory("a1");
      expect(history).toHaveLength(2);
      expect(history.every((s) => s.agentId === "a1")).toBe(true);
    });

    it("filters by sinceMs", () => {
      const now = Date.now();
      const old = makeSnapshot({ agentId: "a1", projectId: "p1" });
      old.timestamp = now - 2000;
      const recent = makeSnapshot({ agentId: "a1", projectId: "p1" });
      recent.timestamp = now;
      recordSnapshots([old, recent], 604_800_000); // 7d max age so nothing gets pruned
      expect(getAgentHistory("a1", now - 1000)).toHaveLength(1);
    });
  });

  describe("getProjectHistory", () => {
    it("filters by projectId", () => {
      recordSnapshots([
        makeSnapshot({ agentId: "a1", projectId: "p1" }),
        makeSnapshot({ agentId: "a2", projectId: "p2" }),
      ]);
      expect(getProjectHistory("p1")).toHaveLength(1);
    });

    it("filters by sinceMs", () => {
      const now = Date.now();
      const snap = makeSnapshot({ agentId: "a1", projectId: "p1" });
      snap.timestamp = now;
      recordSnapshots([snap], 604_800_000);
      expect(getProjectHistory("p1", now + 100)).toHaveLength(0);
      expect(getProjectHistory("p1", now - 100)).toHaveLength(1);
    });
  });

  describe("getAllHistory", () => {
    it("returns all snapshots when no sinceMs", () => {
      recordSnapshots([
        makeSnapshot({ agentId: "a1", projectId: "p1" }),
        makeSnapshot({ agentId: "a2", projectId: "p2" }),
      ]);
      expect(getAllHistory()).toHaveLength(2);
    });

    it("filters by sinceMs", () => {
      const now = Date.now();
      const old = makeSnapshot({ agentId: "a1", projectId: "p1" });
      old.timestamp = now - 1000;
      const recent = makeSnapshot({ agentId: "a2", projectId: "p2" });
      recent.timestamp = now;
      recordSnapshots([old, recent], 604_800_000);
      expect(getAllHistory(now - 500)).toHaveLength(1);
    });
  });

  describe("pruneHistory", () => {
    it("removes entries older than maxAgeMs", () => {
      const now = Date.now();
      const old = makeSnapshot({ agentId: "a1", projectId: "p1" });
      old.timestamp = now - 2000;
      const recent = makeSnapshot({ agentId: "a2", projectId: "p1" });
      recent.timestamp = now;
      recordSnapshots([old, recent], 604_800_000); // don't prune on record
      pruneHistory(1000);
      expect(getAllHistory()).toHaveLength(1);
      expect(getAllHistory()[0].agentId).toBe("a2");
    });
  });
});
