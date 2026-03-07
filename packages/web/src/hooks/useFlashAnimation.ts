"use client";

import { useEffect, useState, useRef } from "react";

export function useFlashAnimation<T>(deps: T[]): boolean {
  const [isFlashing, setIsFlashing] = useState(false);
  const prevDepsRef = useRef<T[]>(deps);

  useEffect(() => {
    // Check if any dependency changed
    const hasChanged = deps.some((dep, i) => dep !== prevDepsRef.current[i]);

    if (hasChanged) {
      // Update ref immediately to prevent race condition
      prevDepsRef.current = deps;
      setIsFlashing(true);
      const timeout = setTimeout(() => setIsFlashing(false), 300);
      return () => clearTimeout(timeout);
    }

    // Update ref when no change (needed for dependency tracking)
    prevDepsRef.current = deps;
  }, [deps]);

  return isFlashing;
}
