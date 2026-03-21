import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowArtifactInventory } from "../WorkflowArtifactInventory";
import type { ClassifiedArtifact } from "@/lib/workflow/types";

function makeArtifact(
  filename: string,
  type: string,
  phase: "analysis" | "planning" | "solutioning" | "implementation" | null,
  path: string,
  modifiedAt: string,
): ClassifiedArtifact {
  return { filename, type, phase, path, modifiedAt };
}

const sampleArtifacts: ClassifiedArtifact[] = [
  makeArtifact(
    "product-brief.md",
    "Product Brief",
    "analysis",
    "_bmad-output/planning-artifacts/product-brief.md",
    "2026-03-10T10:00:00Z",
  ),
  makeArtifact(
    "prd-workflow-dashboard.md",
    "PRD",
    "planning",
    "_bmad-output/planning-artifacts/prd-workflow-dashboard.md",
    "2026-03-11T14:30:00Z",
  ),
  makeArtifact(
    "architecture.md",
    "Architecture",
    "solutioning",
    "_bmad-output/planning-artifacts/architecture.md",
    "2026-03-12T09:15:00Z",
  ),
  makeArtifact(
    "sprint-status.yaml",
    "Sprint Plan",
    "implementation",
    "_bmad-output/implementation-artifacts/sprint-status.yaml",
    "2026-03-14T08:00:00Z",
  ),
];

// AC5: No loading state needed — artifacts prop is always a defined array (never null/undefined).
// Parent component handles loading before rendering this panel.

