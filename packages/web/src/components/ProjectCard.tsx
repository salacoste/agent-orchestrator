"use client";

import { useState, useEffect, useRef } from "react";
import type { PortfolioProject } from "@/lib/types";
import { cn } from "@/lib/cn";

interface ProjectCardProps {
  project: PortfolioProject;
  onClick?: () => void;
}

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

// Highlight duration in ms (must match CSS animation duration)
const HIGHLIGHT_DURATION_MS = 1000;

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const hasStories =
    project.stories.backlog > 0 ||
    project.stories.inProgress > 0 ||
    project.stories.done > 0 ||
    project.stories.blocked > 0;

  // Check if project was recently updated (for highlight animation)
  // Uses useState+useEffect so the highlight expires after HIGHLIGHT_DURATION_MS
  const lastUpdatedRef = useRef(project.lastUpdated);
  const [isHighlighted, setIsHighlighted] = useState(() => {
    if (!project.lastUpdated) return false;
    return Date.now() - project.lastUpdated < HIGHLIGHT_DURATION_MS;
  });

  useEffect(() => {
    if (project.lastUpdated !== lastUpdatedRef.current) {
      lastUpdatedRef.current = project.lastUpdated;
      if (!project.lastUpdated) {
        setIsHighlighted(false);
        return;
      }
      setIsHighlighted(true);
      const timer = setTimeout(() => setIsHighlighted(false), HIGHLIGHT_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [project.lastUpdated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && onClick) {
      e.preventDefault();
      onClick();
    }
    // Note: Space key intentionally not handled - only Enter triggers navigation
  };

  return (
    <article
      className={cn(
        "rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 transition-all duration-150",
        onClick &&
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none",
        isHighlighted && "animate-[highlight-pulse_1s_ease-out]",
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role={onClick ? "button" : "listitem"}
    >
      {/* Header: status dot + name */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn("h-2 w-2 rounded-full", statusColors[project.status])}
          aria-label={`Status: ${statusLabels[project.status]}`}
        />
        <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
          {project.name}
        </h3>
        <span className="ml-auto font-mono text-[10px] text-[var(--color-text-muted)]">
          {project.id}
        </span>
      </div>

      {/* Active agents count */}
      <div className="mb-3 flex items-center gap-2">
        <svg
          className="h-3.5 w-3.5 text-[var(--color-text-secondary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {project.activeAgents} active agent{project.activeAgents !== 1 ? "s" : ""}
        </span>
        {project.totalAgents > 0 && (
          <UtilizationBadge active={project.activeAgents} total={project.totalAgents} />
        )}
        {/* Capacity badge — shown when capacity info is available */}
        {project.capacityStatus && project.capacityStatus.maxCapacity > 0 && (
          <CapacityBadge
            utilizationPercent={project.capacityStatus.utilizationPercent}
            isAtCapacity={project.capacityStatus.isAtCapacity}
            isNearCapacity={project.capacityStatus.isNearCapacity}
            availableSlots={project.capacityStatus.availableSlots}
          />
        )}
        {/* Shared pool badge */}
        {project.sharedPool?.enabled && (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-[rgba(88,166,255,0.12)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)]"
            aria-label={`Shared pool: available for ${project.sharedPool.eligibleProjects.length} project${project.sharedPool.eligibleProjects.length !== 1 ? "s" : ""}${project.sharedPool.reservedAgents && project.sharedPool.reservedAgents.length > 0 ? `, ${project.sharedPool.reservedAgents.length} reserved` : ""}`}
          >
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
            Pool
            {project.sharedPool.reservedAgents && project.sharedPool.reservedAgents.length > 0
              ? ` (${project.sharedPool.reservedAgents.length} reserved)`
              : ""}
          </span>
        )}
      </div>

      {/* Pool agents available from other projects */}
      {project.poolAgentsAvailable && project.poolAgentsAvailable.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <svg
            className="h-3.5 w-3.5 text-[var(--color-accent)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          <span className="text-xs text-[var(--color-accent)]">
            {project.poolAgentsAvailable.length} pool agent
            {project.poolAgentsAvailable.length !== 1 ? "s" : ""} available
          </span>
          {(() => {
            // Group by source project for compact display
            const byProject = new Map<string, { name: string; count: number }>();
            for (const pa of project.poolAgentsAvailable) {
              const existing = byProject.get(pa.sourceProjectId);
              if (existing) {
                existing.count++;
              } else {
                byProject.set(pa.sourceProjectId, { name: pa.sourceProjectName, count: 1 });
              }
            }
            return Array.from(byProject.entries()).map(([sourceId, { name, count }]) => (
              <span
                key={sourceId}
                className="inline-flex items-center gap-0.5 rounded-full bg-[rgba(88,166,255,0.08)] px-1.5 py-0.5 text-[10px] text-[var(--color-accent)]"
                aria-label={`Pool agent from ${name}`}
              >
                {count} from {name}
              </span>
            ));
          })()}
        </div>
      )}

      {/* Stories breakdown */}
      {hasStories && (
        <div className="flex flex-wrap gap-2">
          {project.stories.inProgress > 0 && (
            <StoryBadge
              label="In Progress"
              count={project.stories.inProgress}
              colorClass="bg-[rgba(88,166,255,0.15)] text-[var(--color-accent)]"
            />
          )}
          {project.stories.backlog > 0 && (
            <StoryBadge
              label="Backlog"
              count={project.stories.backlog}
              colorClass="bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]"
            />
          )}
          {project.stories.done > 0 && (
            <StoryBadge
              label="Done"
              count={project.stories.done}
              colorClass="bg-[rgba(63,185,80,0.15)] text-[var(--color-status-ready)]"
            />
          )}
          {project.stories.blocked > 0 && (
            <StoryBadge
              label="Blocked"
              count={project.stories.blocked}
              colorClass="bg-[rgba(239,68,68,0.15)] text-[var(--color-status-error)]"
            />
          )}
        </div>
      )}

      {/* Last activity */}
      {project.lastActivity && (
        <div className="mt-3 text-[10px] text-[var(--color-text-muted)]">
          Last activity: {formatRelativeTime(project.lastActivity)}
        </div>
      )}
    </article>
  );
}

function StoryBadge({
  label,
  count,
  colorClass,
}: {
  label: string;
  count: number;
  colorClass: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
        colorClass,
      )}
    >
      <span className="font-bold">{count}</span>
      {label}
    </span>
  );
}

