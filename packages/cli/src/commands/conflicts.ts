import chalk from "chalk";
import type { Command } from "commander";
import * as Table from "cli-table3";
import {
  loadConfig,
  createConflictDetectionService,
  getAgentRegistry,
  getSessionsDir,
} from "@composio/ao-core";

/**
 * Format severity with color
 */
function formatSeverity(severity: string): string {
  switch (severity) {
    case "critical":
      return chalk.red.bold("CRITICAL");
    case "high":
      return chalk.red("HIGH");
    case "medium":
      return chalk.yellow("MEDIUM");
    case "low":
      return chalk.green("LOW");
    default:
      return severity.toUpperCase();
  }
}

/**
 * Format duration since a timestamp
 */
function formatDuration(since: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - since.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Register conflicts command
 */
export function registerConflicts(program: Command): void {
  program
    .command("conflicts")
    .description("List and manage agent assignment conflicts")
    .option("--story <id>", "Filter conflicts by story ID")
    .option("--json", "Output as JSON")
    .option("--severity <level>", "Filter by severity (critical, high, medium, low)")
    .action(async (opts) => {
      // Load config
      const config = loadConfig();
      if (!config) {
        console.error(chalk.red("No agent-orchestrator.yaml found. Run 'ao init' first."));
        process.exit(1);
      }

      // Get project ID from current directory
      const cwd = process.cwd();
      const projectId = Object.keys(config.projects).find((id) =>
        cwd.startsWith(config.projects[id].path),
      );

      if (!projectId) {
        console.error(chalk.red("Could not determine project ID. Run from a project directory."));
        process.exit(1);
      }

      const sessionsDir = getSessionsDir(config.configPath, projectId);
      const registry = getAgentRegistry(sessionsDir, config);

      // Create conflict detection service
      const conflictService = createConflictDetectionService(registry, {
        enabled: true,
      });

      // Get conflicts (optionally filtered by story)
      let conflicts = opts.story
        ? conflictService.getConflictsByStory(opts.story)
        : conflictService.getConflicts();

      // Filter by severity if specified
      if (opts.severity) {
        const severityLevel = opts.severity.toLowerCase();
        conflicts = conflicts.filter((c) => c.severity === severityLevel);
      }

      // Sort by severity (critical > high > medium > low) then by time
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      conflicts.sort((a, b) => {
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.detectedAt.getTime() - a.detectedAt.getTime();
      });

      // Output as JSON if requested
      if (opts.json) {
        console.log(JSON.stringify(conflicts, null, 2));
        return;
      }

      // Display conflicts table
      if (conflicts.length === 0) {
        console.log(chalk.green("✓ No active conflicts"));
        return;
      }

      console.log(chalk.bold(`Found ${conflicts.length} active conflict(s)`));
      console.log();

      // Group conflicts by story for better readability
      const byStory = new Map<string, typeof conflicts>();
      for (const conflict of conflicts) {
        if (!byStory.has(conflict.storyId)) {
          byStory.set(conflict.storyId, []);
        }
        byStory.get(conflict.storyId)!.push(conflict);
      }

      // Display each story's conflicts
      for (const [storyId, storyConflicts] of Array.from(byStory.entries())) {
        console.log(chalk.bold(`Story: ${storyId}`));
        console.log(chalk.dim("─".repeat(60)));

        for (const conflict of storyConflicts) {
          console.log();
          console.log(`  ${chalk.bold("Conflict ID:")} ${chalk.dim(conflict.conflictId)}`);
          console.log(`  ${chalk.bold("Severity:")}    ${formatSeverity(conflict.severity)}`);
          console.log(`  ${chalk.bold("Type:")}        ${conflict.type}`);
          console.log(`  ${chalk.bold("Detected:")}    ${formatDuration(conflict.detectedAt)}`);
          console.log();
          console.log(`  ${chalk.bold("Agents:")}`);
          console.log(`    Existing:     ${chalk.yellow(conflict.existingAgent)}`);
          console.log(`    Conflicting:  ${chalk.cyan(conflict.conflictingAgent)}`);
          console.log();

          // Show priority scores
          if (Object.keys(conflict.priorityScores).length > 0) {
            console.log(`  ${chalk.bold("Priority Scores:")}`);
            for (const [agentId, score] of Object.entries(conflict.priorityScores)) {
              const scoreNum = score as number;
              const scoreFormatted = (scoreNum * 100).toFixed(0);
              const scoreColor =
                scoreNum > 0.7 ? chalk.green : scoreNum > 0.4 ? chalk.yellow : chalk.red;
              console.log(`    ${agentId}: ${scoreColor(`${scoreFormatted}%`)}`);
            }
            console.log();
          }

          // Show recommendations
          if (conflict.recommendations.length > 0) {
            console.log(`  ${chalk.bold("Recommendations:")}`);
            for (const rec of conflict.recommendations) {
              console.log(`    • ${rec}`);
            }
            console.log();
          }

          // Show resolution status
          if (conflict.resolution) {
            console.log(
              `  ${chalk.bold("Resolution:")}  ${chalk.green(conflict.resolution.resolution)}`,
            );
            if (conflict.resolution.resolvedAt) {
              console.log(
                `  ${chalk.dim(`Resolved at: ${conflict.resolution.resolvedAt.toISOString()}`)}`,
              );
            }
          } else {
            console.log(`  ${chalk.bold("Resolution:")}  ${chalk.yellow("Pending")}`);
          }
          console.log();
        }
      }

      // Display summary table
      console.log(chalk.bold("Summary"));
      console.log(chalk.dim("─".repeat(60)));

      const summaryTable = new Table({
        head: [chalk.bold("Story"), chalk.bold("Conflicts"), chalk.bold("Highest Severity")],
        colWidths: [30, 15, 20],
        wordWrap: true,
      });

      for (const [storyId, storyConflicts] of Array.from(byStory.entries())) {
        const highestSeverity = storyConflicts.reduce((highest, c) => {
          return severityOrder[c.severity] < severityOrder[highest] ? c.severity : highest;
        }, storyConflicts[0].severity);

        summaryTable.push([
          storyId,
          String(storyConflicts.length),
          formatSeverity(highestSeverity),
        ]);
      }

      console.log(summaryTable.toString());
      console.log();

      // Display resolution hints
      console.log(chalk.dim("To resolve conflicts, use:"));
      console.log(chalk.dim("  ao conflicts --story <id>          # View conflicts for a story"));
      console.log(chalk.dim("  --force flag with spawn-story      # Override conflict warning"));
      console.log();
    });
}
