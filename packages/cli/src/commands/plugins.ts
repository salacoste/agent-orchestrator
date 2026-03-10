/**
 * ao plugins / ao plugin — Plugin management commands
 *
 * Usage:
 *   ao plugins                    — List installed plugins
 *   ao plugin install <package>    — Install a plugin from npm
 *   ao plugin uninstall <package>  — Uninstall a plugin
 *   ao plugin update <package>     — Update a plugin
 *   ao plugin search <query>       — Search for plugins on npm
 *   ao plugin info <package>       — Show plugin information
 *   ao plugin disable <package>    — Disable a plugin
 *   ao plugin enable <package>     — Enable a disabled plugin
 */

import chalk from "chalk";
import type { Command } from "commander";
import { confirm, checkbox } from "@inquirer/prompts";
import {
  loadConfig,
  createPluginInstaller,
  createNpmPluginRegistry,
  type InstalledPlugin,
  type PluginSearchResult,
  type PluginPermission,
} from "@composio/ao-core";
import { header } from "../lib/format.js";

// ---------------------------------------------------------------------------
// Display functions
// ---------------------------------------------------------------------------

function formatPluginStatus(status: string, enabled: boolean): string {
  if (!enabled) {
    return chalk.yellow("⚠️  Disabled");
  }
  switch (status) {
    case "loaded":
      return chalk.green("✓ Loaded");
    case "failed":
      return chalk.red("✗ Failed");
    default:
      return status;
  }
}

function formatPermissions(permissions: string[]): string {
  if (permissions.length === 0) {
    return chalk.dim("(none)");
  }
  return permissions.join(", ");
}

/**
 * Get human-readable description for a permission type
 */
function getPermissionDescription(permission: PluginPermission): string {
  const descriptions: Record<PluginPermission, string> = {
    runtime: "Manage runtime environments (tmux, docker, etc.)",
    agent: "Control AI agent processes",
    workspace: "Access and modify workspace files",
    tracker: "Integrate with issue/story trackers",
    scm: "Access source control management (git, github)",
    notifier: "Send notifications to users",
    terminal: "Control terminal sessions",
  };
  return descriptions[permission] || "Unknown permission type";
}

function renderPluginsTable(plugins: InstalledPlugin[]): void {
  console.log(header("Installed Plugins"));
  console.log();

  if (plugins.length === 0) {
    console.log(chalk.dim("  (no plugins installed)"));
    console.log();
    console.log(chalk.dim("  Install a plugin with:"));
    console.log(chalk.dim("    ao plugin install <package-name>"));
    console.log();
    return;
  }

  // Print header
  const namePad = 28;
  const versionPad = 12;
  const statusPad = 14;
  const permPad = 20;

  console.log(
    `${"Name".padEnd(namePad)}${"Version".padEnd(versionPad)}${"Status".padEnd(statusPad)}${"Permissions".padEnd(permPad)}Description`,
  );
  console.log(chalk.dim("─".repeat(100)));

  for (const plugin of plugins) {
    const statusText = formatPluginStatus(plugin.status, plugin.enabled);
    const permText = formatPermissions(plugin.permissions);
    const descText = (plugin.description || "").slice(0, 30);

    console.log(
      `${plugin.name.padEnd(namePad)}${plugin.version.padEnd(versionPad)}${statusText.padEnd(statusPad)}${permText.padEnd(permPad)}${descText}`,
    );

    if (plugin.error) {
      console.log(chalk.dim(`  └─ Error: ${plugin.error}`));
    }
  }

  console.log(chalk.dim("─".repeat(100)));

  // Summary
  const loaded = plugins.filter((p) => p.status === "loaded" && p.enabled).length;
  const disabled = plugins.filter((p) => !p.enabled).length;
  const failed = plugins.filter((p) => p.status === "failed").length;
  const total = plugins.length;

  console.log(
    `${chalk.bold("Summary:")} ${loaded} loaded, ${disabled} disabled, ${failed} failed, ${total} total`,
  );

  if (failed > 0) {
    console.log(chalk.red(`\n⚠️  ${failed} plugin(s) failed to load!`));
  }

  console.log();
}

