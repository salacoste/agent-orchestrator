/**
 * CrossSessionMemoryViewer component tests.
 * Story 61-2, AC #2, #3, #4, #5, #6.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { CrossSessionMemoryEntry } from "@composio/ao-core";

const mockUseCrossSessionMemory = vi.fn();

vi.mock("@/hooks/useCrossSessionMemory", () => ({
  useCrossSessionMemory: (...args: unknown[]) => mockUseCrossSessionMemory(...args),
}));

const mockFetch = vi.fn();
const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = mockFetch;
  vi.clearAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

import { CrossSessionMemoryViewer } from "../CrossSessionMemoryViewer";

const SAMPLE_ENTRIES: CrossSessionMemoryEntry[] = [
  {
    id: "e1",
    type: "convention",
    content: "Use kebab-case for files",
    contentHash: "hash-1",
    sourceSessionIds: ["session-1"],
    firstSeenAt: "2026-04-17T00:00:00Z",
    lastSeenAt: "2026-04-17T00:00:00Z",
  },
  {
    id: "e2",
    type: "decision",
    content: "Use ESM modules",
    contentHash: "hash-2",
    sourceSessionIds: ["session-1", "session-2"],
    firstSeenAt: "2026-04-17T00:00:00Z",
    lastSeenAt: "2026-04-17T00:00:00Z",
  },
  {
    id: "e3",
    type: "learning",
    content: "Avoid exec()",
    contentHash: "hash-3",
    sourceSessionIds: ["session-3"],
    firstSeenAt: "2026-04-17T00:00:00Z",
    lastSeenAt: "2026-04-17T00:00:00Z",
  },
];

describe("CrossSessionMemoryViewer", () => {
  it("renders entries grouped by type", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: SAMPLE_ENTRIES,
      enabled: true,
      connected: true,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    expect(mockUseCrossSessionMemory).toHaveBeenCalledWith("myproject");
    // Type headings appear in both filter dropdown and grouped sections
    expect(screen.getAllByText("Conventions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Decisions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Learnings").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Use kebab-case for files")).toBeInTheDocument();
    expect(screen.getByText("Use ESM modules")).toBeInTheDocument();
  });

  it("renders entry count in header", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: SAMPLE_ENTRIES,
      enabled: true,
      connected: true,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    expect(screen.getByText("3 entries")).toBeInTheDocument();
  });

  it("renders singular entry count for single entry", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: [SAMPLE_ENTRIES[0]],
      enabled: true,
      connected: true,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    expect(screen.getByText("1 entry")).toBeInTheDocument();
  });

  it("shows disabled state when feature is off", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: [],
      enabled: false,
      connected: false,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    expect(
      screen.getByText(
        "Enable cross-session memory in project config to view accumulated knowledge.",
      ),
    ).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: [],
      enabled: true,
      connected: false,
      error: true,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    expect(screen.getByText("Failed to load cross-session memory.")).toBeInTheDocument();
  });

  it("shows empty state when no entries", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: [],
      enabled: true,
      connected: true,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    expect(screen.getByText("No cross-session memory entries yet")).toBeInTheDocument();
  });

  it("shows filtered-empty state when filters exclude all entries", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: SAMPLE_ENTRIES,
      enabled: true,
      connected: true,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    // Filter to a type that doesn't exist in sample data
    const select = screen.getByLabelText("Filter by type");
    fireEvent.change(select, { target: { value: "directive" } });

    expect(screen.getByText("No entries match the current filters")).toBeInTheDocument();
  });

  it("filters by type", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: SAMPLE_ENTRIES,
      enabled: true,
      connected: true,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    const select = screen.getByLabelText("Filter by type");
    fireEvent.change(select, { target: { value: "convention" } });

    expect(screen.getByText("Use kebab-case for files")).toBeInTheDocument();
    expect(screen.queryByText("Use ESM modules")).not.toBeInTheDocument();
    expect(screen.queryByText("Avoid exec()")).not.toBeInTheDocument();
  });

  it("filters by session ID", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: SAMPLE_ENTRIES,
      enabled: true,
      connected: true,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    const input = screen.getByLabelText("Filter by source session");
    fireEvent.change(input, { target: { value: "session-2" } });

    // Only e2 has session-2 in sourceSessionIds
    expect(screen.getByText("Use ESM modules")).toBeInTheDocument();
    expect(screen.queryByText("Use kebab-case for files")).not.toBeInTheDocument();
  });

  it("enters edit mode via aria-label selector", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: SAMPLE_ENTRIES,
      enabled: true,
      connected: true,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    fireEvent.click(screen.getByLabelText("Edit convention entry"));

    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("cancels edit mode", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: SAMPLE_ENTRIES,
      enabled: true,
      connected: true,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    fireEvent.click(screen.getByLabelText("Edit convention entry"));
    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.queryByText("Save")).not.toBeInTheDocument();
  });

  it("saves edited entry via PUT", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    mockUseCrossSessionMemory.mockReturnValue({
      entries: SAMPLE_ENTRIES,
      enabled: true,
      connected: true,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    fireEvent.click(screen.getByLabelText("Edit convention entry"));

    const textarea = screen.getByLabelText("Edit entry content");
    fireEvent.change(textarea, { target: { value: "Updated content" } });

    fireEvent.click(screen.getByText("Save"));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/cross-session-memory/myproject",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining("Updated content"),
      }),
    );
  });

  it("shows delete confirmation dialog via aria-label selector", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: SAMPLE_ENTRIES,
      enabled: true,
      connected: true,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    fireEvent.click(screen.getByLabelText("Delete convention entry"));

    expect(screen.getByText("Delete this entry? This cannot be undone.")).toBeInTheDocument();
  });

  it("deletes entry via DELETE on confirm", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    mockUseCrossSessionMemory.mockReturnValue({
      entries: SAMPLE_ENTRIES,
      enabled: true,
      connected: true,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    fireEvent.click(screen.getByLabelText("Delete convention entry"));

    // The dialog's Delete button is the last one in the DOM
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/cross-session-memory/myproject",
        expect.objectContaining({
          method: "DELETE",
          body: expect.stringContaining("hash-1"),
        }),
      );
    });
  });

  it("cancels delete confirmation", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: SAMPLE_ENTRIES,
      enabled: true,
      connected: true,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    fireEvent.click(screen.getByLabelText("Delete convention entry"));

    // Cancel in dialog
    const cancelButtons = screen.getAllByText("Cancel");
    fireEvent.click(cancelButtons[cancelButtons.length - 1]!);

    expect(screen.queryByText("Delete this entry? This cannot be undone.")).not.toBeInTheDocument();
  });

  it("shows SSE connected indicator", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: SAMPLE_ENTRIES,
      enabled: true,
      connected: true,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    expect(screen.getByLabelText("SSE connected")).toBeInTheDocument();
  });

  it("does not show SSE indicator when disconnected", () => {
    mockUseCrossSessionMemory.mockReturnValue({
      entries: SAMPLE_ENTRIES,
      enabled: true,
      connected: false,
      error: false,
    });

    render(<CrossSessionMemoryViewer projectName="myproject" />);

    expect(screen.queryByLabelText("SSE connected")).not.toBeInTheDocument();
  });
});
