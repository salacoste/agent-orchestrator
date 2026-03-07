/**
 * Conflict Resolution Command
 *
 * Detect and resolve version conflicts using optimistic locking.
 * Provides three resolution strategies: overwrite, retry, and merge.
 */

import chalk from "chalk";
import type { Command } from "commander";
import {
  loadConfig,
  createStateManager,
  createConflictResolver,
  type Conflict,
  type Resolution,
} from "@composio/ao-core";

/**
 * Display conflict details in human-readable format
 */
function displayConflict(conflict: Conflict): void {
  console.log(chalk.red.bold(`\n  Conflict detected: ${conflict.storyId}`));
  console.log();
  console.log(`  Version Mismatch:`);
  console.log(`    Expected: ${chalk.yellow(conflict.expectedVersion)}`);
  console.log(`    Actual:   ${chalk.yellow(conflict.actualVersion)}`);
  console.log();
  console.log(`  Conflicting Fields (Side-by-Side Diff):`);

  // Calculate max field length for formatting
  const maxFieldLength = Math.max(...conflict.conflicts.map((c) => c.field.length));

  // Header
  const headerCol = maxFieldLength + 4;
  console.log(`  ┌${"─".repeat(headerCol)}┬${"─".repeat(30)}┬${"─".repeat(30)}┐`);
  console.log(
    `  │ ${chalk.bold("Field").padEnd(headerCol)} │ ${chalk.bold("Current (v2)").padEnd(30)} │ ${chalk.bold("Proposed (v1)").padEnd(30)} │`,
  );
  console.log(`  ├${"─".repeat(headerCol)}┼${"─".repeat(30)}┼${"─".repeat(30)}┤`);

  // Field rows
  for (const fieldConflict of conflict.conflicts) {
    const field = fieldConflict.field.padEnd(headerCol);
    const currentVal = String(fieldConflict.currentValue).substring(0, 28).padEnd(30);
    const proposedVal = String(fieldConflict.proposedValue).substring(0, 28).padEnd(30);
    console.log(`  │ ${field} │ ${currentVal} │ ${proposedVal} │`);
  }

  console.log(`  └${"─".repeat(headerCol)}┴${"─".repeat(30)}┴${"─".repeat(30)}┘`);
  console.log();
}

/**
 * Display conflict details in JSON format
 */
function displayConflictJson(conflict: Conflict): void {
  const output = {
    conflict: true,
    storyId: conflict.storyId,
    expectedVersion: conflict.expectedVersion,
    actualVersion: conflict.actualVersion,
    conflicts: conflict.conflicts.map((c) => ({
      field: c.field,
      currentValue: c.currentValue,
      proposedValue: c.proposedValue,
    })),
  };
  console.log(JSON.stringify(output, null, 2));
}

/**
 * Display resolution options
 */
function displayResolutionOptions(): void {
  console.log(`  Resolution Options:`);
  console.log(`    ${chalk.green("[O]verwrite")} - Apply my changes (discards current state)`);
  console.log(`    ${chalk.green("[R]etry")}     - Refresh and reapply my changes`);
  console.log(`    ${chalk.green("[M]erge")}     - Manually merge both versions`);
  console.log();
}

/**
 * Parse resolution from input string
 */
function parseResolution(input: string): Resolution | null {
  const normalized = input.toLowerCase().trim();
  switch (normalized) {
    case "o":
    case "overwrite":
      return "overwrite";
    case "r":
    case "retry":
      return "retry";
    case "m":
    case "merge":
      return "merge";
    default:
      return null;
  }
}

