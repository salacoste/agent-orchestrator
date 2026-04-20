import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OrchestratorEvent, NotifyAction, EventPriority } from "@composio/ao-core";
import { manifest, create } from "./index.js";

function makeEvent(overrides: Partial<OrchestratorEvent> = {}): OrchestratorEvent {
  return {
    id: "evt-1",
    type: "session.spawned",
    priority: "info",
    sessionId: "app-1",
    projectId: "my-project",
    timestamp: new Date("2025-06-15T12:00:00Z"),
    message: "Session app-1 spawned successfully",
    data: {},
    ...overrides,
  };
}

function mockFetchOk() {
  return vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve("ok"),
  });
}

describe("notifier-discord", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("manifest", () => {
    it("has correct metadata", () => {
      expect(manifest.name).toBe("discord");
      expect(manifest.slot).toBe("notifier");
      expect(manifest.version).toBe("0.1.0");
    });
  });

  describe("create", () => {
    it("returns a notifier with name 'discord'", () => {
      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      expect(notifier.name).toBe("discord");
    });

    it("warns when no webhookUrl configured", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      create();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("No webhookUrl configured"));
    });

    it("throws on invalid URL scheme", () => {
      expect(() => create({ webhookUrl: "file:///etc/passwd" })).toThrow("must be http(s)");
    });
  });

  describe("notify", () => {
    it("does nothing when no webhookUrl", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);
      const notifier = create();
      await notifier.notify(makeEvent());
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("POSTs to the webhook URL", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      await notifier.notify(makeEvent());

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][0]).toBe("https://discord.com/api/webhooks/test/token");
      expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    });

    it("sends JSON with Content-Type header", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      await notifier.notify(makeEvent());

      const opts = fetchMock.mock.calls[0][1];
      expect(opts.headers["Content-Type"]).toBe("application/json");
    });

    it("includes username in payload", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      await notifier.notify(makeEvent());

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.username).toBe("Agent Orchestrator");
    });

    it("uses custom username when configured", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
        username: "MyBot",
      });
      await notifier.notify(makeEvent());

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.username).toBe("MyBot");
    });

    it("logs error on non-ok response without throwing", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("server error"),
      });
      vi.stubGlobal("fetch", fetchMock);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      await notifier.notify(makeEvent());

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Webhook failed (500)"));
    });
  });

  describe("embed formatting", () => {
    it("includes embed with correct title, description, color", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      await notifier.notify(makeEvent({ priority: "urgent", message: "Build broken" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const embed = body.embeds[0];
      expect(embed.title).toContain("session.spawned");
      expect(embed.description).toBe("Build broken");
      expect(embed.color).toBe(16711680); // Red for urgent
    });

    it("uses correct color for each priority level", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });

      const priorities: Array<[EventPriority, number]> = [
        ["urgent", 16711680], // Red
        ["action", 3447003], // Blue
        ["warning", 16776960], // Yellow
        ["info", 5763719], // Green
      ];

      for (const [priority, color] of priorities) {
        fetchMock.mockClear();
        await notifier.notify(makeEvent({ priority }));
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.embeds[0].color).toBe(color);
      }
    });

    it("includes fields for project, priority, and session", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      await notifier.notify(makeEvent({ projectId: "frontend", priority: "action" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const fields = body.embeds[0].fields;
      const fieldNames = fields.map((f: { name: string }) => f.name);
      expect(fieldNames).toContain("Project");
      expect(fieldNames).toContain("Priority");
      expect(fieldNames).toContain("Session");
    });

    it("includes footer with agent-orchestrator", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      await notifier.notify(makeEvent());

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.embeds[0].footer.text).toBe("agent-orchestrator");
    });

    it("includes timestamp in ISO format", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      await notifier.notify(makeEvent({ timestamp: new Date("2025-06-15T12:00:00Z") }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.embeds[0].timestamp).toBe("2025-06-15T12:00:00.000Z");
    });

    it("includes PR link when prUrl is a string in event data", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      await notifier.notify(makeEvent({ data: { prUrl: "https://github.com/org/repo/pull/42" } }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const prField = body.embeds[0].fields.find(
        (f: { name: string }) => f.name === "Pull Request",
      );
      expect(prField).toBeDefined();
      expect(prField.value).toContain("https://github.com/org/repo/pull/42");
    });

    it("ignores prUrl when it is not a string", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      await notifier.notify(makeEvent({ data: { prUrl: 12345 } }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const prField = body.embeds[0].fields.find(
        (f: { name: string }) => f.name === "Pull Request",
      );
      expect(prField).toBeUndefined();
    });

    it("includes CI status when ciStatus is a string", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      await notifier.notify(makeEvent({ data: { ciStatus: "passing" } }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const ciField = body.embeds[0].fields.find((f: { name: string }) => f.name === "CI Status");
      expect(ciField).toBeDefined();
      expect(ciField.value).toContain("passing");
    });

    it("uses check mark for passing CI", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      await notifier.notify(makeEvent({ data: { ciStatus: "passing" } }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const ciField = body.embeds[0].fields.find((f: { name: string }) => f.name === "CI Status");
      expect(ciField.value).toContain("\u2705");
    });

    it("uses X mark for failing CI", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      await notifier.notify(makeEvent({ data: { ciStatus: "failing" } }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const ciField = body.embeds[0].fields.find((f: { name: string }) => f.name === "CI Status");
      expect(ciField.value).toContain("\u274C");
    });

    it("ignores ciStatus when it is not a string", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      await notifier.notify(makeEvent({ data: { ciStatus: { nested: true } } }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const ciField = body.embeds[0].fields.find((f: { name: string }) => f.name === "CI Status");
      expect(ciField).toBeUndefined();
    });
  });

  describe("mention support", () => {
    it("includes content field for urgent priority when mention configured", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
        mentions: { urgent: "@here", warning: "<@&ROLE_ID>" },
      });
      await notifier.notify(makeEvent({ priority: "urgent" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.content).toBe("@here");
    });

    it("includes role mention for warning priority", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
        mentions: { urgent: "@here", warning: "<@&ROLE_ID>" },
      });
      await notifier.notify(makeEvent({ priority: "warning" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.content).toBe("<@&ROLE_ID>");
    });

    it("omits content field when no mention for priority", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
        mentions: { urgent: "@here" },
      });
      await notifier.notify(makeEvent({ priority: "info" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.content).toBeUndefined();
    });

    it("supports @everyone mention", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
        mentions: { urgent: "@everyone" },
      });
      await notifier.notify(makeEvent({ priority: "urgent" }));

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.content).toBe("@everyone");
    });
  });

  describe("notifyWithActions", () => {
    it("does nothing when no webhookUrl", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);
      const notifier = create();
      await notifier.notifyWithActions!(makeEvent(), [{ label: "Go", url: "https://example.com" }]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("includes action links in embed fields", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      const actions: NotifyAction[] = [
        { label: "Merge", url: "https://github.com/org/repo/pull/42/merge" },
        { label: "Open", url: "https://github.com/org/repo/pull/42" },
      ];
      await notifier.notifyWithActions!(makeEvent(), actions);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const actionsField = body.embeds[0].fields.find(
        (f: { name: string }) => f.name === "Actions",
      );
      expect(actionsField).toBeDefined();
      expect(actionsField.value).toContain("Merge");
      expect(actionsField.value).toContain("Open");
    });

    it("filters out actions with no url", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      const actions: NotifyAction[] = [
        { label: "No-op" },
        { label: "Merge", url: "https://example.com" },
      ];
      await notifier.notifyWithActions!(makeEvent(), actions);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const actionsField = body.embeds[0].fields.find(
        (f: { name: string }) => f.name === "Actions",
      );
      expect(actionsField.value).not.toContain("No-op");
      expect(actionsField.value).toContain("Merge");
    });

    it("does not include Actions field when all actions have no url", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      const actions: NotifyAction[] = [{ label: "Callback-only", callbackEndpoint: "/api/kill" }];
      await notifier.notifyWithActions!(makeEvent(), actions);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const actionsField = body.embeds[0].fields.find(
        (f: { name: string }) => f.name === "Actions",
      );
      expect(actionsField).toBeUndefined();
    });

    it("includes mention content for action events", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({
        webhookUrl: "https://discord.com/api/webhooks/test/token",
        mentions: { action: "@here" },
      });
      const actions: NotifyAction[] = [{ label: "Go", url: "https://example.com" }];
      await notifier.notifyWithActions!(makeEvent({ priority: "action" }), actions);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.content).toBe("@here");
    });
  });

  describe("post", () => {
    it("sends a raw text message via content field", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create({ webhookUrl: "https://discord.com/api/webhooks/test/token" });
      const result = await notifier.post!("Hello from AO");

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.content).toBe("Hello from AO");
      expect(body.embeds).toBeUndefined();
      expect(result).toBeNull();
    });

    it("returns null when no webhookUrl", async () => {
      const fetchMock = mockFetchOk();
      vi.stubGlobal("fetch", fetchMock);

      const notifier = create();
      const result = await notifier.post!("test");
      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
