import { WorkflowAIGuide } from "@/components/WorkflowAIGuide";
import { WorkflowAgentsPanel } from "@/components/WorkflowAgentsPanel";
import { WorkflowArtifactInventory } from "@/components/WorkflowArtifactInventory";
import { WorkflowLastActivity } from "@/components/WorkflowLastActivity";
import { WorkflowPhaseBar } from "@/components/WorkflowPhaseBar";
import type { WorkflowResponse } from "@/lib/workflow/types.js";

interface WorkflowDashboardProps {
  data: WorkflowResponse;
}

export function WorkflowDashboard({ data }: WorkflowDashboardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-3">
        <WorkflowPhaseBar phases={data.phases} />
      </div>
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
