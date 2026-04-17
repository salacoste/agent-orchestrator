"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface SimulationConfig {
  simulations: number;
  confidenceLevels: string[];
  throughputWindowDays: number;
  excludeWeekends: boolean;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  simulations: 5000,
  confidenceLevels: ["p50", "p80", "p95"],
  throughputWindowDays: 0,
  excludeWeekends: true,
};

function storageKey(projectId: string): string {
  return `ao:sim-config:${projectId}`;
}

function loadConfig(projectId: string): SimulationConfig {
  if (typeof window === "undefined") return DEFAULT_SIMULATION_CONFIG;
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return DEFAULT_SIMULATION_CONFIG;
    const parsed = JSON.parse(raw) as Partial<SimulationConfig>;
    return {
      simulations: parsed.simulations ?? DEFAULT_SIMULATION_CONFIG.simulations,
      confidenceLevels: parsed.confidenceLevels ?? DEFAULT_SIMULATION_CONFIG.confidenceLevels,
      throughputWindowDays:
        parsed.throughputWindowDays ?? DEFAULT_SIMULATION_CONFIG.throughputWindowDays,
      excludeWeekends: parsed.excludeWeekends ?? DEFAULT_SIMULATION_CONFIG.excludeWeekends,
    };
  } catch {
    return DEFAULT_SIMULATION_CONFIG;
  }
}

function saveConfig(projectId: string, config: SimulationConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(config));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function useSimulationConfig(projectId: string) {
  const [config, setConfigState] = useState<SimulationConfig>(() => loadConfig(projectId));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setConfigState(loadConfig(projectId));
  }, [projectId]);

  const setConfig = useCallback(
    (next: SimulationConfig) => {
      setConfigState(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => saveConfig(projectId, next), 300);
    },
    [projectId],
  );

  const reset = useCallback(() => {
    setConfigState(DEFAULT_SIMULATION_CONFIG);
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey(projectId));
    }
  }, [projectId]);

  return { config, setConfig, reset };
}
