"use client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DependencyNode {
  storyId: string;
  dependsOn: string[];
  blockedBy: string[];
  blocks: string[];
  isBlocked: boolean;
}

interface DependencyGraph {
  nodes: Record<string, DependencyNode>;
  circularWarnings: string[][];
  missingWarnings: string[];
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

const NODE_W = 120;
const NODE_H = 36;
const LAYER_GAP = 160;
const NODE_GAP = 56;

const STATUS_FILL: Record<string, string> = {
  backlog: "#3f3f46",
  "ready-for-dev": "#a16207",
  "in-progress": "#1d4ed8",
  review: "#7e22ce",
  done: "#15803d",
};

/** Topological sort → assign depth layers. Returns storyId→depth map. */
function assignLayers(graph: DependencyGraph): Map<string, number> {
  const depths = new Map<string, number>();
  const visited = new Set<string>();

  function dfs(id: string): number {
    if (depths.has(id)) return depths.get(id)!;
    if (visited.has(id)) return 0; // cycle guard
    visited.add(id);

    const node = graph.nodes[id];
    if (!node || node.dependsOn.length === 0) {
      depths.set(id, 0);
      return 0;
    }

    let maxParent = 0;
    for (const dep of node.dependsOn) {
      if (graph.nodes[dep]) {
        maxParent = Math.max(maxParent, dfs(dep) + 1);
      }
    }
    depths.set(id, maxParent);
    return maxParent;
  }

  for (const id of Object.keys(graph.nodes)) {
    dfs(id);
  }

  return depths;
}

interface NodePos {
  id: string;
  x: number;
  y: number;
}

function layoutNodes(graph: DependencyGraph): NodePos[] {
  const layers = assignLayers(graph);

  // Group by layer
  const layerGroups = new Map<number, string[]>();
  for (const [id, depth] of layers) {
    const group = layerGroups.get(depth) ?? [];
    group.push(id);
    layerGroups.set(depth, group);
  }

  const positions: NodePos[] = [];
  for (const [depth, ids] of layerGroups) {
    ids.sort(); // deterministic order
    for (let i = 0; i < ids.length; i++) {
      positions.push({
        id: ids[i]!,
        x: depth * LAYER_GAP + 20,
        y: i * NODE_GAP + 20,
      });
    }
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Cycle data types
// ---------------------------------------------------------------------------

interface DependencyCycleResult {
  cycles: Array<{ cycle: string[]; length: number; statuses: Record<string, string> }>;
  totalCycles: number;
  affectedStories: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DependencyGraphViewProps {
  depGraph: DependencyGraph;
  storyStatuses?: Record<string, string>;
  cycleData?: DependencyCycleResult | null;
}

export function DependencyGraphView({
  depGraph,
  storyStatuses,
  cycleData,
}: DependencyGraphViewProps) {
  const nodeIds = Object.keys(depGraph.nodes);
  if (nodeIds.length === 0) {
    return (
      <div className="text-[11px] text-[var(--color-text-muted)] text-center py-4">
        No dependencies defined.
      </div>
    );
  }

  const positions = layoutNodes(depGraph);
  const posMap = new Map(positions.map((p) => [p.id, p]));

  // Compute SVG dimensions
  const maxX = Math.max(...positions.map((p) => p.x)) + NODE_W + 40;
  const maxY = Math.max(...positions.map((p) => p.y)) + NODE_H + 40;

  // Build circular edge set for highlighting
  const circularEdges = new Set<string>();
  for (const cycle of depGraph.circularWarnings) {
    for (let i = 0; i < cycle.length; i++) {
      const from = cycle[i]!;
      const to = cycle[(i + 1) % cycle.length]!;
      circularEdges.add(`${from}->${to}`);
    }
  }

  // Build set of cycle-affected story IDs
  const cycleAffected = new Set<string>(cycleData?.affectedStories ?? []);
  const cycleCount = cycleData?.totalCycles ?? depGraph.circularWarnings.length;

  return (
    <div className="space-y-2">
      {/* Cycle count badge + warnings */}
      <div className="flex items-center gap-2 px-1">
        {cycleCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-950 px-2 py-0.5 text-[10px] font-semibold text-red-400">
            {cycleCount} cycle{cycleCount !== 1 ? "s" : ""}
          </span>
        )}
        {depGraph.missingWarnings.length > 0 && (
          <span className="text-[10px] text-yellow-400">
            Missing: {depGraph.missingWarnings.join(", ")}
          </span>
        )}
      </div>
      {depGraph.circularWarnings.length > 0 && (
        <div className="text-[10px] text-red-400 px-1">
          Circular dependencies:{" "}
          {depGraph.circularWarnings.map((c) => c.join(" \u2192 ")).join("; ")}
        </div>
      )}

      {/* Graph SVG */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${maxX} ${maxY}`}
          className="w-full"
          style={{ minWidth: Math.min(maxX, 600), maxHeight: 500 }}
          role="img"
          aria-label="Story dependency graph"
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="var(--color-text-muted)" />
            </marker>
            <marker
              id="arrowhead-red"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
            </marker>
          </defs>

          {/* Edges */}
          {positions.map((pos) => {
            const node = depGraph.nodes[pos.id];
            if (!node) return null;
            return node.dependsOn.map((depId) => {
              const depPos = posMap.get(depId);
              if (!depPos) return null;

              const isCircular = circularEdges.has(`${pos.id}->${depId}`);

              // Curved path from dep (right side) → this node (left side)
              const x1 = depPos.x + NODE_W;
              const y1 = depPos.y + NODE_H / 2;
              const x2 = pos.x;
              const y2 = pos.y + NODE_H / 2;
              const cx = (x1 + x2) / 2;

              return (
                <path
                  key={`${depId}->${pos.id}`}
                  d={`M ${x1} ${y1} Q ${cx} ${y1}, ${cx} ${(y1 + y2) / 2} Q ${cx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isCircular ? "#ef4444" : "var(--color-text-muted)"}
                  strokeWidth={1.5}
                  strokeDasharray={isCircular ? "4 3" : "none"}
                  markerEnd={isCircular ? "url(#arrowhead-red)" : "url(#arrowhead)"}
                  opacity={0.6}
                />
              );
            });
          })}

          {/* Nodes */}
          {positions.map((pos) => {
            const node = depGraph.nodes[pos.id];
            if (!node) return null;
            const status = storyStatuses?.[pos.id] ?? "backlog";
            const fill = STATUS_FILL[status] ?? STATUS_FILL["backlog"] ?? "#3f3f46";
            const inCycle = cycleAffected.has(pos.id);

            return (
              <g key={pos.id}>
                {/* Pulsing ring for cycle-affected nodes */}
                {inCycle && (
                  <rect
                    x={pos.x - 3}
                    y={pos.y - 3}
                    width={NODE_W + 6}
                    height={NODE_H + 6}
                    rx={8}
                    fill="none"
                    stroke="rgba(239, 68, 68, 0.5)"
                    strokeWidth={2}
                  >
                    <animate
                      attributeName="opacity"
                      values="0.3;0.8;0.3"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </rect>
                )}
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={6}
                  fill={fill}
                  stroke={node.isBlocked || inCycle ? "#ef4444" : "transparent"}
                  strokeWidth={node.isBlocked || inCycle ? 2 : 0}
                  opacity={0.85}
                />
                <text
                  x={pos.x + NODE_W / 2}
                  y={pos.y + NODE_H / 2 + 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize={11}
                  fontWeight={500}
                  fontFamily="monospace"
                >
                  {pos.id}
                </text>
                {node.isBlocked && (
                  <text
                    x={pos.x + NODE_W - 4}
                    y={pos.y + 10}
                    textAnchor="end"
                    fill="#ef4444"
                    fontSize={9}
                  >
                    blocked
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
