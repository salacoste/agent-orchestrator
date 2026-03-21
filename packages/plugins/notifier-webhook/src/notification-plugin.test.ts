import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Notification } from "@composio/ao-core";
import { createNotificationPlugin } from "./notification-plugin.js";

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    eventId: "evt-42",
    eventType: "ci.failing",
    priority: "info",
    title: "CI Check Failed",
    message: "Lint check failed on app-1",
    timestamp: "2025-06-15T12:00:00.000Z",
    metadata: { agentId: "agent-7", projectId: "my-project" },
    ...overrides,
  };
}

describe("webhook notification-plugin adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("createNotificationPlugin", () => {
    it("returns a plugin with name 'webhook'", () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({ url: "https://example.com/hook" });
      expect(plugin.name).toBe("webhook");
    });

    it("returns a plugin even without config", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const plugin = createNotificationPlugin();
      expect(plugin.name).toBe("webhook");
      warnSpy.mockRestore();
    });
  });

  describe("send()", () => {
    it("calls the underlying Notifier.notify() with a mapped OrchestratorEvent", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        url: "https://example.com/hook",
        retries: 0,
      });

      await plugin.send(makeNotification());

      expect(fetchMock).toHaveBeenCalledOnce();
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      expect(body.type).toBe("notification");

      const event = body.event as Record<string, unknown>;
      expect(event.id).toBe("evt-42");
      expect(event.type).toBe("session.needs_input");
      expect(event.sessionId).toBe("agent-7");
      expect(event.projectId).toBe("my-project");
    });

    it("formats message as 'title: message'", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        url: "https://example.com/hook",
        retries: 0,
      });

      await plugin.send(makeNotification({ title: "Build Failed", message: "Exit code 1" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const event = body.event as Record<string, unknown>;
      expect(event.message).toBe("Build Failed: Exit code 1");
    });

    it("uses eventId as the OrchestratorEvent id", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        url: "https://example.com/hook",
        retries: 0,
      });

      await plugin.send(makeNotification({ eventId: "unique-evt-99" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const event = body.event as Record<string, unknown>;
      expect(event.id).toBe("unique-evt-99");
    });

    it("defaults sessionId to 'system' when metadata has no agentId", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        url: "https://example.com/hook",
        retries: 0,
      });

      await plugin.send(makeNotification({ metadata: {} }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const event = body.event as Record<string, unknown>;
      expect(event.sessionId).toBe("system");
    });

    it("defaults sessionId to 'system' when metadata is undefined", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        url: "https://example.com/hook",
        retries: 0,
      });

      await plugin.send(makeNotification({ metadata: undefined }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const event = body.event as Record<string, unknown>;
      expect(event.sessionId).toBe("system");
    });

    it("defaults projectId to 'agent-orchestrator' when metadata has no projectId", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        url: "https://example.com/hook",
        retries: 0,
      });

      await plugin.send(makeNotification({ metadata: { agentId: "agent-1" } }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const event = body.event as Record<string, unknown>;
      expect(event.projectId).toBe("agent-orchestrator");
    });

    it("converts timestamp string to ISO date string in event", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        url: "https://example.com/hook",
        retries: 0,
      });

      await plugin.send(makeNotification({ timestamp: "2025-06-15T12:00:00.000Z" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const event = body.event as Record<string, unknown>;
      expect(event.timestamp).toBe("2025-06-15T12:00:00.000Z");
    });

    it("passes metadata as event data", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        url: "https://example.com/hook",
        retries: 0,
      });

      const metadata = { agentId: "agent-7", projectId: "my-project", custom: "value" };
      await plugin.send(makeNotification({ metadata }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const event = body.event as Record<string, unknown>;
      const data = event.data as Record<string, unknown>;
      expect(data.custom).toBe("value");
      expect(data.agentId).toBe("agent-7");
    });

    it("uses empty object as data when metadata is undefined", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        url: "https://example.com/hook",
        retries: 0,
      });

      await plugin.send(makeNotification({ metadata: undefined }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const event = body.event as Record<string, unknown>;
      expect(event.data).toEqual({});
    });
  });

  describe("priority mapping", () => {
    it("maps 'critical' to 'urgent'", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        url: "https://example.com/hook",
        retries: 0,
      });

      await plugin.send(makeNotification({ priority: "critical" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const event = body.event as Record<string, unknown>;
      expect(event.priority).toBe("urgent");
    });

    it("maps 'warning' to 'action'", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        url: "https://example.com/hook",
        retries: 0,
      });

      await plugin.send(makeNotification({ priority: "warning" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const event = body.event as Record<string, unknown>;
      expect(event.priority).toBe("action");
    });

    it("maps 'info' to 'info'", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({
        url: "https://example.com/hook",
        retries: 0,
      });

      await plugin.send(makeNotification({ priority: "info" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
      const event = body.event as Record<string, unknown>;
      expect(event.priority).toBe("info");
    });
  });

  describe("isAvailable()", () => {
    it("returns true when url is provided", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const plugin = createNotificationPlugin({ url: "https://example.com/hook" });
      await expect(plugin.isAvailable()).resolves.toBe(true);
    });

    it("returns false when url is undefined", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const plugin = createNotificationPlugin();
      await expect(plugin.isAvailable()).resolves.toBe(false);
      warnSpy.mockRestore();
    });

    it("returns false when url is empty string", async () => {
      const plugin = createNotificationPlugin({ url: "" });
      await expect(plugin.isAvailable()).resolves.toBe(false);
    });

    it("returns false when config is undefined", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const plugin = createNotificationPlugin(undefined);
      await expect(plugin.isAvailable()).resolves.toBe(false);
      warnSpy.mockRestore();
    });
  });
});
