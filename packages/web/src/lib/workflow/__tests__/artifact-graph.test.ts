/**
 * Artifact dependency graph tests — frontmatter parsing, graph building, service.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ArtifactDependencyGraph, ClassifiedArtifact, Phase } from "../types.js";

// Shared mock references — declared BEFORE vi.mock so they're captured in factory closures
const mockReadFileFn = vi.fn<[unknown, unknown], Promise<string>>();
const mockScanAllArtifactsFn = vi.fn<[], Promise<ClassifiedArtifact[]>>().mockResolvedValue([]);

vi.mock("node:fs/promises", () => ({
  default: { readFile: mockReadFileFn },
  readFile: mockReadFileFn,
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn(),
}));

vi.mock("../scan-artifacts.js", () => ({
  scanAllArtifacts: mockScanAllArtifactsFn,
  buildPhasePresence: vi.fn((artifacts: Array<{ phase: string | null }>) => {
    const presence: Record<string, boolean> = {
      analysis: false,
      planning: false,
      solutioning: false,
      implementation: false,
    };
    for (const a of artifacts) {
      if (a.phase) presence[a.phase] = true;
    }
    return presence;
  }),
}));

// Import AFTER mocks are set up (vi.mock is hoisted, but these run in order)
const { buildArtifactGraph, buildGuardContext, createArtifactGraphService, parseFrontmatterDeps } =
  await import("../artifact-graph.js");

const mockedReadFile = mockReadFileFn;
const mockedScanAllArtifacts = mockScanAllArtifactsFn;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArtifact(
  filename: string,
  artifactPath: string,
  phase: Phase | null,
  type: string,
): ClassifiedArtifact {
  return {
    filename,
    path: artifactPath,
    modifiedAt: new Date().toISOString(),
    phase,
    type,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// parseFrontmatterDeps tests
// ---------------------------------------------------------------------------

describe("parseFrontmatterDeps", () => {
  it("extracts inputDocuments from valid frontmatter", () => {
    const content = `---
stepsCompleted: [1, 2]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
workflowType: architecture
---

# Architecture Document
`;
    const deps = parseFrontmatterDeps(content);
    expect(deps).toEqual([
      "_bmad-output/planning-artifacts/prd.md",
      "_bmad-output/planning-artifacts/architecture.md",
    ]);
  });

  it("returns empty array when no frontmatter", () => {
    expect(parseFrontmatterDeps("# Just markdown")).toEqual([]);
  });

  it("returns empty array when frontmatter has no inputDocuments", () => {
    const content = `---
stepsCompleted: [1]
workflowType: prd
---

# PRD
`;
    expect(parseFrontmatterDeps(content)).toEqual([]);
  });

  it("returns empty array for empty inputDocuments", () => {
    const content = `---
inputDocuments: []
---
`;
    expect(parseFrontmatterDeps(content)).toEqual([]);
  });

  it("handles quoted paths in inputDocuments", () => {
    const content = `---
inputDocuments:
  - 'docs/design/design-brief.md'
  - "docs/design/other.md"
---
`;
    const deps = parseFrontmatterDeps(content);
    expect(deps).toEqual(["docs/design/design-brief.md", "docs/design/other.md"]);
  });

  it("handles empty string content", () => {
    expect(parseFrontmatterDeps("")).toEqual([]);
  });

  it("handles malformed frontmatter gracefully", () => {
    const content = `---
broken yaml: [
---
`;
    expect(parseFrontmatterDeps(content)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildArtifactGraph tests
// ---------------------------------------------------------------------------

describe("buildArtifactGraph", () => {
  it("builds empty graph from empty artifacts", async () => {
    const graph = await buildArtifactGraph([], "/project");
    expect(graph.nodes.size).toBe(0);
    expect(graph.edges).toHaveLength(0);
  });

  it("builds graph with nodes but no edges when no deps", async () => {
    mockedReadFile.mockResolvedValue("# No frontmatter");

    const artifacts = [
      makeArtifact("prd.md", "_bmad-output/planning-artifacts/prd.md", "planning", "PRD"),
      makeArtifact(
        "arch.md",
        "_bmad-output/planning-artifacts/arch.md",
        "solutioning",
        "Architecture",
      ),
    ];

    const graph = await buildArtifactGraph(artifacts, "/project");
    expect(graph.nodes.size).toBe(2);
    expect(graph.edges).toHaveLength(0);
  });

  it("builds edges from inputDocuments frontmatter", async () => {
    mockedReadFile.mockImplementation(async (p: unknown) => {
      if (String(p).includes("arch")) {
        return `---
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
---
# Architecture`;
      }
      return "# No deps";
    });

    const artifacts = [
      makeArtifact("prd.md", "_bmad-output/planning-artifacts/prd.md", "planning", "PRD"),
      makeArtifact(
        "arch.md",
        "_bmad-output/planning-artifacts/arch.md",
        "solutioning",
        "Architecture",
      ),
    ];

    const graph = await buildArtifactGraph(artifacts, "/project");
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].from).toBe("_bmad-output/planning-artifacts/arch.md");
    expect(graph.edges[0].to).toBe("_bmad-output/planning-artifacts/prd.md");

    const archNode = graph.nodes.get("_bmad-output/planning-artifacts/arch.md");
    expect(archNode?.dependsOn).toContain("_bmad-output/planning-artifacts/prd.md");

    const prdNode = graph.nodes.get("_bmad-output/planning-artifacts/prd.md");
    expect(prdNode?.referencedBy).toContain("_bmad-output/planning-artifacts/arch.md");
  });

  it("handles broken references gracefully", async () => {
    mockedReadFile.mockResolvedValue(`---
inputDocuments:
  - _bmad-output/planning-artifacts/nonexistent.md
---
`);

    const artifacts = [
      makeArtifact("prd.md", "_bmad-output/planning-artifacts/prd.md", "planning", "PRD"),
    ];

    const graph = await buildArtifactGraph(artifacts, "/project");
    expect(graph.nodes.size).toBe(1);
    expect(graph.edges).toHaveLength(0);
  });

  it("handles file read errors gracefully", async () => {
    mockedReadFile.mockRejectedValue(new Error("EACCES"));

    const artifacts = [
      makeArtifact("prd.md", "_bmad-output/planning-artifacts/prd.md", "planning", "PRD"),
    ];

    const graph = await buildArtifactGraph(artifacts, "/project");
    expect(graph.nodes.size).toBe(1);
    expect(graph.edges).toHaveLength(0);
  });

  it("builds multiple dependency edges", async () => {
    const fileContents: Record<string, string> = {
      "epics.md": `---
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/arch.md
---
`,
    };
    mockedReadFile.mockImplementation(async (p: unknown) => {
      const fp = String(p);
      for (const [key, content] of Object.entries(fileContents)) {
        if (fp.includes(key)) return content;
      }
      return "# No deps";
    });

    const artifacts = [
      makeArtifact("prd.md", "_bmad-output/planning-artifacts/prd.md", "planning", "PRD"),
      makeArtifact(
        "arch.md",
        "_bmad-output/planning-artifacts/arch.md",
        "solutioning",
        "Architecture",
      ),
      makeArtifact(
        "epics.md",
        "_bmad-output/planning-artifacts/epics.md",
        "solutioning",
        "Epics & Stories",
      ),
    ];

    const graph = await buildArtifactGraph(artifacts, "/project");
    expect(graph.edges).toHaveLength(2);

    const epicsNode = graph.nodes.get("_bmad-output/planning-artifacts/epics.md");
    expect(epicsNode?.dependsOn).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// buildGuardContext tests
// ---------------------------------------------------------------------------

describe("buildGuardContext", () => {
  it("produces valid GuardContext from graph", async () => {
    mockedReadFile.mockResolvedValue("# No deps");

    const artifacts = [
      makeArtifact("brief.md", "p/brief.md", "analysis", "Product Brief"),
      makeArtifact("prd.md", "p/prd.md", "planning", "PRD"),
    ];

    const graph = await buildArtifactGraph(artifacts, "/project");
    const ctx = buildGuardContext(graph);

    expect(ctx.phasePresence.analysis).toBe(true);
    expect(ctx.phasePresence.planning).toBe(true);
    expect(ctx.phasePresence.solutioning).toBe(false);
    expect(ctx.phasePresence.implementation).toBe(false);
    expect(ctx.artifacts).toHaveLength(2);
  });

  it("produces empty context from empty graph", () => {
    const emptyGraph: ArtifactDependencyGraph = {
      nodes: new Map(),
      edges: [],
    };
    const ctx = buildGuardContext(emptyGraph);
    expect(ctx.phasePresence.analysis).toBe(false);
    expect(ctx.artifacts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// createArtifactGraphService tests
// ---------------------------------------------------------------------------

describe("createArtifactGraphService", () => {
  it("builds graph lazily on first getGraph call", async () => {
    mockedScanAllArtifacts.mockResolvedValue([
      makeArtifact("prd.md", "p/prd.md", "planning", "PRD"),
    ]);
    mockedReadFile.mockResolvedValue("# No deps");

    const service = createArtifactGraphService("/project");
    expect(mockedScanAllArtifacts).not.toHaveBeenCalled();

    const graph = await service.getGraph();
    expect(mockedScanAllArtifacts).toHaveBeenCalledOnce();
    expect(graph.nodes.size).toBe(1);
  });

  it("caches graph on subsequent calls", async () => {
    mockedScanAllArtifacts.mockResolvedValue([
      makeArtifact("prd.md", "p/prd.md", "planning", "PRD"),
    ]);
    mockedReadFile.mockResolvedValue("# No deps");

    const service = createArtifactGraphService("/project");
    await service.getGraph();
    await service.getGraph();
    expect(mockedScanAllArtifacts).toHaveBeenCalledOnce();
  });

  it("build() forces full rebuild", async () => {
    mockedScanAllArtifacts.mockResolvedValue([]);
    mockedReadFile.mockResolvedValue("");

    const service = createArtifactGraphService("/project");
    await service.getGraph();
    await service.build();
    expect(mockedScanAllArtifacts).toHaveBeenCalledTimes(2);
  });

  it("getGuardContext produces valid context", async () => {
    mockedScanAllArtifacts.mockResolvedValue([
      makeArtifact("brief.md", "p/brief.md", "analysis", "Product Brief"),
      makeArtifact("arch.md", "p/arch.md", "solutioning", "Architecture"),
    ]);
    mockedReadFile.mockResolvedValue("# No deps");

    const service = createArtifactGraphService("/project");
    const ctx = await service.getGuardContext();
    expect(ctx.phasePresence.analysis).toBe(true);
    expect(ctx.phasePresence.solutioning).toBe(true);
    expect(ctx.artifacts).toHaveLength(2);
  });

  it("dispose clears cache", async () => {
    mockedScanAllArtifacts.mockResolvedValue([]);
    mockedReadFile.mockResolvedValue("");

    const service = createArtifactGraphService("/project");
    await service.getGraph();
    service.dispose();
    await service.getGraph();
    expect(mockedScanAllArtifacts).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Performance test
// ---------------------------------------------------------------------------

describe("performance", () => {
  it("builds graph for 100 artifacts in <500ms", async () => {
    mockedReadFile.mockResolvedValue("# No deps");

    const artifacts: ClassifiedArtifact[] = Array.from({ length: 100 }, (_, i) =>
      makeArtifact(
        `artifact-${i}.md`,
        `_bmad-output/planning-artifacts/artifact-${i}.md`,
        i % 2 === 0 ? "planning" : "solutioning",
        i % 2 === 0 ? "PRD" : "Architecture",
      ),
    );

    const start = performance.now();
    const graph = await buildArtifactGraph(artifacts, "/project");
    const elapsed = performance.now() - start;

    expect(graph.nodes.size).toBe(100);
    expect(elapsed).toBeLessThan(500);
  });
});
