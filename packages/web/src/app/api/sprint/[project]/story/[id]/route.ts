import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import {
  BMAD_COLUMNS,
  getStoryDetail,
  writeStoryStatus,
  appendHistory,
  readSprintStatus,
  checkWipLimit,
  validateDependencies,
  type StoryDetail,
} from "@composio/ao-plugin-tracker-bmad";
import {
  createCrossProjectDepStore,
  resolveAllDependencyStatuses,
  autoUnblockCrossProjectDeps,
  type DependencyWithStatus,
} from "@composio/ao-core";
import { buildSprintDataMap, flattenEntry } from "@/lib/sprint-data-map";

const EMPTY_DETAIL: StoryDetail = {
  storyId: "",
  currentStatus: "unknown",
  epic: null,
  transitions: [],
  columnDwells: [],
  totalCycleTimeMs: null,
  startedAt: null,
  completedAt: null,
  isCompleted: false,
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ project: string; id: string }> },
) {
  try {
    const { project: projectId, id } = await params;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json({ ...EMPTY_DETAIL, storyId: id });
    }

    const detail = getStoryDetail(id, project);

    // Include cross-project dependencies with live status enrichment (non-fatal)
    let crossProjectDeps: DependencyWithStatus[] = [];
    try {
      const store = createCrossProjectDepStore(config.configPath);
      const rawDeps = store.getForStory(projectId, id);
      if (rawDeps.length > 0) {
        const sprintDataMap = await buildSprintDataMap(config);
        crossProjectDeps = resolveAllDependencyStatuses(rawDeps, sprintDataMap);
      }
    } catch {
      // Non-fatal — cross-project deps file may not exist
    }

    return NextResponse.json({ ...detail, crossProjectDeps });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

const VALID_COLUMNS = new Set<string>(BMAD_COLUMNS);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ project: string; id: string }> },
) {
  try {
    const { project: projectId, id: storyId } = await params;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json({ error: "Story moves require the bmad tracker" }, { status: 400 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { status: newStatus, force } = body as Record<string, unknown>;

    if (!newStatus || typeof newStatus !== "string" || !VALID_COLUMNS.has(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${BMAD_COLUMNS.join(", ")}` },
        { status: 400 },
      );
    }

    // Read current status for conflict detection
    const sprint = readSprintStatus(project);
    const entry = sprint.development_status[storyId];
    if (!entry) {
      return NextResponse.json({ error: `Story '${storyId}' not found` }, { status: 404 });
    }

    const oldStatus = typeof entry.status === "string" ? entry.status : "backlog";

    if (oldStatus === newStatus) {
      return NextResponse.json({ storyId, status: newStatus, changed: false });
    }

    // WIP limit check (unless force override)
    if (force !== true) {
      const wipResult = checkWipLimit(project, newStatus);
      if (!wipResult.allowed) {
        return NextResponse.json(
          {
            error: `WIP limit exceeded for '${newStatus}' (${wipResult.current}/${wipResult.limit})`,
            wipExceeded: true,
            current: wipResult.current,
            limit: wipResult.limit,
          },
          { status: 409 },
        );
      }
    }

    writeStoryStatus(project, storyId, newStatus);
    appendHistory(project, storyId, oldStatus, newStatus);

    // Auto-unblock cross-project dependents when story is marked done (best-effort, non-blocking)
    const unblockedStories: Array<{
      projectId: string;
      storyId: string;
      previousStatus: string;
      newStatus: string;
    }> = [];

    if (newStatus === "done") {
      try {
        const store = createCrossProjectDepStore(config.configPath);
        const allDeps = store.list();
        if (allDeps.length > 0) {
          const sprintDataMap = await buildSprintDataMap(config);
          const candidates = autoUnblockCrossProjectDeps(
            projectId,
            storyId,
            allDeps,
            sprintDataMap,
          );

          for (const candidate of candidates) {
            try {
              const sourceProject = config.projects[candidate.projectId];
              if (!sourceProject?.tracker || sourceProject.tracker.plugin !== "bmad") continue;

              // Check the source story's current status before unblocking
              const sourceSprint = readSprintStatus(sourceProject);
              const sourceEntry = sourceSprint.development_status[candidate.storyId];
              const sourceStatus = flattenEntry(sourceEntry);

              // Only unblock if currently "blocked" — skip stories in other states
              if (sourceStatus !== "blocked") continue;

              writeStoryStatus(sourceProject, candidate.storyId, "ready-for-dev");
              appendHistory(sourceProject, candidate.storyId, "blocked", "ready-for-dev");
              unblockedStories.push({
                projectId: candidate.projectId,
                storyId: candidate.storyId,
                previousStatus: "blocked",
                newStatus: "ready-for-dev",
              });
            } catch (unblockErr) {
              console.warn(
                `[auto-unblock] Failed to unblock ${candidate.projectId}/${candidate.storyId}:`,
                unblockErr instanceof Error ? unblockErr.message : unblockErr,
              );
            }
          }
        }
      } catch (crossDepErr) {
        console.warn(
          "[auto-unblock] Cross-project dep check failed (non-fatal):",
          crossDepErr instanceof Error ? crossDepErr.message : crossDepErr,
        );
      }
    }

    // Dependency warnings (informational, non-blocking)
    const warnings: string[] = [];
    try {
      const depResult = validateDependencies(storyId, project);
      if (depResult.blocked) {
        const blockerIds = depResult.blockers.map((b) => `${b.id} (${b.status})`);
        warnings.push(`Story has unfinished dependencies: ${blockerIds.join(", ")}`);
      }
      warnings.push(...depResult.warnings);
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      storyId,
      status: newStatus,
      changed: true,
      warnings,
      unblockedStories,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
