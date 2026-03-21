/**
 * 30-Scenario Error Resilience Matrix Tests (Story 10-4)
 *
 * Tests 6 file states × 5 data sources = 30 scenarios.
 * Validates NFR-R1 (zero user-visible errors) and NFR-T5 (file state test matrix).
 *
 * 6 file states: normal, empty, truncated, invalid, permission-denied (EACCES), mid-write (EBUSY)
 * 5 data sources: artifacts, agents, phases, recommendation, lastActivity
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClassifiedArtifact, PhaseEntry, Recommendation } from "@/lib/workflow/types";

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
    return "name,displayName,title,icon,role,capabilities\nanalyst,Analyst,Business Analyst,📊,Analyzes requirements,analysis";
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

const { mockComputePhaseStates } = vi.hoisted(() => ({
  mockComputePhaseStates: vi.fn((presence: Record<string, boolean>) => {
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

vi.mock("@/lib/workflow/compute-state.js", () => ({
  computePhaseStates: mockComputePhaseStates,
}));

const { mockGetRecommendation } = vi.hoisted(() => ({
  mockGetRecommendation: vi.fn((): unknown => mockRecommendation),
}));

vi.mock("@/lib/workflow/recommendation-engine.js", () => ({
  getRecommendation: mockGetRecommendation,
  getStateMachineRecommendation: vi.fn().mockReturnValue(null),
}));

const { mockParseAgentManifest } = vi.hoisted(() => ({
  mockParseAgentManifest: vi.fn(() => [
    {
      name: "analyst",
      displayName: "Analyst",
      title: "Business Analyst",
      icon: "📊",
      role: "Analyzes requirements",
    },
  ]),
}));

vi.mock("@/lib/workflow/parse-agents.js", () => ({
  parseAgentManifest: mockParseAgentManifest,
}));

// Import after mocks
import { GET } from "./route";
import { lkgCache } from "@/lib/workflow/lkg-cache";

function makeParams(project: string) {
  return { params: Promise.resolve({ project }) };
}

function makeRequest() {
  return new Request("http://localhost:3000/api/workflow/test-project");
}

/** Seed the LKG cache by performing one successful request. */
async function seedCache() {
  await GET(makeRequest(), makeParams("test-project"));
}

const defaultAgent = {
  name: "analyst",
  displayName: "Analyst",
  title: "Business Analyst",
  icon: "📊",
  role: "Analyzes requirements",
};

/** Shared mock restoration — used by all three top-level describe blocks. */
function resetAllMocks() {
  vi.clearAllMocks();
  lkgCache._resetForTesting();
  mockScanAllArtifacts.mockResolvedValue(mockArtifacts);
  mockBuildPhasePresence.mockReturnValue(mockPresence);
  mockComputePhaseStates.mockImplementation((presence: Record<string, boolean>) => {
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
  });
  mockGetRecommendation.mockReturnValue(mockRecommendation);
  mockParseAgentManifest.mockReturnValue([defaultAgent]);
}

