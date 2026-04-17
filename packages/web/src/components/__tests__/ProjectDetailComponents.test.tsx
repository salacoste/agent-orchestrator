import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectNotFound, ProjectBreadcrumb, ProjectHeader } from "../ProjectDetailComponents";
import type { PortfolioProject } from "@/lib/types";

const baseProject: PortfolioProject = {
  id: "my-project",
  name: "My Project",
  status: "active",
  activeAgents: 2,
  stories: { backlog: 3, inProgress: 1, done: 5, blocked: 0 },
};

describe("ProjectNotFound", () => {
  it("renders project ID in error message", () => {
    render(<ProjectNotFound projectId="missing-proj" />);
    expect(screen.getByText("Project Not Found")).toBeInTheDocument();
    expect(screen.getByText("missing-proj")).toBeInTheDocument();
  });

  it("has return to portfolio link", () => {
    render(<ProjectNotFound projectId="x" />);
    expect(screen.getByText("Return to Portfolio")).toBeInTheDocument();
  });
});

describe("ProjectBreadcrumb", () => {
  it("renders project name as current page", () => {
    render(<ProjectBreadcrumb projectName="Backend API" />);
    expect(screen.getByText("Backend API")).toHaveAttribute("aria-current", "page");
  });

  it("has portfolio link", () => {
    render(<ProjectBreadcrumb projectName="Test" />);
    const portfolioLink = screen.getByRole("link", { name: /Portfolio/ });
    expect(portfolioLink).toBeInTheDocument();
    expect(portfolioLink).toHaveAttribute("href", "/portfolio");
  });
});

describe("ProjectHeader", () => {
  it("renders project name", () => {
    render(<ProjectHeader project={baseProject} />);
    expect(screen.getByText("My Project")).toBeInTheDocument();
  });

  it("shows Active status for active project", () => {
    render(<ProjectHeader project={baseProject} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows Idle status for idle project", () => {
    render(<ProjectHeader project={{ ...baseProject, status: "idle" }} />);
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });

  it("shows Error status for error project", () => {
    render(<ProjectHeader project={{ ...baseProject, status: "error" }} />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("shows active agents count", () => {
    render(<ProjectHeader project={baseProject} />);
    expect(screen.getByText("2 active agents")).toBeInTheDocument();
  });

  it("hides agents count when zero", () => {
    render(<ProjectHeader project={{ ...baseProject, activeAgents: 0 }} />);
    expect(screen.queryByText(/active agent/)).not.toBeInTheDocument();
  });

  // Story 50.1: Shared Pool Info Tests
  it("shows shared pool info when pool is enabled", () => {
    render(
      <ProjectHeader
        project={{
          ...baseProject,
          sharedPool: { enabled: true, eligibleProjects: ["proj-b", "proj-c"] },
        }}
      />,
    );
    expect(screen.getByText(/Shared pool enabled/)).toBeInTheDocument();
    expect(screen.getByText(/2 projects/)).toBeInTheDocument();
  });

  it("shows single eligible project name when only one", () => {
    render(
      <ProjectHeader
        project={{
          ...baseProject,
          sharedPool: { enabled: true, eligibleProjects: ["proj-b"] },
        }}
      />,
    );
    expect(screen.getByText(/proj-b/)).toBeInTheDocument();
  });

  it("shows no projects text when eligible list is empty", () => {
    render(
      <ProjectHeader
        project={{
          ...baseProject,
          sharedPool: { enabled: true, eligibleProjects: [] },
        }}
      />,
    );
    expect(screen.getByText(/no projects/)).toBeInTheDocument();
  });

  it("shows maxConcurrent when set", () => {
    render(
      <ProjectHeader
        project={{
          ...baseProject,
          sharedPool: { enabled: true, eligibleProjects: ["proj-b"], maxConcurrent: 3 },
        }}
      />,
    );
    expect(screen.getByText(/max 3 concurrent/)).toBeInTheDocument();
  });

  it("hides pool info when sharedPool is undefined", () => {
    render(<ProjectHeader project={baseProject} />);
    expect(screen.queryByText(/Shared pool/)).not.toBeInTheDocument();
  });

  it("hides pool info when sharedPool is disabled", () => {
    render(
      <ProjectHeader
        project={{
          ...baseProject,
          sharedPool: { enabled: false, eligibleProjects: ["proj-b"] },
        }}
      />,
    );
    expect(screen.queryByText(/Shared pool/)).not.toBeInTheDocument();
  });

  // Story 50.2: Reserved agent display
  it("shows reserved agent names when reservedAgents is set", () => {
    render(
      <ProjectHeader
        project={{
          ...baseProject,
          sharedPool: {
            enabled: true,
            eligibleProjects: ["proj-b"],
            reservedAgents: ["critical-api-agent", "backup-agent"],
          },
        }}
      />,
    );
    expect(screen.getByText(/2 reserved/)).toBeInTheDocument();
    expect(screen.getByText(/critical-api-agent, backup-agent/)).toBeInTheDocument();
  });

  it("does not show reserved info when reservedAgents is empty", () => {
    render(
      <ProjectHeader
        project={{
          ...baseProject,
          sharedPool: {
            enabled: true,
            eligibleProjects: ["proj-b"],
            reservedAgents: [],
          },
        }}
      />,
    );
    expect(screen.queryByText(/reserved/)).not.toBeInTheDocument();
  });

  it("does not show reserved info when reservedAgents is undefined", () => {
    render(
      <ProjectHeader
        project={{
          ...baseProject,
          sharedPool: { enabled: true, eligibleProjects: ["proj-b"] },
        }}
      />,
    );
    expect(screen.queryByText(/reserved/)).not.toBeInTheDocument();
  });
});
