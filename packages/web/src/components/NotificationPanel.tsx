"use client";

import { useState, useEffect } from "react";

interface SprintNotification {
  type: string;
  severity: "warning" | "critical" | "info";
  title: string;
  message: string;
  details: string[];
  timestamp: string;
}

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <span className="text-red-400">●</span>;
    case "warning":
      return <span className="text-yellow-400">▲</span>;
    default:
      return <span className="text-blue-400">ℹ</span>;
  }
}

function severityBorder(severity: string): string {
  switch (severity) {
    case "critical":
      return "border-red-700/50";
    case "warning":
      return "border-yellow-700/50";
    default:
      return "border-blue-700/50";
  }
}

export function NotificationPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<SprintNotification[] | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const fetchData = () => {
      fetch(`/api/sprint/${encodeURIComponent(projectId)}/notifications`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load notifications");
          return res.json();
        })
        .then((d) => {
          if (!cancelled) setData(d as SprintNotification[]);
        })
        .catch(() => {
          // Non-fatal — notifications are supplementary
        });
    };

    fetchData();
    const interval = setInterval(fetchData, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectId]);

  // Collapse to nothing when no notifications
  if (!data || data.length === 0) return null;

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {data.map((notification, idx) => {
        const isExpanded = expanded.has(idx);
        const hasDetails = notification.details.length > 0;

        return (
          <div
            key={`${notification.type}-${idx}`}
            className={`rounded-[6px] border ${severityBorder(notification.severity)} bg-[var(--color-bg-surface)] px-4 py-2.5`}
          >
            <div className="flex items-center gap-2">
              <SeverityIcon severity={notification.severity} />
              <span className="text-[12px] text-[var(--color-text-primary)] flex-1">
                {notification.title}
              </span>
              {hasDetails && (
                <button
                  onClick={() => toggleExpand(idx)}
                  className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  {isExpanded ? "Hide" : "Details"}
                </button>
              )}
            </div>
            <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 pl-5">
              {notification.message}
            </div>
            {isExpanded && hasDetails && (
              <div className="mt-2 pl-5 space-y-0.5">
                {notification.details.map((detail, i) => (
                  <div key={i} className="text-[11px] text-[var(--color-text-muted)] font-mono">
                    → {detail}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
