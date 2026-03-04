import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { getStoryDetail, type StoryDetail } from "@composio/ao-plugin-tracker-bmad";

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
    return NextResponse.json(detail);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
