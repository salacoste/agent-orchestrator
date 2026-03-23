/**
 * TimeTravelBar component tests (Story 45.2).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimeTravelBar } from "../TimeTravelBar";
import type { HistoricalState } from "@/lib/workflow/time-travel";

const MOCK_STATE: HistoricalState = {
  activeStories: { "1-1-auth": "in-progress", "1-2-api": "blocked" },
  activeAgents: ["agent-A", "agent-B"],
  blockers: ["1-2-api"],
  lastEventAt: "2026-03-22T10:00:00Z",
  eventsProcessed: 5,
};

describe("TimeTravelBar", () => {
  it("renders picker in live mode (no timestamp)", () => {
    render(
      <TimeTravelBar timestamp={null} onTimestampChange={vi.fn()} state={null} noData={false} />,
    );

    expect(screen.getByTestId("time-travel-bar")).toBeInTheDocument();
    expect(screen.getByTestId("time-travel-picker")).toBeInTheDocument();
    expect(screen.queryByTestId("time-travel-banner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("time-travel-return")).not.toBeInTheDocument();
  });

  it("shows banner and return button when time traveling", () => {
    render(
      <TimeTravelBar
        timestamp="2026-03-22T10:00:00Z"
        onTimestampChange={vi.fn()}
        state={MOCK_STATE}
        noData={false}
      />,
    );

    expect(screen.getByTestId("time-travel-banner")).toBeInTheDocument();
    expect(screen.getByTestId("time-travel-return")).toBeInTheDocument();
    expect(screen.getByText(/Viewing state at/)).toBeInTheDocument();
    expect(screen.getByText(/2 stories/)).toBeInTheDocument();
    expect(screen.getByText(/2 agents/)).toBeInTheDocument();
    expect(screen.getByText(/1 blockers/)).toBeInTheDocument();
  });

  it("shows no-data message when noData is true", () => {
    render(
      <TimeTravelBar
        timestamp="2026-03-20T10:00:00Z"
        onTimestampChange={vi.fn()}
        state={null}
        noData={true}
      />,
    );

    expect(screen.getByTestId("time-travel-no-data")).toBeInTheDocument();
    expect(screen.getByText("No data available for this period.")).toBeInTheDocument();
  });

  it("shows loading message when state is null but not noData", () => {
    render(
      <TimeTravelBar
        timestamp="2026-03-22T10:00:00Z"
        onTimestampChange={vi.fn()}
        state={null}
        noData={false}
      />,
    );

    expect(screen.getByText("Reconstructing state...")).toBeInTheDocument();
  });

  it("calls onTimestampChange(null) when Return to Present is clicked", () => {
    const onChange = vi.fn();
    render(
      <TimeTravelBar
        timestamp="2026-03-22T10:00:00Z"
        onTimestampChange={onChange}
        state={MOCK_STATE}
        noData={false}
      />,
    );

    fireEvent.click(screen.getByTestId("time-travel-return"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onTimestampChange with ISO string when picker changes", () => {
    const onChange = vi.fn();
    render(
      <TimeTravelBar timestamp={null} onTimestampChange={onChange} state={null} noData={false} />,
    );

    const picker = screen.getByTestId("time-travel-picker") as HTMLInputElement;
    fireEvent.change(picker, { target: { value: "2026-03-22T14:30" } });

    expect(onChange).toHaveBeenCalledOnce();
    // Should be called with an ISO string
    const arg = onChange.mock.calls[0][0] as string;
    expect(arg).toContain("2026-03-22");
  });

  it("calls onTimestampChange(null) when picker is cleared", () => {
    const onChange = vi.fn();
    render(
      <TimeTravelBar
        timestamp="2026-03-22T10:00:00Z"
        onTimestampChange={onChange}
        state={MOCK_STATE}
        noData={false}
      />,
    );

    const picker = screen.getByTestId("time-travel-picker") as HTMLInputElement;
    fireEvent.change(picker, { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
