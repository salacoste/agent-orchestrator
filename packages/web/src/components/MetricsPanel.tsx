"use client";

import { useState, useEffect } from "react";

interface BlockedStory {
  id: string;
  status: string;
}

interface WorkflowMetrics {
  stories: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
    blockedStories: BlockedStory[];
  };
  agents: {
    total: number;
    active: number;
    utilizationRate: number;
  };
  cycleTime: {
    average: number;
    target: number;
    trend: "up" | "down" | "stable";
  };
  burndown: {
    remaining: number;
    total: number;
    progress: number;
  };
}

interface MetricsPanelProps {
  projectId?: string;
}

export default function MetricsPanel({ projectId = "default" }: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`/api/workflow/health-metrics?projectId=${projectId}`);
        if (!response.ok) throw new Error("Failed to fetch metrics");
        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
        setError("Failed to load metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [projectId]);

  const getColorClass = (value: number, target: number): string => {
    const ratio = value / target;
    if (ratio <= 1) return "text-green-600";
    if (ratio <= 1.1) return "text-yellow-600";
    return "text-red-600";
  };

  const getBlockedColorClass = (blocked: number): string => {
    if (blocked <= 3) return "text-green-600";
    if (blocked <= 5) return "text-yellow-600";
    return "text-red-600";
  };

  if (loading) {
    return <div className="text-sm text-[var(--color-text-muted)]">Loading metrics...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">Failed to load metrics</div>;
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="mb-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        Workflow Health Metrics
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Stories Metric */}
        <MetricCard
          title="Stories"
          value={`${metrics.stories.total} total`}
          details={`${metrics.stories.completed} completed, ${metrics.stories.inProgress} in progress`}
          color="text-[var(--color-accent)]"
        />

        {/* Blocked Stories */}
        <MetricCard
          title="Blocked"
          value={`${metrics.stories.blocked} stories`}
          details={metrics.stories.blocked > 3 ? "Needs attention!" : ""}
          color={getBlockedColorClass(metrics.stories.blocked)}
          onClick={() => setSelectedMetric("blocked")}
        />

        {/* Agent Utilization */}
        <MetricCard
          title="Agent Utilization"
          value={`${Math.round(metrics.agents.utilizationRate * 100)}%`}
          details={`${metrics.agents.active} of ${metrics.agents.total} agents`}
          color={getColorClass(metrics.agents.utilizationRate, 0.7)}
        />

        {/* Sprint Burndown */}
        <MetricCard
          title="Sprint Progress"
          value={`${metrics.burndown.progress}%`}
          details={`${metrics.burndown.remaining} of ${metrics.burndown.total} remaining`}
          color={getColorClass(metrics.burndown.progress / 100, 0.8)}
          onClick={() => setSelectedMetric("burndown")}
        />
      </div>

      {/* Modal for selected metric */}
      {selectedMetric && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setSelectedMetric(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-[var(--color-bg-surface)] rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">
              {selectedMetric === "blocked"
                ? `Blocked Stories (${metrics.stories.blocked})`
                : "Sprint Progress"}
            </h3>
            {selectedMetric === "blocked" ? (
              <ul className="space-y-2">
                {metrics.stories.blockedStories.length > 0 ? (
                  metrics.stories.blockedStories.map((story) => (
                    <li
                      key={story.id}
                      className="flex justify-between items-center text-sm p-2 rounded border border-[var(--color-border-default)]"
                    >
                      <span className="text-[var(--color-text-primary)]">{story.id}</span>
                      <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                        {story.status}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-[var(--color-text-muted)]">
                    No blocked stories found
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">
                Sparkline chart showing last 7 days would appear here.
              </p>
            )}
            <button
              onClick={() => setSelectedMetric(null)}
              className="mt-4 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-accent-foreground)] rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  details: string;
  color?: string;
  onClick?: () => void;
}

function MetricCard({ title, value, details, color, onClick }: MetricCardProps) {
  return (
    <div
      className={`p-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onClick}
    >
      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
        {title}
      </div>
      <div className={`text-2xl font-bold ${color || "text-[var(--color-text-primary)]"}`}>
        {value}
      </div>
      <div className="text-sm text-[var(--color-text-secondary)] mt-1">{details}</div>
    </div>
  );
}
