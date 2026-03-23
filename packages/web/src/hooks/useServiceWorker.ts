"use client";

import { useEffect, useState } from "react";

/**
 * Hook for registering the service worker (Story 44.8).
 *
 * Registers /sw.js on mount in production. No-op in development
 * or when service workers are unavailable (SSR, non-HTTPS).
 */
export function useServiceWorker(): { registered: boolean } {
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => setRegistered(true))
      .catch(() => {
        // Registration failed — non-fatal (e.g., HTTP in dev)
      });
  }, []);

  return { registered };
}
