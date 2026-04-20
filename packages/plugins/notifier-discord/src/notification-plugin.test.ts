import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Notification } from "@composio/ao-core";
import { createNotificationPlugin } from "./notification-plugin.js";

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    eventId: "evt-42",
    eventType: "session.needs_input",
    priority: "info",
    title: "Agent stuck",
    message: "Needs human input",
    timestamp: "2025-06-15T12:00:00Z",
    metadata: {
      agentId: "agent-1",
      projectId: "my-project",
    },
    ...overrides,
  };
}

function mockFetchOk() {
  return vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve("ok"),
  });
}

interface TestBody {
  embeds: Array<Record<string, unknown>>;
  content?: string;
  username?: string;
}

function parseBody(fetchMock: ReturnType<typeof mockFetchOk>): TestBody {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string) as TestBody;
}

function getEmbed(fetchMock: ReturnType<typeof mockFetchOk>): Record<string, unknown> {
  return parseBody(fetchMock).embeds[0];
}

describe("notification-plugin (Discord adapter)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("createNotificationPlugin", () => {
    it("returns a plugin with name 'discord'", () => {
      vi.stubGlobal("fetch", mockFetchOk());
      const plugin = createNotificationPlugin({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
      });
      expect(plugin.name).toBe("discord");
    });

    it("returns a plugin with send and isAvailable methods", () => {
      vi.stubGlobal("fetch", mockFetchOk());
      const plugin = createNotificationPlugin({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
      });
      expect(typeof plugin.send).toBe("function");
      expect(typeof plugin.isAvailable).toBe("function");
    });
  });

  describe("send", () => {
    it("calls webhook with embed payload via Notifier bridge", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
      });

      await plugin.send(makeNotification());

      expect(fetchMock).toHaveBeenCalledOnce();
      const body = parseBody(fetchMock);
      expect(body.embeds).toHaveLength(1);
    });

    it("bridges notification message into embed description", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
      });

      await plugin.send(makeNotification({ message: "Lint errors found" }));

      // notificationToOrchestratorEvent puts "title: message" as event message
      const embed = getEmbed(fetchMock);
      expect(embed.description).toContain("Lint errors found");
    });

    it("maps info priority to green color via EventPriority bridge", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
      });

      // "info" NotificationPriority → "info" EventPriority → Green 5763719
      await plugin.send(makeNotification({ priority: "info" }));
      expect(getEmbed(fetchMock).color).toBe(5763719);
    });

    it("maps critical priority to red color via EventPriority bridge", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
      });

      // "critical" NotificationPriority → "urgent" EventPriority → Red 16711680
      await plugin.send(makeNotification({ priority: "critical" }));
      expect(getEmbed(fetchMock).color).toBe(16711680);
    });

    it("maps warning priority to blue color via EventPriority bridge", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
      });

      // "warning" NotificationPriority → "action" EventPriority → Blue 3447003
      await plugin.send(makeNotification({ priority: "warning" }));
      expect(getEmbed(fetchMock).color).toBe(3447003);
    });

    it("maps medium priority to green color via EventPriority bridge", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
      });

      // "medium" NotificationPriority → "info" EventPriority (default) → Green 5763719
      await plugin.send(makeNotification({ priority: "medium" }));
      expect(getEmbed(fetchMock).color).toBe(5763719);
    });

    it("does not call fetch when webhookUrl is not configured", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin();
      await plugin.send(makeNotification());

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("isAvailable", () => {
    it("returns true when webhookUrl is provided", async () => {
      vi.stubGlobal("fetch", mockFetchOk());
      const plugin = createNotificationPlugin({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
      });
      await expect(plugin.isAvailable()).resolves.toBe(true);
    });

    it("returns false when webhookUrl is undefined", async () => {
      vi.stubGlobal("fetch", mockFetchOk());
      const plugin = createNotificationPlugin({});
      await expect(plugin.isAvailable()).resolves.toBe(false);
    });

    it("returns false when no config is provided", async () => {
      vi.stubGlobal("fetch", mockFetchOk());
      const plugin = createNotificationPlugin();
      await expect(plugin.isAvailable()).resolves.toBe(false);
    });

    it("returns false when webhookUrl is empty string", async () => {
      vi.stubGlobal("fetch", mockFetchOk());
      const plugin = createNotificationPlugin({ webhookUrl: "" });
      await expect(plugin.isAvailable()).resolves.toBe(false);
    });
  });
});
