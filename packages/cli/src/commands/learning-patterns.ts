/**
 * Learning Patterns Command — view detected failure patterns
 */

import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig, createLearningStore, getSessionsDir, detectPatterns } from "@composio/ao-core";
import { join } from "node:path";

/**
 * Register the learning-patterns command
 */
export function registerLearningPatterns(program: Command): void {
  program
    .command("learning-patterns")
    .description("View detected failure patterns from agent sessions")
    .option("--json", "Output as JSON", false)
    .action(async (opts: { json?: boolean }) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.error(chalk.red("No config found. Run `ao init` first."));
        process.exit(1);
      }

      const cwd = process.cwd();
      const projectId = Object.keys(config.projects).find((id) =>
        cwd.startsWith(config.projects[id].path),
      );

      if (!projectId) {
        console.error(chalk.red("Not in a project directory."));
        process.exit(1);
      }

      const sessionsDir = getSessionsDir(config.configPath, projectId);
      const store = createLearningStore({ learningsPath: join(sessionsDir, "learnings.jsonl") });
      await store.start();

      const patterns = detectPatterns(store.list());

      if (opts.json) {
        console.log(JSON.stringify(patterns, null, 2));
        return;
      }

      if (patterns.length === 0) {
        console.log(chalk.yellow("\nNo recurring failure patterns detected.\n"));
        return;
      }

      console.log(chalk.bold(`\n  Failure Patterns (${patterns.length} detected)\n`));
      console.log(
        chalk.dim(
          `  ${"Pattern".padEnd(25)} ${"Count".padEnd(8)} ${"Stories".padEnd(8)} ${"Last Seen".padEnd(14)} Suggested Action`,
        ),
      );
      console.log(
        chalk.dim(
          `  ${"─".repeat(25)} ${"─".repeat(8)} ${"─".repeat(8)} ${"─".repeat(14)} ${"─".repeat(30)}`,
        ),
      );

      for (const p of patterns) {
        const pattern = p.category.padEnd(25);
        const count = String(p.occurrenceCount).padEnd(8);
        const stories = String(p.affectedStories.length).padEnd(8);
        const lastSeen = p.lastOccurrence.split("T")[0].padEnd(14);

        console.log(
          `  ${chalk.red(pattern)} ${count} ${stories} ${lastSeen} ${chalk.dim(p.suggestedAction)}`,
        );
      }

      console.log("");
    });
}
