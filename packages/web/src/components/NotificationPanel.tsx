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
  const [forecastAlerts, setForecastAlerts] = useState<SprintNotification[]>([]);

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

    // SSE subscription for forecast-changed events (Story 55.4)
    let es: EventSource | null = null;
    let reconnectDelay = 1000;
    const connectSSE = () => {
      es = new EventSource("/api/events");
      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === "forecast-changed" && event.project === projectId) {
            const diff = event.diff as {
              p50Shift: number;
              p80Shift: number;
              p95Shift: number;
              direction: string;
            };
            setForecastAlerts((prev) =>
              [
                {
                  type: "forecast_shifted" as string,
                  severity: (Math.abs(diff.p50Shift) >= 5
                    ? "warning"
                    : "info") as SprintNotification["severity"],
                  title: `Forecast shifted ${diff.direction}`,
                  message: `P50 moved ${diff.p50Shift} days (${diff.direction}). New P50: ${event.newP50}`,
                  details: [
                    `P50 shift: ${diff.p50Shift} days`,
                    `P80 shift: ${diff.p80Shift} days`,
                    `P95 shift: ${diff.p95Shift} days`,
                  ],
                  timestamp: event.timestamp || new Date().toISOString(),
                },
                ...prev,
              ].slice(0, 4),
            );
          }
        } catch {
          // Malformed SSE data — ignore
        }
      };
      es.onerror = () => {
        if (es) {
          es.close();
          es = null;
        }
        // Retry SSE with exponential backoff (1s → 2s → 4s → 8s max)
        reconnectDelay = Math.min(reconnectDelay * 2, 8000);
        if (!cancelled) {
          setTimeout(connectSSE, reconnectDelay);
        }
      };
    };
    connectSSE();

    return () => {
      cancelled = true;
      clearInterval(interval);
      es?.close();
    };
  }, [projectId]);

  // Auto-dismiss forecast alerts after 60 seconds (Task 5.4)
  useEffect(() => {
    if (forecastAlerts.length === 0) return;
    const timer = setInterval(() => {
      const cutoff = Date.now() - 60_000;
      setForecastAlerts((prev) => prev.filter((a) => new Date(a.timestamp).getTime() > cutoff));
    }, 10_000);
    return () => clearInterval(timer);
  }, [forecastAlerts.length]);

  // Merge SSE forecast alerts with polled notifications
  const allNotifications = [...forecastAlerts, ...(data ?? [])];

  // Collapse to nothing when no notifications
  if (allNotifications.length === 0) return null;

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
      {allNotifications.map((notification, idx) => {
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
