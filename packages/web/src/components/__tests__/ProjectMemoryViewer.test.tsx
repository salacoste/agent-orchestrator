/**
 * ProjectMemoryViewer component tests (Story 60-9, AC #13).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ProjectMemory } from "@composio/ao-core";

const mockUseProjectMemorySSE = vi.fn();

vi.mock("@/hooks/useProjectMemorySSE", () => ({
  useProjectMemorySSE: (...args: unknown[]) => mockUseProjectMemorySSE(...args),
}));

// Mock fetch for edit/delete tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { ProjectMemoryViewer } from "../ProjectMemoryViewer";

const SAMPLE_MEMORY: ProjectMemory = {
  entries: [
    {
      id: "e1",
      type: "convention",
      content: "Use kebab-case for files",
      source: "session-1",
      timestamp: "2026-04-17T12:00:00Z",
    },
    {
      id: "e2",
      type: "decision",
      content: "Use ESM modules",
    },
    {
      id: "e3",
      type: "learning",
      content: "Avoid exec()",
    },
  ],
};

describe("ProjectMemoryViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders entries grouped by type", () => {
    mockUseProjectMemorySSE.mockReturnValue({
      memory: SAMPLE_MEMORY,
      exists: true,
      connected: true,
    });

    render(<ProjectMemoryViewer sessionId="session-1" />);

    expect(mockUseProjectMemorySSE).toHaveBeenCalledWith("session-1");
    expect(screen.getByTestId("project-memory-panel")).toBeInTheDocument();
    expect(screen.getByText("Conventions")).toBeInTheDocument();
    expect(screen.getByText("Decisions")).toBeInTheDocument();
    expect(screen.getByText("Learnings")).toBeInTheDocument();
    expect(screen.getByText("Use kebab-case for files")).toBeInTheDocument();
    expect(screen.getByText("Use ESM modules")).toBeInTheDocument();
  });

  it("renders entry count in header", () => {
    mockUseProjectMemorySSE.mockReturnValue({
      memory: SAMPLE_MEMORY,
      exists: true,
      connected: true,
    });

    render(<ProjectMemoryViewer sessionId="session-1" />);

    expect(screen.getByText("3 entries")).toBeInTheDocument();
  });

  it("renders singular entry count for single entry", () => {
    mockUseProjectMemorySSE.mockReturnValue({
      memory: { entries: [SAMPLE_MEMORY.entries[0]] },
      exists: true,
      connected: true,
    });

    render(<ProjectMemoryViewer sessionId="session-1" />);

    expect(screen.getByText("1 entry")).toBeInTheDocument();
  });

  it("handles empty state (exists: false)", () => {
    mockUseProjectMemorySSE.mockReturnValue({
      memory: null,
      exists: false,
      connected: false,
    });

    render(<ProjectMemoryViewer sessionId="session-1" />);

    expect(screen.getByText("No project memory available")).toBeInTheDocument();
  });

  it("handles loading state (exists: true, memory: null)", () => {
    mockUseProjectMemorySSE.mockReturnValue({
      memory: null,
      exists: true,
      connected: false,
    });

    render(<ProjectMemoryViewer sessionId="session-1" />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("handles no entries (empty array)", () => {
    mockUseProjectMemorySSE.mockReturnValue({
      memory: { entries: [] },
      exists: true,
      connected: true,
    });

    render(<ProjectMemoryViewer sessionId="session-1" />);

    expect(screen.getByText("No project memory entries yet")).toBeInTheDocument();
  });

  it("shows edit button on hover and enters edit mode on click", () => {
    mockUseProjectMemorySSE.mockReturnValue({
      memory: SAMPLE_MEMORY,
      exists: true,
      connected: true,
    });

    render(<ProjectMemoryViewer sessionId="session-1" />);

    // Click the Edit button for first entry
    const editButtons = screen.getAllByText("Edit");
    fireEvent.click(editButtons[0]!);

    // Should now see Save/Cancel buttons
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("cancels edit mode", () => {
    mockUseProjectMemorySSE.mockReturnValue({
      memory: SAMPLE_MEMORY,
      exists: true,
      connected: true,
    });

    render(<ProjectMemoryViewer sessionId="session-1" />);

    const editButtons = screen.getAllByText("Edit");
    fireEvent.click(editButtons[0]!);
    fireEvent.click(screen.getByText("Cancel"));

    // Edit form should be gone
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
  });

  it("shows delete confirmation on delete click", () => {
    mockUseProjectMemorySSE.mockReturnValue({
      memory: SAMPLE_MEMORY,
      exists: true,
      connected: true,
    });

    render(<ProjectMemoryViewer sessionId="session-1" />);

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]!);

    expect(screen.getByText(/Delete "Use kebab-case for files"\?/)).toBeInTheDocument();
  });

  it("cancels delete confirmation", () => {
    mockUseProjectMemorySSE.mockReturnValue({
      memory: SAMPLE_MEMORY,
      exists: true,
      connected: true,
    });

    render(<ProjectMemoryViewer sessionId="session-1" />);

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]!);

    // There are two "Cancel" buttons now — click the one in delete confirm
    const cancelButtons = screen.getAllByText("Cancel");
    fireEvent.click(cancelButtons[cancelButtons.length - 1]!);

    // Delete confirm should be gone
    expect(screen.queryByText(/Delete "Use kebab-case for files"\?/)).not.toBeInTheDocument();
  });

  it("renders panel with correct aria attributes", () => {
    mockUseProjectMemorySSE.mockReturnValue({
      memory: SAMPLE_MEMORY,
      exists: true,
      connected: true,
    });

    render(<ProjectMemoryViewer sessionId="session-1" />);

    const panel = screen.getByTestId("project-memory-panel");
    expect(panel).toHaveAttribute("role", "region");
    expect(panel).toHaveAttribute("aria-labelledby", "project-memory-heading");
    expect(screen.getByText("Project Memory")).toBeInTheDocument();
  });

  it("does not render Directives group when no directive entries", () => {
    mockUseProjectMemorySSE.mockReturnValue({
      memory: SAMPLE_MEMORY,
      exists: true,
      connected: true,
    });

    render(<ProjectMemoryViewer sessionId="session-1" />);

    // No directive entries in sample data
    expect(screen.queryByText("Directives")).not.toBeInTheDocument();
  });

  it("saves edited entry via PUT", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    mockUseProjectMemorySSE.mockReturnValue({
      memory: SAMPLE_MEMORY,
      exists: true,
      connected: true,
    });

    render(<ProjectMemoryViewer sessionId="session-1" />);

    const editButtons = screen.getAllByText("Edit");
    fireEvent.click(editButtons[0]!);

    // Modify the textarea
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Updated content" } });

    fireEvent.click(screen.getByText("Save"));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/session/session-1/memory",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("deletes entry via PUT with filtered entries", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    mockUseProjectMemorySSE.mockReturnValue({
      memory: SAMPLE_MEMORY,
      exists: true,
      connected: true,
    });

    render(<ProjectMemoryViewer sessionId="session-1" />);

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]!);

    // The DeleteConfirm replaces e1's EntryRow, so its confirm "Delete" is the first one
    const confirmButtons = screen.getAllByText("Delete");
    fireEvent.click(confirmButtons[0]!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/session/session-1/memory",
        expect.objectContaining({
          method: "PUT",
          body: expect.not.stringContaining("e1"),
        }),
      );
    });
  });
});
