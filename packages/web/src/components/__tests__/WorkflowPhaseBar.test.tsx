import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowPhaseBar } from "../WorkflowPhaseBar";
import type { PhaseEntry, PhaseState } from "@/lib/workflow/types.js";

function makePhases(states: [PhaseState, PhaseState, PhaseState, PhaseState]): PhaseEntry[] {
  const ids = ["analysis", "planning", "solutioning", "implementation"] as const;
  const labels = ["Analysis", "Planning", "Solutioning", "Implementation"];
  return ids.map((id, i) => ({
    id,
    label: labels[i],
    state: states[i],
  }));
}

describe("WorkflowPhaseBar", () => {
  describe("phase rendering", () => {
    it("renders all four phase labels", () => {
      const phases = makePhases(["not-started", "not-started", "not-started", "not-started"]);
      render(<WorkflowPhaseBar phases={phases} />);

      expect(screen.getByText("Analysis")).toBeInTheDocument();
      expect(screen.getByText("Planning")).toBeInTheDocument();
      expect(screen.getByText("Solutioning")).toBeInTheDocument();
      expect(screen.getByText("Implementation")).toBeInTheDocument();
    });

    it("renders ○ symbol for not-started phases", () => {
      const phases = makePhases(["not-started", "not-started", "not-started", "not-started"]);
      const { container } = render(<WorkflowPhaseBar phases={phases} />);

      const icons = container.querySelectorAll('[aria-hidden="true"]');
      const iconTexts = Array.from(icons)
        .map((el) => el.textContent?.trim())
        .filter((t) => t === "○");
      expect(iconTexts).toHaveLength(4);
    });

    it("renders ● symbol for done phases", () => {
      const phases = makePhases(["done", "done", "not-started", "not-started"]);
      const { container } = render(<WorkflowPhaseBar phases={phases} />);

      const icons = container.querySelectorAll('[aria-hidden="true"]');
      const iconTexts = Array.from(icons)
        .map((el) => el.textContent?.trim())
        .filter((t) => t === "●");
      expect(iconTexts).toHaveLength(2);
    });

    it("renders ★ symbol for active phase", () => {
      const phases = makePhases(["done", "done", "active", "not-started"]);
      const { container } = render(<WorkflowPhaseBar phases={phases} />);

      const icons = container.querySelectorAll('[aria-hidden="true"]');
      const iconTexts = Array.from(icons)
        .map((el) => el.textContent?.trim())
        .filter((t) => t === "★");
      expect(iconTexts).toHaveLength(1);
    });

    it("renders mixed states correctly (done, done, active, not-started)", () => {
      const phases = makePhases(["done", "done", "active", "not-started"]);
      const { container } = render(<WorkflowPhaseBar phases={phases} />);

      const icons = container.querySelectorAll('[aria-hidden="true"]');
      const iconTexts = Array.from(icons)
        .map((el) => el.textContent?.trim())
        .filter((t) => ["○", "●", "★"].includes(t ?? ""));

      expect(iconTexts).toEqual(["●", "●", "★", "○"]);
    });
  });

  describe("accessibility", () => {
    it("has aria-label on the section element", () => {
      const phases = makePhases(["not-started", "not-started", "not-started", "not-started"]);
      render(<WorkflowPhaseBar phases={phases} />);

      const section = screen.getByRole("region", { name: "Phase progression" });
      expect(section).toBeInTheDocument();
    });

    it("has a semantic h2 heading with Phase Progression text", () => {
      const phases = makePhases(["not-started", "not-started", "not-started", "not-started"]);
      render(<WorkflowPhaseBar phases={phases} />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Phase Progression");
    });

    it("has sr-only text with correct state descriptions for each phase", () => {
      const phases = makePhases(["done", "active", "not-started", "not-started"]);
      render(<WorkflowPhaseBar phases={phases} />);

      expect(screen.getByText("Analysis phase: done")).toBeInTheDocument();
      expect(screen.getByText("Planning phase: active")).toBeInTheDocument();
      expect(screen.getByText("Solutioning phase: not started")).toBeInTheDocument();
      expect(screen.getByText("Implementation phase: not started")).toBeInTheDocument();
    });

    it("has aria-hidden on all decorative spans (icons, labels, connectors)", () => {
      const phases = makePhases(["active", "not-started", "not-started", "not-started"]);
      const { container } = render(<WorkflowPhaseBar phases={phases} />);

      const ariaHiddenSpans = container.querySelectorAll('[aria-hidden="true"]');
      // 4 icon spans + 4 label spans + 3 connector spans = 11
      expect(ariaHiddenSpans).toHaveLength(11);
    });

    it("has aria-hidden on label spans", () => {
      const phases = makePhases(["done", "not-started", "not-started", "not-started"]);
      render(<WorkflowPhaseBar phases={phases} />);

      // Labels should have aria-hidden so screen readers use sr-only description instead
      const analysisLabel = screen.getByText("Analysis");
      expect(analysisLabel).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("color coding", () => {
    it("applies success color to active phase icon", () => {
      const phases = makePhases(["done", "active", "not-started", "not-started"]);
      const { container } = render(<WorkflowPhaseBar phases={phases} />);

      const icons = container.querySelectorAll('[aria-hidden="true"]');
      const starIcon = Array.from(icons).find((el) => el.textContent?.trim() === "★");
      expect(starIcon?.className).toContain("color-status-success");
    });

    it("applies primary color to done phase icon", () => {
      const phases = makePhases(["done", "not-started", "not-started", "not-started"]);
      const { container } = render(<WorkflowPhaseBar phases={phases} />);

      const icons = container.querySelectorAll('[aria-hidden="true"]');
      const filledIcon = Array.from(icons).find((el) => el.textContent?.trim() === "●");
      expect(filledIcon?.className).toContain("color-text-primary");
    });

    it("applies muted color to not-started phase icon", () => {
      const phases = makePhases(["not-started", "not-started", "not-started", "not-started"]);
      const { container } = render(<WorkflowPhaseBar phases={phases} />);

      const icons = container.querySelectorAll('[aria-hidden="true"]');
      const hollowIcon = Array.from(icons).find((el) => el.textContent?.trim() === "○");
      expect(hollowIcon?.className).toContain("color-text-muted");
    });

    it("applies semibold font to active phase label", () => {
      const phases = makePhases(["not-started", "active", "not-started", "not-started"]);
      render(<WorkflowPhaseBar phases={phases} />);

      const planningLabel = screen.getByText("Planning");
      expect(planningLabel.className).toContain("font-semibold");
    });
  });

  describe("empty state", () => {
    it("renders empty state message when phases array is empty", () => {
      render(<WorkflowPhaseBar phases={[]} />);

      expect(screen.getByText("No phase data available.")).toBeInTheDocument();
    });

    it("still renders section with aria-label when empty", () => {
      render(<WorkflowPhaseBar phases={[]} />);

      const section = screen.getByRole("region", { name: "Phase progression" });
      expect(section).toBeInTheDocument();
    });

    it("still renders heading when empty", () => {
      render(<WorkflowPhaseBar phases={[]} />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Phase Progression");
    });
  });

  describe("connector lines", () => {
    it("renders connector elements between phases", () => {
      const phases = makePhases(["done", "done", "active", "not-started"]);
      const { container } = render(<WorkflowPhaseBar phases={phases} />);

      // 3 connectors between 4 phases
      const connectors = container.querySelectorAll(".border-t");
      expect(connectors).toHaveLength(3);
    });

    it("does not render a connector after the last phase", () => {
      const phases = makePhases(["done", "done", "active", "not-started"]);
      const { container } = render(<WorkflowPhaseBar phases={phases} />);

      // connectors should be exactly phases.length - 1
      const connectors = container.querySelectorAll(".border-t");
      expect(connectors).toHaveLength(phases.length - 1);
    });
  });
});
