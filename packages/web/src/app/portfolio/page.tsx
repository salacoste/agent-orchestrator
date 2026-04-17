import type { Metadata } from "next";
import { PortfolioView } from "@/components/PortfolioView";
import type { PortfolioProject } from "@/lib/types";
import { getServices } from "@/lib/services";
import { aggregatePortfolioProjects } from "@/lib/portfolio-aggregation";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: "ao | Portfolio" } };
}

export default async function PortfolioPage() {
  let projects: PortfolioProject[] = [];

  try {
    const { config, sessionManager } = await getServices();
    // Default sprint-status path relative to config location
    const sprintStatusPath = config.configPath
      ? `${config.configPath}/../_bmad-output/implementation-artifacts/sprint-status.yaml`
      : undefined;
    projects = await aggregatePortfolioProjects(config, sessionManager, sprintStatusPath);
  } catch (error) {
    // Log error for debugging, show empty state to user
    console.error("[PortfolioPage] Failed to load portfolio data:", error);
  }

  return <PortfolioView projects={projects} />;
}
