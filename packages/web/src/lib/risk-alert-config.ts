/**
 * Shared risk alert configuration state.
 * Split from route.ts because Next.js only allows HTTP method exports from route files.
 */

import { type RiskAlertConfig, DEFAULT_RISK_ALERT_CONFIG } from "@/lib/risk-alert-types";

/** In-memory config singleton — initialized from defaults. */
let currentConfig: RiskAlertConfig = { ...DEFAULT_RISK_ALERT_CONFIG };

/** Get the current runtime alert config. Shared across modules. */
export function getAlertConfig(): RiskAlertConfig {
  return currentConfig;
}

/** Update the config (used by PUT handler). */
export function updateAlertConfig(partial: Partial<RiskAlertConfig>): RiskAlertConfig {
  currentConfig = {
    enabled: partial.enabled ?? currentConfig.enabled,
    defaultThresholds: partial.defaultThresholds ?? currentConfig.defaultThresholds,
    projectOverrides: partial.projectOverrides ?? currentConfig.projectOverrides,
  };
  return currentConfig;
}

/** @internal test-only helper to reset config to defaults */
export function _resetAlertConfig(): void {
  currentConfig = { ...DEFAULT_RISK_ALERT_CONFIG };
}
