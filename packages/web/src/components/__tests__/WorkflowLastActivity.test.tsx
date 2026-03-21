import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowLastActivity } from "../WorkflowLastActivity";
import type { Phase } from "@/lib/workflow/types";

function makeLastActivity(
  filename: string,
  phase: Phase,
  modifiedAt: string,
): { filename: string; phase: Phase; modifiedAt: string } {
  return { filename, phase, modifiedAt };
}

// AC5: Loading state handled at parent WorkflowDashboard level per WD-7 LKG pattern.
// This component always receives a resolved value (lastActivity or null).

describe("WorkflowLastActivity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-14T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("activity rendering", () => {
    it("renders filename for the last activity", () => {
      const activity = makeLastActivity("architecture.md", "solutioning", "2026-03-14T11:30:00Z");
      render(<WorkflowLastActivity lastActivity={activity} />);

      expect(screen.getByText("architecture.md")).toBeInTheDocument();
    });

    it("renders phase using PHASE_LABELS", () => {
      const activity = makeLastActivity("prd.md", "planning", "2026-03-14T10:00:00Z");
      render(<WorkflowLastActivity lastActivity={activity} />);

      // Phase label appears in both sr-only span and visible paragraph
      expect(screen.getAllByText(/Planning/)).toHaveLength(2);
    });

    it.each([
      ["analysis", "Analysis"],
      ["planning", "Planning"],
      ["solutioning", "Solutioning"],
      ["implementation", "Implementation"],
    ] as [Phase, string][])("renders %s phase as '%s' label", (phase, label) => {
      const activity = makeLastActivity("test.md", phase, "2026-03-14T11:00:00Z");
      render(<WorkflowLastActivity lastActivity={activity} />);

      // Phase label appears in both sr-only span and visible paragraph
      expect(screen.getAllByText(new RegExp(label))).toHaveLength(2);
    });

    it("renders relative timestamp 'just now' for very recent activity", () => {
      const activity = makeLastActivity("brief.md", "analysis", "2026-03-14T11:59:30Z");
      render(<WorkflowLastActivity lastActivity={activity} />);

      expect(screen.getByText("just now")).toBeInTheDocument();
    });

    it("renders relative timestamp in minutes", () => {
      const activity = makeLastActivity("brief.md", "analysis", "2026-03-14T11:45:00Z");
      render(<WorkflowLastActivity lastActivity={activity} />);

      expect(screen.getByText("15m ago")).toBeInTheDocument();
    });

    it("renders relative timestamp in hours", () => {
      const activity = makeLastActivity("brief.md", "analysis", "2026-03-14T07:00:00Z");
      render(<WorkflowLastActivity lastActivity={activity} />);

      expect(screen.getByText("5h ago")).toBeInTheDocument();
    });

    it("renders relative timestamp in days", () => {
      const activity = makeLastActivity("brief.md", "analysis", "2026-03-11T12:00:00Z");
      render(<WorkflowLastActivity lastActivity={activity} />);

      expect(screen.getByText("3d ago")).toBeInTheDocument();
    });

    it("renders full date for activity older than 7 days", () => {
      const activity = makeLastActivity("brief.md", "analysis", "2026-03-01T12:00:00Z");
      const { container } = render(<WorkflowLastActivity lastActivity={activity} />);

      const timeEl = container.querySelector("time");
      expect(timeEl).toBeInTheDocument();
      expect(timeEl).toHaveAttribute("dateTime", "2026-03-01T12:00:00Z");
      // toLocaleDateString() is locale-dependent, verify it produces non-empty text
      expect(timeEl?.textContent).toBeTruthy();
      expect(timeEl?.textContent).not.toMatch(/ago$/);
    });

    it("renders boundary: 60 seconds shows '1m ago' not 'just now'", () => {
      const activity = makeLastActivity("brief.md", "analysis", "2026-03-14T11:59:00Z");
      render(<WorkflowLastActivity lastActivity={activity} />);

      expect(screen.getByText("1m ago")).toBeInTheDocument();
    });

    it("renders boundary: 60 minutes shows '1h ago' not '60m ago'", () => {
      const activity = makeLastActivity("brief.md", "analysis", "2026-03-14T11:00:00Z");
      render(<WorkflowLastActivity lastActivity={activity} />);

      expect(screen.getByText("1h ago")).toBeInTheDocument();
    });

    it("renders boundary: 24 hours shows '1d ago' not '24h ago'", () => {
      const activity = makeLastActivity("brief.md", "analysis", "2026-03-13T12:00:00Z");
      render(<WorkflowLastActivity lastActivity={activity} />);

      expect(screen.getByText("1d ago")).toBeInTheDocument();
    });

    it("renders boundary: 7 days shows full date not '7d ago'", () => {
      const activity = makeLastActivity("brief.md", "analysis", "2026-03-07T12:00:00Z");
      const { container } = render(<WorkflowLastActivity lastActivity={activity} />);

      const timeEl = container.querySelector("time");
      expect(timeEl).toBeInTheDocument();
      expect(timeEl?.textContent).not.toMatch(/d ago$/);
    });

    it("renders all three fields together", () => {
      const activity = makeLastActivity(
        "sprint-status.yaml",
        "implementation",
        "2026-03-14T10:00:00Z",
      );
      render(<WorkflowLastActivity lastActivity={activity} />);

      expect(screen.getByText("sprint-status.yaml")).toBeInTheDocument();
      expect(screen.getAllByText(/Implementation/)).toHaveLength(2);
      expect(screen.getByText("2h ago")).toBeInTheDocument();
    });

    it("falls back to raw phase string for unknown phases", () => {
      // Force an unknown phase to test defensive fallback in phaseLabel()
      const activity = {
        filename: "custom.md",
        phase: "custom-phase" as Phase,
        modifiedAt: "2026-03-14T11:00:00Z",
      };
      render(<WorkflowLastActivity lastActivity={activity} />);

      // Unknown phase appears in both sr-only and visible elements
      expect(screen.getAllByText(/custom-phase/)).toHaveLength(2);
    });
  });

  describe("empty state", () => {
    it("renders empty state message when lastActivity is null", () => {
      render(<WorkflowLastActivity lastActivity={null} />);

      expect(screen.getByText("No activity yet.")).toBeInTheDocument();
    });

    it("does not render activity content when lastActivity is null", () => {
      const { container } = render(<WorkflowLastActivity lastActivity={null} />);

      expect(container.querySelector("time")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has aria-label on the section element", () => {
      render(<WorkflowLastActivity lastActivity={null} />);

      const section = screen.getByRole("region", { name: "Last activity" });
      expect(section).toBeInTheDocument();
    });

    it("has a semantic h2 heading with Last Activity text", () => {
      render(<WorkflowLastActivity lastActivity={null} />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Last Activity");
    });

    it("has a <time> element with datetime attribute", () => {
      const activity = makeLastActivity("prd.md", "planning", "2026-03-14T10:00:00Z");
      const { container } = render(<WorkflowLastActivity lastActivity={activity} />);

      const timeEl = container.querySelector("time");
      expect(timeEl).toBeInTheDocument();
      expect(timeEl).toHaveAttribute("dateTime", "2026-03-14T10:00:00Z");
    });

    it("has sr-only text with complete activity description", () => {
      const activity = makeLastActivity("architecture.md", "solutioning", "2026-03-14T09:00:00Z");
      render(<WorkflowLastActivity lastActivity={activity} />);

      expect(
        screen.getByText(/Last activity: architecture\.md, Solutioning phase, 3h ago/),
      ).toBeInTheDocument();
    });

    it("has aria-hidden on visible content elements", () => {
      const activity = makeLastActivity("prd.md", "planning", "2026-03-14T10:00:00Z");
      const { container } = render(<WorkflowLastActivity lastActivity={activity} />);

      const ariaHiddenElements = container.querySelectorAll('[aria-hidden="true"]');
      expect(ariaHiddenElements).toHaveLength(2);
    });

    it("does not render sr-only text when lastActivity is null", () => {
      render(<WorkflowLastActivity lastActivity={null} />);

      expect(screen.queryByText(/Last activity:/)).not.toBeInTheDocument();
    });
  });
});
