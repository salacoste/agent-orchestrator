"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createReplayState,
  advanceReplay,
  seekReplay,
  setReplaySpeed,
  toggleReplayPlayback,
  getDelayForIndex,
  type ReplayEvent,
  type ReplayState,
  type ReplaySpeed,
} from "@/lib/workflow/replay-engine";

export type { ReplayEvent, ReplayState, ReplaySpeed };

/**
 * React hook for replay playback (Story 45.1).
 *
 * Wraps the pure replay engine in React state with auto-advance timer.
 */
export function useReplay(events: ReplayEvent[]) {
  const [state, setState] = useState<ReplayState>(() => createReplayState(events.length));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when events change
  useEffect(() => {
    setState(createReplayState(events.length));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [events.length]);

  // Auto-advance timer
  useEffect(() => {
    if (!state.isPlaying || events.length === 0) return;

    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= events.length) {
      // At end — advance one more time to trigger pause
      setState((s) => advanceReplay(s));
      return;
    }

    const delay = getDelayForIndex(events, nextIndex, state.speed);
    timerRef.current = setTimeout(() => {
      setState((s) => (s.isPlaying ? advanceReplay(s) : s));
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.isPlaying, state.currentIndex, state.speed, events]);

  const play = useCallback(() => {
    setState((s) => (s.isPlaying ? s : toggleReplayPlayback(s)));
  }, []);

  const pause = useCallback(() => {
    setState((s) => (s.isPlaying ? toggleReplayPlayback(s) : s));
  }, []);

  const toggle = useCallback(() => {
    setState((s) => toggleReplayPlayback(s));
  }, []);

  const seek = useCallback((index: number) => {
    setState((s) => seekReplay(s, index));
  }, []);

  const changeSpeed = useCallback((speed: ReplaySpeed) => {
    setState((s) => setReplaySpeed(s, speed));
  }, []);

  const reset = useCallback(() => {
    setState(createReplayState(events.length));
  }, [events.length]);

  return {
    ...state,
    currentEvent: events[state.currentIndex] ?? null,
    events,
    play,
    pause,
    toggle,
    seek,
    changeSpeed,
    reset,
  };
}
