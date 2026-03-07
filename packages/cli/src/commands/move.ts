import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import {
  readSprintStatus,
  writeStoryStatus,
  appendHistory,
  batchWriteStoryStatus,
  checkWipLimit,
  validateDependencies,
  isValidColumn,
  getColumns,
} from "@composio/ao-plugin-tracker-bmad";
import { getTracker } from "../lib/plugins.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

interface MoveOpts {
  force?: boolean;
  json?: boolean;
  from?: string;
  to?: string;
  epic?: string;
  dryRun?: boolean;
}

export function registerMove(program: Command): void {
  program
    .command("move [story-id] [column] [project]")
    .description("Move story(s) to a sprint column. Use --from/--to for batch moves.")
    .option("--force", "Override WIP limit warnings")
    .option("--json", "Output as JSON")
    .option("--from <col>", "Batch: move all stories FROM this column")
    .option("--to <col>", "Batch: move all stories TO this column")
    .option("--epic <id>", "Batch: filter to stories in this epic")
    .option("--dry-run", "Show what would be moved without applying")
    .action(
      async (
        storyId: string | undefined,
        column: string | undefined,
        projectArg: string | undefined,
        opts: MoveOpts,
      ) => {
        let config: ReturnType<typeof loadConfig>;
        try {
          config = loadConfig();
        } catch {
          console.error(chalk.red("No config found. Run `ao init` first."));
          process.exit(1);
        }

        // Detect batch mode
        const isBatch = !!(opts.from && opts.to);

        // When using --from/--to, the positional args shift:
        // `ao move --from backlog --to ready-for-dev myproject`
        // Commander may put "myproject" in storyId slot
        const resolvedProjectArg = isBatch ? (storyId ?? projectArg) : projectArg;
        const projectId = resolveProject(config, resolvedProjectArg);
        const project = config.projects[projectId];
        if (!project) {
          console.error(chalk.red(`Project config not found: ${projectId}`));
          process.exit(1);
        }

        const tracker = getTracker(config, projectId);
        if (!tracker || tracker.name !== "bmad") {
          console.error(chalk.red("Story move requires the bmad tracker plugin."));
          process.exit(1);
        }

        if (isBatch) {
          await batchMove(project, opts);
        } else {
          if (!storyId || !column) {
            console.error(
              chalk.red("Usage: ao move <story-id> <column> or ao move --from <col> --to <col>"),
            );
            process.exit(1);
          }
          await singleMove(project, storyId, column, opts);
        }
      },
    );
}

