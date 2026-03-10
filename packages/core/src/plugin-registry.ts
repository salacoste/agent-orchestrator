/**
 * Plugin Registry — discovers and loads plugins.
 *
 * Plugins can be:
 * 1. Built-in (packages/plugins/*)
 * 2. npm packages (@composio/ao-plugin-*)
 * 3. Local file paths specified in config
 *
 * Supports lifecycle hooks:
 * - init(): Called after plugin is loaded and instantiated
 * - shutdown(): Called before plugin is unloaded
 */

import type {
  PluginSlot,
  PluginManifest,
  PluginModule,
  PluginRegistry,
  OrchestratorConfig,
  PluginLifecycle,
} from "./types.js";

/** Map from "slot:name" → plugin entry */
type PluginMap = Map<
  string,
  {
    manifest: PluginManifest;
    instance: unknown;
    module: PluginModule;
  }
>;

function makeKey(slot: PluginSlot, name: string): string {
  return `${slot}:${name}`;
}

/** Built-in plugin package names, mapped to their npm package */
const BUILTIN_PLUGINS: Array<{ slot: PluginSlot; name: string; pkg: string }> = [
  // Runtimes
  { slot: "runtime", name: "tmux", pkg: "@composio/ao-plugin-runtime-tmux" },
  { slot: "runtime", name: "process", pkg: "@composio/ao-plugin-runtime-process" },
  // Agents
  { slot: "agent", name: "claude-code", pkg: "@composio/ao-plugin-agent-claude-code" },
  { slot: "agent", name: "glm", pkg: "@composio/ao-plugin-agent-glm" },
  { slot: "agent", name: "codex", pkg: "@composio/ao-plugin-agent-codex" },
  { slot: "agent", name: "aider", pkg: "@composio/ao-plugin-agent-aider" },
  // Workspaces
  { slot: "workspace", name: "worktree", pkg: "@composio/ao-plugin-workspace-worktree" },
  { slot: "workspace", name: "clone", pkg: "@composio/ao-plugin-workspace-clone" },
  // Trackers
  { slot: "tracker", name: "github", pkg: "@composio/ao-plugin-tracker-github" },
  { slot: "tracker", name: "linear", pkg: "@composio/ao-plugin-tracker-linear" },
  { slot: "tracker", name: "bmad", pkg: "@composio/ao-plugin-tracker-bmad" },
  // SCM
  { slot: "scm", name: "github", pkg: "@composio/ao-plugin-scm-github" },
  // Notifiers
  { slot: "notifier", name: "composio", pkg: "@composio/ao-plugin-notifier-composio" },
  { slot: "notifier", name: "desktop", pkg: "@composio/ao-plugin-notifier-desktop" },
  { slot: "notifier", name: "slack", pkg: "@composio/ao-plugin-notifier-slack" },
  { slot: "notifier", name: "webhook", pkg: "@composio/ao-plugin-notifier-webhook" },
  // Terminals
  { slot: "terminal", name: "iterm2", pkg: "@composio/ao-plugin-terminal-iterm2" },
  { slot: "terminal", name: "web", pkg: "@composio/ao-plugin-terminal-web" },
];

/** Extract plugin-specific config from orchestrator config */
function extractPluginConfig(
  _slot: PluginSlot,
  _name: string,
  _config: OrchestratorConfig,
): Record<string, unknown> | undefined {
  // Reserved for future plugin-specific config mapping
  return undefined;
}

