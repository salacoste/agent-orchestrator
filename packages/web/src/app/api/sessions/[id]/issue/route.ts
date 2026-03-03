import { NextResponse, type NextRequest } from "next/server";
import { getServices } from "@/lib/services";
import type { Tracker, ProjectConfig } from "@composio/ao-core";

/** Resolve which project a session belongs to (mirrors serialize.ts logic). */
function resolveProject(
  projectId: string,
  sessionId: string,
  projects: Record<string, ProjectConfig>,
): ProjectConfig | undefined {
  const direct = projects[projectId];
  if (direct) return direct;

  const entry = Object.entries(projects).find(([, p]) => sessionId.startsWith(p.sessionPrefix));
  if (entry) return entry[1];

  const firstKey = Object.keys(projects)[0];
  return firstKey ? projects[firstKey] : undefined;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { config, registry, sessionManager } = await getServices();

    const session = await sessionManager.get(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!session.issueId) {
      return NextResponse.json({ error: "No issue linked" }, { status: 404 });
    }

    const project = resolveProject(session.projectId, session.id, config.projects);
    if (!project?.tracker) {
      return NextResponse.json({ error: "No tracker configured" }, { status: 404 });
    }

    const tracker = registry.get<Tracker>("tracker", project.tracker.plugin);
    if (!tracker) {
      return NextResponse.json({ error: "Tracker plugin not found" }, { status: 404 });
    }

    // Extract identifier from the issueId (which may be a URL or an identifier)
    let identifier = session.issueId;
    if (tracker.issueLabel) {
      try {
        const label = tracker.issueLabel(session.issueId, project);
        // Strip "#" prefix from GitHub-style labels
        identifier = label.replace(/^#/, "");
      } catch {
        // Fall back to using issueId as-is
      }
    }

    const issue = await tracker.getIssue(identifier, project);

    return NextResponse.json({
      id: issue.id,
      title: issue.title,
      description: issue.description?.slice(0, 500) || "",
      state: issue.state,
      labels: issue.labels,
      url: issue.url,
    });
  } catch (err) {
    console.error("Failed to fetch issue:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
