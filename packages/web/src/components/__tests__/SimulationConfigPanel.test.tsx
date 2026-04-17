import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimulationConfigPanel } from "../SimulationConfigPanel";
import { DEFAULT_SIMULATION_CONFIG, type SimulationConfig } from "@/lib/useSimulationConfig";

const mockConfig: SimulationConfig = { ...DEFAULT_SIMULATION_CONFIG };

describe("SimulationConfigPanel", () => {
  const mockOnChange = vi.fn();
  const mockOnReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders collapsed by default", () => {
    render(
      <SimulationConfigPanel config={mockConfig} onChange={mockOnChange} onReset={mockOnReset} />,
    );
    expect(screen.getByText("Simulation Settings")).toBeInTheDocument();
    // Should not show iteration input when collapsed
    expect(screen.queryByLabelText(/iterations/i)).not.toBeInTheDocument();
  });

  it("expands to show controls when clicked", async () => {
    render(
      <SimulationConfigPanel config={mockConfig} onChange={mockOnChange} onReset={mockOnReset} />,
    );
    await userEvent.click(screen.getByText("Simulation Settings"));
    expect(screen.getByLabelText(/iterations/i)).toBeInTheDocument();
    expect(screen.getByText(/confidence levels/i)).toBeInTheDocument();
  });

  it("calls onChange when iteration count is changed", async () => {
    render(
      <SimulationConfigPanel config={mockConfig} onChange={mockOnChange} onReset={mockOnReset} />,
    );
    await userEvent.click(screen.getByText("Simulation Settings"));
    const input = screen.getByLabelText(/iterations/i);
    fireEvent.change(input, { target: { value: "20000" } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ simulations: 20000 }));
  });

  it("clamps iteration count to 1000 minimum", async () => {
    render(
      <SimulationConfigPanel config={mockConfig} onChange={mockOnChange} onReset={mockOnReset} />,
    );
    await userEvent.click(screen.getByText("Simulation Settings"));
    const input = screen.getByLabelText(/iterations/i);
    fireEvent.change(input, { target: { value: "500" } });
    // 500 is clamped to 1000
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ simulations: 1000 }));
  });

  it("clamps iteration count to 100000 maximum", async () => {
    render(
      <SimulationConfigPanel config={mockConfig} onChange={mockOnChange} onReset={mockOnReset} />,
    );
    await userEvent.click(screen.getByText("Simulation Settings"));
    const input = screen.getByLabelText(/iterations/i);
    fireEvent.change(input, { target: { value: "200000" } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ simulations: 100000 }));
  });

  it("toggles confidence levels and prevents unchecking the last one", async () => {
    const twoLevelConfig = { ...mockConfig, confidenceLevels: ["p50", "p80"] };
    render(
      <SimulationConfigPanel
        config={twoLevelConfig}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />,
    );
    await userEvent.click(screen.getByText("Simulation Settings"));

    // Uncheck P80 → should leave only P50
    const p80Checkbox = screen.getByRole("checkbox", { name: /p80/i });
    await userEvent.click(p80Checkbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ confidenceLevels: ["p50"] }),
    );
  });

  it("prevents unchecking the last confidence level", async () => {
    const oneLevelConfig = { ...mockConfig, confidenceLevels: ["p50"] };
    render(
      <SimulationConfigPanel
        config={oneLevelConfig}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />,
    );
    await userEvent.click(screen.getByText("Simulation Settings"));

    const p50Checkbox = screen.getByRole("checkbox", { name: /p50/i });
    expect(p50Checkbox).toBeDisabled();
  });

  it("calls onChange when historical data window is changed", async () => {
    render(
      <SimulationConfigPanel config={mockConfig} onChange={mockOnChange} onReset={mockOnReset} />,
    );
    await userEvent.click(screen.getByText("Simulation Settings"));
    const input = screen.getByLabelText(/historical data window/i);
    fireEvent.change(input, { target: { value: "90" } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ throughputWindowDays: 90 }),
    );
  });

  it("clamps historical window to 365 maximum", async () => {
    render(
      <SimulationConfigPanel config={mockConfig} onChange={mockOnChange} onReset={mockOnReset} />,
    );
    await userEvent.click(screen.getByText("Simulation Settings"));
    const input = screen.getByLabelText(/historical data window/i);
    fireEvent.change(input, { target: { value: "400" } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ throughputWindowDays: 365 }),
    );
  });

  it("calls onReset when reset button is clicked", async () => {
    const modifiedConfig: SimulationConfig = {
      simulations: 20000,
      confidenceLevels: ["p50"],
      throughputWindowDays: 30,
      excludeWeekends: false,
    };
    render(
      <SimulationConfigPanel
        config={modifiedConfig}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />,
    );
    await userEvent.click(screen.getByText("Simulation Settings"));
    await userEvent.click(screen.getByText(/reset to defaults/i));
    expect(mockOnReset).toHaveBeenCalledOnce();
  });

  it("does not show reset button when config is default", async () => {
    render(
      <SimulationConfigPanel config={mockConfig} onChange={mockOnChange} onReset={mockOnReset} />,
    );
    await userEvent.click(screen.getByText("Simulation Settings"));
    expect(screen.queryByText(/reset to defaults/i)).not.toBeInTheDocument();
  });

  it("shows data points used when provided", async () => {
    render(
      <SimulationConfigPanel
        config={{ ...mockConfig, throughputWindowDays: 30 }}
        dataPointsUsed={42}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />,
    );
    await userEvent.click(screen.getByText("Simulation Settings"));
    expect(screen.getByText(/42 data points from last 30 days/)).toBeInTheDocument();
  });

  it("toggles excludeWeekends checkbox", async () => {
    render(
      <SimulationConfigPanel config={mockConfig} onChange={mockOnChange} onReset={mockOnReset} />,
    );
    await userEvent.click(screen.getByText("Simulation Settings"));
    // Default is excludeWeekends: true
    const checkbox = screen.getByRole("checkbox", { name: /exclude weekends/i });
    expect(checkbox).toBeChecked();

    await userEvent.click(checkbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ excludeWeekends: false }));
  });

  it("shows unchecked excludeWeekends when config has excludeWeekends false", async () => {
    const noWeekendsConfig = { ...mockConfig, excludeWeekends: false };
    render(
      <SimulationConfigPanel
        config={noWeekendsConfig}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />,
    );
    await userEvent.click(screen.getByText("Simulation Settings"));
    const checkbox = screen.getByRole("checkbox", { name: /exclude weekends/i });
    expect(checkbox).not.toBeChecked();
  });

  it("shows (modified) indicator when config differs from defaults", async () => {
    const modifiedConfig: SimulationConfig = {
      ...mockConfig,
      simulations: 20000,
    };
    render(
      <SimulationConfigPanel
        config={modifiedConfig}
        onChange={mockOnChange}
        onReset={mockOnReset}
      />,
    );
    expect(screen.getByText("(modified)")).toBeInTheDocument();
  });
});
