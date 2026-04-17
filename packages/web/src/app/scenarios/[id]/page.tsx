/**
 * Scenario detail page — /scenarios/[id] (Story 54.2, 54.5).
 *
 * Server component: fetches scenario and revision history from store
 * and passes to client component.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScenarioDetail } from "@/components/ScenarioDetail";
import { getScenario, getRevisions } from "@/lib/scenario-store";
import { getServices } from "@/lib/services";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const scenario = await getScenario(id);
  return { title: { absolute: `ao | ${scenario?.name ?? "Scenario Not Found"}` } };
}

export default async function ScenarioDetailPage({ params }: PageProps) {
  const { id } = await params;
  const scenario = await getScenario(id);

  if (!scenario) {
    notFound();
  }

  // Derive default agent count from config for parameter defaults
  let defaultAgentCount = 1;
  try {
    const { config } = await getServices();
    const projectCount = Object.keys(config.projects).length;
    if (projectCount > 0) defaultAgentCount = projectCount;
  } catch {
    // Fallback to 1 if config unavailable
  }

  const revisions = await getRevisions(id);

  return (
    <main className="mx-auto max-w-7xl px-8 py-6">
      <ScenarioDetail
        scenario={scenario}
        defaultAgentCount={defaultAgentCount}
        revisions={revisions}
      />
    </main>
  );
}
