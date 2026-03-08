import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AgentSessionCard from "@/components/AgentSessionCard";

// Mock fetch
global.fetch = vi.fn();

// Mock useSSEConnection hook
vi.mock("@/hooks/useSSEConnection.js", () => ({
  useSSEConnection: vi.fn(() => ({ connected: false, reconnecting: false })),
}));

describe("AgentSessionCard", () => {
  const mockAgentId = "ao-test-001";

  const mockActivityData = [
    {
      timestamp: "2026-03-08T00:05:00Z",
      type: "tool_call",
      description: "Executed tool: Read",
    },
    {
      timestamp: "2026-03-08T00:04:30Z",
      type: "response",
      description: "Generated response to user",
    },
    {
      timestamp: "2026-03-08T00:04:00Z",
      type: "prompt",
      description: "Received user message",
    },
  ];

  const mockLogs = [
    "[INFO] 2026-03-08T00:05:00Z: Executing tool: Read",
    "[INFO] 2026-03-08T00:04:30Z: Generated response",
    "[DEBUG] 2026-03-08T00:04:00Z: Processing prompt",
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset clipboard mock
    global.navigator.clipboard = { writeText: vi.fn().mockResolvedValue(undefined) } as any;
  });

  it("renders modal when open", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          issueLabel: "STORY-001",
          issueTitle: "Test Story",
          status: "running",
          activity: "working",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      }),
    ) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Agent Session")).toBeInTheDocument();
    });
  });

  it("displays agent header with status", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          issueLabel: "STORY-001",
          issueTitle: "Test Story",
          status: "running",
          activity: "working",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      }),
    ) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(mockAgentId)).toBeInTheDocument();
      expect(screen.getByText("STORY-001")).toBeInTheDocument();
      expect(screen.getByText("Test Story")).toBeInTheDocument();
    });
  });

  it("displays activity timeline with color-coded events", async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes("/activity")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ events: mockActivityData }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          issueLabel: "STORY-001",
          status: "running",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      });
    }) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Activity Timeline")).toBeInTheDocument();
    });

    // Check events are displayed - use getAllByText for multiple matches
    // Events are now formatted with formatEventType: "Tool Call", "Response", "Prompt"
    expect(screen.getAllByText(/Tool Call/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Response/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Prompt/).length).toBeGreaterThan(0);
  });

  it("shows last 50 events only", async () => {
    const manyEvents = Array.from({ length: 60 }, (_, i) => ({
      timestamp: `2026-03-08T00:${String(i).padStart(2, "0")}:00Z`,
      type: "event",
      description: `Event ${i + 1}`,
    }));

    global.fetch = vi.fn((url) => {
      if (url.includes("/activity")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ events: manyEvents }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          status: "running",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      });
    }) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Activity Timeline")).toBeInTheDocument();
    });

    // Should show last 50 events (events 11-60 since newest first)
    expect(screen.getByText("Event 60")).toBeInTheDocument();
    // Event 1 should not be shown (too old)
    expect(screen.queryByText("Event 1")).not.toBeInTheDocument();
  });

  it("has View Logs button that expands log viewer", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          status: "running",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      }),
    ) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={vi.fn()} />);

    const viewLogsButton = await waitFor(() => screen.getByText("View Logs"));
    expect(viewLogsButton).toBeInTheDocument();

    fireEvent.click(viewLogsButton);

    // Button text should change to "Hide Logs"
    await waitFor(() => {
      expect(screen.getByText("Hide Logs")).toBeInTheDocument();
    });
  });

  it("displays syntax highlighted logs", async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes("/logs")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ logs: mockLogs }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          status: "running",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      });
    }) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={vi.fn()} />);

    // Click View Logs
    const viewLogsButton = await waitFor(() => screen.getByText("View Logs"));
    fireEvent.click(viewLogsButton);

    // Wait for logs to be fetched and displayed
    await waitFor(
      () => {
        expect(screen.getByText("Agent Logs")).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Check log content is displayed
    expect(screen.getByText(/Executing tool: Read/)).toBeInTheDocument();
    expect(screen.getByText(/Generated response/)).toBeInTheDocument();
  });

  it("shows last 100 log lines only", async () => {
    const manyLogs = Array.from({ length: 120 }, (_, i) => `[INFO] Log line ${i + 1}`);

    global.fetch = vi.fn((url) => {
      if (url.includes("/logs")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ logs: manyLogs }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          status: "running",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      });
    }) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={vi.fn()} />);

    const viewLogsButton = await waitFor(() => screen.getByText("View Logs"));
    fireEvent.click(viewLogsButton);

    // Wait for logs to be fetched and displayed
    await waitFor(
      () => {
        expect(screen.getByText("Agent Logs")).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    // Should show last 100 logs (logs 21-120)
    expect(screen.getByText(/Log line 120/)).toBeInTheDocument();
    // Use exact match to avoid matching "Log line 10", "Log line 100", etc.
    expect(screen.queryByText("[INFO] Log line 1")).not.toBeInTheDocument();
  });

  it("shows Attach button with tmux command", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          status: "running",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      }),
    ) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Attach")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Attach"));

    // Should show attach command
    await waitFor(() => {
      expect(screen.getByText(/tmux attach-session/)).toBeInTheDocument();
    });
  });

  it("has copy to clipboard button for attach command", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          status: "running",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      }),
    ) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Attach")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Attach"));

    await waitFor(() => {
      expect(screen.getByText(/tmux attach-session/)).toBeInTheDocument();
    });

    const copyButton = screen.getByText("Copy");
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("tmux attach-session"),
      );
    });
  });

  it("calls onClose when close button is clicked", async () => {
    const mockOnClose = vi.fn();

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          status: "running",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      }),
    ) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={mockOnClose} />);

    const closeButton = await waitFor(() => screen.getByLabelText("Close"));
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("highlights blocked status in red", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          issueLabel: "STORY-001",
          status: "blocked",
          activity: "blocked",
          blockReason: "Waiting for user input",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      }),
    ) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={vi.fn()} />);

    await waitFor(() => {
      const blockedElement = screen.getByText(/blocked/i);
      expect(blockedElement).toBeInTheDocument();
      // Should have red color indicator
      expect(blockedElement.className).toContain("text-red");
    });
  });

  it("shows Resume button for blocked agents", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          status: "blocked",
          activity: "blocked",
          issueLabel: "STORY-001",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      }),
    ) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Resume")).toBeInTheDocument();
    });
  });

  it("modal is draggable", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          status: "running",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      }),
    ) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={vi.fn()} />);

    await waitFor(() => {
      const modal = screen.getByRole("dialog").closest("[data-draggable]");
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute("data-draggable", "true");
    });
  });

  it("modal is resizable", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          status: "running",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      }),
    ) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={vi.fn()} />);

    await waitFor(() => {
      const modal = screen.getByRole("dialog").closest("[data-resizable]");
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute("data-resizable", "true");
    });
  });

  it("has auto-scroll toggle for logs", async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes("/logs")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ logs: mockLogs }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: mockAgentId,
          status: "running",
          createdAt: "2026-03-08T00:00:00Z",
          lastActivityAt: "2026-03-08T00:05:00Z",
        }),
      });
    }) as unknown as typeof fetch;

    render(<AgentSessionCard agentId={mockAgentId} onClose={vi.fn()} />);

    const viewLogsButton = await waitFor(() => screen.getByText("View Logs"));
    fireEvent.click(viewLogsButton);

    // Wait for logs to be fetched and auto-scroll toggle to appear
    await waitFor(
      () => {
        expect(screen.getByLabelText("Toggle auto-scroll")).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
  });
});
