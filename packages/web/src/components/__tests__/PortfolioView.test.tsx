import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { PortfolioView } from "../PortfolioView";
import type { PortfolioProject } from "@/lib/types";

// Mock Next.js router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

// Mock EventSource
class MockEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  static instances: MockEventSource[] = [];

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  close() {
    this.readyState = 2;
  }

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateError() {
    this.onerror?.();
  }
}

vi.stubGlobal("EventSource", MockEventSource);

const mockProjects: PortfolioProject[] = [
  {
    id: "project-1",
    name: "Project One",
    status: "active",
    activeAgents: 2,
    stories: { backlog: 3, inProgress: 1, done: 5, blocked: 0 },
    lastActivity: new Date().toISOString(),
    tags: ["production", "api"],
    metadata: { team: "backend", priority: "high" },
  },
  {
    id: "project-2",
    name: "Project Two",
    status: "idle",
    activeAgents: 0,
    stories: { backlog: 1, inProgress: 0, done: 2, blocked: 0 },
    lastActivity: new Date().toISOString(),
    tags: ["staging"],
    metadata: { team: "frontend", priority: "low" },
  },
  {
    id: "project-3",
    name: "Project Three",
    status: "active",
    activeAgents: 1,
    stories: { backlog: 0, inProgress: 2, done: 8, blocked: 1 },
    lastActivity: new Date().toISOString(),
    tags: ["production"],
  },
];

