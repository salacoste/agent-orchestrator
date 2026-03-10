/**
 * @composio/ao-plugin-api
 *
 * Plugin API type definitions and interfaces for Agent Orchestrator.
 *
 * Provides comprehensive TypeScript types for developing plugins with
 * compile-time validation and IntelliSense support.
 *
 * @packageDocumentation
 */

/**
 * Plugin interface - All plugins must implement this interface.
 *
 * Plugins are loaded by the Agent Orchestrator at startup and can
 * subscribe to events, access state, and interact with agents.
 *
 * @example
 * ```typescript
 * import type { Plugin, PluginContext } from '@composio/ao-plugin-api';
 *
 * export function create(context: PluginContext): Plugin {
 *   return {
 *     name: 'my-plugin',
 *     version: '1.0.0',
 *     async init() {
 *       context.logger.info('Plugin initialized');
 *     },
 *     async onEvent(event) {
 *       if (event.type === 'story.completed') {
 *         context.logger.info(`Story ${event.data.storyId} completed`);
 *       }
 *     },
 *     async shutdown() {
 *       context.logger.info('Plugin shutting down');
 *     },
 *   };
 * }
 * ```
 */
export interface Plugin {
  /**
   * Unique plugin name.
   * Must match the name in plugin.yaml manifest.
   */
  name: string;

  /**
   * Plugin version following semantic versioning.
   * @format "major.minor.patch"
   */
  version: string;

  /**
   * Initialize the plugin.
   * Called once when the plugin is first loaded.
   *
   * @throws Will throw if initialization fails, preventing plugin load
   */
  init(): Promise<void>;

  /**
   * Handle events from the Agent Orchestrator.
   * Optional - plugins that don't need to handle events can omit this.
   *
   * @param event - The event to handle
   *
   * @example
   * ```typescript
   * async onEvent(event) {
   *   switch (event.type) {
   *     case 'story.completed':
   *       const story = event.data as StoryCompletedData;
   *       console.log(`Story ${story.storyId} completed`);
   *       break;
   *     case 'agent.started':
   *       console.log('Agent started:', event.data);
   *       break;
   *   }
   * }
   * ```
   */
  onEvent?(event: Event): Promise<void>;

  /**
   * Shutdown the plugin gracefully.
   * Called when the orchestrator is shutting down or plugin is being reloaded.
   *
   * @throws Should not throw - cleanup errors should be logged and handled
   */
  shutdown(): Promise<void>;
}

/**
 * Plugin context - Provides access to orchestrator services.
 *
 * The context is passed to the plugin's `create()` function and should
 * be stored for use in plugin methods.
 */
export interface PluginContext {
  /**
   * Logger for writing log messages.
   * Logs are written to the orchestrator's log output.
   */
  logger: Logger;

  /**
   * Configuration manager for accessing plugin settings.
   */
  config: Config;

  /**
   * Event emitter for subscribing to and emitting events.
   */
  events: EventEmitter;

  /**
   * State manager for accessing and updating shared state.
   */
  state: StateManager;

  /**
   * Agent manager for querying and interacting with agents.
   */
  agents: AgentManager;
}

/**
 * Logger interface - Write log messages at different severity levels.
 */
export interface Logger {
  /**
   * Log an informational message.
   *
   * @param message - The message to log
   */
  info(message: string): void;

  /**
   * Log an error message.
   *
   * @param message - The error message to log
   */
  error(message: string): void;

  /**
   * Log a warning message.
   *
   * @param message - The warning message to log
   */
  warn(message: string): void;

  /**
   * Log a debug message.
   *
   * @param message - The debug message to log
   */
  debug(message: string): void;
}

/**
 * Config interface - Access plugin configuration settings.
 */
export interface Config {
  /**
   * Get a configuration value by key.
   *
   * @param key - Configuration key (e.g., "plugin.timeout")
   * @returns The configuration value, or undefined if not found
   */
  get(key: string): string | undefined;

  /**
   * Set a configuration value.
   *
   * @param key - Configuration key
   * @param value - Configuration value
   */
  set(key: string, value: string): void;
}

/**
 * Event emitter interface - Subscribe to and emit events.
 */
export interface EventEmitter {
  /**
   * Subscribe to events.
   *
   * @param event - Event name or pattern (e.g., "story.completed", "story.*")
   * @param handler - Event handler callback
   * @returns Unsubscribe function
   */
  on(event: string, handler: EventHandler): () => void;

