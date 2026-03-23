/**
 * FocusMode component tests (Story 44.6).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { FocusMode } from "../FocusMode";
import { useCallback, useEffect, useState } from "react";

/**
 * Minimal harness that replicates the Escape key integration
 * from WorkflowDashboard without importing the full component.
 */
function FocusHarness() {
  const [focusAgent, setFocusAgent] = useState<{ id: string; displayName: string } | null>(null);

  const handleClose = useCallback(() => setFocusAgent(null), []);

  useEffect(() => {
    if (!focusAgent) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setFocusAgent(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [focusAgent]);

  if (focusAgent) {
    return (
      <div data-testid="harness-focus">
        <FocusMode
          agentId={focusAgent.id}
          agentDisplayName={focusAgent.displayName}
          onClose={handleClose}
        />
      </div>
    );
  }

  return (
    <div data-testid="harness-grid">
      <button
        data-testid="enter-focus"
        onClick={() => setFocusAgent({ id: "agent-1", displayName: "Agent Alpha" })}
      >
        Enter Focus
      </button>
    </div>
  );
}

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/activity")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            events: [
              { type: "file_modify", timestamp: "2026-03-23T10:00:00Z", file: "src/index.ts" },
              { type: "file_create", timestamp: "2026-03-23T10:01:00Z", file: "src/utils.ts" },
              { type: "test", timestamp: "2026-03-23T10:02:00Z", description: "5 tests passed" },
            ],
          }),
      });
    }
    if (url.includes("/logs")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ logs: ["line 1", "line 2"] }),
      });
    }
    // Agent data endpoint
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          id: "agent-1",
          name: "Agent Alpha",
          story: "44-6-focus-mode",
          status: "running",
        }),
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FocusMode", () => {
  it("renders focus mode container", () => {
    render(<FocusMode agentId="agent-1" agentDisplayName="Agent Alpha" onClose={vi.fn()} />);

    expect(screen.getByTestId("focus-mode")).toBeInTheDocument();
  });

  it("renders breadcrumb with agent name", () => {
    render(<FocusMode agentId="agent-1" agentDisplayName="Agent Alpha" onClose={vi.fn()} />);

    expect(screen.getByTestId("focus-breadcrumb")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    // Agent name appears in both breadcrumb and header — check breadcrumb specifically
    expect(screen.getByTestId("focus-breadcrumb")).toHaveTextContent("Agent Alpha");
  });

  it("clicking Dashboard breadcrumb calls onClose", () => {
    const onClose = vi.fn();
    render(<FocusMode agentId="agent-1" agentDisplayName="Agent Alpha" onClose={onClose} />);

    fireEvent.click(screen.getByTestId("breadcrumb-back"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders agent status header with story and status", async () => {
    render(<FocusMode agentId="agent-1" agentDisplayName="Agent Alpha" onClose={vi.fn()} />);

    expect(screen.getByTestId("focus-agent-header")).toBeInTheDocument();
    // Agent name in header (use within to scope to header)
    expect(screen.getByTestId("focus-agent-header")).toHaveTextContent("Agent Alpha");

    await waitFor(() => {
      expect(screen.getByText("Story: 44-6-focus-mode")).toBeInTheDocument();
    });

    expect(screen.getByTestId("focus-agent-status")).toHaveTextContent("running");
  });

  it("renders log stream section", () => {
    render(<FocusMode agentId="agent-1" agentDisplayName="Agent Alpha" onClose={vi.fn()} />);

    expect(screen.getByTestId("focus-log-stream")).toBeInTheDocument();
    expect(screen.getByTestId("log-stream")).toBeInTheDocument();
  });

  it("renders modified files from activity events", async () => {
    render(<FocusMode agentId="agent-1" agentDisplayName="Agent Alpha" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("src/index.ts")).toBeInTheDocument();
    });

    expect(screen.getByText("src/utils.ts")).toBeInTheDocument();
    expect(screen.getByText("Modified Files (2)")).toBeInTheDocument();
  });

  it("renders test results from activity events", async () => {
    render(<FocusMode agentId="agent-1" agentDisplayName="Agent Alpha" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("5 tests passed")).toBeInTheDocument();
    });

    expect(screen.getByText("Test Results (1)")).toBeInTheDocument();
  });

  it("shows empty states when no files or tests", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/activity")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ events: [] }),
        });
      }
      if (url.includes("/logs")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ logs: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: "agent-1" }),
      });
    });

    render(<FocusMode agentId="agent-1" agentDisplayName="Agent Alpha" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("No file changes yet.")).toBeInTheDocument();
    });

    expect(screen.getByText("No test results yet.")).toBeInTheDocument();
  });

  it("displays error on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<FocusMode agentId="agent-1" agentDisplayName="Agent Alpha" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("focus-error")).toBeInTheDocument();
    });

    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("shows loading skeleton before data arrives", () => {
    // Mock fetch that never resolves
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<FocusMode agentId="agent-1" agentDisplayName="Agent Alpha" onClose={vi.fn()} />);

    expect(screen.getByTestId("focus-loading")).toBeInTheDocument();
  });
});

describe("FocusMode Escape key integration", () => {
  it("pressing Escape exits focus mode and returns to grid", () => {
    render(<FocusHarness />);

    // Initially shows grid, not focus
    expect(screen.getByTestId("harness-grid")).toBeInTheDocument();

    // Enter focus mode
    act(() => {
      fireEvent.click(screen.getByTestId("enter-focus"));
    });

    expect(screen.getByTestId("harness-focus")).toBeInTheDocument();
    expect(screen.queryByTestId("harness-grid")).not.toBeInTheDocument();

    // Press Escape → returns to grid
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(screen.getByTestId("harness-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("harness-focus")).not.toBeInTheDocument();
  });

  it("clicking agent enters focus mode and hides grid", () => {
    render(<FocusHarness />);

    act(() => {
      fireEvent.click(screen.getByTestId("enter-focus"));
    });

    expect(screen.getByTestId("focus-mode")).toBeInTheDocument();
    expect(screen.queryByTestId("harness-grid")).not.toBeInTheDocument();
  });
});
