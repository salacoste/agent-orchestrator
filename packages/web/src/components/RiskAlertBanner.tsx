"use client";

import type { RiskAlert } from "@/lib/risk-alert-types";

interface RiskAlertBannerProps {
  alerts: RiskAlert[];
  onAcknowledge: (alertId: string) => void;
}

function alertSeverityStyle(label: string): string {
  switch (label) {
    case "critical":
      return "border-[var(--color-accent-red)]/50 bg-[var(--color-accent-red)]/10";
    case "high":
      return "border-[var(--color-accent-yellow)]/50 bg-[var(--color-accent-yellow)]/10";
    case "medium":
      return "border-[var(--color-surface-raised)] bg-[var(--color-surface-raised)]/50";
    default:
      return "border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/30";
  }
}

function alertSeverityText(label: string): string {
  switch (label) {
    case "critical":
      return "text-[var(--color-accent-red)]";
    case "high":
      return "text-[var(--color-accent-yellow)]";
    default:
      return "text-[var(--color-text-secondary)]";
  }
}

function alertIcon(alertType: string): string {
  switch (alertType) {
    case "score-threshold":
      return "\u26A0";
    case "emerging-risk":
      return "\u{1F52C}";
    default:
      return "\u26A0";
  }
}

/**
 * Risk alert banner — displays active risk alerts above the score panel.
 * Story 56.5 Task 6.
 */
export function RiskAlertBanner({ alerts, onAcknowledge }: RiskAlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`rounded-[6px] border px-4 py-3 ${alertSeverityStyle(alert.severityLabel)}`}
          role="alert"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className={`text-[13px] font-semibold ${alertSeverityText(alert.severityLabel)}`}>
                {alertIcon(alert.alertType)} {alert.title}
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--color-text-secondary)" }}>
                {alert.details}
              </p>
              <p className="text-[10px] mt-1" style={{ color: "var(--color-text-muted)" }}>
                {new Date(alert.triggeredAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              className="ml-4 px-3 py-1 text-[11px] font-medium rounded-[5px] border border-[var(--color-border)] bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-hover)] transition-colors whitespace-nowrap"
              onClick={() => onAcknowledge(alert.id)}
            >
              Acknowledge
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
