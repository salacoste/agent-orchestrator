/**
 * LKG Cache Integration Tests for Workflow API Route (Story 10-3)
 *
 * Tests per-source error handling with LKG fallback — validates AC1-AC6.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClassifiedArtifact, PhaseEntry, Recommendation } from "@/lib/workflow/types.js";

// --- Shared test data ---

const mockPhases: PhaseEntry[] = [
  { id: "analysis", label: "Analysis", state: "done" },
  { id: "planning", label: "Planning", state: "done" },
  { id: "solutioning", label: "Solutioning", state: "active" },
  { id: "implementation", label: "Implementation", state: "not-started" },
];

const mockArtifacts: ClassifiedArtifact[] = [
  {
    filename: "architecture.md",
    path: "_bmad-output/planning-artifacts/architecture.md",
    modifiedAt: "2026-03-13T10:00:00.000Z",
    phase: "solutioning",
    type: "Architecture",
  },
  {
    filename: "prd.md",
    path: "_bmad-output/planning-artifacts/prd.md",
    modifiedAt: "2026-03-12T10:00:00.000Z",
    phase: "planning",
    type: "PRD",
  },
];

const mockRecommendation: Recommendation = {
  tier: 2,
  observation: "No epics document found",
  implication: "Epics break requirements into implementable stories",
  phase: "solutioning",
};

const mockPresence = { analysis: false, planning: true, solutioning: true, implementation: false };

// --- Mocks ---

vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: {
      projects: {
        "test-project": { name: "Test Project", path: "/test/project" },
      },
      configPath: "/test/config",
    },
  })),
}));

const { mockReaddir, mockReadFile } = vi.hoisted(() => ({
  mockReaddir: vi.fn(async (dirPath: string) => {
    if (typeof dirPath === "string" && dirPath.includes("_bmad")) return ["_config"];
    return [];
  }),
  mockReadFile: vi.fn(async () => {
    return "name,displayName,title,icon,role\nanalyst,Analyst,Business Analyst,📊,Analyzes requirements";
  }),
}));

vi.mock("node:fs/promises", () => ({
  default: { readdir: mockReaddir, readFile: mockReadFile },
  readdir: mockReaddir,
  readFile: mockReadFile,
}));

const { mockScanAllArtifacts, mockBuildPhasePresence } = vi.hoisted(() => ({
  mockScanAllArtifacts: vi.fn(async () => mockArtifacts),
  mockBuildPhasePresence: vi.fn(() => mockPresence),
}));

vi.mock("@/lib/workflow/scan-artifacts.js", () => ({
  scanAllArtifacts: mockScanAllArtifacts,
  buildPhasePresence: mockBuildPhasePresence,
}));

vi.mock("@/lib/workflow/compute-state.js", () => ({
  computePhaseStates: vi.fn((presence: Record<string, boolean>) => {
    const hasAny = Object.values(presence).some(Boolean);
    if (!hasAny) {
      return [
        { id: "analysis", label: "Analysis", state: "not-started" },
        { id: "planning", label: "Planning", state: "not-started" },
        { id: "solutioning", label: "Solutioning", state: "not-started" },
        { id: "implementation", label: "Implementation", state: "not-started" },
      ];
    }
    return mockPhases;
  }),
}));

vi.mock("@/lib/workflow/recommendation-engine.js", () => ({
  getRecommendation: vi.fn(() => mockRecommendation),
}));

vi.mock("@/lib/workflow/parse-agents.js", () => ({
  parseAgentManifest: vi.fn(() => [
    {
      name: "analyst",
      displayName: "Analyst",
      title: "Business Analyst",
      icon: "📊",
      role: "Analyzes requirements",
    },
  ]),
}));

// Import after mocks
import { GET } from "./route.js";
import { lkgCache } from "@/lib/workflow/lkg-cache.js";

function makeParams(project: string) {
  return { params: Promise.resolve({ project }) };
}

function makeRequest() {
  return new Request("http://localhost:3000/api/workflow/test-project");
}

describe("Workflow API — LKG Cache Integration (Story 10-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lkgCache._resetForTesting();
    // Restore default mock implementations
    mockScanAllArtifacts.mockResolvedValue(mockArtifacts);
    mockBuildPhasePresence.mockReturnValue(mockPresence);
  });

  describe("AC5: successful response populates LKG cache", () => {
    it("stores all fields in cache after successful request", async () => {
      await GET(makeRequest(), makeParams("test-project"));

      // Cache should now have data
      expect(lkgCache.get("test-project", "artifacts")).toEqual(mockArtifacts);
      expect(lkgCache.get("test-project", "phases")).toEqual(mockPhases);
      expect(lkgCache.get("test-project", "recommendation")).toEqual(mockRecommendation);
      expect(lkgCache.get("test-project", "agents")).not.toBeNull();
      expect(lkgCache.get("test-project", "lastActivity")).not.toBeNull();
    });
  });

  describe("AC1: artifact scan failure returns cached artifacts", () => {
    it("falls back to cached artifacts when scanAllArtifacts throws", async () => {
      // First request succeeds — populates cache
      await GET(makeRequest(), makeParams("test-project"));

      // Second request — artifact scan fails
      mockScanAllArtifacts.mockRejectedValueOnce(new Error("EACCES: permission denied"));

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.artifacts).toEqual(mockArtifacts);
    });
  });

  describe("AC2: panel independence — failure in one doesn't affect others", () => {
    it("returns cached artifacts + fresh agents when artifact scan fails", async () => {
      // First request succeeds — populates cache
      await GET(makeRequest(), makeParams("test-project"));

      // Second request — only artifact scan fails, agents still work
      mockScanAllArtifacts.mockRejectedValueOnce(new Error("EBUSY: mid-write"));

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      // Artifacts from cache
      expect(data.artifacts).toEqual(mockArtifacts);
      // Agents fresh (not from cache)
      expect(data.agents).not.toBeNull();
      expect(data.agents).toHaveLength(1);
      expect(data.agents[0].name).toBe("analyst");
    });

    it("returns cached agents + fresh artifacts when manifest read fails", async () => {
      // First request succeeds — populates cache
      await GET(makeRequest(), makeParams("test-project"));

      // Second request — manifest read fails
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT: no such file"));

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      // Agents from cache
      expect(data.agents).not.toBeNull();
      expect(data.agents[0].name).toBe("analyst");
      // Artifacts fresh
      expect(data.artifacts).toEqual(mockArtifacts);
    });
  });

  describe("AC3: total failure with cache returns LKG response", () => {
    it("returns HTTP 200 with cached response when all sources fail", async () => {
      // First request succeeds — populates cache
      const firstResponse = await GET(makeRequest(), makeParams("test-project"));
      const firstData = await firstResponse.json();

      // Second request — getServices throws (outer catch fires)
      const { getServices } = await import("@/lib/services");
      vi.mocked(getServices).mockRejectedValueOnce(new Error("Config file corrupted"));

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.projectId).toBe("test-project");
      // projectName falls back to projectId since config wasn't loaded
      expect(data.projectName).toBe("test-project");
      expect(data.hasBmad).toBe(true);
      expect(data.phases).toEqual(firstData.phases);
      expect(data.artifacts).toEqual(firstData.artifacts);
      expect(data.agents).toEqual(firstData.agents);
      expect(data.recommendation).toEqual(firstData.recommendation);
    });
  });

  describe("AC4: cold start failure returns empty response, not 500", () => {
    it("returns HTTP 200 with null/empty fields when no cache exists and sources fail", async () => {
      // No prior request — cache is empty
      const { getServices } = await import("@/lib/services");
      vi.mocked(getServices).mockRejectedValueOnce(new Error("Config unavailable"));

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.projectId).toBe("test-project");
      // hasBmad: false because we couldn't determine BMAD state on cold start
      expect(data.hasBmad).toBe(false);
      expect(data.agents).toBeNull();
      expect(data.recommendation).toBeNull();
      expect(data.artifacts).toEqual([]);
      expect(data.lastActivity).toBeNull();
      expect(data.phases).toHaveLength(4);
    });

    it("returns empty artifacts when artifact scan fails on cold start", async () => {
      mockScanAllArtifacts.mockRejectedValueOnce(new Error("EACCES"));

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.artifacts).toEqual([]);
    });
  });

  describe("AC6: successful request after failure updates cache", () => {
    it("updates cache with fresh data after recovery", async () => {
      // First request — artifact scan fails (no cache yet)
      mockScanAllArtifacts.mockRejectedValueOnce(new Error("EACCES"));
      await GET(makeRequest(), makeParams("test-project"));

      // Cache should have empty artifacts from the fallback response
      expect(lkgCache.get("test-project", "artifacts")).toEqual([]);

      // Second request — succeeds
      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.artifacts).toEqual(mockArtifacts);
      // Cache should now have fresh data
      expect(lkgCache.get("test-project", "artifacts")).toEqual(mockArtifacts);
    });
  });
});
