/**
 * Agent Registry — tracks which agents are working on which stories.
 *
 * Provides:
 * - Fast in-memory lookups for agent assignment queries
 * - Persistent storage via session metadata
 * - Duplicate assignment detection
 * - Zombie detection for disconnected agents
 *
 * Architecture:
 * - In-memory Map<agentId, AgentAssignment> for fast queries (<100ms)
 * - Metadata storage for persistence across restarts
 * - SHA-256 hash for story context conflict detection
 */

import { createHash } from "node:crypto";
import { readMetadataRaw, updateMetadata, listMetadata, type SessionId } from "./metadata.js";
import type { AgentAssignment, AgentRegistry, AgentStatus, OrchestratorConfig } from "./types.js";

/**
 * Compute SHA-256 hash of story context for conflict detection.
 */
export function computeStoryContextHash(
  title: string,
  description: string,
  acceptanceCriteria: string,
): string {
  const content = `${title}|${description}|${acceptanceCriteria}`;
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Parse agent assignment from session metadata.
 */
function parseAgentAssignment(
  sessionId: SessionId,
  metadata: Record<string, string>,
): AgentAssignment | null {
  const storyId = metadata["storyId"];
  const assignedAt = metadata["assignedAt"];
  const status = metadata["agentStatus"] as AgentStatus | undefined;
  const contextHash = metadata["contextHash"];

  if (!storyId || !assignedAt) {
    return null;
  }

  return {
    agentId: sessionId,
    storyId,
    assignedAt: new Date(assignedAt),
    status: status ?? "active",
    contextHash: contextHash ?? "",
  };
}

/**
 * In-memory agent registry implementation.
 * Uses Map for O(1) lookups and persists to metadata files.
 */
export class InMemoryAgentRegistry implements AgentRegistry {
  private assignments: Map<string, AgentAssignment>;
  private dataDir: string;
  private config: OrchestratorConfig;

  constructor(dataDir: string, config: OrchestratorConfig) {
    this.assignments = new Map();
    this.dataDir = dataDir;
    this.config = config;
  }

  /**
   * Register an agent assignment.
   * Creates or updates the assignment in memory and persists to metadata.
   */
  register(assignment: AgentAssignment): void {
    // Update in-memory cache
    this.assignments.set(assignment.agentId, assignment);

    // Persist to metadata
    updateMetadata(this.dataDir, assignment.agentId as SessionId, {
      storyId: assignment.storyId,
      assignedAt: assignment.assignedAt.toISOString(),
      agentStatus: assignment.status,
      contextHash: assignment.contextHash,
    });
  }

  /**
   * Query by agent ID.
   * Returns null if agent not found.
   */
  getByAgent(agentId: string): AgentAssignment | null {
    return this.assignments.get(agentId) ?? null;
  }

  /**
   * Query by story ID.
   * Returns the most recent assignment for this story.
   */
  getByStory(storyId: string): AgentAssignment | null {
    for (const assignment of this.assignments.values()) {
      if (assignment.storyId === storyId) {
        return assignment;
      }
    }
    return null;
  }

  /**
   * Find active assignment for a story.
   * Used for duplicate detection.
   */
  findActiveByStory(storyId: string): AgentAssignment | null {
    for (const assignment of this.assignments.values()) {
      if (assignment.storyId === storyId && assignment.status === "active") {
        return assignment;
      }
    }
    return null;
  }

  /**
   * List all assignments.
   */
  list(): AgentAssignment[] {
    return Array.from(this.assignments.values());
  }

  /**
   * Remove an assignment.
   */
  remove(agentId: string): void {
    this.assignments.delete(agentId);
    // Clear story assignment fields from metadata
    updateMetadata(this.dataDir, agentId as SessionId, {
      storyId: "",
      assignedAt: "",
      agentStatus: "",
      contextHash: "",
    });
  }

  /**
   * Get zombie/disconnected agents.
   */
  getZombies(): AgentAssignment[] {
    return Array.from(this.assignments.values()).filter((a) => a.status === "disconnected");
  }

  /**
   * Reload from persistent storage.
   * Refreshes in-memory cache from disk metadata.
   */
  async reload(): Promise<void> {
    const sessionIds = listMetadata(this.dataDir);
    this.assignments.clear();

    for (const sessionId of sessionIds) {
      const raw = readMetadataRaw(this.dataDir, sessionId);
      if (!raw) continue;

      const assignment = parseAgentAssignment(sessionId, raw);
      if (assignment) {
        this.assignments.set(sessionId, assignment);
      }
    }
  }

  /**
   * Get retry count for a story.
   * Returns the number of times the story has been resumed.
   */
  getRetryCount(storyId: string): number {
    let count = 0;
    for (const assignment of this.assignments.values()) {
      if (assignment.storyId === storyId && assignment.agentId.includes("-retry-")) {
        const match = assignment.agentId.match(/-retry-(\d+)$/);
        if (match) {
          const retryNum = parseInt(match[1], 10);
          if (retryNum > count) {
            count = retryNum;
          }
        }
      }
    }
    return count;
  }

  /**
   * Increment retry count and track history.
   * Called when resuming a story with a new agent.
   */
  incrementRetry(storyId: string, newAgentId: string): void {
    // Store retry history in metadata
    const existingHistory = this.getRetryHistory(storyId);
    const attempts = (existingHistory?.attempts ?? 0) + 1;

    // Store retry history as a separate metadata entry
    // We use a special key format: retry-history-{storyId}
    const historyKey = `retry-history-${storyId}` as SessionId;
    const previousAgents = existingHistory?.previousAgents ?? [];
    updateMetadata(this.dataDir, historyKey, {
      storyId,
      attempts: attempts.toString(),
      lastRetryAt: new Date().toISOString(),
      previousAgents: JSON.stringify([...previousAgents, newAgentId]),
    });
  }

  /**
   * Get retry history for a story.
   */
  getRetryHistory(
    storyId: string,
  ): { attempts: number; lastRetryAt: Date; previousAgents: string[] } | null {
    // Try to load retry history metadata
    const historyKey = `retry-history-${storyId}` as SessionId;
    const raw = readMetadataRaw(this.dataDir, historyKey);
    if (!raw) {
      return null;
    }

    const attempts = parseInt(raw["attempts"] ?? "0", 10);
    const lastRetryAt = raw["lastRetryAt"] ? new Date(raw["lastRetryAt"]) : new Date();
    const previousAgents = raw["previousAgents"]
      ? JSON.parse(raw["previousAgents"])
      : [];

    return {
      attempts,
      lastRetryAt,
      previousAgents,
    };
  }

  /**
   * Update agent status.
   * Used by lifecycle manager to reflect agent state changes.
   */
  updateStatus(agentId: string, status: AgentStatus): void {
    const assignment = this.assignments.get(agentId);
    if (assignment) {
      assignment.status = status;
      this.register(assignment);
    }
  }
}

/**
 * Create or get the agent registry for a project.
 * Returns a cached instance for the data directory.
 */
const registries: Map<string, InMemoryAgentRegistry> = new Map();

export function getAgentRegistry(dataDir: string, config: OrchestratorConfig): AgentRegistry {
  let registry = registries.get(dataDir);
  if (!registry) {
    registry = new InMemoryAgentRegistry(dataDir, config);
    registries.set(dataDir, registry);
  }
  return registry;
}
