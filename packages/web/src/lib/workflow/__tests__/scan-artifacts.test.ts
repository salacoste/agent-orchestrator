import { existsSync } from "node:fs";
import { chmod, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { buildPhasePresence, scanAllArtifacts } from "../scan-artifacts.js";

// Project root for integration tests (NFR-T4)
const testFileDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testFileDir, "..", "..", "..", "..", "..", "..");
const bmadOutputDir = path.join(projectRoot, "_bmad-output");
const hasBmadOutput = existsSync(bmadOutputDir);

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "scan-artifacts-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function createBmadStructure(
  files: { dir: "planning" | "implementation" | "research"; name: string }[],
): Promise<void> {
  const planningDir = path.join(tempDir, "_bmad-output", "planning-artifacts");
  const implementationDir = path.join(tempDir, "_bmad-output", "implementation-artifacts");
  const researchDir = path.join(planningDir, "research");

  await mkdir(planningDir, { recursive: true });
  await mkdir(implementationDir, { recursive: true });
  await mkdir(researchDir, { recursive: true });

  for (const file of files) {
    let dir: string;
    if (file.dir === "planning") dir = planningDir;
    else if (file.dir === "implementation") dir = implementationDir;
    else dir = researchDir;
    await writeFile(path.join(dir, file.name), `# ${file.name}\nTest content`);
  }
}

