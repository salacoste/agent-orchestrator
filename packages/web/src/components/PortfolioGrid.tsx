"use client";

import type { PortfolioProject } from "@/lib/types";
import { ProjectCard } from "./ProjectCard";

interface PortfolioGridProps {
  projects: PortfolioProject[];
  onProjectClick?: (projectId: string) => void;
}

export function PortfolioGrid({ projects, onProjectClick }: PortfolioGridProps) {
  // Empty state is handled by PortfolioView, but grid should still be accessible
  if (projects.length === 0) {
    return (
      <div
        role="list"
        aria-label="No projects configured"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      />
    );
  }

  return (
    <div role="list" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onClick={onProjectClick ? () => onProjectClick(project.id) : undefined}
        />
      ))}
    </div>
  );
}
