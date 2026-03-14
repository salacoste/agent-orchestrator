import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowAIGuide } from "../WorkflowAIGuide";
import type { Phase, Recommendation } from "@/lib/workflow/types.js";

function makeRecommendation(
  tier: 1 | 2,
  observation: string,
  implication: string,
  phase: Phase,
): Recommendation {
  return { tier, observation, implication, phase };
}

// AC4 (loading/skeleton state) is handled by the parent WorkflowDashboard
// via WD-7 LKG pattern — this component always receives a resolved value.
describe("WorkflowAIGuide", () => {
  describe("recommendation rendering", () => {
    it("renders observation and implication text", () => {
      const rec = makeRecommendation(
        1,
        "No BMAD artifacts detected in this project",
        "Starting with analysis phase would establish project foundations",
        "analysis",
      );
      render(<WorkflowAIGuide recommendation={rec} />);

      expect(screen.getByText("No BMAD artifacts detected in this project")).toBeInTheDocument();
      expect(
        screen.getByText("Starting with analysis phase would establish project foundations"),
      ).toBeInTheDocument();
    });

    it("displays tier 1 indicator", () => {
      const rec = makeRecommendation(
        1,
        "No product brief found",
        "A product brief captures core project vision",
        "analysis",
      );
      render(<WorkflowAIGuide recommendation={rec} />);

      const tierBadge = screen.getByText("Tier 1");
      expect(tierBadge).toBeInTheDocument();
      expect(tierBadge.className).toContain("color-status-attention");
    });

    it("displays tier 2 indicator", () => {
      const rec = makeRecommendation(
        2,
        "PRD present. Architecture spec not found",
        "Architecture decisions guide consistent implementation",
        "solutioning",
      );
      render(<WorkflowAIGuide recommendation={rec} />);

      const tierBadge = screen.getByText("Tier 2");
      expect(tierBadge).toBeInTheDocument();
      expect(tierBadge.className).toContain("color-accent");
    });

    it("displays phase badge with correct phase label", () => {
      const rec = makeRecommendation(
        1,
        "Product brief present. No PRD found",
        "A PRD translates the brief into detailed requirements",
        "planning",
      );
      render(<WorkflowAIGuide recommendation={rec} />);

      expect(screen.getByText("Planning")).toBeInTheDocument();
    });

    it.each([
      ["analysis", "Analysis"],
      ["planning", "Planning"],
      ["solutioning", "Solutioning"],
      ["implementation", "Implementation"],
    ] as [Phase, string][])("renders %s phase as '%s' label", (phase, label) => {
      const rec = makeRecommendation(
        1,
        `Observation for ${phase}`,
        `Implication for ${phase}`,
        phase,
      );
      render(<WorkflowAIGuide recommendation={rec} />);

      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("renders completion message when recommendation is null", () => {
      render(<WorkflowAIGuide recommendation={null} />);

      expect(
        screen.getByText("All workflow phases have artifacts. No action needed."),
      ).toBeInTheDocument();
    });

    it("does not render tier or phase badges when null", () => {
      render(<WorkflowAIGuide recommendation={null} />);

      expect(screen.queryByText(/Tier/)).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has aria-label on the section element", () => {
      render(<WorkflowAIGuide recommendation={null} />);

      const section = screen.getByRole("region", { name: "AI-guided recommendations" });
      expect(section).toBeInTheDocument();
    });

    it("has a semantic h2 heading with AI Guide text", () => {
      render(<WorkflowAIGuide recommendation={null} />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("AI Guide");
    });

    it("has sr-only text describing tier and phase for screen readers", () => {
      const rec = makeRecommendation(1, "No PRD found", "A PRD translates the brief", "planning");
      render(<WorkflowAIGuide recommendation={rec} />);

      expect(screen.getByText("Tier 1 recommendation for Planning phase")).toBeInTheDocument();
    });

    it("has sr-only text for tier 2 recommendation", () => {
      const rec = makeRecommendation(
        2,
        "Implementation phase active",
        "Sprint execution is underway",
        "implementation",
      );
      render(<WorkflowAIGuide recommendation={rec} />);

      expect(
        screen.getByText("Tier 2 recommendation for Implementation phase"),
      ).toBeInTheDocument();
    });

    it("has aria-hidden on tier and phase badge spans", () => {
      const rec = makeRecommendation(1, "No BMAD artifacts", "Start analysis", "analysis");
      const { container } = render(<WorkflowAIGuide recommendation={rec} />);

      const ariaHiddenSpans = container.querySelectorAll('[aria-hidden="true"]');
      // 2 spans: tier badge + phase badge
      expect(ariaHiddenSpans).toHaveLength(2);
    });

    it("tier badge uses text label not color alone (NFR-A3)", () => {
      const rec = makeRecommendation(1, "Observation", "Implication", "analysis");
      render(<WorkflowAIGuide recommendation={rec} />);

      // Tier badge has text "Tier 1" — not just a colored dot
      const tierBadge = screen.getByText("Tier 1");
      expect(tierBadge).toBeInTheDocument();
      expect(tierBadge.textContent).toBe("Tier 1");
    });
  });
});