  /**
   * Emit an event to all subscribers.
   *
   * @param event - Event name
   * @param data - Event data payload
   */
  emit(event: string, data: unknown): void;
}

/**
 * State manager interface - Access shared orchestration state.
 */
export interface StateManager {
  /**
   * Get a state value by key.
   *
   * @param key - State key (e.g., "stories.story-1.status")
   * @returns The state value, or undefined if not found
   */
  get(key: string): StateValue | undefined;

  /**
   * Set a state value.
   *
   * @param key - State key
   * @param value - State value
   */
  set(key: string, value: StateValue): void;
}

/**
 * State value - Can be any JSON-serializable value.
 */
export type StateValue =
  | string
  | number
  | boolean
  | null
  | StateValue[]
  | { [key: string]: StateValue };

/**
 * Agent manager interface - Query and interact with agents.
 */
export interface AgentManager {
  /**
   * List all agents.
   *
   * @returns Array of all agents
   */
  list(): Agent[];

  /**
   * Get an agent by ID.
   *
   * @param id - Agent ID
   * @returns The agent, or undefined if not found
   */
  get(id: string): Agent | undefined;
}

/**
 * Event interface - Represents an event in the orchestrator.
 *
 * Events are emitted when significant actions occur, such as
 * stories being completed or agents being spawned.
 */
export interface Event {
  /**
   * Unique event identifier.
   * Format: "{timestamp}-{random}"
   */
  id: string;

  /**
   * Event type identifier.
   *
   * Common types:
   * - "story.completed" - A story was completed
   * - "story.started" - A story was started
   * - "agent.started" - An agent was spawned
   * - "agent.completed" - An agent finished work
   * - "agent.blocked" - An agent is blocked
   * - "agent.resumed" - A blocked agent was resumed
   */
  type: string;

  /**
   * Event timestamp in ISO 8601 format.
   * @format "yyyy-MM-ddTHH:mm:ss.sssZ"
   */
  timestamp: string;

  /**
   * Event data payload.
   * Structure varies by event type.
   *
   * @example
   * ```typescript
   * // story.completed event data
   * {
   *   storyId: string;
   *   status: "done";
   *   completedAt: string;
   * }
   *
   * // agent.started event data
   * {
   *   agentId: string;
   *   storyId: string;
   *   startTime: string;
   * }
   * ```
   */
  data: Record<string, unknown>;
}

/**
 * Event handler function type.
 *
 * Used with EventEmitter.on() to subscribe to events.
 *
 * @param event - The event to handle
 *
 * @example
 * ```typescript
 * const handler: EventHandler = async (event) => {
 *   if (event.type === 'story.completed') {
 *     const data = event.data as StoryCompletedData;
 *     console.log(`Story ${data.storyId} completed!`);
 *   }
 * };
 * ```
 */
export type EventHandler = (event: Event) => void | Promise<void>;

/**
 * Story interface - Represents a user story in the system.
 */
export interface Story {
  /**
   * Unique story identifier.
   * Format: "{epic}-{number}-{kebab-case-name}"
   * Example: "1-2-user-authentication"
   */
  id: string;

  /**
   * Story title.
   */
  title: string;

  /**
   * Story description.
   */
  description: string;

  /**
   * Current story status.
   *
   * Possible values:
   * - "backlog" - Story not yet started
   * - "ready-for-dev" - Ready for development
   * - "in-progress" - Currently being developed
   * - "review" - Ready for code review
   * - "done" - Story completed
   */
  status: StoryStatus;

  /**
   * Acceptance criteria for the story.
   * Each criterion should be testable and verifiable.
   */
  acceptanceCriteria: string[];

  /**
   * Tasks breakdown for implementing the story.
   */
  tasks: StoryTask[];
}

/**
 * Story status type.
 */
export type StoryStatus = "backlog" | "ready-for-dev" | "in-progress" | "review" | "done";

/**
 * Story task interface - Represents a task within a story.
 */
export interface StoryTask {
  /**
   * Task identifier (relative to story, e.g., "1", "2", "3").
   */
  id: string;

  /**
   * Task description.
   */
  description: string;

  /**
   * Task completion status.
   */
  completed: boolean;

  /**
   * Optional task notes.
   */
  notes?: string;
}

/**
 * Agent interface - Represents an AI coding agent.
 */
export interface Agent {
  /**
   * Unique agent identifier.
   * Format: "agent-{number}" or custom name
   * Example: "agent-1", "frontend-dev"
   */
  id: string;

