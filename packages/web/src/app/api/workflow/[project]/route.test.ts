/**
 * Workflow API Route Tests (Story 7.2)
 *
 * Tests for GET /api/workflow/[project] endpoint — validates all 5 ACs
 * from Story 1.2 (Workflow API Route).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClassifiedArtifact, PhaseEntry, Recommendation } from "@/lib/workflow/types";

// --- Mock setup ---

const mockPhases: PhaseEntry[] = [
  { id: "analysis", label: "Analysis", state: "done" },
  { id: "planning", label: "Planning", state: "done" },
  { id: "solutioning", label: "Solutioning", state: "active" },
  { id: "implementation", label: "Implementation", state: "not-started" },
];

const mockNotStartedPhases: PhaseEntry[] = [
  { id: "analysis", label: "Analysis", state: "not-started" },
  { id: "planning", label: "Planning", state: "not-started" },
  { id: "solutioning", label: "Solutioning", state: "not-started" },
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
    filename: "prd-dashboard.md",
    path: "_bmad-output/planning-artifacts/prd-dashboard.md",
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

// Mock getServices
vi.mock("@/lib/services", () => ({
  getServices: vi.fn(async () => ({
    config: {
      projects: {
        "test-project": {
          name: "Test Project",
          path: "/test/project",
        },
        "no-bmad-project": {
          name: "No BMAD",
          path: "/test/no-bmad",
        },
      },
      configPath: "/test/config",
    },
  })),
}));

// Mock node:fs/promises — use vi.hoisted() since vi.mock is hoisted
const { mockReaddir, mockReadFile } = vi.hoisted(() => ({
  mockReaddir: vi.fn(async (dirPath: string) => {
    if (typeof dirPath === "string" && dirPath.includes("no-bmad")) {
      throw new Error("ENOENT");
    }
    if (typeof dirPath === "string" && dirPath.includes("_bmad")) {
      return ["_config"];
    }
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

// Mock workflow lib modules
vi.mock("@/lib/workflow/scan-artifacts.js", () => ({
  scanAllArtifacts: vi.fn(async () => mockArtifacts),
  buildPhasePresence: vi.fn(() => mockPresence),
}));

vi.mock("@/lib/workflow/compute-state.js", () => ({
  computePhaseStates: vi.fn((presence: Record<string, boolean>) => {
    const hasAny = Object.values(presence).some(Boolean);
    if (!hasAny) return mockNotStartedPhases;
    return mockPhases;
  }),
}));

vi.mock("@/lib/workflow/recommendation-engine.js", () => ({
  getRecommendation: vi.fn(() => mockRecommendation),
  getStateMachineRecommendation: vi.fn().mockReturnValue(null),
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
import { GET } from "./route";
import { lkgCache } from "@/lib/workflow/lkg-cache";

function makeParams(project: string) {
  return { params: Promise.resolve({ project }) };
}

describe("GET /api/workflow/[project]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lkgCache._resetForTesting();
  });

  describe("AC1: valid project with BMAD artifacts", () => {
    it("returns HTTP 200 with full WorkflowResponse", async () => {
      const request = new Request("http://localhost:3000/api/workflow/test-project");

      const response = await GET(request, makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.projectId).toBe("test-project");
      expect(data.projectName).toBe("Test Project");
      expect(data.hasBmad).toBe(true);
    });

    it("includes phases array with phase entries", async () => {
      const request = new Request("http://localhost:3000/api/workflow/test-project");

      const response = await GET(request, makeParams("test-project"));
      const data = await response.json();

      expect(data.phases).toHaveLength(4);
      expect(data.phases[0]).toHaveProperty("id");
      expect(data.phases[0]).toHaveProperty("label");
      expect(data.phases[0]).toHaveProperty("state");
    });

    it("includes recommendation object", async () => {
      const request = new Request("http://localhost:3000/api/workflow/test-project");

      const response = await GET(request, makeParams("test-project"));
      const data = await response.json();

      expect(data.recommendation).not.toBeNull();
      expect(data.recommendation.tier).toBe(2);
      expect(data.recommendation.observation).toBeDefined();
      expect(data.recommendation.implication).toBeDefined();
      expect(data.recommendation.phase).toBeDefined();
    });

    it("includes artifacts array", async () => {
      const request = new Request("http://localhost:3000/api/workflow/test-project");

      const response = await GET(request, makeParams("test-project"));
      const data = await response.json();

      expect(data.artifacts).toHaveLength(2);
      expect(data.artifacts[0]).toHaveProperty("filename");
      expect(data.artifacts[0]).toHaveProperty("path");
      expect(data.artifacts[0]).toHaveProperty("modifiedAt");
      expect(data.artifacts[0]).toHaveProperty("phase");
      expect(data.artifacts[0]).toHaveProperty("type");
    });

    it("includes agents array when manifest exists", async () => {
      const request = new Request("http://localhost:3000/api/workflow/test-project");

      const response = await GET(request, makeParams("test-project"));
      const data = await response.json();

      expect(data.agents).not.toBeNull();
      expect(data.agents).toHaveLength(1);
      expect(data.agents[0]).toHaveProperty("name");
      expect(data.agents[0]).toHaveProperty("displayName");
      expect(data.agents[0]).toHaveProperty("title");
      expect(data.agents[0]).toHaveProperty("icon");
      expect(data.agents[0]).toHaveProperty("role");
    });

    it("includes lastActivity from first phased artifact", async () => {
      const request = new Request("http://localhost:3000/api/workflow/test-project");

      const response = await GET(request, makeParams("test-project"));
      const data = await response.json();

      expect(data.lastActivity).not.toBeNull();
      expect(data.lastActivity.filename).toBe("architecture.md");
      expect(data.lastActivity.phase).toBe("solutioning");
      expect(data.lastActivity.modifiedAt).toBe("2026-03-13T10:00:00.000Z");
    });
  });

  describe("AC2: valid project with no _bmad/ directory", () => {
    it("returns HTTP 200 with hasBmad: false", async () => {
      const request = new Request("http://localhost:3000/api/workflow/no-bmad-project");

      const response = await GET(request, makeParams("no-bmad-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hasBmad).toBe(false);
    });

    it("returns 4 not-started phase entries", async () => {
      const request = new Request("http://localhost:3000/api/workflow/no-bmad-project");

      const response = await GET(request, makeParams("no-bmad-project"));
      const data = await response.json();

      expect(data.phases).toHaveLength(4);
      for (const phase of data.phases) {
        expect(phase.state).toBe("not-started");
      }
    });

    it("returns null for agents, recommendation, lastActivity", async () => {
      const request = new Request("http://localhost:3000/api/workflow/no-bmad-project");

      const response = await GET(request, makeParams("no-bmad-project"));
      const data = await response.json();

      expect(data.agents).toBeNull();
      expect(data.recommendation).toBeNull();
      expect(data.lastActivity).toBeNull();
    });

    it("returns empty artifacts array", async () => {
      const request = new Request("http://localhost:3000/api/workflow/no-bmad-project");

      const response = await GET(request, makeParams("no-bmad-project"));
      const data = await response.json();

      expect(data.artifacts).toEqual([]);
    });
  });

  describe("AC3: unknown project ID", () => {
    it("returns HTTP 404 with error message", async () => {
      const request = new Request("http://localhost:3000/api/workflow/nonexistent");

      const response = await GET(request, makeParams("nonexistent"));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Project not found");
    });
  });

  describe("AC4: graceful degradation for malformed/missing files", () => {
    it("returns 200 with agents: null when manifest file is missing", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT: no such file"));

      const request = new Request("http://localhost:3000/api/workflow/test-project");

      const response = await GET(request, makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).toBeNull();
    });

    it("returns 200 with agents: null when manifest has no valid agent rows", async () => {
      const { parseAgentManifest } = await import("@/lib/workflow/parse-agents.js");
      vi.mocked(parseAgentManifest).mockReturnValueOnce([]);

      const request = new Request("http://localhost:3000/api/workflow/test-project");

      const response = await GET(request, makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).toBeNull();
    });
  });

  describe("unexpected errors", () => {
    it("returns 200 with empty response when getServices throws (AC4 — never 500 for file errors)", async () => {
      const { getServices } = await import("@/lib/services");
      vi.mocked(getServices).mockRejectedValueOnce(new Error("Config load failed"));

      const request = new Request("http://localhost:3000/api/workflow/test-project");

      const response = await GET(request, makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.projectId).toBe("test-project");
      expect(data.hasBmad).toBe(false);
      expect(data.agents).toBeNull();
      expect(data.recommendation).toBeNull();
      expect(data.artifacts).toEqual([]);
      expect(data.lastActivity).toBeNull();
    });
  });

  describe("AC5: response shape matches frozen WorkflowResponse", () => {
    it("contains all required top-level fields", async () => {
      const request = new Request("http://localhost:3000/api/workflow/test-project");

      const response = await GET(request, makeParams("test-project"));
      const data = await response.json();

      expect(data).toHaveProperty("projectId");
      expect(data).toHaveProperty("projectName");
      expect(data).toHaveProperty("hasBmad");
      expect(data).toHaveProperty("phases");
      expect(data).toHaveProperty("agents");
      expect(data).toHaveProperty("recommendation");
      expect(data).toHaveProperty("artifacts");
      expect(data).toHaveProperty("lastActivity");

      // Verify types
      expect(typeof data.projectId).toBe("string");
      expect(typeof data.projectName).toBe("string");
      expect(typeof data.hasBmad).toBe("boolean");
      expect(Array.isArray(data.phases)).toBe(true);
      expect(Array.isArray(data.artifacts)).toBe(true);
    });

    it("phase entries have correct shape", async () => {
      const request = new Request("http://localhost:3000/api/workflow/test-project");

      const response = await GET(request, makeParams("test-project"));
      const data = await response.json();

      for (const phase of data.phases) {
        expect(typeof phase.id).toBe("string");
        expect(typeof phase.label).toBe("string");
        expect(["not-started", "done", "active"]).toContain(phase.state);
      }
    });

    it("hasBmad=false response also has correct shape", async () => {
      const request = new Request("http://localhost:3000/api/workflow/no-bmad-project");

      const response = await GET(request, makeParams("no-bmad-project"));
      const data = await response.json();

      // Same fields must exist even for no-bmad response
      expect(data).toHaveProperty("projectId");
      expect(data).toHaveProperty("projectName");
      expect(data).toHaveProperty("hasBmad");
      expect(data).toHaveProperty("phases");
      expect(data).toHaveProperty("agents");
      expect(data).toHaveProperty("recommendation");
      expect(data).toHaveProperty("artifacts");
      expect(data).toHaveProperty("lastActivity");
    });
  });

  describe("edge cases", () => {
    it("lastActivity is null when all artifacts have null phase", async () => {
      const { scanAllArtifacts } = await import("@/lib/workflow/scan-artifacts.js");
      vi.mocked(scanAllArtifacts).mockResolvedValueOnce([
        {
          filename: "unknown-file.md",
          path: "_bmad-output/planning-artifacts/unknown-file.md",
          modifiedAt: "2026-03-13T10:00:00.000Z",
          phase: null,
          type: "Uncategorized",
        },
      ]);

      const request = new Request("http://localhost:3000/api/workflow/test-project");

      const response = await GET(request, makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.lastActivity).toBeNull();
    });

    it("uses projectId as projectName when name is not configured", async () => {
      const { getServices } = await import("@/lib/services");
      vi.mocked(getServices).mockResolvedValueOnce({
        config: {
          projects: {
            "unnamed-project": {
              path: "/test/project",
              // name intentionally omitted
            },
          },
          configPath: "/test/config",
        },
      } as any);

      const request = new Request("http://localhost:3000/api/workflow/unnamed-project");

      const response = await GET(request, makeParams("unnamed-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.projectName).toBe("unnamed-project");
    });

    it("returns 200 with empty response for non-Error throws (AC4)", async () => {
      const { getServices } = await import("@/lib/services");
      vi.mocked(getServices).mockRejectedValueOnce("string error");

      const request = new Request("http://localhost:3000/api/workflow/test-project");

      const response = await GET(request, makeParams("test-project"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.projectId).toBe("test-project");
      expect(data.hasBmad).toBe(false);
      expect(data.artifacts).toEqual([]);
    });
  });
});
