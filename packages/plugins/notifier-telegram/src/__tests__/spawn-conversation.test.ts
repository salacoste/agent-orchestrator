/**
 * Tests for the /spawn conversation flow.
 * Story 57.14 Task 4.
 *
 * Since spawnConversation is a module-level function that relies on grammY's
 * conversation replay mechanism, we test it indirectly through registerSpawnCommand
 * and verify the conversation function is registered correctly.
 * Full end-to-end conversation testing requires a running bot — covered by integration tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelegramBot } from "../telegram-bot.js";

// ---------------------------------------------------------------------------
// Mocks — same as telegram-bot.test.ts
// ---------------------------------------------------------------------------

const mockBotUse = vi.fn();
const mockBotCommand = vi.fn();

vi.mock("grammy", () => ({
  Bot: vi.fn().mockImplementation(() => ({
    api: { getMe: vi.fn(), sendMessage: vi.fn(), deleteWebhook: vi.fn(), setWebhook: vi.fn() },
    start: vi.fn(),
    stop: vi.fn(),
    use: mockBotUse,
    command: mockBotCommand,
    handleUpdate: vi.fn(),
    callbackQuery: vi.fn(),
  })),
  session: vi.fn(() => vi.fn()),
  Api: {},
  RawApi: {},
}));

vi.mock("@grammyjs/conversations", () => ({
  conversations: vi.fn(() => vi.fn()),
  createConversation: vi.fn((_fn: unknown, _name: string) => vi.fn()),
}));

describe("registerSpawnCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores project list provider", () => {
    const projectList = vi.fn(() => ["web-app", "api-service"]);
    const agentList = vi.fn(() => []);
    const bot = new TelegramBot({ botToken: "token" });
    bot.registerSpawnCommand(projectList, agentList);

    // The spawn command handler is registered
    expect(mockBotCommand).toHaveBeenCalledWith("spawn", expect.any(Function));
  });

  it("registers conversation via createConversation", () => {
    // createConversation is mocked — verify it was called by checking use() calls
    const bot = new TelegramBot({ botToken: "token" });
    mockBotUse.mockClear();
    bot.registerSpawnCommand(
      () => [],
      () => [],
    );
    expect(mockBotUse).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Conversation error handling — verify timeout path via formatExpiredMessage
// ---------------------------------------------------------------------------

describe("spawn conversation error paths", () => {
  it("formatExpiredMessage produces MarkdownV2-safe output", async () => {
    const { formatExpiredMessage } = await import("../conversation-helpers.js");
    const msg = formatExpiredMessage();
    // Must contain escaped periods for Telegram MarkdownV2
    expect(msg).toContain("\\.");
    expect(msg).toContain("expired");
  });

  it("formatCancelledMessage produces MarkdownV2-safe output", async () => {
    const { formatCancelledMessage } = await import("../conversation-helpers.js");
    const msg = formatCancelledMessage();
    expect(msg).toContain("\\.");
    expect(msg).toContain("cancelled");
  });

  it("ConversationTimeoutError is throwable and catchable", async () => {
    const { ConversationTimeoutError } = await import("../conversation-helpers.js");
    const err = new ConversationTimeoutError(300_000);
    expect(() => {
      throw err;
    }).toThrow(ConversationTimeoutError);
    expect(err.message).toContain("300");
  });
});
