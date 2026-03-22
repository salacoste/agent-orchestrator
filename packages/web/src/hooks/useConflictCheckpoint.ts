"use client";

import { useEffect, useState, useRef } from "react";
import type { FileConflict } from "@/lib/workflow/conflict-detector";
import type { CheckpointTimeline } from "@/lib/workflow/checkpoint-tracker";

/** Poll interval (30 seconds). */
const POLL_INTERVAL_MS = 30_000;

/**
 * Hook that fetches conflict and checkpoint data (Story 40.3).
 *
 * Polls GET /api/sprint/conflicts every 30 seconds.
 */
export function useConflictCheckpoint(): {
  conflicts: FileConflict[];
  timeline: CheckpointTimeline | null;
} {
  const [conflicts, setConflicts] = useState<FileConflict[]>([]);
  const [timeline, setTimeline] = useState<CheckpointTimeline | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function fetchData() {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/sprint/conflicts", { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as {
          conflicts?: FileConflict[];
          timeline?: CheckpointTimeline | null;
        };
        if (Array.isArray(data.conflicts)) {
          setConflicts(data.conflicts);
        }
        setTimeline(data.timeline ?? null);
      } catch {
        // Fetch failure or abort — retain previous data
      }
    }

    void fetchData();

    intervalRef.current = setInterval(() => {
      void fetchData();
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return { conflicts, timeline };
}
