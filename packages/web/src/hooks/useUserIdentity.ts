"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "ao-user-id";

/** Configured user from API. */
interface ConfigUser {
  id: string;
  name: string;
  role: string;
  email?: string;
}

/** Anonymous default. */
const ANONYMOUS: ConfigUser = { id: "anonymous", name: "Anonymous", role: "admin" };

/**
 * Hook for user identity selection (Story 46b.1).
 *
 * Stores selected userId in localStorage, fetches user list from API.
 * Returns current user object based on selection.
 */
export function useUserIdentity(): {
  user: ConfigUser;
  users: ConfigUser[];
  setUserId: (id: string) => void;
} {
  const [userId, setUserIdState] = useState<string>(() => {
    try {
      return globalThis.localStorage?.getItem(STORAGE_KEY) ?? "anonymous";
    } catch {
      return "anonymous";
    }
  });

  const [users, setUsers] = useState<ConfigUser[]>([]);

  // Fetch configured users on mount
  useEffect(() => {
    const controller = new AbortController();

    async function loadUsers() {
      try {
        const res = await fetch("/api/users", { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { users?: ConfigUser[] };
        if (Array.isArray(data.users)) {
          setUsers(data.users);
        }
      } catch {
        // Non-fatal
      }
    }

    void loadUsers();
    return () => controller.abort();
  }, []);

  const setUserId = (id: string) => {
    setUserIdState(id);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage unavailable
    }
  };

  const user = users.find((u) => u.id === userId) ?? ANONYMOUS;

  return { user, users, setUserId };
}
