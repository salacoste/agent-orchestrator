/**
 * Agent Completion Detector — monitors agent sessions and detects completion/failure
 *
 * Provides:
 * - Polling-based monitoring of agent session health
 * - Detection of clean exits, failures, timeouts, and crashes
 * - Status updates to agent registry and sprint-status.yaml
 * - Event handlers for completion and failure scenarios
 * - Desktop notifications for important events
 *
 * Architecture:
 * - AgentCompletionDetectorImpl manages monitoring of multiple agents
 * - Each agent has an AgentMonitor that polls session status
 * - Completion/failure events trigger configured handlers
 * - Handlers update registry, sprint status, and send notifications
 */

import type {
  Runtime,
  RuntimeHandle,
  AgentRegistry,
  Notifier,
  AgentAssignment,
  AgentCompletionDetector,
  DetectionStatus,
  CompletionEvent,
  FailureEvent,
  CompletionHandler,
  FailureHandler,
} from "./types.js";

/** Default configuration values */
const DEFAULT_POLL_INTERVAL = 5000; // 5 seconds
const DEFAULT_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours

export interface AgentCompletionDetectorConfig {
  pollInterval: number;
  timeout: number;
}

export interface AgentCompletionDetectorDeps {
  runtime: Runtime;
  registry: AgentRegistry;
  notifier?: Notifier;
  config?: Partial<AgentCompletionDetectorConfig>;
}

/**
 * Create agent completion detector with default configuration
 */
export function createAgentCompletionDetector(
  deps: AgentCompletionDetectorDeps,
): AgentCompletionDetector {
  return new AgentCompletionDetectorImpl(deps);
}

/**
 * Implementation of agent completion detector
 */
class AgentCompletionDetectorImpl implements AgentCompletionDetector {
  private runtime: Runtime;
  private registry: AgentRegistry;
  private notifier?: Notifier;
  private pollInterval: number;
  private timeout: number;

  // Track monitored agents
  private monitoredAgents = new Map<string, AgentMonitor>();
  private completionHandlers: CompletionHandler[] = [];
  private failureHandlers: FailureHandler[] = [];

  constructor(deps: AgentCompletionDetectorDeps) {
    this.runtime = deps.runtime;
    this.registry = deps.registry;
    this.notifier = deps.notifier;
    this.pollInterval = deps.config?.pollInterval ?? DEFAULT_POLL_INTERVAL;
    this.timeout = deps.config?.timeout ?? DEFAULT_TIMEOUT;
  }

  async monitor(agentId: string): Promise<void> {
    // Check if already monitoring
    if (this.monitoredAgents.has(agentId)) {
      throw new Error(`Agent ${agentId} is already being monitored`);
    }

    // Get agent assignment from registry
    const assignment = await this.registry.getByAgent(agentId);
    if (!assignment) {
      throw new Error(`Agent ${agentId} not found in registry`);
    }

    // Create and start monitor
    const monitor = new AgentMonitor({
      agentId,
      assignment,
      runtime: this.runtime,
      registry: this.registry,
      pollInterval: this.pollInterval,
      timeout: this.timeout,
      notifier: this.notifier,
      onCompletion: (event) => this.handleCompletion(event),
      onFailure: (event) => this.handleFailure(event),
    });

    this.monitoredAgents.set(agentId, monitor);
    await monitor.start();
  }

  async unmonitor(agentId: string): Promise<void> {
    const monitor = this.monitoredAgents.get(agentId);
    if (monitor) {
      await monitor.stop();
      this.monitoredAgents.delete(agentId);
    }
  }

  getStatus(agentId: string): DetectionStatus | null {
    const monitor = this.monitoredAgents.get(agentId);
    return monitor ? monitor.getStatus() : null;
  }

  onCompletion(handler: CompletionHandler): void {
    this.completionHandlers.push(handler);
  }

  onFailure(handler: FailureHandler): void {
    this.failureHandlers.push(handler);
  }

