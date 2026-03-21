"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { CommandPalette, type PaletteAction } from "@/components/CommandPalette";
import { EmptyWorkflowState } from "@/components/EmptyWorkflowState";
import { WorkflowDashboard } from "@/components/WorkflowDashboard";
import { useWorkflowSSE } from "@/hooks/useWorkflowSSE";
import type { WorkflowResponse } from "@/lib/workflow/types";

interface WorkflowPageProps {
  projects: string[];
}

export function WorkflowPage({ projects }: WorkflowPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const projectParam = searchParams.get("project");
  const initialProject =
    projectParam && projects.includes(projectParam) ? projectParam : (projects[0] ?? "");

  const [selectedProject, setSelectedProject] = useState(initialProject);
  const [data, setData] = useState<WorkflowResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateUrl = useCallback(
    (projectId: string) => {
      const params = new URLSearchParams();
      if (projectId) {
        params.set("project", projectId);
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "/workflow", { scroll: false });
    },
    [router],
  );

  // Ref for selectedProject — avoids stale closure in SSE callback (AC5)
  const selectedProjectRef = useRef(selectedProject);
  useEffect(() => {
    selectedProjectRef.current = selectedProject;
  }, [selectedProject]);

  // Ref for in-flight AbortController — enables fetch deduplication (AC6)
  const abortRef = useRef<AbortController | null>(null);

  // Extracted fetch function — called by both initial load AND SSE refresh
  const fetchData = useCallback(async (projectId: string, silent = false) => {
    // Abort any in-flight fetch (deduplication)
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const res = await fetch(`/api/workflow/${encodeURIComponent(projectId)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as WorkflowResponse;
      setData(json);
      setLoading(false);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (silent) {
        // WD-7 client layer: on silent refetch failure, keep existing data.
        setLoading(false);
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load workflow data");
      setLoading(false);
    }
  }, []);

  // Initial fetch + re-fetch on project change
  useEffect(() => {
    if (!selectedProject) return;
    fetchData(selectedProject);
    return () => {
      abortRef.current?.abort();
    };
  }, [selectedProject, fetchData]);

  // SSE subscription — re-fetch on workflow-change event
  useWorkflowSSE(
    useCallback(() => {
      const project = selectedProjectRef.current;
      if (project) {
        fetchData(project, true); // silent: true → no loading skeleton (AC3)
      }
    }, [fetchData]),
  );

  if (projects.length === 0) {
    return (
      <main className="px-8 py-7">
        <h1 className="text-[14px] font-semibold text-[var(--color-text-primary)] mb-4">
          Workflow
        </h1>
        <div className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6">
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            No projects configured. Add projects to{" "}
            <code className="text-[12px] font-mono text-[var(--color-text-primary)]">
              agent-orchestrator.yaml
            </code>{" "}
            to get started.
          </p>
        </div>
      </main>
    );
  }

  const paletteActions: PaletteAction[] = [
    {
      id: "fleet",
      label: "Fleet View",
      description: "Monitor all agents",
      category: "Navigation",
      action: () => router.push("/fleet"),
    },
    {
      id: "workflow",
      label: "Workflow View",
      description: "BMAD phase dashboard",
      category: "Navigation",
      action: () => router.push("/workflow"),
    },
    {
      id: "settings",
      label: "Settings",
      description: "Configuration",
      category: "Navigation",
      action: () => router.push("/settings"),
    },
    {
      id: "refresh",
      label: "Refresh Data",
      description: "Re-fetch workflow state",
      category: "Action",
      action: () => {
        if (selectedProject) fetchData(selectedProject);
      },
    },
  ];

  return (
    <main className="px-8 py-7">
      <CommandPalette actions={paletteActions} />
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-[14px] font-semibold text-[var(--color-text-primary)]">Workflow</h1>
        {projects.length > 1 && (
          <select
            value={selectedProject}
            onChange={(e) => {
              setSelectedProject(e.target.value);
              updateUrl(e.target.value);
            }}
            className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-base)] text-[11px] text-[var(--color-text-secondary)] px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            aria-label="Select project"
          >
            {projects.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3 h-16 rounded-[6px] bg-[var(--color-bg-subtle)] animate-pulse" />
          <div className="md:col-span-2 h-32 rounded-[6px] bg-[var(--color-bg-subtle)] animate-pulse" />
          <div className="h-32 rounded-[6px] bg-[var(--color-bg-subtle)] animate-pulse" />
          <div className="md:col-span-2 h-32 rounded-[6px] bg-[var(--color-bg-subtle)] animate-pulse" />
          <div className="h-32 rounded-[6px] bg-[var(--color-bg-subtle)] animate-pulse" />
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6"
        >
          <p className="text-[13px] text-[var(--color-status-error)]">
            Failed to load workflow data: {error}
          </p>
        </div>
      )}

      {!loading && !error && data && !data.hasBmad && <EmptyWorkflowState />}

      {!loading && !error && data && data.hasBmad && <WorkflowDashboard data={data} />}
    </main>
  );
}
