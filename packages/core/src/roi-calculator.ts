/**
 * ROI Calculator — agent value proof (Story 45.4).
 *
 * Pure function. Computes return on investment from session data
 * with configurable rates and transparent breakdown.
 */

/** Configurable rates for ROI calculation. */
export interface ROIConfig {
  /** Estimated human-hours per story (default: 4). */
  hoursPerStory: number;
  /** Developer hourly rate in USD (default: 75). */
  hourlyRate: number;
  /** Price per 1M tokens in USD (default: 15 — Claude Sonnet approximate). */
  pricePerMillionTokens: number;
}

/** ROI calculation result. */
export interface ROIReport {
  storiesCompleted: number;
  totalTokens: number;
  totalCostUsd: number;
  humanHoursSaved: number;
  humanCostEquivalent: number;
  costPerStory: number;
  efficiencyRatio: number;
  breakdown: string;
}

/** Default rates. */
export const DEFAULT_ROI_CONFIG: ROIConfig = {
  hoursPerStory: 4,
  hourlyRate: 75,
  pricePerMillionTokens: 15,
};

/**
 * Calculate ROI from agent session data.
 *
 * Pure function — no I/O, no side effects.
 */
export function calculateROI(
  storiesCompleted: number,
  totalTokens: number,
  config: Partial<ROIConfig> = {},
): ROIReport {
  const rates: ROIConfig = { ...DEFAULT_ROI_CONFIG, ...config };

  if (storiesCompleted === 0 || totalTokens === 0) {
    return {
      storiesCompleted,
      totalTokens,
      totalCostUsd: 0,
      humanHoursSaved: 0,
      humanCostEquivalent: 0,
      costPerStory: 0,
      efficiencyRatio: 0,
      breakdown: "No completed stories or token data available.",
    };
  }

  const totalCostUsd = (totalTokens * rates.pricePerMillionTokens) / 1_000_000;
  const humanHoursSaved = storiesCompleted * rates.hoursPerStory;
  const humanCostEquivalent = humanHoursSaved * rates.hourlyRate;
  const costPerStory = totalCostUsd / storiesCompleted;
  const efficiencyRatio = totalCostUsd > 0 ? humanCostEquivalent / totalCostUsd : 0;

  // Round all USD values consistently
  const roundedCost = Math.round(totalCostUsd * 100) / 100;
  const roundedHumanCost = Math.round(humanCostEquivalent * 100) / 100;
  const roundedCostPerStory = Math.round(costPerStory * 100) / 100;
  const roundedRatio = Math.round(efficiencyRatio * 10) / 10;

  const tokenK = Math.round(totalTokens / 1000);
  const pctOfHuman = roundedCost > 0 ? ((roundedCost / roundedHumanCost) * 100).toFixed(1) : "0";

  const breakdown = [
    `${storiesCompleted} stories completed.`,
    `Agent cost: $${roundedCost.toFixed(2)} (${tokenK}K tokens × $${rates.pricePerMillionTokens}/1M).`,
    `Human equivalent: $${roundedHumanCost.toLocaleString("en-US")} (${storiesCompleted} stories × ${rates.hoursPerStory}h × $${rates.hourlyRate}/h).`,
    `ROI: ${Math.round(roundedRatio)}x efficiency — agents cost ${pctOfHuman}% of human equivalent.`,
  ].join(" ");

  return {
    storiesCompleted,
    totalTokens,
    totalCostUsd: roundedCost,
    humanHoursSaved,
    humanCostEquivalent: roundedHumanCost,
    costPerStory: roundedCostPerStory,
    efficiencyRatio: roundedRatio,
    breakdown,
  };
}
