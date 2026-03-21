/**
 * Review Stats Command — view code review analytics
 */

import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig, createReviewFindingsStore, getSessionsDir } from "@composio/ao-core";
import { join } from "node:path";

export function registerReviewStats(program: Command): void {
  program
    .command("review-stats")
    .description("View code review analytics")
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
      const store = createReviewFindingsStore({
        findingsPath: join(sessionsDir, "review-findings.jsonl"),
      });
      await store.start();

      const findings = store.list();

      if (opts.json) {
        const bySeverity: Record<string, number> = {};
        const byCategory: Record<string, number> = {};
        for (const f of findings) {
          bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
          byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
        }
        console.log(
          JSON.stringify(
            {
              total: findings.length,
              bySeverity,
              byCategory,
              fixRate:
                findings.length > 0
                  ? findings.filter((f) => f.resolution === "fixed").length / findings.length
                  : 0,
            },
            null,
            2,
          ),
        );
        return;
      }

      if (findings.length === 0) {
        console.log(chalk.yellow("\nNo review data available.\n"));
        return;
      }

      // Aggregate
      const bySeverity: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      for (const f of findings) {
        bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
        byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
      }

      const fixed = findings.filter((f) => f.resolution === "fixed").length;
      const fixRate = Math.round((fixed / findings.length) * 100);

      console.log(chalk.bold(`\n  Code Review Analytics (${findings.length} findings)\n`));

      console.log(chalk.dim("  Findings by Severity:"));
      for (const [sev, count] of Object.entries(bySeverity).sort((a, b) => b[1] - a[1])) {
        const bar = "█".repeat(Math.min(count, 30));
        const color = sev === "high" ? chalk.red : sev === "medium" ? chalk.yellow : chalk.green;
        console.log(`    ${color(sev.padEnd(8))} ${bar} ${count}`);
      }

      console.log(chalk.dim("\n  Top Issue Categories:"));
      const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
      for (let i = 0; i < Math.min(sorted.length, 5); i++) {
        console.log(`    ${i + 1}. ${sorted[i][0].padEnd(30)} ${sorted[i][1]} occurrences`);
      }

      console.log(`\n  Resolution Rate: ${fixRate}% (${fixed}/${findings.length} fixed)`);
      console.log("");
    });
}
