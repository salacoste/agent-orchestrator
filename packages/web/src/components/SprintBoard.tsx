"use client";

import { useState, useEffect, useCallback } from "react";
import type { BmadColumn, DependencyGraph, DependencyNode } from "@composio/ao-plugin-tracker-bmad";
import { BurndownChart } from "./BurndownChart";
import { CreateStoryForm } from "./CreateStoryForm";
import { CycleTimeChart } from "./CycleTimeChart";
import { EpicProgress, type EpicSummary } from "./EpicProgress";
import { HealthIndicators } from "./HealthIndicators";
import { VelocityChart } from "./VelocityChart";
import { PlanningView } from "./PlanningView";

interface StoryCard {
  id: string;
  title: string;
  url?: string;
  state: string;
  bmadStatus: string;
  epic: string | null;
  session: { id: string; activity: string | null } | null;
}

interface SprintData {
  projectId: string;
  projectName: string;
  columns: Record<string, StoryCard[]>;
  columnOrder: string[];
  epics?: EpicSummary[];
  stats: { total: number; done: number; inProgress: number; open: number };
}

interface WipStatus {
  [column: string]: { current: number; limit: number };
}

const COLUMN_LABELS: Record<BmadColumn, string> & Record<string, string | undefined> = {
  backlog: "Backlog",
  "ready-for-dev": "Ready",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
};

const COLUMN_COLORS: Record<BmadColumn, string> & Record<string, string | undefined> = {
  backlog: "border-zinc-700",
  "ready-for-dev": "border-yellow-700",
  "in-progress": "border-blue-700",
  review: "border-purple-700",
  done: "border-green-700",
};

