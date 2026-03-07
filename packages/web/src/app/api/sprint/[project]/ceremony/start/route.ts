import { readFileSync, writeFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { getServices } from "@/lib/services";
import { findConfig } from "@composio/ao-core";

export async function POST(request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { goal, startDate, endDate, targetVelocity } = body as Record<string, unknown>;

    // Default start date to today
    const resolvedStartDate =
      typeof startDate === "string" && startDate
        ? startDate
        : new Date().toISOString().slice(0, 10);

    // Validate dates
    if (!/^\d{4}-\d{2}-\d{2}$/.test(resolvedStartDate)) {
      return NextResponse.json({ error: "startDate must be YYYY-MM-DD" }, { status: 400 });
    }
    if (endDate !== undefined && endDate !== null) {
      if (typeof endDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return NextResponse.json({ error: "endDate must be YYYY-MM-DD" }, { status: 400 });
      }
    }

    // Validate velocity
    if (targetVelocity !== undefined && targetVelocity !== null) {
      if (typeof targetVelocity !== "number" || targetVelocity <= 0) {
        return NextResponse.json(
          { error: "targetVelocity must be a positive number" },
          { status: 400 },
        );
      }
    }

    // Update YAML config
    const configPath = findConfig();
    if (!configPath) {
      return NextResponse.json({ error: "Cannot find config file" }, { status: 500 });
    }

    const rawContent = readFileSync(configPath, "utf-8");
    const rawConfig = parseYaml(rawContent) as Record<string, unknown>;
    const projects = rawConfig["projects"] as Record<string, Record<string, unknown>>;
    if (!projects?.[projectId]) {
      return NextResponse.json({ error: "Project not found in config" }, { status: 404 });
    }

    const projectConfig = projects[projectId];
    if (!projectConfig["tracker"] || typeof projectConfig["tracker"] !== "object") {
      projectConfig["tracker"] = { plugin: "bmad" };
    }

    const tracker = projectConfig["tracker"] as Record<string, unknown>;

    tracker["sprintStartDate"] = resolvedStartDate;

    if (typeof endDate === "string" && endDate) {
      tracker["sprintEndDate"] = endDate;
    }

    if (typeof goal === "string" && goal) {
      tracker["sprintGoal"] = goal;
    }

    if (typeof targetVelocity === "number" && targetVelocity > 0) {
      tracker["targetVelocity"] = targetVelocity;
    }

    writeFileSync(configPath, stringifyYaml(rawConfig, { indent: 2 }), "utf-8");

    return NextResponse.json({
      projectId,
      sprintStartDate: resolvedStartDate,
      sprintEndDate: tracker["sprintEndDate"] ?? null,
      sprintGoal: tracker["sprintGoal"] ?? null,
      targetVelocity: tracker["targetVelocity"] ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
