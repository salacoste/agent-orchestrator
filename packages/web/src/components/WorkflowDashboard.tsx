import { useMemo } from "react";

import { CascadeAlert } from "@/components/CascadeAlert";
import { WorkflowAIGuide } from "@/components/WorkflowAIGuide";
import { WorkflowAgentsPanel } from "@/components/WorkflowAgentsPanel";
import { WorkflowArtifactInventory } from "@/components/WorkflowArtifactInventory";
import { WorkflowLastActivity } from "@/components/WorkflowLastActivity";
import { WorkflowPhaseBar } from "@/components/WorkflowPhaseBar";
import { detectAntiPatterns } from "@/lib/workflow/anti-patterns";
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
  const nudges = useMemo(
    () => detectAntiPatterns(data.artifacts, data.phases, buildPresenceFromPhases(data.phases)),
    [data.artifacts, data.phases],
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-3">
        <WorkflowPhaseBar phases={data.phases} />
      </div>
      <div className="md:col-span-3">
        <CascadeAlert status={null} />
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
      <div className="md:col-span-2">
        <WorkflowAIGuide recommendation={data.recommendation} />
      </div>
      <div>
        <WorkflowLastActivity lastActivity={data.lastActivity} />
      </div>
      <div className="md:col-span-2">
        <WorkflowArtifactInventory artifacts={data.artifacts} />
      </div>
      <div>
        <WorkflowAgentsPanel agents={data.agents} />
      </div>
    </div>
  );
}
