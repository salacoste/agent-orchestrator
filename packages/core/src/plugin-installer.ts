/**
 * Plugin Installer — install, update, uninstall, and manage plugins
 *
 * This service provides:
 * - npm package installation to plugins directory
 * - Version checking and updates
 * - Plugin validation and loading
 * - Permission management
 * - Dependency checking
 * - Enable/disable functionality
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { createPluginLoader, type PluginPermission } from "./plugin-loader.js";

const execFileAsync = promisify(execFile);

/** Current API version */
export const CURRENT_API_VERSION = "1.0.0";

/** Plugin status in the registry */
export type PluginStatus = "loaded" | "disabled" | "failed";

/** Installed plugin information */
export interface InstalledPlugin {
  /** Plugin name (package name) */
  name: string;

  /** Plugin directory name (may differ from package name) */
  dirName: string;

  /** Version */
  version: string;

  /** Description */
  description?: string;

  /** Plugin status */
  status: PluginStatus;

  /** Permissions requested */
  permissions: PluginPermission[];

  /** Whether plugin is enabled (not disabled) */
  enabled: boolean;

  /** Error message if failed to load */
  error?: string;

  /** API version required */
  apiVersion: string;
}

/** Plugin installation result */
export interface PluginInstallResult {
  /** Package name */
  name: string;

  /** Installation status */
  status: "installed" | "failed" | "cancelled";

  /** Version installed */
  version?: string;

  /** Error message if failed */
  error?: string;

  /** Permissions required */
  permissions?: PluginPermission[];
}

/** Plugin search result from registry */
export interface PluginSearchResult {
  /** Package name */
  name: string;

  /** Version */
  version: string;

  /** Description */
  description: string;

  /** Author */
  author?: string;

  /** Weekly downloads */
  downloads?: number;

  /** Homepage URL */
  homepage?: string;
}

/** Plugin disable file name */
const DISABLED_FILE = ".disabled";

