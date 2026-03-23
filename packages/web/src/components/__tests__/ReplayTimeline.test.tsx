/**
 * ReplayTimeline component tests (Story 45.1).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ReplayTimeline } from "../ReplayTimeline";
import type { ReplayEvent } from "@/hooks/useReplay";

const EVENTS: ReplayEvent[] = [
  { timestamp: "2026-03-23T10:00:00Z", type: "story.started", description: "Started story" },
  { timestamp: "2026-03-23T10:00:05Z", type: "file.modified", description: "Modified index.ts" },
  { timestamp: "2026-03-23T10:00:30Z", type: "test.passed", description: "Tests passed" },
  { timestamp: "2026-03-23T10:05:00Z", type: "story.completed", description: "Story done" },
];

describe("ReplayTimeline", () => {
  it("renders all events", () => {
    render(<ReplayTimeline events={EVENTS} />);

    expect(screen.getByTestId("replay-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("replay-event-0")).toBeInTheDocument();
    expect(screen.getByTestId("replay-event-3")).toBeInTheDocument();
    expect(screen.getByText("Started story")).toBeInTheDocument();
    expect(screen.getByText("Story done")).toBeInTheDocument();
  });

  it("shows empty state for no events", () => {
    render(<ReplayTimeline events={[]} />);

    expect(screen.getByTestId("replay-empty")).toBeInTheDocument();
    expect(screen.getByText("No events to replay.")).toBeInTheDocument();
  });

  it("renders playback controls", () => {
    render(<ReplayTimeline events={EVENTS} />);

    expect(screen.getByTestId("replay-controls")).toBeInTheDocument();
    expect(screen.getByTestId("replay-play-pause")).toBeInTheDocument();
    expect(screen.getByTestId("replay-speed-selector")).toBeInTheDocument();
    expect(screen.getByTestId("replay-scrubber")).toBeInTheDocument();
    expect(screen.getByTestId("replay-counter")).toHaveTextContent("1/4");
  });

  it("shows all speed options", () => {
    render(<ReplayTimeline events={EVENTS} />);

    expect(screen.getByTestId("replay-speed-1x")).toBeInTheDocument();
    expect(screen.getByTestId("replay-speed-2x")).toBeInTheDocument();
    expect(screen.getByTestId("replay-speed-5x")).toBeInTheDocument();
    expect(screen.getByTestId("replay-speed-10x")).toBeInTheDocument();
  });

  it("seeking via scrubber updates counter", () => {
    render(<ReplayTimeline events={EVENTS} />);

    const scrubber = screen.getByTestId("replay-scrubber") as HTMLInputElement;
    fireEvent.change(scrubber, { target: { value: "2" } });

    expect(screen.getByTestId("replay-counter")).toHaveTextContent("3/4");
  });

  it("clicking an event seeks to it", () => {
    render(<ReplayTimeline events={EVENTS} />);

    fireEvent.click(screen.getByTestId("replay-event-2"));

    expect(screen.getByTestId("replay-counter")).toHaveTextContent("3/4");
  });

  it("speed button changes active state", () => {
    render(<ReplayTimeline events={EVENTS} />);

    const speed5 = screen.getByTestId("replay-speed-5x");
    fireEvent.click(speed5);

    expect(speed5.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("replay-speed-1x").getAttribute("aria-pressed")).toBe("false");
  });

  it("play/pause button toggles", () => {
    vi.useFakeTimers();
    render(<ReplayTimeline events={EVENTS} />);

    const btn = screen.getByTestId("replay-play-pause");
    expect(btn).toHaveTextContent("▶");

    act(() => {
      fireEvent.click(btn);
    });

    expect(btn).toHaveTextContent("⏸");

    act(() => {
      fireEvent.click(btn);
    });

    expect(btn).toHaveTextContent("▶");
    vi.useRealTimers();
  });

  it("displays event type and timestamp", () => {
    render(<ReplayTimeline events={EVENTS} />);

    const firstEvent = screen.getByTestId("replay-event-0");
    expect(firstEvent).toHaveTextContent("story.started");
    expect(firstEvent).toHaveTextContent("Started story");
  });
});
