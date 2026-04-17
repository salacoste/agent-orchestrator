import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PortfolioGrid } from "../PortfolioGrid";
import type { PortfolioProject } from "@/lib/types";

const mockProjects: PortfolioProject[] = [
  {
    id: "project-1",
    name: "Project One",
    status: "active",
    activeAgents: 2,
    stories: { backlog: 3, inProgress: 1, done: 5, blocked: 0 },
    lastActivity: new Date().toISOString(),
  },
  {
    id: "project-2",
    name: "Project Two",
    status: "idle",
    activeAgents: 0,
    stories: { backlog: 1, inProgress: 0, done: 2, blocked: 1 },
    lastActivity: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "project-3",
    name: "Project Three",
    status: "error",
    activeAgents: 0,
    stories: { backlog: 0, inProgress: 0, done: 0, blocked: 0 },
  },
];

describe("PortfolioGrid", () => {
  it("renders responsive grid structure", () => {
    render(<PortfolioGrid projects={mockProjects} />);
    const grid = screen.getByRole("list");
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("grid-cols-1");
    expect(grid).toHaveClass("md:grid-cols-2");
    expect(grid).toHaveClass("lg:grid-cols-3");
  });

  it("renders all project cards", () => {
    render(<PortfolioGrid projects={mockProjects} />);
    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(3);
  });

  it("renders project names in cards", () => {
    render(<PortfolioGrid projects={mockProjects} />);
    expect(screen.getByText("Project One")).toBeInTheDocument();
    expect(screen.getByText("Project Two")).toBeInTheDocument();
    expect(screen.getByText("Project Three")).toBeInTheDocument();
  });

  it("renders empty grid when no projects", () => {
    render(<PortfolioGrid projects={[]} />);
    const grid = screen.getByRole("list");
    expect(grid).toBeEmptyDOMElement();
  });
});
