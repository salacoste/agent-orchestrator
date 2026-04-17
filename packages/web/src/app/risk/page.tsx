import type { Metadata } from "next";
import { RiskScorePanel } from "@/components/RiskScorePanel";
import { RiskDashboard } from "@/components/RiskDashboard";
import { BottleneckDashboard } from "@/components/BottleneckDashboard";
import { UtilizationMetricsPanel } from "@/components/UtilizationMetricsPanel";
import { OptimizationPanel } from "@/components/OptimizationPanel";
import { getServices } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: "ao | Risk" } };
}

export default async function RiskPage() {
  const projects: { id: string; name: string }[] = [];

  try {
    const { config } = await getServices();
    for (const [id, project] of Object.entries(config.projects)) {
      projects.push({ id, name: project.name || id });
    }
  } catch {
    // Empty project list is handled by the component
  }

  return (
    <main className="mx-auto max-w-7xl px-8 py-6 space-y-8">
      <RiskScorePanel projects={projects} />
      <RiskDashboard projects={projects} />
      <BottleneckDashboard projects={projects} />
      <UtilizationMetricsPanel projects={projects} />
      <OptimizationPanel projects={projects} />
    </main>
  );
}
