"use client";

import { useEffect, useRef } from "react";
import type { ResourceConflict } from "@composio/ao-core";
import { CONFLICT_SSE_EVENT_TYPE } from "@/lib/conflict-sse-constants";

/**
 * Subscribes to conflict-detected SSE events from /api/events.
 * Fires the provided callback whenever new resource conflicts arrive.
 *
 * Follows the same EventSource pattern as useSessionEvents.
 * Uses a ref to avoid re-subscribing when the callback identity changes.
 */
export function useConflictSSE(onConflictDetected: (conflicts: ResourceConflict[]) => void): void {
  const callbackRef = useRef(onConflictDetected);

  // Keep ref in sync without re-triggering the effect
  useEffect(() => {
    callbackRef.current = onConflictDetected;
  }, [onConflictDetected]);

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          conflicts?: ResourceConflict[];
        };
        if (data.type === CONFLICT_SSE_EVENT_TYPE && data.conflicts) {
          callbackRef.current(data.conflicts);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here
    };

    return () => {
      es.close();
    };
  }, []);
}
