"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface LogStreamProps {
  /** Agent session ID to stream logs for. */
  agentId: string;
  /** Poll interval in ms (default: 2000). */
  pollIntervalMs?: number;
  /** Base URL for log API (default: ""). */
  baseUrl?: string;
}

/**
 * Live agent log streaming terminal (Story 44.3).
 *
 * Loads last 100 lines on mount, then polls every 2s for new lines.
 * Monospace display with auto-scroll and copy-all button.
 */
export function LogStream({ agentId, pollIntervalMs = 2000, baseUrl = "" }: LogStreamProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchLogs = useCallback(
    async (lineCount: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${baseUrl}/api/agent/${agentId}/logs?lines=${lineCount}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { logs?: string[] };
        if (Array.isArray(data.logs)) {
          setLines(data.logs);
        }
      } catch {
        // Abort or fetch error — retain previous data
      }
    },
    [agentId, baseUrl],
  );

  // Initial load
  useEffect(() => {
    setLoading(true);
    void fetchLogs(100).then(() => setLoading(false));

    // Poll for new lines every pollIntervalMs
    intervalRef.current = setInterval(() => {
      void fetchLogs(100);
    }, pollIntervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      abortRef.current?.abort();
    };
  }, [fetchLogs, pollIntervalMs]);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [lines]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch {
      // Clipboard API unavailable
    }
  }, [lines]);

  return (
    <div
      className="rounded-[6px] border border-[var(--color-border-default)] bg-[#0d1117] flex flex-col"
      data-testid="log-stream"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border-default)]">
        <span className="text-[11px] text-[var(--color-text-muted)]">Logs: {agentId}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          data-testid="log-copy-button"
        >
          Copy All
        </button>
      </div>

      {/* Log content */}
      <div className="overflow-auto max-h-[400px] p-3" data-testid="log-content">
        {loading && lines.length === 0 && (
          <p className="text-[11px] text-[var(--color-text-muted)] italic">Loading logs...</p>
        )}
        {!loading && lines.length === 0 && (
          <p className="text-[11px] text-[var(--color-text-muted)] italic">No logs available.</p>
        )}
        <pre className="font-mono text-[11px] text-[#c9d1d9] whitespace-pre-wrap break-words">
          {lines.join("\n")}
        </pre>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
