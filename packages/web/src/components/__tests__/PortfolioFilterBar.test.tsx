import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PortfolioFilterBar } from "../PortfolioFilterBar.js";
import { EMPTY_FILTERS } from "@/lib/portfolio-filter";
import type { FilterState } from "@/lib/types";

const emptyFilters: FilterState = EMPTY_FILTERS;
const noMetadata: Record<string, string[]> = {};

describe("PortfolioFilterBar", () => {
  it("renders status filter with All option selected by default", () => {
    render(
      <PortfolioFilterBar
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        availableTags={[]}
        availableMetadata={noMetadata}
        projectCount={{ filtered: 5, total: 5 }}
      />,
    );
    const select = screen.getByLabelText("Status");
    expect(select).toBeInTheDocument();
    expect((select as HTMLSelectElement).value).toBe("");
  });

  it("calls onFiltersChange when status filter changes", () => {
    const onFiltersChange = vi.fn();
    render(
      <PortfolioFilterBar
        filters={emptyFilters}
        onFiltersChange={onFiltersChange}
        availableTags={[]}
        availableMetadata={noMetadata}
        projectCount={{ filtered: 5, total: 5 }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "active" } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, status: "active" });
  });

  it("renders available tags as toggle buttons", () => {
    render(
      <PortfolioFilterBar
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        availableTags={["production", "api"]}
        availableMetadata={noMetadata}
        projectCount={{ filtered: 5, total: 5 }}
      />,
    );
    expect(screen.getByText("production")).toBeInTheDocument();
    expect(screen.getByText("api")).toBeInTheDocument();
  });

  it("calls onFiltersChange when tag is toggled", () => {
    const onFiltersChange = vi.fn();
    render(
      <PortfolioFilterBar
        filters={emptyFilters}
        onFiltersChange={onFiltersChange}
        availableTags={["production"]}
        availableMetadata={noMetadata}
        projectCount={{ filtered: 5, total: 5 }}
      />,
    );
    fireEvent.click(screen.getByText("production"));
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, tags: ["production"] });
  });

  it("removes tag when clicking already-selected tag", () => {
    const onFiltersChange = vi.fn();
    const filtersWithTags: FilterState = { ...emptyFilters, tags: ["production"] };
    render(
      <PortfolioFilterBar
        filters={filtersWithTags}
        onFiltersChange={onFiltersChange}
        availableTags={["production"]}
        availableMetadata={noMetadata}
        projectCount={{ filtered: 3, total: 5 }}
      />,
    );
    fireEvent.click(screen.getByText("production"));
    expect(onFiltersChange).toHaveBeenCalledWith({ ...filtersWithTags, tags: [] });
  });

  it("does not show clear button when no filters active", () => {
    render(
      <PortfolioFilterBar
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        availableTags={[]}
        availableMetadata={noMetadata}
        projectCount={{ filtered: 5, total: 5 }}
      />,
    );
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
  });

  it("shows clear button when filters are active", () => {
    const filtersWithStatus: FilterState = { ...emptyFilters, status: "active" };
    render(
      <PortfolioFilterBar
        filters={filtersWithStatus}
        onFiltersChange={vi.fn()}
        availableTags={[]}
        availableMetadata={noMetadata}
        projectCount={{ filtered: 3, total: 5 }}
      />,
    );
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("resets all filters on clear", () => {
    const onFiltersChange = vi.fn();
    const filtersWithAll: FilterState = { status: "active", tags: ["production"], metadata: {} };
    render(
      <PortfolioFilterBar
        filters={filtersWithAll}
        onFiltersChange={onFiltersChange}
        availableTags={["production"]}
        availableMetadata={noMetadata}
        projectCount={{ filtered: 1, total: 5 }}
      />,
    );
    fireEvent.click(screen.getByText("Clear filters"));
    expect(onFiltersChange).toHaveBeenCalledWith(EMPTY_FILTERS);
  });

  it("shows total count when no filters active", () => {
    render(
      <PortfolioFilterBar
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        availableTags={[]}
        availableMetadata={noMetadata}
        projectCount={{ filtered: 5, total: 5 }}
      />,
    );
    expect(screen.getByText("5 projects")).toBeInTheDocument();
  });

  it("shows filtered/total count when filters active", () => {
    const filtersWithStatus: FilterState = { ...emptyFilters, status: "active" };
    render(
      <PortfolioFilterBar
        filters={filtersWithStatus}
        onFiltersChange={vi.fn()}
        availableTags={[]}
        availableMetadata={noMetadata}
        projectCount={{ filtered: 3, total: 5 }}
      />,
    );
    expect(screen.getByText("3 of 5 projects")).toBeInTheDocument();
  });

  it("does not render tag section when no tags available", () => {
    render(
      <PortfolioFilterBar
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        availableTags={[]}
        availableMetadata={noMetadata}
        projectCount={{ filtered: 5, total: 5 }}
      />,
    );
    expect(screen.queryByText("Tags")).not.toBeInTheDocument();
  });

  it("marks selected tags as aria-pressed", () => {
    const filtersWithTags: FilterState = { ...emptyFilters, tags: ["production"] };
    render(
      <PortfolioFilterBar
        filters={filtersWithTags}
        onFiltersChange={vi.fn()}
        availableTags={["production", "api"]}
        availableMetadata={noMetadata}
        projectCount={{ filtered: 3, total: 5 }}
      />,
    );
    expect(screen.getByText("production").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("api").getAttribute("aria-pressed")).toBe("false");
  });

  // Metadata filter tests (AC #5)
  it("renders metadata filter dropdowns when metadata keys available", () => {
    render(
      <PortfolioFilterBar
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        availableTags={[]}
        availableMetadata={{ team: ["backend", "frontend"], priority: ["high", "low"] }}
        projectCount={{ filtered: 5, total: 5 }}
      />,
    );
    expect(screen.getByLabelText("team")).toBeInTheDocument();
    expect(screen.getByLabelText("priority")).toBeInTheDocument();
  });

  it("does not render metadata section when no metadata available", () => {
    render(
      <PortfolioFilterBar
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        availableTags={[]}
        availableMetadata={noMetadata}
        projectCount={{ filtered: 5, total: 5 }}
      />,
    );
    // No metadata labels should exist
    expect(screen.queryByRole("combobox", { name: /team|priority/i })).not.toBeInTheDocument();
  });

  it("calls onFiltersChange when metadata filter changes", () => {
    const onFiltersChange = vi.fn();
    render(
      <PortfolioFilterBar
        filters={emptyFilters}
        onFiltersChange={onFiltersChange}
        availableTags={[]}
        availableMetadata={{ team: ["backend", "frontend"] }}
        projectCount={{ filtered: 5, total: 5 }}
      />,
    );
    fireEvent.change(screen.getByLabelText("team"), { target: { value: "backend" } });
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...emptyFilters,
      metadata: { team: "backend" },
    });
  });

  it("removes metadata key when selecting empty value", () => {
    const onFiltersChange = vi.fn();
    const filtersWithMetadata: FilterState = {
      ...emptyFilters,
      metadata: { team: "backend" },
    };
    render(
      <PortfolioFilterBar
        filters={filtersWithMetadata}
        onFiltersChange={onFiltersChange}
        availableTags={[]}
        availableMetadata={{ team: ["backend", "frontend"] }}
        projectCount={{ filtered: 2, total: 5 }}
      />,
    );
    fireEvent.change(screen.getByLabelText("team"), { target: { value: "" } });
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...filtersWithMetadata,
      metadata: {},
    });
  });

  // M3: Verify metadata preservation during tag/status changes
  it("preserves metadata filter when changing status", () => {
    const onFiltersChange = vi.fn();
    const filtersWithMetadata: FilterState = {
      ...emptyFilters,
      metadata: { team: "backend" },
    };
    render(
      <PortfolioFilterBar
        filters={filtersWithMetadata}
        onFiltersChange={onFiltersChange}
        availableTags={[]}
        availableMetadata={{ team: ["backend", "frontend"] }}
        projectCount={{ filtered: 2, total: 5 }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "active" } });
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...filtersWithMetadata,
      status: "active",
      metadata: { team: "backend" },
    });
  });

  it("preserves metadata filter when toggling tags", () => {
    const onFiltersChange = vi.fn();
    const filtersWithMetadata: FilterState = {
      ...emptyFilters,
      metadata: { team: "backend" },
    };
    render(
      <PortfolioFilterBar
        filters={filtersWithMetadata}
        onFiltersChange={onFiltersChange}
        availableTags={["production"]}
        availableMetadata={{ team: ["backend", "frontend"] }}
        projectCount={{ filtered: 1, total: 5 }}
      />,
    );
    fireEvent.click(screen.getByText("production"));
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...filtersWithMetadata,
      tags: ["production"],
      metadata: { team: "backend" },
    });
  });
});
