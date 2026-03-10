/**
 * Plugin API Tests
 *
 * Tests the plugin type definitions and ensure they provide:
 * - Compile-time type checking
 * - Proper interface definitions
 * - JSDoc documentation
 */

import { describe, it, expect } from "vitest";
import type {
  Plugin,
  PluginContext,
  Story,
  Agent,
  Event,
  Trigger,
  EventHandler,
} from "../index.js";

describe("Plugin API", () => {
  describe("Plugin interface", () => {
    it("should define required Plugin properties", () => {
      // This test verifies the Plugin interface has the correct structure
      // The actual type checking happens at compile time

      // Create a mock plugin to verify the interface
      const mockPlugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        init: async () => {},
        shutdown: async () => {},
      };

      expect(mockPlugin.name).toBe("test-plugin");
      expect(mockPlugin.version).toBe("1.0.0");
      expect(typeof mockPlugin.init).toBe("function");
      expect(typeof mockPlugin.shutdown).toBe("function");
    });

    it("should allow optional onEvent handler", () => {
      const pluginWithEventHandler: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        init: async () => {},
        onEvent: async (_event: Event) => {},
        shutdown: async () => {},
      };

      expect(pluginWithEventHandler.onEvent).toBeDefined();
    });

    it("should allow plugin without onEvent handler", () => {
      const pluginWithoutEventHandler: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        init: async () => {},
        shutdown: async () => {},
      };

      expect(pluginWithoutEventHandler.onEvent).toBeUndefined();
    });
  });

  describe("PluginContext interface", () => {
    it("should define all context properties", () => {
      const mockContext: PluginContext = {
        logger: {
          info: (_msg: string) => {},
          error: (_msg: string) => {},
          warn: (_msg: string) => {},
          debug: (_msg: string) => {},
        },
        config: {
          get: (_key: string) => "value",
          set: (_key: string, _value: string) => {},
        },
        events: {
          on: (_event: string, _handler: EventHandler) => () => {},
          emit: (_event: string, _data: unknown) => {},
        },
        state: {
          get: (_key: string) => ({ value: "test" }),
          set: (_key: string, _value: unknown) => {},
        },
        agents: {
          list: () => [],
          get: (_id: string) => ({ id: "agent-1", storyId: "story-1" }),
        },
      };

      expect(mockContext.logger).toBeDefined();
      expect(mockContext.config).toBeDefined();
      expect(mockContext.events).toBeDefined();
      expect(mockContext.state).toBeDefined();
      expect(mockContext.agents).toBeDefined();
    });
  });

  describe("Event types", () => {
    it("should define Event structure", () => {
      const mockEvent: Event = {
        id: "event-1",
        type: "story.completed",
        timestamp: new Date().toISOString(),
        data: {
          storyId: "story-1",
          status: "done",
        },
      };

      expect(mockEvent.id).toBe("event-1");
      expect(mockEvent.type).toBe("story.completed");
      expect(mockEvent.timestamp).toBeDefined();
      expect(mockEvent.data).toBeDefined();
    });

    it("should support different event types", () => {
      const storyCompletedEvent: Event = {
        id: "event-1",
        type: "story.completed",
        timestamp: new Date().toISOString(),
        data: {
          storyId: "story-1",
          status: "done",
        },
      };

      const agentStartedEvent: Event = {
        id: "event-2",
        type: "agent.started",
        timestamp: new Date().toISOString(),
        data: {
          agentId: "agent-1",
          storyId: "story-1",
        },
      };

      expect(storyCompletedEvent.type).toBe("story.completed");
      expect(agentStartedEvent.type).toBe("agent.started");
    });
  });

  describe("Story types", () => {
    it("should define Story structure", () => {
      const mockStory: Story = {
        id: "story-1",
        title: "Test Story",
        description: "A test story",
        status: "ready-for-dev",
        acceptanceCriteria: [],
        tasks: [],
      };

      expect(mockStory.id).toBe("story-1");
      expect(mockStory.title).toBe("Test Story");
      expect(mockStory.status).toBe("ready-for-dev");
    });
  });

  describe("Agent types", () => {
    it("should define Agent structure", () => {
      const mockAgent: Agent = {
        id: "agent-1",
        storyId: "story-1",
        status: "working",
        startTime: new Date().toISOString(),
      };

      expect(mockAgent.id).toBe("agent-1");
      expect(mockAgent.storyId).toBe("story-1");
      expect(mockAgent.status).toBe("working");
    });
  });

  describe("Trigger types", () => {
    it("should define Trigger structure", () => {
      const mockTrigger: Trigger = {
        id: "trigger-1",
        type: "event",
        condition: {
          eventType: "story.completed",
        },
        action: {
          type: "notify",
          target: "slack",
        },
      };

      expect(mockTrigger.id).toBe("trigger-1");
      expect(mockTrigger.type).toBe("event");
      expect(mockTrigger.condition).toBeDefined();
      expect(mockTrigger.action).toBeDefined();
    });
  });

  describe("Type exports", () => {
    it("should export all required types", () => {
      // This test verifies that all types are exported from the index
      // If any type is missing, this will fail at compile time

      type AllTypes = Plugin | PluginContext | Story | Agent | Event | Trigger | EventHandler;

      // This is just a type check - if it compiles, all types are exported
      const verifyType = (_type: AllTypes) => {};
      expect(typeof verifyType).toBe("function");
    });
  });

  describe("Integration: compile-time type validation", () => {
    /**
     * Integration test demonstrating compile-time type validation.
     *
     * This test shows how TypeScript validates plugin implementations
     * at compile time, catching errors before runtime.
     *
     * The following would FAIL to compile (uncomment to verify):
     *
     * ```typescript
     * // ERROR: Missing required 'name' property
     * const invalidPlugin1: Plugin = {
     *   version: "1.0.0",
     *   init: async () => {},
     *   shutdown: async () => {},
     * };
     *
     * // ERROR: Missing required 'version' property
     * const invalidPlugin2: Plugin = {
     *   name: "my-plugin",
     *   init: async () => {},
     *   shutdown: async () => {},
     * };
     *
     * // ERROR: 'init' must return Promise<void>
     * const invalidPlugin3: Plugin = {
     *   name: "my-plugin",
     *   version: "1.0.0",
     *   init: () => {},  // Missing async
     *   shutdown: async () => {},
     * };
     *
     * // ERROR: 'onEvent' has wrong signature
     * const invalidPlugin4: Plugin = {
     *   name: "my-plugin",
     *   version: "1.0.0",
     *   init: async () => {},
     *   onEvent: (event: Event) => {},  // Missing async
     *   shutdown: async () => {},
     * };
     * ```
     *
     * Only valid Plugin implementations compile successfully:
     */
    it("should enforce Plugin interface at compile time", () => {
      // This test documents the compile-time validation behavior.
      // If you uncomment the invalid examples above, TypeScript will error.

      // Valid plugin implementation - this compiles
      const validPlugin: Plugin = {
        name: "my-plugin",
        version: "1.0.0",
        init: async () => {
          // Initialization logic
        },
        onEvent: async (event: Event) => {
          // Event handling logic with typed event
          console.log(`Event ${event.type} received`);
        },
        shutdown: async () => {
          // Cleanup logic
        },
      };

      // Verify the valid plugin has all required properties
      expect(validPlugin.name).toBe("my-plugin");
      expect(validPlugin.version).toBe("1.0.0");
      expect(typeof validPlugin.init).toBe("function");
      expect(typeof validPlugin.shutdown).toBe("function");
    });

    it("should enforce PluginContext usage at compile time", () => {
      /**
       * Demonstrates compile-time validation for PluginContext usage.
       *
       * The following would FAIL to compile:
       *
       * ```typescript
       * // ERROR: Missing 'logger' property
       * const invalidContext1: PluginContext = {
       *   config: { get: () => "", set: () => {} },
       *   events: { on: () => () => {}, emit: () => {} },
       *   state: { get: () => ({}), set: () => {} },
       *   agents: { list: () => [], get: () => null },
       * };
       *
       * // ERROR: Wrong return type for logger.info
       * const invalidLogger: Logger = {
       *   info: (msg: string) => 123,  // Should return void
       *   error: (msg: string) => {},
       *   warn: (msg: string) => {},
       *   debug: (msg: string) => {},
       * };
       * ```
       */

      // Valid context implementation
      const validContext: PluginContext = {
        logger: {
          info: (_msg: string) => {},
          error: (_msg: string) => {},
          warn: (_msg: string) => {},
          debug: (_msg: string) => {},
        },
        config: {
          get: (_key: string) => "value",
          set: (_key: string, _value: string) => {},
        },
        events: {
          on: (_event: string, _handler: EventHandler) => () => {},
          emit: (_event: string, _data: unknown) => {},
        },
        state: {
          get: (_key: string) => ({ value: "test" }),
          set: (_key: string, _value: unknown) => {},
        },
        agents: {
          list: () => [],
          get: (_id: string) => ({ id: "agent-1", storyId: "story-1" }),
        },
      };

      // Verify all context services are available
      expect(validContext.logger).toBeDefined();
      expect(validContext.config).toBeDefined();
      expect(validContext.events).toBeDefined();
      expect(validContext.state).toBeDefined();
      expect(validContext.agents).toBeDefined();
    });

    it("should demonstrate plugin creation workflow", () => {
      /**
       * Integration test showing the complete plugin creation workflow.
       *
       * This demonstrates how a plugin developer would:
       * 1. Import types from @composio/ao-plugin-api
       * 2. Implement the Plugin interface
       * 3. Use PluginContext for orchestrator services
       * 4. Handle typed events
       */

      // Simulated plugin creation function
      function createMyPlugin(context: PluginContext): Plugin {
        return {
          name: "my-notifications-plugin",
          version: "1.0.0",

          async init() {
            // Use typed context services
            context.logger.info("Initializing notifications plugin");
            const timeout = context.config.get("timeout");
            context.logger.info(`Timeout: ${timeout}`);
          },

          async onEvent(event) {
            // TypeScript knows event.type is a string
            // and event.data is Record<string, unknown>
            if (event.type === "story.completed") {
              context.logger.info(`Story ${event.data.storyId} completed`);

              // Emit a notification event
              context.events.emit("notification", {
                message: "Story completed!",
              });
            }
          },

          async shutdown() {
            context.logger.info("Shutting down notifications plugin");
          },
        };
      }

      // Verify the plugin can be created
      const mockContext: PluginContext = {
        logger: {
          info: (_msg: string) => {},
          error: (_msg: string) => {},
          warn: (_msg: string) => {},
          debug: (_msg: string) => {},
        },
        config: {
          get: (_key: string) => "5000",
          set: (_key: string, _value: string) => {},
        },
        events: {
          on: (_event: string, _handler: EventHandler) => () => {},
          emit: (_event: string, _data: unknown) => {},
        },
        state: {
          get: (_key: string) => ({ value: "test" }),
          set: (_key: string, _value: unknown) => {},
        },
        agents: {
          list: () => [],
          get: (_id: string) => ({ id: "agent-1", storyId: "story-1" }),
        },
      };

      const plugin = createMyPlugin(mockContext);

      // Verify plugin structure
      expect(plugin.name).toBe("my-notifications-plugin");
      expect(plugin.version).toBe("1.0.0");
      expect(plugin.onEvent).toBeDefined();
    });
  });
});
