/**
 * Telegram notifier plugin — manifest + create() + default export.
 *
 * Follows notifier-webhook pattern exactly.
 * Implements the Notifier interface (legacy slot 6) using grammY.
 * Story 57.1 Tasks 1, 6.
 */

import {
  type PluginModule,
  type Notifier,
  type OrchestratorEvent,
  type NotifyAction,
  type NotifyContext,
} from "@composio/ao-core";
import { TelegramBot } from "./telegram-bot.js";
import { escapeMarkdownV2 } from "./markdown-escape.js";
import { sendWithRetry } from "./send-helpers.js";

export const manifest = {
  name: "telegram",
  slot: "notifier" as const,
  description: "Notifier plugin: Telegram bot integration",
  version: "0.1.0",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map OrchestratorEvent priority to Telegram-appropriate emoji prefix. */
function priorityEmoji(priority: string): string {
  switch (priority) {
    case "urgent":
      return "\u{1f534}"; // red circle
    case "action":
      return "\u{1f7e1}"; // yellow circle
    case "warning":
      return "\u{1f7e2}"; // green circle
    default:
      return "\u2139\ufe0f"; // info
  }
}

/** Format an OrchestratorEvent as a Telegram MarkdownV2 message. */
function formatEventMessage(event: OrchestratorEvent): string {
  const emoji = priorityEmoji(event.priority);
  const lines = [
    `${emoji} *${escapeMarkdownV2(event.type)}*`,
    `*Priority:* ${escapeMarkdownV2(event.priority)}`,
    `*Project:* ${escapeMarkdownV2(event.projectId)}`,
    `*Agent:* ${escapeMarkdownV2(event.sessionId)}`,
    "",
    escapeMarkdownV2(event.message),
  ];
  return lines.join("\n");
}

/**
 * Send a Telegram message with retry on rate limits (429).
 * Extracts retry_after from the error and backs off.
 * @see send-helpers.ts
 */

// ---------------------------------------------------------------------------
// create() — Notifier factory (Task 1 + Task 6)
// ---------------------------------------------------------------------------

export function create(config?: Record<string, unknown>): Notifier {
  const botToken = config?.botToken as string | undefined;
  const defaultChatId = config?.defaultChatId as string | undefined;
  const allowedChatIds = config?.allowedChatIds as Array<number | string> | undefined;
  const mode = config?.mode as "polling" | "webhook" | undefined;
  const webhookUrl = config?.webhookUrl as string | undefined;
  const webhookSecret = config?.webhookSecret as string | undefined;

  // Lazy-initialized bot — created on first use
  let bot: TelegramBot | null = null;

  function getBot(): TelegramBot | null {
    if (!botToken) {
      return null;
    }
    if (!bot) {
      bot = new TelegramBot({
        botToken,
        defaultChatId,
        allowedChatIds,
        mode,
        webhookUrl,
        webhookSecret,
      });
    }
    return bot;
  }

  if (!botToken) {
    // eslint-disable-next-line no-console -- notifier plugin: console is the only fallback when the notification layer itself cannot initialize
    console.warn("[notifier-telegram] No botToken configured — notifications will be no-ops");
  }

  if (!defaultChatId) {
    // eslint-disable-next-line no-console -- notifier plugin
    console.warn(
      "[notifier-telegram] No defaultChatId configured — specify a target chat for notifications",
    );
  }

  return {
    name: "telegram",

    async notify(event: OrchestratorEvent): Promise<void> {
      const telegramBot = getBot();
      if (!telegramBot || !defaultChatId) return;

      const text = formatEventMessage(event);
      await sendWithRetry(telegramBot, defaultChatId, text, {
        parse_mode: "MarkdownV2",
      });
    },

    async notifyWithActions(event: OrchestratorEvent, actions: NotifyAction[]): Promise<void> {
      const telegramBot = getBot();
      if (!telegramBot || !defaultChatId) return;

      const text = formatEventMessage(event);
      const replyMarkup = {
        inline_keyboard: actions.map((a) => [
          {
            text: a.label,
            ...(a.url ? { url: a.url } : {}),
            ...(a.callbackEndpoint && a.callbackEndpoint.length <= 64
              ? { callback_data: a.callbackEndpoint }
              : {}),
          },
        ]),
      };
      await sendWithRetry(telegramBot, defaultChatId, text, {
        parse_mode: "MarkdownV2",
        reply_markup: replyMarkup,
      });
    },

    async post(message: string, context?: NotifyContext): Promise<string | null> {
      const telegramBot = getBot();
      if (!telegramBot || !defaultChatId) return null;

      const targetChatId = (context?.channel as string) || defaultChatId;
      const result = await sendWithRetry(telegramBot, targetChatId, message);
      return result?.message_id !== undefined && result?.message_id !== null
        ? String(result.message_id)
        : null;
    },
  };
}

export { createNotificationPlugin, validateDedupWindowByType } from "./notification-plugin.js";
export type { TelegramNotificationPluginConfig } from "./notification-plugin.js";
export { sendWithRetry } from "./send-helpers.js";
export {
  TelegramBot,
  formatStatusMessage,
  formatFleetMessage,
  formatSprintMessage,
  formatHealthMessage,
  formatConflictsMessage,
  parseProjectArg,
  encodeCallbackData,
  decodeCallbackData,
  buildNotificationButtons,
  buildApprovalButtons,
  formatApprovalMessage,
  buildStoryActionButtons,
  formatStoryActionMessage,
} from "./telegram-bot.js";
export type {
  TelegramBotConfig,
  TokenValidationResult,
  SystemStatus,
  StatusProvider,
  FleetAgent,
  FleetProvider,
  SprintEntry,
  SprintProvider,
  HealthCheckEntry,
  HealthCheckResult,
  HealthProvider,
  ConflictEntry,
  ConflictsProvider,
  CallbackAction,
  CallbackData,
  CallbackUserInfo,
  ApprovalMessageRequest,
  ProjectListProvider as TelegramProjectListProvider,
  AgentListProvider,
} from "./telegram-bot.js";
export {
  type BotContext,
  type BotConversation,
  ConversationTimeoutError,
  checkTimeout,
  conversationAsk,
  conversationAskWithButtons,
  formatExpiredMessage,
  formatCancelledMessage,
  CONVERSATION_TIMEOUT_MS,
} from "./conversation-helpers.js";
// Note: Conversation types require @grammyjs/conversations and grammy as
// peer deps. Only import these if you are wiring up conversation commands.

export default { manifest, create } satisfies PluginModule<Notifier>;
