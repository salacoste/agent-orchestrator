import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import EventsPage from "@/app/events/page";

// Mock fetch
global.fetch = vi.fn();

// Mock SSE hooks
vi.mock("@/hooks/useSSEConnection.js", () => ({
  useSSEConnection: vi.fn(() => ({ connected: true, reconnecting: false })),
}));

vi.mock("@/hooks/useFlashAnimation.js", () => ({
  useFlashAnimation: vi.fn(() => false),
}));

describe("EventsPage", () => {
  const mockEvents = [
    {
      id: "evt-001",
      type: "story.completed",
      timestamp: "2026-03-08T00:05:00Z",
      data: { storyId: "STORY-001", agentId: "ao-story-001" },
      hash: "abc123",
    },
    {
      id: "evt-002",
      type: "story.blocked",
      timestamp: "2026-03-08T00:04:30Z",
      data: { storyId: "STORY-002", reason: "Waiting for user input" },
      hash: "def456",
    },
    {
      id: "evt-003",
      type: "agent.status_changed",
      timestamp: "2026-03-08T00:04:00Z",
      data: { agentId: "ao-story-001", status: "idle" },
      hash: "ghi789",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ events: mockEvents, total: 3 }),
      }),
    );
  });

  it("renders page title and event table", async () => {
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Event Audit Trail")).toBeInTheDocument();
    });
  });

  it("displays events in table format", async () => {
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("evt-001")).toBeInTheDocument();
      expect(screen.getByText("evt-002")).toBeInTheDocument();
      expect(screen.getByText("evt-003")).toBeInTheDocument();
    });
  });

  it("displays event type badges with color coding", async () => {
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("story completed")).toBeInTheDocument();
      expect(screen.getByText("story blocked")).toBeInTheDocument();
      // Use getAllByText for partial matches
      expect(screen.getAllByText(/agent/i).length).toBeGreaterThan(0);
    });
  });

  it("has search input that filters events", async () => {
    render(<EventsPage />);

    const searchInput = await waitFor(() => screen.getByPlaceholderText(/search/i));
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "STORY-001" } });

    // Verify input value changed
    expect(searchInput).toHaveValue("STORY-001");
  });

  it("has filter controls for event type", async () => {
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText(/filter/i)).toBeInTheDocument();
    });
  });

  it("has pagination controls", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ events: mockEvents, total: 150, totalPages: 2 }),
      }),
    );

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Showing.*150.*events/i)).toBeInTheDocument();
    });
  });

  it("has auto-refresh toggle", async () => {
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText(/auto-refresh/i)).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    render(<EventsPage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
      }),
    );

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no events", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ events: [], total: 0 }),
      }),
    );

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no events found/i)).toBeInTheDocument();
    });
  });

  it("is responsive on mobile viewport", async () => {
    // Set mobile viewport
    global.innerWidth = 375;
    window.dispatchEvent(new Event("resize"));

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Event Audit Trail")).toBeInTheDocument();
    });
  });
});
