import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowAgentsPanel } from "../WorkflowAgentsPanel";
import type { AgentInfo } from "@/lib/workflow/types";

function makeAgent(
  name: string,
  displayName: string,
  title: string,
  icon: string,
  role: string,
): AgentInfo {
  return { name, displayName, title, icon, role };
}

const sampleAgents: AgentInfo[] = [
  makeAgent("analyst", "Mary", "Business Analyst", "📊", "Strategic Business Analyst"),
  makeAgent("architect", "Winston", "Architect", "🏗️", "System Architect"),
  makeAgent("dev", "Amelia", "Developer Agent", "💻", "Senior Software Engineer"),
];

describe("WorkflowAgentsPanel", () => {
  describe("agent rendering", () => {
    it("renders displayName for each agent", () => {
      render(<WorkflowAgentsPanel agents={sampleAgents} />);

      expect(screen.getByText("Mary")).toBeInTheDocument();
      expect(screen.getByText("Winston")).toBeInTheDocument();
      expect(screen.getByText("Amelia")).toBeInTheDocument();
    });

    it("renders title for each agent", () => {
      render(<WorkflowAgentsPanel agents={sampleAgents} />);

      expect(screen.getByText("Business Analyst")).toBeInTheDocument();
      expect(screen.getByText("Architect")).toBeInTheDocument();
      expect(screen.getByText("Developer Agent")).toBeInTheDocument();
    });

    it("renders icon for each agent", () => {
      render(<WorkflowAgentsPanel agents={sampleAgents} />);

      expect(screen.getByText("📊")).toBeInTheDocument();
      expect(screen.getByText("🏗️")).toBeInTheDocument();
      expect(screen.getByText("💻")).toBeInTheDocument();
    });

    it("renders correct number of list items", () => {
      render(<WorkflowAgentsPanel agents={sampleAgents} />);

      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(3);
    });

    it("renders role description for each agent", () => {
      render(<WorkflowAgentsPanel agents={sampleAgents} />);

      expect(screen.getByText("Strategic Business Analyst")).toBeInTheDocument();
      expect(screen.getByText("System Architect")).toBeInTheDocument();
      expect(screen.getByText("Senior Software Engineer")).toBeInTheDocument();
    });

    it("renders a single agent correctly", () => {
      const single = [makeAgent("qa", "Quinn", "QA Engineer", "🧪", "Quality Assurance")];
      render(<WorkflowAgentsPanel agents={single} />);

      expect(screen.getByText("Quinn")).toBeInTheDocument();
      expect(screen.getByText("QA Engineer")).toBeInTheDocument();
      expect(screen.getByText("Quality Assurance")).toBeInTheDocument();
      expect(screen.getByText("🧪")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("renders 'no manifest' message when agents is null", () => {
      render(<WorkflowAgentsPanel agents={null} />);

      expect(screen.getByText("No agent manifest found.")).toBeInTheDocument();
    });

    it("renders 'no agents configured' message when agents is empty array", () => {
      render(<WorkflowAgentsPanel agents={[]} />);

      expect(screen.getByText("No agents configured in manifest.")).toBeInTheDocument();
    });

    it("does not render list when agents is null", () => {
      render(<WorkflowAgentsPanel agents={null} />);

      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has aria-label on the section element", () => {
      render(<WorkflowAgentsPanel agents={null} />);

      const section = screen.getByRole("region", { name: "BMAD agents" });
      expect(section).toBeInTheDocument();
    });

    it("has a semantic h2 heading with Agents text", () => {
      render(<WorkflowAgentsPanel agents={null} />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Agents");
    });

    it("has sr-only text with displayName, title, and role for screen readers", () => {
      const agents = [makeAgent("pm", "John", "Product Manager", "📋", "Manages product roadmap")];
      render(<WorkflowAgentsPanel agents={agents} />);

      expect(
        screen.getByText("John, Product Manager. Manages product roadmap"),
      ).toBeInTheDocument();
    });

    it("has aria-hidden on icon spans", () => {
      const agents = [makeAgent("sm", "Bob", "Scrum Master", "🏃", "Agile SM")];
      const { container } = render(<WorkflowAgentsPanel agents={agents} />);

      const ariaHiddenSpans = container.querySelectorAll('[aria-hidden="true"]');
      // icon span + displayName p + title p + role p = 4 aria-hidden elements per agent
      expect(ariaHiddenSpans).toHaveLength(4);
      // Verify the icon specifically is aria-hidden
      const iconSpan = screen.getByText("🏃");
      expect(iconSpan).toHaveAttribute("aria-hidden", "true");
    });

    it("uses semantic list markup", () => {
      render(<WorkflowAgentsPanel agents={sampleAgents} />);

      expect(screen.getByRole("list")).toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
    });
  });
});
