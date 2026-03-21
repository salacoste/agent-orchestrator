/**
 * Artifact scanner — discovers and classifies BMAD artifacts on disk (WD-8).
 *
 * Scans planning-artifacts/, planning-artifacts/research/,
 * and implementation-artifacts/ for .md files, classifying each
 * via ARTIFACT_RULES. All errors are swallowed — missing or
 * unreadable directories return empty arrays.
 */

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { classifyArtifact } from "./artifact-rules";
import type { ClassifiedArtifact, Phase, ScannedFile } from "./types";

/**
 * Scan a single directory for .md files, returning raw ScannedFile entries.
 * Optionally recurses into a `research/` subdirectory.
 */
async function scanDir(
  dir: string,
  projectRoot: string,
  recurseResearch: boolean,
): Promise<ScannedFile[]> {
  const files: ScannedFile[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.endsWith(".backup")) {
        const filePath = path.join(dir, entry.name);
        try {
          const fileStat = await stat(filePath);
          files.push({
            filename: entry.name,
            path: path.relative(projectRoot, filePath),
            modifiedAt: fileStat.mtime.toISOString(),
          });
        } catch {
          // stat failed (permission denied, mid-write) — skip file
        }
      }
      // Recurse into research/ subdirectory only
      if (recurseResearch && entry.isDirectory() && entry.name === "research") {
        const subFiles = await scanDir(path.join(dir, entry.name), projectRoot, false);
        files.push(...subFiles);
      }
    }
  } catch {
    // Directory doesn't exist or is unreadable — not an error
  }
  return files;
}

/**
 * Scan all BMAD artifact directories and classify each file.
 *
 * @param projectRoot  Absolute path to the project root
 * @param bmadOutputDir  Absolute path to the BMAD output directory (default: projectRoot/_bmad-output)
 * @returns Classified artifacts sorted by modification time (newest first)
 */
export async function scanAllArtifacts(
  projectRoot: string,
  bmadOutputDir?: string,
): Promise<ClassifiedArtifact[]> {
  const outputBase = bmadOutputDir ?? path.join(projectRoot, "_bmad-output");
  const planningDir = path.join(outputBase, "planning-artifacts");
  const implementationDir = path.join(outputBase, "implementation-artifacts");

  const [planningFiles, implementationFiles] = await Promise.all([
    scanDir(planningDir, projectRoot, true),
    scanDir(implementationDir, projectRoot, false),
  ]);

  const classified: ClassifiedArtifact[] = [];

  for (const file of planningFiles) {
    const { phase, type } = classifyArtifact(file.filename, "planning");
    classified.push({ ...file, phase, type });
  }

  for (const file of implementationFiles) {
    const { phase, type } = classifyArtifact(file.filename, "implementation");
    classified.push({ ...file, phase, type });
  }

  // Sort newest first
  classified.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

  return classified;
}

/**
 * Build a phase-presence map from classified artifacts.
 * Only counts artifacts with a non-null phase.
 */
export function buildPhasePresence(artifacts: ClassifiedArtifact[]): Record<Phase, boolean> {
  const presence: Record<Phase, boolean> = {
    analysis: false,
    planning: false,
    solutioning: false,
    implementation: false,
  };

  for (const artifact of artifacts) {
    if (artifact.phase !== null) {
      presence[artifact.phase] = true;
    }
  }

  return presence;
}
