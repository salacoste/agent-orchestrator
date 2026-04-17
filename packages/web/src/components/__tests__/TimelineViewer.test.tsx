import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { TimelineEntry } from "@composio/ao-core";
import { TimelineViewer } from "../TimelineViewer";

// Mock useTimelineSSE hook
const mockUseTimelineSSE = vi.fn();
vi.mock("@/hooks/useTimelineSSE", () => ({
  useTimelineSSE: (...args: unknown[]) => mockUseTimelineSSE(...args),
}));

const SAMPLE_ENTRIES: TimelineEntry[] = [
  {
    agent: "planner",
    agentType: "planner",
    action: "Agent planner started",
    event: "agent_start",
    timestamp: 1.0,
    model: "claude-sonnet-4-6",
  },
  {
    agent: "planner",
    agentType: "planner",
    action: "Called Read",
    event: "tool_start",
    timestamp: 5.0,
    tool: "Read",
  },
  {
    agent: "executor",
    agentType: "executor",
    action: "Finished Edit",
    event: "tool_end",
    timestamp: 15.0,
    tool: "Edit",
    duration: 2340,
    success: true,
  },
  {
    agent: "executor",
    agentType: "executor",
    action: "Modified src/main.ts",
    event: "file_touch",
    timestamp: 20.0,
    file: "src/main.ts",
  },
];

