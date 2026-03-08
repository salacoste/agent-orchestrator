/**
 * Blocked Agent Detector — monitors agent sessions for inactivity and marks them as blocked
 *
 * Provides:
 * - Activity tracking per agent (last activity timestamp)
 * - Configurable inactivity timeout (default: 10 minutes)
 * - Agent-type specific timeouts (claude-code: 10m, codex: 5m, aider: 15m)
 * - Automatic blocked detection with periodic checks
 * - Pause functionality to suppress blocked detection for intentional pauses
 * - Event publishing for agent.blocked and agent.resumed
 * - Notification integration via NotificationService
 */

import type {
  EventBus,
  AgentRegistry,
  SessionManager,
  BlockedAgentDetector,
  BlockedAgentDetectorConfig,
  BlockedAgentStatus,
} from "./types.js";

/** Default check interval (60 seconds) */
const DEFAULT_CHECK_INTERVAL = 60_000;

/** Default timeout (10 minutes) */
const DEFAULT_TIMEOUT = 10 * 60 * 1000;

/** Minimum timeout (1 minute) */
const MIN_TIMEOUT = 1 * 60 * 1000;

/** Maximum timeout (60 minutes) */
const MAX_TIMEOUT = 60 * 60 * 1000;

/** Agent-type specific defaults (milliseconds) */
const AGENT_TYPE_DEFAULTS: Record<string, number> = {
  "claude-code": 10 * 60 * 1000, // 10 minutes
  codex: 5 * 60 * 1000, // 5 minutes
  aider: 15 * 60 * 1000, // 15 minutes
};

export interface BlockedAgentDetectorDeps {
  eventBus: EventBus;
  registry: AgentRegistry;
  sessionManager: SessionManager;
  config?: Partial<BlockedAgentDetectorConfig>;
}

/**
 * Create blocked agent detector with configuration validation
 */
export function createBlockedAgentDetector(deps: BlockedAgentDetectorDeps): BlockedAgentDetector {
  // Validate timeout range
  const defaultTimeout = deps.config?.defaultTimeout ?? DEFAULT_TIMEOUT;
  if (defaultTimeout < MIN_TIMEOUT || defaultTimeout > MAX_TIMEOUT) {
    throw new Error(
      `defaultTimeout must be between ${MIN_TIMEOUT / 60000} and ${MAX_TIMEOUT / 60000} minutes`,
    );
  }

  return new BlockedAgentDetectorImpl(deps);
}

/**
 * Implementation of blocked agent detector
 */
class BlockedAgentDetectorImpl implements BlockedAgentDetector {
  private eventBus: EventBus;
  private registry: AgentRegistry;
  private sessionManager: SessionManager;
  private checkInterval: number;
  private defaultTimeout: number;
  private agentTypeTimeouts: Record<string, number>;

  // Track agent state
  private agentStatus = new Map<string, BlockedAgentStatus>();

  // Detection timer
  private detectionTimer?: ReturnType<typeof setInterval>;

  constructor(deps: BlockedAgentDetectorDeps) {
    this.eventBus = deps.eventBus;
    this.registry = deps.registry;
    this.sessionManager = deps.sessionManager;
    this.checkInterval = deps.config?.checkInterval ?? DEFAULT_CHECK_INTERVAL;
    this.defaultTimeout = deps.config?.defaultTimeout ?? DEFAULT_TIMEOUT;
    this.agentTypeTimeouts = {
      ...AGENT_TYPE_DEFAULTS,
      ...(deps.config?.agentTypeTimeouts ?? {}),
    };
  }

  async trackActivity(agentId: string): Promise<void> {
    const now = new Date();

    // Initialize status if not exists
    if (!this.agentStatus.has(agentId)) {
      this.agentStatus.set(agentId, {
        agentId,
        lastActivity: now,
        isBlocked: false,
        isPaused: false,
      });
      return;
    }

    const status = this.agentStatus.get(agentId);
    if (!status) return;

    // Auto-resume if was blocked or paused
    if (status.isBlocked && !status.isPaused) {
      await this.unblockAgent(agentId);
    }
    // Clear paused state on new activity
    if (status.isPaused) {
      status.isPaused = false;
    }

    // Update last activity
    status.lastActivity = now;
  }

  async checkBlocked(): Promise<void> {
    const now = Date.now();

    for (const [agentId, status] of this.agentStatus.entries()) {
      // Skip paused agents
      if (status.isPaused) continue;

      // Skip already blocked agents
      if (status.isBlocked) continue;

      const inactiveMs = now - status.lastActivity.getTime();
      const timeout = this.getTimeoutForAgent(agentId);

      if (inactiveMs > timeout) {
        await this.blockAgent(agentId, inactiveMs);
      }
    }
  }

  pause(agentId: string): void {
    const status = this.agentStatus.get(agentId);
    if (status) {
      status.isPaused = true;
    }
  }

  resume(agentId: string): void {
    const status = this.agentStatus.get(agentId);
    if (status) {
      status.isPaused = false;
    }
  }

  getAgentStatus(agentId: string): BlockedAgentStatus | null {
    return this.agentStatus.get(agentId) ?? null;
  }

  startDetection(): void {
    if (this.detectionTimer) {
      return; // Already started
    }

    this.detectionTimer = setInterval(() => {
      void this.checkBlocked().catch((error) => {
        console.error("[BlockedAgentDetector] Error checking blocked agents:", error);
      });
    }, this.checkInterval);
  }

  async stopDetection(): Promise<void> {
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = undefined;
    }
  }

  async close(): Promise<void> {
    await this.stopDetection();
    this.agentStatus.clear();
  }

  private getTimeoutForAgent(agentId: string): number {
    // Extract agent type from agent ID
    const agentType = this.extractAgentType(agentId);
    if (agentType === "unknown") {
      return this.defaultTimeout;
    }
    return this.agentTypeTimeouts[agentType] ?? this.defaultTimeout;
  }

  private extractAgentType(agentId: string): string {
    const id = agentId.toLowerCase();
    if (id.includes("claude") || id.includes("claude-code")) {
      return "claude-code";
    }
    if (id.includes("codex")) {
      return "codex";
    }
    if (id.includes("aider")) {
      return "aider";
    }
    return "unknown"; // No specific agent type detected
  }

  private async blockAgent(agentId: string, inactiveMs: number): Promise<void> {
    const status = this.agentStatus.get(agentId);
    if (!status) return;

    status.isBlocked = true;
    status.blockedAt = new Date();
    status.inactiveDuration = inactiveMs;

    // Publish agent.blocked event
    try {
      await this.eventBus.publish({
        eventType: "agent.blocked",
        metadata: {
          agentId,
          inactiveDuration: inactiveMs,
          inactiveMinutes: Math.round(inactiveMs / 60000),
        },
      });
    } catch (error) {
      // Log but don't throw - detection continues
      console.error(`[BlockedAgentDetector] Failed to publish agent.blocked event:`, error);
    }
  }

  private async unblockAgent(agentId: string): Promise<void> {
    const status = this.agentStatus.get(agentId);
    if (!status) return;

    status.isBlocked = false;
    status.blockedAt = undefined;
    status.inactiveDuration = undefined;

    // Publish agent.resumed event
    try {
      await this.eventBus.publish({
        eventType: "agent.resumed",
        metadata: {
          agentId,
        },
      });
    } catch (error) {
      // Log but don't throw
      console.error(`[BlockedAgentDetector] Failed to publish agent.resumed event:`, error);
    }
  }
}
