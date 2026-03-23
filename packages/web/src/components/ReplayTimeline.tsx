"use client";

import { useEffect, useRef } from "react";
import { useReplay, type ReplayEvent, type ReplaySpeed } from "@/hooks/useReplay";

const SPEEDS: ReplaySpeed[] = [1, 2, 5, 10];

interface ReplayTimelineProps {
  events: ReplayEvent[];
}

/**
 * Replay timeline — animated event playback (Story 45.1).
 *
 * Shows chronological events with play/pause, speed, and scrub controls.
 */
export function ReplayTimeline({ events }: ReplayTimelineProps) {
  const replay = useReplay(events);
  const currentRef = useRef<HTMLLIElement>(null);

  // Auto-scroll current event into view
  useEffect(() => {
    currentRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [replay.currentIndex]);

  if (events.length === 0) {
    return (
      <div className="text-[11px] text-[var(--color-text-muted)] italic" data-testid="replay-empty">
        No events to replay.
      </div>
    );
  }

  return (
    <div data-testid="replay-timeline">
      {/* Event list */}
      <div
        className="overflow-auto max-h-[350px] border border-[var(--color-border-default)] rounded-[6px] bg-[var(--color-bg-surface)]"
        data-testid="replay-event-list"
      >
        <ol className="divide-y divide-[var(--color-border-default)]">
          {events.map((event, i) => {
            const isCurrent = i === replay.currentIndex;
            const isFuture = i > replay.currentIndex;
            return (
              <li
                key={`${event.timestamp}-${i}`}
                ref={isCurrent ? currentRef : undefined}
                role="button"
                tabIndex={0}
                className={`px-3 py-2 text-[11px] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                  isCurrent
                    ? "bg-[var(--color-accent)]/10 border-l-2 border-l-[var(--color-accent)]"
                    : isFuture
                      ? "opacity-50"
                      : ""
                }`}
                onClick={() => replay.seek(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    replay.seek(i);
                  }
                }}
                data-testid={`replay-event-${i}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)] font-mono text-[10px]">
                    {new Date(event.timestamp).toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{event.type}</span>
                </div>
                <p className="text-[var(--color-text-primary)] mt-0.5">{event.description}</p>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Playback controls */}
      <div className="mt-3 flex items-center gap-3 px-1" data-testid="replay-controls">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={replay.toggle}
          className="text-[12px] font-medium px-2 py-1 rounded-[4px] bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-surface)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          data-testid="replay-play-pause"
          aria-label={replay.isPlaying ? "Pause" : "Play"}
        >
          {replay.isPlaying ? "⏸" : "▶"}
        </button>

        {/* Speed selector */}
        <div className="flex items-center gap-1" data-testid="replay-speed-selector">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => replay.changeSpeed(s)}
              className={`text-[10px] px-1.5 py-0.5 rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                replay.speed === s
                  ? "bg-[var(--color-accent)] text-white font-medium"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
              data-testid={`replay-speed-${s}x`}
              aria-label={`${s}x speed`}
              aria-pressed={replay.speed === s}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Progress scrubber */}
        <input
          type="range"
          min={0}
          max={events.length - 1}
          value={replay.currentIndex}
          onChange={(e) => replay.seek(Number(e.target.value))}
          className="flex-1 h-1 accent-[var(--color-accent)]"
          data-testid="replay-scrubber"
          aria-label="Replay progress"
        />

        {/* Event counter */}
        <span
          className="text-[10px] text-[var(--color-text-muted)] tabular-nums"
          data-testid="replay-counter"
        >
          {replay.currentIndex + 1}/{events.length}
        </span>
      </div>
    </div>
  );
}
