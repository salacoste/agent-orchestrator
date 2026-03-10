/**
 * Plugin NPM Registry — discover and publish plugins on npm
 *
 * This service provides:
 * - Search for ao-plugins on npm registry
 * - Get plugin details and metadata
 * - Publish plugins to npm
 * - Validate plugin structure before publishing
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, access } from "node:fs/promises";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

/** Plugin metadata from npm registry */
export interface NpmPluginMetadata {
  /** Package name */
  name: string;

  /** Version */
  version: string;

  /** Description */
  description?: string;

  /** Author */
  author?: string;

  /** Homepage URL */
  homepage?: string;

  /** Repository URL */
  repository?: string;

  /** License */
  license?: string;

  /** Keywords */
  keywords?: string[];

  /** Weekly downloads */
  downloads?: number;

  /** Latest version publish date */
  date?: string;

  /** Links */
  links?: {
    npm?: string;
    homepage?: string;
    repository?: string;
  };
}

/** Plugin details including README and manifest */
export interface NpmPluginDetails extends NpmPluginMetadata {
  /** README content */
  readme?: string;

  /** Plugin manifest content (parsed from plugin.yaml) */
  manifest?: {
    name: string;
    version: string;
    description: string;
    apiVersion: string;
    main: string;
    permissions: string[];
  };

  /** Maintainers */
  maintainers?: Array<{ name: string; email?: string }>;

  /** Dependencies */
  dependencies?: Record<string, string>;

  /** Peer dependencies */
  peerDependencies?: Record<string, string>;
}

/** Publish result */
export interface NpmPublishResult {
  /** Publish status */
  status: "published" | "failed";

  /** Published version */
  version?: string;

  /** Error message if failed */
  error?: string;
}

/** Validation result for plugin structure */
export interface NpmValidationResult {
  /** Validation status */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings: string[];
}

