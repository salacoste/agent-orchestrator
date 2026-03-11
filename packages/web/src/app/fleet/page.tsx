"use client";

import { useState, useEffect } from "react";
import { useSSEConnection } from "@/hooks/useSSEConnection";
import { useFlashAnimation } from "@/hooks/useFlashAnimation";

interface DashboardSession {
  id: string;
  projectId: string;
  status: string;
  activity: string;
  branch: string;
  issueId: string | null;
  issueLabel: string | null;
  issueTitle: string | null;
  summary: string | null;
  createdAt: string;
  lastActivityAt: string;
  metadata: Record<string, unknown>;
}

interface FleetStats {
  total: number;
  active: number;
  idle: number;
  blocked: number;
}

type AgentStatus = "active" | "idle" | "blocked";

function getAgentStatus(session: DashboardSession): AgentStatus {
  if (session.activity === "blocked") return "blocked";
  if (session.activity === "idle") return "idle";
  return "active";
}

function getStatusColor(status: AgentStatus): string {
  switch (status) {
    case "active":
      return "text-green-400";
    case "idle":
      return "text-yellow-400";
    case "blocked":
      return "text-red-400";
  }
}

function getStatusEmoji(status: AgentStatus): string {
  switch (status) {
    case "active":
      return "🟢";
    case "idle":
      return "🟡";
    case "blocked":
      return "🔴";
  }
}