  /**
   * ID of the story the agent is working on.
   */
  storyId: string;

  /**
   * Current agent status.
   *
   * Possible values:
   * - "spawning" - Agent is being created
   * - "working" - Agent is actively working
   * - "blocked" - Agent is blocked and needs intervention
   * - "completed" - Agent finished work
   * - "failed" - Agent failed
   */
  status: AgentStatus;

  /**
   * Agent start timestamp in ISO 8601 format.
   */
  startTime: string;

  /**
   * Optional agent end timestamp.
   */
  endTime?: string;

  /**
   * Optional error message if agent failed.
   */
  error?: string;
}

/**
 * Agent status type.
 */
export type AgentStatus = "spawning" | "working" | "blocked" | "completed" | "failed";

/**
 * Trigger interface - Defines an automation trigger.
 *
 * Triggers watch for specific conditions and execute actions.
 */
export interface Trigger {
  /**
   * Unique trigger identifier.
   */
  id: string;

  /**
   * Trigger type.
   *
   * Possible values:
   * - "event" - Triggered by an event
   * - "schedule" - Triggered on a schedule
   * - "manual" - Manually triggered
   */
  type: TriggerType;

  /**
   * Trigger condition.
   * Structure varies by trigger type.
   *
   * @example
   * ```typescript
   * // Event trigger condition
   * {
   *   eventType: "story.completed";
   *   filter: { status: "done" };
   * }
   *
   * // Schedule trigger condition
   * {
   *   cron: "0 9 * * 1-5"; // 9am weekdays
   * }
   * ```
   */
  condition: TriggerCondition;

  /**
   * Action to execute when trigger fires.
   */
  action: TriggerAction;

  /**
   * Whether the trigger is enabled.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Trigger type.
 */
export type TriggerType = "event" | "schedule" | "manual";

/**
 * Trigger condition - varies by trigger type.
 */
export type TriggerCondition =
  | EventTriggerCondition
  | ScheduleTriggerCondition
  | ManualTriggerCondition;

/**
 * Event trigger condition.
 */
export interface EventTriggerCondition {
  /**
   * Event type to listen for.
   */
  eventType: string;

  /**
   * Optional filter to match specific event data.
   */
  filter?: Record<string, unknown>;
}

/**
 * Schedule trigger condition.
 */
export interface ScheduleTriggerCondition {
  /**
   * Cron expression for schedule.
   * @example "0 9 * * 1-5" - 9am weekdays
   */
  cron: string;

  /**
   * Timezone for schedule.
   * @default "UTC"
   */
  timezone?: string;
}

/**
 * Manual trigger condition.
 */
export interface ManualTriggerCondition {
  /**
   * Description of when manual trigger should be used.
   */
  description: string;
}

/**
 * Trigger action - varies by action type.
 */
export type TriggerAction = NotifyAction | WebhookAction | ScriptAction | CustomAction;

/**
 * Base action interface with common properties.
 */
export interface BaseAction {
  /**
   * Action type.
   */
  type: string;
}

/**
 * Notify action - Send a notification.
 */
export interface NotifyAction extends BaseAction {
  /**
   * Action type - "notify"
   */
  type: "notify";

  /**
   * Notification target.
   * @example "slack", "email", "desktop"
   */
  target: string;

  /**
   * Notification message template.
   * Can use {{event.data.field}} placeholders.
   */
  message: string;
}

/**
 * Webhook action - Send an HTTP webhook.
 */
export interface WebhookAction extends BaseAction {
  /**
   * Action type - "webhook"
   */
  type: "webhook";

  /**
   * Webhook URL.
   */
  url: string;

  /**
   * HTTP method.
   * @default "POST"
   */
  method?: "GET" | "POST" | "PUT" | "PATCH";

  /**
   * Request headers.
   */
  headers?: Record<string, string>;

  /**
   * Request body template.
   */
  body?: string;
}

/**
 * Script action - Execute a script or command.
 */
export interface ScriptAction extends BaseAction {
  /**
   * Action type - "script"
   */
  type: "script";

  /**
   * Script or command to execute.
   */
  command: string;

  /**
   * Command arguments.
   */
  args?: string[];

  /**
   * Working directory.
   */
  cwd?: string;
}

/**
 * Custom action - User-defined action.
 */
export interface CustomAction extends BaseAction {
  /**
   * Action type - any string value.
   */
  type: string;

  /**
   * Action configuration - can include any properties.
   */
  [key: string]: unknown;
}
