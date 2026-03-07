import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { readSprintStatus, writeStoryPoints, getPoints } from "@composio/ao-plugin-tracker-bmad";
import { getTracker } from "../lib/plugins.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

interface PointsOpts {
  json?: boolean;
  bulk?: string[];
}

export function registerPoints(program: Command): void {
  program
    .command("points [story-id] [points] [project]")
    .description("View or set story points. Use --bulk for batch updates.")
    .option("--json", "Output as JSON")
    .option("--bulk <assignments...>", "Set multiple points: --bulk s1=3 s2=5")
    .action(
      async (
        storyId: string | undefined,
        pointsArg: string | undefined,
        projectArg: string | undefined,
        opts: PointsOpts,
      ) => {
        let config: ReturnType<typeof loadConfig>;
        try {
          config = loadConfig();
        } catch {
          console.error(chalk.red("No config found. Run `ao init` first."));
          process.exit(1);
        }

        // When using --bulk, positional args shift
        const resolvedProjectArg = opts.bulk ? (storyId ?? projectArg) : projectArg;
        const projectId = resolveProject(config, resolvedProjectArg);
        const project = config.projects[projectId];
        if (!project) {
          console.error(chalk.red(`Project config not found: ${projectId}`));
          process.exit(1);
        }

        // Verify tracker is bmad
        const tracker = getTracker(config, projectId);
        if (!tracker || tracker.name !== "bmad") {
          console.error(chalk.red("Story points require the bmad tracker plugin."));
          process.exit(1);
        }

        // Bulk mode: --bulk s1=3 s2=5
        if (opts.bulk) {
          const results: Array<{ storyId: string; points: number }> = [];
          const errors: string[] = [];

          for (const assignment of opts.bulk) {
            const eqIdx = assignment.indexOf("=");
            if (eqIdx === -1) {
              errors.push(`Invalid format: '${assignment}' (expected id=points)`);
              continue;
            }
            const sid = assignment.slice(0, eqIdx);
            const pts = parseInt(assignment.slice(eqIdx + 1), 10);
            if (!sid || isNaN(pts) || pts < 0 || !Number.isInteger(pts)) {
              errors.push(`Invalid assignment: '${assignment}'`);
              continue;
            }

            try {
              writeStoryPoints(project, sid, pts);
              results.push({ storyId: sid, points: pts });
            } catch (err) {
              errors.push(`${sid}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }

          if (opts.json) {
            console.log(
              JSON.stringify({ updated: results, errors, count: results.length }, null, 2),
            );
            return;
          }

          if (results.length > 0) {
            console.log(header("Bulk Points Update"));
            console.log();
            for (const r of results) {
              console.log(
                `  ${chalk.green("\u2713")} ${r.storyId} = ${r.points} point${r.points === 1 ? "" : "s"}`,
              );
            }
            console.log();
          }
          for (const e of errors) {
            console.error(chalk.red(`  ${e}`));
          }
          if (results.length > 0) {
            console.log(chalk.dim(`  ${results.length} stories updated.`));
            console.log();
          }
          return;
        }

        if (!storyId) {
          console.error(
            chalk.red("Usage: ao points <story-id> [points] or ao points --bulk s1=3 s2=5"),
          );
          process.exit(1);
        }

        // Set points
        if (pointsArg !== undefined) {
          const points = parseInt(pointsArg, 10);
          if (isNaN(points) || points < 0 || !Number.isInteger(points)) {
            console.error(chalk.red("Points must be a non-negative integer."));
            process.exit(1);
          }

          try {
            writeStoryPoints(project, storyId, points);
          } catch (err) {
            console.error(
              chalk.red(
                `Failed to set points: ${err instanceof Error ? err.message : String(err)}`,
              ),
            );
            process.exit(1);
          }

          if (opts.json) {
            console.log(JSON.stringify({ storyId, points }, null, 2));
            return;
          }

          console.log(chalk.green(`Set ${storyId} to ${points} point${points === 1 ? "" : "s"}.`));
          return;
        }

        // View points
        try {
          const sprint = readSprintStatus(project);
          const entry = sprint.development_status[storyId];
          if (!entry) {
            console.error(chalk.red(`Story '${storyId}' not found in sprint-status.yaml`));
            process.exit(1);
          }

          const points = getPoints(entry);
          const hasExplicit = typeof entry.points === "number";

          if (opts.json) {
            console.log(JSON.stringify({ storyId, points, explicit: hasExplicit }, null, 2));
            return;
          }

          console.log(header(`Story Points: ${storyId}`));
          console.log();
          console.log(
            `  Points: ${chalk.cyan(String(points))}${hasExplicit ? "" : chalk.dim(" (default)")}`,
          );
          console.log();
        } catch (err) {
          console.error(
            chalk.red(`Failed to read points: ${err instanceof Error ? err.message : String(err)}`),
          );
          process.exit(1);
        }
      },
    );
}