describe("30-Scenario Error Resilience Matrix (Story 10-4, NFR-R1)", () => {
  beforeEach(resetAllMocks);

  // =========================================================================
  // Source 1: Artifacts (scanAllArtifacts)
  // =========================================================================
  describe("Source 1: Artifacts", () => {
    it("state 1 — normal: returns fresh artifacts", async () => {
      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.artifacts).toEqual(mockArtifacts);
      expect(data.artifacts).toHaveLength(2);
    });

    it("state 2 — empty: returns empty artifacts array", async () => {
      mockScanAllArtifacts.mockResolvedValueOnce([]);

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.artifacts).toEqual([]);
    });

    it("state 3 — truncated: returns partial artifacts", async () => {
      const partialArtifacts: ClassifiedArtifact[] = [
        {
          filename: "prd.md",
          path: "_bmad-output/planning-artifacts/prd.md",
          modifiedAt: "2026-03-12T10:00:00.000Z",
          phase: "planning",
          type: "PRD",
        },
      ];
      mockScanAllArtifacts.mockResolvedValueOnce(partialArtifacts);

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.artifacts).toEqual(partialArtifacts);
      expect(data.artifacts).toHaveLength(1);
    });

    it("state 4 — invalid: returns artifacts with null phases", async () => {
      const invalidArtifacts: ClassifiedArtifact[] = [
        {
          filename: "unknown-file.md",
          path: "_bmad-output/planning-artifacts/unknown-file.md",
          modifiedAt: "2026-03-13T10:00:00.000Z",
          phase: null,
          type: "Uncategorized",
        },
      ];
      mockScanAllArtifacts.mockResolvedValueOnce(invalidArtifacts);

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.artifacts).toEqual(invalidArtifacts);
      expect(data.artifacts[0].phase).toBeNull();
    });

    it("state 5 — permission denied (EACCES): falls back to LKG cache and logs warning", async () => {
      await seedCache();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockScanAllArtifacts.mockRejectedValueOnce(new Error("EACCES: permission denied"));

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.artifacts).toEqual(mockArtifacts);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("artifact scan failed"));
      warnSpy.mockRestore();
    });

    it("state 6 — mid-write (EBUSY): falls back to LKG cache", async () => {
      await seedCache();
      mockScanAllArtifacts.mockRejectedValueOnce(new Error("EBUSY: resource busy"));

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.artifacts).toEqual(mockArtifacts);
    });
  });

  // =========================================================================
  // Source 2: Agents (readFile + parseAgentManifest)
  // =========================================================================
  describe("Source 2: Agents", () => {
    it("state 1 — normal: returns fresh agents", async () => {
      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).not.toBeNull();
      expect(data.agents).toHaveLength(1);
      expect(data.agents[0].name).toBe("analyst");
    });

    // States 2-4: parseAgentManifest is mocked, so route-level outcome is identical
    // (parsed.length === 0 → agents stays null). We vary mockReadFile to document
    // which real-world file content each state represents.

    it("state 2 — empty CSV: returns agents null", async () => {
      mockReadFile.mockResolvedValueOnce("");
      mockParseAgentManifest.mockReturnValueOnce([]);

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).toBeNull();
    });

    it("state 3 — truncated CSV (header only): returns agents null", async () => {
      mockReadFile.mockResolvedValueOnce("name,displayName,title,icon,role,capabilities");
      mockParseAgentManifest.mockReturnValueOnce([]);

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).toBeNull();
    });

    it("state 4 — invalid CSV format: returns agents null", async () => {
      mockReadFile.mockResolvedValueOnce("garbage\nnot,a,valid,agent,manifest,line");
      mockParseAgentManifest.mockReturnValueOnce([]);

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).toBeNull();
    });

    it("state 5 — permission denied (EACCES): falls back to LKG cache and logs warning", async () => {
      await seedCache();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockReadFile.mockRejectedValueOnce(new Error("EACCES: permission denied"));

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).not.toBeNull();
      expect(data.agents[0].name).toBe("analyst");
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("agent manifest failed"));
      warnSpy.mockRestore();
    });

    it("state 6 — mid-write (EBUSY): falls back to LKG cache", async () => {
      await seedCache();
      mockReadFile.mockRejectedValueOnce(new Error("EBUSY: resource busy"));

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).not.toBeNull();
      expect(data.agents[0].name).toBe("analyst");
    });
  });

  // =========================================================================
  // Source 3: Phases (buildPhasePresence + computePhaseStates)
  // =========================================================================
  describe("Source 3: Phases", () => {
    it("state 1 — normal: returns computed phases", async () => {
      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.phases).toHaveLength(4);
      expect(data.phases).toEqual(mockPhases);
    });

    it("state 2 — empty artifacts: returns all not-started phases", async () => {
      mockScanAllArtifacts.mockResolvedValueOnce([]);
      mockBuildPhasePresence.mockReturnValueOnce({
        analysis: false,
        planning: false,
        solutioning: false,
        implementation: false,
      });

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.phases).toHaveLength(4);
      for (const phase of data.phases) {
        expect(phase.state).toBe("not-started");
      }
    });

    it("state 3 — truncated artifacts: returns phases from partial presence", async () => {
      mockBuildPhasePresence.mockReturnValueOnce({
        analysis: false,
        planning: true,
        solutioning: false,
        implementation: false,
      });

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.phases).toHaveLength(4);
    });

    it("state 4 — invalid artifacts (all null phase): returns phases from empty presence", async () => {
      mockScanAllArtifacts.mockResolvedValueOnce([
        {
          filename: "x.md",
          path: "x",
          modifiedAt: "2026-03-13T00:00:00.000Z",
          phase: null,
          type: "Uncategorized",
        },
      ]);
      mockBuildPhasePresence.mockReturnValueOnce({
        analysis: false,
        planning: false,
        solutioning: false,
        implementation: false,
      });

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.phases).toHaveLength(4);
      for (const phase of data.phases) {
        expect(phase.state).toBe("not-started");
      }
    });

    it("state 5 — buildPhasePresence throws: falls back to LKG phases", async () => {
      await seedCache();
      mockBuildPhasePresence.mockImplementationOnce(() => {
        throw new Error("Unexpected error in buildPhasePresence");
      });

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.phases).toHaveLength(4);
      expect(data.phases).toEqual(mockPhases);
    });

    it("state 6 — computePhaseStates throws: falls back to LKG phases", async () => {
      await seedCache();
      mockComputePhaseStates.mockImplementationOnce(() => {
        throw new Error("Unexpected error in computePhaseStates");
      });

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.phases).toHaveLength(4);
      expect(data.phases).toEqual(mockPhases);
    });
  });

  // =========================================================================
  // Source 4: Recommendation (getRecommendation)
  // =========================================================================
  describe("Source 4: Recommendation", () => {
    it("state 1 — normal: returns computed recommendation", async () => {
      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recommendation).not.toBeNull();
      expect(data.recommendation.tier).toBe(2);
      expect(data.recommendation.observation).toBeDefined();
    });

    it("state 2 — empty artifacts: returns recommendation from empty context", async () => {
      mockScanAllArtifacts.mockResolvedValueOnce([]);
      mockBuildPhasePresence.mockReturnValueOnce({
        analysis: false,
        planning: false,
        solutioning: false,
        implementation: false,
      });
      mockGetRecommendation.mockReturnValueOnce({
        tier: 1,
        observation: "No BMAD artifacts found in the project",
        implication: "A product brief captures the initial vision and scope",
        phase: "analysis",
      });

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recommendation).not.toBeNull();
      expect(data.recommendation.tier).toBe(1);
      expect(data.recommendation.phase).toBe("analysis");
    });

    it("state 3 — truncated artifacts: returns recommendation from partial context", async () => {
      mockGetRecommendation.mockReturnValueOnce({
        tier: 1,
        observation: "No PRD found",
        implication: "A PRD defines requirements",
        phase: "planning",
      });

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recommendation).not.toBeNull();
      expect(data.recommendation.phase).toBe("planning");
    });

    it("state 4 — invalid artifacts: returns null recommendation (R7 no-match)", async () => {
      mockGetRecommendation.mockReturnValueOnce(null);

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recommendation).toBeNull();
    });

    it("state 5 — getRecommendation throws: falls back to LKG", async () => {
      await seedCache();
      mockGetRecommendation.mockImplementationOnce(() => {
        throw new Error("Unexpected error in getRecommendation");
      });

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recommendation).toEqual(mockRecommendation);
    });

    it("state 6 — getRecommendation throws (second path): falls back to LKG", async () => {
      await seedCache();
      mockGetRecommendation.mockImplementationOnce(() => {
        throw new TypeError("Cannot read properties of undefined");
      });

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recommendation).toEqual(mockRecommendation);
    });
  });

  // =========================================================================
  // Source 5: LastActivity (derived from artifacts)
  // =========================================================================
  describe("Source 5: LastActivity", () => {
    it("state 1 — normal: returns latest phased artifact", async () => {
      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.lastActivity).not.toBeNull();
      expect(data.lastActivity.filename).toBe("architecture.md");
      expect(data.lastActivity.phase).toBe("solutioning");
      expect(data.lastActivity.modifiedAt).toBe("2026-03-13T10:00:00.000Z");
    });

    it("state 2 — empty artifacts: returns null lastActivity", async () => {
      mockScanAllArtifacts.mockResolvedValueOnce([]);
      mockBuildPhasePresence.mockReturnValueOnce({
        analysis: false,
        planning: false,
        solutioning: false,
        implementation: false,
      });

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.lastActivity).toBeNull();
    });

    it("state 3 — truncated (one phased artifact): returns that artifact", async () => {
      const singleArtifact: ClassifiedArtifact[] = [
        {
          filename: "brief.md",
          path: "_bmad-output/planning-artifacts/brief.md",
          modifiedAt: "2026-03-11T10:00:00.000Z",
          phase: "analysis",
          type: "Brief",
        },
      ];
      mockScanAllArtifacts.mockResolvedValueOnce(singleArtifact);

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.lastActivity).not.toBeNull();
      expect(data.lastActivity.filename).toBe("brief.md");
      expect(data.lastActivity.phase).toBe("analysis");
    });

    it("state 4 — invalid (all null phases): returns null lastActivity", async () => {
      mockScanAllArtifacts.mockResolvedValueOnce([
        {
          filename: "unknown.md",
          path: "_bmad-output/planning-artifacts/unknown.md",
          modifiedAt: "2026-03-13T10:00:00.000Z",
          phase: null,
          type: "Uncategorized",
        },
      ]);
      mockBuildPhasePresence.mockReturnValueOnce({
        analysis: false,
        planning: false,
        solutioning: false,
        implementation: false,
      });

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.lastActivity).toBeNull();
    });

    it("state 5 — artifacts EACCES: lastActivity derived from LKG artifacts", async () => {
      await seedCache();
      mockScanAllArtifacts.mockRejectedValueOnce(new Error("EACCES: permission denied"));

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      // lastActivity derived from cached artifacts (which have phased entries)
      expect(data.lastActivity).not.toBeNull();
      expect(data.lastActivity.filename).toBe("architecture.md");
    });

    it("state 6 — artifacts EBUSY: lastActivity derived from LKG artifacts", async () => {
      await seedCache();
      mockScanAllArtifacts.mockRejectedValueOnce(new Error("EBUSY: resource busy"));

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.lastActivity).not.toBeNull();
      expect(data.lastActivity.filename).toBe("architecture.md");
    });
  });

  // =========================================================================
  // All 30 scenarios: HTTP 200 verification
  // =========================================================================
  describe("All scenarios return HTTP 200 (NFR-R1 verification)", () => {
    it("simultaneous artifact + agent failures still return well-formed 200", async () => {
      await seedCache();

      // Both primary I/O sources fail simultaneously
      mockScanAllArtifacts.mockRejectedValueOnce(new Error("EACCES"));
      mockReadFile.mockRejectedValueOnce(new Error("EBUSY"));

      const response = await GET(makeRequest(), makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      // Response shape is complete — no missing fields
      expect(data).toHaveProperty("projectId");
      expect(data).toHaveProperty("phases");
      expect(data).toHaveProperty("artifacts");
      expect(data).toHaveProperty("agents");
      expect(data).toHaveProperty("recommendation");
      expect(data).toHaveProperty("lastActivity");
    });
  });
});