async function singleMove(
  project: ReturnType<typeof loadConfig>["projects"][string],
  storyId: string,
  column: string,
  opts: MoveOpts,
): Promise<void> {
  if (!isValidColumn(project, column)) {
    const validCols = getColumns(project);
    console.error(chalk.red(`Invalid column: ${column}\nValid columns: ${validCols.join(", ")}`));
    process.exit(1);
  }

  let sprint;
  try {
    sprint = readSprintStatus(project);
  } catch (err) {
    console.error(
      chalk.red(
        `Failed to read sprint status: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    process.exit(1);
  }

  const entry = sprint.development_status[storyId];
  if (!entry) {
    console.error(chalk.red(`Story '${storyId}' not found in sprint-status.yaml`));
    process.exit(1);
  }

  const fromStatus = typeof entry.status === "string" ? entry.status : "backlog";
  if (fromStatus === column) {
    if (opts.json) {
      console.log(
        JSON.stringify(
          { storyId, from: fromStatus, to: column, moved: false, reason: "already_in_column" },
          null,
          2,
        ),
      );
      return;
    }
    console.log(chalk.yellow(`${storyId} is already in '${column}'.`));
    return;
  }

  // Check WIP limits
  if (!opts.force) {
    let wipExceeded = false;
    let wipMessage = "";
    try {
      const wipResult = checkWipLimit(project, column);
      if (!wipResult.allowed) {
        wipExceeded = true;
        wipMessage = `WIP limit reached for '${column}': ${wipResult.current}/${wipResult.limit}. Use --force to override.`;
      }
    } catch {
      // WIP check failure is non-fatal
    }
    if (wipExceeded) {
      console.error(chalk.yellow(wipMessage));
      process.exit(1);
    }
  }

  // Check dependencies (warn but don't block)
  const warnings: string[] = [];
  if (column === "in-progress" || column === "review") {
    try {
      const depResult = validateDependencies(storyId, project);
      if (depResult.blocked) {
        const blockerIds = depResult.blockers.map((b) => `${b.id} (${b.status})`).join(", ");
        warnings.push(`Blocked by unfinished dependencies: ${blockerIds}`);
      }
    } catch {
      // Non-fatal
    }
  }

  if (opts.dryRun) {
    if (opts.json) {
      console.log(
        JSON.stringify({ storyId, from: fromStatus, to: column, dryRun: true, warnings }, null, 2),
      );
    } else {
      console.log(`  [dry-run] ${storyId}: ${fromStatus} → ${column}`);
    }
    return;
  }

  // Perform the move
  try {
    writeStoryStatus(project, storyId, column);
    appendHistory(project, storyId, fromStatus, column);
  } catch (err) {
    console.error(
      chalk.red(`Failed to move story: ${err instanceof Error ? err.message : String(err)}`),
    );
    process.exit(1);
  }

  if (opts.json) {
    console.log(
      JSON.stringify({ storyId, from: fromStatus, to: column, moved: true, warnings }, null, 2),
    );
    return;
  }

  console.log(header(`Story Moved: ${storyId}`));
  console.log();
  console.log(`  ${chalk.dim(fromStatus)} → ${chalk.cyan(column)}`);
  for (const w of warnings) {
    console.log(`  ${chalk.yellow("⚠")} ${w}`);
  }
  console.log();
}

async function batchMove(
  project: ReturnType<typeof loadConfig>["projects"][string],
  opts: MoveOpts,
): Promise<void> {
  const fromCol = opts.from!;
  const toCol = opts.to!;
  const validCols = getColumns(project);

  if (!isValidColumn(project, fromCol)) {
    console.error(chalk.red(`Invalid --from column: ${fromCol}\nValid: ${validCols.join(", ")}`));
    process.exit(1);
  }
  if (!isValidColumn(project, toCol)) {
    console.error(chalk.red(`Invalid --to column: ${toCol}\nValid: ${validCols.join(", ")}`));
    process.exit(1);
  }

  let sprint;
  try {
    sprint = readSprintStatus(project);
  } catch (err) {
    console.error(
      chalk.red(
        `Failed to read sprint status: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    process.exit(1);
  }

  // Find matching stories
  const updates: Array<{ storyId: string; newStatus: string }> = [];
  for (const [id, entry] of Object.entries(sprint.development_status)) {
    const status = typeof entry.status === "string" ? entry.status : "backlog";
    if (id.startsWith("epic-") || status.startsWith("epic-")) continue;
    if (status !== fromCol) continue;
    if (opts.epic && entry.epic !== opts.epic) continue;
    updates.push({ storyId: id, newStatus: toCol });
  }

  if (updates.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ moved: [], count: 0 }, null, 2));
    } else {
      console.log(
        chalk.yellow(
          `No stories found in '${fromCol}'${opts.epic ? ` (epic: ${opts.epic})` : ""}.`,
        ),
      );
    }
    return;
  }

  // Check WIP limits for target column
  if (!opts.force) {
    let wipExceeded = false;
    let wipMessage = "";
    try {
      const wipResult = checkWipLimit(project, toCol);
      if (!wipResult.allowed) {
        wipExceeded = true;
        wipMessage = `WIP limit already reached for '${toCol}': ${wipResult.current}/${wipResult.limit}. Use --force to override.`;
      }
    } catch {
      // Non-fatal
    }
    if (wipExceeded) {
      console.error(chalk.yellow(wipMessage));
      process.exit(1);
    }
  }

  if (opts.dryRun) {
    if (opts.json) {
      console.log(JSON.stringify({ dryRun: true, moves: updates, count: updates.length }, null, 2));
    } else {
      console.log(header(`Batch Move (dry run): ${fromCol} → ${toCol}`));
      console.log();
      for (const u of updates) {
        console.log(`  [dry-run] ${u.storyId}: ${fromCol} → ${toCol}`);
      }
      console.log();
      console.log(chalk.dim(`  ${updates.length} stories would be moved.`));
      console.log();
    }
    return;
  }

  // Execute batch move
  const moved = batchWriteStoryStatus(project, updates);

  if (opts.json) {
    console.log(JSON.stringify({ moved, count: moved.length }, null, 2));
    return;
  }

  console.log(header(`Batch Move: ${fromCol} → ${toCol}`));
  console.log();
  for (const id of moved) {
    console.log(`  ${chalk.green("✓")} ${id}`);
  }
  console.log();
  console.log(chalk.dim(`  ${moved.length} stories moved.`));
  console.log();
}
