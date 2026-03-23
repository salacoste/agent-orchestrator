"use client";

import { useState, useEffect } from "react";
import type { ExperienceLevel } from "@/lib/workflow/widget-registry";

const STORAGE_KEY = "ao-active-days";
const EXPERT_KEY = "ao-expert-mode";
/** Maximum tracked days — prevents unbounded localStorage growth. */
const MAX_TRACKED_DAYS = 365;

/** Get today's date as YYYY-MM-DD in user's local timezone. */
function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Validate stored days: must be string[] with YYYY-MM-DD entries. */
function parseDays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v));
}

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
      return globalThis.localStorage?.getItem(EXPERT_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [dayCount, setDayCount] = useState(() => {
    try {
      const days = parseDays(JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? "[]"));
      return days.length;
    } catch {
      return 0;
    }
  });

  // Record today's visit on mount
  useEffect(() => {
    try {
      const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
      let days = parseDays(stored ? JSON.parse(stored) : []);

      const today = localToday();
      if (!days.includes(today)) {
        days.push(today);
        // Trim oldest entries if over cap
        if (days.length > MAX_TRACKED_DAYS) {
          days = days.slice(-MAX_TRACKED_DAYS);
        }
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
      globalThis.localStorage?.setItem(EXPERT_KEY, String(next));
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
