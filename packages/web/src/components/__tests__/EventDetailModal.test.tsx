import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import EventDetailModal from "@/components/EventDetailModal";

// Mock clipboard
global.navigator.clipboard = { writeText: vi.fn().mockResolvedValue(undefined) } as any;

describe("EventDetailModal", () => {
  const mockEvent = {
    id: "evt-001",
    type: "story.completed",
    timestamp: "2026-03-08T00:05:00Z",
    data: { storyId: "STORY-001", agentId: "ao-story-001" },
    hash: "abc123",
  };

  const mockEvents = [
    mockEvent,
    {
      id: "evt-000",
      type: "story.started",
      timestamp: "2026-03-08T00:00:00Z",
      data: { storyId: "STORY-001", agentId: "ao-story-001" },
      hash: "prev123",
    },
    {
      id: "evt-002",
      type: "story.resumed",
      timestamp: "2026-03-08T00:10:00Z",
      data: { storyId: "STORY-001" },
      hash: "next123",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal when isOpen is true", async () => {
    render(
      <EventDetailModal event={mockEvent} events={mockEvents} isOpen={true} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("does not render modal when isOpen is false", () => {
    render(
      <EventDetailModal event={mockEvent} events={mockEvents} isOpen={false} onClose={vi.fn()} />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("displays full event metadata", async () => {
    render(
      <EventDetailModal event={mockEvent} events={mockEvents} isOpen={true} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getAllByText("evt-001").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/story completed/i).length).toBeGreaterThan(0);
      expect(screen.getByText("STORY-001")).toBeInTheDocument();
    });
  });

  it("displays formatted JSON viewer", async () => {
    render(
      <EventDetailModal event={mockEvent} events={mockEvents} isOpen={true} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/event payload/i)).toBeInTheDocument();
    });
  });

  it("has copy JSON button that copies to clipboard", async () => {
    render(
      <EventDetailModal event={mockEvent} events={mockEvents} isOpen={true} onClose={vi.fn()} />,
    );

    const copyButton = await waitFor(() => screen.getByText(/copy json/i));
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(global.navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it("has previous/next navigation buttons", async () => {
    render(
      <EventDetailModal event={mockEvent} events={mockEvents} isOpen={true} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/previous/i)).toBeInTheDocument();
      expect(screen.getByText(/next/i)).toBeInTheDocument();
    });
  });

  it("calls onClose when close button is clicked", async () => {
    const mockOnClose = vi.fn();

    render(
      <EventDetailModal
        event={mockEvent}
        events={mockEvents}
        isOpen={true}
        onClose={mockOnClose}
      />,
    );

    const closeButton = await waitFor(() => screen.getByLabelText("Close"));
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("displays event hash for integrity verification", async () => {
    render(
      <EventDetailModal event={mockEvent} events={mockEvents} isOpen={true} onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/abc123/).length).toBeGreaterThan(0);
      expect(screen.getByText(/sha-256/i)).toBeInTheDocument();
    });
  });

  it("calls onClose when backdrop is clicked", async () => {
    const mockOnClose = vi.fn();

    render(
      <EventDetailModal
        event={mockEvent}
        events={mockEvents}
        isOpen={true}
        onClose={mockOnClose}
      />,
    );

    const backdrop = screen.getByRole("dialog").parentElement;
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });
});
