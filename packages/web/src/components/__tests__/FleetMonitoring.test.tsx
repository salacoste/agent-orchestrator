import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import FleetPage from "@/app/fleet/page";

// Mock fetch
global.fetch = vi.fn();

// Mock SSE hooks
vi.mock("@/hooks/useSSEConnection.js", () => ({
  useSSEConnection: vi.fn(() => ({ connected: true, reconnecting: false })),
}));

vi.mock("@/hooks/useFlashAnimation.js", () => ({
  useFlashAnimation: vi.fn(() => false),
}));

describe("FleetMonitoring", () => {
  const mockAgents = [
    {
      id: "ao-test-001",
      projectId: "test-project",
      status: "running",
      activity: "working",
      branch: "main",
      issueId: "https://github.com/test/repo/issues/1",
      issueLabel: "STORY-001",
      issueTitle: "Test Story",
      summary: "Implementing feature",
      createdAt: "2026-03-08T00:00:00Z",
      lastActivityAt: "2026-03-08T00:05:00Z",
      metadata: { storyId: "1-1-test-story" },
    },
    {
      id: "ao-test-002",
      projectId: "test-project",
      status: "idle",
      activity: "idle",
      branch: "main",
      issueId: "https://github.com/test/repo/issues/2",
      issueLabel: "STORY-002",
      issueTitle: "Another Story",
      summary: "Waiting for work",
      createdAt: "2026-03-08T00:00:00Z",
      lastActivityAt: "2026-03-08T00:02:00Z",
      metadata: { storyId: "1-2-another-story" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          sessions: mockAgents,
          stats: { total: 2, active: 1, idle: 1, blocked: 0 },
        }),
      }),
    ) as unknown as typeof fetch;
  });

  it("renders loading state initially", () => {
    render(<FleetPage />);
    expect(screen.getByText(/Loading fleet status/i)).toBeInTheDocument();
  });

  it("renders 3-column grid layout with agents", async () => {
    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading fleet status/i)).not.toBeInTheDocument();
    });

    // Check column headers
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Idle")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  it("displays active agent in Active column", async () => {
    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading fleet status/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText("STORY-001")).toBeInTheDocument();
    expect(screen.getByText("Test Story")).toBeInTheDocument();
  });

  it("displays idle agent in Idle column", async () => {
    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading fleet status/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText("STORY-002")).toBeInTheDocument();
    expect(screen.getByText("Another Story")).toBeInTheDocument();
  });

  it("shows empty state when no agents", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ sessions: [], stats: { total: 0, active: 0, idle: 0, blocked: 0 } }),
      }),
    ) as unknown as typeof fetch;

    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.getByText(/No active agents/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Spawn agents with/i)).toBeInTheDocument();
  });

  it("renders error state on fetch failure", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
      }),
    ) as unknown as typeof fetch;

    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load fleet status/i)).toBeInTheDocument();
    });
  });

  it("opens agent detail drawer when agent card is clicked", async () => {
    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading fleet status/i)).not.toBeInTheDocument();
    });

    // Click on first agent card
    const agentCard = screen.getByText("Test Story").closest("div[class*='cursor-pointer']");
    if (agentCard) fireEvent.click(agentCard);

    // Drawer should be visible
    await waitFor(() => {
      expect(screen.getByText("Agent Details")).toBeInTheDocument();
    });
  });

  it("opens resume modal when resume button is clicked", async () => {
    const blockedAgent = {
      ...mockAgents[0],
      activity: "blocked",
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          sessions: [blockedAgent],
          stats: { total: 1, active: 0, idle: 0, blocked: 1 },
        }),
      }),
    ) as unknown as typeof fetch;

    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading fleet status/i)).not.toBeInTheDocument();
    });

    // Click resume button
    const resumeButton = screen.getByText("Resume");
    fireEvent.click(resumeButton);

    // Modal should be visible
    await waitFor(() => {
      expect(screen.getByText("Resume Agent")).toBeInTheDocument();
    });
  });
});
