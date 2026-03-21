/**
 * NotificationPlugin adapter for the Slack notifier.
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

export interface SlackNotificationPluginConfig {
  webhookUrl?: string;
  channel?: string;
  username?: string;
}

/**
 * Create a NotificationPlugin adapter for the Slack notifier.
 */
export function createNotificationPlugin(
  config?: SlackNotificationPluginConfig,
): NotificationPlugin {
  const notifier = create(config as Record<string, unknown>);

  return {
    name: "slack",

    async send(notification: Notification): Promise<void> {
      const event = notificationToOrchestratorEvent(notification);
      await notifier.notify(event);
    },

    async isAvailable(): Promise<boolean> {
      return config?.webhookUrl !== undefined && config.webhookUrl.length > 0;
    },
  };
}
