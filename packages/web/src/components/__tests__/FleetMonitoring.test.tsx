import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import FleetPage from "@/app/fleet/page";

// Mock fetch
global.fetch = vi.fn();

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

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
      status: "working",
      activity: "active",
      branch: "feat/test",
      issueId: null,
      issueUrl: null,
      issueLabel: "#42",
      issueTitle: "Test Story",
      summary: "Working on test",
      summaryIsFallback: false,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      lastActivityAt: new Date(Date.now() - 60000).toISOString(),
      pr: null,
      metadata: {},
    },
    {
      id: "ao-test-002",
      projectId: "test-project",
      status: "working",
      activity: "idle",
      branch: "feat/idle",
      issueId: null,
      issueUrl: null,
      issueLabel: "#43",
      issueTitle: "Idle Story",
      summary: null,
      summaryIsFallback: false,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      lastActivityAt: new Date(Date.now() - 900000).toISOString(),
      pr: null,
      metadata: {},
    },
    {
      id: "ao-test-003",
      projectId: "test-project",
      status: "working",
      activity: "blocked",
      branch: "feat/blocked",
      issueId: null,
      issueUrl: null,
      issueLabel: "#44",
      issueTitle: "Blocked Story",
      summary: "Agent stuck",
      summaryIsFallback: false,
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      lastActivityAt: new Date(Date.now() - 300000).toISOString(),
      pr: null,
      metadata: {},
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  it("renders loading state initially", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<FleetPage />);
    expect(screen.getByText("Loading fleet status...")).toBeDefined();
  });

  it("renders Fleet Monitoring heading after load", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        sessions: mockAgents,
        stats: { total: 3, active: 1, idle: 1, blocked: 1 },
      }),
    });

    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.getByText("Fleet Monitoring")).toBeDefined();
    });
  });

  it("renders FleetMatrix table with agent rows", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        sessions: mockAgents,
        stats: { total: 3, active: 1, idle: 1, blocked: 1 },
      }),
    });

    render(<FleetPage />);

    await waitFor(() => {
      // Table headers
      expect(screen.getByText("Agent")).toBeDefined();
      expect(screen.getByText("Story")).toBeDefined();
      expect(screen.getByText("Status")).toBeDefined();
      expect(screen.getByText("Duration")).toBeDefined();
      expect(screen.getByText("Last Activity")).toBeDefined();
    });

    // Agent IDs in rows
    expect(screen.getByText("ao-test-001")).toBeDefined();
    expect(screen.getByText("ao-test-002")).toBeDefined();
    expect(screen.getByText("ao-test-003")).toBeDefined();
  });

  it("shows status badges for each agent", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        sessions: mockAgents,
        stats: { total: 3, active: 1, idle: 1, blocked: 1 },
      }),
    });

    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.getByText("ao-test-001")).toBeDefined();
    });

    // Status labels present
    expect(screen.getByText("active")).toBeDefined();
    expect(screen.getByText("idle")).toBeDefined();
    expect(screen.getByText("blocked")).toBeDefined();
  });

  it("shows issue labels in story column", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        sessions: mockAgents,
        stats: { total: 3, active: 1, idle: 1, blocked: 1 },
      }),
    });

    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.getByText("#42")).toBeDefined();
      expect(screen.getByText("#43")).toBeDefined();
      expect(screen.getByText("#44")).toBeDefined();
    });
  });

  it("shows empty state when no agents", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        sessions: [],
        stats: { total: 0, active: 0, idle: 0, blocked: 0 },
      }),
    });

    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.getByText("No active agents")).toBeDefined();
    });
  });

  it("shows stats summary", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        sessions: mockAgents,
        stats: { total: 3, active: 1, idle: 1, blocked: 1 },
      }),
    });

    render(<FleetPage />);

    await waitFor(() => {
      const statsText = screen.getByText(/Total: 3/);
      expect(statsText).toBeDefined();
    });
  });

  it("shows error state on fetch failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load fleet status")).toBeDefined();
    });
  });

  it("has keyboard navigation hint", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        sessions: mockAgents,
        stats: { total: 3, active: 1, idle: 1, blocked: 1 },
      }),
    });

    render(<FleetPage />);

    await waitFor(() => {
      // Keyboard hint contains j/k/Enter keys
      expect(screen.getByText("j")).toBeDefined();
      expect(screen.getByText("k")).toBeDefined();
      expect(screen.getByText("Enter")).toBeDefined();
    });
  });
});
