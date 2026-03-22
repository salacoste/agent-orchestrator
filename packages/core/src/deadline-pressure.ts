/**
 * Deadline Pressure Detector — Pragmatic trade-offs (Story 43.8).
 *
 * Pure function that detects sprint deadline pressure and provides
 * adapted recommendations for completion-focused behavior.
 */

/** Pressure level: none, moderate, or critical. */
export type PressureLevel = "none" | "moderate" | "critical";

/** Deadline pressure detection result. */
export interface DeadlinePressure {
  /** Whether deadline pressure is detected. */
  isPressured: boolean;
  /** Current pressure level. */
  level: PressureLevel;
  /** Percentage of sprint time remaining (0-100). */
  timePercent: number;
  /** Percentage of stories completed (0-100). */
  completionPercent: number;
  /** Adapted recommendations for current pressure level. */
  recommendations: string[];
}

/** Configurable thresholds for deadline pressure detection. */
export interface PressureThresholds {
  /** Time remaining % below which moderate pressure triggers (default: 20). */
  moderateTimePercent?: number;
  /** Undone stories % above which moderate pressure triggers (default: 30). */
  moderateUndonePercent?: number;
  /** Time remaining % below which critical pressure triggers (default: 10). */
  criticalTimePercent?: number;
  /** Undone stories % above which critical pressure triggers (default: 50). */
  criticalUndonePercent?: number;
}

const DEFAULT_THRESHOLDS: Required<PressureThresholds> = {
  moderateTimePercent: 20,
  moderateUndonePercent: 30,
  criticalTimePercent: 10,
  criticalUndonePercent: 50,
};

/**
 * Detect deadline pressure from sprint time and story progress.
 *
 * @param timeRemainingMs — milliseconds remaining in sprint
 * @param totalTimeMs — total sprint duration in milliseconds
 * @param storiesDone — number of completed stories
 * @param storiesTotal — total number of stories in sprint
 * @param thresholds — optional custom thresholds
 */
export function detectDeadlinePressure(
  timeRemainingMs: number,
  totalTimeMs: number,
  storiesDone: number,
  storiesTotal: number,
  thresholds?: PressureThresholds,
): DeadlinePressure {
  const cfg = { ...DEFAULT_THRESHOLDS, ...thresholds };

  const timePercent = totalTimeMs > 0 ? Math.round((timeRemainingMs / totalTimeMs) * 100) : 0;
  const completionPercent = storiesTotal > 0 ? Math.round((storiesDone / storiesTotal) * 100) : 100;
  const undonePercent = 100 - completionPercent;

  // Determine pressure level
  let level: PressureLevel = "none";

  if (timePercent <= cfg.criticalTimePercent && undonePercent >= cfg.criticalUndonePercent) {
    level = "critical";
  } else if (timePercent <= cfg.moderateTimePercent && undonePercent >= cfg.moderateUndonePercent) {
    level = "moderate";
  }

  return {
    isPressured: level !== "none",
    level,
    timePercent,
    completionPercent,
    recommendations: getRecommendations(level),
  };
}

/** Get adapted recommendations for each pressure level. */
function getRecommendations(level: PressureLevel): string[] {
  switch (level) {
    case "critical":
      return [
        "Cut scope: identify and defer non-essential stories immediately",
        "Skip optional code reviews — ship with post-merge review",
        "Maximize parallelism: raise WIP limit to available agent count",
        "Cancel investigation spikes and stretch stories",
        "Focus all agents on critical-path stories only",
      ];
    case "moderate":
      return [
        "Consider deferring stretch stories to next sprint",
        "Parallelize more aggressively where safe",
        "Streamline reviews: focus on critical paths only",
        "Assess scope: are all remaining stories essential?",
      ];
    case "none":
      return [];
  }
}
