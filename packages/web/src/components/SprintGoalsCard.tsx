"use client";

import { useState, useEffect } from "react";

interface SprintGoal {
  title: string;
  type: "epic" | "points" | "stories" | "custom";
  progress: number;
  status: "pending" | "in-progress" | "done" | "at-risk";
  details: string;
  confidence: number;
}

interface GoalsData {
  goals: SprintGoal[];
  overallProgress: number;
  onTrack: boolean;
  sprintEndDate: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  done: "text-green-400",
  "in-progress": "text-blue-400",
  "at-risk": "text-red-400",
  pending: "text-[var(--color-text-muted)]",
};

const STATUS_LABELS: Record<string, string> = {
  done: "Done",
  "in-progress": "In Progress",
  "at-risk": "At Risk",
  pending: "Pending",
};

function ProgressBar({ value }: { value: number }) {
  const color = value >= 100 ? "bg-green-500" : value >= 50 ? "bg-blue-500" : "bg-yellow-500";
  return (
    <div className="w-full h-1.5 bg-[var(--color-bg-inset)] rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

export function SprintGoalsCard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<GoalsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = () => {
      fetch(`/api/sprint/${encodeURIComponent(projectId)}/goals`)
        .then((res) => (res.ok ? res.json() : null))
        .then((d) => {
          if (!cancelled && d) setData(d as GoalsData);
        })
        .catch(() => {});
    };
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectId]);

  if (!data || data.goals.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Sprint Goals</h3>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${data.onTrack ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}
        >
          {data.onTrack ? "On Track" : "At Risk"}
        </span>
      </div>
      <div className="space-y-3">
        {data.goals.map((goal, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--color-text-primary)]">{goal.title}</span>
              <span className={`text-[10px] ${STATUS_COLORS[goal.status] ?? ""}`}>
                {STATUS_LABELS[goal.status] ?? goal.status}
              </span>
            </div>
            <ProgressBar value={goal.progress} />
            <div className="text-[10px] text-[var(--color-text-muted)]">{goal.details}</div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[var(--color-text-muted)]">Confidence</span>
              <span className={`font-medium ${
                goal.confidence >= 75 ? 'text-green-400' :
                goal.confidence >= 50 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {goal.confidence}%
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-[var(--color-border-muted)]">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--color-text-muted)]">Overall Progress</span>
          <span className="text-[var(--color-text-secondary)]">{data.overallProgress}%</span>
        </div>
        <ProgressBar value={data.overallProgress} />
      </div>
    </div>
  );
}