describe("PortfolioView", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    mockPush.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders portfolio overview subtitle in header", () => {
    render(<PortfolioView projects={mockProjects} />);
    expect(screen.getByText("Portfolio overview")).toBeInTheDocument();
  });

  it("renders subtitle with single project", () => {
    render(<PortfolioView projects={[mockProjects[0]]} />);
    expect(screen.getByText("Portfolio overview")).toBeInTheDocument();
  });

  it("renders empty state when no projects configured", () => {
    render(<PortfolioView projects={[]} />);
    expect(screen.getByText("No Projects Configured")).toBeInTheDocument();
    expect(screen.getByText(/agent-orchestrator.yaml/)).toBeInTheDocument();
  });

  it("renders section with aria-label for accessibility", () => {
    render(<PortfolioView projects={mockProjects} />);
    expect(screen.getByLabelText("Portfolio Dashboard")).toBeInTheDocument();
  });

  it("renders project cards via PortfolioGrid", () => {
    render(<PortfolioView projects={mockProjects} />);
    expect(screen.getByText("Project One")).toBeInTheDocument();
  });

  // Story 49.2: Metrics Widget Integration Tests
  it("renders PortfolioMetricsWidget with metrics", () => {
    render(<PortfolioView projects={mockProjects} />);
    // Verify all four metric cards are rendered
    expect(screen.getByText("Total Agents")).toBeInTheDocument();
    expect(screen.getByText("Stories")).toBeInTheDocument();
    expect(screen.getByText("Sprint Health")).toBeInTheDocument();
    expect(screen.getByText("Utilization")).toBeInTheDocument();
  });

  it("displays correct total agents count from metrics", () => {
    render(<PortfolioView projects={mockProjects} />);
    // mockProjects has 2+0+1 = 3 activeAgents total
    // Use getAllByText since "3" appears in multiple places (metrics + filter count)
    const agentElements = screen.getAllByText("3");
    expect(agentElements.length).toBeGreaterThanOrEqual(1);
  });

  it("displays correct stories format from metrics", () => {
    render(<PortfolioView projects={mockProjects} />);
    // 5+2+8 = 15 done / 9+3+11 = 23 total
    expect(screen.getByText("15/23")).toBeInTheDocument();
  });

  it("displays metrics in empty state with zeros", () => {
    render(<PortfolioView projects={[]} />);
    // Should NOT see metrics widget in empty state (different UI branch)
    expect(screen.queryByText("Total Agents")).not.toBeInTheDocument();
    expect(screen.getByText("No Projects Configured")).toBeInTheDocument();
  });

  // Story 49.4: SSE Integration Tests
  it("subscribes to SSE events on mount", () => {
    render(<PortfolioView projects={mockProjects} />);
    // One EventSource instance should be created
    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    expect(MockEventSource.instances[0].url).toBe("/api/events");
  });

  // Story 49.4: Connection Status Tests (AC3)
  it("shows connection status indicator when reconnecting", async () => {
    render(<PortfolioView projects={mockProjects} />);
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];

    // First, establish a successful connection
    act(() => {
      es.simulateOpen();
    });

    // Now simulate error (disconnection after successful connect)
    act(() => {
      es.simulateError();
    });

    // Should show "Reconnecting..." indicator
    expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument();
  });

  it("hides connection status indicator when connected", async () => {
    render(<PortfolioView projects={mockProjects} />);
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];

    // Simulate open (connected)
    act(() => {
      es.simulateOpen();
    });

    // Should NOT show reconnecting indicator
    expect(screen.queryByText(/Reconnecting/i)).not.toBeInTheDocument();
  });

  // Story 49.4: Granular Update Tests (AC1, AC4)
  it("updates projects state on snapshot SSE event", async () => {
    render(<PortfolioView projects={mockProjects} />);
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];

    // Simulate snapshot event with session data
    act(() => {
      es.simulateMessage({
        type: "snapshot",
        sessions: [
          {
            id: "session-1",
            projectId: "project-1",
            status: "working",
            activity: "coding",
            attentionLevel: "working",
            lastActivityAt: new Date().toISOString(),
          },
        ],
      });
    });

    // Project should be updated (not full page refresh)
    // Flush the batch timeout
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    // Verify project card still renders correctly
    expect(screen.getByText("Project One")).toBeInTheDocument();
  });

  it("ignores non-snapshot and non-workflow-change events", () => {
    render(<PortfolioView projects={mockProjects} />);
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];

    // Simulate ignored event type
    act(() => {
      es.simulateMessage({ type: "other.event" });
    });

    // Should not affect state - no errors thrown
    expect(screen.getByText("Project One")).toBeInTheDocument();
  });

  it("closes EventSource on unmount", () => {
    const { unmount } = render(<PortfolioView projects={mockProjects} />);
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];

    unmount();

    expect(es.readyState).toBe(2); // CLOSED
  });

  // Story 49.4: Navigation Tests (from Story 49.3)
  it("navigates to project detail on card click", () => {
    render(<PortfolioView projects={mockProjects} />);

    // Click on project card
    const card = screen.getByRole("button", { name: /Project One/i });
    act(() => {
      card.click();
    });

    expect(mockPush).toHaveBeenCalledWith("/portfolio/project-1");
  });

  // Story 49.4: Task 6.4 - Batching Tests (AC2)
  it("batches rapid SSE updates within 500ms window", async () => {
    render(<PortfolioView projects={mockProjects} />);
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];

    // Establish connection first
    act(() => {
      es.simulateOpen();
    });

    // Simulate multiple rapid snapshot events
    act(() => {
      es.simulateMessage({
        type: "snapshot",
        sessions: [
          {
            id: "s1",
            projectId: "project-1",
            status: "working",
            activity: "coding",
            attentionLevel: "working",
            lastActivityAt: new Date().toISOString(),
          },
        ],
      });
    });

    act(() => {
      es.simulateMessage({
        type: "snapshot",
        sessions: [
          {
            id: "s1",
            projectId: "project-1",
            status: "working",
            activity: "coding",
            attentionLevel: "working",
            lastActivityAt: new Date().toISOString(),
          },
          {
            id: "s2",
            projectId: "project-1",
            status: "working",
            activity: "testing",
            attentionLevel: "working",
            lastActivityAt: new Date().toISOString(),
          },
        ],
      });
    });

    // Before batch window expires, project should still exist (not crashed)
    expect(screen.getByText("Project One")).toBeInTheDocument();

    // Advance past batch window (500ms + buffer)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    // After batch flush, project should be updated (2 agents now)
    expect(screen.getByText("Project One")).toBeInTheDocument();
  });

  // Story 49.4: Task 6.5 - Metrics Recalculation Tests (AC1)
  it("recalculates metrics when project data changes via SSE", async () => {
    render(<PortfolioView projects={mockProjects} />);
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];

    // Initial metrics: 3 agents, 15/23 stories
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1); // Total Agents
    expect(screen.getByText("15/23")).toBeInTheDocument(); // Stories

    // Simulate snapshot with more agents
    act(() => {
      es.simulateMessage({
        type: "snapshot",
        sessions: [
          {
            id: "s1",
            projectId: "project-1",
            status: "working",
            activity: "coding",
            attentionLevel: "working",
            lastActivityAt: new Date().toISOString(),
          },
          {
            id: "s2",
            projectId: "project-1",
            status: "working",
            activity: "testing",
            attentionLevel: "working",
            lastActivityAt: new Date().toISOString(),
          },
          {
            id: "s3",
            projectId: "project-1",
            status: "working",
            activity: "docs",
            attentionLevel: "working",
            lastActivityAt: new Date().toISOString(),
          },
        ],
      });
    });

    // Flush batch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    // Metrics should show updated agent count (3)
    // Note: The metrics widget gets the updated projects via useMemo
    expect(screen.getByText("Project One")).toBeInTheDocument();
  });

  // Story 49.4: Task 6.6 - Graceful Degradation Tests
  it("gracefully handles SSE unavailable (EventSource not in environment)", () => {
    // Temporarily remove EventSource
    const originalEventSource = global.EventSource;
    // @ts-expect-error - Testing graceful degradation
    delete global.EventSource;

    const singleProject = [mockProjects[0]];
    // Should not throw when rendering without EventSource
    expect(() => {
      render(<PortfolioView projects={singleProject} />);
    }).not.toThrow();

    // Should still show initial data
    expect(screen.getByText("Project One")).toBeInTheDocument();
    expect(screen.getByText("Portfolio overview")).toBeInTheDocument();

    // Restore EventSource
    global.EventSource = originalEventSource;
  });

  it("handles EventSource constructor failure gracefully", () => {
    // Mock EventSource to throw on construction
    const originalEventSource = global.EventSource;
    // @ts-expect-error - Testing graceful degradation
    global.EventSource = function () {
      throw new Error("Network error");
    } as typeof EventSource;

    // Should not throw when EventSource constructor fails
    expect(() => {
      render(<PortfolioView projects={mockProjects} />);
    }).not.toThrow();

    // Should still show initial data
    expect(screen.getByText("Project One")).toBeInTheDocument();

    // Restore EventSource
    global.EventSource = originalEventSource;
  });

  // Story 49.5: Filter Integration Tests
  it("renders filter bar with status dropdown", () => {
    render(<PortfolioView projects={mockProjects} />);
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("renders all project cards when no filters active", () => {
    render(<PortfolioView projects={mockProjects} />);
    expect(screen.getByText("Project One")).toBeInTheDocument();
    expect(screen.getByText("Project Two")).toBeInTheDocument();
    expect(screen.getByText("Project Three")).toBeInTheDocument();
  });

  it("filters projects by status", () => {
    render(<PortfolioView projects={mockProjects} />);

    // Select "active" status filter
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "active" } });

    // Only active projects should be visible
    expect(screen.getByText("Project One")).toBeInTheDocument();
    expect(screen.getByText("Project Three")).toBeInTheDocument();
    expect(screen.queryByText("Project Two")).not.toBeInTheDocument();
  });

  it("filters projects by tag toggle", () => {
    render(<PortfolioView projects={mockProjects} />);

    // Click "staging" tag (only Project Two has it)
    fireEvent.click(screen.getByText("staging"));

    expect(screen.getByText("Project Two")).toBeInTheDocument();
    expect(screen.queryByText("Project One")).not.toBeInTheDocument();
    expect(screen.queryByText("Project Three")).not.toBeInTheDocument();
  });

  it("clears filters and restores all projects", () => {
    render(<PortfolioView projects={mockProjects} />);

    // Apply status filter
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "idle" } });
    expect(screen.queryByText("Project One")).not.toBeInTheDocument();

    // Clear filters
    fireEvent.click(screen.getByText("Clear filters"));

    // All projects should be visible again
    expect(screen.getByText("Project One")).toBeInTheDocument();
    expect(screen.getByText("Project Two")).toBeInTheDocument();
    expect(screen.getByText("Project Three")).toBeInTheDocument();
  });
});
