import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RiskAlertBanner } from "../RiskAlertBanner";

const mockAlert = {
  id: "proj-1-alert-score-critical",
  projectId: "proj-1",
  triggeredAt: "2026-04-07T12:00:00Z",
  alertType: "score-threshold" as const,
  severity: 82,
  severityLabel: "critical" as const,
  title: "Risk score 82 (critical) exceeds critical threshold (76)",
  details: "5 risk factors and 3 bottlenecks contributing",
  acknowledged: false,
};

const mockEmergingAlert = {
  id: "proj-2-alert-emerging-velocity-drop",
  projectId: "proj-2",
  triggeredAt: "2026-04-07T13:00:00Z",
  alertType: "emerging-risk" as const,
  severity: 70,
  severityLabel: "high" as const,
  title: "Emerging risk: Velocity declining",
  details: "Severity 70 exceeds threshold (60)",
  acknowledged: false,
};

describe("RiskAlertBanner", () => {
  it("renders nothing when no active alerts", () => {
    const { container } = render(<RiskAlertBanner alerts={[]} onAcknowledge={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders alert with severity styling", () => {
    render(<RiskAlertBanner alerts={[mockAlert]} onAcknowledge={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Risk score 82/)).toBeTruthy();
  });

  it("renders multiple alerts as a stack", () => {
    render(<RiskAlertBanner alerts={[mockAlert, mockEmergingAlert]} onAcknowledge={vi.fn()} />);
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);
  });

  it("calls onAcknowledge when acknowledge button clicked", () => {
    const onAck = vi.fn();
    render(<RiskAlertBanner alerts={[mockAlert]} onAcknowledge={onAck} />);
    const button = screen.getByText("Acknowledge");
    fireEvent.click(button);
    expect(onAck).toHaveBeenCalledWith(mockAlert.id);
  });

  it("renders emerging risk alert with correct icon", () => {
    render(<RiskAlertBanner alerts={[mockEmergingAlert]} onAcknowledge={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Emerging risk/)).toBeTruthy();
  });

  it("renders alert details text", () => {
    render(<RiskAlertBanner alerts={[mockAlert]} onAcknowledge={vi.fn()} />);
    expect(screen.getByText(/5 risk factors and 3 bottlenecks/)).toBeTruthy();
  });
});
