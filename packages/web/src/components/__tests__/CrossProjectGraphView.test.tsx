/**
 * CrossProjectGraphView component tests (Story 51.4)
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CrossProjectGraphView } from "../CrossProjectGraphView.js";
import type { CrossProjectGraph } from "@composio/ao-core";

const EMPTY_GRAPH: CrossProjectGraph = {
  nodes: [],
  edges: [],
  projectGroups: {},
};

const SAMPLE_GRAPH: CrossProjectGraph = {
  nodes: [
    {
      id: "project-a::story-1",
      storyId: "story-1",
      projectId: "project-a",
      projectName: "Project A",
      status: "blocked",
      isBlocked: true,
    },
    {
      id: "project-b::story-2",
      storyId: "story-2",
      projectId: "project-b",
      projectName: "Project B",
      status: "done",
      isBlocked: false,
    },
  ],
  edges: [
    {
      id: "dep-1",
      sourceNodeId: "project-a::story-1",
      targetNodeId: "project-b::story-2",
      sourceProjectId: "project-a",
      targetProjectId: "project-b",
      isResolved: false,
    },
  ],
  projectGroups: {
    "project-a": ["project-a::story-1"],
    "project-b": ["project-b::story-2"],
  },
};

describe("CrossProjectGraphView", () => {
  it("shows empty state when no dependencies exist", () => {
    render(<CrossProjectGraphView graph={EMPTY_GRAPH} />);
    expect(screen.getByText("No cross-project dependencies defined.")).toBeDefined();
  });

  it("renders nodes and edges when dependencies exist", () => {
    const { container } = render(<CrossProjectGraphView graph={SAMPLE_GRAPH} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeDefined();
    expect(svg?.getAttribute("role")).toBe("img");
    // Should have nodes rendered as rects
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBeGreaterThan(0);
    // Should have edges rendered as paths
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
    // Unresolved edge should have dashed stroke (AC #1: color-coding)
    const edgePaths = Array.from(paths).filter((p) => p.getAttribute("marker-end"));
    const hasDashedEdge = edgePaths.some((p) => p.getAttribute("stroke-dasharray") === "6 3");
    expect(hasDashedEdge).toBe(true);
  });

  it("renders project column headers", () => {
    render(<CrossProjectGraphView graph={SAMPLE_GRAPH} />);
    expect(screen.getByText("Project A")).toBeDefined();
    expect(screen.getByText("Project B")).toBeDefined();
  });

  it("renders node and edge count badges", () => {
    render(<CrossProjectGraphView graph={SAMPLE_GRAPH} />);
    expect(screen.getByText("2 nodes")).toBeDefined();
    expect(screen.getByText("1 edge")).toBeDefined();
  });

  it("shows refresh button when onRefresh provided", () => {
    const onRefresh = vi.fn();
    render(<CrossProjectGraphView graph={EMPTY_GRAPH} onRefresh={onRefresh} />);
    const refreshBtn = screen.getByText("Refresh");
    expect(refreshBtn).toBeDefined();
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("does not show refresh button when onRefresh not provided", () => {
    render(<CrossProjectGraphView graph={EMPTY_GRAPH} />);
    expect(screen.queryAllByText("Refresh")).toHaveLength(0);
  });

  it("shows blocked label on blocked nodes", () => {
    const { container } = render(<CrossProjectGraphView graph={SAMPLE_GRAPH} />);
    const blockedLabels = container.querySelectorAll("text");
    const hasBlocked = Array.from(blockedLabels).some((el) => el.textContent?.includes("blocked"));
    expect(hasBlocked).toBe(true);
  });

  it("shows tooltip with dependency detail on edge click", async () => {
    const { container } = render(<CrossProjectGraphView graph={SAMPLE_GRAPH} />);

    // Find an edge path and click it
    const paths = container.querySelectorAll("path.cursor-pointer");
    expect(paths.length).toBeGreaterThan(0);

    fireEvent.click(paths[0]!);

    // Tooltip should appear with dependency detail
    expect(screen.getByText("Dependency Detail")).toBeDefined();
    expect(screen.getByText("Pending")).toBeDefined();
  });
});
