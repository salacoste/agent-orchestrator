"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type {
  CrossProjectGraph,
  CrossProjectGraphNode,
  CrossProjectGraphEdge,
} from "@composio/ao-core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_W = 140;
const NODE_H = 36;
const COL_GAP = 200;
const NODE_GAP = 52;
const HEADER_H = 28;

import { STATUS_FILL } from "@/lib/status-colors";

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

/** Project name from project ID, truncating long names. */
function truncate(name: string, max = 18): string {
  return name.length > max ? name.slice(0, max - 1) + "\u2026" : name;
}

/** Layout nodes in columns grouped by project. */
interface NodePos {
  node: CrossProjectGraphNode;
  x: number;
  y: number;
}

function layoutByProject(graph: CrossProjectGraph): NodePos[] {
  const positions: NodePos[] = [];
  const projectIds = Object.keys(graph.projectGroups);

  // Build node lookup Map for O(1) access (instead of O(n) find per node)
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  for (let colIdx = 0; colIdx < projectIds.length; colIdx++) {
    const projectId = projectIds[colIdx];
    if (!projectId) continue;
    const nodeIds = graph.projectGroups[projectId] ?? [];
    const x = colIdx * COL_GAP + 20;

    for (let rowIdx = 0; rowIdx < nodeIds.length; rowIdx++) {
      const nodeId = nodeIds[rowIdx];
      if (!nodeId) continue;
      const node = nodeMap.get(nodeId);
      if (!node) continue;
      positions.push({
        node,
        x,
        y: rowIdx * NODE_GAP + HEADER_H + 10,
      });
    }
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Edge tooltip
// ---------------------------------------------------------------------------

interface EdgeTooltipData {
  edge: CrossProjectGraphEdge;
  sourceNode: CrossProjectGraphNode;
  targetNode: CrossProjectGraphNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CrossProjectGraphViewProps {
  graph: CrossProjectGraph;
  onRefresh?: () => void;
}

export function CrossProjectGraphView({ graph, onRefresh }: CrossProjectGraphViewProps) {
  const [tooltip, setTooltip] = useState<EdgeTooltipData | null>(null);

  // Memoized node lookup Map — shared across click handler and layout (L3+L4 fix)
  const nodeLookup = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  // Close tooltip on outside click or Escape key
  useEffect(() => {
    if (!tooltip) return;
    const clickHandler = () => setTooltip(null);
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTooltip(null);
    };
    document.addEventListener("click", clickHandler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("click", clickHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [tooltip]);

  const handleEdgeClick = useCallback(
    (edge: CrossProjectGraphEdge) => {
      const sourceNode = nodeLookup.get(edge.sourceNodeId);
      const targetNode = nodeLookup.get(edge.targetNodeId);
      if (!sourceNode || !targetNode) return;

      setTooltip((prev) => {
        // Toggle off if clicking the same edge
        if (prev && prev.edge.id === edge.id) return null;
        return { edge, sourceNode, targetNode };
      });
    },
    [nodeLookup],
  );

  // Empty state
  if (graph.nodes.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
            Cross-Project Dependencies
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline"
            >
              Refresh
            </button>
          )}
        </div>
        <div className="text-[11px] text-[var(--color-text-muted)] text-center py-4">
          No cross-project dependencies defined.
        </div>
      </div>
    );
  }

  const positions = layoutByProject(graph);
  const posMap = new Map(positions.map((p) => [p.node.id, p]));

  const projectIds = Object.keys(graph.projectGroups);

  // Compute SVG dimensions
  const maxX = projectIds.length > 0 ? (projectIds.length - 1) * COL_GAP + NODE_W + 60 : 400;
  const maxY = positions.length > 0 ? Math.max(...positions.map((p) => p.y)) + NODE_H + 40 : 200;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
            Cross-Project Dependencies
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-950 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
            {graph.nodes.length} node{graph.nodes.length !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-950 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
            {graph.edges.length} edge{graph.edges.length !== 1 ? "s" : ""}
          </span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline"
          >
            Refresh
          </button>
        )}
      </div>

      {/* Graph SVG */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${maxX} ${maxY}`}
          className="w-full"
          style={{ minWidth: Math.min(maxX, 600), maxHeight: 600 }}
          role="img"
          aria-label="Cross-project dependency graph"
        >
          <defs>
            <marker
              id="cp-arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="var(--color-text-muted)" />
            </marker>
            <marker
              id="cp-arrowhead-green"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#15803d" />
            </marker>
          </defs>

          {/* Project column headers */}
          {projectIds.map((projectId, colIdx) => {
            const firstNode = graph.projectGroups[projectId]?.[0];
            const firstPos = firstNode ? posMap.get(firstNode) : undefined;
            const headerX = colIdx * COL_GAP + 20;
            const headerY = 6;
            const node = firstPos?.node;
            const projectName = node?.projectName ?? projectId;

            return (
              <text
                key={`header-${projectId}`}
                x={headerX + NODE_W / 2}
                y={headerY + 12}
                textAnchor="middle"
                fill="var(--color-text-muted)"
                fontSize={11}
                fontWeight={600}
                fontFamily="monospace"
              >
                {truncate(projectName)}
              </text>
            );
          })}

          {/* Edges */}
          {graph.edges.map((edge) => {
            const sourcePos = posMap.get(edge.sourceNodeId);
            const targetPos = posMap.get(edge.targetNodeId);
            if (!sourcePos || !targetPos) return null;

            // Edge goes from source (right) to target (left)
            const x1 = sourcePos.x + NODE_W;
            const y1 = sourcePos.y + NODE_H / 2;
            const x2 = targetPos.x;
            const y2 = targetPos.y + NODE_H / 2;

            // Midpoint for control
            const cx = (x1 + x2) / 2;

            const markerEnd = edge.isResolved ? "url(#cp-arrowhead-green)" : "url(#cp-arrowhead)";
            const strokeColor = edge.isResolved ? "#15803d" : "var(--color-text-muted)";
            const opacity = edge.isResolved ? 0.5 : 0.7;

            return (
              <path
                key={edge.id}
                d={`M ${x1} ${y1} Q ${cx} ${y1}, ${cx} ${(y1 + y2) / 2} Q ${cx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={1.5}
                strokeDasharray={edge.isResolved ? "none" : "6 3"}
                markerEnd={markerEnd}
                opacity={opacity}
                tabIndex={0}
                role="button"
                aria-label={`Dependency: ${sourcePos.node.storyId} depends on ${targetPos.node.storyId}`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdgeClick(edge);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleEdgeClick(edge);
                  }
                }}
              />
            );
          })}

          {/* Nodes */}
          {positions.map((pos) => {
            const { node } = pos;
            const fill = STATUS_FILL[node.status] ?? STATUS_FILL["unknown"] ?? "#52525b";

            return (
              <g key={node.id}>
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={6}
                  fill={fill}
                  stroke={node.isBlocked ? "#ef4444" : "transparent"}
                  strokeWidth={node.isBlocked ? 2 : 0}
                  opacity={0.85}
                />
                <text
                  x={pos.x + NODE_W / 2}
                  y={pos.y + NODE_H / 2 + 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize={9}
                  fontWeight={500}
                  fontFamily="monospace"
                >
                  {truncate(node.storyId, 18)}
                </text>
                {node.isBlocked && (
                  <text
                    x={pos.x + NODE_W - 4}
                    y={pos.y + 10}
                    textAnchor="end"
                    fill="#ef4444"
                    fontSize={8}
                  >
                    blocked
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Edge detail tooltip — HTML overlay positioned relative to graph container */}
        {tooltip && (
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-md p-2 text-[10px] text-zinc-200 font-mono space-y-1 shadow-lg mt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-semibold text-zinc-100">Dependency Detail</div>
            <div>
              Source:{" "}
              <span className="text-blue-400">{truncate(tooltip.sourceNode.storyId, 20)}</span>{" "}
              <span className="text-zinc-500">({tooltip.sourceNode.projectName})</span>
            </div>
            <div>
              Target:{" "}
              <span className="text-blue-400">{truncate(tooltip.targetNode.storyId, 20)}</span>{" "}
              <span className="text-zinc-500">({tooltip.targetNode.projectName})</span>
            </div>
            <div>
              Status:{" "}
              <span className={tooltip.edge.isResolved ? "text-green-400" : "text-yellow-400"}>
                {tooltip.edge.isResolved ? "Resolved" : "Pending"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
