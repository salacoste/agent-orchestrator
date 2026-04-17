/**
 * Conversation helper utilities for multi-step Telegram interactions.
 * Story 57.14 Tasks 2, 5.
 */

import type { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import type { Context } from "grammy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Context type that includes conversation flavor. */
export type BotContext = ConversationFlavor<Context>;

/** Conversation function type for registered conversations. */
export type BotConversation = Conversation<BotContext, BotContext>;

/** Error thrown when a conversation times out due to inactivity. */
export class ConversationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Conversation expired after ${Math.round(timeoutMs / 1000)}s of inactivity`);
    this.name = "ConversationTimeoutError";
  }
}

// ---------------------------------------------------------------------------
// Default timeout
// ---------------------------------------------------------------------------

/** 5 minutes in milliseconds (AC #3). */
export const CONVERSATION_TIMEOUT_MS = 300_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wrap a conversation step with inactivity timeout checking.
 * Call before each `conversation.wait()` to enforce AC #3.
 *
 * @param lastActivity Timestamp of last user interaction.
 * @param timeoutMs Maximum allowed inactivity (default 5 minutes).
 * @throws {ConversationTimeoutError} When elapsed time exceeds timeout.
 */
export function checkTimeout(
  lastActivity: number,
  timeoutMs: number = CONVERSATION_TIMEOUT_MS,
): void {
  if (Date.now() - lastActivity > timeoutMs) {
    throw new ConversationTimeoutError(timeoutMs);
  }
}

/**
 * Send a question and wait for a text reply via conversation.wait().
 * Returns the user's text response, or undefined if no text.
 * Story 57.14 Task 2.3.
 */
export async function conversationAsk(
  conversation: BotConversation,
  ctx: BotContext,
  question: string,
): Promise<string | undefined> {
  await ctx.reply(question);
  const response = await conversation.wait();
  return response.msg?.text;
}

/**
 * Send a question with inline buttons and wait for a callback query.
 * Returns the callback data string from the pressed button.
 * Story 57.14 Task 2.4.
 *
 * @param conversation The grammY conversation instance.
 * @param ctx The grammY context.
 * @param question The question text to send.
 * @param buttons Inline keyboard buttons to display.
 * @param callbackFilter Regex or string filter for waitForCallbackQuery. Defaults to `/^agent:/`.
 */
export async function conversationAskWithButtons(
  conversation: BotConversation,
  ctx: BotContext,
  question: string,
  buttons: Array<Array<{ text: string; callback_data: string }>>,
  callbackFilter: RegExp | string = /^agent:/,
): Promise<string> {
  await ctx.reply(question, {
    reply_markup: { inline_keyboard: buttons },
  });
  const response = await conversation.waitForCallbackQuery(callbackFilter);
  return response.callbackQuery.data ?? "";
}

/**
 * Format an expiry message for timed-out conversations.
 * Story 57.14 AC #3.
 */
export function formatExpiredMessage(): string {
  return (
    `\u23F0 *Conversation expired*\n\n` +
    `Previous conversation expired due to inactivity\\.\n` +
    `Please start again\\.`
  );
}

/**
 * Format a cancellation message.
 * Story 57.14 AC #4.
 */
export function formatCancelledMessage(): string {
  return `\u274C Action cancelled\\.`;
}
