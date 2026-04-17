/**
 * Tests for Telegram notifier plugin — Notifier interface methods.
 * Story 57.1 Task 8.1.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSendMessage = vi.fn();
const mockGetMe = vi.fn();
const mockDeleteWebhook = vi.fn();
const mockBotStart = vi.fn();
const mockBotStop = vi.fn();
const mockBotUse = vi.fn();
const mockBotCommand = vi.fn();
const mockHandleUpdate = vi.fn();
const mockSetWebhook = vi.fn();

vi.mock("grammy", () => ({
  Bot: vi.fn().mockImplementation(() => ({
    api: {
      getMe: mockGetMe,
      sendMessage: mockSendMessage,
      deleteWebhook: mockDeleteWebhook,
      setWebhook: mockSetWebhook,
    },
    start: mockBotStart,
    stop: mockBotStop,
    use: mockBotUse,
    command: mockBotCommand,
    handleUpdate: mockHandleUpdate,
  })),
  session: vi.fn(() => vi.fn()),
}));

vi.mock("@grammyjs/conversations", () => ({
  conversations: vi.fn(() => vi.fn()),
  createConversation: vi.fn((_fn: unknown, _name: string) => vi.fn()),
}));

// Import after mocks
import { create } from "../index.js";
import type { OrchestratorEvent, NotifyAction } from "@composio/ao-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<OrchestratorEvent> = {}): OrchestratorEvent {
  return {
    id: "evt-1",
    type: "session.spawned",
    priority: "urgent",
    sessionId: "agent-1",
    projectId: "project-a",
    timestamp: new Date("2026-04-08"),
    message: "Agent blocked on dependency",
    data: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("notifier-telegram create()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({});
  });

  it("returns a notifier with name 'telegram'", () => {
    const notifier = create({ botToken: "tok", defaultChatId: "123" });
    expect(notifier.name).toBe("telegram");
  });

  it("warns when botToken is not configured", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    create({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("No botToken"));
    warnSpy.mockRestore();
  });

  it("warns when defaultChatId is not configured", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    create({ botToken: "tok" });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("defaultChatId"));
    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // notify() (Task 6)
  // -------------------------------------------------------------------------

  describe("notify", () => {
    it("sends formatted message via sendMessage", async () => {
      const notifier = create({ botToken: "tok", defaultChatId: "12345" });
      await notifier.notify(makeEvent());

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      const [chatId, text, opts] = mockSendMessage.mock.calls[0];
      expect(chatId).toBe("12345");
      expect(text).toContain("session\\.spawned");
      expect(opts).toHaveProperty("parse_mode", "MarkdownV2");
    });

    it("is no-op when botToken is missing", async () => {
      const notifier = create({ defaultChatId: "12345" });
      await notifier.notify(makeEvent());
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("is no-op when defaultChatId is missing", async () => {
      const notifier = create({ botToken: "tok" });
      await notifier.notify(makeEvent());
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // notifyWithActions() (Task 6)
  // -------------------------------------------------------------------------

  describe("notifyWithActions", () => {
    it("sends message with inline keyboard", async () => {
      const notifier = create({ botToken: "tok", defaultChatId: "12345" });
      const actions: NotifyAction[] = [
        { label: "Resume", url: "https://example.com/resume" },
        { label: "View", callbackEndpoint: "/api/story/1" },
      ];

      await notifier.notifyWithActions!(makeEvent(), actions);

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      const call = mockSendMessage.mock.calls[0];
      const opts = call[2] as Record<string, unknown>;
      expect(opts).toHaveProperty("parse_mode", "MarkdownV2");
      expect(opts).toHaveProperty("reply_markup");
      const replyMarkup = opts.reply_markup as { inline_keyboard: unknown[][] };
      expect(replyMarkup.inline_keyboard).toHaveLength(2);
    });

    it("is no-op when botToken is missing", async () => {
      const notifier = create({});
      await notifier.notifyWithActions!(makeEvent(), []);
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // post() (Task 6)
  // -------------------------------------------------------------------------

  describe("post", () => {
    it("sends plain text message to default chat and returns message ID", async () => {
      mockSendMessage.mockResolvedValue({ message_id: 42 });
      const notifier = create({ botToken: "tok", defaultChatId: "12345" });
      const result = await notifier.post!("Hello world");
      expect(result).toBe("42");
      expect(mockSendMessage).toHaveBeenCalledWith("12345", "Hello world", expect.any(Object));
    });

    it("sends to context channel when provided", async () => {
      const notifier = create({ botToken: "tok", defaultChatId: "12345" });
      await notifier.post!("Hello", { channel: "99999" });
      expect(mockSendMessage).toHaveBeenCalledWith("99999", "Hello", expect.any(Object));
    });

    it("returns null when botToken is missing", async () => {
      const notifier = create({});
      const result = await notifier.post!("Hello");
      expect(result).toBeNull();
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Rate limit handling (Task 6)
  // -------------------------------------------------------------------------

  describe("rate limit handling", () => {
    it("retries on 429 error with retry_after", async () => {
      const rateLimitError = Object.assign(new Error("Too Many Requests"), {
        parameters: { retry_after: 0 },
      });
      mockSendMessage.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce({});

      const notifier = create({ botToken: "tok", defaultChatId: "12345" });
      await notifier.notify(makeEvent());

      // First call fails, second succeeds
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
    });

    it("throws on non-rate-limit errors", async () => {
      mockSendMessage.mockRejectedValue(new Error("Bad Request"));

      const notifier = create({ botToken: "tok", defaultChatId: "12345" });
      await expect(notifier.notify(makeEvent())).rejects.toThrow("Bad Request");
    });
  });
});
