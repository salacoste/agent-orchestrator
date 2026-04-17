import Link from "next/link";
import type { PortfolioProject } from "@/lib/types";

/** Error state component for invalid/missing projects */
export function ProjectNotFound({ projectId }: { projectId: string }) {
  return (
    <div className="px-8 py-12">
      <section aria-label="Project Not Found">
        <div className="mb-4">
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-sm"
          >
            &larr; Portfolio
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-8 py-16 text-center">
          <svg
            className="mb-4 h-12 w-12 text-[var(--color-status-error)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h1 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">
            Project Not Found
          </h1>
          <p className="mb-4 max-w-md text-sm text-[var(--color-text-secondary)]">
            The project{" "}
            <code className="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 font-mono text-xs">
              {projectId}
            </code>{" "}
            could not be found. It may have been removed or the URL may be incorrect.
          </p>
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
          >
            Return to Portfolio
          </Link>
        </div>
      </section>
    </div>
  );
}

/** Breadcrumb navigation for project detail page */
export function ProjectBreadcrumb({ projectName }: { projectName: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-2 text-sm">
        <li>
          <Link
            href="/portfolio"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-sm"
          >
            &larr; Portfolio
          </Link>
        </li>
        <li aria-hidden="true" className="text-[var(--color-text-muted)]">
          /
        </li>
        <li>
          <span className="font-medium text-[var(--color-text-primary)]" aria-current="page">
            {projectName}
          </span>
        </li>
      </ol>
    </nav>
  );
}

/** Project header displaying name and status prominently */
export function ProjectHeader({ project }: { project: PortfolioProject }) {
  const statusColors: Record<PortfolioProject["status"], string> = {
    active: "bg-[var(--color-status-working)]",
    idle: "bg-[var(--color-status-attention)]",
    error: "bg-[var(--color-status-error)]",
  };

  const statusLabels: Record<PortfolioProject["status"], string> = {
    active: "Active",
    idle: "Idle",
    error: "Error",
  };

  return (
    <header className="mb-6">
      <div className="flex items-center gap-3">
        <span
          className={`h-3 w-3 rounded-full ${statusColors[project.status]}`}
          aria-label={`Status: ${statusLabels[project.status]}`}
        />
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{project.name}</h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            project.status === "active"
              ? "bg-[rgba(63,185,80,0.15)] text-[var(--color-status-ready)]"
              : project.status === "error"
                ? "bg-[rgba(239,68,68,0.15)] text-[var(--color-status-error)]"
                : "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]"
          }`}
        >
          {statusLabels[project.status]}
        </span>
      </div>
      {project.activeAgents > 0 && (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {project.activeAgents} active agent{project.activeAgents !== 1 ? "s" : ""}
        </p>
      )}
      {project.sharedPool?.enabled && (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Shared pool enabled — eligible for{" "}
          {project.sharedPool.eligibleProjects.length === 0
            ? "no projects"
            : project.sharedPool.eligibleProjects.length === 1
              ? project.sharedPool.eligibleProjects[0]
              : `${project.sharedPool.eligibleProjects.length} projects`}
          {typeof project.sharedPool.maxConcurrent === "number" &&
            ` (max ${project.sharedPool.maxConcurrent} concurrent)`}
          {project.sharedPool.reservedAgents && project.sharedPool.reservedAgents.length > 0 && (
            <>
              {" "}
              &mdash;{" "}
              <span aria-label={`${project.sharedPool.reservedAgents.length} reserved agents`}>
                {project.sharedPool.reservedAgents.length} reserved:{" "}
                {project.sharedPool.reservedAgents.join(", ")}
              </span>
            </>
          )}
        </p>
      )}
    </header>
  );
}
