/**
 * Artifact Dependency Graph — builds relationships between BMAD artifacts.
 *
 * Extends the existing artifact scanner (scan-artifacts.ts) by reading
 * file contents, parsing YAML frontmatter for `inputDocuments` references,
 * and building a bidirectional dependency graph.
 *
 * All errors are swallowed — unreadable files or broken references produce
 * partial graphs, never failures.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildPhasePresence, scanAllArtifacts } from "./scan-artifacts";
import type {
  ArtifactDependencyGraph,
  ArtifactEdge,
  ArtifactGraphService,
  ArtifactNode,
  ClassifiedArtifact,
  GuardContext,
} from "./types";

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

/**
 * Extract `inputDocuments` paths from YAML frontmatter.
 * Handles the standard BMAD frontmatter format:
 *
 * ```yaml
 * ---
 * inputDocuments:
 *   - path/to/doc.md
 *   - another/doc.md
 * ---
 * ```
 *
 * Returns empty array if no frontmatter or no inputDocuments field.
 */
export function parseFrontmatterDeps(content: string): string[] {
  // Extract frontmatter block
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return [];

  const frontmatter = match[1];

  // Find inputDocuments section
  const inputDocsMatch = frontmatter.match(/inputDocuments:\s*\n((?:\s+-\s+.+\n?)*)/);
  if (!inputDocsMatch) return [];

  // Extract each list item
  const items = inputDocsMatch[1].matchAll(/^\s+-\s+(.+)$/gm);
  const deps: string[] = [];
  for (const item of items) {
    const dep = item[1].trim().replace(/^['"]|['"]$/g, "");
    if (dep) deps.push(dep);
  }

  return deps;
}

// ---------------------------------------------------------------------------
// Graph building
// ---------------------------------------------------------------------------

/**
 * Build the artifact dependency graph from classified artifacts.
 *
 * Reads each artifact file to extract frontmatter dependencies,
 * then builds bidirectional edges (dependsOn / referencedBy).
 *
 * @param artifacts - Classified artifacts from scanAllArtifacts()
 * @param projectRoot - Absolute path to project root (for resolving file paths)
 * @returns Complete dependency graph
 */
export async function buildArtifactGraph(
  artifacts: ClassifiedArtifact[],
  projectRoot: string,
): Promise<ArtifactDependencyGraph> {
  const nodes = new Map<string, ArtifactNode>();
  const edges: ArtifactEdge[] = [];

  // Initialize nodes from classified artifacts
  for (const artifact of artifacts) {
    nodes.set(artifact.path, {
      ...artifact,
      dependsOn: [],
      referencedBy: [],
    });
  }

  // Read files and extract dependencies
  const readPromises = artifacts.map(async (artifact) => {
    try {
      const fullPath = path.resolve(projectRoot, artifact.path);
      const content = await readFile(fullPath, "utf-8");
      return { path: artifact.path, deps: parseFrontmatterDeps(content) };
    } catch {
      // File unreadable — skip
      return { path: artifact.path, deps: [] };
    }
  });

  const results = await Promise.all(readPromises);

  // Build edges from dependencies
  for (const { path: fromPath, deps } of results) {
    const fromNode = nodes.get(fromPath);
    if (!fromNode) continue;

    for (const depPath of deps) {
      // Normalize the dependency path
      const normalizedDep = normalizeDependencyPath(depPath);

      // Find matching node (try exact match, then basename match)
      const toNode = nodes.get(normalizedDep) ?? findNodeByBasename(nodes, normalizedDep);

      if (toNode) {
        fromNode.dependsOn.push(toNode.path);
        toNode.referencedBy.push(fromPath);
        edges.push({ from: fromPath, to: toNode.path });
      }
      // Broken reference — silently skip (dependency target not in scanned artifacts)
    }
  }

  return { nodes, edges };
}

/**
 * Normalize a dependency path from frontmatter.
 * Strips leading ./ and normalizes separators.
 */
function normalizeDependencyPath(depPath: string): string {
  return depPath.replace(/^\.\//, "").replace(/\\/g, "/");
}

/**
 * Find a node by matching the basename of a dependency path.
 * Handles cases where frontmatter uses full path but scanner uses relative.
 */
function findNodeByBasename(
  nodes: Map<string, ArtifactNode>,
  depPath: string,
): ArtifactNode | undefined {
  const basename = path.basename(depPath);
  for (const node of nodes.values()) {
    if (node.path.endsWith(basename) || node.path.endsWith(depPath)) {
      return node;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// GuardContext production
// ---------------------------------------------------------------------------

/**
 * Produce a GuardContext from the artifact graph for state machine evaluation.
 * Bridges the graph to the state machine from Story 16.2.
 */
export function buildGuardContext(graph: ArtifactDependencyGraph): GuardContext {
  const artifacts = Array.from(graph.nodes.values());
  return {
    phasePresence: buildPhasePresence(artifacts),
    artifacts,
  };
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

/**
 * Create an artifact graph service for a project.
 *
 * The service lazily builds the graph on first access, then caches it.
 * Call `dispose()` to free resources.
 *
 * @param projectRoot - Absolute path to the project root
 * @param bmadOutputDir - Override for _bmad-output directory path
 */
export function createArtifactGraphService(
  projectRoot: string,
  bmadOutputDir?: string,
): ArtifactGraphService {
  let cachedGraph: ArtifactDependencyGraph | null = null;

  return {
    async build(): Promise<ArtifactDependencyGraph> {
      const artifacts = await scanAllArtifacts(projectRoot, bmadOutputDir);
      cachedGraph = await buildArtifactGraph(artifacts, projectRoot);
      return cachedGraph;
    },

    async getGraph(): Promise<ArtifactDependencyGraph> {
      if (!cachedGraph) {
        return this.build();
      }
      return cachedGraph;
    },

    async getGuardContext(): Promise<GuardContext> {
      const graph = await this.getGraph();
      return buildGuardContext(graph);
    },

    dispose(): void {
      cachedGraph = null;
    },
  };
}
