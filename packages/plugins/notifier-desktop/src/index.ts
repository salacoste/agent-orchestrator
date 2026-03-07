import { execFile } from "node:child_process";
import { platform } from "node:os";
import nodeNotifier from "node-notifier";
import {
  escapeAppleScript,
  type PluginModule,
  type Notifier,
  type NotificationPlugin,
  type Notification,
  type OrchestratorEvent,
  type NotifyAction,
  type EventPriority,
} from "@composio/ao-core";

export const manifest = {
  name: "desktop",
  slot: "notifier" as const,
  description: "Notifier plugin: OS desktop notifications",
  version: "0.1.0",
};

// Re-export for backwards compatibility
export { escapeAppleScript } from "@composio/ao-core";

/**
 * Map event priority to notification urgency:
 * - urgent: sound alert
 * - action: normal notification
 * - info/warning: silent
 */
function shouldPlaySound(priority: EventPriority, soundEnabled: boolean): boolean {
  if (!soundEnabled) return false;
  return priority === "urgent";
}

function formatTitle(event: OrchestratorEvent): string {
  const prefix = event.priority === "urgent" ? "URGENT" : "Agent Orchestrator";
  return `${prefix} [${event.sessionId}]`;
}

function formatMessage(event: OrchestratorEvent): string {
  return event.message;
}

function formatActionsMessage(event: OrchestratorEvent, actions: NotifyAction[]): string {
  const actionLabels = actions.map((a) => a.label).join(" | ");
  return `${event.message}\n\nActions: ${actionLabels}`;
}

/**
 * Send a desktop notification using osascript (macOS) or notify-send (Linux).
 * Falls back gracefully if neither is available.
 *
 * Note: Desktop notifications do not support click-through URLs natively.
 * On macOS, osascript's `display notification` lacks URL support.
 * Consider `terminal-notifier` for click-to-open if needed in the future.
 */
function sendNotification(
  title: string,
  message: string,
  options: { sound: boolean; isUrgent: boolean },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const os = platform();

    if (os === "darwin") {
      const safeTitle = escapeAppleScript(title);
      const safeMessage = escapeAppleScript(message);
      const soundClause = options.sound ? ' sound name "default"' : "";
      const script = `display notification "${safeMessage}" with title "${safeTitle}"${soundClause}`;
      execFile("osascript", ["-e", script], (err) => {
        if (err) reject(err);
        else resolve();
      });
    } else if (os === "linux") {
      // Linux urgency is driven by event priority, not the macOS sound config
      const args: string[] = [];
      if (options.isUrgent) {
        args.push("--urgency=critical");
      }
      args.push(title, message);
      execFile("notify-send", args, (err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      console.warn(`[notifier-desktop] Desktop notifications not supported on ${os}`);
      resolve();
    }
  });
}

export function create(config?: Record<string, unknown>): Notifier {
  const soundEnabled = typeof config?.sound === "boolean" ? config.sound : true;

  return {
    name: "desktop",

    async notify(event: OrchestratorEvent): Promise<void> {
      const title = formatTitle(event);
      const message = formatMessage(event);
      const sound = shouldPlaySound(event.priority, soundEnabled);
      const isUrgent = event.priority === "urgent";
      await sendNotification(title, message, { sound, isUrgent });
    },

    async notifyWithActions(event: OrchestratorEvent, actions: NotifyAction[]): Promise<void> {
      // Desktop notifications cannot display interactive action buttons.
      // Actions are rendered as text labels in the notification body as a fallback.
      const title = formatTitle(event);
      const message = formatActionsMessage(event, actions);
      const sound = shouldPlaySound(event.priority, soundEnabled);
      const isUrgent = event.priority === "urgent";
      await sendNotification(title, message, { sound, isUrgent });
    },
  };
}

/** Coalescing configuration */
interface CoalesceConfig {
  /** Time window in milliseconds for coalescing similar notifications (0 = disabled) */
  coalesceWindow?: number;
  /** Respect focus mode (DND) and suppress notifications */
  respectFocusMode?: boolean;
  /** Custom focus mode detection function */
  detectFocusMode?: () => Promise<boolean>;
}

/** Pending coalesced notification */
interface PendingCoalescedNotification {
  notification: Notification;
  count: number;
  timer: ReturnType<typeof setTimeout>;
}

/** Pending coalesced notification */
interface PendingCoalescedNotification {
  notification: Notification;
  count: number;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Create a NotificationPlugin using node-notifier for cross-platform support.
 * This implements the NotificationPlugin interface for use with NotificationService.
 */
export function createNotificationPlugin(config?: CoalesceConfig): NotificationPlugin {
  const coalesceWindow = config?.coalesceWindow ?? 60000; // Default 60 seconds
  const respectFocusMode = config?.respectFocusMode ?? false;
  const detectFocusMode = config?.detectFocusMode;
  const pendingNotifications = new Map<string, PendingCoalescedNotification>();

  /**
   * Send a notification via node-notifier
   */
  function sendNotification(notification: Notification, count?: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const options: {
        title: string;
        message: string;
        sound?: boolean;
        wait?: boolean;
      } = {
        title: notification.title,
        message: count && count > 1 ? `${notification.message} (${count})` : notification.message,
      };

      // Add sound for critical priority notifications
      if (notification.priority === "critical") {
        options.sound = true;
      }

      nodeNotifier.notify(options, (error, _response) => {
        if (error) {
          // Log error but don't reject - notifications are best-effort
          // eslint-disable-next-line no-console
          console.error("[notifier-desktop] Failed to send notification:", error);
        }
        resolve(); // Always resolve to avoid blocking notification service
      });
    });
  }

  /**
   * Flush a coalesced notification
   */
  function flushCoalesced(key: string): void {
    const pending = pendingNotifications.get(key);
    if (!pending) return;

    clearTimeout(pending.timer);
    pendingNotifications.delete(key);

    void sendNotification(pending.notification, pending.count);
  }

  return {
    name: "desktop",

    async send(notification: Notification): Promise<void> {
      // Check focus mode if enabled
      if (respectFocusMode && detectFocusMode) {
        try {
          const isFocusModeActive = await detectFocusMode();
          if (isFocusModeActive) {
            // Suppress notification during focus mode
            return;
          }
        } catch {
          // Fail open - send notification if detection fails
          // Error is logged but doesn't block notification
        }
      }

      // Coalescing disabled or not applicable
      if (coalesceWindow <= 0) {
        return sendNotification(notification);
      }

      const key = notification.eventType;
      const pending = pendingNotifications.get(key);

      if (pending) {
        // Coalesce: increment count and reset timer
        pending.count++;
        pending.notification = notification; // Update to latest notification data
        clearTimeout(pending.timer);
        pending.timer = setTimeout(() => flushCoalesced(key), coalesceWindow);
      } else {
        // First notification of this type
        if (coalesceWindow > 0) {
          // Start coalescing window
          const timer = setTimeout(() => flushCoalesced(key), coalesceWindow);
          pendingNotifications.set(key, {
            notification,
            count: 1,
            timer,
          });
        }
        // Send immediately regardless (user sees first notification right away)
        return sendNotification(notification);
      }
    },

    async isAvailable(): Promise<boolean> {
      // node-notifier is always available as it's a dependency
      // Platform-specific functionality is handled by node-notifier internally
      return true;
    },
  };
}

export default { manifest, create } satisfies PluginModule<Notifier>;
