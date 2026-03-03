"use client";

import { useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { DashboardSession, DashboardStats } from "@/lib/types";
import { Dashboard } from "./Dashboard";
import { SprintBoard } from "./SprintBoard";

interface HomeViewProps {
  initialSessions: DashboardSession[];
  stats: DashboardStats;
  orchestratorId?: string | null;
  projectName?: string;
  /** Project IDs that have a tracker configured (eligible for sprint board) */
  trackerProjects: string[];
}

export function HomeView({
  initialSessions,
  stats,
  orchestratorId,
  projectName,
  trackerProjects,
}: HomeViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialView = searchParams.get("view") === "sprint" ? "sprint" : "sessions";
  const projectParam = searchParams.get("project");
  const initialProject =
    projectParam && trackerProjects.includes(projectParam)
      ? projectParam
      : trackerProjects[0] || "";

  const [view, setView] = useState<"sessions" | "sprint">(initialView);
  const [selectedProject, setSelectedProject] = useState<string>(initialProject);

  const updateUrl = useCallback(
    (newView: "sessions" | "sprint", newProject: string) => {
      const params = new URLSearchParams();
      if (newView === "sprint") {
        params.set("view", "sprint");
        if (newProject) params.set("project", newProject);
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "/", { scroll: false });
    },
    [router],
  );

  const showToggle = trackerProjects.length > 0;

  return (
    <>
      {/* View toggle — only shown when tracker projects exist */}
      {showToggle && (
        <div className="px-8 pt-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="flex rounded-[6px] border border-[var(--color-border-default)] overflow-hidden">
              <button
                onClick={() => {
                  setView("sessions");
                  updateUrl("sessions", selectedProject);
                }}
                className={`px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                  view === "sessions"
                    ? "bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                Sessions
              </button>
              <button
                onClick={() => {
                  setView("sprint");
                  updateUrl("sprint", selectedProject);
                }}
                className={`px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                  view === "sprint"
                    ? "bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                Sprint Board
              </button>
            </div>
            {view === "sprint" && trackerProjects.length > 1 && (
              <select
                value={selectedProject}
                onChange={(e) => {
                  setSelectedProject(e.target.value);
                  updateUrl("sprint", e.target.value);
                }}
                className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-[11px] text-[var(--color-text-secondary)] px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                {trackerProjects.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Conditionally render either Dashboard or SprintBoard */}
      {view === "sessions" || !selectedProject ? (
        <Dashboard
          initialSessions={initialSessions}
          stats={stats}
          orchestratorId={orchestratorId}
          projectName={projectName}
        />
      ) : (
        <div className="px-8 py-7">
          <SprintBoard key={selectedProject} projectId={selectedProject} />
        </div>
      )}
    </>
  );
}
