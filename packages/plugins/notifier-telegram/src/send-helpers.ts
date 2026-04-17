/**
 * Telegram send-with-retry helper.
 *
 * Shared between index.ts (Notifier interface) and notification-plugin.ts
 * (NotificationPlugin interface) to avoid circular ESM imports.
 * Story 57.1 + 57.2.
 */

import type { TelegramBot } from "./telegram-bot.js";

/**
 * Send a Telegram message with retry on rate limits (429).
 * Extracts retry_after from the error and backs off.
 */
export async function sendWithRetry(
  bot: TelegramBot,
  chatId: string,
  text: string,
  options: Record<string, unknown> = {},
  retries = 3,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- grammY sendMessage returns Message
): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await bot.api.sendMessage(chatId, text, { ...options });
    } catch (err: unknown) {
      const is429 =
        err instanceof Error &&
        "parameters" in err &&
        (err as { parameters?: { retry_after?: number } }).parameters?.retry_after !== undefined;

      if (!is429 || attempt >= retries) {
        throw err;
      }

      const retryAfter =
        (err as { parameters: { retry_after: number } }).parameters.retry_after ?? 2;
      const delay = retryAfter * 1000 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