// =============================================================================
// LKG Sequential Validation (Story 10-4, AC1)
// =============================================================================
describe("LKG Sequential Validation (Story 10-4, AC1)", () => {
  beforeEach(resetAllMocks);

  describe("valid → invalid → valid sequence for artifacts", () => {
    it("returns cached artifacts on failure, then fresh on recovery", async () => {
      // Call 1: valid — fresh artifacts, cache populated
      const r1 = await GET(makeRequest(), makeParams("test-project"));
      const d1 = await r1.json();
      expect(d1.artifacts).toEqual(mockArtifacts);
      expect(lkgCache.get("test-project", "artifacts")).toEqual(mockArtifacts);

      // Call 2: invalid — scanAllArtifacts throws, cache serves
      mockScanAllArtifacts.mockRejectedValueOnce(new Error("EACCES"));
      const r2 = await GET(makeRequest(), makeParams("test-project"));
      const d2 = await r2.json();
      expect(r2.status).toBe(200);
      expect(d2.artifacts).toEqual(mockArtifacts); // from cache

      // Call 3: valid — fresh artifacts again, cache updated
      const newArtifacts: ClassifiedArtifact[] = [
        ...mockArtifacts,
        {
          filename: "epics.md",
          path: "_bmad-output/planning-artifacts/epics.md",
          modifiedAt: "2026-03-14T10:00:00.000Z",
          phase: "solutioning",
          type: "Epics",
        },
      ];
      mockScanAllArtifacts.mockResolvedValueOnce(newArtifacts);
      const r3 = await GET(makeRequest(), makeParams("test-project"));
      const d3 = await r3.json();
      expect(d3.artifacts).toEqual(newArtifacts);
      expect(d3.artifacts).toHaveLength(3);
      // Cache updated to fresh data
      expect(lkgCache.get("test-project", "artifacts")).toEqual(newArtifacts);
    });
  });

  describe("valid → invalid → valid sequence for agents", () => {
    it("returns cached agents on failure, then fresh on recovery", async () => {
      // Call 1: valid
      const r1 = await GET(makeRequest(), makeParams("test-project"));
      const d1 = await r1.json();
      expect(d1.agents).toHaveLength(1);
      expect(d1.agents[0].name).toBe("analyst");

      // Call 2: readFile throws → cached agents
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT: no such file"));
      const r2 = await GET(makeRequest(), makeParams("test-project"));
      const d2 = await r2.json();
      expect(r2.status).toBe(200);
      expect(d2.agents).toHaveLength(1);
      expect(d2.agents[0].name).toBe("analyst");

      // Call 3: valid — fresh agents with new data
      mockParseAgentManifest.mockReturnValueOnce([
        {
          name: "analyst",
          displayName: "Analyst",
          title: "Business Analyst",
          icon: "📊",
          role: "Analyzes",
        },
        {
          name: "pm",
          displayName: "PM",
          title: "Product Manager",
          icon: "📋",
          role: "Manages product",
        },
      ]);
      const r3 = await GET(makeRequest(), makeParams("test-project"));
      const d3 = await r3.json();
      expect(d3.agents).toHaveLength(2);
      expect(d3.agents[1].name).toBe("pm");
    });
  });

  describe("valid → total failure → valid sequence (outer catch)", () => {
    it("returns LKG on total failure, then fresh on recovery", async () => {
      // Call 1: valid
      const r1 = await GET(makeRequest(), makeParams("test-project"));
      const d1 = await r1.json();
      expect(r1.status).toBe(200);
      expect(d1.hasBmad).toBe(true);

      // Call 2: getServices throws → outer catch → LKG
      const { getServices } = await import("@/lib/services");
      vi.mocked(getServices).mockRejectedValueOnce(new Error("Config corrupted"));
      const r2 = await GET(makeRequest(), makeParams("test-project"));
      const d2 = await r2.json();
      expect(r2.status).toBe(200);
      expect(d2.projectId).toBe("test-project");
      expect(d2.hasBmad).toBe(true);
      expect(d2.phases).toEqual(d1.phases);
      expect(d2.artifacts).toEqual(d1.artifacts);

      // Call 3: valid — fresh data, cache refreshed
      const r3 = await GET(makeRequest(), makeParams("test-project"));
      const d3 = await r3.json();
      expect(r3.status).toBe(200);
      expect(d3.hasBmad).toBe(true);
      expect(d3.artifacts).toEqual(mockArtifacts);
    });
  });

  it("cached values from call 2 match fresh values from call 1 exactly", async () => {
    // Call 1
    const r1 = await GET(makeRequest(), makeParams("test-project"));
    const d1 = await r1.json();

    // Call 2 — failure
    mockScanAllArtifacts.mockRejectedValueOnce(new Error("EACCES"));
    const r2 = await GET(makeRequest(), makeParams("test-project"));
    const d2 = await r2.json();

    // Cached artifacts should exactly match call 1's artifacts
    expect(d2.artifacts).toEqual(d1.artifacts);
  });
});

