"use client";

import { useState, useEffect } from "react";
import type { ExperienceLevel } from "@/lib/workflow/widget-registry";

const STORAGE_KEY = "ao-active-days";

/**
 * Hook for tracking user experience level (Story 44.5).
 *
 * Counts unique calendar days the dashboard is opened.
 * Days 1-3: beginner, 4-7: intermediate, 8+: advanced.
 * Expert mode overrides all levels.
 */
export function useExperienceLevel(): {
  level: ExperienceLevel;
  dayCount: number;
  expertMode: boolean;
  toggleExpertMode: () => void;
} {
  const [expertMode, setExpertMode] = useState(() => {
    try {
      return globalThis.localStorage?.getItem("ao-expert-mode") === "true";
    } catch {
      return false;
    }
  });

  const [dayCount, setDayCount] = useState(() => {
    try {
      const days = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? "[]") as string[];
      return Array.isArray(days) ? days.length : 0;
    } catch {
      return 0;
    }
  });

  // Record today's visit on mount
  useEffect(() => {
    try {
      const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
      const days: string[] = stored ? (JSON.parse(stored) as string[]) : [];
      if (!Array.isArray(days)) return;

      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      if (!days.includes(today)) {
        days.push(today);
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(days));
        setDayCount(days.length);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const toggleExpertMode = () => {
    const next = !expertMode;
    setExpertMode(next);
    try {
      globalThis.localStorage?.setItem("ao-expert-mode", String(next));
    } catch {
      // localStorage unavailable
    }
  };

  const level: ExperienceLevel = expertMode
    ? "expert"
    : dayCount >= 8
      ? "advanced"
      : dayCount >= 4
        ? "intermediate"
        : "beginner";

  return { level, dayCount, expertMode, toggleExpertMode };
}
