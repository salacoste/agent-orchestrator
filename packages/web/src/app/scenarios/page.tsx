import type { Metadata } from "next";
import { ScenariosView } from "@/components/ScenariosView";
import type { ScenarioProjectInfo, WhatIfScenario } from "@/lib/types";
import { getServices } from "@/lib/services";
import { listScenarios } from "@/lib/scenario-store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: "ao | Scenarios" } };
}

/** Story keys match X-Y-name or Xa-Y-name (skip epics/retros). */
const STORY_KEY = /^\d+[a-z]*-\d+-/;

function flattenStatus(entry: unknown): string {
  if (typeof entry === "string") return entry;
  return (entry as { status?: string })?.status ?? "unknown";
}

export default async function ScenariosPage() {
  const projects: ScenarioProjectInfo[] = [];
  let scenarios: WhatIfScenario[] = [];

  try {
    const { config } = await getServices();
    const tracker = await import("@composio/ao-plugin-tracker-bmad");

    // Build project info list from config with real story counts
    for (const [projectId, project] of Object.entries(config.projects)) {
      let total = 0;
      let done = 0;
      let inProgress = 0;
      let backlog = 0;

      try {
        const status = tracker.readSprintStatus(project);
        if (status?.development_status) {
          for (const [key, entry] of Object.entries(status.development_status)) {
            if (!STORY_KEY.test(key)) continue;
            total++;
            const s = flattenStatus(entry);
            if (s === "done") done++;
            else if (s === "in-progress") inProgress++;
            else if (s === "backlog") backlog++;
          }
        }
      } catch {
        // Skip projects that fail to read — counts stay 0
      }

      projects.push({
        id: projectId,
        name: project.name || projectId,
        storyCounts: { total, done, inProgress, backlog },
      });
    }

    // Load existing scenarios from in-memory store
    scenarios = await listScenarios();
  } catch (error) {
    console.error("[ScenariosPage] Failed to load data:", error);
  }

  return (
    <main className="mx-auto max-w-7xl px-8 py-6">
      <ScenariosView projects={projects} initialScenarios={scenarios} />
    </main>
  );
}
