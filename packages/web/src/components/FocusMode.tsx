"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FocusBreadcrumb } from "@/components/FocusBreadcrumb";
import { LogStream } from "@/components/LogStream";
import { ReplayTimeline } from "@/components/ReplayTimeline";

interface AgentData {
  id: string;
  name?: string;
  story?: string;
  status?: string;
}

interface ActivityEvent {
  type: string;
  timestamp: string;
  description?: string;
  file?: string;
}

interface FocusModeProps {
  /** Agent ID to focus on. */
  agentId: string;
  /** Display name for breadcrumb (from AgentInfo). */
  agentDisplayName: string;
  /** Called to exit focus mode. */
  onClose: () => void;
}

/** Activity poll interval — 10s keeps data fresh without hammering the API. */
const ACTIVITY_POLL_MS = 10_000;

/**
 * Focus Mode — single story deep dive (Story 44.6).
 *
 * Replaces the dashboard widget grid with a focused view
 * of a single agent: status, log stream, modified files.
 */
export function FocusMode({ agentId, agentDisplayName, onClose }: FocusModeProps) {
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReplay, setShowReplay] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch agent data + activity
  const fetchData = useCallback(
    async (signal: AbortSignal) => {
      try {
        const [agentRes, activityRes] = await Promise.all([
          fetch(`/api/agent/${agentId}`, { signal }),
          fetch(`/api/agent/${agentId}/activity`, { signal }),
        ]);

        if (agentRes.ok) {
          const data = (await agentRes.json()) as AgentData;
          setAgentData(data);
        }

        if (activityRes.ok) {
          const data = (await activityRes.json()) as { events?: ActivityEvent[] };
          if (Array.isArray(data.events)) {
            setActivity(data.events);
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load agent data");
      }
    },
    [agentId],
  );

  // Initial load + poll for activity updates
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    void fetchData(controller.signal).then(() => setLoading(false));

    const interval = setInterval(() => {
      void fetchData(controller.signal);
    }, ACTIVITY_POLL_MS);

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [fetchData]);

  const modifiedFiles = useMemo(
    () => activity.filter((e) => e.file && (e.type === "file_modify" || e.type === "file_create")),
    [activity],
  );
  const testEvents = useMemo(() => activity.filter((e) => e.type === "test"), [activity]);

  // Memoize replay events: reverse to chronological order (activity API returns newest-first)
  // and stabilize the array reference to prevent useReplay timer resets on poll re-renders.
  const replayEvents = useMemo(
    () =>
      [...activity]
        .filter((e): e is ActivityEvent & { description: string } => !!e.description)
        .reverse()
        .map((e) => ({ timestamp: e.timestamp, type: e.type, description: e.description })),
    [activity],
  );

  return (
    <div data-testid="focus-mode">
      {/* Breadcrumb */}
      <FocusBreadcrumb agentName={agentDisplayName} onBack={onClose} />

      {/* Agent status header */}
      <div
        className="mt-3 rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-4"
        data-testid="focus-agent-header"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
              {agentDisplayName}
            </h2>
            {agentData?.story && (
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Story: {agentData.story}
              </p>
            )}
          </div>
          {agentData?.status && (
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]"
              data-testid="focus-agent-status"
            >
              {agentData.status}
            </span>
          )}
        </div>
      </div>

      {loading && (
        <div className="mt-3 space-y-3" data-testid="focus-loading">
          <div className="h-10 rounded-[6px] bg-[var(--color-bg-subtle)] animate-pulse" />
          <div className="h-24 rounded-[6px] bg-[var(--color-bg-subtle)] animate-pulse" />
        </div>
      )}

      {error && (
        <p className="mt-3 text-[12px] text-[var(--color-status-error)]" data-testid="focus-error">
          {error}
        </p>
      )}

      {/* Log stream / Replay toggle (Story 45.1) */}
      <div className="mt-4" data-testid="focus-log-stream">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            {showReplay ? "Session Replay" : "Live Logs"}
          </h3>
          <button
            type="button"
            onClick={() => setShowReplay((v) => !v)}
            className="text-[10px] text-[var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-sm"
            data-testid="replay-toggle"
          >
            {showReplay ? "Live Logs" : "Replay"}
          </button>
        </div>
        {showReplay ? <ReplayTimeline events={replayEvents} /> : <LogStream agentId={agentId} />}
      </div>

      {/* Modified files */}
      <div className="mt-4" data-testid="focus-modified-files">
        <h3 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
          Modified Files ({modifiedFiles.length})
        </h3>
        {modifiedFiles.length > 0 ? (
          <ul className="space-y-1">
            {modifiedFiles.map((e, i) => (
              <li
                key={`${e.file}-${i}`}
                className="text-[12px] font-mono text-[var(--color-text-secondary)] px-3 py-1 rounded-[4px] bg-[var(--color-bg-subtle)]"
              >
                {e.file}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-[var(--color-text-muted)] italic">No file changes yet.</p>
        )}
      </div>

      {/* Test results */}
      <div className="mt-4" data-testid="focus-test-results">
        <h3 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
          Test Results ({testEvents.length})
        </h3>
        {testEvents.length > 0 ? (
          <ul className="space-y-1">
            {testEvents.map((e, i) => (
              <li
                key={`test-${i}`}
                className="text-[12px] text-[var(--color-text-secondary)] px-3 py-1 rounded-[4px] bg-[var(--color-bg-subtle)]"
              >
                {e.description ?? `Test event at ${e.timestamp}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-[var(--color-text-muted)] italic">No test results yet.</p>
        )}
      </div>
    </div>
  );
}
