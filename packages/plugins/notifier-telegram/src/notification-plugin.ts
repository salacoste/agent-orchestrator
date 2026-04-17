/**
 * NotificationPlugin adapter for the Telegram notifier.
 *
 * Formats Notification objects directly into event-specific Telegram messages
 * with /command suggestions, bypassing the lossy notificationToOrchestratorEvent
 * adapter that converts all event types to "session.needs_input".
 * Story 57.1 + 57.2 + 57.3 + 57.4.
 */

import { type NotificationPlugin, type Notification } from "@composio/ao-core";
import {
  TelegramBot,
  buildNotificationButtons,
  buildApprovalButtons,
  formatApprovalMessage,
  buildStoryActionButtons,
} from "./telegram-bot.js";
import { formatNotificationMessage } from "./event-formatter.js";
import { sendWithRetry } from "./send-helpers.js";
import {
  shouldSend,
  parsePreferences,
  type TelegramNotificationPreferences,
  type ShouldSendResult,
} from "./preferences.js";

export interface TelegramNotificationPluginConfig {
  botToken?: string;
  defaultChatId?: string;
  allowedChatIds?: Array<number | string>;
  mode?: "polling" | "webhook";
  webhookUrl?: string;
  webhookSecret?: string;
  /** Telegram-specific notification preferences (severity filter, quiet hours, event type overrides) */
  preferences?: Record<string, unknown>;
  /** Maps project IDs to specific Telegram chat IDs for multi-channel routing */
  projectChatMapping?: Record<string, string>;
  /** Base URL for dashboard deep links in notification buttons. */
  dashboardBaseUrl?: string;
  /** Per-event-type dedup windows (ms) — passed through to core NotificationServiceConfig */
  dedupWindowByType?: Record<string, number>;
}

/**
 * Validate and filter dedupWindowByType entries.
 * Returns a cleaned map with only positive integer values.
 * Logs warnings for invalid entries.
 */
