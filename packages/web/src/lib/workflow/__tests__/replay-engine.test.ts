/**
 * Replay engine tests (Story 45.1).
 */
import { describe, expect, it } from "vitest";
import {
  computeDelay,
  getDelayForIndex,
  createReplayState,
  advanceReplay,
  seekReplay,
  setReplaySpeed,
  toggleReplayPlayback,
  type ReplayEvent,
} from "../replay-engine";

const EVENTS: ReplayEvent[] = [
  { timestamp: "2026-03-23T10:00:00Z", type: "story.started", description: "Started story" },
  { timestamp: "2026-03-23T10:00:05Z", type: "file.modified", description: "Modified index.ts" },
  { timestamp: "2026-03-23T10:00:30Z", type: "test.passed", description: "Tests passed" },
  { timestamp: "2026-03-23T10:05:00Z", type: "story.completed", description: "Story done" },
];

describe("computeDelay", () => {
  it("returns real-world time difference for short gaps", () => {
    const delay = computeDelay("2026-03-23T10:00:00Z", "2026-03-23T10:00:05Z");
    expect(delay).toBe(5000);
  });

  it("caps at MAX_DELAY_MS for long gaps", () => {
    const delay = computeDelay("2026-03-23T10:00:00Z", "2026-03-23T11:00:00Z");
    expect(delay).toBe(5000); // 1 hour capped to 5s
  });

  it("enforces MIN_DELAY_MS for very short gaps", () => {
    const delay = computeDelay("2026-03-23T10:00:00.000Z", "2026-03-23T10:00:00.050Z");
    expect(delay).toBe(100); // 50ms capped to 100ms minimum
  });

  it("handles equal timestamps", () => {
    const delay = computeDelay("2026-03-23T10:00:00Z", "2026-03-23T10:00:00Z");
    expect(delay).toBe(100); // MIN_DELAY_MS
  });
});

describe("getDelayForIndex", () => {
  it("returns 0 for first event", () => {
    expect(getDelayForIndex(EVENTS, 0, 1)).toBe(0);
  });

  it("returns computed delay at 1x speed", () => {
    const delay = getDelayForIndex(EVENTS, 1, 1);
    expect(delay).toBe(5000); // 5 seconds between events 0 and 1
  });

  it("halves delay at 2x speed", () => {
    const delay = getDelayForIndex(EVENTS, 1, 2);
    expect(delay).toBe(2500);
  });

  it("divides delay at 10x speed", () => {
    const delay = getDelayForIndex(EVENTS, 1, 10);
    expect(delay).toBe(500);
  });

  it("returns 0 for out-of-bounds index", () => {
    expect(getDelayForIndex(EVENTS, 99, 1)).toBe(0);
    expect(getDelayForIndex(EVENTS, -1, 1)).toBe(0);
  });
});

describe("createReplayState", () => {
  it("initializes with defaults", () => {
    const state = createReplayState(4);
    expect(state.currentIndex).toBe(0);
    expect(state.isPlaying).toBe(false);
    expect(state.speed).toBe(1);
    expect(state.progress).toBe(0);
    expect(state.totalEvents).toBe(4);
  });

  it("handles single event", () => {
    const state = createReplayState(1);
    expect(state.progress).toBe(1); // Already at end
  });

  it("handles zero events", () => {
    const state = createReplayState(0);
    expect(state.progress).toBe(1);
    expect(state.totalEvents).toBe(0);
  });
});

describe("advanceReplay", () => {
  it("advances to next event", () => {
    const state = createReplayState(4);
    const next = advanceReplay({ ...state, isPlaying: true });
    expect(next.currentIndex).toBe(1);
    expect(next.progress).toBeCloseTo(0.333, 2);
  });

  it("pauses at end of events", () => {
    const state = { ...createReplayState(4), currentIndex: 3, isPlaying: true };
    const next = advanceReplay(state);
    expect(next.currentIndex).toBe(3);
    expect(next.isPlaying).toBe(false);
    expect(next.progress).toBe(1);
  });

  it("sets progress to 1 at last event", () => {
    const state = { ...createReplayState(4), currentIndex: 2, isPlaying: true };
    const next = advanceReplay(state);
    expect(next.currentIndex).toBe(3);
    expect(next.progress).toBe(1);
  });
});

describe("seekReplay", () => {
  it("seeks to specified index", () => {
    const state = createReplayState(4);
    const seeked = seekReplay(state, 2);
    expect(seeked.currentIndex).toBe(2);
    expect(seeked.progress).toBeCloseTo(0.667, 2);
  });

  it("clamps to start", () => {
    const state = createReplayState(4);
    const seeked = seekReplay(state, -5);
    expect(seeked.currentIndex).toBe(0);
    expect(seeked.progress).toBe(0);
  });

  it("clamps to end", () => {
    const state = createReplayState(4);
    const seeked = seekReplay(state, 100);
    expect(seeked.currentIndex).toBe(3);
    expect(seeked.progress).toBe(1);
  });
});

describe("setReplaySpeed", () => {
  it("changes speed", () => {
    const state = createReplayState(4);
    expect(setReplaySpeed(state, 5).speed).toBe(5);
    expect(setReplaySpeed(state, 10).speed).toBe(10);
  });

  it("preserves other state", () => {
    const state = { ...createReplayState(4), currentIndex: 2, isPlaying: true };
    const updated = setReplaySpeed(state, 10);
    expect(updated.currentIndex).toBe(2);
    expect(updated.isPlaying).toBe(true);
  });
});

describe("toggleReplayPlayback", () => {
  it("starts playback when paused", () => {
    const state = createReplayState(4);
    const toggled = toggleReplayPlayback(state);
    expect(toggled.isPlaying).toBe(true);
  });

  it("pauses when playing", () => {
    const state = { ...createReplayState(4), isPlaying: true };
    const toggled = toggleReplayPlayback(state);
    expect(toggled.isPlaying).toBe(false);
  });

  it("restarts from beginning when at end", () => {
    const state = { ...createReplayState(4), currentIndex: 3, isPlaying: false };
    const toggled = toggleReplayPlayback(state);
    expect(toggled.isPlaying).toBe(true);
    expect(toggled.currentIndex).toBe(0);
    expect(toggled.progress).toBe(0);
  });
});
