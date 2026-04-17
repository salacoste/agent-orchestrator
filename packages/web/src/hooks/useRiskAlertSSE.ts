"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { RISK_ALERT_SSE_EVENT_TYPE } from "@/lib/risk-alert-sse-constants";
import type { RiskAlert } from "@/lib/risk-alert-types";

/**
 * Subscribes to risk-alert SSE events from /api/events.
 * Returns active alerts state and an acknowledge function.
 *
 * Story 56.5 Task 7.
 */
export function useRiskAlertSSE(): {
  activeAlerts: RiskAlert[];
  acknowledge: (alertId: string) => void;
} {
  const [activeAlerts, setActiveAlerts] = useState<RiskAlert[]>([]);
  const callbackRef = useRef<(alerts: RiskAlert[]) => void>(() => {});

  callbackRef.current = (alerts: RiskAlert[]) => {
    setActiveAlerts((prev) => [...prev, ...alerts]);
  };

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          alert?: RiskAlert;
        };
        if (data.type === RISK_ALERT_SSE_EVENT_TYPE && data.alert) {
          callbackRef.current([data.alert]);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => {
      es.close();
    };
  }, []);

  const acknowledge = useCallback((alertId: string) => {
    setActiveAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  return { activeAlerts, acknowledge };
}
