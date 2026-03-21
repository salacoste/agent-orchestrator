/**
 * @composio/ao-sdk — TypeScript SDK for Agent Orchestrator
 *
 * Spawn agents, subscribe to events, get recommendations.
 *
 * @example
 * ```typescript
 * import { createOrchestrator } from "@composio/ao-sdk";
 *
 * const ao = createOrchestrator({ baseUrl: "http://localhost:5000" });
 * const { sessionId } = await ao.spawn({ storyId: "1-3-auth-module" });
 * ao.onEvent("story.completed", (event) => console.log("Done:", event));
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** SDK configuration. */
export interface OrchestratorConfig {
  /** Base URL of the orchestrator API (e.g., "http://localhost:5000"). */
  baseUrl: string;
  /** Optional API key for authentication. */
  apiKey?: string;
  /** Request timeout in milliseconds (default: 30000). */
  timeoutMs?: number;
}

/** SDK event types. */
export type EventType =
  | "story.completed"
  | "story.blocked"
  | "story.started"
  | "agent.blocked"
  | "agent.resumed"
  | "workflow.phase"
  | "workflow.artifact";

/** A generic SDK event. */
export interface OrchestratorEvent {
  type: EventType;
  timestamp: string;
  data: Record<string, unknown>;
}

/** Event handler function. */
export type EventHandler = (event: OrchestratorEvent) => void;

/** Spawn configuration. */
export interface SpawnConfig {
  storyId: string;
  agentProfile?: string;
  prompt?: string;
}

/** Recommendation from the orchestrator. */
export interface Recommendation {
  phase: string;
  observation: string;
  implication: string;
  reasoning?: string;
}

/** Session info. */
export interface SessionInfo {
  id: string;
  status: string;
  storyId?: string;
}

// ---------------------------------------------------------------------------
// Client Interface
// ---------------------------------------------------------------------------

/** The public SDK client. */
export interface AgentOrchestrator {
  /** Spawn a new agent session for a story. */
  spawn(config: SpawnConfig): Promise<{ sessionId: string }>;

  /** Kill an agent session. */
  kill(sessionId: string): Promise<void>;

  /** Get current recommendation for a project. */
  recommend(projectId: string): Promise<Recommendation | null>;

  /** Subscribe to orchestrator events. Returns unsubscribe function. */
  onEvent(eventType: EventType, handler: EventHandler): () => void;

  /** Get all active sessions. */
  listSessions(): Promise<SessionInfo[]>;

  /** Disconnect and clean up. */
  disconnect(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an Agent Orchestrator SDK client.
 *
 * @param config - Connection configuration
 * @returns SDK client with spawn, kill, recommend, and event subscription
 */
export function createOrchestrator(config: OrchestratorConfig): AgentOrchestrator {
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const timeout = config.timeoutMs ?? 30000;

  async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
          ...init?.headers,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async spawn(spawnConfig) {
      return fetchJSON<{ sessionId: string }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify(spawnConfig),
      });
    },

    async kill(sessionId) {
      await fetchJSON(`/api/agent/${sessionId}/reassign`, { method: "POST" });
    },

    async recommend(projectId) {
      const data = await fetchJSON<{ recommendation: Recommendation | null }>(
        `/api/workflow/${projectId}`,
      );
      return data.recommendation;
    },

    onEvent(_eventType, _handler) {
      // SSE subscription — full implementation requires EventSource
      // Stub: returns no-op unsubscribe
      return () => {};
    },

    async listSessions() {
      const data = await fetchJSON<{ sessions: SessionInfo[] }>("/api/sessions");
      return data.sessions ?? [];
    },

    disconnect() {
      // Clean up SSE connections when implemented
    },
  };
}
