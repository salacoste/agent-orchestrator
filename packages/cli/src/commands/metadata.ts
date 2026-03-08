import chalk from "chalk";
import type { Command } from "commander";
import { join } from "node:path";
import { createStateManager, expandHome, loadConfig, type StateManager } from "@composio/ao-core";

export function registerMetadata(program: Command): void {
  const metadataCmd = program.command("metadata").description("Verify metadata integrity");

  // Verify YAML metadata
  metadataCmd
    .command("verify")
    .description("Verify YAML metadata file integrity")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      // Get the sprint-status.yaml path from implementation artifacts directory
      const yamlPath = expandHome(
        join(".", "_bmad-output", "implementation-artifacts", "sprint-status.yaml"),
      );

      const stateManager = createStateManager({
        yamlPath,
      }) as StateManager;

      try {
        const result = await stateManager.verify();

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log(chalk.bold("YAML Metadata Verification\n"));

        if (result.valid) {
          console.log(`  Status: ${chalk.green("✓ Valid")}`);
          if (result.recovered) {
            console.log(`  ${chalk.yellow("⚠ Recovered from corruption")}`);
          }
          console.log(`  File: ${yamlPath}`);
        } else {
          console.log(`  Status: ${chalk.red("✗ Invalid")}`);
          console.log(`  File: ${yamlPath}`);
          console.log(`  Error: ${chalk.red(result.error || "Unknown error")}`);

          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red("Verification failed:"), (error as Error).message);
        process.exit(1);
      } finally {
        await stateManager.close();
      }
    });
}
