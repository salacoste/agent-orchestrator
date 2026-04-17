import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";
import { getServices } from "@/lib/services";
import { enrichProjectSessions } from "@/lib/enrich-project-sessions";
import { computeStats } from "@/lib/serialize";
import {
  ProjectNotFound,
  ProjectBreadcrumb,
  ProjectHeader,
} from "@/components/ProjectDetailComponents";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { projectId } = await params;
  return { title: { absolute: `ao | ${projectId}` } };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = await params;

  try {
    const { config, registry, sessionManager } = await getServices();

    // Validate projectId exists in config
    const project = config.projects?.[projectId];
    if (!project) {
      return <ProjectNotFound projectId={projectId} />;
    }

    const projectName = project.name ?? projectId;
    const sharedPool = project.sharedPool?.enabled
      ? {
          enabled: true,
          eligibleProjects: project.sharedPool.eligibleProjects,
          maxConcurrent: project.sharedPool.maxConcurrent,
        }
      : undefined;

    const allSessions = await sessionManager.list();

    // Find the orchestrator session (any session ending with -orchestrator)
    const orchSession = allSessions.find((s) => s.id.endsWith("-orchestrator"));
    const orchestratorId = orchSession?.id ?? null;

    // Filter sessions by projectId
    const projectSessions = allSessions.filter((s) => s.projectId === projectId);

    // Use shared enrichment utility (fixes Issue #4 - code duplication)
    const sessions = await enrichProjectSessions(projectSessions, config, registry);

    return (
      <div className="px-8 py-7">
        <ProjectBreadcrumb projectName={projectName} />
        <ProjectHeader
          project={{
            id: projectId,
            name: projectName,
            status: "active",
            activeAgents: sessions.filter((s) => s.activity !== "exited").length,
            totalAgents: sessions.length,
            stories: { backlog: 0, inProgress: 0, done: 0, blocked: 0 },
            sharedPool,
          }}
        />
        <Dashboard
          initialSessions={sessions}
          stats={computeStats(sessions)}
          orchestratorId={orchestratorId}
          projectName={projectName}
        />
      </div>
    );
  } catch {
    // Config not found or services unavailable — show error state
    return <ProjectNotFound projectId={projectId} />;
  }
}
