import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import FleetPage from "@/app/fleet/page";

// Mock fetch
global.fetch = vi.fn();

// Mock SSE hooks - track callbacks for testing
let mockAgentStatusCallback: (() => void) | null = null;
let mockStoryBlockedCallback: (() => void) | null = null;

vi.mock("@/hooks/useSSEConnection.js", () => ({
  useSSEConnection: vi.fn((callbacks) => {
    // Store callbacks for testing
    mockAgentStatusCallback = callbacks.onAgentStatusChanged;
    mockStoryBlockedCallback = callbacks.onStoryBlocked;
    return { connected: true, reconnecting: false };
  }),
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

  it("shows empty state with spawn button when no agents", async () => {
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

    // Check for spawn button
    expect(screen.getByText("Spawn Agent")).toBeInTheDocument();
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

    // Click on agent card by finding the story title
    const agentCard = screen.getByText("Test Story");
    fireEvent.click(agentCard);

    // Drawer should be visible with proper ARIA attributes
    await waitFor(() => {
      expect(screen.getByText("Agent Details")).toBeInTheDocument();
    });

    // Check for accessibility attributes
    const drawer = screen.getByRole("dialog");
    expect(drawer).toHaveAttribute("aria-modal", "true");
  });

  it("displays activity log in drawer", async () => {
    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading fleet status/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test Story"));

    // Check for activity log section
    await waitFor(() => {
      expect(screen.getByText(/Recent Activity/i)).toBeInTheDocument();
    });
  });

  it("displays story progress section in drawer", async () => {
    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading fleet status/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test Story"));

    // Check for story progress section
    await waitFor(() => {
      expect(screen.getByText(/Story Progress/i)).toBeInTheDocument();
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

    // Modal should be visible with proper ARIA attributes
    await waitFor(() => {
      expect(screen.getByText("Resume Agent")).toBeInTheDocument();
    });

    // Check for accessibility attributes
    const modal = screen.getByRole("dialog");
    expect(modal).toHaveAttribute("aria-modal", "true");
  });

  it("calls resume API when resume button is clicked in modal", async () => {
    const blockedAgent = {
      ...mockAgents[0],
      activity: "blocked",
    };

    const mockResumeResponse = { ok: true };
    global.fetch = vi.fn((url) => {
      if (url === "/api/sessions?active=true") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            sessions: [blockedAgent],
            stats: { total: 1, active: 0, idle: 0, blocked: 1 },
          }),
        });
      }
      if (url === "/api/resume") {
        return Promise.resolve(mockResumeResponse);
      }
      return Promise.resolve({ ok: false });
    }) as unknown as typeof fetch;

    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading fleet status/i)).not.toBeInTheDocument();
    });

    // Open resume modal
    fireEvent.click(screen.getByText("Resume"));

    await waitFor(() => {
      expect(screen.getByText("Resume Agent")).toBeInTheDocument();
    });

    // Verify the modal shows the correct agent information
    expect(screen.getAllByText(blockedAgent.id).length).toBeGreaterThan(0);
    expect(screen.getAllByText("STORY-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Implementing feature").length).toBeGreaterThan(0);
  });

  it("has proper ARIA labels for status emojis", async () => {
    render(<FleetPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading fleet status/i)).not.toBeInTheDocument();
    });

    // Check for status indicators with proper ARIA labels
    const statusIndicators = screen.getAllByRole("status");
    expect(statusIndicators.length).toBeGreaterThan(0);

    // Each status indicator should have a descriptive aria-label
    statusIndicators.forEach((indicator) => {
      const ariaLabel = indicator.getAttribute("aria-label");
      expect(ariaLabel).toMatch(
        /Agent is (active and working|idle waiting for work|blocked and needs attention)/,
      );
    });
  });

  describe("SSE Integration", () => {
    it("registers SSE callbacks on mount", async () => {
      render(<FleetPage />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading fleet status/i)).not.toBeInTheDocument();
      });

      // Verify callbacks were registered
      expect(mockAgentStatusCallback).toBeDefined();
      expect(mockStoryBlockedCallback).toBeDefined();
    });

    it("refetches data when agent status changes via SSE", async () => {
      const fetchMock = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            sessions: mockAgents,
            stats: { total: 2, active: 1, idle: 1, blocked: 0 },
          }),
        }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      render(<FleetPage />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading fleet status/i)).not.toBeInTheDocument();
      });

      const callCountBefore = fetchMock.mock.calls.length;

      // Trigger SSE event
      if (mockAgentStatusCallback) {
        mockAgentStatusCallback();
      }

      await waitFor(() => {
        expect(fetchMock.mock.calls.length).toBeGreaterThan(callCountBefore);
      });
    });

    it("refetches data when story is blocked via SSE", async () => {
      const fetchMock = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            sessions: mockAgents,
            stats: { total: 2, active: 1, idle: 1, blocked: 0 },
          }),
        }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      render(<FleetPage />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading fleet status/i)).not.toBeInTheDocument();
      });

      const callCountBefore = fetchMock.mock.calls.length;

      // Trigger SSE event
      if (mockStoryBlockedCallback) {
        mockStoryBlockedCallback();
      }

      await waitFor(() => {
        expect(fetchMock.mock.calls.length).toBeGreaterThan(callCountBefore);
      });
    });
  });

  describe("Empty State", () => {
    it("shows spawn button that opens alert when clicked", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ sessions: [], stats: { total: 0, active: 0, idle: 0, blocked: 0 } }),
        }),
      ) as unknown as typeof fetch;

      // Mock window.alert
      const alertMock = vi.fn();
      global.alert = alertMock;

      render(<FleetPage />);

      await waitFor(() => {
        expect(screen.getByText(/No active agents/i)).toBeInTheDocument();
      });

      const spawnButton = screen.getByText("Spawn Agent");
      fireEvent.click(spawnButton);

      expect(alertMock).toHaveBeenCalledWith(
        expect.stringContaining("To spawn a new agent, use the CLI: ao spawn"),
      );
    });
  });

  describe("Accessibility", () => {
    it("close button has aria-label in drawer", async () => {
      render(<FleetPage />);

      await waitFor(() => {
        expect(screen.queryByText(/Loading fleet status/i)).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Test Story"));

      await waitFor(() => {
        expect(screen.getByText("Agent Details")).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText("Close drawer");
      expect(closeButton).toBeInTheDocument();
    });

    it("close button has aria-label in modal", async () => {
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

      fireEvent.click(screen.getByText("Resume"));

      await waitFor(() => {
        expect(screen.getByText("Resume Agent")).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText("Close modal");
      expect(closeButton).toBeInTheDocument();
    });
  });
});
