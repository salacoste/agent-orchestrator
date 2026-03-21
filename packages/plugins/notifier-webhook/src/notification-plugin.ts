/**
 * NotificationPlugin adapter for the generic webhook notifier.
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

export interface WebhookNotificationPluginConfig {
  url?: string;
  headers?: Record<string, string>;
  retries?: number;
  retryDelayMs?: number;
}

/**
 * Create a NotificationPlugin adapter for the generic webhook notifier.
 */
export function createNotificationPlugin(
  config?: WebhookNotificationPluginConfig,
): NotificationPlugin {
  const notifier = create(config as Record<string, unknown>);

  return {
    name: "webhook",

    async send(notification: Notification): Promise<void> {
      const event = notificationToOrchestratorEvent(notification);
      await notifier.notify(event);
    },

    async isAvailable(): Promise<boolean> {
      return config?.url !== undefined && config.url.length > 0;
    },
  };
}
