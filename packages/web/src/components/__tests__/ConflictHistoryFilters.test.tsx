import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConflictHistoryFilters } from "../ConflictHistoryFilters";
import type { ConflictHistoryFilter } from "@composio/ao-core";

describe("ConflictHistoryFilters", () => {
  it("renders all filter inputs", () => {
    const onFilterChange = vi.fn();
    render(<ConflictHistoryFilters filter={{}} onFilterChange={onFilterChange} />);

    expect(screen.getByLabelText("From")).toBeDefined();
    expect(screen.getByLabelText("To")).toBeDefined();
    expect(screen.getByLabelText("Resource Type")).toBeDefined();
    expect(screen.getByLabelText("Project")).toBeDefined();
    expect(screen.getByLabelText("Outcome")).toBeDefined();
    expect(screen.getByText("Clear")).toBeDefined();
  });

  it("calls onFilterChange when date from changes", () => {
    const onFilterChange = vi.fn();
    render(<ConflictHistoryFilters filter={{}} onFilterChange={onFilterChange} />);

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-04-01" } });
    expect(onFilterChange).toHaveBeenCalledWith({ dateFrom: "2026-04-01" });
  });

  it("calls onFilterChange when resource type changes", () => {
    const onFilterChange = vi.fn();
    render(<ConflictHistoryFilters filter={{}} onFilterChange={onFilterChange} />);

    fireEvent.change(screen.getByLabelText("Resource Type"), { target: { value: "agent" } });
    expect(onFilterChange).toHaveBeenCalledWith({ resourceType: "agent" });
  });

  it("calls onFilterChange when outcome changes", () => {
    const onFilterChange = vi.fn();
    render(<ConflictHistoryFilters filter={{}} onFilterChange={onFilterChange} />);

    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "resolved" } });
    expect(onFilterChange).toHaveBeenCalledWith({ resolutionOutcome: "resolved" });
  });

  it("calls onFilterChange when project changes", () => {
    const onFilterChange = vi.fn();
    render(<ConflictHistoryFilters filter={{}} onFilterChange={onFilterChange} />);

    fireEvent.change(screen.getByLabelText("Project"), { target: { value: "proj-a" } });
    expect(onFilterChange).toHaveBeenCalledWith({ projectId: "proj-a" });
  });

  it("clears all filters when Clear button clicked", () => {
    const onFilterChange = vi.fn();
    const filter: ConflictHistoryFilter = { dateFrom: "2026-04-01", resourceType: "agent" };
    render(<ConflictHistoryFilters filter={filter} onFilterChange={onFilterChange} />);

    fireEvent.click(screen.getByText("Clear"));
    expect(onFilterChange).toHaveBeenCalledWith({});
  });

  it("displays current filter values", () => {
    const onFilterChange = vi.fn();
    render(
      <ConflictHistoryFilters
        filter={{ dateFrom: "2026-04-01", projectId: "my-proj" }}
        onFilterChange={onFilterChange}
      />,
    );

    expect(screen.getByLabelText("From")).toHaveValue("2026-04-01");
    expect(screen.getByLabelText("Project")).toHaveValue("my-proj");
  });
});
