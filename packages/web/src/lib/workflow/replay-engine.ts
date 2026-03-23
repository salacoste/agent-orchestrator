/**
 * Replay engine — pure logic for session time-lapse (Story 45.1).
 *
 * No React, no DOM. Manages playback state for an event sequence.
 */

/** Activity event shape (from activity API). */
export interface ReplayEvent {
  timestamp: string;
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/** Playback speed multiplier. */
export type ReplaySpeed = 1 | 2 | 5 | 10;

/** Replay engine state. */
export interface ReplayState {
  currentIndex: number;
  isPlaying: boolean;
  speed: ReplaySpeed;
  /** Progress 0-1. */
  progress: number;
  totalEvents: number;
}

/** Maximum inter-event delay (ms) — caps long real-world gaps. */
const MAX_DELAY_MS = 5000;
/** Minimum visible delay (ms). */
const MIN_DELAY_MS = 100;

/**
 * Compute playback delay between two consecutive events.
 * Caps at MAX_DELAY_MS to prevent long pauses from real-world gaps.
 */
export function computeDelay(prevTimestamp: string, currTimestamp: string): number {
  const diff = new Date(currTimestamp).getTime() - new Date(prevTimestamp).getTime();
  return Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, Math.abs(diff)));
}

/**
 * Get the delay before advancing to the given index, adjusted for speed.
 * Returns 0 for the first event.
 */
export function getDelayForIndex(events: ReplayEvent[], index: number, speed: ReplaySpeed): number {
  if (index <= 0 || index >= events.length) return 0;
  return Math.round(computeDelay(events[index - 1].timestamp, events[index].timestamp) / speed);
}

/**
 * Create initial replay state.
 */
export function createReplayState(eventCount: number): ReplayState {
  return {
    currentIndex: 0,
    isPlaying: false,
    speed: 1,
    progress: eventCount > 1 ? 0 : 1,
    totalEvents: eventCount,
  };
}

/**
 * Advance to next event. Returns new state.
 * If at end, pauses automatically.
 */
export function advanceReplay(state: ReplayState): ReplayState {
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.totalEvents) {
    return {
      ...state,
      currentIndex: state.totalEvents - 1,
      isPlaying: false,
      progress: 1,
    };
  }
  return {
    ...state,
    currentIndex: nextIndex,
    progress: state.totalEvents > 1 ? nextIndex / (state.totalEvents - 1) : 1,
  };
}

/**
 * Seek to a specific event index.
 */
export function seekReplay(state: ReplayState, index: number): ReplayState {
  const clamped = Math.max(0, Math.min(index, state.totalEvents - 1));
  return {
    ...state,
    currentIndex: clamped,
    progress: state.totalEvents > 1 ? clamped / (state.totalEvents - 1) : 1,
  };
}

/**
 * Set playback speed.
 */
export function setReplaySpeed(state: ReplayState, speed: ReplaySpeed): ReplayState {
  return { ...state, speed };
}

/**
 * Toggle play/pause.
 */
export function toggleReplayPlayback(state: ReplayState): ReplayState {
  // If at end and pressing play, restart from beginning
  if (!state.isPlaying && state.currentIndex >= state.totalEvents - 1) {
    return { ...state, currentIndex: 0, isPlaying: true, progress: 0 };
  }
  return { ...state, isPlaying: !state.isPlaying };
}
