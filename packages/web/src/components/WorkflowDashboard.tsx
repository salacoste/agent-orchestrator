import { useMemo } from "react";

import { useCascadeStatus } from "@/hooks/useCascadeStatus";
import { useSprintCost } from "@/hooks/useSprintCost";
import { useConflictCheckpoint } from "@/hooks/useConflictCheckpoint";
import { CascadeAlert } from "@/components/CascadeAlert";
import { ConflictCheckpointPanel } from "@/components/ConflictCheckpointPanel";
import { ProjectChatPanel } from "@/components/ProjectChatPanel";
import { SprintCostPanel } from "@/components/SprintCostPanel";
import { WorkflowAIGuide } from "@/components/WorkflowAIGuide";
import { WorkflowAgentsPanel } from "@/components/WorkflowAgentsPanel";
import { WorkflowArtifactInventory } from "@/components/WorkflowArtifactInventory";
import { WorkflowLastActivity } from "@/components/WorkflowLastActivity";
import { WorkflowPhaseBar } from "@/components/WorkflowPhaseBar";
import { detectAntiPatterns } from "@/lib/workflow/anti-patterns";
import { generateInsights } from "@/lib/workflow/project-context-aggregator";
import type { Phase, WorkflowResponse } from "@/lib/workflow/types";

interface WorkflowDashboardProps {
  data: WorkflowResponse;
}

/** Build phase presence from phases array (client-safe, no Node.js imports). */
function buildPresenceFromPhases(phases: WorkflowResponse["phases"]): Record<Phase, boolean> {
  const presence: Record<Phase, boolean> = {
    analysis: false,
    planning: false,
    solutioning: false,
    implementation: false,
  };
  for (const p of phases) {
    if (p.state !== "not-started") {
      presence[p.id] = true;
    }
  }
  return presence;
}

export function WorkflowDashboard({ data }: WorkflowDashboardProps) {
  const { status: cascadeStatus, resume: cascadeResume } = useCascadeStatus();
  const { cost: sprintCost, clock: sprintClock } = useSprintCost();
  const { conflicts, timeline } = useConflictCheckpoint();

  const nudges = useMemo(
    () => detectAntiPatterns(data.artifacts, data.phases, buildPresenceFromPhases(data.phases)),
    [data.artifacts, data.phases],
  );

  const insights = useMemo(
    () => generateInsights(0, 0, 0, 0), // Placeholder — wire to real sprint data
    [],
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Row 1: Phase pipeline (full width) */}
      <div className="md:col-span-3">
        <WorkflowPhaseBar phases={data.phases} />
      </div>

      {/* Row 2: Alerts (full width, conditional) */}
      <div className="md:col-span-3">
        <CascadeAlert status={cascadeStatus} onResume={cascadeResume} />
      </div>
      {nudges.length > 0 && (
        <div className="md:col-span-3 space-y-2" data-testid="anti-pattern-nudges">
          {nudges.map((nudge) => (
            <div
              key={nudge.id}
              className={`rounded-[6px] border px-4 py-3 text-[12px] ${
                nudge.severity === "warning"
                  ? "border-[var(--color-status-attention)] bg-[var(--color-status-attention)]/5"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)]"
              }`}
              data-testid={`nudge-${nudge.id}`}
            >
              <span className="font-semibold">{nudge.title}:</span>{" "}
              <span className="text-[var(--color-text-secondary)]">{nudge.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Row 3: AI Guide + Cost & Schedule */}
      <div className="md:col-span-2">
        <WorkflowAIGuide recommendation={data.recommendation} />
      </div>
      <div>
        <SprintCostPanel cost={sprintCost} clock={sprintClock} />
      </div>

      {/* Row 4: Artifacts + Last Activity */}
      <div className="md:col-span-2">
        <WorkflowArtifactInventory artifacts={data.artifacts} />
      </div>
      <div>
        <WorkflowLastActivity lastActivity={data.lastActivity} />
      </div>

      {/* Row 5: Conflicts + Agents */}
      <div className="md:col-span-2">
        <ConflictCheckpointPanel conflicts={conflicts} timeline={timeline} />
      </div>
      <div>
        <WorkflowAgentsPanel agents={data.agents} />
      </div>

      {/* Row 6: Chat panel (full width) */}
      <div className="md:col-span-3">
        <ProjectChatPanel insights={insights} />
      </div>
    </div>
  );
}
