import type { AgentInfo } from "@/lib/workflow/types";

interface WorkflowAgentsPanelProps {
  agents: AgentInfo[] | null;
  /** Called when an agent row is clicked (Story 44.6 — focus mode). */
  onAgentClick?: (agentName: string, displayName: string) => void;
}

export function WorkflowAgentsPanel({ agents, onAgentClick }: WorkflowAgentsPanelProps) {
  return (
    <section
      aria-label="BMAD agents"
      className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-4 h-full"
    >
      <h2 className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
        Agents
      </h2>
      {agents && agents.length > 0 ? (
        <ul className="space-y-3">
          {agents.map((agent) => (
            <li key={agent.name}>
              <button
                type="button"
                onClick={() => onAgentClick?.(agent.name, agent.displayName)}
                className="flex items-start gap-2 w-full text-left rounded-[4px] px-1 py-0.5 -mx-1 transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] cursor-pointer"
                data-testid={`agent-row-${agent.name}`}
              >
                <span className="text-[14px] leading-tight shrink-0" aria-hidden="true">
                  {agent.icon}
                </span>
                <div className="min-w-0">
                  <span className="sr-only">
                    {agent.displayName}, {agent.title}. {agent.role}
                  </span>
                  <p
                    className="text-[13px] text-[var(--color-text-primary)] leading-tight"
                    aria-hidden="true"
                  >
                    {agent.displayName}
                  </p>
                  <p
                    className="text-[11px] text-[var(--color-text-muted)] leading-tight"
                    aria-hidden="true"
                  >
                    {agent.title}
                  </p>
                  <p
                    className="text-[11px] text-[var(--color-text-secondary)] leading-tight mt-0.5"
                    aria-hidden="true"
                  >
                    {agent.role}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          {agents === null ? "No agent manifest found." : "No agents configured in manifest."}
        </p>
      )}
    </section>
  );
}
