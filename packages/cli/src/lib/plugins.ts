import type {
  Agent,
  NotificationPlugin,
  OrchestratorConfig,
  Runtime,
  SCM,
  Tracker,
} from "@composio/ao-core";
import claudeCodePlugin from "@composio/ao-plugin-agent-claude-code";
import glmPlugin from "@composio/ao-plugin-agent-glm";
import codexPlugin from "@composio/ao-plugin-agent-codex";
import aiderPlugin from "@composio/ao-plugin-agent-aider";
import tmuxRuntimePlugin from "@composio/ao-plugin-runtime-tmux";
import processRuntimePlugin from "@composio/ao-plugin-runtime-process";
import githubSCMPlugin from "@composio/ao-plugin-scm-github";
import bmadTrackerPlugin from "@composio/ao-plugin-tracker-bmad";
import githubTrackerPlugin from "@composio/ao-plugin-tracker-github";
import linearTrackerPlugin from "@composio/ao-plugin-tracker-linear";
import { createNotificationPlugin as createDesktopNotificationPlugin } from "@composio/ao-plugin-notifier-desktop";
import { createNotificationPlugin as createSlackNotificationPlugin } from "@composio/ao-plugin-notifier-slack";
import { createNotificationPlugin as createWebhookNotificationPlugin } from "@composio/ao-plugin-notifier-webhook";
import { createNotificationPlugin as createComposioNotificationPlugin } from "@composio/ao-plugin-notifier-composio";

const runtimePlugins: Record<string, { create(): Runtime }> = {
  tmux: tmuxRuntimePlugin,
  process: processRuntimePlugin,
};

const agentPlugins: Record<string, { create(): Agent }> = {
  "claude-code": claudeCodePlugin,
  glm: glmPlugin,
  codex: codexPlugin,
  aider: aiderPlugin,
};

const scmPlugins: Record<string, { create(): SCM }> = {
  github: githubSCMPlugin,
};

const trackerPlugins: Record<string, { create(): Tracker }> = {
  bmad: bmadTrackerPlugin,
  github: githubTrackerPlugin,
  linear: linearTrackerPlugin,
};

type NotifierPluginFactory = (config?: Record<string, unknown>) => NotificationPlugin;

const notifierPluginFactories: Record<string, NotifierPluginFactory> = {
  desktop: (config) => createDesktopNotificationPlugin(config),
  slack: (config) => createSlackNotificationPlugin(config),
  webhook: (config) => createWebhookNotificationPlugin(config),
  composio: (config) => createComposioNotificationPlugin(config),
};

/**
 * Resolve the Agent plugin for a project (or fall back to the config default).
 * Direct import — no dynamic loading needed since the CLI depends on all agent plugins.
 */
export function getAgent(config: OrchestratorConfig, projectId?: string): Agent {
  const agentName =
    (projectId ? config.projects[projectId]?.agent : undefined) || config.defaults.agent;
  const plugin = agentPlugins[agentName];
  if (!plugin) {
    throw new Error(`Unknown agent plugin: ${agentName}`);
  }
  return plugin.create();
}

/** Get an agent by name directly (for fallback/no-config scenarios). */
export function getAgentByName(name: string): Agent {
  const plugin = agentPlugins[name];
  if (!plugin) {
    throw new Error(`Unknown agent plugin: ${name}`);
  }
  return plugin.create();
}

/**
 * Resolve the Runtime plugin for a project (or fall back to the config default).
 */
export function getRuntime(config: OrchestratorConfig, projectId?: string): Runtime {
  const runtimeName =
    (projectId ? config.projects[projectId]?.runtime : undefined) || config.defaults.runtime;
  const plugin = runtimePlugins[runtimeName];
  if (!plugin) {
    throw new Error(`Unknown runtime plugin: ${runtimeName}`);
  }
  return plugin.create();
}

/**
 * Resolve the SCM plugin for a project (or fall back to "github").
 */
export function getSCM(config: OrchestratorConfig, projectId: string): SCM {
  const scmName = config.projects[projectId]?.scm?.plugin || "github";
  const plugin = scmPlugins[scmName];
  if (!plugin) {
    throw new Error(`Unknown SCM plugin: ${scmName}`);
  }
  return plugin.create();
}

/**
 * Resolve the Tracker plugin for a project.
 * Returns null if no tracker is configured for this project.
 */
export function getTracker(config: OrchestratorConfig, projectId: string): Tracker | null {
  const trackerName = config.projects[projectId]?.tracker?.plugin;
  if (!trackerName) return null;
  const plugin = trackerPlugins[trackerName];
  if (!plugin) return null;
  return plugin.create();
}

/**
 * Create NotificationPlugin instances from the config's notifiers section.
 * Each entry in config.notifiers is `{ plugin: "slack", ...pluginConfig }`.
 * Returns only plugins whose factory is known; unknown plugin names are skipped
 * (with a warning logged) so the system degrades gracefully.
 */
export function getNotificationPlugins(config: OrchestratorConfig): NotificationPlugin[] {
  const plugins: NotificationPlugin[] = [];
  const notifiers = config.notifiers ?? {};

  for (const [name, notifierConfig] of Object.entries(notifiers)) {
    const pluginName = notifierConfig.plugin ?? name;
    const factory = notifierPluginFactories[pluginName];
    if (!factory) {
      console.warn(`[notification] Unknown notifier plugin "${pluginName}" — skipping`);
      continue;
    }
    // Pass the full config (minus `plugin` key) to the factory
    const { plugin: _, ...rest } = notifierConfig;
    plugins.push(factory(rest));
  }

  // If no explicit notifiers configured, create defaults from config.defaults.notifiers
  if (Object.keys(notifiers).length === 0) {
    for (const pluginName of config.defaults.notifiers) {
      const factory = notifierPluginFactories[pluginName];
      if (factory) {
        plugins.push(factory());
      }
    }
  }

  return plugins;
}
