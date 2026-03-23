"use client";

import { useState, useCallback } from "react";
import type { UserRole } from "@/lib/workflow/widget-registry";

const STORAGE_KEY = "ao-user-role";
const DEFAULT_ROLE: UserRole = "dev";

/**
 * Hook for user role management (Story 44.1).
 *
 * Reads from localStorage, falls back to default "dev" role.
 * Persists role changes to localStorage immediately.
 */
export function useUserRole(): {
  role: UserRole;
  setRole: (role: UserRole) => void;
} {
  const [role, setRoleState] = useState<UserRole>(() => {
    try {
      const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (stored === "dev" || stored === "pm" || stored === "lead" || stored === "admin") {
        return stored;
      }
    } catch {
      // localStorage unavailable (SSR/test environments)
    }
    return DEFAULT_ROLE;
  });

  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, newRole);
    } catch {
      // localStorage unavailable
    }
  }, []);

  return { role, setRole };
}
