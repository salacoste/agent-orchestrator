/**
 * SessionStatePanel component tests (Story 60.8).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SessionState } from "@composio/ao-core";

const mockUseSessionStateSSE = vi.fn();

vi.mock("@/hooks/useSessionStateSSE", () => ({
  useSessionStateSSE: (...args: unknown[]) => mockUseSessionStateSSE(...args),
}));

import { SessionStatePanel } from "../SessionStatePanel";

const DEFAULT_STATE: SessionState = {
  executionMode: "standard",
  activeAgents: ["omc"],
  configured: true,
  activeModes: [],
  health: null,
};

describe("SessionStatePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders execution mode badge", () => {
    mockUseSessionStateSSE.mockReturnValue({
      state: DEFAULT_STATE,
      exists: true,
      connected: true,
    });

    render(<SessionStatePanel sessionId="session-1" />);

    expect(mockUseSessionStateSSE).toHaveBeenCalledWith("session-1");
    expect(screen.getByTestId("session-state-panel")).toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
  });

  it("renders capitalized autopilot mode", () => {
    mockUseSessionStateSSE.mockReturnValue({
      state: { ...DEFAULT_STATE, executionMode: "autopilot" },
      exists: true,
      connected: true,
    });

    render(<SessionStatePanel sessionId="session-1" />);

    expect(screen.getByText("Autopilot")).toBeInTheDocument();
  });

  it("renders active agents list", () => {
    mockUseSessionStateSSE.mockReturnValue({
      state: { ...DEFAULT_STATE, activeAgents: ["omc", "explore"] },
      exists: true,
      connected: true,
    });

    render(<SessionStatePanel sessionId="session-1" />);

    expect(screen.getByText("omc")).toBeInTheDocument();
    expect(screen.getByText("explore")).toBeInTheDocument();
  });

  it("renders No agents when agent list is empty", () => {
    mockUseSessionStateSSE.mockReturnValue({
      state: { ...DEFAULT_STATE, activeAgents: [] },
      exists: true,
      connected: true,
    });

    render(<SessionStatePanel sessionId="session-1" />);

    expect(screen.getByText("No agents")).toBeInTheDocument();
  });

  it("renders Configured indicator", () => {
    mockUseSessionStateSSE.mockReturnValue({
      state: DEFAULT_STATE,
      exists: true,
      connected: true,
    });

    render(<SessionStatePanel sessionId="session-1" />);

    expect(screen.getByText("Configured")).toBeInTheDocument();
  });

  it("renders Not Configured indicator", () => {
    mockUseSessionStateSSE.mockReturnValue({
      state: { ...DEFAULT_STATE, configured: false },
      exists: true,
      connected: true,
    });

    render(<SessionStatePanel sessionId="session-1" />);

    expect(screen.getByText("Not Configured")).toBeInTheDocument();
  });

  it("renders progress bar for active modes with iteration data", () => {
    mockUseSessionStateSSE.mockReturnValue({
      state: {
        ...DEFAULT_STATE,
        activeModes: [
          {
            mode: "autopilot",
            active: true,
            iteration: 3,
            maxIterations: 10,
            phase: "executing",
            tasksCompleted: 5,
            tasksTotal: 15,
          },
        ],
      },
      exists: true,
      connected: true,
    });

    render(<SessionStatePanel sessionId="session-1" />);

    expect(screen.getByText("Autopilot")).toBeInTheDocument();
    expect(screen.getByText("executing")).toBeInTheDocument();
    expect(screen.getByText("5/15 tasks")).toBeInTheDocument();
    // Progress bar exists (div with width style)
    const panel = screen.getByTestId("session-state-panel");
    const progressBar = panel.querySelector('div[style*="width: 30%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it("renders progress bar at 0% when iteration is 0", () => {
    mockUseSessionStateSSE.mockReturnValue({
      state: {
        ...DEFAULT_STATE,
        activeModes: [{ mode: "ralph", active: true, iteration: 0, maxIterations: 5 }],
      },
      exists: true,
      connected: true,
    });

    render(<SessionStatePanel sessionId="session-1" />);

    const panel = screen.getByTestId("session-state-panel");
    const progressBar = panel.querySelector('div[style*="width: 0%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it("renders health unavailable message when health is null", () => {
    mockUseSessionStateSSE.mockReturnValue({
      state: DEFAULT_STATE,
      exists: true,
      connected: true,
    });

    render(<SessionStatePanel sessionId="session-1" />);

    expect(screen.getByText("Health check not available")).toBeInTheDocument();
  });

  it("renders healthy indicator when health.healthy is true", () => {
    mockUseSessionStateSSE.mockReturnValue({
      state: {
        ...DEFAULT_STATE,
        health: { healthy: true, lastCheck: "2026-04-17T12:00:00Z" },
      },
      exists: true,
      connected: true,
    });

    render(<SessionStatePanel sessionId="session-1" />);

    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });

  it("renders unhealthy indicator with message when health.healthy is false", () => {
    mockUseSessionStateSSE.mockReturnValue({
      state: {
        ...DEFAULT_STATE,
        health: { healthy: false, message: "Provider disconnected", lastCheck: null },
      },
      exists: true,
      connected: true,
    });

    render(<SessionStatePanel sessionId="session-1" />);

    expect(screen.getByText("Provider disconnected")).toBeInTheDocument();
  });

  it("handles empty state (exists: false)", () => {
    mockUseSessionStateSSE.mockReturnValue({
      state: null,
      exists: false,
      connected: false,
    });

    render(<SessionStatePanel sessionId="session-1" />);

    expect(screen.getByText("No session state available yet")).toBeInTheDocument();
  });

  it("shows loading state when exists is true but state is null", () => {
    mockUseSessionStateSSE.mockReturnValue({
      state: null,
      exists: true,
      connected: false,
    });

    render(<SessionStatePanel sessionId="session-1" />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders Session State heading with correct aria", () => {
    mockUseSessionStateSSE.mockReturnValue({
      state: DEFAULT_STATE,
      exists: true,
      connected: true,
    });

    render(<SessionStatePanel sessionId="session-1" />);

    const panel = screen.getByTestId("session-state-panel");
    expect(panel).toHaveAttribute("role", "region");
    expect(panel).toHaveAttribute("aria-labelledby", "session-state-heading");
    expect(screen.getByText("Session State")).toBeInTheDocument();
  });
});
