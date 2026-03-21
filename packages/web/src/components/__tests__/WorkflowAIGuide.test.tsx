import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowAIGuide } from "../WorkflowAIGuide";
import type { Phase, Recommendation } from "@/lib/workflow/types";
// Recommendation type now includes optional blockers[] field (Story 17.3)

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
      // 3 spans: tier badge + phase badge + button arrow (→)
      expect(ariaHiddenSpans).toHaveLength(3);
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

  describe("next step button (Story 17.2)", () => {
    it("renders 'Next Step' button when recommendation exists", () => {
      const rec = makeRecommendation(1, "No brief found", "Create a product brief", "analysis");
      render(<WorkflowAIGuide recommendation={rec} />);

      const button = screen.getByTestId("next-step-button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("Create Brief");
    });

    it("does not render button when recommendation is null", () => {
      render(<WorkflowAIGuide recommendation={null} />);

      expect(screen.queryByTestId("next-step-button")).not.toBeInTheDocument();
    });

    it.each([
      ["analysis", "Create Brief"],
      ["planning", "Create PRD"],
      ["solutioning", "Design Architecture"],
      ["implementation", "Start Sprint"],
    ] as [Phase, string][])("renders '%s' action as '%s' button", (phase, expectedLabel) => {
      const rec = makeRecommendation(1, `Obs for ${phase}`, `Impl for ${phase}`, phase);
      render(<WorkflowAIGuide recommendation={rec} />);

      const button = screen.getByTestId("next-step-button");
      expect(button).toHaveTextContent(expectedLabel);
    });

    it("button has accessible aria-label", () => {
      const rec = makeRecommendation(1, "No PRD found", "Create a PRD", "planning");
      render(<WorkflowAIGuide recommendation={rec} />);

      const button = screen.getByTestId("next-step-button");
      expect(button).toHaveAttribute("aria-label", "Next step: Create PRD");
    });

    it("button includes arrow indicator", () => {
      const rec = makeRecommendation(1, "Observation", "Implication", "analysis");
      render(<WorkflowAIGuide recommendation={rec} />);

      const button = screen.getByTestId("next-step-button");
      expect(button.textContent).toContain("→");
    });
  });

  describe("recommendation reasoning display (Story 17.5)", () => {
    it("renders reasoning section when blockers are present", () => {
      const rec: Recommendation = {
        tier: 1,
        observation: "Architecture present but no epics",
        implication: "Create epics to proceed",
        phase: "solutioning",
        reasoning: "Transition 50% ready",
        blockers: [
          {
            guardId: "has-architecture",
            description: "Architecture document exists",
            satisfied: true,
          },
          {
            guardId: "has-epics",
            description: "Epics & stories document exists",
            satisfied: false,
          },
        ],
      };
      render(<WorkflowAIGuide recommendation={rec} />);

      const details = screen.getByTestId("reasoning-details");
      expect(details).toBeInTheDocument();
      expect(screen.getByText("Show reasoning (2 checks)")).toBeInTheDocument();
    });

    it("does not render reasoning when no blockers", () => {
      const rec = makeRecommendation(1, "Observation", "Implication", "analysis");
      render(<WorkflowAIGuide recommendation={rec} />);

      expect(screen.queryByTestId("reasoning-details")).not.toBeInTheDocument();
    });

    it("shows pass/fail icons for each guard", () => {
      const rec: Recommendation = {
        tier: 2,
        observation: "Obs",
        implication: "Impl",
        phase: "solutioning",
        blockers: [
          {
            guardId: "has-architecture",
            description: "Architecture document exists",
            satisfied: true,
          },
          {
            guardId: "has-epics",
            description: "Epics & stories document exists",
            satisfied: false,
          },
        ],
      };
      render(<WorkflowAIGuide recommendation={rec} />);

      expect(screen.getByText("Architecture document exists")).toBeInTheDocument();
      expect(screen.getByText("Epics & stories document exists")).toBeInTheDocument();
    });

    it("has accessible sr-only text for pass/fail status", () => {
      const rec: Recommendation = {
        tier: 1,
        observation: "Obs",
        implication: "Impl",
        phase: "analysis",
        blockers: [{ guardId: "has-brief", description: "Product brief exists", satisfied: true }],
      };
      render(<WorkflowAIGuide recommendation={rec} />);

      expect(screen.getByText("Satisfied:")).toBeInTheDocument();
    });

    it("uses singular 'check' for single blocker", () => {
      const rec: Recommendation = {
        tier: 1,
        observation: "Obs",
        implication: "Impl",
        phase: "planning",
        blockers: [{ guardId: "has-prd", description: "PRD exists", satisfied: false }],
      };
      render(<WorkflowAIGuide recommendation={rec} />);

      expect(screen.getByText("Show reasoning (1 check)")).toBeInTheDocument();
    });
  });
});