export function validateDedupWindowByType(
  input?: Record<string, number>,
): Record<string, number> | undefined {
  if (!input) return undefined;
  const result: Record<string, number> = {};
  for (const [eventType, windowMs] of Object.entries(input)) {
    if (typeof windowMs !== "number" || !Number.isFinite(windowMs) || windowMs <= 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[notifier-telegram] Invalid dedupWindowByType value for "${eventType}": ${windowMs}. Skipping.`,
      );
      continue;
    }
    result[eventType] = windowMs;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Resolve the target chat ID for a notification based on project mapping.
 *
 * Logic:
 * 1. Extract projectId from notification.metadata?.projectId
 * 2. If no projectId → defaultChatId
 * 3. If no projectChatMapping configured → defaultChatId
 * 4. Look up projectChatMapping[projectId]
 * 5. If not found → defaultChatId
 * 6. If allowedChatIds configured AND mapped chat ID NOT in list → warn, defaultChatId
 * 7. Return mapped chat ID
 *
 * Story 57.4 Task 1.
 */
export function resolveChatId(
  notification: Notification,
  defaultChatId: string,
  projectChatMapping?: Record<string, string>,
  allowedChatIds?: Array<number | string>,
): string {
  const projectId = notification.metadata?.projectId;
  if (typeof projectId !== "string" || !projectId) return defaultChatId;

  if (!projectChatMapping) return defaultChatId;

  const mappedChatId = projectChatMapping[projectId];
  if (!mappedChatId || typeof mappedChatId !== "string") return defaultChatId;

  if (allowedChatIds && allowedChatIds.length > 0) {
    const isAllowed = allowedChatIds.some((id) => String(id) === String(mappedChatId));
    if (!isAllowed) {
      // eslint-disable-next-line no-console -- notifier plugin: warn about blocked routing
      console.warn(
        `[notifier-telegram] Mapped chat ID for project "${projectId}" not in allowedChatIds, using defaultChatId`,
      );
      return defaultChatId;
    }
  }

  return mappedChatId;
}

/**
 * Create a NotificationPlugin adapter for the Telegram notifier.
 * Uses event-specific formatting with /command suggestions instead of the
 * generic OrchestratorEvent adapter path.
 * Story 57.1 + 57.2 + 57.3 + 57.4.
 */
export function createNotificationPlugin(
  config?: TelegramNotificationPluginConfig,
): NotificationPlugin {
  const botToken = config?.botToken;
  const defaultChatId = config?.defaultChatId;

  // Parse preferences once at plugin creation time
  const prefs: TelegramNotificationPreferences = parsePreferences(
    config?.preferences as Record<string, unknown> | undefined,
  );

  if (!defaultChatId) {
    // eslint-disable-next-line no-console -- notifier plugin: warn about missing config
    console.warn(
      "[notifier-telegram] No defaultChatId configured — notification-plugin sends will be no-ops",
    );
  }

  // Lazy-initialized bot — created on first use
  let bot: TelegramBot | null = null;

  function getBot(): TelegramBot | null {
    if (!botToken) return null;
    if (!bot) {
      bot = new TelegramBot({
        botToken,
        defaultChatId,
        allowedChatIds: config?.allowedChatIds,
        mode: config?.mode,
        webhookUrl: config?.webhookUrl,
        webhookSecret: config?.webhookSecret,
      });
    }
    return bot;
  }

  return {
    name: "telegram",

    async send(notification: Notification): Promise<void> {
      const telegramBot = getBot();
      if (!telegramBot || !defaultChatId) return;

      // Check preferences — suppress if filtered out
      const result: ShouldSendResult = shouldSend(notification, prefs);
      if (!result.send) {
        // eslint-disable-next-line no-console -- notifier plugin: log suppression for ops visibility
        console.debug(
          `[notifier-telegram] Notification ${notification.eventId} suppressed: ${result.reason ?? "preference filter"}`,
        );
        return;
      }

      const text = formatNotificationMessage(notification);
      const chatId = resolveChatId(
        notification,
        defaultChatId,
        config?.projectChatMapping,
        config?.allowedChatIds,
      );
      const metadata = (notification.metadata as Record<string, unknown> | undefined) ?? {};

      // Handle approval.requested events with dedicated approval buttons.
      // Story 57.12 Task 6.
      if (notification.eventType === "approval.requested") {
        const approvalId = typeof metadata.id === "string" ? metadata.id : "";
        if (approvalId) {
          const approvalText = formatApprovalMessage({
            action: typeof metadata.action === "string" ? metadata.action : "unknown",
            target: typeof metadata.target === "string" ? metadata.target : "unknown",
            requestedBy:
              typeof metadata.requestedBy === "string" ? metadata.requestedBy : "unknown",
            requestedAt:
              typeof metadata.requestedAt === "string"
                ? metadata.requestedAt
                : new Date().toISOString(),
          });
          const approvalButtons = buildApprovalButtons(approvalId);
          try {
            await sendWithRetry(telegramBot, chatId, approvalText, {
              parse_mode: "MarkdownV2",
              reply_markup: { inline_keyboard: approvalButtons },
            });
          } catch (err: unknown) {
            // eslint-disable-next-line no-console -- notifier plugin: log delivery failures
            console.error(
              `[notifier-telegram] Failed to send approval notification ${notification.eventId}:`,
              err instanceof Error ? err.message : err,
            );
          }
          return;
        }
      }

      if (chatId !== defaultChatId) {
        // eslint-disable-next-line no-console -- notifier plugin: log project routing for ops visibility
        console.debug(
          `[notifier-telegram] Notification ${notification.eventId} routed to project chat ID ${chatId}`,
        );
      }

      // Build inline buttons for actionable event types. Story 57.11 Task 5.
      let buttons = buildNotificationButtons(
        notification.eventType,
        metadata,
        config?.dashboardBaseUrl,
      );

      // Append story quick-action buttons for story events. Story 57.13 Task 5.
      if (notification.eventType.startsWith("story.")) {
        const storyId = typeof metadata.storyId === "string" ? metadata.storyId : "";
        const projectKey = typeof metadata.projectId === "string" ? metadata.projectId : "";
        const isBlocked = notification.eventType === "story.blocked";
        const storyButtons = buildStoryActionButtons(
          storyId,
          projectKey,
          config?.dashboardBaseUrl,
          { isBlocked },
        );
        if (storyButtons) {
          if (buttons) {
            buttons = [...buttons, ...storyButtons];
          } else {
            buttons = storyButtons;
          }
        }
      }

      const sendOpts: Record<string, unknown> = { parse_mode: "MarkdownV2" };
      if (buttons) {
        sendOpts.reply_markup = { inline_keyboard: buttons };
      }

      try {
        await sendWithRetry(telegramBot, chatId, text, sendOpts);
      } catch (err: unknown) {
        // eslint-disable-next-line no-console -- notifier plugin: log delivery failures
        console.error(
          `[notifier-telegram] Failed to send notification ${notification.eventId}:`,
          err instanceof Error ? err.message : err,
        );
      }
    },

    async isAvailable(): Promise<boolean> {
      return botToken !== undefined && botToken.length > 0;
    },
  };
}
