import { readFileSync, writeFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { getServices } from "@/lib/services";
import { findConfig } from "@composio/ao-core";

export async function GET(_request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      projectId,
      sprintEndDate: project.tracker?.["sprintEndDate"] ?? null,
      wipLimits: project.tracker?.["wipLimits"] ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ project: string }> },
) {
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

    const { sprintEndDate } = body as Record<string, unknown>;

    // Validate date if provided (null means clear)
    if (sprintEndDate !== null) {
      if (typeof sprintEndDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(sprintEndDate)) {
        return NextResponse.json(
          { error: "sprintEndDate must be YYYY-MM-DD or null" },
          { status: 400 },
        );
      }

      const parsed = new Date(sprintEndDate);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsed < today) {
        return NextResponse.json(
          { error: "Sprint end date must be in the future" },
          { status: 400 },
        );
      }
    }

    // Update the raw YAML config
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

    if (sprintEndDate === null) {
      delete tracker["sprintEndDate"];
    } else {
      tracker["sprintEndDate"] = sprintEndDate;
    }

    writeFileSync(configPath, stringifyYaml(rawConfig, { indent: 2 }), "utf-8");

    return NextResponse.json({
      projectId,
      sprintEndDate: sprintEndDate ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
