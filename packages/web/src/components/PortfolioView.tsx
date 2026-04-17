"use client";

import { useMemo, useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { PortfolioProject, PortfolioMetrics, FilterState } from "@/lib/types";
import { calculatePortfolioMetrics } from "@/lib/portfolio-metrics";
import {
  filterProjects,
  extractAvailableTags,
  extractAvailableMetadata,
  EMPTY_FILTERS,
} from "@/lib/portfolio-filter";
import { PortfolioGrid } from "./PortfolioGrid";
import { PortfolioMetricsWidget } from "./PortfolioMetricsWidget";
import { PortfolioFilterBar } from "./PortfolioFilterBar";
import { CrossProjectGraphView } from "./CrossProjectGraphView";
import type { CrossProjectGraph } from "@composio/ao-core";

interface PortfolioViewProps {
  projects: PortfolioProject[];
}

// SSE event payload types
interface SSESnapshotEvent {
  type: "snapshot";
  sessions: Array<{
    id: string;
    projectId: string;
    status: string;
    activity: string | null;
    attentionLevel: string;
    lastActivityAt: string;
  }>;
}

interface SSEGenericEvent {
  type: string;
  data?: unknown;
}

type SSEEvent = SSESnapshotEvent | SSEGenericEvent;

// Connection status for SSE
type ConnectionStatus = "connected" | "reconnecting";

// Batch window for throttling rapid updates (ms)
const BATCH_WINDOW_MS = 500;
// Reconnect max delay (ms)
const RECONNECT_MAX_DELAY_MS = 8000;

export function PortfolioView({ projects: initialProjects }: PortfolioViewProps) {
  const router = useRouter();

  // Local state for projects (enables granular updates without full page refresh)
  const [projects, setProjects] = useState<PortfolioProject[]>(() =>
    initialProjects.map((p) => ({ ...p, lastUpdated: undefined })),
  );

  // Filter state for project filtering (Story 49.5)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  // Cross-project dependency graph state (Story 51.4)
  const [cpGraph, setCpGraph] = useState<CrossProjectGraph | null>(null);
  const [cpGraphLoading, setCpGraphLoading] = useState(false);

  // Connection status for SSE (AC3)
  // Track whether we've ever connected successfully (to distinguish initial connect from reconnect)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connected");
  const hasConnectedRef = useRef(false);

  // Batching state for rapid updates
  const pendingUpdatesRef = useRef<Map<string, Partial<PortfolioProject>>>(new Map());
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use ref for projects to avoid stale closure in processSnapshot
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  // Calculate metrics from projects using memoization
  // Metrics automatically recalculate when projects state changes (AC1)
  const metrics: PortfolioMetrics = useMemo(() => {
    return calculatePortfolioMetrics(projects);
  }, [projects]);

  // Available filter options derived from all projects (not affected by filters)
  const availableTags = useMemo(() => extractAvailableTags(projects), [projects]);
  const availableMetadata = useMemo(() => extractAvailableMetadata(projects), [projects]);

  // Filtered projects — memoized to avoid recalculation on every render (Story 49.5)
  const filteredProjects = useMemo(() => filterProjects(projects, filters), [projects, filters]);

  // Flush pending updates to state (batching pattern from Dev Notes)
  const flushUpdates = useCallback(() => {
    const updates = pendingUpdatesRef.current;
    if (updates.size === 0) return;

    pendingUpdatesRef.current = new Map();
    flushTimeoutRef.current = null;

    const now = Date.now();
    setProjects((prev) => {
      return prev.map((p) => {
        const update = updates.get(p.id);
        if (update) {
          return { ...p, ...update, lastUpdated: now };
        }
        return p;
      });
    });
  }, []);

  // Schedule a flush if not already scheduled
  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current) return;

    flushTimeoutRef.current = setTimeout(flushUpdates, BATCH_WINDOW_MS);
  }, [flushUpdates]);

  // Queue a project update for batching (AC2)
  const queueProjectUpdate = useCallback(
    (projectId: string, update: Partial<PortfolioProject>) => {
      const existing = pendingUpdatesRef.current.get(projectId) || {};
      pendingUpdatesRef.current.set(projectId, { ...existing, ...update });
      scheduleFlush();
    },
    [scheduleFlush],
  );

  // Process SSE snapshot to extract project-level changes (Task 1.3)
  const processSnapshot = useCallback(
    (event: SSESnapshotEvent) => {
      // Group sessions by project
      const projectSessionCounts = new Map<string, number>();
      const projectLatestActivity = new Map<string, string>();

      for (const session of event.sessions) {
        const count = projectSessionCounts.get(session.projectId) || 0;
        projectSessionCounts.set(session.projectId, count + 1);

        const latest = projectLatestActivity.get(session.projectId);
        if (!latest || session.lastActivityAt > latest) {
          projectLatestActivity.set(session.projectId, session.lastActivityAt);
        }
      }

      // Queue updates for affected projects
      for (const [projectId, activeAgents] of projectSessionCounts) {
        const lastActivity = projectLatestActivity.get(projectId);
        queueProjectUpdate(projectId, {
          activeAgents,
          lastActivity,
          status: activeAgents > 0 ? "active" : "idle",
        });
      }

      // Also update projects that had agents but now don't (went idle)
      // Use ref to avoid stale closure
      for (const project of projectsRef.current) {
        if (project.activeAgents > 0 && !projectSessionCounts.has(project.id)) {
          queueProjectUpdate(project.id, {
            activeAgents: 0,
            status: "idle",
          });
        }
      }
    },
    [queueProjectUpdate],
  );

  // SSE subscription for real-time updates (AC1, AC3)
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;

    const connect = () => {
      // Only show "reconnecting" status if we've connected before (not on initial load)
      if (hasConnectedRef.current) {
        setConnectionStatus("reconnecting");
      }

      // Graceful degradation: Check if EventSource is available
      if (typeof EventSource === "undefined") {
        // SSE not supported - silently fail, dashboard will use initial data
        console.warn("SSE not supported in this environment - real-time updates disabled");
        return;
      }

      try {
        es = new EventSource("/api/events");
      } catch (error) {
        // EventSource constructor failed - gracefully degrade
        console.warn("Failed to create EventSource:", error);
        return;
      }

      es.onopen = () => {
        reconnectAttempts = 0;
        hasConnectedRef.current = true;
        setConnectionStatus("connected");
      };

      es.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string) as SSEEvent;

          if (data.type === "snapshot") {
            // Granular update: parse and update only affected projects (AC1, AC4)
            processSnapshot(data as SSESnapshotEvent);
          } else if (data.type === "session.activity") {
            // Fallback: trigger full refresh for session activity events
            // that don't include full snapshot data
            // This ensures we don't miss updates from older event types
            router.refresh();
          } else if (data.type === "cross-project-dep-changed") {
            // Re-fetch cross-project dependency graph when deps change (Story 51.5)
            void fetchCpGraph();
          }
        } catch {
          // Ignore malformed messages
        }
      };

      es.onerror = () => {
        es?.close();
        // Only show "reconnecting" if we've connected before (not on initial load)
        if (hasConnectedRef.current) {
          setConnectionStatus("reconnecting");
        }

        // Exponential backoff: 1s, 2s, 4s, 8s max
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), RECONNECT_MAX_DELAY_MS);
        reconnectAttempts++;
        reconnectTimeout = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      es?.close();
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, [processSnapshot, router]);

  // Navigation handler for project drill-down (Story 49.3)
  const handleProjectClick = useCallback(
    (projectId: string) => {
      router.push(`/portfolio/${projectId}`);
    },
    [router],
  );

  // Fetch cross-project dependency graph (Story 51.4)
  const fetchCpGraph = useCallback(async () => {
    setCpGraphLoading(true);
    try {
      const res = await fetch("/api/dependencies/cross-project/graph");
      if (res.ok) {
        const data = await res.json();
        setCpGraph(data.graph);
      }
    } catch {
      // Non-fatal — graph is supplementary
    } finally {
      setCpGraphLoading(false);
    }
  }, []);

  // Fetch graph on mount
  useEffect(() => {
    void fetchCpGraph();
  }, [fetchCpGraph]);

  // Empty state when no projects configured
  if (projects.length === 0) {
    return (
      <div className="px-8 py-12">
        <section aria-label="Portfolio Dashboard">
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-8 py-16 text-center">
            <svg
              className="mb-4 h-12 w-12 text-[var(--color-text-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">
              No Projects Configured
            </h2>
            <p className="mb-4 max-w-md text-sm text-[var(--color-text-secondary)]">
              Add projects to your{" "}
              <code className="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 font-mono text-xs">
                agent-orchestrator.yaml
              </code>{" "}
              to see them in the portfolio dashboard.
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">Example configuration:</p>
            <pre className="mt-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-3 text-left font-mono text-xs text-[var(--color-text-secondary)]">
              {`projects:
  my-project:
    path: /path/to/project
    tracker:
      plugin: github`}
            </pre>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="px-8 py-7">
      <section aria-label="Portfolio Dashboard">
        {/* Header with connection status indicator (AC3) */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Portfolio</h1>
            {/* Connection status indicator - subtle, only visible when reconnecting */}
            {connectionStatus === "reconnecting" && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(234,179,8,0.15)] px-2 py-0.5 text-xs text-yellow-600"
                role="status"
                aria-live="polite"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
                Reconnecting...
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Portfolio overview</p>
        </div>

        {/* Aggregated Metrics Widget */}
        <div className="mb-6">
          <PortfolioMetricsWidget metrics={metrics} />
        </div>

        {/* Filter bar with status, tag, metadata, and clear controls (Story 49.5) */}
        <PortfolioFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          availableTags={availableTags}
          availableMetadata={availableMetadata}
          projectCount={{ filtered: filteredProjects.length, total: projects.length }}
        />

        <PortfolioGrid projects={filteredProjects} onProjectClick={handleProjectClick} />

        {/* Cross-Project Dependency Graph (Story 51.4) */}
        {projects.length > 1 && (
          <div className="mt-6">
            <CrossProjectGraphView
              graph={cpGraph ?? { nodes: [], edges: [], projectGroups: {} }}
              onRefresh={fetchCpGraph}
            />
            {cpGraphLoading && (
              <div className="flex items-center gap-2 px-1 pt-2 text-[10px] text-[var(--color-text-muted)]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                Loading dependency graph...
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
