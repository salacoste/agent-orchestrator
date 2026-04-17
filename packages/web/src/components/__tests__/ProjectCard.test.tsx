import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProjectCard } from "../ProjectCard";
import type { PortfolioProject } from "@/lib/types";

const mockProject: PortfolioProject = {
  id: "my-project",
  name: "My Project",
  status: "active",
  activeAgents: 3,
  totalAgents: 5,
  stories: {
    backlog: 5,
    inProgress: 2,
    done: 8,
    blocked: 1,
  },
  lastActivity: new Date().toISOString(),
};

const emptyProject: PortfolioProject = {
  id: "empty-project",
  name: "Empty Project",
  status: "idle",
  activeAgents: 0,
  totalAgents: 0,
  stories: {
    backlog: 0,
    inProgress: 0,
    done: 0,
    blocked: 0,
  },
};

const errorProject: PortfolioProject = {
  id: "error-project",
  name: "Error Project",
  status: "error",
  activeAgents: 0,
  totalAgents: 1,
  stories: {
    backlog: 0,
    inProgress: 0,
    done: 0,
    blocked: 0,
  },
};

describe("ProjectCard", () => {
  it("renders project name", () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText("My Project")).toBeInTheDocument();
  });

  it("displays story counts by status", () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText("2")).toBeInTheDocument(); // in-progress count
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("shows empty state for zero stories", () => {
    render(<ProjectCard project={emptyProject} />);
    expect(screen.getByText("Empty Project")).toBeInTheDocument();
    // No story badges should be present
    expect(screen.queryByText("In Progress")).not.toBeInTheDocument();
  });

  it("shows status indicator with aria-label for active projects", () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByLabelText("Status: Active")).toBeInTheDocument();
  });

  it("shows status indicator with aria-label for idle projects", () => {
    render(<ProjectCard project={emptyProject} />);
    expect(screen.getByLabelText("Status: Idle")).toBeInTheDocument();
  });

  it("shows status indicator with aria-label for error projects", () => {
    render(<ProjectCard project={errorProject} />);
    expect(screen.getByLabelText("Status: Error")).toBeInTheDocument();
  });

  it("has correct semantic structure for accessibility", () => {
    render(<ProjectCard project={mockProject} />);
    const article = screen.getByRole("listitem");
    expect(article).toBeInTheDocument();
    expect(article.tagName).toBe("ARTICLE");
  });

  it("is keyboard focusable", () => {
    render(<ProjectCard project={mockProject} />);
    const article = screen.getByRole("listitem");
    expect(article).toHaveAttribute("tabIndex", "0");
  });

  it("has role='button' when onClick is provided for interactivity", () => {
    render(<ProjectCard project={mockProject} onClick={() => {}} />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe("ARTICLE");
  });

  it("has role='listitem' when no onClick (static display)", () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByRole("listitem")).toBeInTheDocument();
  });

  // Navigation tests (Story 49.3)
  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<ProjectCard project={mockProject} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("calls onClick when Enter is pressed", () => {
    const onClick = vi.fn();
    render(<ProjectCard project={mockProject} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("has cursor-pointer class when onClick is provided", () => {
    render(<ProjectCard project={mockProject} onClick={() => {}} />);
    expect(screen.getByRole("button")).toHaveClass("cursor-pointer");
  });

  it("has hover transform class for lift effect", () => {
    render(<ProjectCard project={mockProject} onClick={() => {}} />);
    expect(screen.getByRole("button")).toHaveClass("hover:-translate-y-0.5");
  });

  it("has focus ring for accessibility", () => {
    render(<ProjectCard project={mockProject} onClick={() => {}} />);
    const card = screen.getByRole("button");
    expect(card).toHaveClass("focus:ring-2");
    expect(card).toHaveClass("focus:ring-blue-500");
  });

  it("handles undefined onClick gracefully (backward compat)", () => {
    render(<ProjectCard project={mockProject} />);
    // Without onClick, card has role="listitem" (static display)
    const card = screen.getByRole("listitem");
    expect(card).toBeInTheDocument();
    // Should not throw when clicked without onClick
    fireEvent.click(card);
    // Test passes if no error is thrown
  });

  it("does not respond to Space key (only Enter)", () => {
    const onClick = vi.fn();
    render(<ProjectCard project={mockProject} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    expect(onClick).not.toHaveBeenCalled();
  });

  // Story 49.4: Change Highlight Tests (AC5)
  it("shows highlight animation when lastUpdated is recent", () => {
    const highlightedProject: PortfolioProject = {
      ...mockProject,
      lastUpdated: Date.now(), // Just updated
    };
    render(<ProjectCard project={highlightedProject} />);
    const card = screen.getByRole("listitem");
    expect(card.className).toContain("highlight-pulse");
  });

  it("does not show highlight animation when lastUpdated is old", () => {
    const oldProject: PortfolioProject = {
      ...mockProject,
      lastUpdated: Date.now() - 5000, // 5 seconds ago (older than 1s duration)
    };
    render(<ProjectCard project={oldProject} />);
    const card = screen.getByRole("listitem");
    expect(card.className).not.toContain("highlight-pulse");
  });

  it("does not show highlight animation when lastUpdated is undefined", () => {
    render(<ProjectCard project={mockProject} />);
    const card = screen.getByRole("listitem");
    expect(card.className).not.toContain("highlight-pulse");
  });

  // Story 50.1: Shared Pool Badge Tests
  it("renders shared pool badge when pool is enabled", () => {
    const poolProject: PortfolioProject = {
      ...mockProject,
      sharedPool: { enabled: true, eligibleProjects: ["proj-b", "proj-c"] },
    };
    render(<ProjectCard project={poolProject} />);
    expect(screen.getByText("Pool")).toBeInTheDocument();
    expect(screen.getByLabelText(/Shared pool.*2 projects/)).toBeInTheDocument();
  });

  it("does not render pool badge when sharedPool is undefined", () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.queryByText("Pool")).not.toBeInTheDocument();
  });

  it("does not render pool badge when sharedPool is disabled", () => {
    const disabledPoolProject: PortfolioProject = {
      ...mockProject,
      sharedPool: { enabled: false, eligibleProjects: ["proj-b"] },
    };
    render(<ProjectCard project={disabledPoolProject} />);
    expect(screen.queryByText("Pool")).not.toBeInTheDocument();
  });

  // Story 50.2: Reservation display
  it("shows reserved count in pool badge when agents are reserved", () => {
    const reservedProject: PortfolioProject = {
      ...mockProject,
      sharedPool: {
        enabled: true,
        eligibleProjects: ["proj-b"],
        reservedAgents: ["critical-agent", "backup-agent"],
      },
    };
    render(<ProjectCard project={reservedProject} />);
    expect(screen.getByText(/Pool \(2 reserved\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/2 reserved/)).toBeInTheDocument();
  });

  it("does not show reserved count when reservedAgents is empty", () => {
    const noReservedProject: PortfolioProject = {
      ...mockProject,
      sharedPool: {
        enabled: true,
        eligibleProjects: ["proj-b"],
        reservedAgents: [],
      },
    };
    render(<ProjectCard project={noReservedProject} />);
    expect(screen.getByText("Pool")).toBeInTheDocument();
    expect(screen.queryByText(/reserved/)).not.toBeInTheDocument();
  });

  // Story 50.4: Pool agents available display (AC #7)
  it("shows pool agents available count from other projects", () => {
    const poolProject: PortfolioProject = {
      ...mockProject,
      sharedPool: { enabled: true, eligibleProjects: ["proj-b"] },
      poolAgentsAvailable: [
        { agentId: "agent-1", sourceProjectId: "proj-b", sourceProjectName: "Project B" },
        { agentId: "agent-2", sourceProjectId: "proj-b", sourceProjectName: "Project B" },
      ],
    };
    render(<ProjectCard project={poolProject} />);
    expect(screen.getByText("2 pool agents available")).toBeInTheDocument();
    expect(screen.getByText(/2 from Project B/)).toBeInTheDocument();
  });

  it("shows singular form for single pool agent", () => {
    const poolProject: PortfolioProject = {
      ...mockProject,
      sharedPool: { enabled: true, eligibleProjects: ["proj-b"] },
      poolAgentsAvailable: [
        { agentId: "agent-1", sourceProjectId: "proj-b", sourceProjectName: "Project B" },
      ],
    };
    render(<ProjectCard project={poolProject} />);
    expect(screen.getByText("1 pool agent available")).toBeInTheDocument();
  });

  it("groups pool agents by source project", () => {
    const poolProject: PortfolioProject = {
      ...mockProject,
      sharedPool: { enabled: true, eligibleProjects: ["proj-b", "proj-c"] },
      poolAgentsAvailable: [
        { agentId: "agent-1", sourceProjectId: "proj-b", sourceProjectName: "Project B" },
        { agentId: "agent-2", sourceProjectId: "proj-c", sourceProjectName: "Project C" },
      ],
    };
    render(<ProjectCard project={poolProject} />);
    expect(screen.getByText("2 pool agents available")).toBeInTheDocument();
    expect(screen.getByText(/1 from Project B/)).toBeInTheDocument();
    expect(screen.getByText(/1 from Project C/)).toBeInTheDocument();
  });

  it("does not show pool agents section when no pool agents available", () => {
    const poolProject: PortfolioProject = {
      ...mockProject,
      sharedPool: { enabled: true, eligibleProjects: ["proj-b"] },
    };
    render(<ProjectCard project={poolProject} />);
    expect(screen.queryByText(/pool agent/)).not.toBeInTheDocument();
  });

  // Story 50.5: Utilization badge tests
  it("shows utilization percentage badge when totalAgents > 0", () => {
    render(<ProjectCard project={mockProject} />);
    // 3 active / 5 total = 60%
    expect(screen.getByLabelText("Utilization: 60%")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("does not show utilization badge when totalAgents is 0", () => {
    render(<ProjectCard project={emptyProject} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  // Story 50.6: Capacity badge tests
  it("shows capacity badge when capacityStatus is present with maxCapacity > 0", () => {
    const capacityProject: PortfolioProject = {
      ...mockProject,
      capacityStatus: {
        maxCapacity: 5,
        availableSlots: 2,
        isAtCapacity: false,
        isNearCapacity: false,
        utilizationPercent: 60,
      },
    };
    render(<ProjectCard project={capacityProject} />);
    expect(screen.getByText("2 free")).toBeInTheDocument();
    expect(screen.getByLabelText("2 slots available")).toBeInTheDocument();
  });

  it("shows 'Full' when agent is at capacity", () => {
    const fullProject: PortfolioProject = {
      ...mockProject,
      capacityStatus: {
        maxCapacity: 5,
        availableSlots: 0,
        isAtCapacity: true,
        isNearCapacity: false,
        utilizationPercent: 100,
      },
    };
    render(<ProjectCard project={fullProject} />);
    expect(screen.getByText("Full")).toBeInTheDocument();
    expect(screen.getByLabelText("At full capacity")).toBeInTheDocument();
  });

  it("shows near-capacity label when utilization >= 80%", () => {
    const nearProject: PortfolioProject = {
      ...mockProject,
      capacityStatus: {
        maxCapacity: 5,
        availableSlots: 1,
        isAtCapacity: false,
        isNearCapacity: true,
        utilizationPercent: 80,
      },
    };
    render(<ProjectCard project={nearProject} />);
    expect(screen.getByText("1 free")).toBeInTheDocument();
    expect(screen.getByLabelText("Near capacity (80%)")).toBeInTheDocument();
  });

  it("does not show capacity badge when capacityStatus is undefined", () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.queryByText(/free/)).not.toBeInTheDocument();
    expect(screen.queryByText("Full")).not.toBeInTheDocument();
  });

  it("does not show capacity badge when maxCapacity is 0", () => {
    const zeroCapacity: PortfolioProject = {
      ...mockProject,
      capacityStatus: {
        maxCapacity: 0,
        availableSlots: 0,
        isAtCapacity: false,
        isNearCapacity: false,
        utilizationPercent: 0,
      },
    };
    render(<ProjectCard project={zeroCapacity} />);
    expect(screen.queryByText(/free/)).not.toBeInTheDocument();
    expect(screen.queryByText("Full")).not.toBeInTheDocument();
  });
});
