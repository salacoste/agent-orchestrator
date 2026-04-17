"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Notepad data returned by the API.
 */
export interface NotepadData {
  priority: string;
  working: string;
  manual: string;
}

/**
 * Hook that fetches initial notepad data via REST, then subscribes to
 * real-time updates via SSE at `/api/session/[id]/notepad/stream`.
 * Auto-reconnects with exponential backoff.
 *
 * Epic 60, Story 60-2 (FR-D1-2).
 */
export function useNotepadSSE(sessionId: string): {
  notepad: NotepadData | null;
  exists: boolean;
  connected: boolean;
} {
  const [notepad, setNotepad] = useState<NotepadData | null>(null);
  const [exists, setExists] = useState(false);
  const [connected, setConnected] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Fetch initial data via REST (SSE will also send snapshot on connect)
    fetch(`/api/session/${sessionId}/notepad`)
      .then((res) => {
        if (!mountedRef.current) return null;
        if (!res.ok) return null;
        return res.json() as Promise<{
          sessionId: string;
          notepad: NotepadData;
          exists: boolean;
        }>;
      })
      .then((data) => {
        if (!mountedRef.current || !data) return;
        setNotepad(data.notepad);
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

      const es = new EventSource(`/api/session/${sessionId}/notepad/stream`);
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
            notepad: NotepadData;
            exists: boolean;
          };
          if (data.type === "notepad-update") {
            setNotepad(data.notepad);
            setExists(data.exists);
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

  return { notepad, exists, connected };
}
