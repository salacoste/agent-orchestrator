/**
 * Autopilot Engine — Supervised workflow advancement (Story 43.1).
 *
 * Listens for story completions and automatically advances the sprint
 * by finding the next backlog story and enqueuing a spawn via SpawnQueue.
 *
 * Three modes:
 * - off: no auto-spawning (default)
 * - supervised: notify + wait for approval (5-min timeout → queue, NOT auto-approve)
 * - autonomous: auto-spawn, notify after the fact
 */
import { readFileSync } from "node:fs";
import { parse as yamlParse } from "yaml";
import type { SpawnQueue } from "./spawn-queue.js";
import type { SessionSpawnConfig } from "./types.js";

export type AutopilotMode = "off" | "supervised" | "autonomous";

/** Autopilot action log entry. */
export interface AutopilotAction {
  timestamp: string;
  action:
    | "spawn-enqueued"
    | "notification-sent"
    | "no-next-story"
    | "mode-changed"
    | "timeout-queued";
  storyId?: string;
  detail: string;
}

/** Autopilot state for API responses. */
export interface AutopilotState {
  mode: AutopilotMode;
  paused: boolean;
  recentActions: AutopilotAction[];
}

/** Notify callback for supervised mode. */
export type AutopilotNotifyFn = (message: string, storyId: string) => void;

export interface AutopilotConfig {
  mode: AutopilotMode;
  sprintStatusPath: string;
  spawnQueue: SpawnQueue;
  notify?: AutopilotNotifyFn;
  /** Supervised mode timeout in ms (default: 300000 = 5 min). */
  supervisedTimeoutMs?: number;
  /** Project ID for spawning. */
  projectId: string;
}

export interface Autopilot {
  /** Handle a story completion event. */
  onStoryCompleted(storyId: string): Promise<void>;
  /** Get current autopilot state. */
  getState(): AutopilotState;
  /** Change autopilot mode. */
  setMode(mode: AutopilotMode): void;
  /** Approve a supervised spawn (called by user action). */
  approveSpawn(storyId: string): Promise<void>;
  /** Stop autopilot (cleanup timers). */
  stop(): void;
}

const MAX_ACTIONS = 20;

/**
 * Create an autopilot engine.
 */
export function createAutopilot(config: AutopilotConfig): Autopilot {
  let mode: AutopilotMode = config.mode;
  let paused = false;
  const actions: AutopilotAction[] = [];
  const pendingApprovals = new Map<string, ReturnType<typeof setTimeout>>();
  const timeoutMs = config.supervisedTimeoutMs ?? 300_000;

  function log(action: AutopilotAction): void {
    actions.unshift(action);
    if (actions.length > MAX_ACTIONS) actions.pop();
  }

  function findNextBacklogStory(): string | null {
    try {
      const content = readFileSync(config.sprintStatusPath, "utf-8");
      const parsed = yamlParse(content) as Record<string, unknown>;
      const devStatus = parsed.development_status as Record<string, string> | undefined;
      if (!devStatus) return null;

      for (const [key, status] of Object.entries(devStatus)) {
        if (status === "backlog" && /^\d+[-a]?-\d*-/.test(key) && !key.startsWith("epic-")) {
          return key;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  function buildSpawnConfig(storyId: string): SessionSpawnConfig {
    return {
      projectId: config.projectId,
      issueId: storyId,
    } as SessionSpawnConfig;
  }

  async function enqueueSpawn(storyId: string): Promise<void> {
    try {
      await config.spawnQueue.enqueue(buildSpawnConfig(storyId));
      log({
        timestamp: new Date().toISOString(),
        action: "spawn-enqueued",
        storyId,
        detail: `Auto-spawned agent for story ${storyId}`,
      });
    } catch (err) {
      log({
        timestamp: new Date().toISOString(),
        action: "spawn-enqueued",
        storyId,
        detail: `Spawn failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return {
    async onStoryCompleted(completedStoryId: string): Promise<void> {
      if (mode === "off") return;
      if (paused) return;

      const nextStory = findNextBacklogStory();
      if (!nextStory) {
        paused = true;
        log({
          timestamp: new Date().toISOString(),
          action: "no-next-story",
          detail: `No backlog stories remaining after ${completedStoryId}. Autopilot paused.`,
        });
        config.notify?.(
          `Autopilot paused: no next story after ${completedStoryId}`,
          completedStoryId,
        );
        return;
      }

      if (mode === "autonomous") {
        await enqueueSpawn(nextStory);
        config.notify?.(`Autopilot spawned agent for story ${nextStory}`, nextStory);
      } else if (mode === "supervised") {
        config.notify?.(
          `Autopilot wants to spawn agent for story ${nextStory}. Approve?`,
          nextStory,
        );
        log({
          timestamp: new Date().toISOString(),
          action: "notification-sent",
          storyId: nextStory,
          detail: `Awaiting approval to spawn for ${nextStory} (${timeoutMs / 1000}s timeout)`,
        });

        // Set timeout — on expiry, queue (not auto-approve)
        const timer = setTimeout(() => {
          pendingApprovals.delete(nextStory);
          void enqueueSpawn(nextStory);
          log({
            timestamp: new Date().toISOString(),
            action: "timeout-queued",
            storyId: nextStory,
            detail: `Supervised timeout — queued spawn for ${nextStory}`,
          });
        }, timeoutMs);
        pendingApprovals.set(nextStory, timer);
      }
    },

    getState(): AutopilotState {
      return {
        mode,
        paused,
        recentActions: [...actions],
      };
    },

    setMode(newMode: AutopilotMode): void {
      mode = newMode;
      if (newMode !== "off") paused = false;
      log({
        timestamp: new Date().toISOString(),
        action: "mode-changed",
        detail: `Autopilot mode changed to ${newMode}`,
      });
    },

    async approveSpawn(storyId: string): Promise<void> {
      const timer = pendingApprovals.get(storyId);
      if (timer) {
        clearTimeout(timer);
        pendingApprovals.delete(storyId);
      }
      await enqueueSpawn(storyId);
    },

    stop(): void {
      for (const timer of pendingApprovals.values()) {
        clearTimeout(timer);
      }
      pendingApprovals.clear();
    },
  };
}