export function registerResolveConflicts(program: Command): void {
  program
    .command("resolve-conflicts [storyId]")
    .description("Detect and resolve version conflicts")
    .option("--auto <strategy>", "Auto-resolve strategy: overwrite, retry, merge")
    .option("--format <format>", "Output format: human, json", "human")
    .option("--expected-version <version>", "Expected version for conflict detection")
    .option("--proposed-status <status>", "Proposed status value")
    .option("--proposed-agent <agent>", "Proposed assigned agent value")
    .action(async (storyId: string | undefined, opts) => {
      const startTime = Date.now();

      // Load config
      const config = loadConfig();
      if (!config) {
        console.error(chalk.red("No agent-orchestrator.yaml found. Run 'ao init' first."));
        process.exit(1);
      }

      // Find current project
      const cwd = process.cwd();
      let projectPath: string | null = null;
      for (const [_id, proj] of Object.entries(config.projects)) {
        if (cwd.startsWith(proj.path) || cwd === proj.path) {
          projectPath = proj.path;
          break;
        }
      }

      if (!projectPath) {
        const firstProject = Object.values(config.projects)[0];
        projectPath = firstProject?.path ?? cwd;
      }

      // Create StateManager
      const yamlPath = `${projectPath}/sprint-status.yaml`;
      const stateManager = createStateManager({ yamlPath });
      await stateManager.initialize();

      // Create ConflictResolver
      const resolver = createConflictResolver(stateManager);

      // List mode - no story specified
      if (!storyId) {
        if (opts.format === "json") {
          console.log(JSON.stringify({ conflicts: [], message: "No story specified" }, null, 2));
        } else {
          console.log(chalk.yellow("No story specified."));
          console.log(
            chalk.dim(
              "Use 'ao resolve-conflicts <story-id>' to resolve conflicts for a specific story.",
            ),
          );
        }
        await stateManager.close();
        return;
      }

      // Get story state
      const story = stateManager.get(storyId);
      if (!story) {
        if (opts.format === "json") {
          console.log(JSON.stringify({ error: `Story "${storyId}" not found` }, null, 2));
        } else {
          console.error(chalk.red(`Story "${storyId}" not found in sprint-status.yaml`));
        }
        await stateManager.close();
        process.exit(1);
      }

      // Detect conflict (simulate conflict detection for demo)
      // In real usage, this would be called during an update operation
      const expectedVersion = opts.expectedVersion ?? story.version;
      const updates: Record<string, unknown> = {};
      if (opts.proposedStatus) updates.status = opts.proposedStatus;
      if (opts.proposedAgent) updates.assignedAgent = opts.proposedAgent;

      const conflict = resolver.detect(storyId, expectedVersion, updates);

      if (!conflict) {
        if (opts.format === "json") {
          console.log(
            JSON.stringify({ conflict: false, message: "No conflict detected" }, null, 2),
          );
        } else {
          console.log(chalk.green(`No conflict detected for ${storyId}`));
        }
        await stateManager.close();
        return;
      }

      // Conflict detected
      if (opts.format === "json") {
        displayConflictJson(conflict);
        // Exit code 2 for conflicts
        await stateManager.close();
        process.exit(2);
      }

      // Human format
      displayConflict(conflict);
      displayResolutionOptions();

      // Resolve conflict
      let resolution: Resolution | null = null;

      if (opts.auto) {
        resolution = parseResolution(opts.auto);
        if (!resolution) {
          console.error(chalk.red(`Invalid auto-resolution strategy: ${opts.auto}`));
          console.error(chalk.dim("Valid strategies: overwrite, retry, merge"));
          await stateManager.close();
          process.exit(1);
        }
        console.log(chalk.blue(`  Auto-resolving with strategy: ${resolution}`));
      } else {
        // Interactive mode - would require readline
        // For now, exit with conflict status
        console.log(chalk.yellow("\n  Interactive resolution requires manual input."));
        console.log(chalk.dim("  Use --auto <strategy> for automatic resolution."));
        console.log(chalk.dim("  Strategies: overwrite, retry, merge"));
        await stateManager.close();
        process.exit(2);
      }

      // Apply resolution
      if (resolution) {
        const result = await resolver.resolve(conflict, resolution);

        if (result.success) {
          console.log(chalk.green(`  Conflict resolved successfully!`));
          console.log(chalk.dim(`  New version: ${result.newVersion}`));
        } else {
          console.error(chalk.red(`  Resolution failed: ${result.error}`));
          await stateManager.close();
          process.exit(1);
        }
      }

      await stateManager.close();

      const elapsed = Date.now() - startTime;
      if (elapsed > 1000) {
        console.warn(
          chalk.yellow(`Warning: Conflict resolution took ${elapsed}ms (>1000ms target)`),
        );
      }
    });
}
