import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SprintFilterBar } from "../SprintFilterBar";
import { type SprintFilterState, EMPTY_SPRINT_FILTERS } from "@/lib/types";

const projects = [
  { id: "alpha", name: "Alpha" },
  { id: "beta", name: "Beta" },
];

const defaultProps = {
  filters: EMPTY_SPRINT_FILTERS,
  onFiltersChange: vi.fn(),
  availableProjects: projects,
  filteredCount: { filtered: 4, total: 4 },
};

describe("SprintFilterBar", () => {
  it("renders all filter controls", () => {
    render(<SprintFilterBar {...defaultProps} />);
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Health")).toBeInTheDocument();
    expect(screen.getByLabelText("Project")).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
  });

  it("changing status dropdown calls onFiltersChange with correct status", () => {
    const onChange = vi.fn();
    render(<SprintFilterBar {...defaultProps} onFiltersChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "active" } });
    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_SPRINT_FILTERS,
      status: "active",
    });
  });

  it("changing health dropdown calls onFiltersChange with correct health", () => {
    const onChange = vi.fn();
    render(<SprintFilterBar {...defaultProps} onFiltersChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Health"), { target: { value: "at-risk" } });
    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_SPRINT_FILTERS,
      health: "at-risk",
    });
  });

  it("changing project dropdown calls onFiltersChange with correct projectId", () => {
    const onChange = vi.fn();
    render(<SprintFilterBar {...defaultProps} onFiltersChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Project"), { target: { value: "alpha" } });
    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_SPRINT_FILTERS,
      projectId: "alpha",
    });
  });

  it("setting date start calls onFiltersChange with correct dateRange", () => {
    const onChange = vi.fn();
    render(<SprintFilterBar {...defaultProps} onFiltersChange={onChange} />);

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });
    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_SPRINT_FILTERS,
      dateRange: { start: "2026-01-01", end: "" },
    });
  });

  it("setting date end calls onFiltersChange with correct dateRange", () => {
    const onChange = vi.fn();
    render(<SprintFilterBar {...defaultProps} onFiltersChange={onChange} />);

    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-01-31" } });
    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_SPRINT_FILTERS,
      dateRange: { start: "", end: "2026-01-31" },
    });
  });

  it("clearing date input when both empty sets dateRange to null", () => {
    const onChange = vi.fn();
    // Start with only start date set, end empty
    const filtersWithStartOnly: SprintFilterState = {
      ...EMPTY_SPRINT_FILTERS,
      dateRange: { start: "2026-01-01", end: "" },
    };
    render(
      <SprintFilterBar
        {...defaultProps}
        filters={filtersWithStartOnly}
        onFiltersChange={onChange}
      />,
    );

    // Clear start — both now empty → dateRange becomes null
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith({
      ...EMPTY_SPRINT_FILTERS,
      dateRange: null,
    });
  });

  it('"Clear filters" button resets all filters', () => {
    const onChange = vi.fn();
    const activeFilters: SprintFilterState = {
      ...EMPTY_SPRINT_FILTERS,
      status: "active",
    };
    render(
      <SprintFilterBar {...defaultProps} filters={activeFilters} onFiltersChange={onChange} />,
    );

    fireEvent.click(screen.getByText("Clear filters"));
    expect(onChange).toHaveBeenCalledWith(EMPTY_SPRINT_FILTERS);
  });

  it('"Clear filters" button is hidden when no filters active', () => {
    render(<SprintFilterBar {...defaultProps} />);
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
  });

  it("displays correct filtered count when filters are active", () => {
    const activeFilters: SprintFilterState = {
      ...EMPTY_SPRINT_FILTERS,
      status: "active",
    };
    render(
      <SprintFilterBar
        {...defaultProps}
        filters={activeFilters}
        filteredCount={{ filtered: 2, total: 4 }}
      />,
    );
    expect(screen.getByText("Showing 2 of 4 sprints")).toBeInTheDocument();
  });

  it("displays total count when no filters are active", () => {
    render(<SprintFilterBar {...defaultProps} filteredCount={{ filtered: 4, total: 4 }} />);
    expect(screen.getByText("4 sprints")).toBeInTheDocument();
  });

  it("hides project dropdown when only one project", () => {
    render(
      <SprintFilterBar {...defaultProps} availableProjects={[{ id: "alpha", name: "Alpha" }]} />,
    );
    expect(screen.queryByLabelText("Project")).not.toBeInTheDocument();
  });
});
