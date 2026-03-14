import { describe, expect, it } from "vitest";

import { ARTIFACT_RULES, classifyArtifact } from "../artifact-rules.js";

describe("ARTIFACT_RULES", () => {
  it("has 9 rules covering all 4 phases", () => {
    expect(ARTIFACT_RULES.length).toBe(9);
    const phases = new Set(ARTIFACT_RULES.map((r) => r.phase));
    expect(phases).toEqual(new Set(["analysis", "planning", "solutioning", "implementation"]));
  });
});

describe("classifyArtifact", () => {
  describe("analysis phase matches", () => {
    it("matches product brief", () => {
      const result = classifyArtifact("product-brief.md", "planning");
      expect(result).toEqual({ phase: "analysis", type: "Product Brief" });
    });

    it("matches brief anywhere in filename", () => {
      expect(classifyArtifact("my-brief-v2.md", "planning").phase).toBe("analysis");
    });

    it("matches research report", () => {
      const result = classifyArtifact("technical-research-report.md", "planning");
      expect(result).toEqual({ phase: "analysis", type: "Research Report" });
    });

    it("matches project-context", () => {
      const result = classifyArtifact("project-context.md", "planning");
      expect(result).toEqual({ phase: "analysis", type: "Project Context" });
    });

    it("matches project-context with suffix", () => {
      const result = classifyArtifact("project-context-v2.md", "planning");
      expect(result.phase).toBe("analysis");
    });
  });

  describe("planning phase matches", () => {
    it("matches PRD", () => {
      const result = classifyArtifact("prd-workflow-dashboard.md", "planning");
      expect(result).toEqual({ phase: "planning", type: "PRD" });
    });

    it("matches ux-design", () => {
      const result = classifyArtifact("ux-design-mobile.md", "planning");
      expect(result).toEqual({ phase: "planning", type: "UX Design" });
    });

    it("matches ux-spec", () => {
      const result = classifyArtifact("ux-spec.md", "planning");
      expect(result).toEqual({ phase: "planning", type: "UX Specification" });
    });
  });

  describe("solutioning phase matches", () => {
    it("matches architecture", () => {
      const result = classifyArtifact("architecture-doc.md", "planning");
      expect(result).toEqual({ phase: "solutioning", type: "Architecture" });
    });

    it("matches epics", () => {
      const result = classifyArtifact("epics-workflow-dashboard.md", "planning");
      expect(result).toEqual({ phase: "solutioning", type: "Epics & Stories" });
    });
  });

  describe("implementation phase matches", () => {
    it("matches sprint plan", () => {
      const result = classifyArtifact("sprint-status.md", "planning");
      expect(result).toEqual({ phase: "implementation", type: "Sprint Plan" });
    });
  });

  describe("case insensitivity", () => {
    it("matches uppercase filenames", () => {
      expect(classifyArtifact("PRD-Dashboard.md", "planning").phase).toBe("planning");
    });

    it("matches mixed case filenames", () => {
      expect(classifyArtifact("Product-Brief.md", "planning").phase).toBe("analysis");
    });
  });

  describe("first-match-wins semantics", () => {
    it("brief wins over research when both match", () => {
      // A filename containing both "brief" and "research" should match brief (earlier rule)
      const result = classifyArtifact("brief-research-summary.md", "planning");
      expect(result.type).toBe("Product Brief");
    });
  });

  describe("ambiguous filenames (first-match-wins order)", () => {
    it("architecture rule wins over epic rule for ambiguous filename", () => {
      // *architecture* appears before *epic* in ARTIFACT_RULES
      const result = classifyArtifact("epic-architecture-review.md", "planning");
      expect(result.phase).toBe("solutioning");
      expect(result.type).toBe("Architecture");
    });

    it("brief rule wins over research rule when both match", () => {
      const result = classifyArtifact("research-brief-summary.md", "planning");
      // *brief* appears before *research* in ARTIFACT_RULES
      expect(result.type).toBe("Product Brief");
    });

    it("prd rule wins over ux-design when both match", () => {
      const result = classifyArtifact("prd-ux-design-overview.md", "planning");
      expect(result.type).toBe("PRD");
    });
  });

  describe("edge case filenames", () => {
    it("classifies dotfiles as Uncategorized", () => {
      const result = classifyArtifact(".hidden-config.md", "planning");
      expect(result.phase).toBeNull();
      expect(result.type).toBe("Uncategorized");
    });

    it("handles filenames with spaces", () => {
      const result = classifyArtifact("my research notes.md", "planning");
      expect(result.phase).toBe("analysis");
      expect(result.type).toBe("Research Report");
    });

    it("handles very long filenames without error", () => {
      const longName = "a".repeat(200) + "-brief-" + "b".repeat(50) + ".md";
      const result = classifyArtifact(longName, "planning");
      expect(result.phase).toBe("analysis");
      expect(result.type).toBe("Product Brief");
    });

    it("handles filenames with special characters", () => {
      const result = classifyArtifact("prd-v2_(final).md", "planning");
      expect(result.phase).toBe("planning");
      expect(result.type).toBe("PRD");
    });
  });

  describe("unmatched files", () => {
    it("returns Story Spec for unmatched implementation artifacts", () => {
      const result = classifyArtifact("7-1-some-story.md", "implementation");
      expect(result).toEqual({ phase: "implementation", type: "Story Spec" });
    });

    it("returns Uncategorized with null phase for unmatched planning artifacts", () => {
      const result = classifyArtifact("random-notes.md", "planning");
      expect(result).toEqual({ phase: null, type: "Uncategorized" });
    });

    it("handles empty filename", () => {
      const result = classifyArtifact("", "planning");
      expect(result).toEqual({ phase: null, type: "Uncategorized" });
    });
  });
});
