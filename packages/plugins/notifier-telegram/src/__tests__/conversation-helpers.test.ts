/**
 * Tests for conversation helper utilities.
 * Story 57.14 Tasks 2, 5.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ConversationTimeoutError,
  CONVERSATION_TIMEOUT_MS,
  checkTimeout,
  conversationAsk,
  conversationAskWithButtons,
  formatExpiredMessage,
  formatCancelledMessage,
} from "../conversation-helpers.js";

// ---------------------------------------------------------------------------
// Constants & Error class
// ---------------------------------------------------------------------------

describe("CONVERSATION_TIMEOUT_MS", () => {
  it("is 5 minutes (300 000 ms)", () => {
    expect(CONVERSATION_TIMEOUT_MS).toBe(300_000);
  });
});

describe("ConversationTimeoutError", () => {
  it("extends Error", () => {
    const err = new ConversationTimeoutError(5_000);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ConversationTimeoutError");
  });

  it("includes timeout seconds in message", () => {
    const err = new ConversationTimeoutError(30_000);
    expect(err.message).toContain("30");
    expect(err.message).toContain("inactivity");
  });
});

// ---------------------------------------------------------------------------
// checkTimeout
// ---------------------------------------------------------------------------

describe("checkTimeout", () => {
  it("does not throw when elapsed time is within limit", () => {
    const recent = Date.now() - 1_000; // 1 second ago
    expect(() => checkTimeout(recent, 5_000)).not.toThrow();
  });

  it("throws ConversationTimeoutError when elapsed exceeds limit", () => {
    const old = Date.now() - 10_000; // 10 seconds ago
    expect(() => checkTimeout(old, 5_000)).toThrow(ConversationTimeoutError);
  });

  it("uses default 5-minute timeout when timeoutMs omitted", () => {
    const withinLimit = Date.now() - CONVERSATION_TIMEOUT_MS + 1_000;
    expect(() => checkTimeout(withinLimit)).not.toThrow();

    const exceeded = Date.now() - CONVERSATION_TIMEOUT_MS - 1_000;
    expect(() => checkTimeout(exceeded)).toThrow(ConversationTimeoutError);
  });

  it("does not throw at exact boundary (uses > not >=)", () => {
    const boundary = Date.now() - 5_000;
    expect(() => checkTimeout(boundary, 5_000)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// conversationAsk
// ---------------------------------------------------------------------------

describe("conversationAsk", () => {
  let mockConversation: { wait: ReturnType<typeof vi.fn> };
  let mockCtx: { reply: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockConversation = { wait: vi.fn() };
    mockCtx = { reply: vi.fn().mockResolvedValue(undefined) };
  });

  it("sends question and returns text response", async () => {
    mockConversation.wait.mockResolvedValue({ msg: { text: "yes" } });
    const result = await conversationAsk(mockConversation as never, mockCtx as never, "Continue?");
    expect(mockCtx.reply).toHaveBeenCalledWith("Continue?");
    expect(mockConversation.wait).toHaveBeenCalledTimes(1);
    expect(result).toBe("yes");
  });

  it("returns undefined when response has no text", async () => {
    mockConversation.wait.mockResolvedValue({ msg: {} });
    const result = await conversationAsk(mockConversation as never, mockCtx as never, "Question?");
    expect(result).toBeUndefined();
  });

  it("returns undefined when response has no msg", async () => {
    mockConversation.wait.mockResolvedValue({});
    const result = await conversationAsk(mockConversation as never, mockCtx as never, "Question?");
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// conversationAskWithButtons
// ---------------------------------------------------------------------------

describe("conversationAskWithButtons", () => {
  let mockConversation: { waitForCallbackQuery: ReturnType<typeof vi.fn> };
  let mockCtx: { reply: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockConversation = { waitForCallbackQuery: vi.fn() };
    mockCtx = { reply: vi.fn().mockResolvedValue(undefined) };
  });

  it("sends question with buttons and returns callback data", async () => {
    mockConversation.waitForCallbackQuery.mockResolvedValue({
      callbackQuery: { data: "agent:agent-1" },
    });
    const buttons = [[{ text: "Agent 1", callback_data: "agent:agent-1" }]];
    const result = await conversationAskWithButtons(
      mockConversation as never,
      mockCtx as never,
      "Select agent:",
      buttons,
    );
    expect(mockCtx.reply).toHaveBeenCalledWith("Select agent:", {
      reply_markup: { inline_keyboard: buttons },
    });
    expect(result).toBe("agent:agent-1");
  });

  it("returns empty string when callback data is null", async () => {
    mockConversation.waitForCallbackQuery.mockResolvedValue({
      callbackQuery: { data: null },
    });
    const result = await conversationAskWithButtons(
      mockConversation as never,
      mockCtx as never,
      "Pick:",
      [],
    );
    expect(result).toBe("");
  });

  it("uses default /^agent:/ filter when no callbackFilter provided", async () => {
    mockConversation.waitForCallbackQuery.mockResolvedValue({
      callbackQuery: { data: "agent:x" },
    });
    await conversationAskWithButtons(mockConversation as never, mockCtx as never, "Pick:", []);
    expect(mockConversation.waitForCallbackQuery).toHaveBeenCalledWith(/^agent:/);
  });

  it("passes custom callbackFilter to waitForCallbackQuery", async () => {
    mockConversation.waitForCallbackQuery.mockResolvedValue({
      callbackQuery: { data: "confirm:yes" },
    });
    const customFilter = /^confirm:/;
    await conversationAskWithButtons(
      mockConversation as never,
      mockCtx as never,
      "Confirm?",
      [[{ text: "Yes", callback_data: "confirm:yes" }]],
      customFilter,
    );
    expect(mockConversation.waitForCallbackQuery).toHaveBeenCalledWith(customFilter);
  });
});

// ---------------------------------------------------------------------------
// formatExpiredMessage
// ---------------------------------------------------------------------------

describe("formatExpiredMessage", () => {
  it("contains expiry notification", () => {
    const msg = formatExpiredMessage();
    expect(msg).toContain("expired");
    expect(msg).toContain("inactivity");
  });

  it("contains restart instruction", () => {
    const msg = formatExpiredMessage();
    expect(msg).toContain("start again");
  });

  it("escapes period for MarkdownV2", () => {
    const msg = formatExpiredMessage();
    expect(msg).toContain("\\.");
  });
});

// ---------------------------------------------------------------------------
// formatCancelledMessage
// ---------------------------------------------------------------------------

describe("formatCancelledMessage", () => {
  it("contains cancellation notice", () => {
    const msg = formatCancelledMessage();
    expect(msg).toContain("cancelled");
  });

  it("escapes period for MarkdownV2", () => {
    const msg = formatCancelledMessage();
    expect(msg).toContain("\\.");
  });
});