describe("scanAllArtifacts", () => {
  it("returns empty array when _bmad-output does not exist", async () => {
    const result = await scanAllArtifacts(tempDir);
    expect(result).toEqual([]);
  });

  it("scans planning-artifacts for .md files", async () => {
    await createBmadStructure([{ dir: "planning", name: "product-brief.md" }]);
    const result = await scanAllArtifacts(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("product-brief.md");
    expect(result[0].phase).toBe("analysis");
    expect(result[0].type).toBe("Product Brief");
  });

  it("scans implementation-artifacts for .md files", async () => {
    await createBmadStructure([{ dir: "implementation", name: "sprint-status.md" }]);
    const result = await scanAllArtifacts(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("sprint-status.md");
    expect(result[0].phase).toBe("implementation");
  });

  it("scans research/ subdirectory inside planning-artifacts", async () => {
    await createBmadStructure([{ dir: "research", name: "tech-research.md" }]);
    const result = await scanAllArtifacts(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("tech-research.md");
  });

  it("skips non-.md files", async () => {
    await createBmadStructure([{ dir: "planning", name: "product-brief.md" }]);
    const planningDir = path.join(tempDir, "_bmad-output", "planning-artifacts");
    await writeFile(path.join(planningDir, "notes.txt"), "not markdown");
    await writeFile(path.join(planningDir, "data.yaml"), "key: value");

    const result = await scanAllArtifacts(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("product-brief.md");
  });

  it("skips .backup files", async () => {
    await createBmadStructure([{ dir: "planning", name: "product-brief.md" }]);
    const planningDir = path.join(tempDir, "_bmad-output", "planning-artifacts");
    await writeFile(path.join(planningDir, "old-draft.md.backup"), "backup content");

    const result = await scanAllArtifacts(tempDir);
    expect(result).toHaveLength(1);
  });

  it("classifies unmatched planning files as Uncategorized with null phase", async () => {
    await createBmadStructure([{ dir: "planning", name: "random-notes.md" }]);
    const result = await scanAllArtifacts(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0].phase).toBeNull();
    expect(result[0].type).toBe("Uncategorized");
  });

  it("classifies unmatched implementation files as Story Spec", async () => {
    await createBmadStructure([{ dir: "implementation", name: "7-1-my-story.md" }]);
    const result = await scanAllArtifacts(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0].phase).toBe("implementation");
    expect(result[0].type).toBe("Story Spec");
  });

  it("sorts artifacts by modification time (newest first)", async () => {
    await createBmadStructure([
      { dir: "planning", name: "product-brief.md" },
      { dir: "planning", name: "prd-dashboard.md" },
    ]);
    // Touch prd file to make it newer
    const prdPath = path.join(tempDir, "_bmad-output", "planning-artifacts", "prd-dashboard.md");
    const futureDate = new Date(Date.now() + 10000);
    const { utimes } = await import("node:fs/promises");
    await utimes(prdPath, futureDate, futureDate);

    const result = await scanAllArtifacts(tempDir);
    expect(result).toHaveLength(2);
    expect(result[0].filename).toBe("prd-dashboard.md");
  });

  it("combines artifacts from all directories", async () => {
    await createBmadStructure([
      { dir: "planning", name: "product-brief.md" },
      { dir: "planning", name: "prd-dashboard.md" },
      { dir: "research", name: "market-research.md" },
      { dir: "implementation", name: "sprint-status.md" },
    ]);
    const result = await scanAllArtifacts(tempDir);
    expect(result).toHaveLength(4);
  });

  it("includes relative path from project root", async () => {
    await createBmadStructure([{ dir: "planning", name: "product-brief.md" }]);
    const result = await scanAllArtifacts(tempDir);
    expect(result[0].path).toBe(
      path.join("_bmad-output", "planning-artifacts", "product-brief.md"),
    );
  });

  it("includes ISO 8601 modifiedAt timestamp", async () => {
    await createBmadStructure([{ dir: "planning", name: "product-brief.md" }]);
    const result = await scanAllArtifacts(tempDir);
    expect(result[0].modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("file state resilience (TS-07)", () => {
  it("discovers empty (0-byte) files and classifies by filename", async () => {
    const planningDir = path.join(tempDir, "_bmad-output", "planning-artifacts");
    await mkdir(planningDir, { recursive: true });
    await writeFile(path.join(planningDir, "product-brief.md"), "");

    const result = await scanAllArtifacts(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("product-brief.md");
    expect(result[0].phase).toBe("analysis");
    expect(result[0].type).toBe("Product Brief");
  });

  it("discovers files with truncated content and classifies by filename", async () => {
    const planningDir = path.join(tempDir, "_bmad-output", "planning-artifacts");
    await mkdir(planningDir, { recursive: true });
    await writeFile(path.join(planningDir, "architecture.md"), "---\ntitle: Arch");

    const result = await scanAllArtifacts(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("architecture.md");
    expect(result[0].phase).toBe("solutioning");
    expect(result[0].type).toBe("Architecture");
  });

  it("handles inaccessible directory gracefully (partial failure)", async () => {
    // Root can bypass filesystem permissions — skip test
    if (process.getuid && process.getuid() === 0) return;

    const planningDir = path.join(tempDir, "_bmad-output", "planning-artifacts");
    const implDir = path.join(tempDir, "_bmad-output", "implementation-artifacts");
    await mkdir(planningDir, { recursive: true });
    await mkdir(implDir, { recursive: true });
    await writeFile(path.join(planningDir, "product-brief.md"), "# Brief");
    await writeFile(path.join(implDir, "sprint-status.md"), "# Sprint");

    // Remove read/execute permissions on implementation-artifacts
    await chmod(implDir, 0o000);

    try {
      const result = await scanAllArtifacts(tempDir);
      // Only the planning artifact should be returned; impl dir is inaccessible
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe("product-brief.md");
    } finally {
      // Restore permissions for cleanup
      await chmod(implDir, 0o755);
    }
  });

  it("does not recurse into non-research subdirectories", async () => {
    const planningDir = path.join(tempDir, "_bmad-output", "planning-artifacts");
    const draftsDir = path.join(planningDir, "drafts");
    await mkdir(planningDir, { recursive: true });
    await mkdir(draftsDir, { recursive: true });
    await writeFile(path.join(planningDir, "product-brief.md"), "# Brief");
    await writeFile(path.join(draftsDir, "draft-prd.md"), "# Draft PRD");

    const result = await scanAllArtifacts(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("product-brief.md");
  });

  it("research artifacts have correct relative paths", async () => {
    await createBmadStructure([{ dir: "research", name: "market-research.md" }]);
    const result = await scanAllArtifacts(tempDir);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe(
      path.join("_bmad-output", "planning-artifacts", "research", "market-research.md"),
    );
  });
});

describe("integration: real _bmad/ directory (NFR-T4)", () => {
  describe.skipIf(!hasBmadOutput)("with real project artifacts", () => {
    it("discovers real BMAD artifacts", async () => {
      const artifacts = await scanAllArtifacts(projectRoot);
      expect(artifacts.length).toBeGreaterThan(0);
    });

    it("classifies real artifacts into all 4 phases", async () => {
      const artifacts = await scanAllArtifacts(projectRoot);
      const phases = new Set(artifacts.map((a) => a.phase).filter(Boolean));
      expect(phases).toContain("analysis");
      expect(phases).toContain("planning");
      expect(phases).toContain("solutioning");
      expect(phases).toContain("implementation");
    });

    it("buildPhasePresence returns true for all populated phases", async () => {
      const artifacts = await scanAllArtifacts(projectRoot);
      const presence = buildPhasePresence(artifacts);
      expect(presence.analysis).toBe(true);
      expect(presence.planning).toBe(true);
      expect(presence.solutioning).toBe(true);
      expect(presence.implementation).toBe(true);
    });

    it("includes expected known artifacts", async () => {
      const artifacts = await scanAllArtifacts(projectRoot);
      const filenames = artifacts.map((a) => a.filename);
      expect(filenames).toContain("architecture.md");
      expect(filenames.some((f) => f.includes("prd"))).toBe(true);
    });

    it("all artifacts have valid structure", async () => {
      const artifacts = await scanAllArtifacts(projectRoot);
      for (const artifact of artifacts) {
        expect(artifact).toHaveProperty("filename");
        expect(artifact).toHaveProperty("path");
        expect(artifact).toHaveProperty("modifiedAt");
        expect(artifact).toHaveProperty("phase");
        expect(artifact).toHaveProperty("type");
        expect(artifact.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    });
  });
});

describe("buildPhasePresence", () => {
  it("returns all false for empty artifacts", () => {
    const result = buildPhasePresence([]);
    expect(result).toEqual({
      analysis: false,
      planning: false,
      solutioning: false,
      implementation: false,
    });
  });

  it("returns true for phases that have artifacts", () => {
    const artifacts = [
      {
        filename: "brief.md",
        path: "brief.md",
        modifiedAt: "2026-03-13T00:00:00.000Z",
        phase: "analysis" as const,
        type: "Brief",
      },
      {
        filename: "prd.md",
        path: "prd.md",
        modifiedAt: "2026-03-13T00:00:00.000Z",
        phase: "planning" as const,
        type: "PRD",
      },
    ];
    const result = buildPhasePresence(artifacts);
    expect(result).toEqual({
      analysis: true,
      planning: true,
      solutioning: false,
      implementation: false,
    });
  });

  it("ignores artifacts with null phase", () => {
    const artifacts = [
      {
        filename: "random.md",
        path: "random.md",
        modifiedAt: "2026-03-13T00:00:00.000Z",
        phase: null,
        type: "Uncategorized",
      },
    ];
    const result = buildPhasePresence(artifacts);
    expect(result).toEqual({
      analysis: false,
      planning: false,
      solutioning: false,
      implementation: false,
    });
  });

  it("returns all true when artifacts exist in every phase", () => {
    const artifacts = [
      {
        filename: "brief.md",
        path: "brief.md",
        modifiedAt: "2026-03-13T00:00:00.000Z",
        phase: "analysis" as const,
        type: "Brief",
      },
      {
        filename: "prd.md",
        path: "prd.md",
        modifiedAt: "2026-03-13T00:00:00.000Z",
        phase: "planning" as const,
        type: "PRD",
      },
      {
        filename: "architecture.md",
        path: "architecture.md",
        modifiedAt: "2026-03-13T00:00:00.000Z",
        phase: "solutioning" as const,
        type: "Architecture",
      },
      {
        filename: "sprint-status.md",
        path: "sprint-status.md",
        modifiedAt: "2026-03-13T00:00:00.000Z",
        phase: "implementation" as const,
        type: "Sprint Plan",
      },
    ];
    const result = buildPhasePresence(artifacts);
    expect(result).toEqual({
      analysis: true,
      planning: true,
      solutioning: true,
      implementation: true,
    });
  });
});
