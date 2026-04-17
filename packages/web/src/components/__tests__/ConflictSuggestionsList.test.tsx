import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ConflictSuggestionsList } from "../ConflictSuggestionsList";

const mockSuggestions = [
  {
    id: "suggestion-1",
    conflictId: "conflict-001",
    strategy: "sequential-scheduling",
    description: "Queue project work sequentially",
    impactEstimate: "Delays lower-priority project by ~2 work cycles",
    recommended: true,
    actions: [
      {
        type: "schedule-change" as const,
        description: "Define priority order for competing projects",
      },
      {
        type: "config-change" as const,
        description: "Configure sequential access scheduling in project config",
      },
    ],
  },
  {
    id: "suggestion-2",
    conflictId: "conflict-001",
    strategy: "resource-isolation",
    description: "Assign dedicated resource branch",
    impactEstimate: "Eliminates conflict — each project gets dedicated resource",
    recommended: false,
    actions: [
      {
        type: "config-change" as const,
        description: "Configure separate branches for each project",
      },
    ],
  },
];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchSuccess(data: unknown) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockFetchError(status: number, message: string) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: false,
    json: () => Promise.resolve({ error: message }),
  } as Response);
}

describe("ConflictSuggestionsList", () => {
  it("shows loading state initially", () => {
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {})); // never resolves
    render(<ConflictSuggestionsList conflictId="conflict-001" />);
    expect(screen.getByText("Loading suggestions...")).toBeInTheDocument();
  });

  it("renders suggestions after loading", async () => {
    mockFetchSuccess({ suggestions: mockSuggestions });

    render(<ConflictSuggestionsList conflictId="conflict-001" />);

    await waitFor(() => {
      expect(screen.getByText("Sequential Scheduling")).toBeInTheDocument();
    });
    expect(screen.getByText("Resource Isolation")).toBeInTheDocument();
  });

  it("shows recommended badge on the recommended suggestion", async () => {
    mockFetchSuccess({ suggestions: mockSuggestions });

    render(<ConflictSuggestionsList conflictId="conflict-001" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Recommended strategy")).toBeInTheDocument();
    });
  });

  it("shows impact estimate for each suggestion", async () => {
    mockFetchSuccess({ suggestions: mockSuggestions });

    render(<ConflictSuggestionsList conflictId="conflict-001" />);

    await waitFor(() => {
      expect(screen.getByText(/Delays lower-priority project/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Eliminates conflict/)).toBeInTheDocument();
  });

  it("shows empty state when no suggestions", async () => {
    mockFetchSuccess({ suggestions: [] });

    render(<ConflictSuggestionsList conflictId="conflict-001" />);

    await waitFor(() => {
      expect(screen.getByText(/No automatic suggestions available/)).toBeInTheDocument();
    });
  });

  it("shows error on fetch failure", async () => {
    mockFetchError(404, "Conflict 'conflict-missing' not found");

    render(<ConflictSuggestionsList conflictId="conflict-missing" />);

    await waitFor(() => {
      expect(screen.getByText(/Conflict 'conflict-missing' not found/)).toBeInTheDocument();
    });
  });

  it("renders action items for suggestions", async () => {
    mockFetchSuccess({ suggestions: mockSuggestions });

    render(<ConflictSuggestionsList conflictId="conflict-001" />);

    await waitFor(() => {
      expect(screen.getByText(/Define priority order/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Configure separate branches/)).toBeInTheDocument();
  });
});
