/**
 * ao compare — Multi-metric sprint comparison across weeks.
 *
 * Usage:
 *   ao compare [project]
 *   ao compare [project] --weeks 6 --epic epic-auth --json
 */

import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { computeSprintComparison, type MetricTrend } from "@composio/ao-plugin-tracker-bmad";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

function formatMs(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

const TREND_ICONS: Record<MetricTrend, string> = {
  improving: chalk.green("\u2191"),
  stable: chalk.yellow("\u2192"),
  declining: chalk.red("\u2193"),
};

export function registerCompare(program: Command): void {
  program
    .command("compare [project]")
    .description("Compare sprint metrics across weeks")
    .option("--weeks <n>", "Number of weeks (default 4)", "4")
    .option("--epic <id>", "Filter by epic ID")
    .option("--json", "Output as JSON")
    .action(
      async (
        projectArg: string | undefined,
        opts: { weeks?: string; epic?: string; json?: boolean },
      ) => {
        let config: ReturnType<typeof loadConfig>;
        try {
          config = loadConfig();
        } catch {
          console.error(chalk.red("No config found. Run `ao init` first."));
          process.exit(1);
        }

        const projectId = resolveProject(config, projectArg);
        const project = config.projects[projectId];
        if (!project) {
          console.error(chalk.red(`Project config not found: ${projectId}`));
          process.exit(1);
        }

        if (!project.tracker || project.tracker.plugin !== "bmad") {
          console.error(chalk.red("Compare requires the bmad tracker plugin."));
          process.exit(1);
        }

        const weeks = parseInt(opts.weeks ?? "4", 10) || 4;

        let result: ReturnType<typeof computeSprintComparison>;
        try {
          result = computeSprintComparison(project, { weeks, epicFilter: opts.epic });
        } catch (err) {
          console.error(
            chalk.red(
              `Failed to compute comparison: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log(header(`Sprint Comparison: ${project.name || projectId}`));
        console.log();

        if (result.periods.length === 0) {
          console.log(chalk.dim("  No data available."));
          console.log();
          return;
        }

        // Trends header
        console.log(chalk.bold("  Trends"));
        console.log(
          `    Velocity: ${result.trends.velocity} ${TREND_ICONS[result.trends.velocity]}  ` +
            `Cycle Time: ${result.trends.cycleTime} ${TREND_ICONS[result.trends.cycleTime]}  ` +
            `Flow Eff: ${result.trends.flowEfficiency} ${TREND_ICONS[result.trends.flowEfficiency]}  ` +
            `WIP: ${result.trends.wip} ${TREND_ICONS[result.trends.wip]}`,
        );
        console.log();

        // Table
        const colWidths = { week: 12, vel: 8, ct: 10, fe: 8, wip: 6, co: 6, bn: 14 };
        const hdr =
          chalk.dim("Week".padEnd(colWidths.week)) +
          chalk.dim("Vel".padStart(colWidths.vel)) +
          chalk.dim("CycleT".padStart(colWidths.ct)) +
          chalk.dim("FlowE".padStart(colWidths.fe)) +
          chalk.dim("WIP".padStart(colWidths.wip)) +
          chalk.dim("CO".padStart(colWidths.co)) +
          chalk.dim("Bottleneck".padStart(colWidths.bn));
        console.log(`  ${hdr}`);

        for (const p of result.periods) {
          const ws = p.weekStart.slice(5);
          const vel = String(p.completedCount);
          const ct = p.avgCycleTimeMs > 0 ? formatMs(p.avgCycleTimeMs) : "-";
          const fe = `${Math.round(p.flowEfficiency * 100)}%`;
          const wip = String(Math.round(p.avgWip));
          const co = String(p.carryOverCount);
          const bn = p.bottleneckColumn ?? "-";

          console.log(
            `  ${ws.padEnd(colWidths.week)}${vel.padStart(colWidths.vel)}${ct.padStart(colWidths.ct)}${fe.padStart(colWidths.fe)}${wip.padStart(colWidths.wip)}${co.padStart(colWidths.co)}${bn.padStart(colWidths.bn)}`,
          );
        }
        console.log();
      },
    );
}
