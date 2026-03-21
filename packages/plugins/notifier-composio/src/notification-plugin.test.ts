import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Notification } from "@composio/ao-core";
import { createNotificationPlugin } from "./notification-plugin.js";

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    eventId: "evt-42",
    eventType: "agent.blocked",
    priority: "critical",
    title: "Agent Blocked",
    message: "Session needs human input",
    timestamp: new Date("2025-06-15T12:00:00Z").toISOString(),
    ...overrides,
  };
}

describe("notification-plugin (composio adapter)", () => {
  const originalEnv = process.env.COMPOSIO_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.COMPOSIO_API_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.COMPOSIO_API_KEY = originalEnv;
    } else {
      delete process.env.COMPOSIO_API_KEY;
    }
  });

  // ---------------------------------------------------------------------------
  // createNotificationPlugin — structure
  // ---------------------------------------------------------------------------

  describe("createNotificationPlugin", () => {
    it("returns a plugin with name 'composio'", () => {
      const plugin = createNotificationPlugin();
      expect(plugin.name).toBe("composio");
    });

    it("has send and isAvailable methods", () => {
      const plugin = createNotificationPlugin();
      expect(typeof plugin.send).toBe("function");
      expect(typeof plugin.isAvailable).toBe("function");
    });
  });

  // ---------------------------------------------------------------------------
  // isAvailable
  // ---------------------------------------------------------------------------

  describe("isAvailable", () => {
    it("returns true when composioApiKey is provided in config", async () => {
      const plugin = createNotificationPlugin({ composioApiKey: "test-key-123" });
      const available = await plugin.isAvailable();
      expect(available).toBe(true);
    });

    it("returns true when COMPOSIO_API_KEY env var is set", async () => {
      process.env.COMPOSIO_API_KEY = "env-key-456";
      const plugin = createNotificationPlugin();
      const available = await plugin.isAvailable();
      expect(available).toBe(true);
    });

    it("returns false when no API key is configured", async () => {
      const plugin = createNotificationPlugin();
      const available = await plugin.isAvailable();
      expect(available).toBe(false);
    });

    it("returns false when composioApiKey is empty string", async () => {
      const plugin = createNotificationPlugin({ composioApiKey: "" });
      const available = await plugin.isAvailable();
      expect(available).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // send — no-op when no API key (underlying notifier short-circuits)
  // ---------------------------------------------------------------------------

  describe("send", () => {
    it("does not throw when no API key is configured (no-op)", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const plugin = createNotificationPlugin();
      const notification = makeNotification();

      await expect(plugin.send(notification)).resolves.toBeUndefined();
      warnSpy.mockRestore();
    });

    it("calls underlying notifier.notify with correctly mapped event via _clientOverride", async () => {
      const mockClient = {
        executeAction: vi.fn().mockResolvedValue({ successful: true }),
      };

      // Pass _clientOverride through to create() by casting the config
      const config = {
        composioApiKey: "test-key",
        _clientOverride: mockClient,
      } as Record<string, unknown>;

      const plugin = createNotificationPlugin(
        config as Parameters<typeof createNotificationPlugin>[0],
      );

      const notification = makeNotification({
        eventId: "evt-99",
        priority: "critical",
        title: "CI Failed",
        message: "Build 42 failed",
        metadata: { agentId: "agent-7", projectId: "my-proj" },
      });

      await plugin.send(notification);

      expect(mockClient.executeAction).toHaveBeenCalledOnce();

      // Verify the text sent to Composio contains the mapped message format
      const callArgs = mockClient.executeAction.mock.calls[0][0] as Record<string, unknown>;
      const params = callArgs.params as Record<string, unknown>;
      const text = params.text as string;
      expect(text).toContain("CI Failed: Build 42 failed");
    });
  });

  // ---------------------------------------------------------------------------
  // Priority mapping: critical->urgent, warning->action, info->info
  // ---------------------------------------------------------------------------

  describe("priority mapping", () => {
    const mockClient = {
      executeAction: vi.fn().mockResolvedValue({ successful: true }),
    };

    function createPluginWithMock() {
      const config = {
        composioApiKey: "test-key",
        _clientOverride: mockClient,
      } as Record<string, unknown>;
      return createNotificationPlugin(config as Parameters<typeof createNotificationPlugin>[0]);
    }

    beforeEach(() => {
      mockClient.executeAction.mockClear();
    });

    it("maps critical priority to urgent emoji", async () => {
      const plugin = createPluginWithMock();
      await plugin.send(makeNotification({ priority: "critical" }));

      const callArgs = mockClient.executeAction.mock.calls[0][0] as Record<string, unknown>;
      const params = callArgs.params as Record<string, unknown>;
      const text = params.text as string;
      // urgent priority emoji is \u{1F6A8}
      expect(text).toContain("\u{1F6A8}");
    });

    it("maps warning priority to action emoji", async () => {
      const plugin = createPluginWithMock();
      await plugin.send(makeNotification({ priority: "warning" }));

      const callArgs = mockClient.executeAction.mock.calls[0][0] as Record<string, unknown>;
      const params = callArgs.params as Record<string, unknown>;
      const text = params.text as string;
      // action priority emoji is \u{1F449}
      expect(text).toContain("\u{1F449}");
    });

    it("maps info priority to info emoji", async () => {
      const plugin = createPluginWithMock();
      await plugin.send(makeNotification({ priority: "info" }));

      const callArgs = mockClient.executeAction.mock.calls[0][0] as Record<string, unknown>;
      const params = callArgs.params as Record<string, unknown>;
      const text = params.text as string;
      // info priority emoji is \u{2139}\u{FE0F}
      expect(text).toContain("\u{2139}\u{FE0F}");
    });
  });

  // ---------------------------------------------------------------------------
  // Notification -> OrchestratorEvent conversion
  // ---------------------------------------------------------------------------

  describe("Notification to OrchestratorEvent conversion", () => {
    const mockClient = {
      executeAction: vi.fn().mockResolvedValue({ successful: true }),
    };

    function createPluginWithMock() {
      const config = {
        composioApiKey: "test-key",
        _clientOverride: mockClient,
      } as Record<string, unknown>;
      return createNotificationPlugin(config as Parameters<typeof createNotificationPlugin>[0]);
    }

    beforeEach(() => {
      mockClient.executeAction.mockClear();
    });

    it("formats message as 'title: message'", async () => {
      const plugin = createPluginWithMock();
      await plugin.send(makeNotification({ title: "Deploy Failed", message: "Timeout on step 3" }));

      const callArgs = mockClient.executeAction.mock.calls[0][0] as Record<string, unknown>;
      const params = callArgs.params as Record<string, unknown>;
      const text = params.text as string;
      expect(text).toContain("Deploy Failed: Timeout on step 3");
    });

    it("uses agentId from metadata as sessionId in the event text", async () => {
      const plugin = createPluginWithMock();
      await plugin.send(
        makeNotification({
          metadata: { agentId: "backend-agent-5" },
        }),
      );

      const callArgs = mockClient.executeAction.mock.calls[0][0] as Record<string, unknown>;
      const params = callArgs.params as Record<string, unknown>;
      const text = params.text as string;
      expect(text).toContain("backend-agent-5");
    });

    it("defaults sessionId to 'system' when agentId not in metadata", async () => {
      const plugin = createPluginWithMock();
      await plugin.send(makeNotification({ metadata: {} }));

      const callArgs = mockClient.executeAction.mock.calls[0][0] as Record<string, unknown>;
      const params = callArgs.params as Record<string, unknown>;
      const text = params.text as string;
      expect(text).toContain("system");
    });

    it("defaults sessionId to 'system' when metadata is undefined", async () => {
      const plugin = createPluginWithMock();
      await plugin.send(makeNotification({ metadata: undefined }));

      const callArgs = mockClient.executeAction.mock.calls[0][0] as Record<string, unknown>;
      const params = callArgs.params as Record<string, unknown>;
      const text = params.text as string;
      expect(text).toContain("system");
    });

    it("sends to correct Composio action slug (defaults to Slack)", async () => {
      const plugin = createPluginWithMock();
      await plugin.send(makeNotification());

      const callArgs = mockClient.executeAction.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.action).toBe("SLACK_SEND_MESSAGE");
    });
  });
});
