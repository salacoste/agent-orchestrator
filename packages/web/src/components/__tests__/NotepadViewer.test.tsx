import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotepadViewer } from "../NotepadViewer";

// Mock useNotepadSSE hook
const mockUseNotepadSSE = vi.fn();
vi.mock("@/hooks/useNotepadSSE", () => ({
  useNotepadSSE: (...args: unknown[]) => mockUseNotepadSSE(...args),
}));

describe("NotepadViewer", () => {
  beforeEach(() => {
    mockUseNotepadSSE.mockReturnValue({
      notepad: null,
      exists: false,
      connected: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // AC8.1 — Renders three tabs
  it("renders three tabs", () => {
    mockUseNotepadSSE.mockReturnValue({
      notepad: { priority: "p", working: "w", manual: "m" },
      exists: true,
      connected: true,
    });

    render(<NotepadViewer sessionId="session-1" />);

    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Working Memory")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  // AC8.2 — Displays content for active tab (Priority is default)
  it("displays content for active tab", () => {
    mockUseNotepadSSE.mockReturnValue({
      notepad: { priority: "Fix login bug", working: "Investigating auth", manual: "Notes" },
      exists: true,
      connected: true,
    });

    render(<NotepadViewer sessionId="session-1" />);

    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
  });

  // AC8.3 — Shows empty state message when content is empty
  it("shows empty state message when content is empty", () => {
    mockUseNotepadSSE.mockReturnValue({
      notepad: { priority: "", working: "Some content", manual: "More" },
      exists: true,
      connected: true,
    });

    render(<NotepadViewer sessionId="session-1" />);

    // Priority tab is active and empty
    expect(screen.getByText("No content yet.")).toBeInTheDocument();
  });

  // AC8.4 — Shows empty state panel when exists === false
  it("shows empty state panel when exists is false", () => {
    mockUseNotepadSSE.mockReturnValue({
      notepad: null,
      exists: false,
      connected: false,
    });

    render(<NotepadViewer sessionId="session-1" />);

    expect(screen.getByText("No notepad content yet.")).toBeInTheDocument();
    // Tabs should NOT be rendered when exists is false
    expect(screen.queryByText("Working Memory")).not.toBeInTheDocument();
  });

  // AC8.5 — Tab switching updates displayed content
  it("tab switching updates displayed content", () => {
    mockUseNotepadSSE.mockReturnValue({
      notepad: {
        priority: "Priority content",
        working: "Working memory content",
        manual: "Manual content",
      },
      exists: true,
      connected: true,
    });

    render(<NotepadViewer sessionId="session-1" />);

    // Default tab is Priority
    expect(screen.getByText("Priority content")).toBeInTheDocument();

    // Switch to Working Memory tab
    fireEvent.click(screen.getByText("Working Memory"));
    expect(screen.getByText("Working memory content")).toBeInTheDocument();
    expect(screen.queryByText("Priority content")).not.toBeInTheDocument();

    // Switch to Manual tab
    fireEvent.click(screen.getByText("Manual"));
    expect(screen.getByText("Manual content")).toBeInTheDocument();
    expect(screen.queryByText("Working memory content")).not.toBeInTheDocument();
  });

  // Verifies sessionId is passed to the hook
  it("passes sessionId to useNotepadSSE", () => {
    render(<NotepadViewer sessionId="test-session-42" />);

    expect(mockUseNotepadSSE).toHaveBeenCalledWith("test-session-42");
  });

  // Renders "Agent Notepad" header
  it("renders Agent Notepad header", () => {
    mockUseNotepadSSE.mockReturnValue({
      notepad: { priority: "p", working: "w", manual: "m" },
      exists: true,
      connected: true,
    });

    render(<NotepadViewer sessionId="session-1" />);

    expect(screen.getByText("Agent Notepad")).toBeInTheDocument();
  });
});
