"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { CascadeStatus } from "@/lib/workflow/cascade-detector";

/** Auto-clear cascade status after this many ms of no new cascade events. */
const AUTO_CLEAR_MS = 30_000;

/**
 * Hook that tracks cascade failure status from SSE events (Story 40.1).
 *
 * Creates its own EventSource to `/api/events` for cascade event listening.
 * NOTE: This is a second SSE connection alongside useWorkflowSSE — acceptable
 * for cascade monitoring which is lightweight (only reads cascade.triggered events).
 * A future optimization could share the SSE connection via React context.
 *
 * Also exposes `onCascadeTriggered` for direct invocation in tests.
 */
export function useCascadeStatus(): {
  status: CascadeStatus | null;
  resume: () => void;
  onCascadeTriggered: (data: { failureCount: number }) => void;
} {
  const [status, setStatus] = useState<CascadeStatus | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCascadeTriggered = useCallback((data: { failureCount: number }) => {
    setStatus({
      triggered: true,
      failureCount: data.failureCount ?? 0,
      paused: true,
    });

    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      setStatus(null);
    }, AUTO_CLEAR_MS);
  }, []);

  useEffect(() => {
    // Guard: EventSource not available in SSR/test environments
    if (typeof EventSource === "undefined") return;

    const es = new EventSource("/api/events");

    function handleMessage(event: MessageEvent) {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          failureCount?: number;
        };
        if (data.type === "cascade.triggered") {
          onCascadeTriggered({ failureCount: data.failureCount ?? 0 });
        }
      } catch {
        // Ignore malformed messages
      }
    }

    es.addEventListener("message", handleMessage);

    return () => {
      es.removeEventListener("message", handleMessage);
      es.close();
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [onCascadeTriggered]);

  const resume = useCallback(() => {
    fetch("/api/agent/cascade/resume", { method: "POST" }).catch(() => {
      // Resume request failure is non-fatal
    });
    setStatus(null);
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  return { status, resume, onCascadeTriggered };
}
