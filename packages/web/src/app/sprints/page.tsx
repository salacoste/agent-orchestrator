import type { Metadata } from "next";
import { UnifiedSprintView } from "@/components/UnifiedSprintView";
import type { UnifiedSprintEntry, UnifiedSprintSummary } from "@/lib/types";
import { getServices } from "@/lib/services";
import { aggregateUnifiedSprints, computeSprintSummary } from "@/lib/unified-sprint-aggregation";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: "ao | Sprints" } };
}

export default async function SprintsPage() {
  let sprints: UnifiedSprintEntry[] = [];
  let summary: UnifiedSprintSummary = {
    totalSprints: 0,
    activeSprints: 0,
    completedSprints: 0,
    planningSprints: 0,
    totalStories: 0,
    storiesDone: 0,
    avgProgress: 0,
    atRiskSprints: 0,
    avgVelocity: 0,
    maxVelocity: 0,
  };

  try {
    const { config } = await getServices();
    sprints = await aggregateUnifiedSprints(config);
    summary = computeSprintSummary(sprints);
  } catch (error) {
    console.error("[SprintsPage] Failed to load sprint data:", error);
  }

  return <UnifiedSprintView initialSprints={sprints} initialSummary={summary} />;
}
