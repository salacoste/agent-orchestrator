"use client";

import { useEffect, useRef } from "react";

/**
 * Subscribes to SSE workflow-change events and calls the provided callback.
 * Auto-reconnects with exponential backoff on connection errors.
 * Fires callback on reconnect to catch any missed changes.
 */
export function useWorkflowSSE(onWorkflowChange: () => void): void {
  const callbackRef = useRef(onWorkflowChange);

  // Keep callback ref in sync without re-triggering the effect
  useEffect(() => {
    callbackRef.current = onWorkflowChange;
  }, [onWorkflowChange]);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let unmounted = false;

    function connect() {
      if (unmounted) return;
      reconnectTimer = null;

      // Close any existing connection (defensive against React Strict Mode re-runs)
      if (es) {
        es.close();
      }

      es = new EventSource("/api/events");

      es.onopen = () => {
        if (unmounted) return;
        const wasReconnect = reconnectAttempts > 0;
        reconnectAttempts = 0;
        if (wasReconnect) {
          // Fetch missed changes after reconnection
          callbackRef.current();
        }
      };

      es.onmessage = (event: MessageEvent) => {
        if (unmounted) return;
        try {
          const data = JSON.parse(event.data as string) as { type: string };
          if (data.type === "workflow-change") {
            callbackRef.current();
          }
        } catch {
          // Ignore malformed messages
        }
      };

      es.onerror = () => {
        if (unmounted) return;
        es?.close();
        // Exponential backoff: 1s, 2s, 4s, 8s (cap)
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 8000);
        reconnectAttempts++;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      unmounted = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []); // Empty deps — connect once on mount
}
