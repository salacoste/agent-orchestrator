/**
 * Developer psychology & engagement (Stories 32.1-32.3).
 *
 * Flow state protection, celebration moments, streak tracking.
 */

// ---------------------------------------------------------------------------
// Story 32.1: Flow State Protector
// ---------------------------------------------------------------------------

/** Flow state detection based on activity patterns. */
export interface FlowState {
  inFlow: boolean;
  flowStartedAt: string | null;
  decisionCount: number;
  queuedNotifications: number;
}

/**
 * Detect if user is in flow state (rapid decisions, no pauses).
 */
export function detectFlowState(
  recentDecisionTimestamps: number[],
  windowMs: number = 300000, // 5 minutes
): boolean {
  const now = Date.now();
  const recent = recentDecisionTimestamps.filter((t) => now - t < windowMs);
  // Flow = 3+ decisions in the window with average gap < 60s
  if (recent.length < 3) return false;
  const gaps = recent.slice(1).map((t, i) => t - recent[i]);
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return avgGap < 60000; // Less than 60s between decisions
}

// ---------------------------------------------------------------------------
// Story 32.2: Celebration Moments
// ---------------------------------------------------------------------------

/** A celebration trigger. */
export interface CelebrationEvent {
  type: "story-merged" | "sprint-complete" | "zero-bugs" | "streak-milestone";
  title: string;
  message: string;
}

/** Check if an event deserves celebration. */
export function shouldCelebrate(event: {
  type: string;
  storiesDone?: number;
  storiesTotal?: number;
}): CelebrationEvent | null {
  if (event.type === "story.completed") {
    return {
      type: "story-merged",
      title: "Story Complete!",
      message:
        event.storiesDone && event.storiesTotal
          ? `${event.storiesDone}/${event.storiesTotal} stories done`
          : "Great work!",
    };
  }
  if (event.type === "sprint.complete") {
    return {
      type: "sprint-complete",
      title: "Sprint Complete!",
      message: "All stories delivered. Time for a retrospective.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Story 32.3: Streak Counter
// ---------------------------------------------------------------------------

/** Streak data. */
export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  isMilestone: boolean;
  milestoneMessage: string | null;
}

/**
 * Calculate streak from daily completion dates.
 */
export function calculateStreak(completionDates: string[]): StreakInfo {
  if (completionDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, isMilestone: false, milestoneMessage: null };
  }

  const sorted = [...completionDates].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;
  let checkDate = today;

  for (const date of sorted) {
    const d = date.slice(0, 10);
    if (d === checkDate) {
      streak++;
      // Go back one day
      const prev = new Date(checkDate);
      prev.setDate(prev.getDate() - 1);
      checkDate = prev.toISOString().slice(0, 10);
    } else if (d < checkDate) {
      break;
    }
  }

  const isMilestone = [5, 10, 25, 50, 100].includes(streak);
  const milestoneMessage = isMilestone ? `${streak}-day streak!` : null;

  return {
    currentStreak: streak,
    longestStreak: streak, // Would need history for true longest
    isMilestone,
    milestoneMessage,
  };
}