describe("WorkflowArtifactInventory", () => {
  describe("artifact rendering", () => {
    it("renders filename for each artifact", () => {
      render(<WorkflowArtifactInventory artifacts={sampleArtifacts} />);

      expect(screen.getByText("product-brief.md")).toBeInTheDocument();
      expect(screen.getByText("prd-workflow-dashboard.md")).toBeInTheDocument();
      expect(screen.getByText("architecture.md")).toBeInTheDocument();
      expect(screen.getByText("sprint-status.yaml")).toBeInTheDocument();
    });

    it("renders type for each artifact", () => {
      render(<WorkflowArtifactInventory artifacts={sampleArtifacts} />);

      expect(screen.getByText("Product Brief")).toBeInTheDocument();
      expect(screen.getByText("PRD")).toBeInTheDocument();
      expect(screen.getByText("Architecture")).toBeInTheDocument();
      expect(screen.getByText("Sprint Plan")).toBeInTheDocument();
    });

    it("renders phase labels using PHASE_LABELS", () => {
      render(<WorkflowArtifactInventory artifacts={sampleArtifacts} />);

      expect(screen.getByText("Analysis")).toBeInTheDocument();
      expect(screen.getByText("Planning")).toBeInTheDocument();
      expect(screen.getByText("Solutioning")).toBeInTheDocument();
      expect(screen.getByText("Implementation")).toBeInTheDocument();
    });

    it("renders path for each artifact", () => {
      render(<WorkflowArtifactInventory artifacts={sampleArtifacts} />);

      expect(
        screen.getByText("_bmad-output/planning-artifacts/product-brief.md"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("_bmad-output/planning-artifacts/prd-workflow-dashboard.md"),
      ).toBeInTheDocument();
    });

    it("renders formatted modification timestamp for each artifact", () => {
      render(<WorkflowArtifactInventory artifacts={sampleArtifacts} />);

      // Each date appears as standalone text in the visible span
      expect(screen.getByText("Mar 10")).toBeInTheDocument();
      expect(screen.getByText("Mar 11")).toBeInTheDocument();
      expect(screen.getByText("Mar 12")).toBeInTheDocument();
      expect(screen.getByText("Mar 14")).toBeInTheDocument();
    });

    it("renders correct number of table rows", () => {
      render(<WorkflowArtifactInventory artifacts={sampleArtifacts} />);

      // 1 header row + 4 data rows = 5 total rows
      const rows = screen.getAllByRole("row");
      expect(rows).toHaveLength(5);
    });

    it("renders a single artifact with all fields", () => {
      const single = [
        makeArtifact(
          "test-brief.md",
          "Product Brief",
          "analysis",
          "_bmad-output/planning-artifacts/test-brief.md",
          "2026-03-14T12:00:00Z",
        ),
      ];
      render(<WorkflowArtifactInventory artifacts={single} />);

      expect(screen.getByText("test-brief.md")).toBeInTheDocument();
      expect(screen.getByText("Product Brief")).toBeInTheDocument();
      expect(screen.getByText("Analysis")).toBeInTheDocument();
      expect(screen.getByText("_bmad-output/planning-artifacts/test-brief.md")).toBeInTheDocument();
      expect(screen.getByText("Mar 14")).toBeInTheDocument();
    });

    it("renders uncategorized artifacts with '—' for phase", () => {
      const artifacts = [
        makeArtifact(
          "random-notes.md",
          "Uncategorized",
          null,
          "_bmad-output/planning-artifacts/random-notes.md",
          "2026-03-13T15:00:00Z",
        ),
      ];
      render(<WorkflowArtifactInventory artifacts={artifacts} />);

      expect(screen.getByText("random-notes.md")).toBeInTheDocument();
      expect(screen.getByText("Uncategorized")).toBeInTheDocument();
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("applies muted styling to uncategorized artifact rows", () => {
      const artifacts = [
        makeArtifact(
          "random-notes.md",
          "Uncategorized",
          null,
          "path/random-notes.md",
          "2026-03-13T15:00:00Z",
        ),
      ];
      const { container } = render(<WorkflowArtifactInventory artifacts={artifacts} />);

      const tbody = container.querySelector("tbody");
      const row = tbody?.querySelector("tr");
      expect(row).toHaveClass("opacity-60");
    });

    it("handles mixed categorized and uncategorized artifacts", () => {
      const artifacts = [
        makeArtifact("prd.md", "PRD", "planning", "path/prd.md", "2026-03-11T10:00:00Z"),
        makeArtifact("misc.md", "Uncategorized", null, "path/misc.md", "2026-03-12T10:00:00Z"),
      ];
      const { container } = render(<WorkflowArtifactInventory artifacts={artifacts} />);

      const rows = container.querySelectorAll("tbody tr");
      expect(rows).toHaveLength(2);
      // First row (categorized) should not have opacity-60
      expect(rows[0]).not.toHaveClass("opacity-60");
      // Second row (uncategorized) should have opacity-60
      expect(rows[1]).toHaveClass("opacity-60");
    });

    it("formats dates from a different year with full year", () => {
      const artifacts = [
        makeArtifact("old-doc.md", "PRD", "planning", "path/old-doc.md", "2025-06-15T10:00:00Z"),
      ];
      render(<WorkflowArtifactInventory artifacts={artifacts} />);

      // Different year should include the year: "Jun 15, 2025"
      expect(screen.getAllByText(/Jun 15, 2025/).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("empty state", () => {
    it("renders empty state message when artifacts array is empty", () => {
      render(<WorkflowArtifactInventory artifacts={[]} />);

      expect(screen.getByText("No artifacts generated yet.")).toBeInTheDocument();
    });

    it("does not render table when artifacts array is empty", () => {
      render(<WorkflowArtifactInventory artifacts={[]} />);

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has aria-label on the section element", () => {
      render(<WorkflowArtifactInventory artifacts={[]} />);

      const section = screen.getByRole("region", { name: "Artifact inventory" });
      expect(section).toBeInTheDocument();
    });

    it("has a semantic h2 heading with Artifacts text", () => {
      render(<WorkflowArtifactInventory artifacts={[]} />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Artifacts");
    });

    it("uses semantic table markup", () => {
      const { container } = render(<WorkflowArtifactInventory artifacts={sampleArtifacts} />);

      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(container.querySelector("thead")).toBeInTheDocument();
      expect(container.querySelector("tbody")).toBeInTheDocument();
      expect(screen.getAllByRole("columnheader")).toHaveLength(5);
    });

    it("has column headers with scope='col'", () => {
      const { container } = render(<WorkflowArtifactInventory artifacts={sampleArtifacts} />);

      const headers = container.querySelectorAll('th[scope="col"]');
      expect(headers).toHaveLength(5);
      expect(headers[0]).toHaveTextContent("Name");
      expect(headers[1]).toHaveTextContent("Type");
      expect(headers[2]).toHaveTextContent("Phase");
      expect(headers[3]).toHaveTextContent("Path");
      expect(headers[4]).toHaveTextContent("Modified");
    });

    it("has sr-only text with complete artifact description for screen readers", () => {
      const artifacts = [
        makeArtifact(
          "prd.md",
          "PRD",
          "planning",
          "_bmad-output/planning-artifacts/prd.md",
          "2026-03-11T14:30:00Z",
        ),
      ];
      render(<WorkflowArtifactInventory artifacts={artifacts} />);

      expect(
        screen.getByText(/prd\.md, PRD artifact in Planning phase, modified Mar 11/),
      ).toBeInTheDocument();
    });

    it("has sr-only text for uncategorized artifacts", () => {
      const artifacts = [
        makeArtifact("misc.md", "Uncategorized", null, "path/misc.md", "2026-03-13T15:00:00Z"),
      ];
      render(<WorkflowArtifactInventory artifacts={artifacts} />);

      expect(
        screen.getByText(/misc\.md, Uncategorized artifact, uncategorized, modified Mar 13/),
      ).toBeInTheDocument();
    });

    it("has aria-hidden on visible table cells", () => {
      const artifacts = [
        makeArtifact(
          "brief.md",
          "Product Brief",
          "analysis",
          "path/brief.md",
          "2026-03-10T10:00:00Z",
        ),
      ];
      const { container } = render(<WorkflowArtifactInventory artifacts={artifacts} />);

      // 4 td cells have aria-hidden, plus the filename span in the first td
      const ariaHiddenCells = container.querySelectorAll('td[aria-hidden="true"]');
      expect(ariaHiddenCells).toHaveLength(4);
      const ariaHiddenSpan = container.querySelector('td span[aria-hidden="true"]');
      expect(ariaHiddenSpan).toBeInTheDocument();
    });
  });
});
