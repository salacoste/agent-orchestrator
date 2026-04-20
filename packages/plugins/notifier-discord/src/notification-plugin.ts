/**
 * NotificationPlugin adapter for the Discord notifier.
 *
 * Wraps the existing Notifier interface into the NotificationPlugin interface
 * used by NotificationService. Uses shared adapter utilities from ao-core.
 */

import {
  notificationToOrchestratorEvent,
  type NotificationPlugin,
  type Notification,
  type NotificationPriority,
} from "@composio/ao-core";
import { create } from "./index.js";

export interface DiscordNotificationPluginConfig {
  webhookUrl?: string;
  username?: string;
  mentions?: Partial<Record<NotificationPriority, string>>;
}

/**
 * Create a NotificationPlugin adapter for the Discord notifier.
 */
export function createNotificationPlugin(
  config?: DiscordNotificationPluginConfig,
): NotificationPlugin {
  const notifier = create(config as Record<string, unknown>);

  return {
    name: "discord",

    async send(notification: Notification): Promise<void> {
      const event = notificationToOrchestratorEvent(notification);
      await notifier.notify(event);
    },

    async isAvailable(): Promise<boolean> {
      return config?.webhookUrl !== undefined && config.webhookUrl.length > 0;
    },
  };
}
