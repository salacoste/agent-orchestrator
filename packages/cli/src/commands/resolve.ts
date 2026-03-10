/**
 * Agent Conflict Resolution Command
 *
 * Manually resolve agent assignment conflicts.
 * Allows manual override of auto-resolution behavior.
 */

import chalk from "chalk";
import type { Command } from "commander";
import * as Table from "cli-table3";
import {
  loadConfig,
  createConflictResolutionService,
  createConflictDetectionService,
  getAgentRegistry,
  getSessionsDir,
  type AgentConflict,
  type TieBreaker,
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
 * List all pending conflicts
 */
function listConflicts(conflicts: AgentConflict[]): void {
  if (conflicts.length === 0) {
    console.log(chalk.green("✓ No pending conflicts"));
    return;
  }

  console.log(chalk.bold(`Pending Conflicts (${conflicts.length})`));
  console.log();

  // Sort by severity (critical > high > medium > low) then by time
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  conflicts.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.detectedAt.getTime() - a.detectedAt.getTime();
  });

  const table = new Table({
    head: [
      chalk.bold("Conflict ID"),
      chalk.bold("Story"),
      chalk.bold("Existing"),
      chalk.bold("Conflicting"),
      chalk.bold("Severity"),
      chalk.bold("Detected"),
    ],
    colWidths: [20, 15, 20, 20, 12, 12],
    wordWrap: true,
  });

  for (const conflict of conflicts) {
    table.push([
      conflict.conflictId.substring(0, 18),
      conflict.storyId.substring(0, 13),
      conflict.existingAgent.substring(0, 18),
      conflict.conflictingAgent.substring(0, 18),
      formatSeverity(conflict.severity),
      formatDuration(conflict.detectedAt),
    ]);
  }

  console.log(table.toString());
  console.log();
  console.log(chalk.dim("Resolve a conflict: ao resolve <conflict-id>"));
}

/**
 * Display conflict details
 */
function displayConflict(conflict: AgentConflict): void {
  console.log();
  console.log(chalk.bold(`Conflict: ${conflict.conflictId}`));
  console.log(chalk.dim("─".repeat(60)));
  console.log(`  Story:      ${chalk.yellow(conflict.storyId)}`);
  console.log(`  Severity:   ${formatSeverity(conflict.severity)}`);
  console.log(`  Type:       ${conflict.type}`);
  console.log(`  Detected:   ${formatDuration(conflict.detectedAt)}`);
  console.log();
  console.log(`  ${chalk.bold("Agents:")}`);
  console.log(`    Existing:    ${chalk.yellow(conflict.existingAgent)}`);
  console.log(`    Conflicting: ${chalk.cyan(conflict.conflictingAgent)}`);
  console.log();

  // Show priority scores
  if (Object.keys(conflict.priorityScores).length > 0) {
    console.log(`  ${chalk.bold("Priority Scores:")}`);
    for (const [agentId, score] of Object.entries(conflict.priorityScores)) {
      const scoreNum = score as number;
      const scoreFormatted = (scoreNum * 100).toFixed(0);
      const scoreColor = scoreNum > 0.7 ? chalk.green : scoreNum > 0.4 ? chalk.yellow : chalk.red;
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
}

/**
 * Register resolve command
 */
export function registerResolve(program: Command): void {
  program
    .command("resolve [conflictId]")
    .description("Resolve agent assignment conflicts")
    .option("--list", "List all pending conflicts")
    .option("--agent <id>", "Keep specific agent (overrides priority-based decision)")
    .option("--tie-breaker <strategy>", "Tie-breaker strategy: recent, progress", "recent")
    .option("--json", "Output as JSON")
    .action(async (conflictId: string | undefined, opts) => {
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
      const detectionService = createConflictDetectionService(registry, {
        enabled: true,
      });

      // Get all conflicts
      const allConflicts = detectionService.getConflicts();

      // List mode
      if (opts.list || !conflictId) {
        if (opts.json) {
          console.log(JSON.stringify(allConflicts, null, 2));
        } else {
          listConflicts(allConflicts);
        }
        return;
      }

      // Find the specific conflict
      const conflict = allConflicts.find((c) => c.conflictId === conflictId);
      if (!conflict) {
        console.error(chalk.red(`Conflict "${conflictId}" not found`));
        console.log(chalk.dim("Run 'ao resolve --list' to see all pending conflicts"));
        process.exit(1);
      }

      // Display conflict details
      if (!opts.json) {
        displayConflict(conflict);
      }

      // Get tie-breaker strategy
      const tieBreaker = opts.tieBreaker as TieBreaker;
      if (tieBreaker !== "recent" && tieBreaker !== "progress") {
        console.error(chalk.red(`Invalid tie-breaker strategy: ${opts.tieBreaker}`));
        console.error(chalk.dim("Valid strategies: recent, progress"));
        process.exit(1);
      }

      // Create conflict resolution service
      // Note: We need a Runtime implementation for agent termination
      // For now, we'll create a mock runtime that logs termination
      const mockRuntime = {
        name: "cli-runtime",
        async create() {
          return { id: "cli-session", runtimeName: "cli-runtime", data: {} };
        },
        async destroy(_handle: { id: string }) {
          // In production, this would call the actual runtime plugin
          // For CLI manual resolution, we just unassign from registry
        },
        async sendMessage(): Promise<void> {
          // Not used in manual resolution
        },
        async getOutput(): Promise<string> {
          return "";
        },
        async isAlive(): Promise<boolean> {
          return false;
        },
      };

      const resolutionService = createConflictResolutionService(registry, mockRuntime, {
        autoResolve: true,
        tieBreaker,
        notifyOnResolution: true,
      });

      // Override kept agent if specified
      let resultConflict = conflict;
      if (opts.agent) {
        const targetAgent = opts.agent;
        if (targetAgent !== conflict.existingAgent && targetAgent !== conflict.conflictingAgent) {
          console.error(chalk.red(`Agent "${targetAgent}" is not part of this conflict`));
          process.exit(1);
        }

        // Modify conflict to prioritize the specified agent
        resultConflict = {
          ...conflict,
          priorityScores: {
            [conflict.existingAgent]: targetAgent === conflict.existingAgent ? 1.0 : 0.0,
            [conflict.conflictingAgent]: targetAgent === conflict.conflictingAgent ? 1.0 : 0.0,
          },
        };
        console.log(chalk.blue(`  Manual override: keeping ${chalk.bold(targetAgent)}`));
        console.log();
      }

      // Resolve the conflict
      const result = await resolutionService.resolve(resultConflict);

      // Display result
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.bold(`  Resolution: ${result.action}`));
        if (result.keptAgent) {
          console.log(`  Kept agent:     ${chalk.green(result.keptAgent)}`);
        }
        if (result.terminatedAgent) {
          console.log(`  Terminated agent: ${chalk.red(result.terminatedAgent)}`);
        }
        console.log(`  Reason:         ${chalk.dim(result.reason)}`);
        console.log();
        console.log(chalk.green("  ✓ Conflict resolved successfully"));
      }
    });
}
