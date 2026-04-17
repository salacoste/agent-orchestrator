import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig, createPluginRegistry, type OrchestratorConfig } from "@composio/ao-core";

export interface ProvidersData {
  providers: Array<{ name: string; slot: string; description: string; version: string }>;
  active: Array<{ scope: string; provider: string }>;
}

/**
 * Collect providers data from config and registry (testable without process.exit).
 * Accepts an optional importFn for testing with mock plugins.
 */
export async function collectProvidersData(
  config: OrchestratorConfig,
  importFn?: (pkg: string) => Promise<unknown>,
): Promise<ProvidersData> {
  const registry = createPluginRegistry();
  await registry.loadBuiltins(config, importFn);

  const manifests = registry.list("provider");

  const activeProviders: Array<{ scope: string; provider: string }> = [];
  const globalProvider = config.sessionEnhancement?.provider;
  if (globalProvider) {
    activeProviders.push({ scope: "global", provider: globalProvider });
  }
  for (const [projectId, project] of Object.entries(config.projects)) {
    const projectProvider = project.sessionEnhancement?.provider;
    if (projectProvider && projectProvider !== globalProvider) {
      activeProviders.push({
        scope: `project:${projectId}`,
        provider: projectProvider,
      });
    }
  }

  return { providers: manifests, active: activeProviders };
}

/**
 * Render registered providers as a table.
 */
function renderProvidersTable(
  manifests: Array<{ name: string; slot: string; description: string; version: string }>,
  activeProviders: Array<{ scope: string; provider: string }>,
): void {
  console.log(chalk.bold("\nRegistered Providers"));
  console.log(chalk.dim("─".repeat(60)));

  if (manifests.length === 0) {
    console.log(chalk.dim("  No provider plugins registered."));
  } else {
    const namePad = 20;
    const versionPad = 10;
    console.log(`${"Name".padEnd(namePad)}${"Version".padEnd(versionPad)}Description`);
    console.log(chalk.dim("─".repeat(60)));

    for (const m of manifests) {
      console.log(`${m.name.padEnd(namePad)}${m.version.padEnd(versionPad)}${m.description}`);
    }
  }

  console.log(chalk.dim("─".repeat(60)));

  if (activeProviders.length > 0) {
    console.log(chalk.bold("\nActive Configuration"));
    console.log(chalk.dim("─".repeat(40)));
    for (const entry of activeProviders) {
      console.log(`  ${chalk.dim(entry.scope + ":")} ${entry.provider}`);
    }
    console.log(chalk.dim("─".repeat(40)));
  }

  console.log();
}

export function registerProviders(program: Command): void {
  program
    .command("providers")
    .description("List registered session enhancement providers")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      const data = await collectProvidersData(config);

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        renderProvidersTable(data.providers, data.active);
      }

      process.exit(0);
    });
}
