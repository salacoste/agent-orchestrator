/**
 * GET /api/workflow/[project] — Workflow Dashboard API (WD-4).
 *
 * Returns the complete workflow state for a project. Always returns
 * HTTP 200 with well-formed JSON for any BMAD state. Only returns
 * 404 for unknown projects.
 *
 * Response shape matches the frozen WorkflowResponse interface.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import type { ProjectConfig } from "@composio/ao-core";

import { getServices } from "@/lib/services";
import { computePhaseStates } from "@/lib/workflow/compute-state";
import { lkgCache } from "@/lib/workflow/lkg-cache";
import { parseAgentManifest } from "@/lib/workflow/parse-agents";
import {
  getRecommendation,
  getStateMachineRecommendation,
} from "@/lib/workflow/recommendation-engine";
import { buildPhasePresence, scanAllArtifacts } from "@/lib/workflow/scan-artifacts";
import { createBmadStateMachine } from "@/lib/workflow/state-machine";
import type { Phase, WorkflowResponse } from "@/lib/workflow/types";

export const dynamic = "force-dynamic";

/**
 * Check if a directory exists by attempting to read it.
 */
async function dirExists(dirPath: string): Promise<boolean> {
  try {
    await readdir(dirPath);
    return true;
  } catch {
    return false;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ project: string }> }) {
  let projectId = "";
  let project: ProjectConfig | undefined;
  try {
    ({ project: projectId } = await params);
    const { config } = await getServices();

    project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Resolve project root — expand ~ and resolve relative to projectsDir if configured
    const expandHome = (p: string) => p.replace(/^~/, process.env.HOME ?? "~");
    let projectRoot: string;
    if (project.path) {
      const expanded = expandHome(project.path);
      projectRoot = path.isAbsolute(expanded)
        ? path.resolve(expanded)
        : path.resolve(expandHome(config.projectsDir ?? "."), expanded);
    } else {
      projectRoot = process.cwd();
    }

    // Resolve BMAD paths — configurable per project (defaults: _bmad, _bmad-output)
    const bmadConfigDir = project.bmad?.configDir ?? "_bmad";
    const bmadOutputDir = project.bmad?.outputDir ?? "_bmad-output";
    const bmadDir = path.resolve(projectRoot, bmadConfigDir);
    const bmadOutput = path.resolve(projectRoot, bmadOutputDir);
    const hasBmad = await dirExists(bmadDir);

    if (!hasBmad) {
      // Return valid response — all phases "not-started" per WD-4
      const emptyPresence: Record<Phase, boolean> = {
        analysis: false,
        planning: false,
        solutioning: false,
        implementation: false,
      };
      const response: WorkflowResponse = {
        projectId,
        projectName: project.name ?? projectId,
        hasBmad: false,
        phases: computePhaseStates(emptyPresence),
        agents: null,
        recommendation: null,
        artifacts: [],
        lastActivity: null,
      };
      return NextResponse.json(response);
    }

    // --- Artifacts (WD-7: independent try/catch with LKG fallback) ---
    let artifacts: WorkflowResponse["artifacts"] = [];
    try {
      artifacts = await scanAllArtifacts(projectRoot, bmadOutput);
    } catch (err) {
      console.warn(
        `[workflow-api] artifact scan failed for ${projectId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      artifacts = lkgCache.get(projectId, "artifacts") ?? [];
    }

    // --- Phases & Recommendation (share phasePresence computation) ---
    const emptyPresence: Record<Phase, boolean> = {
      analysis: false,
      planning: false,
      solutioning: false,
      implementation: false,
    };
    let phasePresence = emptyPresence;
    let phases: WorkflowResponse["phases"];
    try {
      phasePresence = buildPhasePresence(artifacts);
      phases = computePhaseStates(phasePresence);
    } catch (err) {
      console.warn(
        `[workflow-api] phase computation failed for ${projectId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      phases = lkgCache.get(projectId, "phases") ?? computePhaseStates(emptyPresence);
    }

    let recommendation: WorkflowResponse["recommendation"] = null;
    try {
      // Prefer state-machine recommendation (includes reasoning + blockers)
      const sm = createBmadStateMachine();
      recommendation = getStateMachineRecommendation(artifacts, phases, sm);
      // Fall back to legacy 7-rule engine if state machine returns null
      if (!recommendation) {
        recommendation = getRecommendation(artifacts, phases, phasePresence);
      }
    } catch (err) {
      console.warn(
        `[workflow-api] recommendation failed for ${projectId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      recommendation = lkgCache.get(projectId, "recommendation") ?? null;
    }

    // --- Agents (independent — file read + parse with LKG fallback) ---
    let agents: WorkflowResponse["agents"] = null;
    const manifestPath = path.join(bmadDir, "_config", "agent-manifest.csv");
    try {
      const csvContent = await readFile(manifestPath, "utf-8");
      const parsed = parseAgentManifest(csvContent);
      if (parsed.length > 0) agents = parsed;
    } catch (err) {
      console.warn(
        `[workflow-api] agent manifest failed for ${projectId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      agents = lkgCache.get(projectId, "agents") ?? null;
    }

    // --- Readiness (Story 17.4: state machine transition readiness) ---
    let readiness: WorkflowResponse["readiness"];
    try {
      const sm = createBmadStateMachine();
      const activePhase = phases.find((p) => p.state === "active");
      if (activePhase) {
        const ctx = { phasePresence, artifacts };
        const raw = sm.getTransitionReadiness(activePhase.id, ctx);
        readiness = raw.map((r) => ({
          from: r.transition.from,
          to: r.transition.to,
          score: r.score,
          satisfied: r.satisfied.map((g) => ({ guardId: g.guardId, description: g.description })),
          unsatisfied: r.unsatisfied.map((g) => ({
            guardId: g.guardId,
            description: g.description,
          })),
        }));
      }
    } catch {
      // Readiness is optional — skip on error
    }

    // --- LastActivity (derived from artifacts — pure computation) ---
    const latestPhased = artifacts.find((a) => a.phase !== null);
    const lastActivity =
      latestPhased && latestPhased.phase !== null
        ? {
            filename: latestPhased.filename,
            phase: latestPhased.phase,
            modifiedAt: latestPhased.modifiedAt,
          }
        : null;

    // Build response and update LKG cache (WD-7 Layer 2)
    const response: WorkflowResponse = {
      projectId,
      projectName: project.name ?? projectId,
      hasBmad: true,
      phases,
      agents,
      recommendation,
      artifacts,
      lastActivity,
      readiness,
    };
    lkgCache.setAll(projectId, response);

    return NextResponse.json(response);
  } catch (error) {
    // Outer catch — check LKG cache before returning error (AC3, AC4)
    if (!projectId) {
      // WD-FR31: always return 200 with well-formed JSON, never 500 for BMAD states
      const emptyFallback: WorkflowResponse = {
        projectId: "",
        projectName: "Unknown",
        hasBmad: false,
        phases: computePhaseStates({
          analysis: false,
          planning: false,
          solutioning: false,
          implementation: false,
        }),
        agents: null,
        recommendation: null,
        artifacts: [],
        lastActivity: null,
      };
      return NextResponse.json(emptyFallback);
    }
    const projectName = project?.name ?? projectId;
    const cached = lkgCache.getFullResponse(projectId, projectName);
    if (cached) {
      console.warn(
        `[workflow-api] returning LKG cache for ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return NextResponse.json(cached);
    }
    // No cache — return empty response rather than 500 for file errors (AC4)
    // hasBmad: false because we couldn't determine BMAD state
    console.warn(
      `[workflow-api] no cache available for ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
    );
    const emptyResponse: WorkflowResponse = {
      projectId,
      projectName: projectId,
      hasBmad: false,
      phases: computePhaseStates({
        analysis: false,
        planning: false,
        solutioning: false,
        implementation: false,
      }),
      agents: null,
      recommendation: null,
      artifacts: [],
      lastActivity: null,
    };
    return NextResponse.json(emptyResponse);
  }
}
