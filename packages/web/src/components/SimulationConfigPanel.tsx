"use client";

import { useState, useCallback } from "react";
import { DEFAULT_SIMULATION_CONFIG, type SimulationConfig } from "@/lib/useSimulationConfig";

interface SimulationConfigPanelProps {
  config: SimulationConfig;
  dataPointsUsed?: number;
  onChange: (config: SimulationConfig) => void;
  onReset: () => void;
}

const CONFIDENCE_OPTIONS = [
  { key: "p50", label: "P50" },
  { key: "p80", label: "P80" },
  { key: "p95", label: "P95" },
] as const;

export function SimulationConfigPanel({
  config,
  dataPointsUsed,
  onChange,
  onReset,
}: SimulationConfigPanelProps) {
  const [collapsed, setCollapsed] = useState(true);

  const handleSimulationsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseInt(e.target.value, 10);
      if (isNaN(raw)) return;
      const clamped = Math.max(1000, Math.min(100000, raw));
      onChange({ ...config, simulations: clamped });
    },
    [config, onChange],
  );

  const handleConfidenceToggle = useCallback(
    (key: string) => {
      const current = config.confidenceLevels;
      const isSelected = current.includes(key);
      if (isSelected && current.length <= 1) return; // prevent unchecking last
      const next = isSelected ? current.filter((l) => l !== key) : [...current, key];
      onChange({ ...config, confidenceLevels: next });
    },
    [config, onChange],
  );

  const handleWindowChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseInt(e.target.value, 10);
      if (isNaN(raw)) return;
      const clamped = Math.max(0, Math.min(365, raw));
      onChange({ ...config, throughputWindowDays: clamped });
    },
    [config, onChange],
  );

  const handleExcludeWeekendsToggle = useCallback(() => {
    onChange({ ...config, excludeWeekends: !config.excludeWeekends });
  }, [config, onChange]);

  const isDefault =
    config.simulations === DEFAULT_SIMULATION_CONFIG.simulations &&
    config.confidenceLevels.join(",") === DEFAULT_SIMULATION_CONFIG.confidenceLevels.join(",") &&
    config.throughputWindowDays === DEFAULT_SIMULATION_CONFIG.throughputWindowDays &&
    config.excludeWeekends === DEFAULT_SIMULATION_CONFIG.excludeWeekends;

  return (
    <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] transition-colors"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-controls="sim-config-body"
      >
        <span>
          Simulation Settings
          {!isDefault && (
            <span className="ml-2 text-[10px] text-[var(--color-status-warning, #eab308)]">
              (modified)
            </span>
          )}
        </span>
        <span className="text-[var(--color-text-muted)] text-xs">
          {collapsed ? "\u25B6" : "\u25BC"}
        </span>
      </button>

      {!collapsed && (
        <div id="sim-config-body" className="px-4 pb-4 pt-1 space-y-3">
          {/* Iteration count */}
          <div>
            <label
              htmlFor="sim-iterations"
              className="block text-[11px] text-[var(--color-text-muted)] mb-1"
            >
              Iterations (1,000 &ndash; 100,000)
            </label>
            <input
              id="sim-iterations"
              type="number"
              min={1000}
              max={100000}
              step={1000}
              value={config.simulations}
              onChange={handleSimulationsChange}
              className="w-32 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
            />
          </div>

          {/* Confidence levels */}
          <div>
            <span className="block text-[11px] text-[var(--color-text-muted)] mb-1">
              Confidence Levels
            </span>
            <div className="flex items-center gap-3">
              {CONFIDENCE_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-center gap-1 text-xs text-[var(--color-text-primary)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={config.confidenceLevels.includes(opt.key)}
                    onChange={() => handleConfidenceToggle(opt.key)}
                    disabled={
                      config.confidenceLevels.length === 1 &&
                      config.confidenceLevels.includes(opt.key)
                    }
                    className="rounded border-[var(--color-border-default)]"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Historical data window */}
          <div>
            <label
              htmlFor="sim-window"
              className="block text-[11px] text-[var(--color-text-muted)] mb-1"
            >
              Historical Data Window (0 = all available, max 365 days)
            </label>
            <input
              id="sim-window"
              type="number"
              min={0}
              max={365}
              step={7}
              value={config.throughputWindowDays}
              onChange={handleWindowChange}
              className="w-24 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-base)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
            />
            {dataPointsUsed !== undefined && (
              <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">
                {config.throughputWindowDays > 0
                  ? `Using ${dataPointsUsed} data points from last ${config.throughputWindowDays} days`
                  : `Using ${dataPointsUsed} data points (all available)`}
              </span>
            )}
          </div>

          {/* Exclude weekends */}
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={config.excludeWeekends}
              onChange={handleExcludeWeekendsToggle}
              className="rounded border-[var(--color-border-default)]"
            />
            Exclude weekends from forecast
          </label>

          {/* Reset */}
          {!isDefault && (
            <button
              onClick={onReset}
              className="text-[11px] text-[var(--color-status-error, #ef4444)] hover:underline"
            >
              Reset to Defaults
            </button>
          )}
        </div>
      )}
    </div>
  );
}
