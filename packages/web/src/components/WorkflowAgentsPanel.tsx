import type { AgentInfo } from "@/lib/workflow/types.js";

interface WorkflowAgentsPanelProps {
  agents: AgentInfo[] | null;
}

export function WorkflowAgentsPanel({ agents }: WorkflowAgentsPanelProps) {
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
            <li key={agent.name} className="flex items-start gap-2">
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
