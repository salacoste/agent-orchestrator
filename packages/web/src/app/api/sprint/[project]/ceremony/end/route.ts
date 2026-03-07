import { readFileSync, writeFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { getServices } from "@/lib/services";
import { findConfig } from "@composio/ao-core";
import {
  computeRetrospective,
  computeForecast,
  computeSprintHealth,
} from "@composio/ao-plugin-tracker-bmad";

export async function POST(request: Request, { params }: { params: Promise<{ project: string }> }) {
  try {
    const { project: projectId } = await params;
    const { config } = await getServices();

    const project = config.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.tracker || project.tracker.plugin !== "bmad") {
      return NextResponse.json({ error: "Sprint end requires the bmad tracker" }, { status: 400 });
    }

    // Compute final metrics
    const retro = computeRetrospective(project);
    const forecast = computeForecast(project);
    const health = computeSprintHealth(project);

    const report: Record<string, unknown> = {
      projectId,
      retrospective: retro,
      forecast,
      health: {
        overall: health.overall,
        indicatorCount: health.indicators.length,
      },
    };

    // Optionally clear sprint config
    const body: unknown = await request.json().catch(() => null);
    const shouldClear =
      body !== null &&
      typeof body === "object" &&
      (body as Record<string, unknown>)["clear"] === true;

    if (shouldClear) {
      const configPath = findConfig();
      if (configPath) {
        const rawContent = readFileSync(configPath, "utf-8");
        const rawConfig = parseYaml(rawContent) as Record<string, unknown>;
        const projects = rawConfig["projects"] as Record<string, Record<string, unknown>>;
        if (projects?.[projectId]) {
          const trackerCfg = projects[projectId]["tracker"];
          if (trackerCfg && typeof trackerCfg === "object") {
            const t = trackerCfg as Record<string, unknown>;
            delete t["sprintStartDate"];
            delete t["sprintEndDate"];
            delete t["sprintGoal"];
          }
          writeFileSync(configPath, stringifyYaml(rawConfig, { indent: 2 }), "utf-8");
        }
      }
      report["cleared"] = true;
    }

    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
