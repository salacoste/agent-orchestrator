/**
 * ScenarioCard component tests (Story 54.1, Task 5).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScenarioCard } from "../ScenarioCard";
import type { WhatIfScenario } from "@/lib/types";

const baseScenario: WhatIfScenario = {
  id: "test-uuid-1",
  name: "Add 2 More Agents",
  createdAt: "2026-04-03T10:00:00.000Z",
  projectIds: ["alpha", "beta"],
  stories: [
    { id: "1-1-test", projectId: "alpha", status: "done", domainTags: [] },
    { id: "1-2-test", projectId: "alpha", status: "in-progress", domainTags: ["core"] },
    { id: "2-1-test", projectId: "beta", status: "backlog", domainTags: [] },
  ],
  status: "draft",
};

describe("ScenarioCard", () => {
  it("renders scenario name", () => {
    render(<ScenarioCard scenario={baseScenario} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Add 2 More Agents")).toBeInTheDocument();
  });

  it("renders creation date", () => {
    render(<ScenarioCard scenario={baseScenario} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/Apr 3, 2026/)).toBeInTheDocument();
  });

  it("renders project count", () => {
    render(<ScenarioCard scenario={baseScenario} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/Projects: 2/)).toBeInTheDocument();
  });

  it("renders story count", () => {
    render(<ScenarioCard scenario={baseScenario} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/Stories: 3 captured/)).toBeInTheDocument();
  });

  it("shows correct status badge for draft", () => {
    render(<ScenarioCard scenario={baseScenario} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows correct status badge for simulated", () => {
    const simulated = { ...baseScenario, status: "simulated" as const };
    render(<ScenarioCard scenario={simulated} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Simulated")).toBeInTheDocument();
  });

  it("shows correct status badge for applied", () => {
    const applied = { ...baseScenario, status: "applied" as const };
    render(<ScenarioCard scenario={applied} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Applied")).toBeInTheDocument();
  });

  it("Delete button calls onDelete with scenario id", () => {
    const onDelete = vi.fn();
    render(<ScenarioCard scenario={baseScenario} onOpen={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("test-uuid-1");
  });

  it("Open button calls onOpen with scenario id", () => {
    const onOpen = vi.fn();
    render(<ScenarioCard scenario={baseScenario} onOpen={onOpen} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByText("Open"));
    expect(onOpen).toHaveBeenCalledWith("test-uuid-1");
  });

  it("renders checkbox when selectable prop is true", () => {
    render(
      <ScenarioCard
        scenario={baseScenario}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        selectable
        selected={false}
        onToggleSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("checkbox click fires onToggleSelect callback", () => {
    const onToggleSelect = vi.fn();
    render(
      <ScenarioCard
        scenario={baseScenario}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        selectable
        selected={false}
        onToggleSelect={onToggleSelect}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggleSelect).toHaveBeenCalledWith("test-uuid-1");
  });
});
