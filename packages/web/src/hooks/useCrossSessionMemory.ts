"use client";

/**
 * useCrossSessionMemory — real-time cross-session memory via REST + SSE.
 *
 * Follows `useProjectMemorySSE` pattern with named events (`memory-update`).
 * REST fetch for initial data, SSE for real-time updates.
 *
 * Story 61-2, AC #1, #7.
 */
import { useEffect, useRef, useState } from "react";
import type { CrossSessionMemoryEntry } from "@composio/ao-core";

const MAX_SSE_RETRIES = 10;

export function useCrossSessionMemory(projectName: string): {
  entries: CrossSessionMemoryEntry[];
  enabled: boolean;
  connected: boolean;
  error: boolean;
} {
  const [entries, setEntries] = useState<CrossSessionMemoryEntry[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(false);
  const [sseReady, setSseReady] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const encoded = encodeURIComponent(projectName);

  useEffect(() => {
    mountedRef.current = true;

    fetch(`/api/cross-session-memory/${encoded}`)
      .then((res) => {
        if (!mountedRef.current || !res.ok) return null;
        return res.json() as Promise<{
          entries: CrossSessionMemoryEntry[];
          project: string;
          enabled: boolean;
        }>;
      })
      .then((data) => {
        if (!mountedRef.current || !data) {
          setError(true);
          return;
        }
        setEntries(data.entries);
        setEnabled(data.enabled);
        setError(false);
        setSseReady(true);
      })
      .catch(() => {
        if (mountedRef.current) setError(true);
      });

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [encoded]);

  // Separate effect: only connect SSE after REST succeeds
  useEffect(() => {
    if (!sseReady) return;

    function connect() {
      if (!mountedRef.current) return;
      timerRef.current = null;
      if (esRef.current) esRef.current.close();

      const es = new EventSource(`/api/cross-session-memory/${encoded}/stream`);
      esRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        retryRef.current = 0;
      };

      // Named event — use addEventListener, NOT onmessage
      es.addEventListener("memory-update", (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data as string) as {
            entries: CrossSessionMemoryEntry[];
            project: string;
            enabled: boolean;
          };
          setEntries(data.entries);
          setEnabled(data.enabled);
          setError(false);
        } catch {
          // Ignore malformed SSE messages
        }
      });

      es.onerror = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        es.close();
        retryRef.current++;
        if (retryRef.current > MAX_SSE_RETRIES) return;
        const delay = Math.min(1000 * Math.pow(2, retryRef.current), 8000);
        timerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      esRef.current?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [encoded, sseReady]);

  return { entries, enabled, connected, error };
}
