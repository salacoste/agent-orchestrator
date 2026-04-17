/**
 * ScenariosView component tests (Story 54.1, Task 5).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScenariosView } from "../ScenariosView";
import type { WhatIfScenario } from "@/lib/types";
import type { ScenarioProjectInfo } from "../ScenarioCreator";

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const projects: ScenarioProjectInfo[] = [
  {
    id: "alpha",
    name: "Alpha",
    storyCounts: { total: 10, done: 5, inProgress: 2, backlog: 3 },
  },
];

const mockScenario: WhatIfScenario = {
  id: "new-uuid",
  name: "Test Scenario",
  createdAt: new Date().toISOString(),
  projectIds: ["alpha"],
  stories: [{ id: "1-1-test", projectId: "alpha", status: "done", domainTags: [] }],
  status: "draft",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockScenario),
  });
});

describe("ScenariosView", () => {
  it("shows empty state when no scenarios", () => {
    render(<ScenariosView projects={projects} initialScenarios={[]} />);
    expect(screen.getByText(/No scenarios yet/)).toBeInTheDocument();
  });

  it("shows ScenarioCreator form", () => {
    render(<ScenariosView projects={projects} initialScenarios={[]} />);
    expect(screen.getByRole("heading", { name: /Create.*Scenario/i })).toBeInTheDocument();
  });

  it("shows existing scenario cards", () => {
    render(<ScenariosView projects={projects} initialScenarios={[mockScenario]} />);
    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
  });

  it("creating a scenario adds it to the grid", async () => {
    render(<ScenariosView projects={projects} initialScenarios={[]} />);

    // Fill in the form
    const nameInput = screen.getByLabelText("Scenario name");
    fireEvent.change(nameInput, { target: { value: "New Scenario" } });

    // Select the project
    fireEvent.click(screen.getByText("Alpha"));

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /create scenario/i }));

    // The mock API returns mockScenario with name "Test Scenario"
    await waitFor(() => {
      expect(screen.getByText("Test Scenario")).toBeInTheDocument();
    });
  });

  it("deleting a scenario removes it from the grid", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    render(<ScenariosView projects={projects} initialScenarios={[mockScenario]} />);

    // Confirm scenario is shown
    expect(screen.getByText("Test Scenario")).toBeInTheDocument();

    // Click delete
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.queryByText("Test Scenario")).not.toBeInTheDocument();
    });
  });

  it("shows error when delete fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    render(<ScenariosView projects={projects} initialScenarios={[mockScenario]} />);

    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.getByText(/Server error/)).toBeInTheDocument();
    });

    // Scenario should still be in the grid
    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
  });

  it("shows Compare button when simulated scenarios exist", () => {
    const simulated: WhatIfScenario = {
      ...mockScenario,
      id: "sim-1",
      status: "simulated",
      result: {
        p50Days: 5,
        p80Days: 7,
        p95Days: 10,
        onTimeProbability: 0.85,
        confidence: 0.75,
        iterationsRun: 1000,
      },
    };
    render(<ScenariosView projects={projects} initialScenarios={[simulated]} />);
    expect(screen.getByText(/Compare Selected/)).toBeInTheDocument();
  });

  it("Compare button is disabled when fewer than 2 simulated scenarios selected", () => {
    const simulated: WhatIfScenario = {
      ...mockScenario,
      id: "sim-1",
      status: "simulated",
      result: {
        p50Days: 5,
        p80Days: 7,
        p95Days: 10,
        onTimeProbability: 0.85,
        confidence: 0.75,
        iterationsRun: 1000,
      },
    };
    render(<ScenariosView projects={projects} initialScenarios={[simulated]} />);
    expect(screen.getByText(/Compare Selected \(0\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Compare Selected/ })).toBeDisabled();
  });

  it("selecting 2 simulated scenarios enables compare button", () => {
    const sim1: WhatIfScenario = {
      ...mockScenario,
      id: "sim-1",
      name: "Scenario A",
      status: "simulated",
      result: {
        p50Days: 5,
        p80Days: 7,
        p95Days: 10,
        onTimeProbability: 0.85,
        confidence: 0.75,
        iterationsRun: 1000,
      },
    };
    const sim2: WhatIfScenario = {
      ...mockScenario,
      id: "sim-2",
      name: "Scenario B",
      status: "simulated",
      result: {
        p50Days: 4,
        p80Days: 6,
        p95Days: 9,
        onTimeProbability: 0.9,
        confidence: 0.8,
        iterationsRun: 1000,
      },
    };
    render(<ScenariosView projects={projects} initialScenarios={[sim1, sim2]} />);

    // Select both
    fireEvent.click(screen.getByLabelText("Select Scenario A"));
    fireEvent.click(screen.getByLabelText("Select Scenario B"));

    expect(screen.getByText(/Compare Selected \(2\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Compare Selected/ })).not.toBeDisabled();
  });
});
