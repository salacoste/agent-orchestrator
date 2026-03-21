/**
 * NotificationPlugin adapter for the Composio notifier.
 *
 * Wraps the existing Notifier interface into the NotificationPlugin interface
 * used by NotificationService. Uses shared adapter utilities from ao-core.
 */

import {
  notificationToOrchestratorEvent,
  type NotificationPlugin,
  type Notification,
} from "@composio/ao-core";
import { create } from "./index.js";

export interface ComposioNotificationPluginConfig {
  composioApiKey?: string;
  defaultApp?: "slack" | "discord" | "gmail";
  channelName?: string;
  channelId?: string;
  emailTo?: string;
}

/**
 * Create a NotificationPlugin adapter for the Composio notifier.
 */
export function createNotificationPlugin(
  config?: ComposioNotificationPluginConfig,
): NotificationPlugin {
  const notifier = create(config as Record<string, unknown>);

  return {
    name: "composio",

    async send(notification: Notification): Promise<void> {
      const event = notificationToOrchestratorEvent(notification);
      await notifier.notify(event);
    },

    async isAvailable(): Promise<boolean> {
      const apiKey = config?.composioApiKey ?? process.env.COMPOSIO_API_KEY;
      return apiKey !== undefined && apiKey.length > 0;
    },
  };
}
