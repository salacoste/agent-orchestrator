"use client";

/**
 * useProjectMemorySSE — real-time project memory via REST + SSE.
 *
 * Follows `useSessionStateSSE` pattern with named events (`memory-update`).
 * REST fetch for initial data, SSE for real-time updates.
 *
 * Story 60-9, AC #7.
 */
import { useEffect, useRef, useState } from "react";
import type { ProjectMemory } from "@composio/ao-core";

export function useProjectMemorySSE(sessionId: string): {
  memory: ProjectMemory | null;
  exists: boolean;
  connected: boolean;
} {
  const [memory, setMemory] = useState<ProjectMemory | null>(null);
  const [exists, setExists] = useState(false);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Initial REST fetch
    fetch(`/api/session/${sessionId}/memory`)
      .then((res) => {
        if (!mountedRef.current || !res.ok) return null;
        return res.json() as Promise<{
          sessionId: string;
          memory: ProjectMemory;
          exists: boolean;
        }>;
      })
      .then((data) => {
        if (!mountedRef.current || !data) return;
        setMemory(data.memory);
        setExists(data.exists);
      })
      .catch(() => {});

    function connect() {
      if (!mountedRef.current) return;
      timerRef.current = null;
      if (esRef.current) esRef.current.close();

      const es = new EventSource(`/api/session/${sessionId}/memory/stream`);
      esRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        retryRef.current = 0;
      };

      // CRITICAL: Named event — use addEventListener, NOT onmessage
      es.addEventListener("memory-update", (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data as string) as {
            sessionId: string;
            memory: ProjectMemory;
            exists: boolean;
          };
          setMemory(data.memory);
          setExists(data.exists);
        } catch {
          // Ignore malformed SSE messages
        }
      });

      es.onerror = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        es.close();
        const delay = Math.min(1000 * Math.pow(2, retryRef.current), 8000);
        retryRef.current++;
        timerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sessionId]);

  return { memory, exists, connected };
}