describe("TimelineViewer", () => {
  beforeEach(() => {
    mockUseTimelineSSE.mockReturnValue({
      timeline: [],
      connected: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Shows empty state when no data
  it("shows empty state when no data", () => {
    mockUseTimelineSSE.mockReturnValue({
      timeline: [],
      connected: false,
    });

    render(<TimelineViewer sessionId="session-1" />);

    expect(screen.getByText("No timeline data yet.")).toBeInTheDocument();
  });

  // Renders timeline entries when data is available
  it("renders timeline entries when data is available", () => {
    mockUseTimelineSSE.mockReturnValue({
      timeline: SAMPLE_ENTRIES,
      connected: true,
    });

    render(<TimelineViewer sessionId="session-1" />);

    expect(screen.getByText("Agent planner started")).toBeInTheDocument();
    expect(screen.getByText("Called Read")).toBeInTheDocument();
    expect(screen.getByText("Finished Edit")).toBeInTheDocument();
    expect(screen.getByText("Modified src/main.ts")).toBeInTheDocument();
  });

  // Shows connection indicator
  it("shows connection indicator when connected", () => {
    mockUseTimelineSSE.mockReturnValue({
      timeline: SAMPLE_ENTRIES,
      connected: true,
    });

    render(<TimelineViewer sessionId="session-1" />);

    expect(screen.getByText("Agent Timeline")).toBeInTheDocument();
    // The ActivityDot is rendered (connected state)
    const header = screen.getByText("Agent Timeline").parentElement!;
    const dot = header.querySelector("div");
    expect(dot).toBeInTheDocument();
  });

  // Shows connection indicator when disconnected
  it("shows connection indicator when disconnected", () => {
    mockUseTimelineSSE.mockReturnValue({
      timeline: SAMPLE_ENTRIES,
      connected: false,
    });

    render(<TimelineViewer sessionId="session-1" />);

    expect(screen.getByText("Agent Timeline")).toBeInTheDocument();
    const header = screen.getByText("Agent Timeline").parentElement!;
    const dot = header.querySelector("div");
    expect(dot).toBeInTheDocument();
    // Idle dot uses var(--color-status-idle) — distinct from active var(--color-status-working)
    expect(dot).toHaveStyle({ background: "var(--color-status-idle)" });
  });

  // Passes sessionId to hook
  it("passes sessionId to useTimelineSSE", () => {
    render(<TimelineViewer sessionId="test-session-42" />);

    expect(mockUseTimelineSSE).toHaveBeenCalledWith("test-session-42");
  });

  // Agent filter narrows displayed entries
  it("agent filter narrows displayed entries", () => {
    mockUseTimelineSSE.mockReturnValue({
      timeline: SAMPLE_ENTRIES,
      connected: true,
    });

    render(<TimelineViewer sessionId="session-1" />);

    // All entries visible initially
    expect(screen.getByText("Agent planner started")).toBeInTheDocument();
    expect(screen.getByText("Modified src/main.ts")).toBeInTheDocument();

    // Filter by "planner"
    const input = screen.getByPlaceholderText("Filter by agent name...");
    fireEvent.change(input, { target: { value: "planner" } });

    // Only planner entries remain
    expect(screen.getByText("Agent planner started")).toBeInTheDocument();
    expect(screen.getByText("Called Read")).toBeInTheDocument();
    expect(screen.queryByText("Modified src/main.ts")).not.toBeInTheDocument();

    // Shows filter count
    expect(screen.getByText("2 of 4")).toBeInTheDocument();
  });

  // Agent filter is case-insensitive
  it("agent filter is case-insensitive", () => {
    mockUseTimelineSSE.mockReturnValue({
      timeline: SAMPLE_ENTRIES,
      connected: true,
    });

    render(<TimelineViewer sessionId="session-1" />);

    const input = screen.getByPlaceholderText("Filter by agent name...");
    fireEvent.change(input, { target: { value: "EXECUTOR" } });

    expect(screen.queryByText("Agent planner started")).not.toBeInTheDocument();
    expect(screen.getByText("Modified src/main.ts")).toBeInTheDocument();
  });

  // Displays tool info
  it("displays tool info in entries", () => {
    mockUseTimelineSSE.mockReturnValue({
      timeline: SAMPLE_ENTRIES,
      connected: true,
    });

    render(<TimelineViewer sessionId="session-1" />);

    // Tool names appear in action text
    expect(screen.getByText("Called Read")).toBeInTheDocument();
    expect(screen.getByText("Finished Edit")).toBeInTheDocument();
  });

  // Displays duration badge
  it("displays duration badge", () => {
    mockUseTimelineSSE.mockReturnValue({
      timeline: SAMPLE_ENTRIES,
      connected: true,
    });

    render(<TimelineViewer sessionId="session-1" />);

    expect(screen.getByText("2.3s")).toBeInTheDocument();
  });

  // Displays success indicator
  it("displays success indicator", () => {
    mockUseTimelineSSE.mockReturnValue({
      timeline: SAMPLE_ENTRIES,
      connected: true,
    });

    render(<TimelineViewer sessionId="session-1" />);

    // The success indicator "✓" should appear
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  // Displays file path
  it("displays file path in entries", () => {
    mockUseTimelineSSE.mockReturnValue({
      timeline: SAMPLE_ENTRIES,
      connected: true,
    });

    render(<TimelineViewer sessionId="session-1" />);

    // The file_touch entry has file: "src/main.ts"
    expect(screen.getByText("src/main.ts")).toBeInTheDocument();
  });

  // Displays agentType badge
  it("displays agentType badge", () => {
    mockUseTimelineSSE.mockReturnValue({
      timeline: SAMPLE_ENTRIES,
      connected: true,
    });

    render(<TimelineViewer sessionId="session-1" />);

    // "planner" appears as agent name (2 entries) and agentType badge (2 entries)
    const plannerElements = screen.getAllByText("planner");
    expect(plannerElements.length).toBeGreaterThanOrEqual(4);
    // "executor" appears as agent name (2 entries) and agentType badge (2 entries)
    const executorElements = screen.getAllByText("executor");
    expect(executorElements.length).toBeGreaterThanOrEqual(4);
  });

  // Displays formatted timestamps
  it("displays formatted timestamps", () => {
    mockUseTimelineSSE.mockReturnValue({
      timeline: SAMPLE_ENTRIES,
      connected: true,
    });

    render(<TimelineViewer sessionId="session-1" />);

    expect(screen.getByText("00:01")).toBeInTheDocument(); // 1.0s → 00:01
    expect(screen.getByText("00:05")).toBeInTheDocument(); // 5.0s → 00:05
    expect(screen.getByText("00:20")).toBeInTheDocument(); // 20.0s → 00:20
  });

  // Renders "Agent Timeline" header
  it("renders Agent Timeline header", () => {
    mockUseTimelineSSE.mockReturnValue({
      timeline: SAMPLE_ENTRIES,
      connected: true,
    });

    render(<TimelineViewer sessionId="session-1" />);

    expect(screen.getByText("Agent Timeline")).toBeInTheDocument();
  });
});
