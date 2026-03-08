import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig, type DegradedModeStatus } from "@composio/ao-core";
import {
  computeSprintHealth,
  type SprintHealthResult,
  type HealthIndicator,
} from "@composio/ao-plugin-tracker-bmad";
import { getTracker } from "../lib/plugins.js";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

function severityBadge(severity: string): string {
  switch (severity) {
    case "critical":
      return chalk.red("● CRITICAL");
    case "warning":
      return chalk.yellow("▲ WARNING");
    default:
      return chalk.green("✓ OK");
  }
}

function renderIndicator(indicator: HealthIndicator): void {
  console.log(`  ${severityBadge(indicator.severity)}  ${indicator.message}`);
  if (indicator.details.length > 0) {
    for (const detail of indicator.details) {
      console.log(`    ${chalk.dim("→")} ${chalk.dim(detail)}`);
    }
  }
}

function formatServiceAvailability(available: boolean, lastError?: string): string {
  if (available) {
    return chalk.green("✅ Operational");
  }
  const status = chalk.red("❌ Unavailable");
  return lastError ? `${status} (${chalk.dim(lastError)})` : status;
}

function renderDegradedModeStatus(status: DegradedModeStatus): void {
  if (status.mode === "normal") {
    return; // Don't show anything if not degraded
  }

  console.log(chalk.bold("  Degraded Mode:"));

  // Show mode
  let modeLabel: string;
  let modeColor: typeof chalk.red;
  switch (status.mode) {
    case "event-bus-unavailable":
      modeLabel = "Event Bus Unavailable";
      modeColor = chalk.yellow;
      break;
    case "bmad-unavailable":
      modeLabel = "BMAD Tracker Unavailable";
      modeColor = chalk.yellow;
      break;
    case "multiple-services-unavailable":
      modeLabel = "Multiple Services Unavailable";
      modeColor = chalk.red;
      break;
    default:
      modeLabel = status.mode;
      modeColor = chalk.dim;
  }

  console.log(`    Mode: ${modeColor(modeLabel)}`);

  // Show service availability
  console.log(chalk.dim("    Services:"));
  const eventBusAvail = status.services["event-bus"];
  if (eventBusAvail) {
    console.log(
      `      ├─ Event bus: ${formatServiceAvailability(
        eventBusAvail.available,
        eventBusAvail.lastError,
      )}`,
    );
  }
  const bmadAvail = status.services["bmad-tracker"];
  if (bmadAvail) {
    console.log(
      `      ├─ BMAD tracker: ${formatServiceAvailability(
        bmadAvail.available,
        bmadAvail.lastError,
      )}`,
    );
  }
  console.log(
    `      └─ Local state: ${
      status.localStateOperational ? chalk.green("✅ Operational") : chalk.red("❌ Error")
    }`,
  );

  // Show queued operations
  if (status.queuedEvents > 0 || status.queuedSyncs > 0) {
    console.log(chalk.dim("    Queued:"));
    if (status.queuedEvents > 0) {
      console.log(`      ├─ ${status.queuedEvents} events`);
    }
    if (status.queuedSyncs > 0) {
      console.log(`      └─ ${status.queuedSyncs} sync operations`);
    }
  }

  // Show entered time
  if (status.enteredAt) {
    const durationMs = Date.now() - new Date(status.enteredAt).getTime();
    const durationMin = Math.round(durationMs / 60000);
    console.log(chalk.dim(`    Duration: ${durationMin} minutes`));
  }

  console.log();
}

export function registerHealth(program: Command): void {
  program
    .command("health [project]")
    .description("Show sprint health indicators — stuck stories, WIP alerts, bottlenecks")
    .option("--json", "Output as JSON")
    .action(async (projectArg: string | undefined, opts: { json?: boolean }) => {
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

      // Verify tracker is bmad
      const tracker = getTracker(config, projectId);
      if (!tracker || tracker.name !== "bmad") {
        console.error(chalk.red("Health indicators require the bmad tracker plugin."));
        process.exit(1);
      }

      // Get degraded mode status if available (non-fatal)
      let degradedModeStatus: DegradedModeStatus | null = null;
      try {
        // Try to get degraded mode status from lifecycle manager if available
        // This is optional - if not available, skip degraded mode display
        const { getLifecycleManagerIfExists } = await import("../lib/lifecycle.js");
        const lifecycleManager = await getLifecycleManagerIfExists(config, projectId);
        if (lifecycleManager && lifecycleManager.getDegradedModeStatus) {
          degradedModeStatus = lifecycleManager.getDegradedModeStatus() as DegradedModeStatus;
        }
      } catch {
        // Degraded mode not available - continue without it
      }

      let result: SprintHealthResult;
      try {
        result = computeSprintHealth(project);
      } catch (err) {
        console.error(
          chalk.red(
            `Failed to compute health: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        process.exit(1);
      }

      // JSON output
      if (opts.json) {
        const jsonOutput: {
          sprintHealth: SprintHealthResult;
          degradedMode?: DegradedModeStatus;
        } = { sprintHealth: result };

        if (degradedModeStatus) {
          jsonOutput.degradedMode = degradedModeStatus;
        }

        console.log(JSON.stringify(jsonOutput, null, 2));
        return;
      }

      // Formatted output
      console.log(header(`Sprint Health: ${project.name || projectId}`));
      console.log();

      // Show degraded mode status first if available
      if (degradedModeStatus && degradedModeStatus.mode !== "normal") {
        console.log(`  Overall: ${chalk.yellow("⚠ Degraded")}`);
        console.log();
        renderDegradedModeStatus(degradedModeStatus);
      }

      if (result.indicators.length === 0 && !degradedModeStatus) {
        console.log(`  ${chalk.green("✓")} Sprint Health: ${chalk.green("OK")}`);
        console.log(chalk.dim("  No issues detected."));
        return;
      }

      if (result.indicators.length === 0 && degradedModeStatus?.mode === "normal") {
        console.log(`  ${chalk.green("✓")} Sprint Health: ${chalk.green("OK")}`);
        console.log(chalk.dim("  No issues detected."));
        return;
      }

      // Show sprint health indicators if there are any
      if (result.indicators.length > 0) {
        // Only show overall status if not already shown by degraded mode
        if (!degradedModeStatus || degradedModeStatus.mode === "normal") {
          console.log(`  Overall: ${severityBadge(result.overall)}`);
          console.log();
        }

        for (const indicator of result.indicators) {
          renderIndicator(indicator);
          console.log();
        }
      }
    });
}
