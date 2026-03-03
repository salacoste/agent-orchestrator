import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import type { Tracker } from "@composio/ao-core";

export async function GET(_request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config, registry } = await getServices();

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

    const issues = await tracker.listIssues({ state: "all", limit: 200 }, project);
    return NextResponse.json({ issues });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