export function createPluginRegistry(): PluginRegistry {
  const plugins: PluginMap = new Map();
  // Store plugin state for hot-swap preservation
  const pluginStates: Map<string, Record<string, unknown>> = new Map();
  // Store plugin configs for reload
  const pluginConfigs: Map<string, Record<string, unknown> | undefined> = new Map();
  // Store plugin package names for reload
  const pluginPackages: Map<string, string> = new Map();

  /**
   * Call init() lifecycle hook on a plugin if present
   * Checks both module-level and instance-level hooks
   */
  async function callInit(module: PluginModule, instance: unknown): Promise<void> {
    // Try module-level init first
    if (typeof module.init === "function") {
      try {
        await module.init();
      } catch (error) {
        // Log but don't throw - lifecycle errors shouldn't crash the system
        // eslint-disable-next-line no-console
        console.error(`Plugin lifecycle init() error: ${error}`);
      }
    }

    // Try instance-level init
    const lifecycleInstance = instance as PluginLifecycle;
    if (typeof lifecycleInstance?.init === "function") {
      try {
        await lifecycleInstance.init();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Plugin instance lifecycle init() error: ${error}`);
      }
    }
  }

  /**
   * Call shutdown() lifecycle hook on a plugin if present
   * Checks both module-level and instance-level hooks
   */
  async function callShutdown(module: PluginModule, instance: unknown): Promise<void> {
    // Try instance-level shutdown first (reverse order from init)
    const lifecycleInstance = instance as PluginLifecycle;
    if (typeof lifecycleInstance?.shutdown === "function") {
      try {
        await lifecycleInstance.shutdown();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Plugin instance lifecycle shutdown() error: ${error}`);
      }
    }

    // Try module-level shutdown
    if (typeof module.shutdown === "function") {
      try {
        await module.shutdown();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Plugin lifecycle shutdown() error: ${error}`);
      }
    }
  }

  /**
   * Get plugin state for hot-swap preservation
   * Calls the plugin's getState() lifecycle hook if present
   */
  function captureState(key: string, instance: unknown): Record<string, unknown> | null {
    const lifecycleInstance = instance as PluginLifecycle & {
      getState?: () => Record<string, unknown>;
    };
    if (typeof lifecycleInstance?.getState === "function") {
      try {
        const state = lifecycleInstance.getState();
        pluginStates.set(key, state);
        return state;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Plugin getState() error: ${error}`);
      }
    }
    return null;
  }

  /**
   * Restore plugin state after hot-swap
   * Calls the plugin's setState() lifecycle hook if present
   */
  function restoreState(key: string, instance: unknown): boolean {
    const state = pluginStates.get(key);
    if (!state) return false;

    const lifecycleInstance = instance as PluginLifecycle & {
      setState?: (state: Record<string, unknown>) => void;
    };
    if (typeof lifecycleInstance?.setState === "function") {
      try {
        lifecycleInstance.setState(state);
        return true;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Plugin setState() error: ${error}`);
      }
    }
    return false;
  }

  return {
    register(plugin: PluginModule, config?: Record<string, unknown>): void {
      const { manifest } = plugin;
      const key = makeKey(manifest.slot, manifest.name);
      const instance = plugin.create(config);
      plugins.set(key, { manifest, instance, module: plugin });
      pluginConfigs.set(key, config);

      // Call init() lifecycle hook asynchronously (don't await)
      // This allows registration to complete quickly while init runs in background
      callInit(plugin, instance).catch(() => {
        // Already logged in callInit
      });
    },

    get<T>(slot: PluginSlot, name: string): T | null {
      const entry = plugins.get(makeKey(slot, name));
      return entry ? (entry.instance as T) : null;
    },

    list(slot: PluginSlot): PluginManifest[] {
      const result: PluginManifest[] = [];
      for (const [key, entry] of plugins) {
        if (key.startsWith(`${slot}:`)) {
          result.push(entry.manifest);
        }
      }
      return result;
    },

    async loadBuiltins(
      orchestratorConfig?: OrchestratorConfig,
      importFn?: (pkg: string) => Promise<unknown>,
    ): Promise<void> {
      const doImport = importFn ?? ((pkg: string) => import(pkg));
      for (const builtin of BUILTIN_PLUGINS) {
        try {
          const mod = (await doImport(builtin.pkg)) as PluginModule;
          if (mod.manifest && typeof mod.create === "function") {
            const pluginConfig = orchestratorConfig
              ? extractPluginConfig(builtin.slot, builtin.name, orchestratorConfig)
              : undefined;
            const key = makeKey(builtin.slot, builtin.name);
            pluginPackages.set(key, builtin.pkg);
            this.register(mod, pluginConfig);
          }
        } catch {
          // Plugin not installed — that's fine, only load what's available
        }
      }
    },

    async loadFromConfig(
      config: OrchestratorConfig,
      importFn?: (pkg: string) => Promise<unknown>,
    ): Promise<void> {
      // Load built-ins with orchestrator config so plugins receive their settings
      await this.loadBuiltins(config, importFn);

      // Then, load any additional plugins specified in project configs
      // (future: support npm package names and local file paths)
    },

    async shutdown(slot: PluginSlot, name: string): Promise<boolean> {
      const key = makeKey(slot, name);
      const entry = plugins.get(key);
      if (!entry) {
        return false;
      }

      // Capture state before shutdown
      captureState(key, entry.instance);

      await callShutdown(entry.module, entry.instance);
      plugins.delete(key);
      return true;
    },

    async shutdownAll(): Promise<void> {
      const shutdownPromises: Promise<void>[] = [];

      for (const [key, entry] of plugins) {
        // Capture state before shutdown
        captureState(key, entry.instance);

        shutdownPromises.push(
          callShutdown(entry.module, entry.instance).then(() => {
            plugins.delete(key);
          }),
        );
      }

      await Promise.allSettled(shutdownPromises);
    },

    async reload(
      slot: PluginSlot,
      name: string,
      importFn?: (pkg: string) => Promise<unknown>,
    ): Promise<boolean> {
      const key = makeKey(slot, name);
      const entry = plugins.get(key);
      if (!entry) {
        return false;
      }

      // Capture state before shutdown
      captureState(key, entry.instance);

      // Shutdown the plugin
      await callShutdown(entry.module, entry.instance);

      // Get the package name for reload
      const pkg = pluginPackages.get(key);
      if (!pkg) {
        // eslint-disable-next-line no-console
        console.error(`Cannot reload plugin ${key}: package name not found`);
        return false;
      }

      try {
        // Re-import the plugin module
        const doImport = importFn ?? ((p: string) => import(p));
        // Clear the module from cache if possible
        // Note: We use Object.prototype.hasOwnProperty to safely check cache
        const modulePath = require.resolve(pkg);
        if (Object.prototype.hasOwnProperty.call(require.cache, modulePath)) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete require.cache[modulePath];
        }

        const mod = (await doImport(pkg)) as PluginModule;
        if (!mod.manifest || typeof mod.create !== "function") {
          // eslint-disable-next-line no-console
          console.error(`Reloaded plugin ${pkg} is invalid`);
          return false;
        }

        // Get preserved config
        const config = pluginConfigs.get(key);

        // Create new instance
        const instance = mod.create(config);

        // Restore state if available
        restoreState(key, instance);

        // Re-register the plugin
        plugins.set(key, { manifest: mod.manifest, instance, module: mod });

        // Call init lifecycle
        await callInit(mod, instance);

        return true;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to reload plugin ${key}:`, error);
        return false;
      }
    },

    getPluginState(slot: PluginSlot, name: string): Record<string, unknown> | null {
      return pluginStates.get(makeKey(slot, name)) ?? null;
    },

    isRegistered(slot: PluginSlot, name: string): boolean {
      return plugins.has(makeKey(slot, name));
    },
  };
}
