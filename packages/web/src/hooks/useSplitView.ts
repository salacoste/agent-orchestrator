"use client";

import { useState, useCallback, useEffect } from "react";

/**
 * Hook for managing split view state (Story 44.2).
 *
 * Tracks which agent is being viewed in split mode.
 * Escape key closes the split view.
 */
export function useSplitView(): {
  isOpen: boolean;
  agentId: string | null;
  open: (agentId: string) => void;
  close: () => void;
} {
  const [agentId, setAgentId] = useState<string | null>(null);

  const open = useCallback((id: string) => {
    setAgentId(id);
  }, []);

  const close = useCallback(() => {
    setAgentId(null);
  }, []);

  // Escape key closes split view
  useEffect(() => {
    if (!agentId) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAgentId(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [agentId]);

  return {
    isOpen: agentId !== null,
    agentId,
    open,
    close,
  };
}
