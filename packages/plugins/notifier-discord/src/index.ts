import {
  validateUrl,
  type PluginModule,
  type Notifier,
  type OrchestratorEvent,
  type NotifyAction,
  type NotifyContext,
  type EventPriority,
  CI_STATUS,
} from "@composio/ao-core";

export const manifest = {
  name: "discord",
  slot: "notifier" as const,
  description: "Notifier plugin: Discord webhook notifications",
  version: "0.1.0",
};

// Priority → decimal color for Discord embeds
const PRIORITY_COLOR: Record<EventPriority, number> = {
  urgent: 16711680, // Red
  action: 3447003, // Blue
  warning: 16776960, // Yellow
  info: 5763719, // Green
};

// Priority → emoji prefix
const PRIORITY_EMOJI: Record<EventPriority, string> = {
  urgent: "\u{1F6A8}",
  action: "\u{1F449}",
  warning: "\u26A0\uFE0F",
  info: "\u2139\uFE0F",
};

function buildEmbed(event: OrchestratorEvent, actions?: NotifyAction[]): Record<string, unknown> {
  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    {
      name: "Project",
      value: event.projectId,
      inline: true,
    },
    {
      name: "Priority",
      value: event.priority,
      inline: true,
    },
    {
      name: "Session",
      value: event.sessionId,
      inline: true,
    },
  ];

  // Add PR link if available
  const prUrl = typeof event.data.prUrl === "string" ? event.data.prUrl : undefined;
  if (prUrl) {
    fields.push({
      name: "Pull Request",
      value: `[View PR](${prUrl})`,
      inline: false,
    });
  }

  // Add CI status if available
  const ciStatus = typeof event.data.ciStatus === "string" ? event.data.ciStatus : undefined;
  if (ciStatus) {
    const icon = ciStatus === CI_STATUS.PASSING ? "\u2705" : "\u274C";
    fields.push({
      name: "CI Status",
      value: `${icon} ${ciStatus}`,
      inline: false,
    });
  }

  // Add action links
  if (actions && actions.length > 0) {
    const links = actions
      .filter((a) => a.url)
      .map((a) => `[${a.label}](${a.url as string})`)
      .join(" | ");
    if (links) {
      fields.push({
        name: "Actions",
        value: links,
        inline: false,
      });
    }
  }

  return {
    title: `${PRIORITY_EMOJI[event.priority]} ${event.type}`,
    description: event.message,
    color: PRIORITY_COLOR[event.priority],
    fields,
    footer: { text: "agent-orchestrator" },
    timestamp: event.timestamp.toISOString(),
  };
}

async function postToWebhook(webhookUrl: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[notifier-discord] Webhook failed (${response.status}): ${body}`);
    }
  } catch (err) {
    console.error("[notifier-discord] Delivery failed:", err instanceof Error ? err.message : err);
  }
}

export function create(config?: Record<string, unknown>): Notifier {
  const webhookUrl = config?.webhookUrl as string | undefined;
  const username = (config?.username as string) ?? "Agent Orchestrator";

  // Mentions config: { critical?: string, warning?: string }
  const mentions = (config?.mentions as Record<string, string> | undefined) ?? {};

  if (!webhookUrl) {
    // eslint-disable-next-line no-console -- notifier plugin: console is the only fallback when the notification layer itself cannot initialize
    console.warn("[notifier-discord] No webhookUrl configured \u2014 notifications will be no-ops");
  } else {
    validateUrl(webhookUrl, "notifier-discord");
  }

  return {
    name: "discord",

    async notify(event: OrchestratorEvent): Promise<void> {
      if (!webhookUrl) return;

      const embed = buildEmbed(event);
      const content = mentions[event.priority] ?? undefined;

      const payload: Record<string, unknown> = {
        username,
        embeds: [embed],
      };
      if (content) payload.content = content;

      await postToWebhook(webhookUrl, payload);
    },

    async notifyWithActions(event: OrchestratorEvent, actions: NotifyAction[]): Promise<void> {
      if (!webhookUrl) return;

      const embed = buildEmbed(event, actions);
      const content = mentions[event.priority] ?? undefined;

      const payload: Record<string, unknown> = {
        username,
        embeds: [embed],
      };
      if (content) payload.content = content;

      await postToWebhook(webhookUrl, payload);
    },

    async post(message: string, _context?: NotifyContext): Promise<string | null> {
      if (!webhookUrl) return null;

      const payload: Record<string, unknown> = {
        username,
        content: message,
      };

      await postToWebhook(webhookUrl, payload);
      // Discord webhooks don't return a message ID in the response
      return null;
    },
  };
}

export { createNotificationPlugin } from "./notification-plugin.js";
export type { DiscordNotificationPluginConfig } from "./notification-plugin.js";

export default { manifest, create } satisfies PluginModule<Notifier>;
