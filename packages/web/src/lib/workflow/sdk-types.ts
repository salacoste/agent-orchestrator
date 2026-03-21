/**
 * SDK public API types (Stories 28.1 + 28.2).
 *
 * Defines the public interface for @composio/ao-sdk.
 * External tools and integrations build against these types.
 */

// ---------------------------------------------------------------------------
// Story 28.1: SDK Public API Surface
// ---------------------------------------------------------------------------

/** SDK configuration. */
export interface OrchestratorSDKConfig {
  /** Base URL of the orchestrator API (e.g., "http://localhost:5000"). */
  baseUrl: string;
  /** Optional API key for authentication. */
  apiKey?: string;
  /** Request timeout in milliseconds (default: 30000). */
  timeoutMs?: number;
}

/** SDK event types for subscriptions. */
export type SDKEventType =
  | "story.completed"
  | "story.blocked"
  | "story.started"
  | "agent.blocked"
  | "agent.resumed"
  | "workflow.phase"
  | "workflow.artifact";

/** SDK event handler. */
export type SDKEventHandler = (event: SDKEvent) => void;

/** A generic SDK event. */
export interface SDKEvent {
  type: SDKEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

/** Spawn configuration for creating agent sessions. */
export interface SDKSpawnConfig {
  storyId: string;
  agentProfile?: string;
  prompt?: string;
}

/** Recommendation from the orchestrator. */
export interface SDKRecommendation {
  phase: string;
  observation: string;
  implication: string;
  reasoning?: string;
}

// ---------------------------------------------------------------------------
// Story 28.2: SDK Client Interface
// ---------------------------------------------------------------------------

/** The public SDK client interface. */
export interface AgentOrchestratorSDK {
  /** Spawn a new agent session for a story. */
  spawn(config: SDKSpawnConfig): Promise<{ sessionId: string }>;

  /** Kill an agent session. */
  kill(sessionId: string): Promise<void>;

  /** Get current recommendation for a project. */
  recommend(projectId: string): Promise<SDKRecommendation | null>;

  /** Subscribe to orchestrator events. */
  onEvent(eventType: SDKEventType, handler: SDKEventHandler): () => void;

  /** Get all active sessions. */
  listSessions(): Promise<Array<{ id: string; status: string; storyId?: string }>>;

  /** Disconnect from the orchestrator. */
  disconnect(): void;
}

// ---------------------------------------------------------------------------
// Story 28.3: Headless daemon configuration
// ---------------------------------------------------------------------------

/** Configuration for headless daemon mode. */
export interface HeadlessDaemonConfig {
  /** Port for the API server (no web UI). */
  port: number;
  /** Whether to enable SSE event stream. */
  enableSSE: boolean;
  /** Whether to run periodic health checks. */
  healthChecks: boolean;
  /** Log level. */
  logLevel: "debug" | "info" | "warn" | "error";
}

/**
 * Create an SDK client instance (Story 28.2).
 *
 * Stub implementation — actual HTTP/SSE client requires fetch integration.
 * This defines the contract for external consumers.
 */
export function createOrchestratorSDK(config: OrchestratorSDKConfig): AgentOrchestratorSDK {
  const baseUrl = config.baseUrl.replace(/\/$/, "");

  return {
    async spawn(spawnConfig) {
      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spawnConfig),
      });
      return res.json();
    },

    async kill(sessionId) {
      await fetch(`${baseUrl}/api/agent/${sessionId}/reassign`, { method: "POST" });
    },

    async recommend(projectId) {
      const res = await fetch(`${baseUrl}/api/workflow/${projectId}`);
      const data = await res.json();
      return data.recommendation ?? null;
    },

    onEvent(_eventType, _handler) {
      // SSE subscription — stub, requires EventSource integration
      return () => {};
    },

    async listSessions() {
      const res = await fetch(`${baseUrl}/api/sessions`);
      const data = await res.json();
      return data.sessions ?? [];
    },

    disconnect() {
      // Cleanup SSE connections
    },
  };
}