function getStatusAriaLabel(status: AgentStatus): string {
  switch (status) {
    case "active":
      return "Agent is active and working";
    case "idle":
      return "Agent is idle waiting for work";
    case "blocked":
      return "Agent is blocked and needs attention";
  }
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

interface AgentCardProps {
  session: DashboardSession;
  status: AgentStatus;
  onCardClick: (session: DashboardSession) => void;
  onResumeClick: (session: DashboardSession) => void;
}

function AgentCard({ session, status, onCardClick, onResumeClick }: AgentCardProps) {
  const emoji = getStatusEmoji(status);
  const colorClass = getStatusColor(status);
  const ariaLabel = getStatusAriaLabel(status);

  const handleResumeClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onResumeClick(session);
  };

  return (
    <div
      className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg p-4 hover:border-[var(--color-border-hover)] transition-all duration-300 cursor-pointer"
      onClick={() => onCardClick(session)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={colorClass} aria-label={ariaLabel} role="status">
              {emoji}
            </span>
            <span className="text-xs font-mono text-[var(--color-text-muted)] truncate">
              {session.id}
            </span>
          </div>
          {session.issueLabel && (
            <div className="text-xs font-medium text-[var(--color-text-primary)] truncate">
              {session.issueLabel}
            </div>
          )}
          {session.issueTitle && (
            <div className="text-xs text-[var(--color-text-secondary)] truncate">
              {session.issueTitle}
            </div>
          )}
        </div>
      </div>
      {session.summary && (
        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 mb-2">
          {session.summary}
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>Last activity: {formatTimeAgo(session.lastActivityAt)}</span>
      </div>
      {status === "blocked" && (
        <button
          onClick={handleResumeClick}
          className="mt-3 w-full px-3 py-2 text-xs font-medium bg-[var(--color-accent)] text-[var(--color-accent-foreground)] rounded hover:opacity-90 transition-opacity"
        >
          Resume
        </button>
      )}
    </div>
  );
}

interface AgentColumnProps {
  title: string;
  emoji: string;
  sessions: DashboardSession[];
  status: AgentStatus;
  onCardClick: (session: DashboardSession) => void;
  onResumeClick: (session: DashboardSession) => void;
}

function AgentColumn({
  title,
  emoji,
  sessions,
  status,
  onCardClick,
  onResumeClick,
}: AgentColumnProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <span aria-label={`Status: ${title}`}>{emoji}</span>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h2>
        <span className="text-xs text-[var(--color-text-muted)]">({sessions.length})</span>
      </div>
      <div className="flex flex-col gap-3">
        {sessions.length === 0 ? (
          <div className="text-xs text-[var(--color-text-muted)] text-center py-8">No agents</div>
        ) : (
          sessions.map((session) => (
            <AgentCard
              key={session.id}
              session={session}
              status={status}
              onCardClick={onCardClick}
              onResumeClick={onResumeClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function FleetPage() {
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<DashboardSession | null>(null);
  const [resumeAgent, setResumeAgent] = useState<DashboardSession | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  const fetchData = () => {
    setLoading(true);
    setError(null);

    fetch("/api/sessions?active=true")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load fleet status");
        return res.json();
      })
      .then((data) => {
        setSessions(data.sessions || []);
        setStats(data.stats || null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // SSE for real-time updates
  useSSEConnection(
    {
      onAgentStatusChanged: () => {
        fetchData();
      },
      onStoryBlocked: () => {
        fetchData();
      },
    },
    { eventSourceFactory: () => new EventSource("/api/events") },
  );

  // Flash animation on data changes
  const flashTrigger = sessions ? [sessions.length] : [];
  const isFlashing = useFlashAnimation(flashTrigger);

  // Handler for card click - opens drawer
  const handleCardClick = (session: DashboardSession) => {
    setSelectedAgent(session);
    setIsDrawerOpen(true);
  };

  // Handler for resume click - opens modal
  const handleResumeClick = (session: DashboardSession) => {
    setResumeAgent(session);
    setIsModalOpen(true);
  };

  // Handler for executing resume command
  const handleResumeAgent = async () => {
    if (!resumeAgent) return;

    setIsResuming(true);
    try {
      const storyId =
        (resumeAgent.metadata["storyId"] as string) || resumeAgent.issueLabel || "unknown";

      // Call the resume API endpoint
      const response = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: resumeAgent.id, storyId }),
      });

      if (!response.ok) {
        throw new Error("Failed to resume agent");
      }

      setIsModalOpen(false);
      // Refresh data to show updated status
      fetchData();
    } catch (err) {
      console.error("Resume error:", err);
      alert(
        "Failed to resume agent. Please try again or use the CLI: ao resume " +
          resumeAgent.issueLabel,
      );
    } finally {
      setIsResuming(false);
    }
  };

  // Handler for spawn button in empty state
  const handleSpawnClick = () => {
    // Open the spawn modal or navigate to spawn page
    // For now, show instructions since spawn UI is a separate feature
    alert("To spawn a new agent, use the CLI: ao spawn <story-id>");
  };

  // Categorize agents by status
  const activeAgents = sessions.filter((s) => getAgentStatus(s) === "active");
  const idleAgents = sessions.filter((s) => getAgentStatus(s) === "idle");
  const blockedAgents = sessions.filter((s) => getAgentStatus(s) === "blocked");

  // Mock activity log generator (in real implementation, fetch from API)
  const generateMockActivityLog = (session: DashboardSession) => {
    return [
      { time: session.lastActivityAt, event: "Last activity" },
      { time: session.createdAt, event: "Agent created" },
    ];
  };

  // Mock progress data (in real implementation, fetch from story metadata)
  const getMockProgress = (_session: DashboardSession) => {
    return { completed: 0, total: 0 }; // Placeholder until progress tracking is implemented
  };

  if (loading) {
    return (
      <div className="text-[var(--color-text-muted)] text-sm p-8">Loading fleet status...</div>
    );
  }

  if (error) {
    return <div className="text-red-400 text-sm p-8">{error}</div>;
  }

  // Empty state
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="text-4xl mb-4">🚀</div>
        <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
          No active agents
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Spawn agents with{" "}
          <code className="px-2 py-1 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded text-xs">
            ao spawn
          </code>
        </p>
        <button
          onClick={handleSpawnClick}
          className="px-4 py-2 text-sm font-medium bg-[var(--color-accent)] text-[var(--color-accent-foreground)] rounded hover:opacity-90 transition-opacity"
        >
          Spawn Agent
        </button>
      </div>
    );
  }

  return (
    <div
      className={`p-6 transition-colors duration-300 ${isFlashing ? "bg-[rgba(59,130,246,0.05)]" : ""}`}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
          Fleet Monitoring
        </h1>
        {stats && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Total: {stats.total} | Active: {stats.active} | Idle: {stats.idle} | Blocked:{" "}
            {stats.blocked}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AgentColumn
          title="Active"
          emoji="🟢"
          sessions={activeAgents}
          status="active"
          onCardClick={handleCardClick}
          onResumeClick={handleResumeClick}
        />
        <AgentColumn
          title="Idle"
          emoji="🟡"
          sessions={idleAgents}
          status="idle"
          onCardClick={handleCardClick}
          onResumeClick={handleResumeClick}
        />
        <AgentColumn
          title="Blocked"
          emoji="🔴"
          sessions={blockedAgents}
          status="blocked"
          onCardClick={handleCardClick}
          onResumeClick={handleResumeClick}
        />
      </div>

      {/* Agent Detail Drawer */}
      {selectedAgent && isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex justify-end"
          onClick={() => setIsDrawerOpen(false)}
          role="presentation"
        >
          <div
            className="bg-[var(--color-bg-surface)] w-full max-w-md h-full overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            <div className="flex items-center justify-between mb-6">
              <h2
                id="drawer-title"
                className="text-lg font-semibold text-[var(--color-text-primary)]"
              >
                Agent Details
              </h2>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                aria-label="Close drawer"
              >
                ✕
              </button>
            </div>
            {selectedAgent.issueLabel && (
              <div className="mb-4">
                <span className="text-xs font-mono text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-1 rounded">
                  {selectedAgent.issueLabel}
                </span>
              </div>
            )}
            {selectedAgent.issueTitle && (
              <h3 className="text-base font-medium text-[var(--color-text-primary)] mb-2">
                {selectedAgent.issueTitle}
              </h3>
            )}
            {selectedAgent.summary && (
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                {selectedAgent.summary}
              </p>
            )}
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-[var(--color-text-muted)] mb-1">Agent ID</div>
                <div className="font-mono text-xs">{selectedAgent.id}</div>
              </div>
              <div>
                <div className="text-[var(--color-text-muted)] mb-1">Status</div>
                <div>{selectedAgent.status}</div>
              </div>
              <div>
                <div className="text-[var(--color-text-muted)] mb-1">Last Activity</div>
                <div>{formatTimeAgo(selectedAgent.lastActivityAt)}</div>
              </div>

              {/* Recent Activity Log */}
              <div className="pt-4 border-t border-[var(--color-border-default)]">
                <div className="text-[var(--color-text-muted)] mb-2">Recent Activity</div>
                <div className="space-y-2">
                  {generateMockActivityLog(selectedAgent).map((activity, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="text-[var(--color-text-muted)]">
                        {formatTimeAgo(activity.time)}
                      </span>
                      <span className="text-[var(--color-text-secondary)]">{activity.event}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Story Progress */}
              <div className="pt-4 border-t border-[var(--color-border-default)]">
                <div className="text-[var(--color-text-muted)] mb-2">Story Progress</div>
                {(() => {
                  const progress = getMockProgress(selectedAgent);
                  if (progress.total === 0) {
                    <div className="text-xs text-[var(--color-text-muted)]">
                      Progress tracking not available for this story
                    </div>;
                  }
                  return (
                    <div className="text-xs">
                      <span className="text-[var(--color-text-secondary)]">
                        {progress.completed} of {progress.total} tasks completed
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="pt-4 border-t border-[var(--color-border-default)]">
                <div className="text-[var(--color-text-muted)] mb-2">CLI Commands</div>
                <div className="space-y-1">
                  <code className="block text-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded px-2 py-1">
                    ao logs {selectedAgent.id}
                  </code>
                  <code className="block text-xs bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded px-2 py-1">
                    ao status{" "}
                    {(selectedAgent.metadata["storyId"] as string) ||
                      selectedAgent.issueLabel ||
                      "unknown"}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resume Modal */}
      {resumeAgent && isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
          role="presentation"
        >
          <div
            className="bg-[var(--color-bg-surface)] rounded-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                id="modal-title"
                className="text-lg font-semibold text-[var(--color-text-primary)]"
              >
                Resume Agent
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Resume <strong>{resumeAgent.id}</strong> to continue work on{" "}
              <span className="font-mono">{resumeAgent.issueLabel || "unknown"}</span>
            </p>
            <div className="bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] rounded p-3 mb-4">
              <div className="text-xs text-[var(--color-text-muted)] mb-1">Story Summary</div>
              <p className="text-sm">{resumeAgent.summary || "No summary available"}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleResumeAgent}
                disabled={isResuming}
                className="flex-1 px-4 py-2 text-sm font-medium bg-[var(--color-accent)] text-[var(--color-accent-foreground)] rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isResuming ? "Resuming..." : "Resume"}
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isResuming}
                className="px-4 py-2 text-sm font-medium border border-[var(--color-border-default)] rounded hover:bg-[var(--color-bg-hover)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
