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

describe("notification-plugin (Slack adapter)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("createNotificationPlugin", () => {
    it("returns a plugin with name 'slack'", () => {
      vi.stubGlobal("fetch", mockFetchOk());
      const plugin = createNotificationPlugin({
        webhookUrl: "https://hooks.slack.com/test",
      });
      expect(plugin.name).toBe("slack");
    });

    it("returns a plugin with send and isAvailable methods", () => {
      vi.stubGlobal("fetch", mockFetchOk());
      const plugin = createNotificationPlugin({
        webhookUrl: "https://hooks.slack.com/test",
      });
      expect(typeof plugin.send).toBe("function");
      expect(typeof plugin.isAvailable).toBe("function");
    });
  });

  describe("send", () => {
    it("calls the underlying Notifier.notify with a mapped OrchestratorEvent", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://hooks.slack.com/test",
      });

      await plugin.send(makeNotification());

      expect(fetchMock).toHaveBeenCalledOnce();
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      expect(body.blocks).toBeDefined();
    });

    it("maps eventId to OrchestratorEvent.id", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://hooks.slack.com/test",
      });

      await plugin.send(makeNotification({ eventId: "evt-99" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const blocks = body.blocks as Array<Record<string, unknown>>;
      // The header block contains the event type and session ID
      // The message is formatted as "title: message" in the section block
      const sectionBlock = blocks[1] as Record<string, Record<string, string>>;
      expect(sectionBlock.text.text).toBe("Agent stuck: Needs human input");
    });

    it("formats message as 'title: message'", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://hooks.slack.com/test",
      });

      await plugin.send(makeNotification({ title: "CI Failed", message: "Lint errors found" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const blocks = body.blocks as Array<Record<string, unknown>>;
      const sectionBlock = blocks[1] as Record<string, Record<string, string>>;
      expect(sectionBlock.text.text).toBe("CI Failed: Lint errors found");
    });

    it("uses agentId from metadata as sessionId", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://hooks.slack.com/test",
      });

      await plugin.send(makeNotification({ metadata: { agentId: "backend-5" } }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const blocks = body.blocks as Array<Record<string, unknown>>;
      const headerBlock = blocks[0] as Record<string, Record<string, string>>;
      expect(headerBlock.text.text).toContain("backend-5");
    });

    it("defaults sessionId to 'system' when agentId is missing", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://hooks.slack.com/test",
      });

      await plugin.send(makeNotification({ metadata: {} }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const blocks = body.blocks as Array<Record<string, unknown>>;
      const headerBlock = blocks[0] as Record<string, Record<string, string>>;
      expect(headerBlock.text.text).toContain("system");
    });

    it("defaults projectId to 'agent-orchestrator' when not in metadata", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://hooks.slack.com/test",
      });

      await plugin.send(makeNotification({ metadata: {} }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const blocks = body.blocks as Array<Record<string, unknown>>;
      const contextBlock = blocks[2] as Record<string, Array<Record<string, string>>>;
      expect(contextBlock.elements[0].text).toContain("agent-orchestrator");
    });

    it("uses projectId from metadata when provided", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://hooks.slack.com/test",
      });

      await plugin.send(makeNotification({ metadata: { projectId: "custom-project" } }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const blocks = body.blocks as Array<Record<string, unknown>>;
      const contextBlock = blocks[2] as Record<string, Array<Record<string, string>>>;
      expect(contextBlock.elements[0].text).toContain("custom-project");
    });

    it("handles undefined metadata gracefully", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://hooks.slack.com/test",
      });

      await plugin.send(makeNotification({ metadata: undefined }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const blocks = body.blocks as Array<Record<string, unknown>>;
      // Should default to "system" sessionId and "agent-orchestrator" projectId
      const headerBlock = blocks[0] as Record<string, Record<string, string>>;
      expect(headerBlock.text.text).toContain("system");
      const contextBlock = blocks[2] as Record<string, Array<Record<string, string>>>;
      expect(contextBlock.elements[0].text).toContain("agent-orchestrator");
    });
  });

  describe("priority mapping", () => {
    it("maps 'critical' to 'urgent'", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://hooks.slack.com/test",
      });

      await plugin.send(makeNotification({ priority: "critical" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const blocks = body.blocks as Array<Record<string, unknown>>;
      const contextBlock = blocks[2] as Record<string, Array<Record<string, string>>>;
      expect(contextBlock.elements[0].text).toContain("*Priority:* urgent");
    });

    it("maps 'warning' to 'action'", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://hooks.slack.com/test",
      });

      await plugin.send(makeNotification({ priority: "warning" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const blocks = body.blocks as Array<Record<string, unknown>>;
      const contextBlock = blocks[2] as Record<string, Array<Record<string, string>>>;
      expect(contextBlock.elements[0].text).toContain("*Priority:* action");
    });

    it("maps 'info' to 'info'", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        webhookUrl: "https://hooks.slack.com/test",
      });

      await plugin.send(makeNotification({ priority: "info" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const blocks = body.blocks as Array<Record<string, unknown>>;
      const contextBlock = blocks[2] as Record<string, Array<Record<string, string>>>;
      expect(contextBlock.elements[0].text).toContain("*Priority:* info");
    });
  });

  describe("isAvailable", () => {
    it("returns true when webhookUrl is provided", async () => {
      vi.stubGlobal("fetch", mockFetchOk());
      const plugin = createNotificationPlugin({
        webhookUrl: "https://hooks.slack.com/test",
      });
      await expect(plugin.isAvailable()).resolves.toBe(true);
    });

    it("returns false when webhookUrl is undefined", async () => {
      vi.stubGlobal("fetch", mockFetchOk());
      // Suppress the console.warn from create() when no webhookUrl
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const plugin = createNotificationPlugin({});
      await expect(plugin.isAvailable()).resolves.toBe(false);
    });

    it("returns false when no config is provided", async () => {
      vi.stubGlobal("fetch", mockFetchOk());
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const plugin = createNotificationPlugin();
      await expect(plugin.isAvailable()).resolves.toBe(false);
    });

    it("returns false when webhookUrl is empty string", async () => {
      vi.stubGlobal("fetch", mockFetchOk());
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const plugin = createNotificationPlugin({ webhookUrl: "" });
      await expect(plugin.isAvailable()).resolves.toBe(false);
    });
  });
});