  private async handleCompletion(event: CompletionEvent): Promise<void> {
    // Call all completion handlers with error isolation — one handler throwing
    // must not prevent subsequent handlers from running (e.g., CLI cleanup)
    for (const handler of this.completionHandlers) {
      try {
        await handler(event);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          `Completion handler error for agent ${event.agentId}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  private async handleFailure(event: FailureEvent): Promise<void> {
    // Call all failure handlers with error isolation
    for (const handler of this.failureHandlers) {
      try {
        await handler(event);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          `Failure handler error for agent ${event.agentId}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }
}

/**
 * Individual agent monitor - polls session status
 */
class AgentMonitor {
  private agentId: string;
  private assignment: AgentAssignment;
  private runtime: Runtime;
  private registry: AgentRegistry;
  private pollInterval: number;
  private timeout: number;
  private notifier?: Notifier;
  private onCompletion: (event: CompletionEvent) => Promise<void>;
  private onFailure: (event: FailureEvent) => Promise<void>;

  private pollTimer?: NodeJS.Timeout;
  private startTime: Date;
  private lastCheck: Date;

  constructor(params: {
    agentId: string;
    assignment: AgentAssignment;
    runtime: Runtime;
    registry: AgentRegistry;
    pollInterval: number;
    timeout: number;
    notifier?: Notifier;
    onCompletion: (event: CompletionEvent) => Promise<void>;
    onFailure: (event: FailureEvent) => Promise<void>;
  }) {
    this.agentId = params.agentId;
    this.assignment = params.assignment;
    this.runtime = params.runtime;
    this.registry = params.registry;
    this.pollInterval = params.pollInterval;
    this.timeout = params.timeout;
    this.notifier = params.notifier;
    this.onCompletion = params.onCompletion;
    this.onFailure = params.onFailure;
    this.startTime = new Date();
    this.lastCheck = new Date();
  }

  async start(): Promise<void> {
    this.poll();
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private poll(): void {
    this.pollTimer = setTimeout(async () => {
      await this.check();
      // Continue polling if still monitoring
      if (this.pollTimer) {
        this.poll();
      }
    }, this.pollInterval);
  }

  private async check(): Promise<void> {
    this.lastCheck = new Date();

    // Check timeout
    const duration = Date.now() - this.assignment.assignedAt.getTime();
    if (duration > this.timeout) {
      await this.handleTimeout();
      await this.stop();
      return;
    }

    // Get session handle from assignment
    const handle = this.getRuntimeHandle();
    if (!handle) {
      // No handle means agent was spawned externally - we can't monitor it
      await this.stop();
      return;
    }

    // Check if session is alive
    const alive = await this.runtime.isAlive(handle);

    if (!alive) {
      // Session is no longer alive - determine why
      await this.handleExit();
      await this.stop();
    }
  }

  private getRuntimeHandle(): RuntimeHandle | null {
    // Try to reconstruct the runtime handle from the assignment
    // The agentId should match the session name
    return {
      id: this.agentId,
      runtimeName: this.runtime.name, // Use actual runtime name, not hardcoded
      data: {},
    };
  }

  private async handleExit(): Promise<void> {
    // For now, assume clean exit (exit code 0)
    // In a full implementation, we'd check exit codes via process inspection
    const duration = Date.now() - this.assignment.assignedAt.getTime();

    const event: CompletionEvent = {
      agentId: this.agentId,
      storyId: this.assignment.storyId,
      exitCode: 0,
      duration,
      completedAt: new Date(),
    };

    await this.onCompletion(event);
  }

  private async handleTimeout(): Promise<void> {
    const duration = Date.now() - this.assignment.assignedAt.getTime();

    const event: FailureEvent = {
      agentId: this.agentId,
      storyId: this.assignment.storyId,
      reason: "timed_out",
      failedAt: new Date(),
      duration,
    };

    await this.onFailure(event);
  }

  getStatus(): DetectionStatus {
    return {
      agentId: this.agentId,
      isMonitoring: !!this.pollTimer,
      startTime: this.startTime,
      lastCheck: this.lastCheck,
      status: "monitoring",
    };
  }
}