export function SprintBoard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<SprintData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBurndown, setShowBurndown] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showVelocity, setShowVelocity] = useState(false);
  const [showPlanning, setShowPlanning] = useState(false);
  const [activeEpic, setActiveEpic] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [depGraph, setDepGraph] = useState<DependencyGraph | null>(null);
  const [wipStatus, setWipStatus] = useState<WipStatus>({});
  const [wipConfirm, setWipConfirm] = useState<{
    storyId: string;
    fromCol: string;
    toCol: string;
    current: number;
    limit: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let initialLoad = true;

    const fetchData = () => {
      fetch(`/api/sprint/${encodeURIComponent(projectId)}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load sprint data");
          return res.json();
        })
        .then((d) => {
          if (!cancelled) {
            setData(d as SprintData);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
        })
        .finally(() => {
          if (!cancelled && initialLoad) {
            setLoading(false);
            initialLoad = false;
          }
        });
    };

    fetchData();
    const interval = setInterval(fetchData, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectId, refreshKey]);

  // Fetch dependency graph
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sprint/${encodeURIComponent(projectId)}/dependencies`)
      .then((res) => res.json())
      .then((d) => {
        if (!cancelled) setDepGraph(d as DependencyGraph);
      })
      .catch(() => {
        // Non-critical
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  // Fetch WIP status
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sprint/${encodeURIComponent(projectId)}/health`)
      .then((res) => res.json())
      .then(() => {
        // WIP status comes from a dedicated endpoint or config
        // For now, parse from the sprint config API
        return fetch(`/api/sprint/${encodeURIComponent(projectId)}/config`);
      })
      .then((res) => res.json())
      .then((cfg) => {
        if (!cancelled) {
          const rawLimits = (cfg as Record<string, unknown>)?.["wipLimits"];
          if (rawLimits && typeof rawLimits === "object" && !Array.isArray(rawLimits)) {
            // We have limits configured — compute current counts from data
            const limits = rawLimits as Record<string, number>;
            const status: WipStatus = {};
            if (data) {
              for (const [col, limit] of Object.entries(limits)) {
                const stories = data.columns[col] ?? [];
                status[col] = { current: stories.length, limit };
              }
            }
            setWipStatus(status);
          }
        }
      })
      .catch(() => {
        // Non-critical
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey, data]);

  const handleDragStart = useCallback((e: React.DragEvent, storyId: string, fromCol: string) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ storyId, fromCol }));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const moveStory = useCallback(
    async (storyId: string, fromCol: string, toCol: string, force: boolean = false) => {
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        const columns = { ...prev.columns };
        const fromStories = [...(columns[fromCol] || [])];
        const toStories = [...(columns[toCol] || [])];
        const idx = fromStories.findIndex((s) => s.id === storyId);
        if (idx === -1) return prev;
        const [moved] = fromStories.splice(idx, 1);
        toStories.push({ ...moved, bmadStatus: toCol });
        columns[fromCol] = fromStories;
        columns[toCol] = toStories;
        return { ...prev, columns };
      });

      try {
        const res = await fetch(
          `/api/sprint/${encodeURIComponent(projectId)}/story/${encodeURIComponent(storyId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: toCol, force }),
          },
        );

        if (!res.ok) {
          const body = (await res.json()) as {
            error?: string;
            wipExceeded?: boolean;
            current?: number;
            limit?: number;
          };

          if (body.wipExceeded) {
            // Rollback and show confirmation
            setRefreshKey((k) => k + 1);
            setWipConfirm({
              storyId,
              fromCol,
              toCol,
              current: body.current ?? 0,
              limit: body.limit ?? 0,
            });
            return;
          }

          throw new Error(body.error || `HTTP ${res.status}`);
        }

        setRefreshKey((k) => k + 1);
      } catch (err) {
        setRefreshKey((k) => k + 1);
        setMoveError(
          `Failed to move ${storyId}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
    [projectId],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent, toCol: string) => {
      e.preventDefault();
      setDragOverCol(null);
      setMoveError(null);

      let parsed: { storyId: string; fromCol: string };
      try {
        parsed = JSON.parse(e.dataTransfer.getData("text/plain")) as {
          storyId: string;
          fromCol: string;
        };
      } catch {
        return;
      }

      const { storyId, fromCol } = parsed;
      if (fromCol === toCol) return;

      await moveStory(storyId, fromCol, toCol);
    },
    [moveStory],
  );

  if (loading) {
    return <div className="text-[var(--color-text-muted)] text-sm p-4">Loading sprint data...</div>;
  }

  if (error || !data) {
    return <div className="text-red-400 text-sm p-4">{error || "No data"}</div>;
  }

  // Compute stats — use filtered counts when epic filter is active
  const stats = (() => {
    if (!activeEpic) return data.stats;
    const epicData = data.epics?.find((e) => e.epicId === activeEpic);
    if (!epicData) return data.stats;
    return {
      total: epicData.total,
      done: epicData.done,
      inProgress: epicData.inProgress,
      open: epicData.open,
    };
  })();
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const getDepNode = (storyId: string): DependencyNode | undefined => depGraph?.nodes[storyId];

  return (
    <div className="space-y-4">
      {/* Health indicators */}
      <HealthIndicators projectId={projectId} />

      {/* Move error */}
      {moveError && (
        <div className="rounded-[6px] border border-red-700 bg-red-950/30 px-4 py-2 text-[12px] text-red-400">
          {moveError}
        </div>
      )}

      {/* WIP confirmation dialog */}
      {wipConfirm && (
        <div className="rounded-[6px] border border-yellow-700 bg-yellow-950/30 px-4 py-3 text-[12px]">
          <p className="text-yellow-400 mb-2">
            WIP limit exceeded for &quot;{wipConfirm.toCol}&quot; ({wipConfirm.current}/
            {wipConfirm.limit}). Move anyway?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const { storyId, fromCol, toCol } = wipConfirm;
                setWipConfirm(null);
                void moveStory(storyId, fromCol, toCol, true);
              }}
              className="px-3 py-1 rounded bg-yellow-700 text-white text-[11px] hover:bg-yellow-600"
            >
              Force Move
            </button>
            <button
              onClick={() => setWipConfirm(null)}
              className="px-3 py-1 rounded bg-[var(--color-bg-inset)] text-[var(--color-text-secondary)] text-[11px] hover:bg-[var(--color-bg-surface)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
            Sprint Progress: {data.projectName}
          </h2>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            {stats.done}/{stats.total} stories ({pct}%)
          </span>
        </div>
        <div className="w-full h-2 bg-[var(--color-bg-inset)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-status-success)] rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Epic progress */}
      {data.epics && data.epics.length > 0 && (
        <EpicProgress epics={data.epics} activeEpic={activeEpic} onFilterEpic={setActiveEpic} />
      )}

      {/* Columns */}
      <div className="grid grid-cols-5 gap-3">
        {data.columnOrder.map((col) => {
          const stories = (data.columns[col] || []).filter(
            (s) => !activeEpic || s.epic === activeEpic,
          );
          const isOver = dragOverCol === col;
          const wip = wipStatus[col];
          const atWipLimit = wip && wip.current >= wip.limit;

          return (
            <div
              key={col}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverCol(col);
              }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => handleDrop(e, col)}
              className={`rounded-[6px] border-t-2 ${atWipLimit ? "border-red-600" : COLUMN_COLORS[col] || "border-zinc-700"} border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3 transition-colors ${isOver ? "bg-[var(--color-bg-inset)]" : ""}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.10em] text-[var(--color-text-tertiary)]">
                  {COLUMN_LABELS[col] || col}
                </h3>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${atWipLimit ? "bg-red-950 text-red-400" : "bg-[var(--color-bg-inset)] text-[var(--color-text-muted)]"}`}
                >
                  {stories.length}
                  {wip ? `/${wip.limit}` : ""}
                </span>
              </div>
              <div className="space-y-2">
                {stories.map((story) => {
                  const depNode = getDepNode(story.id);
                  const isBlocked = depNode?.isBlocked ?? false;

                  return (
                    <div
                      key={story.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, story.id, col)}
                      className={`rounded-[5px] border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] p-2.5 hover:border-[var(--color-border-default)] transition-colors cursor-grab active:cursor-grabbing ${isBlocked ? "opacity-60" : ""}`}
                    >
                      <div className="text-[10px] font-mono text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
                        {story.url && !story.url.startsWith("file://") ? (
                          <a
                            href={story.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[var(--color-accent)] hover:underline"
                          >
                            {story.id}
                          </a>
                        ) : (
                          story.id
                        )}
                        {isBlocked && (
                          <span
                            className="text-red-400"
                            title={`Blocked by: ${depNode!.blockedBy.join(", ")}`}
                          >
                            🔒{depNode!.blockedBy.length}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-[var(--color-text-primary)] mb-1.5 line-clamp-2">
                        {story.title}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {story.epic && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-inset)] text-[var(--color-text-muted)]">
                            {story.epic}
                          </span>
                        )}
                        {story.session && (
                          <a
                            href={`/sessions/${encodeURIComponent(story.session.id)}`}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(59,130,246,0.1)] text-[var(--color-status-working)] hover:bg-[rgba(59,130,246,0.2)]"
                          >
                            {story.session.id}
                            {story.session.activity ? ` (${story.session.activity})` : ""}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
                {stories.length === 0 && (
                  <div className="text-[11px] text-[var(--color-text-muted)] text-center py-4">
                    No stories
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Burndown chart — collapsible */}
      <CollapsibleSection title="Burndown" isOpen={showBurndown} onToggle={setShowBurndown}>
        <BurndownChart projectId={projectId} />
      </CollapsibleSection>

      {/* Cycle Time Metrics — collapsible */}
      <CollapsibleSection title="Cycle Time Metrics" isOpen={showMetrics} onToggle={setShowMetrics}>
        <CycleTimeChart projectId={projectId} />
      </CollapsibleSection>

      {/* Velocity Comparison — collapsible */}
      <CollapsibleSection
        title="Velocity Comparison"
        isOpen={showVelocity}
        onToggle={setShowVelocity}
      >
        <VelocityChart projectId={projectId} />
      </CollapsibleSection>

      {/* Sprint Planning — collapsible */}
      <CollapsibleSection title="Sprint Planning" isOpen={showPlanning} onToggle={setShowPlanning}>
        <PlanningView projectId={projectId} />
      </CollapsibleSection>

      {/* Create Story — collapsible */}
      <CollapsibleSection title="Create Story" isOpen={showCreateForm} onToggle={setShowCreateForm}>
        <CreateStoryForm
          projectId={projectId}
          onCreated={() => {
            setRefreshKey((k) => k + 1);
          }}
        />
      </CollapsibleSection>
    </div>
  );
}

function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
      <button
        onClick={() => onToggle(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-4 py-3 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <span>{title}</span>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {isOpen ? "Hide" : "Show"}
        </span>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
