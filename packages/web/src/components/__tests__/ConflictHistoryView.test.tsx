import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { ConflictHistoryView } from "../ConflictHistoryView";

const mockHistoryResponse = {
  entries: [
    {
      id: "history-001",
      conflict: {
        id: "conflict-001",
        resourceType: "repository",
        resourceIdentifier: "org/shared-repo",
        competingProjects: ["proj-a", "proj-b"],
        severity: "high",
        detectedAt: "2026-04-01T12:00:00.000Z",
        metadata: {},
      },
      resolvedAt: "2026-04-01T14:00:00.000Z",
      resolutionStrategy: "sequential-scheduling",
      resolutionOutcome: "resolved",
      resolvedBy: "user@example.com",
      notes: "",
    },
  ],
  patterns: {
    totalResolved: 1,
    byResourceType: { repository: 1 },
    byOutcome: { resolved: 1 },
    byStrategy: { "sequential-scheduling": 1 },
    mostConflictedResource: "org/shared-repo",
    avgResolutionTimeMs: 7_200_000,
    recurringConflicts: [],
  },
  filter: {},
};

describe("ConflictHistoryView", () => {
  afterEach(() => cleanup());

  beforeAll(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/conflicts/history/export")) {
          return new Response(JSON.stringify({ entries: [], exportedAt: "" }), {
            headers: { "Content-Disposition": 'attachment; filename="test.json"' },
          });
        }
        return new Response(JSON.stringify(mockHistoryResponse), { status: 200 });
      }),
    );
  });

  it("renders loading state initially", () => {
    render(<ConflictHistoryView />);
    expect(screen.getByText(/Loading history/i)).toBeDefined();
  });

  it("renders export button after loading", async () => {
    render(<ConflictHistoryView />);
    await waitFor(() => {
      expect(screen.getByText("Export JSON")).toBeDefined();
    });
  });

  it("renders filter controls", () => {
    render(<ConflictHistoryView />);
    expect(screen.getByLabelText("From")).toBeDefined();
    expect(screen.getByLabelText("To")).toBeDefined();
  });

  it("shows error state when fetch fails", async () => {
    vi.mocked(fetch).mockImplementationOnce(async () => {
      throw new Error("Network error");
    });
    render(<ConflictHistoryView />);
    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeDefined();
    });
  });

  it("renders pattern summary after loading", async () => {
    render(<ConflictHistoryView />);
    await waitFor(() => {
      expect(screen.getByText("Total Resolved")).toBeDefined();
    });
  });
});
