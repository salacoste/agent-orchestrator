/**
 * Event Bus Integration — connects triggers and workflows to the event bus
 *
 * Features:
 * - Subscribe to events and evaluate triggers
 * - Auto-execute workflows when triggers match
 * - Support for story and event-based triggers
 * - Integration with EventPublisher for publishing events
 *
 * Architecture:
 * - EventSubscription: Receives events from the event bus
 * - TriggerEvaluator: Evaluates conditions against events
 * - WorkflowEngine: Executes workflows when triggers fire
 */

import type { EventPublisher } from "./types.js";
import type {
  TriggerEvaluator,
  TriggerDefinition,
  TriggerResult,
  StoryAttributes,
  EventAttributes,
} from "./trigger-condition-evaluator.js";
import type {
  WorkflowEngine,
  WorkflowDefinition,
  WorkflowContext,
  ActionHandler,
} from "./workflow-engine.js";

/** Event types that the integration listens for */
export type IntegrationEventType =
  | "story.started"
  | "story.completed"
  | "story.blocked"
  | "story.assigned"
  | "agent.resumed"
  | "state.changed"
  | "conflict.detected"
  | "conflict.resolved"
  | "plugin.loaded"
  | "plugin.unloaded";

/** Event data structure for integration */
export interface IntegrationEvent {
  /** Event type */
  type: IntegrationEventType | string;

  /** Event timestamp */
  timestamp: string;

  /** Event payload */
  data: Record<string, unknown>;
}

/** Configuration for event bus integration */
export interface EventBusIntegrationConfig {
  /** Enable automatic trigger evaluation */
  enableAutoEvaluation?: boolean;

  /** Enable automatic workflow execution */
  enableAutoWorkflow?: boolean;

  /** Debounce time for rapid events (ms) */
  debounceMs?: number;

  /** Maximum concurrent workflow executions */
  maxConcurrentWorkflows?: number;

  /** Event types to subscribe to */
  subscribedEvents?: IntegrationEventType[];
}

/** Statistics for the integration */
export interface IntegrationStats {
  /** Total events processed */
  eventsProcessed: number;

  /** Total triggers evaluated */
  triggersEvaluated: number;

  /** Total triggers fired */
  triggersFired: number;

  /** Total workflows executed */
  workflowsExecuted: number;

  /** Active workflow executions */
  activeWorkflows: number;
}

/** Event bus integration interface */
export interface EventBusIntegration {
  /** Start listening to events */
  start(): Promise<void>;

  /** Stop listening to events */
  stop(): Promise<void>;

  /** Manually process an event */
  processEvent(event: IntegrationEvent): Promise<TriggerResult[]>;

  /** Register a trigger */
  registerTrigger(trigger: TriggerDefinition): void;

  /** Register multiple triggers */
  registerTriggers(triggers: TriggerDefinition[]): void;

  /** Register a workflow */
  registerWorkflow(workflow: WorkflowDefinition, actions: Record<string, ActionHandler>): void;

  /** Get integration statistics */
  getStats(): IntegrationStats;

  /** Check if integration is running */
  isRunning(): boolean;
}

/**
 * Create an event bus integration
 */