function UtilizationBadge({ active, total }: { active: number; total: number }) {
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;
  const colorClass =
    pct >= 80
      ? "bg-[rgba(63,185,80,0.15)] text-[var(--color-status-ready)]"
      : pct >= 50
        ? "bg-[rgba(88,166,255,0.15)] text-[var(--color-accent)]"
        : "bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]";
  return (
    <span
      className={cn(
        "ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
        colorClass,
      )}
      aria-label={`Utilization: ${pct}%`}
    >
      <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          opacity={0.25}
        />
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={`${(pct / 100) * 62.83} 62.83`}
          strokeLinecap="round"
          transform="rotate(-90 12 12)"
        />
      </svg>
      {pct}%
    </span>
  );
}

function CapacityBadge({
  utilizationPercent,
  isAtCapacity,
  isNearCapacity,
  availableSlots,
}: {
  utilizationPercent: number;
  isAtCapacity: boolean;
  isNearCapacity: boolean;
  availableSlots: number;
}) {
  const colorClass = isAtCapacity
    ? "bg-[rgba(239,68,68,0.15)] text-[var(--color-status-error)]"
    : isNearCapacity
      ? "bg-[rgba(234,179,8,0.15)] text-[#eab308]"
      : "bg-[rgba(63,185,80,0.15)] text-[var(--color-status-ready)]";

  const label = isAtCapacity
    ? "At full capacity"
    : isNearCapacity
      ? `Near capacity (${utilizationPercent}%)`
      : `${availableSlots} slot${availableSlots !== 1 ? "s" : ""} available`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
        colorClass,
      )}
      aria-label={label}
    >
      <svg
        className="h-2.5 w-2.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        <rect x="3" y="12" width="4" height="9" rx="1" strokeWidth="2" />
        <rect x="10" y="7" width="4" height="14" rx="1" strokeWidth="2" />
        <rect x="17" y="3" width="4" height="18" rx="1" strokeWidth="2" />
      </svg>
      {isAtCapacity ? "Full" : `${availableSlots} free`}
    </span>
  );
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
