import { getServices } from "@/lib/services";
import type { OrchestratorConfig } from "@composio/ao-core";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  let config: OrchestratorConfig | null = null;
  let error: string | null = null;

  try {
    const services = await getServices();
    config = services.config;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load config";
  }

  if (error || !config) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <p className="text-red-400">{error ?? "No configuration loaded"}</p>
      </div>
    );
  }

  const { defaults, projects, reactions, notifiers, notificationRouting: routing } = config;

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* General + Defaults side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Section title="General">
          <Row label="Port" value={String(config.port ?? 5000)} />
          <Row label="Config Path" value={String(config.configPath ?? "—")} />
          <Row label="Ready Threshold" value={`${(config.readyThresholdMs ?? 300000) / 1000}s`} />
        </Section>

        {defaults && (
          <Section title="Default Plugins">
            <Row label="Runtime" value={String(defaults.runtime ?? "tmux")} />
            <Row label="Agent" value={String(defaults.agent ?? "claude-code")} />
            <Row label="Workspace" value={String(defaults.workspace ?? "worktree")} />
            <Row
              label="Notifiers"
              value={Array.isArray(defaults.notifiers) ? defaults.notifiers.join(", ") : "desktop"}
            />
          </Section>
        )}
      </div>

      {/* Projects */}
      {projects && (
        <Section title={`Projects (${Object.keys(projects).length})`} className="mb-8">
          <div className="space-y-4">
            {Object.entries(projects).map(([id, project]) => (
              <div key={id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-lg font-semibold text-white">{project.name ?? id}</h3>
                  <span className="text-xs font-mono bg-gray-700 px-2 py-0.5 rounded text-gray-300">
                    {id}
                  </span>
                  {project.sessionPrefix && (
                    <span className="text-xs font-mono bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">
                      prefix: {project.sessionPrefix}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-1 text-sm overflow-hidden">
                  <Row label="Repo" value={project.repo} />
                  <Row label="Path" value={project.path} />
                  <Row label="Branch" value={project.defaultBranch ?? "main"} />
                  <Row
                    label="Agent"
                    value={project.agent ?? String(defaults?.agent ?? "claude-code")}
                  />
                  <Row
                    label="Runtime"
                    value={project.runtime ?? String(defaults?.runtime ?? "tmux")}
                  />
                  <Row
                    label="Workspace"
                    value={project.workspace ?? String(defaults?.workspace ?? "worktree")}
                  />
                  <Row label="Tracker" value={project.tracker?.plugin ?? "github"} />
                  <Row label="SCM" value={project.scm?.plugin ?? "github"} />
                  {project.symlinks && project.symlinks.length > 0 && (
                    <Row label="Symlinks" value={project.symlinks.join(", ")} />
                  )}
                  {project.postCreate && project.postCreate.length > 0 && (
                    <Row label="Post-Create" value={project.postCreate.join(" && ")} />
                  )}
                  {project.agentConfig && (
                    <Row
                      label="Agent Config"
                      value={Object.entries(project.agentConfig)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")}
                    />
                  )}
                </div>
                {project.agentRules && (
                  <div className="mt-2">
                    <span className="text-gray-400 text-xs">Agent Rules:</span>
                    <AgentRulesBlock rules={project.agentRules} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Reactions + Notifiers + Routing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {reactions && (
          <Section title="Reactions" className="lg:col-span-2">
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(reactions).map(([event, cfg]) => (
                <div
                  key={event}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm bg-gray-800/30 rounded px-3 py-2"
                >
                  <span className="font-mono text-yellow-300 w-48">{event}</span>
                  <span className={cfg.auto ? "text-green-400" : "text-gray-500"}>
                    {cfg.auto ? "auto" : "manual"}
                  </span>
                  <span className="text-gray-300">{cfg.action ?? "—"}</span>
                  {cfg.retries !== undefined && (
                    <span className="text-gray-500">retries: {cfg.retries}</span>
                  )}
                  {cfg.escalateAfter !== undefined && (
                    <span className="text-gray-500">escalate: {String(cfg.escalateAfter)}</span>
                  )}
                  {cfg.threshold !== undefined && (
                    <span className="text-gray-500">threshold: {cfg.threshold}</span>
                  )}
                  {cfg.priority !== undefined && (
                    <span className="text-gray-500">priority: {cfg.priority}</span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        <div className="space-y-6">
          {notifiers && Object.keys(notifiers).length > 0 && (
            <Section title="Notifiers">
              {Object.entries(notifiers).map(([name, cfg]) => (
                <Row key={name} label={name} value={`plugin: ${cfg.plugin ?? name}`} />
              ))}
            </Section>
          )}

          {routing && (
            <Section title="Notification Routing">
              {Object.entries(routing).map(([priority, channels]) => (
                <Row key={priority} label={priority} value={channels.join(", ")} />
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="text-lg font-semibold text-gray-200 mb-3 border-b border-gray-700 pb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}

function AgentRulesBlock({ rules }: { rules: string }) {
  const lines = rules.trim().split("\n");
  return (
    <div className="text-xs text-gray-300 bg-gray-900 rounded p-2 mt-1 font-mono">
      {lines.map((line) => (
        <div key={line} className="min-h-[1.25em]">
          {line}
        </div>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 py-0.5 min-w-0">
      <span className="text-gray-400 min-w-[120px] shrink-0">{label}:</span>
      <span className="text-gray-200 font-mono text-sm break-all min-w-0">{value}</span>
    </div>
  );
}
