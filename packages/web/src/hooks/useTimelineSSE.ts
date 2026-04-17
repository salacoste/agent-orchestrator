"use client";

import { useEffect, useRef, useState } from "react";
import type { TimelineEntry } from "@composio/ao-core";

/**
 * Hook that fetches initial timeline data via REST, then subscribes to
 * real-time updates via SSE at `/api/session/[id]/timeline/stream`.
 * Auto-reconnects with exponential backoff.
 *
 * Epic 60, Story 60-4 (FR-D2-2).
 */
export function useTimelineSSE(sessionId: string): {
  timeline: TimelineEntry[];
  connected: boolean;
} {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [connected, setConnected] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Fetch initial data via REST
    fetch(`/api/session/${sessionId}/timeline`)
      .then((res) => {
        if (!mountedRef.current) return null;
        if (!res.ok) return null;
        return res.json() as Promise<{
          sessionId: string;
          timeline: TimelineEntry[];
          totalEntries: number;
        }>;
      })
      .then((data) => {
        if (!mountedRef.current || !data) return;
        setTimeline(data.timeline ?? []);
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

      const es = new EventSource(`/api/session/${sessionId}/timeline/stream`);
      esRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        retryRef.current = 0;
      };

      es.onmessage = (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data as string) as {
            type: string;
            sessionId: string;
            timeline: TimelineEntry[];
            totalEntries: number;
          };
          if (data.type === "timeline-update") {
            setTimeline(data.timeline ?? []);
          }
        } catch {
          // Ignore malformed messages (heartbeats are comments, not data)
        }
      };

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

  return { timeline, connected };
}
