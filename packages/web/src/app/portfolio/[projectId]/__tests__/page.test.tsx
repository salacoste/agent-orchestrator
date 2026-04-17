import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the services module before importing the page
vi.mock("@/lib/services", () => ({
  getServices: vi.fn(),
  getSCM: vi.fn(),
}));

// Mock the serialize module
vi.mock("@/lib/serialize", () => ({
  sessionToDashboard: vi.fn(),
  resolveProject: vi.fn(),
  enrichSessionPR: vi.fn(),
  enrichSessionsMetadata: vi.fn(),
  computeStats: vi.fn(() => ({
    totalSessions: 0,
    workingSessions: 0,
    openPRs: 0,
    needsReview: 0,
  })),
}));

// Mock the cache module
vi.mock("@/lib/cache", () => ({
  prCache: {
    get: vi.fn(),
    set: vi.fn(),
  },
  prCacheKey: vi.fn(() => "cache-key"),
}));

// Mock the enrich-project-sessions module
vi.mock("@/lib/enrich-project-sessions", () => ({
  enrichProjectSessions: vi.fn(() => Promise.resolve([])),
}));

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock Dashboard component
vi.mock("@/components/Dashboard", () => ({
  Dashboard: () => <div data-testid="dashboard-mock">Dashboard</div>,
}));

// Import after mocks are set up
import {
  ProjectNotFound,
  ProjectBreadcrumb,
  ProjectHeader,
} from "@/components/ProjectDetailComponents";
import type { PortfolioProject } from "@/lib/types";

// Mock project data for testing
const mockProject: PortfolioProject = {
  id: "test-project",
  name: "Test Project",
  status: "active",
  activeAgents: 3,
  stories: {
    backlog: 5,
    inProgress: 2,
    done: 8,
    blocked: 1,
  },
  lastActivity: new Date().toISOString(),
};

describe("ProjectNotFound", () => {
  it("displays project ID in error message", () => {
    render(<ProjectNotFound projectId="non-existent-project" />);

    expect(screen.getByText("Project Not Found")).toBeInTheDocument();
    expect(screen.getByText("non-existent-project")).toBeInTheDocument();
    expect(screen.getByText(/could not be found\. It may have been removed/)).toBeInTheDocument();
  });

  it("has return to portfolio button", () => {
    render(<ProjectNotFound projectId="invalid-id" />);

    const returnLink = screen.getByRole("link", { name: /return to portfolio/i });
    expect(returnLink).toHaveAttribute("href", "/portfolio");
  });

  it("has portfolio breadcrumb link at top", () => {
    render(<ProjectNotFound projectId="test-project" />);

    const portfolioLinks = screen.getAllByRole("link", { name: /portfolio/i });
    expect(portfolioLinks.length).toBeGreaterThanOrEqual(1);
    expect(portfolioLinks[0]).toHaveAttribute("href", "/portfolio");
  });

  it("displays error icon", () => {
    const { container } = render(<ProjectNotFound projectId="test" />);

    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });

  it("has accessible section label", () => {
    render(<ProjectNotFound projectId="test" />);

    expect(screen.getByLabelText("Project Not Found")).toBeInTheDocument();
  });

  it("uses ← text pattern for breadcrumb link (Team Decision)", () => {
    render(<ProjectNotFound projectId="test" />);

    // The link should contain "← Portfolio" text
    const portfolioLinks = screen.getAllByRole("link", { name: /portfolio/i });
    expect(portfolioLinks[0]).toHaveTextContent("← Portfolio");
  });
});

describe("ProjectBreadcrumb", () => {
  it("displays project name", () => {
    render(<ProjectBreadcrumb projectName="My Awesome Project" />);

    expect(screen.getByText("My Awesome Project")).toBeInTheDocument();
  });

  it("has link to portfolio", () => {
    render(<ProjectBreadcrumb projectName="Test Project" />);

    const portfolioLink = screen.getByRole("link", { name: /← portfolio/i });
    expect(portfolioLink).toHaveAttribute("href", "/portfolio");
  });

  it("has separator between portfolio and project name", () => {
    render(<ProjectBreadcrumb projectName="Another Project" />);

    expect(screen.getByText("/", { exact: true })).toBeInTheDocument();
  });

  it("marks current page with aria-current", () => {
    render(<ProjectBreadcrumb projectName="Current Project" />);

    const currentPage = screen.getByText("Current Project");
    expect(currentPage).toHaveAttribute("aria-current", "page");
  });

  it("has proper navigation semantics", () => {
    render(<ProjectBreadcrumb projectName="Semantic Project" />);

    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(nav).toBeInTheDocument();

    // ol has implicit list role
    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();
  });

  it("has focus ring styles on portfolio link", () => {
    render(<ProjectBreadcrumb projectName="Focus Test Project" />);

    const portfolioLink = screen.getByRole("link", { name: /← portfolio/i });
    expect(portfolioLink.className).toContain("focus-visible:ring-2");
  });

  it("uses ← Portfolio text pattern (Team Decision from Story 49.3)", () => {
    render(<ProjectBreadcrumb projectName="Pattern Test" />);

    // The link text should be "← Portfolio" per team decision
    const portfolioLink = screen.getByRole("link", { name: /← portfolio/i });
    expect(portfolioLink).toBeInTheDocument();
    expect(portfolioLink).toHaveTextContent("← Portfolio");
  });
});

describe("ProjectHeader (AC#2 - Project Name Displayed Prominently)", () => {
  it("displays project name prominently as h1", () => {
    render(<ProjectHeader project={mockProject} />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Test Project");
    expect(heading.tagName).toBe("H1");
  });

  it("displays project status with color indicator", () => {
    render(<ProjectHeader project={mockProject} />);

    expect(screen.getByLabelText("Status: Active")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("displays active agent count when greater than 0", () => {
    render(<ProjectHeader project={mockProject} />);

    expect(screen.getByText("3 active agents")).toBeInTheDocument();
  });

  it("does not display agent count when 0", () => {
    const idleProject: PortfolioProject = {
      ...mockProject,
      id: "idle-project",
      name: "Idle Project",
      status: "idle",
      activeAgents: 0,
    };
    render(<ProjectHeader project={idleProject} />);

    expect(screen.queryByText(/active agent/i)).not.toBeInTheDocument();
  });

  it("shows correct status badge for idle projects", () => {
    const idleProject: PortfolioProject = {
      ...mockProject,
      id: "idle-project",
      name: "Idle Project",
      status: "idle",
    };
    render(<ProjectHeader project={idleProject} />);

    expect(screen.getByText("Idle")).toBeInTheDocument();
  });

  it("shows correct status badge for error projects", () => {
    const errorProject: PortfolioProject = {
      ...mockProject,
      id: "error-project",
      name: "Error Project",
      status: "error",
    };
    render(<ProjectHeader project={errorProject} />);

    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});
