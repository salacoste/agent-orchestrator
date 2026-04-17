"use client";

import type { ActiveModeState, SessionState } from "@composio/ao-core";
import { useSessionStateSSE } from "@/hooks/useSessionStateSSE";
import { ActivityDot } from "./ActivityDot";

interface SessionStatePanelProps {
  sessionId: string;
}

function ExecutionModeBadge({ mode }: { mode: string | null }) {
  const label = mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : "Standard";
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        background: "rgba(63,185,80,0.12)",
        color: "var(--color-status-ready)",
      }}
    >
      {label}
    </span>
  );
}

function ActiveAgentsRow({ agents, configured }: { agents: string[]; configured: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-medium text-[var(--color-text-muted)]">Agents:</span>
      {agents.length === 0 ? (
        <span className="text-[11px] text-[var(--color-text-tertiary)]">No agents</span>
      ) : (
        agents.map((agent) => (
          <span
            key={agent}
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              background: "rgba(88,166,255,0.1)",
              color: "var(--color-status-working)",
            }}
          >
            {agent}
          </span>
        ))
      )}
      <span
        className="text-[10px]"
        style={{
          color: configured ? "var(--color-status-ready)" : "var(--color-text-tertiary)",
        }}
      >
        {configured ? "Configured" : "Not Configured"}
      </span>
    </div>
  );
}

function ModeProgress({ mode }: { mode: ActiveModeState }) {
  const progressPct =
    typeof mode.iteration === "number" &&
    typeof mode.maxIterations === "number" &&
    mode.maxIterations > 0
      ? Math.min(Math.round((mode.iteration / mode.maxIterations) * 100), 100)
      : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background: mode.active ? "var(--color-status-ready)" : "var(--color-text-tertiary)",
          }}
        />
        <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
          {mode.mode.charAt(0).toUpperCase() + mode.mode.slice(1)}
        </span>
        {mode.phase && (
          <span className="text-[10px] text-[var(--color-text-tertiary)]">{mode.phase}</span>
        )}
        {typeof mode.tasksCompleted === "number" && typeof mode.tasksTotal === "number" && (
          <span className="text-[10px] text-[var(--color-text-tertiary)]">
            {mode.tasksCompleted}/{mode.tasksTotal} tasks
          </span>
        )}
      </div>
      {progressPct !== null && (
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: "rgba(48,54,61,0.5)", width: 120 }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progressPct}%`,
              background: "var(--color-status-ready)",
            }}
          />
        </div>
      )}
    </div>
  );
}

function ActiveModesSection({ modes }: { modes: ActiveModeState[] }) {
  if (modes.length === 0) return null;
  return (
    <div className="space-y-2">
      {modes.map((mode) => (
        <ModeProgress key={mode.mode} mode={mode} />
      ))}
    </div>
  );
}

function HealthIndicator({ state }: { state: SessionState }) {
  if (state.health === null) {
    return (
      <span className="text-[11px] text-[var(--color-text-tertiary)]">
        Health check not available
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: state.health.healthy
            ? "var(--color-status-ready)"
            : "var(--color-status-error)",
        }}
      />
      <span className="text-[11px] text-[var(--color-text-secondary)]">
        {state.health.healthy ? "Healthy" : (state.health.message ?? "Unhealthy")}
      </span>
      {state.health.lastCheck && (
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          {new Date(state.health.lastCheck).toLocaleTimeString()}
        </span>
      )}
    </span>
  );
}

export function SessionStatePanel({ sessionId }: SessionStatePanelProps) {
  const { state, exists, connected } = useSessionStateSSE(sessionId);

  if (!exists) {
    return (
      <div
        className="detail-card mb-6 rounded-[8px] border border-[var(--color-border-default)] p-5"
        data-testid="session-state-panel"
        role="region"
        aria-labelledby="session-state-heading"
      >
        <p className="text-[11px] text-[var(--color-text-tertiary)]">
          No session state available yet
        </p>
      </div>
    );
  }

  if (!state) {
    return (
      <div
        className="detail-card mb-6 rounded-[8px] border border-[var(--color-border-default)] p-5"
        data-testid="session-state-panel"
        role="region"
        aria-labelledby="session-state-heading"
      >
        <p className="text-[11px] text-[var(--color-text-tertiary)]">Loading...</p>
      </div>
    );
  }

  return (
    <div
      className="detail-card mb-6 rounded-[8px] border border-[var(--color-border-default)] p-5"
      data-testid="session-state-panel"
      role="region"
      aria-labelledby="session-state-heading"
    >
      <div className="mb-3 flex items-center gap-2">
        <ActivityDot activity={connected ? "active" : "idle"} dotOnly size={6} />
        <h3
          id="session-state-heading"
          className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
        >
          Session State
        </h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[var(--color-text-muted)]">Mode:</span>
          <ExecutionModeBadge mode={state.executionMode} />
        </div>

        <ActiveAgentsRow agents={state.activeAgents} configured={state.configured} />

        <ActiveModesSection modes={state.activeModes} />

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] font-medium text-[var(--color-text-muted)]">Health:</span>
          <HealthIndicator state={state} />
        </div>
      </div>
    </div>
  );
}
