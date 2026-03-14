import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { WorkflowPage } from "../WorkflowPage";

// --- Mock next/navigation ---
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: mockReplace }),
}));

// --- Mock useWorkflowSSE — capture callback for testing ---
let sseCallback: (() => void) | null = null;

vi.mock("@/hooks/useWorkflowSSE.js", () => ({
  useWorkflowSSE: vi.fn((cb: () => void) => {
    sseCallback = cb;
  }),
}));

// --- Mock fetch ---
const mockFetch = vi.fn();
global.fetch = mockFetch;

// --- Test fixtures ---
function makeWorkflowResponse(overrides: Record<string, unknown> = {}) {
  return {
    hasBmad: true,
    currentPhase: "implementation",
    phases: [],
    artifacts: [],
    agents: [],
    activity: [],
    ...overrides,
  };
}

function okResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

describe("WorkflowPage SSE integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sseCallback = null;
    mockFetch.mockReturnValue(okResponse(makeWorkflowResponse()));
  });

  it("re-fetches data when SSE callback fires", async () => {
    render(<WorkflowPage projects={["proj-a"]} />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/workflow/proj-a",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    // Simulate SSE workflow-change event
    const updatedData = makeWorkflowResponse({ currentPhase: "review" });
    mockFetch.mockReturnValueOnce(okResponse(updatedData));

    sseCallback!();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it("does not show loading skeleton on SSE-triggered re-fetch (AC3/WD-7)", async () => {
    const { container } = render(<WorkflowPage projects={["proj-a"]} />);

    // Wait for initial load to complete and dashboard to render
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      // Dashboard rendered — no loading skeleton (animate-pulse elements)
      expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
    });

    // Trigger SSE refresh — should NOT show loading skeleton
    const updatedData = makeWorkflowResponse({ currentPhase: "review" });
    mockFetch.mockReturnValueOnce(okResponse(updatedData));

    sseCallback!();

    // Loading skeleton (animate-pulse CSS class) should not appear during SSE refetch
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Dashboard should still be rendered after SSE refetch completes
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
  });

  it("fetches correct project after project switch + SSE event (AC5)", async () => {
    render(<WorkflowPage projects={["proj-a", "proj-b"]} />);

    // Wait for initial fetch for proj-a
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/workflow/proj-a",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    // Switch to proj-b
    const select = screen.getByRole("combobox", { name: /select project/i });
    fireEvent.change(select, { target: { value: "proj-b" } });

    // Wait for project-switch fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/workflow/proj-b",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    // Now trigger SSE — should fetch proj-b, not proj-a
    mockFetch.mockClear();
    mockFetch.mockReturnValueOnce(okResponse(makeWorkflowResponse()));

    sseCallback!();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/workflow/proj-b",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it("deduplicates rapid SSE events via AbortController (AC6)", async () => {
    render(<WorkflowPage projects={["proj-a"]} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Fire SSE callback rapidly 3 times
    // Each call should abort the previous in-flight fetch
    mockFetch.mockReturnValueOnce(okResponse(makeWorkflowResponse()));
    mockFetch.mockReturnValueOnce(okResponse(makeWorkflowResponse()));
    mockFetch.mockReturnValueOnce(okResponse(makeWorkflowResponse()));

    await act(async () => {
      sseCallback!();
      sseCallback!();
      sseCallback!();
    });

    // All 3 calls were made (fetch is called immediately), but first two were aborted
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(4); // 1 initial + 3 SSE
    });

    // Verify earlier fetches had their AbortSignals aborted
    // Calls: [0]=initial, [1]=SSE-1 (aborted), [2]=SSE-2 (aborted), [3]=SSE-3 (kept)
    const calls = mockFetch.mock.calls;
    const signal1 = (calls[1]![1] as { signal: AbortSignal }).signal;
    const signal2 = (calls[2]![1] as { signal: AbortSignal }).signal;
    const signal3 = (calls[3]![1] as { signal: AbortSignal }).signal;
    expect(signal1.aborted).toBe(true);
    expect(signal2.aborted).toBe(true);
    expect(signal3.aborted).toBe(false);
  });

  it("keeps existing data on silent fetch failure (WD-7)", async () => {
    render(<WorkflowPage projects={["proj-a"]} />);

    // Wait for initial successful load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Make SSE-triggered fetch fail
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: false, status: 500 }));

    sseCallback!();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Error alert should NOT appear (silent failure keeps LKG data)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
