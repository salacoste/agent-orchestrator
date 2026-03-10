/**
 * Plugin Loader — discovers, validates, and manages plugins from YAML manifests.
 *
 * This service provides:
 * - Directory scanning for plugin.yaml files
 * - Manifest validation (required fields, API version compatibility)
 * - Permission checking and enforcement
 * - Plugin isolation (failed plugins don't crash the system)
 * - Hot reload capability
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

/** Valid permission types */
export type PluginPermission =
  | "runtime"
  | "agent"
  | "workspace"
  | "tracker"
  | "scm"
  | "notifier"
  | "terminal";

/** Plugin manifest loaded from plugin.yaml */
export interface PluginManifestWithMeta {
  /** Plugin name (e.g. "my-plugin") */
  name: string;

  /** Human-readable description */
  description: string;

  /** Version */
  version: string;

  /** API version required by this plugin */
  apiVersion: string;

  /** Entry point path (relative to plugin directory) */
  main: string;

  /** Permissions requested by this plugin */
  permissions: PluginPermission[];
}

/** Result of plugin load operation */
export interface PluginLoadResult {
  /** Plugin name */
  name: string;

  /** Load status: loaded, failed */
  status: "loaded" | "failed";

  /** Plugin manifest (if loaded successfully) */
  manifest?: PluginManifestWithMeta;

  /** Error message (if failed) */
  error?: string;

  /** Convenience fields (from manifest, undefined if failed) */
  version?: string;
  description?: string;
  permissions?: PluginPermission[];
}

/** PluginLoader configuration options */
export interface PluginLoaderOptions {
  /** Directory to scan for plugins */
  pluginsDir: string;

  /** Current API version (for compatibility checking) */
  apiVersion: string;
}

/** In-memory plugin registry */
type PluginRegistry = Map<string, PluginManifestWithMeta>;

/** PermissionError thrown when plugin attempts unauthorized operation */
export class PermissionError extends Error {
  constructor(
    public pluginName: string,
    public operation: string,
    message?: string,
  ) {
    super(message || `Plugin '${pluginName}' does not have permission for operation: ${operation}`);
    this.name = "PermissionError";
  }
}

