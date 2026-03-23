import { useMemo } from "react";

import { useCascadeStatus } from "@/hooks/useCascadeStatus";
import { useSprintCost } from "@/hooks/useSprintCost";
import { useConflictCheckpoint } from "@/hooks/useConflictCheckpoint";
import { useProjectChat } from "@/hooks/useProjectChat";
import { useUserRole } from "@/hooks/useUserRole";
import { useExperienceLevel } from "@/hooks/useExperienceLevel";
import { CascadeAlert } from "@/components/CascadeAlert";
import { ConflictCheckpointPanel } from "@/components/ConflictCheckpointPanel";
import { ProjectChatPanel } from "@/components/ProjectChatPanel";
import { RoleSelector } from "@/components/RoleSelector";
import { SprintCostPanel } from "@/components/SprintCostPanel";
import { WorkflowAIGuide } from "@/components/WorkflowAIGuide";
import { WorkflowAgentsPanel } from "@/components/WorkflowAgentsPanel";
import { WorkflowArtifactInventory } from "@/components/WorkflowArtifactInventory";
import { WorkflowLastActivity } from "@/components/WorkflowLastActivity";
import { WorkflowPhaseBar } from "@/components/WorkflowPhaseBar";
import { detectAntiPatterns } from "@/lib/workflow/anti-patterns";
import { generateInsights } from "@/lib/workflow/project-context-aggregator";
import {
  getWidgetLayout,
  filterWidgetsByLevel,
  WIDGET_META,
  type WidgetId,
} from "@/lib/workflow/widget-registry";
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

/**
 * WorkflowDashboard — Role-based widget grid (Story 44.1).
 *
 * Renders dashboard widgets in role-specific order using the widget registry.
 * Role is stored in localStorage with a dropdown selector in the header.
 */
export function WorkflowDashboard({ data }: WorkflowDashboardProps) {
  const { role, setRole } = useUserRole();
  const { level, expertMode, toggleExpertMode } = useExperienceLevel();
  const { status: cascadeStatus, resume: cascadeResume } = useCascadeStatus();
  const { cost: sprintCost, clock: sprintClock } = useSprintCost();
  const { conflicts, timeline } = useConflictCheckpoint();
  const { messages: chatMessages, sendMessage: chatSend } = useProjectChat();

  const nudges = useMemo(
    () => detectAntiPatterns(data.artifacts, data.phases, buildPresenceFromPhases(data.phases)),
    [data.artifacts, data.phases],
  );

  const insights = useMemo(() => generateInsights(0, 0, 0, 0), []);

  // Role layout filtered by experience level (Story 44.5)
  const layout = useMemo(() => filterWidgetsByLevel(getWidgetLayout(role), level), [role, level]);

  /** Render a single widget by ID.
   * Intentionally recreated per render to capture fresh data via closures.
   * Extract to stable ref if widget count grows past ~20. */
  function renderWidget(widgetId: WidgetId): React.ReactNode {
    switch (widgetId) {
      case "phaseBar":
        return <WorkflowPhaseBar phases={data.phases} />;
      case "cascadeAlert":
        return <CascadeAlert status={cascadeStatus} onResume={cascadeResume} />;
      case "antiPatterns":
        return nudges.length > 0 ? (
          <div className="space-y-2" data-testid="anti-pattern-nudges">
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
        ) : null;
      case "recommendation":
        return <WorkflowAIGuide recommendation={data.recommendation} />;
      case "agents":
        return <WorkflowAgentsPanel agents={data.agents} />;
      case "artifacts":
        return <WorkflowArtifactInventory artifacts={data.artifacts} />;
      case "lastActivity":
        return <WorkflowLastActivity lastActivity={data.lastActivity} />;
      case "costPanel":
        return <SprintCostPanel cost={sprintCost} clock={sprintClock} />;
      case "conflictPanel":
        return <ConflictCheckpointPanel conflicts={conflicts} timeline={timeline} />;
      case "chatPanel":
        return (
          <ProjectChatPanel
            insights={[
              ...insights,
              ...chatMessages.map((m, i) => ({
                id: `chat-${i}`,
                text: `${m.role === "user" ? "You" : "Assistant"}: ${m.content}`,
                severity: "info" as const,
              })),
            ]}
            onAskQuestion={chatSend}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div>
      {/* Header with role selector + expert toggle */}
      <div className="flex items-center justify-between mb-4" data-testid="dashboard-header">
        <h1 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
          Workflow Dashboard
        </h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
            <input
              type="checkbox"
              checked={expertMode}
              onChange={toggleExpertMode}
              data-testid="expert-mode-toggle"
            />
            Expert
          </label>
          <RoleSelector role={role} onChange={setRole} />
        </div>
      </div>

      {/* Dynamic widget grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="widget-grid">
        {layout.map((widgetId) => {
          const meta = WIDGET_META[widgetId];
          const content = renderWidget(widgetId);
          if (!content) return null;
          return (
            <div
              key={widgetId}
              className={meta.colSpan === 3 ? "md:col-span-3" : ""}
              data-testid={`widget-${widgetId}`}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