// =============================================================================
// Panel Independence Comprehensive Tests (Story 10-4, AC4)
// =============================================================================
describe("Panel Independence (Story 10-4, AC4)", () => {
  beforeEach(resetAllMocks);

  it("artifacts fail → agents fresh, phases from LKG, recommendation from LKG", async () => {
    await seedCache();
    mockScanAllArtifacts.mockRejectedValueOnce(new Error("EACCES"));

    const response = await GET(makeRequest(), makeParams("test-project"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasBmad).toBe(true);
    // Artifacts from LKG
    expect(data.artifacts).toEqual(mockArtifacts);
    // Agents fresh (not affected by artifact failure)
    expect(data.agents).not.toBeNull();
    expect(data.agents[0].name).toBe("analyst");
    // Phases and recommendation computed from LKG artifacts
    expect(data.phases).toHaveLength(4);
    expect(data.recommendation).not.toBeNull();
  });

  it("agents fail → artifacts fresh, phases fresh, recommendation fresh, lastActivity fresh", async () => {
    await seedCache();
    mockReadFile.mockRejectedValueOnce(new Error("EACCES"));

    const response = await GET(makeRequest(), makeParams("test-project"));
    const data = await response.json();

    expect(response.status).toBe(200);
    // Agents from LKG
    expect(data.agents).not.toBeNull();
    expect(data.agents[0].name).toBe("analyst");
    // Everything else fresh
    expect(data.artifacts).toEqual(mockArtifacts);
    expect(data.phases).toEqual(mockPhases);
    expect(data.recommendation).toEqual(mockRecommendation);
    expect(data.lastActivity).not.toBeNull();
    expect(data.lastActivity.filename).toBe("architecture.md");
  });

  it("both artifacts AND agents fail → all from LKG", async () => {
    await seedCache();
    mockScanAllArtifacts.mockRejectedValueOnce(new Error("EACCES"));
    mockReadFile.mockRejectedValueOnce(new Error("EBUSY"));

    const response = await GET(makeRequest(), makeParams("test-project"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasBmad).toBe(true);
    // Both from LKG
    expect(data.artifacts).toEqual(mockArtifacts);
    expect(data.agents).not.toBeNull();
    expect(data.agents[0].name).toBe("analyst");
  });

  it("artifacts fail on cold start → artifacts [], agents fresh, phases all not-started", async () => {
    // No seedCache — cold start
    mockScanAllArtifacts.mockRejectedValueOnce(new Error("EACCES"));

    const response = await GET(makeRequest(), makeParams("test-project"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hasBmad).toBe(true);
    // Artifacts empty (no cache)
    expect(data.artifacts).toEqual([]);
    // Agents still fresh
    expect(data.agents).not.toBeNull();
    expect(data.agents[0].name).toBe("analyst");
    // lastActivity null (no artifacts)
    expect(data.lastActivity).toBeNull();
  });

  it("fresh sources are not pulled from cache when they succeed", async () => {
    await seedCache();

    // Only artifacts fail — agents should be FRESH, not from cache
    mockScanAllArtifacts.mockRejectedValueOnce(new Error("EACCES"));
    // Change agent mock to return different data to prove freshness
    mockParseAgentManifest.mockReturnValueOnce([
      { name: "dev", displayName: "Developer", title: "Software Dev", icon: "💻", role: "Codes" },
    ]);

    const response = await GET(makeRequest(), makeParams("test-project"));
    const data = await response.json();

    expect(response.status).toBe(200);
    // Agents are FRESH (new mock data), not cached
    expect(data.agents[0].name).toBe("dev");
    expect(data.agents[0].displayName).toBe("Developer");
  });
});