/** Create a PluginInstaller service */
export function createPluginInstaller(options: {
  /** Directory where plugins are installed */
  pluginsDir: string;

  /** API version for compatibility checking */
  apiVersion?: string;
}) {
  const { pluginsDir, apiVersion = CURRENT_API_VERSION } = options;

  /**
   * Install a plugin from npm
   */
  async function install(
    packageName: string,
    opts: {
      /** Grant permissions without prompting */
      grantPermissions?: boolean;
      /** Install from local path instead of npm */
      local?: boolean;
    } = {},
  ): Promise<PluginInstallResult> {
    try {
      // Check if plugins directory exists, create if not
      if (!existsSync(pluginsDir)) {
        await mkdir(pluginsDir, { recursive: true });
      }

      // Extract plugin name from scoped package if needed
      const name = packageName.replace(/^@[^/]+\//, "");

      // Check if plugin is already installed
      const existing = await getPluginInfo(name);
      if (existing) {
        return {
          name: packageName,
          status: "failed",
          error: `Plugin already installed: ${existing.version}`,
        };
      }

      // Install package
      const targetDir = join(pluginsDir, name);

      if (opts.local) {
        // Install from local path
        await execFileAsync("cp", ["-r", packageName, targetDir], { timeout: 30000 });
      } else {
        // Install from npm
        const installArgs = ["install", "--prefix", pluginsDir, "--save", packageName];

        await execFileAsync("npm", installArgs, { timeout: 120000 });
      }

      // Load and validate the plugin
      const loader = createPluginLoader({ pluginsDir, apiVersion });
      const results = await loader.scan();
      const result = results.find((r) => r.name === name);

      if (!result) {
        return {
          name: packageName,
          status: "failed",
          error: "Plugin not found after installation",
        };
      }

      if (result.status === "failed") {
        // Clean up failed installation
        await rm(targetDir, { recursive: true, force: true });
        return {
          name: packageName,
          status: "failed",
          error: result.error || "Failed to load plugin",
        };
      }

      return {
        name: packageName,
        status: "installed",
        version: result.version,
        permissions: result.permissions,
      };
    } catch (error) {
      return {
        name: packageName,
        status: "failed",
        error: error instanceof Error ? error.message : "Installation failed",
      };
    }
  }

  /**
   * Uninstall a plugin
   */
  async function uninstall(
    packageName: string,
    _opts: {
      /** Skip confirmation prompts */
      force?: boolean;
    } = {},
  ): Promise<{ status: "uninstalled" | "failed" | "cancelled"; error?: string }> {
    try {
      const name = packageName.replace(/^@[^/]+\//, "");
      const pluginDir = join(pluginsDir, name);

      // Check if plugin exists
      if (!existsSync(pluginDir)) {
        return {
          status: "failed",
          error: `Plugin not installed: ${packageName}`,
        };
      }

      // Remove plugin directory
      await rm(pluginDir, { recursive: true, force: true });

      return { status: "uninstalled" };
    } catch (error) {
      return {
        status: "failed",
        error: error instanceof Error ? error.message : "Uninstallation failed",
      };
    }
  }

  /**
   * Update a plugin to latest version
   */
  async function update(
    packageName: string,
    opts: {
      /** Update to specific version */
      version?: string;
      /** Skip confirmation prompts */
      _force?: boolean;
    } = {},
  ): Promise<{ status: "updated" | "failed" | "up-to-date"; version?: string; error?: string }> {
    try {
      const name = packageName.replace(/^@[^/]+\//, "");

      // Get current version
      const current = await getPluginInfo(name);
      if (!current) {
        return {
          status: "failed",
          error: `Plugin not installed: ${packageName}`,
        };
      }

      // Uninstall current version
      const uninstallResult = await uninstall(packageName, { force: true });
      if (uninstallResult.status === "failed") {
        return {
          status: "failed",
          error: uninstallResult.error,
        };
      }

      // Install new version
      const targetVersion = opts.version ? `${packageName}@${opts.version}` : packageName;
      const installResult = await install(targetVersion, { grantPermissions: true });

      if (installResult.status === "failed") {
        // Rollback: reinstall old version
        await install(`${packageName}@${current.version}`, { grantPermissions: true });
        return {
          status: "failed",
          error: installResult.error || "Update failed, rolled back to previous version",
        };
      }

      return {
        status: "updated",
        version: installResult.version,
      };
    } catch (error) {
      return {
        status: "failed",
        error: error instanceof Error ? error.message : "Update failed",
      };
    }
  }

  /**
   * Search for plugins on npm
   */
  async function search(query: string): Promise<PluginSearchResult[]> {
    try {
      // Use npm search to find plugins
      const { stdout } = await execFileAsync(
        "npm",
        ["search", query, "--json", "--searchlimit", "20"],
        { timeout: 60000 },
      );

      const results = JSON.parse(stdout) as Array<{
        name: string;
        version: string;
        description: string;
        author?: { name?: string };
        keywords?: string[];
        links?: { homepage?: string };
      }>;

      // Filter for ao-plugin packages
      return results
        .filter((pkg) => pkg.name.includes("ao-plugin"))
        .map((pkg) => ({
          name: pkg.name,
          version: pkg.version,
          description: pkg.description,
          author: pkg.author?.name,
          homepage: pkg.links?.homepage,
        }));
    } catch {
      return [];
    }
  }

  /**
   * Get plugin information
   */
  async function getPluginInfo(name: string): Promise<InstalledPlugin | undefined> {
    const pluginDir = join(pluginsDir, name);

    if (!existsSync(pluginDir)) {
      return undefined;
    }

    // Check if disabled
    const disabledFile = join(pluginDir, DISABLED_FILE);
    const enabled = !existsSync(disabledFile);

    // Load plugin to get manifest
    const loader = createPluginLoader({ pluginsDir, apiVersion });
    const results = await loader.scan();
    const result = results.find((r) => r.name === name);

    if (!result) {
      return undefined;
    }

    return {
      name: result.manifest?.name || name,
      dirName: name,
      version: result.version || "unknown",
      description: result.description,
      status: result.status as PluginStatus,
      permissions: result.permissions || [],
      enabled,
      error: result.error,
      apiVersion: result.manifest?.apiVersion || "unknown",
    };
  }

  /**
   * List all installed plugins
   */
  async function listPlugins(): Promise<InstalledPlugin[]> {
    if (!existsSync(pluginsDir)) {
      return [];
    }

    const entries = await readdir(pluginsDir, { withFileTypes: true });
    const pluginDirs = entries.filter((e) => e.isDirectory());

    const plugins: InstalledPlugin[] = [];

    for (const dir of pluginDirs) {
      const info = await getPluginInfo(dir.name);
      if (info) {
        plugins.push(info);
      }
    }

    return plugins;
  }

  /**
   * Disable a plugin
   */
  async function disable(
    packageName: string,
  ): Promise<{ status: "disabled" | "failed"; error?: string }> {
    try {
      const name = packageName.replace(/^@[^/]+\//, "");
      const pluginDir = join(pluginsDir, name);
      const disabledFile = join(pluginDir, DISABLED_FILE);

      if (!existsSync(pluginDir)) {
        return {
          status: "failed",
          error: `Plugin not installed: ${packageName}`,
        };
      }

      // Create .disabled file
      await writeFile(disabledFile, new Date().toISOString());

      return { status: "disabled" };
    } catch (error) {
      return {
        status: "failed",
        error: error instanceof Error ? error.message : "Failed to disable plugin",
      };
    }
  }

  /**
   * Enable a disabled plugin
   */
  async function enable(
    packageName: string,
  ): Promise<{ status: "enabled" | "failed"; error?: string }> {
    try {
      const name = packageName.replace(/^@[^/]+\//, "");
      const pluginDir = join(pluginsDir, name);
      const disabledFile = join(pluginDir, DISABLED_FILE);

      if (!existsSync(pluginDir)) {
        return {
          status: "failed",
          error: `Plugin not installed: ${packageName}`,
        };
      }

      // Remove .disabled file
      await rm(disabledFile, { force: true });

      return { status: "enabled" };
    } catch (error) {
      return {
        status: "failed",
        error: error instanceof Error ? error.message : "Failed to enable plugin",
      };
    }
  }

  return {
    install,
    uninstall,
    update,
    search,
    getPluginInfo,
    listPlugins,
    disable,
    enable,
  };
}

/** Export the type for use in tests and other modules */
export type PluginInstaller = ReturnType<typeof createPluginInstaller>;
