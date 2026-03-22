"use client";

import { useEffect, useState, useRef } from "react";

export interface SSEEventHandlers {
  onStoryStarted?: (data: { storyId: string; agentId: string }) => void;
  onStoryCompleted?: (data: { storyId: string }) => void;
  onStoryBlocked?: (data: { storyId: string; reason: string }) => void;
  onAgentStatusChanged?: (data: { agentId: string; status: string }) => void;
  onCascadeTriggered?: (data: { failureCount: number }) => void;
  onReconnected?: () => void;
}

export interface UseSSEConnectionOptions {
  eventSourceFactory?: () => EventSource;
}

export function useSSEConnection(handlers?: SSEEventHandlers, options?: UseSSEConnectionOptions) {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  const optionsRef = useRef(options);

  // Keep refs in sync without causing re-renders
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const factory =
      optionsRef.current?.eventSourceFactory ?? (() => new EventSource("/api/events"));
    const es = factory();
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setReconnecting(false);
      reconnectAttemptsRef.current = 0;

      // Fetch any missed events after reconnection
      if (handlersRef.current?.onReconnected) {
        handlersRef.current.onReconnected();
      }
    };

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as { type: string; data?: unknown };

        switch (data.type) {
          case "story.started":
            handlersRef.current?.onStoryStarted?.(
              data.data as { storyId: string; agentId: string },
            );
            break;
          case "story.completed":
            handlersRef.current?.onStoryCompleted?.(data.data as { storyId: string });
            break;
          case "story.blocked":
            handlersRef.current?.onStoryBlocked?.(data.data as { storyId: string; reason: string });
            break;
          case "agent.status_changed":
            handlersRef.current?.onAgentStatusChanged?.(
              data.data as { agentId: string; status: string },
            );
            break;
          case "cascade.triggered":
            handlersRef.current?.onCascadeTriggered?.(data as unknown as { failureCount: number });
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();

      // Exponential backoff: 1s, 2s, 4s, 8s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 8000);
      reconnectAttemptsRef.current += 1;

      setReconnecting(true);
      reconnectTimeoutRef.current = setTimeout(() => {
        // Force reconnection by re-running effect
        setConnected(false);
        setReconnecting(false);
      }, delay);
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []); // Empty deps - only run once on mount

  return { connected, reconnecting };
}
