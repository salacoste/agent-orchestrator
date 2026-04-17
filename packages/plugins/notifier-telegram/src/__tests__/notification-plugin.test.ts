/**
 * Tests for Telegram NotificationPlugin adapter.
 * Story 57.1 + 57.2 + 57.3 + 57.13 — verify direct Notification formatting with /commands,
 * preference-based filtering, and story quick-action buttons.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSendMessage = vi.fn();
const mockGetMe = vi.fn();

vi.mock("grammy", () => ({
  Bot: vi.fn().mockImplementation(() => ({
    api: {
      getMe: mockGetMe,
      sendMessage: mockSendMessage,
      deleteWebhook: vi.fn().mockResolvedValue(true),
      setWebhook: vi.fn().mockResolvedValue(true),
    },
    start: vi.fn(),
    stop: vi.fn(),
    use: vi.fn(),
    command: vi.fn(),
    handleUpdate: vi.fn(),
    callbackQuery: vi.fn(),
  })),
  session: vi.fn(() => vi.fn()),
}));

vi.mock("@grammyjs/conversations", () => ({
  conversations: vi.fn(() => vi.fn()),
  createConversation: vi.fn((_fn: unknown, _name: string) => vi.fn()),
}));

import {
  createNotificationPlugin,
  resolveChatId,
  validateDedupWindowByType,
} from "../notification-plugin.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createNotificationPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({ message_id: 1 });
  });

  it("returns plugin with name 'telegram'", () => {
    const plugin = createNotificationPlugin({ botToken: "tok", defaultChatId: "123" });
    expect(plugin.name).toBe("telegram");
  });

  it("isAvailable returns true when botToken is set", async () => {
    const plugin = createNotificationPlugin({ botToken: "tok", defaultChatId: "123" });
    expect(await plugin.isAvailable()).toBe(true);
  });

  it("isAvailable returns false when botToken is missing", async () => {
    const plugin = createNotificationPlugin({ defaultChatId: "123" });
    expect(await plugin.isAvailable()).toBe(false);
  });

  it("isAvailable returns false when botToken is empty string", async () => {
    const plugin = createNotificationPlugin({ botToken: "", defaultChatId: "123" });
    expect(await plugin.isAvailable()).toBe(false);
  });

  it("isAvailable returns false when config is undefined", async () => {
    const plugin = createNotificationPlugin(undefined);
    expect(await plugin.isAvailable()).toBe(false);
  });

  it("send formats Notification directly with event-specific details", async () => {
    const plugin = createNotificationPlugin({ botToken: "tok", defaultChatId: "12345" });
    await plugin.send({
      eventId: "notif-1",
      eventType: "agent.blocked",
      priority: "critical",
      title: "Agent Blocked",
      message: "Agent is blocked",
      metadata: { agentId: "agent-1", storyId: "story-5", reason: "CI failed" },
      timestamp: "2026-04-08T00:00:00.000Z",
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const [chatId, text, options] = mockSendMessage.mock.calls[0];
    expect(chatId).toBe("12345");
    // Should use direct formatting — NOT session.needs_input
    expect(text).toContain("Agent Blocked");
    expect(text).toContain("agent\\-1");
    expect(text).toContain("/status agent\\-1");
    expect(text).not.toContain("session.needs_input");
    // Must use MarkdownV2 parse mode
    expect(options?.parse_mode).toBe("MarkdownV2");
  });

  it("send includes /command suggestion in message", async () => {
    const plugin = createNotificationPlugin({ botToken: "tok", defaultChatId: "12345" });
    await plugin.send({
      eventId: "notif-2",
      eventType: "story.blocked",
      priority: "critical",
      title: "Story Blocked",
      message: "Story is blocked",
      metadata: { storyId: "story-10", reason: "dependency" },
      timestamp: "2026-04-08T00:00:00.000Z",
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const text = mockSendMessage.mock.calls[0][1];
    expect(text).toContain("/resume story\\-10");
  });

  it("send is no-op when botToken is missing", async () => {
    const plugin = createNotificationPlugin({ defaultChatId: "12345" });
    await plugin.send({
      eventId: "notif-3",
      eventType: "agent.blocked",
      priority: "critical",
      title: "Test",
      message: "Test",
      timestamp: "2026-04-08T00:00:00.000Z",
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("send catches and logs delivery errors", async () => {
    const plugin = createNotificationPlugin({ botToken: "tok", defaultChatId: "12345" });
    mockSendMessage.mockRejectedValueOnce(new Error("Network timeout"));

    // Should NOT throw
    await plugin.send({
      eventId: "notif-4",
      eventType: "agent.blocked",
      priority: "critical",
      title: "Test",
      message: "Test",
      timestamp: "2026-04-08T00:00:00.000Z",
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  // --- Story 57.3: Preference filtering ---

  it("send suppresses notification when severity filter rejects it", async () => {
    const plugin = createNotificationPlugin({
      botToken: "tok",
      defaultChatId: "12345",
      preferences: { severityFilter: "critical-only" },
    });
    await plugin.send({
      eventId: "notif-5",
      eventType: "agent.offline",
      priority: "warning",
      title: "Agent Offline",
      message: "Agent went offline",
      metadata: { agentId: "agent-7" },
      timestamp: "2026-04-08T00:00:00.000Z",
    });

    // Warning suppressed by critical-only filter
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("send allows notification when severity filter passes", async () => {
    const plugin = createNotificationPlugin({
      botToken: "tok",
      defaultChatId: "12345",
      preferences: { severityFilter: "critical-only" },
    });
    await plugin.send({
      eventId: "notif-6",
      eventType: "agent.blocked",
      priority: "critical",
      title: "Agent Blocked",
      message: "Agent is blocked",
      metadata: { agentId: "agent-1" },
      timestamp: "2026-04-08T00:00:00.000Z",
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it("send suppresses notification when event type is disabled", async () => {
    const plugin = createNotificationPlugin({
      botToken: "tok",
      defaultChatId: "12345",
      preferences: {
        eventTypes: { "agent.offline": false },
      },
    });
    await plugin.send({
      eventId: "notif-7",
      eventType: "agent.offline",
      priority: "warning",
      title: "Agent Offline",
      message: "Agent went offline",
      metadata: { agentId: "agent-7" },
      timestamp: "2026-04-08T00:00:00.000Z",
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("send allows notification when no preferences configured (backward compat)", async () => {
    const plugin = createNotificationPlugin({ botToken: "tok", defaultChatId: "12345" });
    await plugin.send({
      eventId: "notif-8",
      eventType: "agent.blocked",
      priority: "critical",
      title: "Agent Blocked",
      message: "Agent is blocked",
      metadata: { agentId: "agent-1" },
      timestamp: "2026-04-08T00:00:00.000Z",
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  // --- Story 57.4: Multi-channel configuration ---

  it("send routes to project-specific chat ID via projectChatMapping", async () => {
    const plugin = createNotificationPlugin({
      botToken: "tok",
      defaultChatId: "12345",
      projectChatMapping: { "my-app": "99999" },
    });
    await plugin.send({
      eventId: "notif-9",
      eventType: "agent.blocked",
      priority: "critical",
      title: "Agent Blocked",
      message: "Agent is blocked",
      metadata: { agentId: "agent-1", projectId: "my-app" },
      timestamp: "2026-04-08T00:00:00.000Z",
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][0]).toBe("99999");
  });

  it("send falls back to defaultChatId for unmapped projects", async () => {
    const plugin = createNotificationPlugin({
      botToken: "tok",
      defaultChatId: "12345",
      projectChatMapping: { "my-app": "99999" },
    });
    await plugin.send({
      eventId: "notif-10",
      eventType: "agent.blocked",
      priority: "critical",
      title: "Agent Blocked",
      message: "Agent is blocked",
      metadata: { agentId: "agent-1", projectId: "other-project" },
      timestamp: "2026-04-08T00:00:00.000Z",
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][0]).toBe("12345");
  });

  it("send falls back to defaultChatId when mapped chat ID not in allowedChatIds", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const plugin = createNotificationPlugin({
      botToken: "tok",
      defaultChatId: "12345",
      allowedChatIds: [12345],
      projectChatMapping: { "my-app": "99999" },
    });
    await plugin.send({
      eventId: "notif-11",
      eventType: "agent.blocked",
      priority: "critical",
      title: "Agent Blocked",
      message: "Agent is blocked",
      metadata: { agentId: "agent-1", projectId: "my-app" },
      timestamp: "2026-04-08T00:00:00.000Z",
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][0]).toBe("12345");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not in allowedChatIds"));
    warnSpy.mockRestore();
  });

  it("send uses defaultChatId for all when no projectChatMapping configured", async () => {
    const plugin = createNotificationPlugin({ botToken: "tok", defaultChatId: "12345" });
    await plugin.send({
      eventId: "notif-12",
      eventType: "agent.blocked",
      priority: "critical",
      title: "Agent Blocked",
      message: "Agent is blocked",
      metadata: { agentId: "agent-1", projectId: "my-app" },
      timestamp: "2026-04-08T00:00:00.000Z",
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][0]).toBe("12345");
  });

  it("send combines preference filtering with project chat routing", async () => {
    const plugin = createNotificationPlugin({
      botToken: "tok",
      defaultChatId: "12345",
      preferences: { severityFilter: "critical-only" },
      projectChatMapping: { "my-app": "99999" },
    });
    // Critical + mapped project → routed to project channel
    await plugin.send({
      eventId: "notif-13",
      eventType: "agent.blocked",
      priority: "critical",
      title: "Agent Blocked",
      message: "Agent is blocked",
      metadata: { agentId: "agent-1", projectId: "my-app" },
      timestamp: "2026-04-08T00:00:00.000Z",
    });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][0]).toBe("99999");

    mockSendMessage.mockClear();

    // Warning + mapped project → suppressed by critical-only filter, never routed
    await plugin.send({
      eventId: "notif-14",
      eventType: "agent.offline",
      priority: "warning",
      title: "Agent Offline",
      message: "Agent went offline",
      metadata: { agentId: "agent-1", projectId: "my-app" },
      timestamp: "2026-04-08T00:00:00.000Z",
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("send logs debug when routed to project-specific chat ID", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const plugin = createNotificationPlugin({
      botToken: "tok",
      defaultChatId: "12345",
      projectChatMapping: { "my-app": "99999" },
    });
    await plugin.send({
      eventId: "notif-15",
      eventType: "agent.blocked",
      priority: "critical",
      title: "Agent Blocked",
      message: "Agent is blocked",
      metadata: { agentId: "agent-1", projectId: "my-app" },
      timestamp: "2026-04-08T00:00:00.000Z",
    });
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining("routed to project chat ID 99999"),
    );
    debugSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// resolveChatId unit tests
// ---------------------------------------------------------------------------

describe("resolveChatId", () => {
  const defaultChatId = "12345";

  it("returns mapped chat ID when projectId matches", () => {
    const notification = {
      metadata: { projectId: "my-app" },
    } as any;
    const mapping = { "my-app": "99999" };
    expect(resolveChatId(notification, defaultChatId, mapping)).toBe("99999");
  });

  it("returns defaultChatId when no mapping configured", () => {
    const notification = {
      metadata: { projectId: "my-app" },
    } as any;
    expect(resolveChatId(notification, defaultChatId, undefined)).toBe(defaultChatId);
  });

  it("returns defaultChatId when projectId not in mapping", () => {
    const notification = {
      metadata: { projectId: "unknown-project" },
    } as any;
    const mapping = { "my-app": "99999" };
    expect(resolveChatId(notification, defaultChatId, mapping)).toBe(defaultChatId);
  });

  it("returns defaultChatId when notification has no metadata", () => {
    const notification = {} as any;
    const mapping = { "my-app": "99999" };
    expect(resolveChatId(notification, defaultChatId, mapping)).toBe(defaultChatId);
  });

  it("returns defaultChatId when notification metadata has no projectId", () => {
    const notification = { metadata: { agentId: "agent-1" } } as any;
    const mapping = { "my-app": "99999" };
    expect(resolveChatId(notification, defaultChatId, mapping)).toBe(defaultChatId);
  });

  it("falls back to defaultChatId when mapped chat ID not in allowedChatIds", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const notification = {
      metadata: { projectId: "my-app" },
    } as any;
    const mapping = { "my-app": "99999" };
    const allowed = [12345, "67890"];
    expect(resolveChatId(notification, defaultChatId, mapping, allowed)).toBe(defaultChatId);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not in allowedChatIds"));
    warnSpy.mockRestore();
  });

  it("returns mapped chat ID when it IS in allowedChatIds", () => {
    const notification = {
      metadata: { projectId: "my-app" },
    } as any;
    const mapping = { "my-app": "99999" };
    const allowed = [12345, "99999"];
    expect(resolveChatId(notification, defaultChatId, mapping, allowed)).toBe("99999");
  });

  it("returns mapped chat ID when allowedChatIds is empty array", () => {
    const notification = {
      metadata: { projectId: "my-app" },
    } as any;
    const mapping = { "my-app": "99999" };
    expect(resolveChatId(notification, defaultChatId, mapping, [])).toBe("99999");
  });

  it("returns defaultChatId when projectId is not a string", () => {
    const notification = { metadata: { projectId: 123 } } as any;
    const mapping = { "123": "99999" };
    expect(resolveChatId(notification, defaultChatId, mapping)).toBe(defaultChatId);
  });

  it("returns defaultChatId when projectId is empty string", () => {
    const notification = { metadata: { projectId: "" } } as any;
    const mapping = { "": "99999" };
    expect(resolveChatId(notification, defaultChatId, mapping)).toBe(defaultChatId);
  });

  it("returns defaultChatId when projectId matches Object prototype property", () => {
    const notification = { metadata: { projectId: "constructor" } } as any;
    const mapping = { "my-app": "99999" };
    // "constructor" is inherited from Object.prototype, not an own property
    expect(resolveChatId(notification, defaultChatId, mapping)).toBe(defaultChatId);
  });
});

// ---------------------------------------------------------------------------
// Inline keyboard buttons in send() (Story 57.11)
// ---------------------------------------------------------------------------

describe("createNotificationPlugin send with inline buttons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({ message_id: 1 });
  });

  it("sends inline keyboard for agent.blocked events", async () => {
    const plugin = createNotificationPlugin({
      botToken: "test-token",
      defaultChatId: "12345",
      dashboardBaseUrl: "http://localhost:3000",
    });

    await plugin.send({
      eventId: "evt-1",
      eventType: "agent.blocked",
      priority: "critical",
      title: "Agent Blocked",
      message: "Agent is blocked",
      metadata: { agentId: "agent-1" },
      timestamp: new Date().toISOString(),
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const call = mockSendMessage.mock.calls[0];
    const opts = call[2] as Record<string, unknown>;
    expect(opts.reply_markup).toBeDefined();
    const replyMarkup = opts.reply_markup as {
      inline_keyboard: Array<Array<Record<string, unknown>>>;
    };
    expect(replyMarkup.inline_keyboard.length).toBe(1);
    expect(replyMarkup.inline_keyboard[0].length).toBe(3);
    expect(replyMarkup.inline_keyboard[0][0].text).toBe("Resume");
  });

  it("sends plain message for non-actionable events", async () => {
    const plugin = createNotificationPlugin({
      botToken: "test-token",
      defaultChatId: "12345",
    });

    await plugin.send({
      eventId: "evt-2",
      eventType: "eventbus.backlog",
      priority: "critical",
      title: "Backlog Event",
      message: "Something happened",
      metadata: {},
      timestamp: new Date().toISOString(),
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const call = mockSendMessage.mock.calls[0];
    const opts = call[2] as Record<string, unknown>;
    expect(opts.reply_markup).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// approval.requested event handling (Story 57.12)
// ---------------------------------------------------------------------------

describe("createNotificationPlugin approval.requested", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({ message_id: 1 });
  });

  it("sends approval message with Approve/Deny buttons for approval.requested", async () => {
    const plugin = createNotificationPlugin({
      botToken: "tok",
      defaultChatId: "12345",
    });

    await plugin.send({
      eventId: "approval-evt-1",
      eventType: "approval.requested",
      priority: "critical",
      title: "Approval Needed",
      message: "Spawn agent",
      metadata: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        action: "spawn",
        target: "agent-1",
        requestedBy: "autopilot",
        requestedAt: "2026-04-10T12:00:00.000Z",
      },
      timestamp: "2026-04-10T12:00:00.000Z",
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const call = mockSendMessage.mock.calls[0];
    expect(call[0]).toBe("12345");
    const text = call[1] as string;
    expect(text).toContain("Approval Request");
    const opts = call[2] as Record<string, unknown>;
    expect(opts.parse_mode).toBe("MarkdownV2");
    const replyMarkup = opts.reply_markup as {
      inline_keyboard: Array<Array<Record<string, unknown>>>;
    };
    expect(replyMarkup.inline_keyboard).toBeDefined();
    expect(replyMarkup.inline_keyboard[0]).toHaveLength(2);
    expect(replyMarkup.inline_keyboard[0][0].text).toBe("Approve");
    expect(replyMarkup.inline_keyboard[0][1].text).toBe("Deny");
  });

  it("falls back to generic message when approval metadata has no id", async () => {
    const plugin = createNotificationPlugin({
      botToken: "tok",
      defaultChatId: "12345",
    });

    await plugin.send({
      eventId: "approval-evt-2",
      eventType: "approval.requested",
      priority: "critical",
      title: "Approval Needed",
      message: "Spawn agent",
      metadata: {
        // no id field
        action: "spawn",
        target: "agent-1",
      },
      timestamp: "2026-04-10T12:00:00.000Z",
    });

    // Should fall through to regular notification path
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const call = mockSendMessage.mock.calls[0];
    const text = call[1] as string;
    expect(text).not.toContain("Approval Request");
  });
});

// ---------------------------------------------------------------------------
// Story quick-action buttons in send() (Story 57.13)
// ---------------------------------------------------------------------------

describe("createNotificationPlugin story quick-action buttons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({ message_id: 1 });
  });

  it("appends story action buttons for story.blocked events", async () => {
    const plugin = createNotificationPlugin({
      botToken: "test-token",
      defaultChatId: "12345",
    });

    await plugin.send({
      eventId: "story-evt-1",
      eventType: "story.blocked",
      priority: "critical",
      title: "Story Blocked",
      message: "Story is blocked",
      metadata: { storyId: "49-1-portfolio-dashboard", projectId: "agent-orchestrator" },
      timestamp: new Date().toISOString(),
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const call = mockSendMessage.mock.calls[0];
    const opts = call[2] as Record<string, unknown>;
    expect(opts.reply_markup).toBeDefined();
    const replyMarkup = opts.reply_markup as {
      inline_keyboard: Array<Array<Record<string, unknown>>>;
    };
    // First row: Dismiss button (from buildNotificationButtons for story.blocked)
    // Second row: Unblock, Priority, Assign (from buildStoryActionButtons with isBlocked=true)
    expect(replyMarkup.inline_keyboard.length).toBe(2);
    const storyRow = replyMarkup.inline_keyboard[1];
    expect(storyRow.length).toBe(3);
    expect(storyRow[0].text).toBe("Unblock");
    expect(storyRow[1].text).toBe("Priority");
    expect(storyRow[2].text).toBe("Assign");
  });

  it("appends story action buttons for story.started events", async () => {
    const plugin = createNotificationPlugin({
      botToken: "test-token",
      defaultChatId: "12345",
    });

    await plugin.send({
      eventId: "story-evt-2",
      eventType: "story.started",
      priority: "critical",
      title: "Story Started",
      message: "Work has begun",
      metadata: { storyId: "50-1-shared-pool", projectId: "agent-orchestrator" },
      timestamp: new Date().toISOString(),
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const call = mockSendMessage.mock.calls[0];
    const opts = call[2] as Record<string, unknown>;
    const replyMarkup = opts.reply_markup as {
      inline_keyboard: Array<Array<Record<string, unknown>>>;
    };
    // story.started has no buildNotificationButtons row, so story buttons are the only row
    expect(replyMarkup.inline_keyboard.length).toBe(1);
    expect(replyMarkup.inline_keyboard[0][0].text).toBe("Block");
    expect(replyMarkup.inline_keyboard[0][1].text).toBe("Priority");
    expect(replyMarkup.inline_keyboard[0][2].text).toBe("Assign");
  });

  it("does not append story buttons for non-story events", async () => {
    const plugin = createNotificationPlugin({
      botToken: "test-token",
      defaultChatId: "12345",
      dashboardBaseUrl: "http://localhost:3000",
    });

    await plugin.send({
      eventId: "agent-evt-1",
      eventType: "agent.blocked",
      priority: "critical",
      title: "Agent Blocked",
      message: "Agent is blocked",
      metadata: { agentId: "agent-1" },
      timestamp: new Date().toISOString(),
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const call = mockSendMessage.mock.calls[0];
    const opts = call[2] as Record<string, unknown>;
    const replyMarkup = opts.reply_markup as {
      inline_keyboard: Array<Array<Record<string, unknown>>>;
    };
    // Only agent.blocked buttons (Resume, View Details, Dismiss) — no story row
    expect(replyMarkup.inline_keyboard.length).toBe(1);
    expect(replyMarkup.inline_keyboard[0][0].text).toBe("Resume");
  });

  it("skips story buttons when storyId is missing", async () => {
    const plugin = createNotificationPlugin({
      botToken: "test-token",
      defaultChatId: "12345",
    });

    await plugin.send({
      eventId: "story-evt-3",
      eventType: "story.blocked",
      priority: "critical",
      title: "Story Blocked",
      message: "Story is blocked",
      metadata: { projectId: "agent-orchestrator" },
      // no storyId
      timestamp: new Date().toISOString(),
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const call = mockSendMessage.mock.calls[0];
    const opts = call[2] as Record<string, unknown>;
    const replyMarkup = opts.reply_markup as {
      inline_keyboard: Array<Array<Record<string, unknown>>>;
    };
    // Only the Dismiss row from buildNotificationButtons — no story action row
    expect(replyMarkup.inline_keyboard.length).toBe(1);
    expect(replyMarkup.inline_keyboard[0][0].text).toBe("Dismiss");
  });

  it("includes View URL button when dashboardBaseUrl is configured", async () => {
    const plugin = createNotificationPlugin({
      botToken: "test-token",
      defaultChatId: "12345",
      dashboardBaseUrl: "http://dashboard.example.com",
    });

    await plugin.send({
      eventId: "story-evt-4",
      eventType: "story.started",
      priority: "critical",
      title: "Story Started",
      message: "Work has begun",
      metadata: { storyId: "49-1-portfolio", projectId: "agent-orchestrator" },
      timestamp: new Date().toISOString(),
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const call = mockSendMessage.mock.calls[0];
    const opts = call[2] as Record<string, unknown>;
    const replyMarkup = opts.reply_markup as {
      inline_keyboard: Array<Array<Record<string, unknown>>>;
    };
    const storyRow = replyMarkup.inline_keyboard[0];
    // Block, Priority, Assign, View
    expect(storyRow.length).toBe(4);
    expect(storyRow[3].text).toBe("View");
    expect(storyRow[3].url).toContain("/stories/49-1-portfolio");
  });
});

// ---------------------------------------------------------------------------
// validateDedupWindowByType (Story 57.15)
// ---------------------------------------------------------------------------

describe("validateDedupWindowByType", () => {
  it("accepts valid positive integers", () => {
    const result = validateDedupWindowByType({
      "agent.blocked": 300000,
      "conflict.detected": 600000,
    });
    expect(result).toEqual({
      "agent.blocked": 300000,
      "conflict.detected": 600000,
    });
  });

  it("skips invalid values (negative, zero) with warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = validateDedupWindowByType({
      "agent.blocked": 300000,
      "story.blocked": -100,
      "conflict.detected": 0,
    });
    expect(result).toEqual({ "agent.blocked": 300000 });
    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it("returns undefined for empty input", () => {
    expect(validateDedupWindowByType()).toBeUndefined();
    expect(validateDedupWindowByType({})).toBeUndefined();
  });

  it("returns undefined when all entries are invalid", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = validateDedupWindowByType({
      a: -1,
      b: 0,
    });
    expect(result).toBeUndefined();
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// dedupWindowByType wiring integration (Story 57.15 code review)
// Validates that the output is compatible with NotificationServiceConfig.dedupWindowByType
// ---------------------------------------------------------------------------

describe("dedupWindowByType wiring integration", () => {
  it("produces Record<string, number> compatible with NotificationServiceConfig", () => {
    const result = validateDedupWindowByType({
      "agent.blocked": 300000,
      "conflict.detected": 600000,
      "dependency.blocking": 1800000,
    });

    // Verify structure matches what NotificationServiceConfig.dedupWindowByType expects
    expect(result).toBeDefined();
    expect(typeof result!["agent.blocked"]).toBe("number");
    expect(typeof result!["conflict.detected"]).toBe("number");
    expect(typeof result!["dependency.blocking"]).toBe("number");
  });

  it("filters out invalid entries so only safe values reach NotificationService", () => {
    const result = validateDedupWindowByType({
      "agent.blocked": 300000,
      "bad.negative": -100,
      "bad.zero": 0,
    });

    // Only valid entries pass through — ensures NotificationService won't get bad windows
    expect(Object.keys(result!)).toEqual(["agent.blocked"]);
    expect(result!["agent.blocked"]).toBe(300000);
  });
});
