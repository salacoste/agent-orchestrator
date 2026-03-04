"use client";

import { useState, useEffect } from "react";
import type { BmadColumn } from "@composio/ao-plugin-tracker-bmad";
import { BurndownChart } from "./BurndownChart";
import { CreateStoryForm } from "./CreateStoryForm";
import { CycleTimeChart } from "./CycleTimeChart";
import { EpicProgress, type EpicSummary } from "./EpicProgress";
import { HealthIndicators } from "./HealthIndicators";

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
  const [activeEpic, setActiveEpic] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  return (
    <div className="space-y-4">
      {/* Health indicators */}
      <HealthIndicators projectId={projectId} />

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
          return (
            <div
              key={col}
              className={`rounded-[6px] border-t-2 ${COLUMN_COLORS[col] || "border-zinc-700"} border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.10em] text-[var(--color-text-tertiary)]">
                  {COLUMN_LABELS[col] || col}
                </h3>
                <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-inset)] px-1.5 py-0.5 rounded">
                  {stories.length}
                </span>
              </div>
              <div className="space-y-2">
                {stories.map((story) => (
                  <div
                    key={story.id}
                    className="rounded-[5px] border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] p-2.5 hover:border-[var(--color-border-default)] transition-colors"
                  >
                    <div className="text-[10px] font-mono text-[var(--color-text-muted)] mb-1">
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
                ))}
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
      <div className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
        <button
          onClick={() => setShowBurndown((prev) => !prev)}
          aria-expanded={showBurndown}
          className="w-full flex items-center justify-between px-4 py-3 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <span>Burndown</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {showBurndown ? "Hide" : "Show"}
          </span>
        </button>
        {showBurndown && (
          <div className="px-4 pb-4">
            <BurndownChart projectId={projectId} />
          </div>
        )}
      </div>

      {/* Cycle Time Metrics — collapsible */}
      <div className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
        <button
          onClick={() => setShowMetrics((prev) => !prev)}
          aria-expanded={showMetrics}
          className="w-full flex items-center justify-between px-4 py-3 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <span>Cycle Time Metrics</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {showMetrics ? "Hide" : "Show"}
          </span>
        </button>
        {showMetrics && (
          <div className="px-4 pb-4">
            <CycleTimeChart projectId={projectId} />
          </div>
        )}
      </div>

      {/* Create Story — collapsible */}
      <div className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
        <button
          onClick={() => setShowCreateForm((prev) => !prev)}
          aria-expanded={showCreateForm}
          className="w-full flex items-center justify-between px-4 py-3 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <span>Create Story</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {showCreateForm ? "Hide" : "Show"}
          </span>
        </button>
        {showCreateForm && (
          <div className="px-4 pb-4">
            <CreateStoryForm
              projectId={projectId}
              onCreated={() => {
                setRefreshKey((k) => k + 1);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
