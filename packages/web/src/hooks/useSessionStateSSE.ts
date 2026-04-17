"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionState } from "@composio/ao-core";

/**
 * Hook that fetches initial session state via REST, then subscribes to
 * real-time updates via SSE at `/api/session/[id]/state/stream`.
 * Auto-reconnects with exponential backoff.
 *
 * CRITICAL: Uses `addEventListener("state-update", ...)` because the SSE
 * endpoint sends named events (NOT default `onmessage`).
 *
 * Epic 60, Story 60-8 (FR-D4-1, FR-D4-2).
 */
export function useSessionStateSSE(sessionId: string): {
  state: SessionState | null;
  exists: boolean;
  connected: boolean;
} {
  const [state, setState] = useState<SessionState | null>(null);
  const [exists, setExists] = useState(false);
  const [connected, setConnected] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Fetch initial data via REST
    fetch(`/api/session/${sessionId}/state`)
      .then((res) => {
        if (!mountedRef.current) return null;
        if (!res.ok) return null;
        return res.json() as Promise<{
          sessionId: string;
          state: SessionState;
          exists: boolean;
        }>;
      })
      .then((data) => {
        if (!mountedRef.current || !data) return;
        setState(data.state);
        setExists(data.exists);
      })
      .catch(() => {
        // Initial fetch failed — SSE will provide data on connect
      });

    // SSE connection for real-time updates
    function connect() {
      if (!mountedRef.current) return;
      timerRef.current = null;

      // Close existing connection
      if (esRef.current) {
        esRef.current.close();
      }

      const es = new EventSource(`/api/session/${sessionId}/state/stream`);
      esRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        retryRef.current = 0;
      };

      // Named event listener — the SSE endpoint sends `event: state-update`
      es.addEventListener("state-update", (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data as string) as {
            sessionId: string;
            state: SessionState;
            exists: boolean;
          };
          setState(data.state);
          setExists(data.exists);
        } catch {
          // Ignore malformed messages
        }
      });

      es.onerror = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        es.close();
        // Exponential backoff: 1s, 2s, 4s, 8s (cap)
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

  return { state, exists, connected };
}
