import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import type { Tracker } from "@composio/ao-core";

export async function POST(request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config, registry } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json(
        { error: "Story creation requires the bmad tracker" },
        { status: 400 },
      );
    }

    const tracker = registry.get<Tracker>("tracker", project.tracker.plugin);
    if (!tracker?.createIssue) {
      return NextResponse.json(
        { error: "Tracker does not support issue creation" },
        { status: 400 },
      );
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { title, description, epic } = body as Record<string, unknown>;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const labels: string[] = [];
    if (typeof epic === "string" && epic.trim()) {
      labels.push(epic.trim());
    }

    const issue = await tracker.createIssue(
      {
        title: title.trim(),
        description: typeof description === "string" ? description : "",
        labels,
      },
      project,
    );

    return NextResponse.json(issue, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