/** Create a PluginLoader service */
export function createPluginLoader(options: PluginLoaderOptions) {
  const { pluginsDir, apiVersion } = options;
  const registry: PluginRegistry = new Map();

  /**
   * Scan plugins directory for plugin.yaml files
   * Returns load results for all discovered plugins
   */
  async function scan(): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = [];

    try {
      // Check if plugins directory exists
      if (!existsSync(pluginsDir)) {
        return results;
      }

      // Read all subdirectories
      const entries = await readdir(pluginsDir, { withFileTypes: true });
      const pluginDirs = entries.filter((e) => e.isDirectory());

      for (const dir of pluginDirs) {
        const pluginPath = join(pluginsDir, dir.name);
        const manifestPath = join(pluginPath, "plugin.yaml");

        // Check if plugin.yaml exists
        if (!existsSync(manifestPath)) {
          continue;
        }

        const result = await loadPlugin(dir.name, pluginPath, manifestPath);
        results.push(result);
      }
    } catch {
      // Return empty results on directory read errors
    }

    return results;
  }

  /**
   * Load a single plugin from its manifest
   */
  async function loadPlugin(
    name: string,
    pluginPath: string,
    manifestPath: string,
  ): Promise<PluginLoadResult> {
    try {
      // Read and parse manifest
      const content = await readFile(manifestPath, "utf-8");
      const manifest = parseManifest(content, name);

      // Validate required fields
      const validationError = validateManifest(manifest);
      if (validationError) {
        return {
          name,
          status: "failed",
          error: validationError,
        };
      }

      // Check API version compatibility
      if (!isApiVersionCompatible(manifest.apiVersion, apiVersion)) {
        return {
          name,
          status: "failed",
          error: `incompatible API version ${manifest.apiVersion}`,
        };
      }

      // Register plugin
      registry.set(name, manifest);

      return {
        name,
        status: "loaded",
        manifest,
        version: manifest.version,
        description: manifest.description,
        permissions: manifest.permissions,
      };
    } catch (error) {
      // Isolation: catch errors and mark as failed, don't throw
      return {
        name,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Parse YAML manifest content
   */
  function parseManifest(content: string, name: string): PluginManifestWithMeta {
    // Simple YAML parser for our flat structure
    const lines = content.split("\n");
    const manifest: Partial<PluginManifestWithMeta> = {
      permissions: [],
    };

    let currentKey: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) {
        continue;
      }

      // Check if line starts with "-" (list item)
      if (trimmed.startsWith("-")) {
        const value = trimmed
          .slice(1) // Remove "-"
          .trim()
          .replace(/^["']|["']$/g, "");
        if (currentKey === "permissions" && value) {
          manifest.permissions?.push(value as PluginPermission);
        }
        continue;
      }

      // Check if line contains ":" (key-value pair)
      if (trimmed.includes(":")) {
        const colonIndex = trimmed.indexOf(":");
        currentKey = trimmed.slice(0, colonIndex).trim();
        const value = trimmed
          .slice(colonIndex + 1)
          .trim()
          .replace(/^["']|["']$/g, "");

        switch (currentKey) {
          case "name":
            manifest.name = value || name;
            break;
          case "version":
            manifest.version = value;
            break;
          case "description":
            manifest.description = value;
            break;
          case "apiVersion":
            manifest.apiVersion = value;
            break;
          case "main":
            manifest.main = value;
            break;
          case "permissions":
            // Permissions will be collected from following "-" lines
            break;
        }
      }
    }

    return {
      name: manifest.name || name,
      description: manifest.description || "",
      version: manifest.version || "",
      apiVersion: manifest.apiVersion || "",
      main: manifest.main || "",
      permissions: manifest.permissions || [],
    };
  }

  /**
   * Validate required manifest fields
   */
  function validateManifest(manifest: PluginManifestWithMeta): string | undefined {
    const required: (keyof PluginManifestWithMeta)[] = [
      "name",
      "version",
      "description",
      "apiVersion",
      "main",
      "permissions",
    ];

    for (const field of required) {
      if (!manifest[field]) {
        return `validation failed: missing required field '${field}'`;
      }
    }

    return undefined;
  }

  /**
   * Check API version compatibility
   * Uses simple major.minor version matching
   */
  function isApiVersionCompatible(pluginVersion: string, systemVersion: string): boolean {
    // Simple exact match for now (could be enhanced with semver)
    return pluginVersion === systemVersion;
  }

  /**
   * Check if plugin has permission for operation
   */
  function checkPermission(pluginName: string, permission: string): boolean {
    const plugin = registry.get(pluginName);
    if (!plugin) {
      return false;
    }
    return plugin.permissions.includes(permission as PluginPermission);
  }

  /**
   * Require permission or throw PermissionError
   */
  function requirePermission(pluginName: string, permission: string): void {
    if (!checkPermission(pluginName, permission)) {
      throw new PermissionError(pluginName, permission);
    }
  }

  /**
   * Get plugin manifest by name
   */
  function getPlugin(name: string): PluginManifestWithMeta | undefined {
    return registry.get(name);
  }

  /**
   * Get all loaded plugins
   */
  function getAllPlugins(): PluginManifestWithMeta[] {
    return Array.from(registry.values());
  }

  /**
   * Get plugin count
   */
  function getPluginCount(): number {
    return registry.size;
  }

  /**
   * Reload all plugins (clear registry and rescan)
   */
  async function reload(): Promise<PluginLoadResult[]> {
    registry.clear();
    return await scan();
  }

  return {
    scan,
    checkPermission,
    requirePermission,
    getPlugin,
    getAllPlugins,
    getPluginCount,
    reload,
  };
}

/** Export the type for use in tests and other modules */
export type PluginLoader = ReturnType<typeof createPluginLoader>;