export function createEventBusIntegration(
  eventPublisher: EventPublisher,
  triggerEvaluator: TriggerEvaluator,
  workflowEngine: WorkflowEngine,
  config: EventBusIntegrationConfig = {},
): EventBusIntegration {
  const fullConfig: Required<EventBusIntegrationConfig> = {
    enableAutoEvaluation: true,
    enableAutoWorkflow: true,
    debounceMs: 100,
    maxConcurrentWorkflows: 5,
    subscribedEvents: [
      "story.started",
      "story.completed",
      "story.blocked",
      "story.assigned",
      "agent.resumed",
      "state.changed",
      "conflict.detected",
      "conflict.resolved",
    ],
    ...config,
  };

  let running = false;
  const stats: IntegrationStats = {
    eventsProcessed: 0,
    triggersEvaluated: 0,
    triggersFired: 0,
    workflowsExecuted: 0,
    activeWorkflows: 0,
  };

  const registeredWorkflows = new Map<
    string,
    { workflow: WorkflowDefinition; actions: Record<string, ActionHandler> }
  >();
  const registeredTriggers = new Map<string, TriggerDefinition>();
  let activeWorkflows = 0;
  let eventQueue: IntegrationEvent[] = [];
  let processingQueue = false;

  /**
   * Process a single event
   */
  async function processEvent(event: IntegrationEvent): Promise<TriggerResult[]> {
    stats.eventsProcessed++;
    const results: TriggerResult[] = [];

    // Convert to EventAttributes for trigger evaluation
    const eventAttrs: EventAttributes = {
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: event.type,
      timestamp: event.timestamp,
      data: event.data,
    };

    // Evaluate triggers
    for (const [name, trigger] of registeredTriggers) {
      stats.triggersEvaluated++;

      // Check if trigger has event condition
      if (trigger.condition && typeof trigger.condition === "object") {
        const condition = trigger.condition as { event?: { type?: string } };
        if (condition.event?.type && condition.event.type !== event.type) {
          continue; // Skip triggers that don't match this event type
        }
      }

      // Evaluate the trigger
      const triggerResults = triggerEvaluator.evaluateEvent(eventAttrs, name);

      if (triggerResults && "matches" in triggerResults && triggerResults.matches) {
        stats.triggersFired++;
        results.push(triggerResults);

        // Execute associated workflow if auto-workflow is enabled
        if (fullConfig.enableAutoWorkflow && typeof trigger.action === "string") {
          await executeWorkflowForTrigger(trigger.action, event);
        }
      }
    }

    return results;
  }

  /**
   * Execute a workflow triggered by an event
   */
  async function executeWorkflowForTrigger(
    workflowName: string,
    event: IntegrationEvent,
  ): Promise<void> {
    const entry = registeredWorkflows.get(workflowName);
    if (!entry) {
      return;
    }

    // Check concurrent limit
    if (activeWorkflows >= fullConfig.maxConcurrentWorkflows) {
      // Queue for later execution
      return;
    }

    activeWorkflows++;
    stats.activeWorkflows = activeWorkflows;

    try {
      const context: WorkflowContext = {
        logger: {
          // eslint-disable-next-line no-console
          info: (msg) => console.log(`[Workflow ${workflowName}] ${msg}`),
          // eslint-disable-next-line no-console
          error: (msg) => console.error(`[Workflow ${workflowName}] ${msg}`),
          // eslint-disable-next-line no-console
          warn: (msg) => console.warn(`[Workflow ${workflowName}] ${msg}`),
        },
        state: {
          get: (key) => event.data[key],
          set: () => {
            // State updates via event publisher would go here
          },
        },
        events: {
          emit: (_eventType, _data) => {
            // Event emission from workflow context
            // In a full implementation, this would map event types to appropriate publishers
          },
        },
        data: event.data,
      };

      const result = await workflowEngine.execute(workflowName, context, entry.actions);
      stats.workflowsExecuted++;

      if (result.status === "failed") {
        context.logger.error(`Workflow failed: ${result.error}`);
      }
    } finally {
      activeWorkflows--;
      stats.activeWorkflows = activeWorkflows;
    }
  }

  /**
   * Process queued events
   */
  async function processQueuedEvents(): Promise<void> {
    if (processingQueue || eventQueue.length === 0) {
      return;
    }

    processingQueue = true;

    try {
      // Debounce: wait a bit before processing
      await new Promise((resolve) => setTimeout(resolve, fullConfig.debounceMs));

      // Process all queued events
      const events = [...eventQueue];
      eventQueue = [];

      for (const event of events) {
        await processEvent(event);
      }
    } finally {
      processingQueue = false;

      // Process any new events that arrived
      if (eventQueue.length > 0) {
        processQueuedEvents().catch(() => {
          // Ignore errors in queue processing
        });
      }
    }
  }

  /**
   * Queue an event for processing (internal use)
   */
  function _queueEvent(event: IntegrationEvent): void {
    eventQueue.push(event);

    if (fullConfig.enableAutoEvaluation && !processingQueue) {
      processQueuedEvents().catch(() => {
        // Ignore errors in queue processing
      });
    }
  }

  /**
   * Start the integration
   */
  async function start(): Promise<void> {
    if (running) {
      return;
    }

    running = true;

    // Register event handlers
    // In a full implementation, we would subscribe to the event publisher here
    // For now, events are manually queued via queueEvent()
  }

  /**
   * Stop the integration
   */
  async function stop(): Promise<void> {
    running = false;

    // Wait for active workflows to complete
    while (activeWorkflows > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Clear queue
    eventQueue = [];
  }

  /**
   * Register a trigger
   */
  function registerTrigger(trigger: TriggerDefinition): void {
    registeredTriggers.set(trigger.name, trigger);
    triggerEvaluator.register([trigger]);
  }

  /**
   * Register multiple triggers
   */
  function registerTriggers(triggers: TriggerDefinition[]): void {
    for (const trigger of triggers) {
      registeredTriggers.set(trigger.name, trigger);
    }
    triggerEvaluator.register(triggers);
  }

  /**
   * Register a workflow
   */
  function registerWorkflow(
    workflow: WorkflowDefinition,
    actions: Record<string, ActionHandler>,
  ): void {
    registeredWorkflows.set(workflow.name, { workflow, actions });
    workflowEngine.register([workflow]);
  }

  /**
   * Get statistics
   */
  function getStats(): IntegrationStats {
    return { ...stats };
  }

  /**
   * Check if running
   */
  function isRunning(): boolean {
    return running;
  }

  return {
    start,
    stop,
    processEvent,
    registerTrigger,
    registerTriggers,
    registerWorkflow,
    getStats,
    isRunning,
  };
}

/**
 * Create a story attributes object from event data
 */
export function storyAttributesFromEvent(event: IntegrationEvent): StoryAttributes | null {
  if (!event.data) {
    return null;
  }

  const { storyId, storyTitle, priority, status, points, tags } = event.data as Record<
    string,
    unknown
  >;

  if (typeof storyId !== "string") {
    return null;
  }

  return {
    id: storyId,
    title: typeof storyTitle === "string" ? storyTitle : undefined,
    priority: typeof priority === "string" ? priority : undefined,
    status: typeof status === "string" ? status : undefined,
    points: typeof points === "number" ? points : undefined,
    tags: Array.isArray(tags) ? (tags as string[]) : undefined,
  };
}

/**
 * Helper to create integration events from various event types
 */
export const EventFactory = {
  storyStarted(storyId: string, projectId: string, agentId?: string): IntegrationEvent {
    return {
      type: "story.started",
      timestamp: new Date().toISOString(),
      data: { storyId, projectId, agentId },
    };
  },

  storyCompleted(storyId: string, projectId: string, summary?: string): IntegrationEvent {
    return {
      type: "story.completed",
      timestamp: new Date().toISOString(),
      data: { storyId, projectId, summary },
    };
  },

  storyBlocked(storyId: string, projectId: string, reason: string): IntegrationEvent {
    return {
      type: "story.blocked",
      timestamp: new Date().toISOString(),
      data: { storyId, projectId, reason },
    };
  },

  storyAssigned(storyId: string, projectId: string, agentId: string): IntegrationEvent {
    return {
      type: "story.assigned",
      timestamp: new Date().toISOString(),
      data: { storyId, projectId, agentId },
    };
  },

  agentResumed(storyId: string, projectId: string, agentId: string): IntegrationEvent {
    return {
      type: "agent.resumed",
      timestamp: new Date().toISOString(),
      data: { storyId, projectId, agentId },
    };
  },

  stateChanged(key: string, oldValue: unknown, newValue: unknown): IntegrationEvent {
    return {
      type: "state.changed",
      timestamp: new Date().toISOString(),
      data: { key, oldValue, newValue },
    };
  },

  conflictDetected(storyId: string, conflictingAgents: string[]): IntegrationEvent {
    return {
      type: "conflict.detected",
      timestamp: new Date().toISOString(),
      data: { storyId, conflictingAgents },
    };
  },

  conflictResolved(storyId: string, winner: string, loser: string): IntegrationEvent {
    return {
      type: "conflict.resolved",
      timestamp: new Date().toISOString(),
      data: { storyId, winner, loser },
    };
  },

  pluginLoaded(pluginName: string, version: string): IntegrationEvent {
    return {
      type: "plugin.loaded",
      timestamp: new Date().toISOString(),
      data: { pluginName, version },
    };
  },

  pluginUnloaded(pluginName: string, reason?: string): IntegrationEvent {
    return {
      type: "plugin.unloaded",
      timestamp: new Date().toISOString(),
      data: { pluginName, reason },
    };
  },
};