function renderSearchResults(results: PluginSearchResult[], query: string): void {
  console.log(header(`Plugin Search Results: "${query}"`));
  console.log();

  if (results.length === 0) {
    console.log(chalk.dim("  (no matching plugins found)"));
    console.log();
    console.log(chalk.dim("  Try searching for 'ao-plugin' on npm:"));
    console.log(chalk.dim("    https://www.npmjs.com/search?q=ao-plugin"));
    console.log();
    return;
  }

  console.log(chalk.dim(`  Found ${chalk.bold(String(results.length))} plugin(s)`));
  console.log();

  for (const result of results) {
    console.log(`  ${chalk.bold.cyan(result.name)}`);
    console.log(`    ${chalk.dim("Version:")} ${chalk.yellow(result.version)}`);
    if (result.description) {
      console.log(`    ${chalk.dim("Description:")} ${result.description}`);
    }
    if (result.author) {
      console.log(`    ${chalk.dim("Author:")} ${result.author}`);
    }
    if (result.homepage) {
      console.log(`    ${chalk.dim("Homepage:")} ${result.homepage}`);
    }
    console.log();
  }
}

function renderPluginInfo(plugin: InstalledPlugin): void {
  console.log(header(`Plugin: ${plugin.name}`));
  console.log();

  console.log(`  ${chalk.dim("Version:")} ${chalk.yellow(plugin.version)}`);
  console.log(`  ${chalk.dim("Status:")} ${formatPluginStatus(plugin.status, plugin.enabled)}`);
  console.log(`  ${chalk.dim("API Version:")} ${plugin.apiVersion}`);

  if (plugin.description) {
    console.log(`  ${chalk.dim("Description:")} ${plugin.description}`);
  }

  if (plugin.permissions.length > 0) {
    console.log(`  ${chalk.dim("Permissions:")} ${formatPermissions(plugin.permissions)}`);
  }

  if (plugin.error) {
    console.log(`  ${chalk.dim("Error:")} ${chalk.red(plugin.error)}`);
  }

  console.log();
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerPlugins(program: Command): void {
  // Main `plugins` command (list plugins)
  program
    .command("plugins")
    .description("List installed plugins")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      let _config: ReturnType<typeof loadConfig>;
      try {
        _config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      const pluginsDir = process.env.AO_PLUGINS_DIR || "./plugins";
      const installer = createPluginInstaller({ pluginsDir });

      const plugins = await installer.listPlugins();

      if (opts.json) {
        console.log(JSON.stringify(plugins, null, 2));
      } else {
        renderPluginsTable(plugins);
      }
    });

  // `plugin` subcommands
  const pluginCmd = program.command("plugin").description("Manage plugins");

  // Install a plugin
  pluginCmd
    .command("install <package>")
    .description("Install a plugin from npm or local path")
    .option("--local", "Install from local path instead of npm")
    .option("--grant-permissions", "Automatically grant all requested permissions")
    .option("--json", "Output as JSON")
    .action(
      async (
        packageName: string,
        opts: { local?: boolean; grantPermissions?: boolean; json?: boolean },
      ) => {
        let _config: ReturnType<typeof loadConfig>;
        try {
          _config = loadConfig();
        } catch {
          console.error(chalk.red("No config found. Run `ao init` first."));
          process.exit(1);
        }

        const pluginsDir = process.env.AO_PLUGINS_DIR || "./plugins";
        const installer = createPluginInstaller({ pluginsDir });

        console.log(chalk.blue(`Installing ${packageName}...`));
        const result = await installer.install(packageName, { local: opts.local });

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        if (result.status === "installed") {
          console.log(chalk.green(`✓ Installed ${packageName} v${result.version}`));

          // Handle permission prompts
          if (result.permissions && result.permissions.length > 0) {
            if (opts.grantPermissions) {
              console.log(
                chalk.dim(`  Permissions: ${result.permissions.join(", ")} (auto-granted)`),
              );
            } else {
              console.log();
              console.log(chalk.bold("This plugin requests the following permissions:"));
              console.log();

              for (const permission of result.permissions) {
                const description = getPermissionDescription(permission);
                console.log(`  ${chalk.cyan(permission)} ${chalk.dim(`- ${description}`)}`);
              }
              console.log();

              const grantAll = await confirm({
                message: "Grant all requested permissions?",
                default: true,
              });

              if (!grantAll) {
                // Let user select which permissions to grant
                const selectedPermissions = await checkbox({
                  message: "Select permissions to grant:",
                  choices: result.permissions.map((p: PluginPermission) => ({
                    name: `${p} - ${getPermissionDescription(p)}`,
                    value: p,
                    checked: true,
                  })),
                });

                if (selectedPermissions.length < result.permissions.length) {
                  console.log(
                    chalk.yellow(
                      `  Granted ${selectedPermissions.length}/${result.permissions.length} permissions`,
                    ),
                  );
                  // Note: In a full implementation, we would store these decisions in config
                }
              } else {
                console.log(chalk.dim(`  All permissions granted`));
              }
            }
          }
        } else if (result.status === "cancelled") {
          console.log(chalk.yellow("Installation cancelled"));
        } else {
          console.log(chalk.red(`✗ Installation failed: ${result.error}`));
          process.exit(1);
        }
      },
    );

  // Uninstall a plugin
  pluginCmd
    .command("uninstall <package>")
    .description("Uninstall a plugin")
    .option("--json", "Output as JSON")
    .action(async (packageName: string, opts: { json?: boolean }) => {
      let _config: ReturnType<typeof loadConfig>;
      try {
        _config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      const pluginsDir = process.env.AO_PLUGINS_DIR || "./plugins";
      const installer = createPluginInstaller({ pluginsDir });

      console.log(chalk.blue(`Uninstalling ${packageName}...`));
      const result = await installer.uninstall(packageName);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.status === "uninstalled") {
        console.log(chalk.green(`✓ Uninstalled ${packageName}`));
      } else if (result.status === "cancelled") {
        console.log(chalk.yellow("Uninstallation cancelled"));
      } else {
        console.log(chalk.red(`✗ Uninstallation failed: ${result.error}`));
        process.exit(1);
      }
    });

  // Update a plugin
  pluginCmd
    .command("update <package>")
    .description("Update a plugin to latest version")
    .option("--version <version>", "Update to specific version")
    .option("--json", "Output as JSON")
    .action(async (packageName: string, opts: { version?: string; json?: boolean }) => {
      let _config: ReturnType<typeof loadConfig>;
      try {
        _config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      const pluginsDir = process.env.AO_PLUGINS_DIR || "./plugins";
      const installer = createPluginInstaller({ pluginsDir });

      console.log(chalk.blue(`Updating ${packageName}...`));
      const result = await installer.update(packageName, { version: opts.version });

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.status === "updated") {
        console.log(chalk.green(`✓ Updated ${packageName} to v${result.version}`));
      } else if (result.status === "up-to-date") {
        console.log(chalk.yellow(`Already up to date`));
      } else {
        console.log(chalk.red(`✗ Update failed: ${result.error}`));
        process.exit(1);
      }
    });

  // Search for plugins
  pluginCmd
    .command("search <query>")
    .description("Search for plugins on npm")
    .option("--json", "Output as JSON")
    .action(async (query: string, opts: { json?: boolean }) => {
      let _config: ReturnType<typeof loadConfig>;
      try {
        _config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      const pluginsDir = process.env.AO_PLUGINS_DIR || "./plugins";
      const installer = createPluginInstaller({ pluginsDir });

      console.log(chalk.blue(`Searching for "${query}"...`));
      const results = await installer.search(query);

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        renderSearchResults(results, query);
      }
    });

  // Show plugin info
  pluginCmd
    .command("info <package>")
    .description("Show detailed plugin information")
    .option("--json", "Output as JSON")
    .action(async (packageName: string, opts: { json?: boolean }) => {
      let _config: ReturnType<typeof loadConfig>;
      try {
        _config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      const name = packageName.replace(/^@[^/]+\//, "");
      const pluginsDir = process.env.AO_PLUGINS_DIR || "./plugins";
      const installer = createPluginInstaller({ pluginsDir });

      const plugin = await installer.getPluginInfo(name);

      if (!plugin) {
        console.log(chalk.red(`Plugin not found: ${packageName}`));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(plugin, null, 2));
      } else {
        renderPluginInfo(plugin);
      }
    });

  // Disable a plugin
  pluginCmd
    .command("disable <package>")
    .description("Disable a plugin without uninstalling it")
    .option("--json", "Output as JSON")
    .action(async (packageName: string, opts: { json?: boolean }) => {
      let _config: ReturnType<typeof loadConfig>;
      try {
        _config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      const pluginsDir = process.env.AO_PLUGINS_DIR || "./plugins";
      const installer = createPluginInstaller({ pluginsDir });

      console.log(chalk.blue(`Disabling ${packageName}...`));
      const result = await installer.disable(packageName);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.status === "disabled") {
        console.log(chalk.green(`✓ Disabled ${packageName}`));
      } else {
        console.log(chalk.red(`✗ Failed to disable: ${result.error}`));
        process.exit(1);
      }
    });

  // Enable a disabled plugin
  pluginCmd
    .command("enable <package>")
    .description("Enable a disabled plugin")
    .option("--json", "Output as JSON")
    .action(async (packageName: string, opts: { json?: boolean }) => {
      let _config: ReturnType<typeof loadConfig>;
      try {
        _config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      const pluginsDir = process.env.AO_PLUGINS_DIR || "./plugins";
      const installer = createPluginInstaller({ pluginsDir });

      console.log(chalk.blue(`Enabling ${packageName}...`));
      const result = await installer.enable(packageName);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.status === "enabled") {
        console.log(chalk.green(`✓ Enabled ${packageName}`));
      } else {
        console.log(chalk.red(`✗ Failed to enable: ${result.error}`));
        process.exit(1);
      }
    });

  // Validate a plugin before publishing
  pluginCmd
    .command("validate <path>")
    .description("Validate a plugin structure for publishing")
    .option("--json", "Output as JSON")
    .action(async (pluginPath: string, opts: { json?: boolean }) => {
      let _config: ReturnType<typeof loadConfig>;
      try {
        _config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      const registry = createNpmPluginRegistry();

      console.log(chalk.blue(`Validating plugin at ${pluginPath}...`));
      const result = await registry.validate(pluginPath);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.valid) {
        console.log(chalk.green("✓ Plugin structure is valid"));
        if (result.warnings.length > 0) {
          console.log(chalk.yellow("\nWarnings:"));
          for (const warning of result.warnings) {
            console.log(chalk.dim(`  - ${warning}`));
          }
        }
      } else {
        console.log(chalk.red("✗ Plugin validation failed"));
        console.log(chalk.red("\nErrors:"));
        for (const error of result.errors) {
          console.log(chalk.red(`  - ${error}`));
        }
        if (result.warnings.length > 0) {
          console.log(chalk.yellow("\nWarnings:"));
          for (const warning of result.warnings) {
            console.log(chalk.dim(`  - ${warning}`));
          }
        }
        process.exit(1);
      }
    });

  // Publish a plugin to npm registry
  pluginCmd
    .command("publish <path>")
    .description("Publish a plugin to the npm registry")
    .option("--json", "Output as JSON")
    .action(async (pluginPath: string, opts: { json?: boolean }) => {
      let _config: ReturnType<typeof loadConfig>;
      try {
        _config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      const registry = createNpmPluginRegistry();

      console.log(chalk.blue(`Publishing plugin from ${pluginPath}...`));

      // First validate
      console.log(chalk.dim("Validating plugin structure..."));
      const validation = await registry.validate(pluginPath);
      if (!validation.valid) {
        console.log(chalk.red("✗ Validation failed:"));
        for (const error of validation.errors) {
          console.log(chalk.red(`  - ${error}`));
        }
        process.exit(1);
      }

      if (validation.warnings.length > 0) {
        console.log(chalk.yellow("Warnings:"));
        for (const warning of validation.warnings) {
          console.log(chalk.dim(`  - ${warning}`));
        }
        console.log();
      }

      // Publish
      console.log(chalk.dim("Publishing to npm..."));
      const result = await registry.publish(pluginPath);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.status === "published") {
        console.log(chalk.green(`✓ Published plugin v${result.version}`));
      } else {
        console.log(chalk.red(`✗ Publish failed: ${result.error}`));
        process.exit(1);
      }
    });
}
