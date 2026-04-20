/**
 * Blocked Agent Detector — monitors agent sessions for inactivity and marks them as blocked
 *
 * Provides:
 * - Activity tracking per agent (last activity timestamp)
 * - Configurable inactivity timeout (default: 30 minutes)
 * - Agent-type specific timeouts (claude-code: 10m, codex: 5m, aider: 15m)
 * - Execution-mode aware timeouts (persistent: 3x, lightweight: 0.5x)
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
  AgentMapping,
} from "./types.js";
import { resolveSessionTimeout, MIN_TIMEOUT, MAX_TIMEOUT } from "./session-timeout.js";

/** Clamp timeout to valid range [MIN_TIMEOUT, MAX_TIMEOUT]. */
function clampTimeout(value: number): number {
  return Math.max(MIN_TIMEOUT, Math.min(MAX_TIMEOUT, value));
}

/** Default check interval (60 seconds) */
const DEFAULT_CHECK_INTERVAL = 60_000;

/** Default timeout (30 minutes) — used for unknown/new agent types */
const DEFAULT_TIMEOUT = 30 * 60 * 1000;

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
  private executionModeTimeouts: Partial<Record<"standard" | "persistent" | "lightweight", number>>;
  private persistentMaxExtensions: number;

  // Track agent state
  private agentStatus = new Map<string, BlockedAgentStatus>();

  // Detection timer
  private detectionTimer?: ReturnType<typeof setInterval>;

  /** How many check cycles between execution-mode refreshes (5 × 60s = 5 minutes). */
  private static readonly EXECUTION_MODE_REFRESH_INTERVAL = 5;
  private checkCycle = 0;

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
    this.executionModeTimeouts = deps.config?.executionModeTimeouts ?? {};
    this.persistentMaxExtensions = deps.config?.persistentMaxExtensions ?? 3;
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
    this.checkCycle++;

    // Determine whether this cycle should refresh cached execution modes
    const shouldRefresh =
      this.checkCycle % BlockedAgentDetectorImpl.EXECUTION_MODE_REFRESH_INTERVAL === 1;

    for (const [agentId, status] of this.agentStatus.entries()) {
      // Skip paused agents
      if (status.isPaused) {
        status.severity = "none";
        continue;
      }

      // Refresh cached execution mode periodically to avoid N+1 lookups (Story 59-7)
      if (shouldRefresh) {
        try {
          const session = await this.sessionManager.get(agentId);
          const mode = session?.metadata?.["ao:executionMode"];
          if (mode === "standard" || mode === "persistent" || mode === "lightweight") {
            status.executionMode = mode;
          } else {
            status.executionMode = undefined;
          }
        } catch {
          // Execution mode lookup failure must not crash detection — keep cached value
        }
      }

      const inactiveMs = now - status.lastActivity.getTime();
      const timeout = this.getTimeoutForAgent(
        agentId,
        status.executionMode,
        status.persistentExtensions,
      );

      // Compute severity tiers (Story 19.1): amber at 1x, red at 2x threshold
      if (inactiveMs > timeout * 2) {
        status.severity = "red";
      } else if (inactiveMs > timeout) {
        status.severity = "amber";
      } else {
        status.severity = "none";
      }

      // Skip already blocked agents for event publishing
      if (status.isBlocked) continue;

      if (inactiveMs > timeout) {
        // Persistent extension mechanism (Story 61-5) — grant timeout extension
        // instead of blocking, up to persistentMaxExtensions times
        if (status.executionMode === "persistent") {
          const currentExtensions = status.persistentExtensions ?? 0;
          if (currentExtensions < this.persistentMaxExtensions) {
            status.persistentExtensions = currentExtensions + 1;
            // Recompute severity with new extended timeout
            const extendedTimeout = this.getTimeoutForAgent(
              agentId,
              status.executionMode,
              status.persistentExtensions,
            );
            status.severity = inactiveMs > extendedTimeout * 2 ? "red" : "amber";
            continue;
          }
        }
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
        // eslint-disable-next-line no-console -- Background interval has no logger; stderr is the only output channel
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

  private getTimeoutForAgent(
    agentId: string,
    executionMode?: AgentMapping["executionMode"],
    persistentExtensions?: number,
  ): number {
    // Get agent-type base timeout
    const agentType = this.extractAgentType(agentId);
    const baseTimeout =
      agentType === "unknown"
        ? this.defaultTimeout
        : (this.agentTypeTimeouts[agentType] ?? this.defaultTimeout);

    // Apply execution mode multiplier if available
    if (executionMode) {
      const modeTimeout = resolveSessionTimeout(baseTimeout, executionMode, {
        executionModeTimeouts: this.executionModeTimeouts,
      });

      // Persistent extension multiplier (Story 61-5): each extension adds another
      // full mode-timeout window, so timeout = modeTimeout × (1 + extensions)
      if (executionMode === "persistent" && persistentExtensions && persistentExtensions > 0) {
        const extensionMultiplier = 1 + persistentExtensions;
        return clampTimeout(Math.round(modeTimeout * extensionMultiplier));
      }

      return modeTimeout;
    }

    return baseTimeout;
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
      // eslint-disable-next-line no-console -- No logger available; stderr is the only output channel for event publish failures
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
      // eslint-disable-next-line no-console -- No logger available; stderr is the only output channel for event publish failures
      console.error(`[BlockedAgentDetector] Failed to publish agent.resumed event:`, error);
    }
  }
}