/** Create an NPM PluginRegistry service */
export function createNpmPluginRegistry() {
  /**
   * Search for ao-plugins on npm registry
   */
  async function search(query: string): Promise<NpmPluginMetadata[]> {
    try {
      // Add "ao-plugin" to the search query for better results
      const searchQuery = query.includes("ao-plugin") ? query : `ao-plugin ${query}`;

      const { stdout } = await execFileAsync(
        "npm",
        ["search", searchQuery, "--json", "--searchlimit", "50"],
        { timeout: 60000 },
      );

      const results = JSON.parse(stdout) as Array<{
        name: string;
        version: string;
        description: string;
        author?: { name?: string };
        keywords?: string[];
        links?: { homepage?: string; repository?: string };
        date?: string;
        score?: {
          final: number;
        };
      }>;

      return results
        .filter((pkg) => pkg.name.includes("ao-plugin"))
        .map((pkg) => ({
          name: pkg.name,
          version: pkg.version,
          description: pkg.description,
          author: pkg.author?.name,
          homepage: pkg.links?.homepage,
          repository: pkg.links?.repository,
          keywords: pkg.keywords,
          date: pkg.date,
          links: pkg.links,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  /**
   * Get plugin details from npm registry
   */
  async function getDetails(packageName: string): Promise<NpmPluginDetails | null> {
    try {
      const { stdout } = await execFileAsync("npm", ["view", packageName, "--json"], {
        timeout: 60000,
      });

      const pkg = JSON.parse(stdout) as {
        name: string;
        version: string;
        description?: string;
        author?: string | { name?: string };
        homepage?: string;
        repository?: string | { url?: string };
        license?: string;
        keywords?: string[];
        readme?: string;
        maintainers?: Array<{ name: string; email?: string }>;
        dependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
        time?: { [version: string]: string };
        links?: { homepage?: string; repository?: string };
      };

      return {
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        author: typeof pkg.author === "string" ? pkg.author : pkg.author?.name,
        homepage: pkg.homepage || pkg.links?.homepage,
        repository:
          typeof pkg.repository === "string"
            ? pkg.repository
            : pkg.repository?.url || pkg.links?.repository,
        license: pkg.license,
        keywords: pkg.keywords,
        readme: pkg.readme,
        maintainers: pkg.maintainers,
        dependencies: pkg.dependencies,
        peerDependencies: pkg.peerDependencies,
        date: pkg.time?.[pkg.version],
        links: pkg.links,
      };
    } catch {
      return null;
    }
  }

  /**
   * Validate plugin structure before publishing
   */
  async function validate(pluginPath: string): Promise<NpmValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if plugin.yaml exists
    const manifestPath = join(pluginPath, "plugin.yaml");
    try {
      await access(manifestPath);
    } catch {
      errors.push("plugin.yaml not found in plugin directory");
    }

    // Check if package.json exists
    const pkgJsonPath = join(pluginPath, "package.json");
    try {
      await access(pkgJsonPath);
    } catch {
      errors.push("package.json not found in plugin directory");
    }

    // Validate package.json
    if (errors.length === 0) {
      try {
        const pkgContent = await readFile(pkgJsonPath, "utf-8");
        const pkg = JSON.parse(pkgContent);

        // Check for required fields
        if (!pkg.name) {
          errors.push("package.json missing 'name' field");
        }

        if (!pkg.version) {
          errors.push("package.json missing 'version' field");
        }

        // Check if name contains "ao-plugin" keyword
        if (!pkg.name.includes("ao-plugin")) {
          errors.push("package.json name must include 'ao-plugin' (e.g., @scope/ao-plugin-name)");
        }

        // Check if name contains "ao-plugin" keyword
        if (!pkg.keywords?.includes("ao-plugin")) {
          warnings.push(
            'package.json should include "ao-plugin" in keywords for better discoverability',
          );
        }

        // Validate plugin.yaml
        const manifestContent = await readFile(manifestPath, "utf-8");
        const manifest = parseManifest(manifestContent);

        const requiredFields = [
          "name",
          "version",
          "description",
          "apiVersion",
          "main",
          "permissions",
        ];
        for (const field of requiredFields) {
          if (!manifest[field]) {
            errors.push(`plugin.yaml missing required field: ${field}`);
          }
        }

        // Check API version
        if (manifest.apiVersion && manifest.apiVersion !== "1.0.0") {
          warnings.push(
            `API version ${manifest.apiVersion} may not be compatible with current version 1.0.0`,
          );
        }

        // Check for main file
        const mainPath = join(pluginPath, (manifest.main || "index.js") as string);
        try {
          await access(mainPath);
        } catch {
          errors.push(`Main file not found: ${manifest.main || "index.js"}`);
        }
      } catch (error) {
        errors.push(
          `Failed to parse plugin files: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Publish plugin to npm registry
   */
  async function publish(pluginPath: string): Promise<NpmPublishResult> {
    // Validate first
    const validation = await validate(pluginPath);
    if (!validation.valid) {
      return {
        status: "failed",
        error: `Validation failed:\n${validation.errors.join("\n")}`,
      };
    }

    // Display warnings
    if (validation.warnings.length > 0) {
      console.log(`Warnings:\n${validation.warnings.join("\n")}`);
    }

    try {
      // Publish to npm
      await execFileAsync("npm", ["publish", "--access", "public"], {
        timeout: 120000,
        cwd: pluginPath,
      });

      // Extract version from package.json
      const pkgJsonPath = join(pluginPath, "package.json");
      const pkgContent = await readFile(pkgJsonPath, "utf-8");
      const pkg = JSON.parse(pkgContent);

      return {
        status: "published",
        version: pkg.version,
      };
    } catch (error) {
      return {
        status: "failed",
        error: error instanceof Error ? error.message : "Publish failed",
      };
    }
  }

  /**
   * Parse plugin.yaml manifest
   */
  function parseManifest(content: string): Partial<Record<string, unknown>> {
    const lines = content.split("\n");
    const manifest: Partial<Record<string, unknown>> = {
      permissions: [],
    };

    let currentKey: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || trimmed === "") {
        continue;
      }

      // List items
      if (trimmed.startsWith("-")) {
        const value = trimmed
          .slice(1)
          .trim()
          .replace(/^["']|["']$/g, "");
        if (currentKey === "permissions" && value) {
          (manifest.permissions as string[]).push(value);
        }
        continue;
      }

      // Key-value pairs
      if (trimmed.includes(":")) {
        const colonIndex = trimmed.indexOf(":");
        currentKey = trimmed.slice(0, colonIndex).trim();
        const value = trimmed
          .slice(colonIndex + 1)
          .trim()
          .replace(/^["']|["']$/g, "");

        if (currentKey && value) {
          manifest[currentKey] = value;
        }
      }
    }

    return manifest;
  }

  return {
    search,
    getDetails,
    validate,
    publish,
  };
}

/** Export the type for use in tests and other modules */
export type NpmPluginRegistry = ReturnType<typeof createNpmPluginRegistry>;
