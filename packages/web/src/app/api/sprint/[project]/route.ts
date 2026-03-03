import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import type { Tracker } from "@composio/ao-core";
import { getBmadStatus, readEpicTitle } from "@composio/ao-plugin-tracker-bmad";

export async function GET(_request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config, registry, sessionManager } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker) {
      return NextResponse.json({ error: "No tracker configured" }, { status: 404 });
    }

    const tracker = registry.get<Tracker>("tracker", project.tracker.plugin);
    if (!tracker) {
      return NextResponse.json({ error: "Tracker plugin not found" }, { status: 404 });
    }

    if (!tracker.listIssues) {
      return NextResponse.json(
        { error: "Tracker does not support listing issues" },
        { status: 404 },
      );
    }

    // Get all stories
    const issues = await tracker.listIssues({ state: "all", limit: 200 }, project);

    // Get active sessions to cross-reference (non-fatal if unavailable)
    const sessionsByIssue = new Map<string, { id: string; activity: string | null }>();
    try {
      const sessions = await sessionManager.list(projectId);
      for (const s of sessions) {
        if (s.issueId) {
          sessionsByIssue.set(s.issueId.toLowerCase(), { id: s.id, activity: s.activity });
        }
      }
    } catch {
      // Session lookup not critical — continue without session info
    }

    // Define sprint columns in order
    const columnOrder = ["backlog", "ready-for-dev", "in-progress", "review", "done"];

    // Group stories by BMad status (last label)
    const columns: Record<
      string,
      Array<{
        id: string;
        title: string;
        state: string;
        bmadStatus: string;
        epic: string | null;
        session: { id: string; activity: string | null } | null;
      }>
    > = {};

    for (const col of columnOrder) {
      columns[col] = [];
    }

    let total = 0;
    let done = 0;
    let inProgress = 0;

    // Epic aggregation
    const epicMap = new Map<
      string,
      { total: number; done: number; inProgress: number; open: number }
    >();

    for (const issue of issues) {
      total++;
      const bmadStatus = getBmadStatus(issue.labels);
      const epic = issue.labels.find((l) => l.startsWith("epic-")) ?? null;

      if (bmadStatus === "done") done++;
      else if (bmadStatus === "in-progress" || bmadStatus === "review") inProgress++;

      // Aggregate per-epic stats
      if (epic) {
        const epicStats = epicMap.get(epic) ?? { total: 0, done: 0, inProgress: 0, open: 0 };
        epicStats.total++;
        if (bmadStatus === "done") epicStats.done++;
        else if (bmadStatus === "in-progress" || bmadStatus === "review") epicStats.inProgress++;
        else epicStats.open++;
        epicMap.set(epic, epicStats);
      }

      const storyData = {
        id: issue.id,
        title: issue.title,
        url: issue.url,
        state: issue.state,
        bmadStatus,
        epic,
        session: sessionsByIssue.get(issue.id.toLowerCase()) ?? null,
      };

      // Put in matching column or "backlog" as fallback
      const col = columnOrder.includes(bmadStatus) ? bmadStatus : "backlog";
      const columnList = columns[col] ?? columns["backlog"];
      columnList.push(storyData);
    }

    // Build epic summaries
    const epics = Array.from(epicMap.entries())
      .map(([epicId, s]) => ({
        epicId,
        title: project.tracker?.plugin === "bmad" ? readEpicTitle(epicId, project) : epicId,
        total: s.total,
        done: s.done,
        inProgress: s.inProgress,
        open: s.open,
        percent: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0,
      }))
      .sort((a, b) => a.epicId.localeCompare(b.epicId));

    return NextResponse.json({
      projectId,
      projectName: project.name || projectId,
      columns,
      columnOrder,
      epics,
      stats: {
        total,
        done,
        inProgress,
        open: total - done - inProgress,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
