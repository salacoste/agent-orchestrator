"use client";

import { useState, useEffect, useRef } from "react";
import { useSSEConnection } from "@/hooks/useSSEConnection.js";

interface ActivityEvent {
  timestamp: string;
  type: string;
  description: string;
}

interface AgentSessionCardProps {
  agentId: string;
  onClose: () => void;
}

interface AgentData {
  id: string;
  issueLabel: string | null;
  issueTitle: string | null;
  status: string;
  activity: string;
  blockReason?: string;
  createdAt: string;
  lastActivityAt: string;
}

interface ActivityData {
  events: ActivityEvent[];
}

interface LogsData {
  logs: string[];
}

export default function AgentSessionCard({ agentId, onClose }: AgentSessionCardProps) {
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [logsData, setLogsData] = useState<LogsData | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [size, setSize] = useState({ width: 600, height: 500 });
  const [isResizing, setIsResizing] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const resizeStartPos = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Fetch agent data
  const fetchAgentData = () => {
    fetch(`/api/agent/${agentId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch agent data");
        return res.json();
      })
      .then(setAgentData)
      .catch((err) => {
        console.error("Failed to fetch agent data:", err);
        setError("Failed to load agent data");
      });
  };

  useEffect(() => {
    fetchAgentData();
  }, [agentId]);

  // Fetch activity data when modal opens
  useEffect(() => {
    fetch(`/api/agent/${agentId}/activity`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch activity");
        return res.json();
      })
      .then((data: ActivityData) => {
        // Only show last 50 events
        setActivityData({
          events: data.events?.slice(-50).reverse() || [],
        });
      })
      .catch((err) => {
        console.error("Failed to fetch activity:", err);
        setActivityData({ events: [] });
      });
  }, [agentId]);

  // SSE integration for real-time updates
  useSSEConnection({
    onAgentStatusChanged: (data) => {
      if (data.agentId === agentId) {
        fetchAgentData();
      }
    },
  });

  // Auto-scroll logs when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current && logsEndRef.current.scrollIntoView) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logsData, autoScroll]);

  // Fetch logs when View Logs is clicked
  const handleViewLogs = () => {
    const willShowLogs = !showLogs;
    setShowLogs(willShowLogs);
    setError(null);

    if (willShowLogs && !logsData) {
      setIsLoadingLogs(true);
      fetch(`/api/agent/${agentId}/logs`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch logs");
          return res.json();
        })
        .then((data: LogsData) => {
          // Only show last 100 lines
          setLogsData({
            logs: data.logs?.slice(-100) || [],
          });
        })
        .catch((err) => {
          console.error("Failed to fetch logs:", err);
          setError("Failed to load logs");
          setLogsData({ logs: [] });
        })
        .finally(() => {
          setIsLoadingLogs(false);
        });
    }
  };

  // Format time ago
  function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  // Calculate session duration
  function calculateDuration(createdAt: string): string {
    const created = new Date(createdAt);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - created.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  // Get event color class
  function getEventColor(type: string): string {
    switch (type) {
      case "tool_call":
        return "text-blue-400";
      case "response":
        return "text-green-400";
      case "prompt":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  }

  // Format event type as readable text
  function formatEventType(type: string): string {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Draggable handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).getAttribute("data-drag-handle") === "true") {
      setIsDragging(true);
      dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y,
      });
    }
    if (isResizing) {
      const newWidth = resizeStartPos.current.width + (e.clientX - resizeStartPos.current.x);
      const newHeight = resizeStartPos.current.height + (e.clientY - resizeStartPos.current.y);
      setSize({
        width: Math.max(400, newWidth),
        height: Math.max(300, newHeight),
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Resizable handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    resizeStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };
    e.stopPropagation();
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const isBlocked = agentData?.activity === "blocked" || agentData?.status === "blocked";

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        data-draggable="true"
        data-resizable="true"
        className="bg-[var(--color-bg-surface)] rounded-lg shadow-xl flex flex-col"
        style={{
          width: `${size.width}px`,
          height: `${size.height}px`,
          transform: `translate(${position.x}px, ${position.y}px)`,
          position: "absolute",
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header with drag handle */}
        <div
          data-drag-handle="true"
          className="flex items-center justify-between p-4 border-b border-[var(--color-border-default)] cursor-move bg-[var(--color-bg-hover)] rounded-t-lg"
        >
          <h2 id="modal-title" className="text-lg font-semibold text-[var(--color-text-primary)]">
            Agent Session
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Agent Header */}
          <div className="space-y-2">
            {agentData ? (
              <>
                {agentData.issueLabel && (
                  <div className="text-sm font-mono text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-1 rounded inline-block">
                    {agentData.issueLabel}
                  </div>
                )}
                {agentData.issueTitle && (
                  <h3 className="text-base font-medium text-[var(--color-text-primary)]">
                    {agentData.issueTitle}
                  </h3>
                )}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-[var(--color-text-muted)]">Agent ID:</span>
                    <span className="ml-2 font-mono text-xs">{agentData.id}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Duration:</span>
                    <span className="ml-2">{calculateDuration(agentData.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Status:</span>
                    <span className={`ml-2 ${isBlocked ? "text-red-400" : ""}`}>
                      {agentData.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Last Activity:</span>
                    <span className="ml-2">{formatTimeAgo(agentData.lastActivityAt)}</span>
                  </div>
                </div>
                {isBlocked && agentData.blockReason && (
                  <div className="text-sm text-red-400 mt-2">⚠️ {agentData.blockReason}</div>
                )}
              </>
            ) : (
              <div className="text-sm text-[var(--color-text-muted)]">Loading agent data...</div>
            )}
            {error && (
              <div className="text-sm text-red-400 mt-2" role="alert">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          {activityData && activityData.events.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Activity Timeline
              </h4>
              <div className="space-y-1 text-xs max-h-40 overflow-y-auto">
                {activityData.events.map((event) => (
                  <div key={`${event.timestamp}-${event.type}`} className="flex items-start gap-2">
                    <span className="text-[var(--color-text-muted)] whitespace-nowrap">
                      {formatTimeAgo(event.timestamp)}
                    </span>
                    <span className={getEventColor(event.type)}>
                      [{formatEventType(event.type)}]
                    </span>
                    <span className="text-[var(--color-text-secondary)]">{event.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Log Viewer */}
          {showLogs && (
            <div className="flex-1 flex flex-col min-h-0">
              <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Agent Logs
              </h4>
              {isLoadingLogs ? (
                <div className="flex-1 bg-[var(--color-bg-hover)] rounded p-2 flex items-center justify-center">
                  <div className="text-sm text-[var(--color-text-muted)]">Loading logs...</div>
                </div>
              ) : logsData ? (
                <div className="flex-1 bg-[var(--color-bg-hover)] rounded p-2 overflow-y-auto font-mono text-xs">
                  {logsData.logs.map((log, idx) => (
                    <div key={`${log}-${idx}`} className="whitespace-pre-wrap">
                      {/* Simple syntax highlighting */}
                      {log.includes("[ERROR]") && <span className="text-red-400">{log}</span>}
                      {log.includes("[WARN]") && !log.includes("[ERROR]") && (
                        <span className="text-yellow-400">{log}</span>
                      )}
                      {log.includes("[INFO]") &&
                        !log.includes("[ERROR]") &&
                        !log.includes("[WARN]") && <span className="text-blue-400">{log}</span>}
                      {log.includes("[DEBUG]") &&
                        !log.includes("[ERROR]") &&
                        !log.includes("[WARN]") &&
                        !log.includes("[INFO]") && <span className="text-gray-400">{log}</span>}
                      {!log.includes("[ERROR]") &&
                        !log.includes("[WARN]") &&
                        !log.includes("[INFO]") &&
                        !log.includes("[DEBUG]") && (
                          <span className="text-[var(--color-text-secondary)]">{log}</span>
                        )}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              ) : (
                <div className="flex-1 bg-[var(--color-bg-hover)] rounded p-2 flex items-center justify-center">
                  <div className="text-sm text-[var(--color-text-muted)]">No logs available</div>
                </div>
              )}
            </div>
          )}

          {/* Attach Command */}
          {showAttach && (
            <div>
              <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Attach to Session
              </h4>
              <div className="bg-[var(--color-bg-hover)] rounded p-3">
                <code className="text-xs block mb-2">{`tmux attach-session -t ${agentId}`}</code>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(`tmux attach-session -t ${agentId}`)}
                    className="px-3 py-1 text-xs bg-[var(--color-accent)] text-[var(--color-accent-foreground)] rounded hover:opacity-90"
                  >
                    {copyFeedback ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={() => {
                      // Open terminal and execute attach command
                      const command = `tmux attach-session -t ${agentId}`;
                      // For now, just copy to clipboard and show a message
                      copyToClipboard(command);
                      alert(
                        `Command copied to clipboard! Paste it in your terminal to attach.\n\n${command}`,
                      );
                    }}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Execute
                  </button>
                  <button
                    onClick={() => setShowAttach(false)}
                    className="px-3 py-1 text-xs border border-[var(--color-border-default)] rounded hover:bg-[var(--color-bg-hover)]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-[var(--color-border-default)]">
          <div className="flex gap-2">
            <button
              onClick={handleViewLogs}
              className="px-3 py-2 text-sm bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] rounded hover:bg-[var(--color-bg-surface)]"
            >
              {showLogs ? "Hide Logs" : "View Logs"}
            </button>
            <button
              onClick={() => setShowAttach(!showAttach)}
              className="px-3 py-2 text-sm bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] rounded hover:bg-[var(--color-bg-surface)]"
            >
              Attach
            </button>
            {showLogs && (
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className="px-3 py-2 text-sm bg-[var(--color-bg-hover)] border border-[var(--color-border-default)] rounded hover:bg-[var(--color-bg-surface)]"
                aria-label="Toggle auto-scroll"
              >
                {autoScroll ? "Auto-scroll: On" : "Auto-scroll: Off"}
              </button>
            )}
          </div>
          {isBlocked && (
            <button
              onClick={async () => {
                try {
                  const response = await fetch(`/api/agent/${agentId}/resume`, {
                    method: "POST",
                  });
                  if (response.ok) {
                    alert("Resume command sent successfully!");
                    fetchAgentData();
                  } else {
                    alert("Failed to resume agent");
                  }
                } catch {
                  alert("Failed to resume agent");
                }
              }}
              className="px-4 py-2 text-sm bg-[var(--color-accent)] text-[var(--color-accent-foreground)] rounded hover:opacity-90"
            >
              Resume
            </button>
          )}
        </div>

        {/* Resize Handle */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-[var(--color-border-default)] rounded-br-lg"
          onMouseDown={handleResizeStart}
          aria-label="Resize modal"
          role="separator"
        />
      </div>
    </div>
  );
}
