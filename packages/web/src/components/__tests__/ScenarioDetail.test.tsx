/**
 * ScenarioDetail component tests (Story 54.2).
 *
 * Tests the integrated scenario detail page: header, parameter editor,
 * story priority list, and diff summary.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { ScenarioDetail } from "../ScenarioDetail";
import type { WhatIfScenario } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockScenario: WhatIfScenario = {
  id: "test-uuid-1",
  name: "Test Scenario",
  createdAt: new Date("2026-01-15").toISOString(),
  projectIds: ["alpha"],
  stories: [
    { id: "story-1", domainTags: ["backend"] },
    { id: "story-2", domainTags: ["frontend"] },
    { id: "story-3", domainTags: ["testing"] },
  ],
  status: "draft",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        ...mockScenario,
        parameters: { agentCount: 5, capacityLimit: 3, storyPriorities: [] },
      }),
  });
});

describe("ScenarioDetail", () => {
  it("renders scenario header with name and status", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders back link to scenarios list", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    expect(screen.getByText(/Back to Scenarios/)).toBeInTheDocument();
  });

  it("shows parameter editor with agent count and capacity labels", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    expect(screen.getByText("Agent Count")).toBeInTheDocument();
    expect(screen.getByText("Max Concurrent Stories per Agent")).toBeInTheDocument();
  });

  it("initializes agent count from defaults when no params on scenario", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    // applyParameterDefaults(undefined, 1) → agentCount: 1, capacityLimit: 1
    const inputs = screen.getAllByDisplayValue("1");
    expect(inputs.length).toBeGreaterThanOrEqual(2); // agentCount + capacityLimit
  });

  it("agent count increment/decrement buttons change value", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    // Default agent count is 1 (from applyParameterDefaults)
    // Both agentCount and capacityLimit start at 1, so get the first input
    const agentInput = screen.getAllByDisplayValue("1")[0];
    expect(agentInput).toBeInTheDocument();

    // Click increment (first + is agent count)
    const buttons = screen.getAllByText("+");
    fireEvent.click(buttons[0]);
    expect(screen.getByDisplayValue("2")).toBeInTheDocument();

    // Click decrement (first - is agent count)
    const minusButtons = screen.getAllByText("-");
    fireEvent.click(minusButtons[0]);
    // Back to 1 — both agent and capacity are 1 now
    expect(screen.getAllByDisplayValue("1").length).toBeGreaterThanOrEqual(2);
  });

  it("clamps agent count to minimum of 1", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    const agentInput = screen.getAllByDisplayValue("1")[0];

    // Try to go below 1 — handleAgentCountChange clamps to MIN_AGENT_COUNT
    fireEvent.change(agentInput, { target: { value: "0" } });
    // Both inputs still show 1 (agent clamped, capacity unchanged)
    const ones = screen.getAllByDisplayValue("1");
    expect(ones.length).toBeGreaterThanOrEqual(2);
  });

  it("shows story list with all stories", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    expect(screen.getByText("story-1")).toBeInTheDocument();
    expect(screen.getByText("story-2")).toBeInTheDocument();
    expect(screen.getByText("story-3")).toBeInTheDocument();
  });

  it("shows priority buttons for each story", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    const storyRow = screen.getByText("story-1").closest("div")!;
    const rowButtons = within(storyRow).getAllByRole("button");
    expect(rowButtons).toHaveLength(3);
    expect(rowButtons[0]).toHaveTextContent("High");
    expect(rowButtons[1]).toHaveTextContent("Medium");
    expect(rowButtons[2]).toHaveTextContent("Low");
  });

  it("clicking priority button shows diff summary change", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    const storyRow = screen.getByText("story-1").closest("div")!;
    const highBtn = within(storyRow).getByText("High");
    fireEvent.click(highBtn);

    // Diff should show reprioritized count
    expect(screen.getByText("1 stories reprioritized")).toBeInTheDocument();
  });

  it("priority change tracks the specific story and direction", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    // Change story-2 to Low priority
    const storyRow2 = screen.getByText("story-2").closest("div")!;
    const lowBtn = within(storyRow2).getByText("Low");
    fireEvent.click(lowBtn);

    // story-2's Low button should now be the active priority (has muted styling for low)
    expect(lowBtn.className).toContain("text-[var(--color-text-muted)]");

    // Diff should reflect 1 reprioritized story
    expect(screen.getByText("1 stories reprioritized")).toBeInTheDocument();

    // Change story-1 to High priority too
    const storyRow1 = screen.getByText("story-1").closest("div")!;
    const highBtn = within(storyRow1).getByText("High");
    fireEvent.click(highBtn);

    // Now 2 stories reprioritized
    expect(screen.getByText("2 stories reprioritized")).toBeInTheDocument();
  });

  it("save button enables after priority change", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    // Save should be disabled initially (no changes)
    const saveBtn = screen.getByRole("button", { name: /Save Parameters/ });
    expect(saveBtn).toBeDisabled();

    // Change a story's priority
    const storyRow = screen.getByText("story-3").closest("div")!;
    const highBtn = within(storyRow).getByText("High");
    fireEvent.click(highBtn);

    // Save should now be enabled
    expect(saveBtn).not.toBeDisabled();
  });

  it("shows 'No modifications' when nothing changed", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    expect(screen.getByText("No modifications")).toBeInTheDocument();
  });

  it("diff summary shows agent count change after increment", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    // Increment agent count from default 1 to 2
    const buttons = screen.getAllByText("+");
    fireEvent.click(buttons[0]);

    expect(screen.getByText(/Agent count:/)).toBeInTheDocument();
  });

  it("Save Parameters button is disabled when no changes", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    const saveBtn = screen.getByRole("button", { name: /Save Parameters/ });
    expect(saveBtn).toBeDisabled();
  });

  it("Save Parameters button is enabled when there are changes", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    // Make a change
    const buttons = screen.getAllByText("+");
    fireEvent.click(buttons[0]);

    const saveBtn = screen.getByRole("button", { name: /Save Parameters/ });
    expect(saveBtn).not.toBeDisabled();
  });

  it("calls PATCH on save and shows success", async () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    // Make a change to enable save
    const buttons = screen.getAllByText("+");
    fireEvent.click(buttons[0]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save Parameters/ }));
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/scenarios/test-uuid-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: expect.any(String),
    });

    expect(screen.getByText("Parameters saved")).toBeInTheDocument();
  });

  it("shows error on API failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "Invalid parameters" }),
    });

    render(<ScenarioDetail scenario={mockScenario} />);

    // Make a change
    const buttons = screen.getAllByText("+");
    fireEvent.click(buttons[0]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save Parameters/ }));
    });

    expect(screen.getByText("Invalid parameters")).toBeInTheDocument();
  });

  it("disables editing for non-draft scenario", () => {
    const simulated = { ...mockScenario, status: "simulated" as const };
    render(<ScenarioDetail scenario={simulated} />);

    // +/- buttons should be disabled
    const allButtons = screen.getAllByRole("button");
    for (const btn of allButtons) {
      const text = btn.textContent;
      if (text === "+" || text === "-" || text === "Save Parameters") {
        expect(btn).toBeDisabled();
      }
    }

    // Priority buttons disabled
    const highButtons = screen.getAllByText("High");
    for (const btn of highButtons) {
      expect(btn).toBeDisabled();
    }

    // Warning shown
    expect(screen.getByText(/Parameters cannot be edited/)).toBeInTheDocument();
  });

  it("shows existing parameters when scenario has them", () => {
    const withParams: WhatIfScenario = {
      ...mockScenario,
      parameters: { agentCount: 7, capacityLimit: 4, storyPriorities: [] },
    };
    render(<ScenarioDetail scenario={withParams} />);

    expect(screen.getByDisplayValue("7")).toBeInTheDocument();
    expect(screen.getByDisplayValue("4")).toBeInTheDocument();
  });

  // --- Story 54.3: Simulation ---

  it("shows Run Simulation button when status is draft with saved params", () => {
    const withParams: WhatIfScenario = {
      ...mockScenario,
      parameters: { agentCount: 3, capacityLimit: 2, storyPriorities: [] },
    };
    render(<ScenarioDetail scenario={withParams} />);

    expect(screen.getByRole("button", { name: /Run Simulation/ })).toBeInTheDocument();
  });

  it("Run Simulation button is disabled when parameters have unsaved changes", () => {
    const withParams: WhatIfScenario = {
      ...mockScenario,
      parameters: { agentCount: 3, capacityLimit: 2, storyPriorities: [] },
    };
    render(<ScenarioDetail scenario={withParams} />);

    // Change agent count to create unsaved diff
    const buttons = screen.getAllByText("+");
    fireEvent.click(buttons[0]);

    const simBtn = screen.getByRole("button", { name: /Run Simulation/ });
    expect(simBtn).toBeDisabled();
  });

  it("clicking Run Simulation calls POST and shows results", async () => {
    const simResult = {
      p50Days: 5,
      p80Days: 7,
      p95Days: 10,
      onTimeProbability: 0.85,
      confidence: 0.75,
      iterationsRun: 1000,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...simResult, color: "green" }),
    });

    const withParams: WhatIfScenario = {
      ...mockScenario,
      parameters: { agentCount: 3, capacityLimit: 2, storyPriorities: [] },
    };
    render(<ScenarioDetail scenario={withParams} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Run Simulation/ }));
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/scenarios/test-uuid-1/simulate", {
      method: "POST",
    });

    // Results should be displayed
    expect(screen.getByText("Simulation Results")).toBeInTheDocument();
    expect(screen.getByText(/5.0 days/)).toBeInTheDocument();
    expect(screen.getByText(/85%/)).toBeInTheDocument();
  });

  it("shows simulation error on API failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Simulation engine failure" }),
    });

    const withParams: WhatIfScenario = {
      ...mockScenario,
      parameters: { agentCount: 3, capacityLimit: 2, storyPriorities: [] },
    };
    render(<ScenarioDetail scenario={withParams} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Run Simulation/ }));
    });

    expect(screen.getByText("Simulation engine failure")).toBeInTheDocument();
  });

  it("shows simulation results for already-simulated scenario", () => {
    const simulated: WhatIfScenario = {
      ...mockScenario,
      status: "simulated",
      parameters: { agentCount: 3, capacityLimit: 2, storyPriorities: [] },
      result: {
        p50Days: 5,
        p80Days: 7,
        p95Days: 10,
        onTimeProbability: 0.85,
        confidence: 0.75,
        iterationsRun: 1000,
      },
    };
    render(<ScenarioDetail scenario={simulated} />);

    // Results panel should be visible from the stored result
    expect(screen.getByText("Simulation Results")).toBeInTheDocument();
    expect(screen.getByText(/5.0 days/)).toBeInTheDocument();

    // No Run Simulation button for non-draft
    expect(screen.queryByRole("button", { name: /Run Simulation/ })).not.toBeInTheDocument();
  });

  it("shows confidence level label", async () => {
    const simResult = {
      p50Days: 3,
      p80Days: 5,
      p95Days: 8,
      onTimeProbability: 0.9,
      confidence: 0.85,
      iterationsRun: 1000,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...simResult, color: "green" }),
    });

    const withParams: WhatIfScenario = {
      ...mockScenario,
      parameters: { agentCount: 3, capacityLimit: 2, storyPriorities: [] },
    };
    render(<ScenarioDetail scenario={withParams} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Run Simulation/ }));
    });

    // Confidence "High" is inside the results panel
    const resultsPanel = screen.getByText("Simulation Results").closest("div")!;
    expect(within(resultsPanel).getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Based on 1000 simulations")).toBeInTheDocument();
  });

  // --- Story 54.6: Apply to Production ---

  it("shows Apply to Production button when status is simulated", () => {
    const simulated: WhatIfScenario = {
      ...mockScenario,
      status: "simulated",
      parameters: { agentCount: 3, capacityLimit: 2, storyPriorities: [] },
      result: {
        p50Days: 5,
        p80Days: 7,
        p95Days: 10,
        onTimeProbability: 0.85,
        confidence: 0.75,
        iterationsRun: 1000,
      },
    };
    render(<ScenarioDetail scenario={simulated} />);

    expect(screen.getByRole("button", { name: /Apply to Production/ })).toBeInTheDocument();
  });

  it("does not show Apply to Production for draft scenarios", () => {
    render(<ScenarioDetail scenario={mockScenario} />);

    expect(screen.queryByRole("button", { name: /Apply to Production/ })).not.toBeInTheDocument();
  });

  it("opens confirmation dialog when Apply to Production is clicked", () => {
    const simulated: WhatIfScenario = {
      ...mockScenario,
      status: "simulated",
      parameters: { agentCount: 3, capacityLimit: 2, storyPriorities: [] },
      result: {
        p50Days: 5,
        p80Days: 7,
        p95Days: 10,
        onTimeProbability: 0.85,
        confidence: 0.75,
        iterationsRun: 1000,
      },
    };
    render(<ScenarioDetail scenario={simulated} />);

    fireEvent.click(screen.getByRole("button", { name: /Apply to Production/ }));

    expect(screen.getByText("Confirm Apply")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("closes confirmation dialog on Cancel", () => {
    const simulated: WhatIfScenario = {
      ...mockScenario,
      status: "simulated",
      parameters: { agentCount: 3, capacityLimit: 2, storyPriorities: [] },
      result: {
        p50Days: 5,
        p80Days: 7,
        p95Days: 10,
        onTimeProbability: 0.85,
        confidence: 0.75,
        iterationsRun: 1000,
      },
    };
    render(<ScenarioDetail scenario={simulated} />);

    fireEvent.click(screen.getByRole("button", { name: /Apply to Production/ }));
    expect(screen.getByText("Confirm Apply")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Confirm Apply")).not.toBeInTheDocument();
  });

  it("calls apply API and shows success on Confirm", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ...mockScenario,
          status: "applied",
          parameters: { agentCount: 3, capacityLimit: 2, storyPriorities: [] },
        }),
    });

    const simulated: WhatIfScenario = {
      ...mockScenario,
      status: "simulated",
      parameters: { agentCount: 3, capacityLimit: 2, storyPriorities: [] },
      result: {
        p50Days: 5,
        p80Days: 7,
        p95Days: 10,
        onTimeProbability: 0.85,
        confidence: 0.75,
        iterationsRun: 1000,
      },
    };
    render(<ScenarioDetail scenario={simulated} />);

    fireEvent.click(screen.getByRole("button", { name: /Apply to Production/ }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/scenarios/test-uuid-1/apply", {
      method: "POST",
    });
    expect(screen.getByText("Scenario applied successfully")).toBeInTheDocument();
  });

  it("shows apply error on API failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: "Scenario must be simulated before applying" }),
    });

    const simulated: WhatIfScenario = {
      ...mockScenario,
      status: "simulated",
      parameters: { agentCount: 3, capacityLimit: 2, storyPriorities: [] },
      result: {
        p50Days: 5,
        p80Days: 7,
        p95Days: 10,
        onTimeProbability: 0.85,
        confidence: 0.75,
        iterationsRun: 1000,
      },
    };
    render(<ScenarioDetail scenario={simulated} />);

    fireEvent.click(screen.getByRole("button", { name: /Apply to Production/ }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    });

    const alerts = screen.getAllByText("Scenario must be simulated before applying");
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });
});
