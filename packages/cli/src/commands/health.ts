import chalk from "chalk";
import type { Command } from "commander";
import {
  loadConfig,
  createHealthCheckService,
  type HealthCheckConfig,
  type HealthCheckResult,
  type HealthCheckService,
  type BMADTracker,
} from "@composio/ao-core";
import { getTracker } from "../lib/plugins.js";
import { resolveProject } from "../lib/resolve-project.js";

/**
 * Render health status badge
 */
function healthStatusBadge(status: string): string {
  switch (status) {
    case "healthy":
      return chalk.green("✅");
    case "degraded":
      return chalk.yellow("⚠️");
    case "unhealthy":
      return chalk.red("❌");
    default:
      return chalk.dim("?");
  }
}

/**
 * Render health check results as a table
 */
function renderHealthTable(result: HealthCheckResult, projectName: string): void {
  console.log(chalk.bold(`\nSystem Health: ${projectName}`));
  console.log(chalk.dim("─".repeat(60)));

  // Print header
  const componentPad = 20;
  const statusPad = 10;
  const latencyPad = 10;

  console.log(
    `${"Component".padEnd(componentPad)}${"Status".padEnd(statusPad)}${"Latency".padEnd(latencyPad)}Details`,
  );
  console.log(chalk.dim("─".repeat(60)));

  for (const component of result.components) {
    const statusIcon = healthStatusBadge(component.status);
    const latency = component.latencyMs !== undefined ? `${component.latencyMs}ms` : "-";
    const details = component.details ? component.details.join(", ") : component.message;

    console.log(
      `${component.component.padEnd(componentPad)}${statusIcon.padEnd(statusPad)}${latency.padEnd(latencyPad)}${details}`,
    );
  }

  console.log(chalk.dim("─".repeat(60)));

  // Overall status
  const overallBadge = healthStatusBadge(result.overall);
  console.log(`${chalk.bold("Overall:")} ${overallBadge} ${result.overall}`);

  if (result.overall === "unhealthy") {
    console.log(chalk.red("\n⚠️  One or more components are unhealthy!"));
  } else if (result.overall === "degraded") {
    console.log(chalk.yellow("\n⚠️  One or more components are degraded!"));
  } else {
    console.log(chalk.green("\n✓ All components are healthy!"));
  }

  console.log();
}

/**
 * Run a single health check and exit with appropriate code
 */
async function runHealthCheck(
  service: HealthCheckService,
  projectName: string,
  json: boolean,
): Promise<never> {
  const result = await service.check();
  await service.close();

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    renderHealthTable(result, projectName);
  }

  // Exit with code 1 if any component is unhealthy
  process.exit(result.exitCode);
}

/**
 * Run health checks in watch mode
 */
async function runHealthWatch(
  service: HealthCheckService,
  projectName: string,
  json: boolean,
  intervalMs: number,
): Promise<never> {
  let previousResult: HealthCheckResult | null = null;

  const checkAndDisplay = async (): Promise<void> => {
    const result = await service.check();

    if (!previousResult || result.overall !== previousResult.overall) {
      if (json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        renderHealthTable(result, projectName);
      }

      // Alert on status change
      if (previousResult) {
        const changeMsg =
          previousResult.overall === "healthy"
            ? `Health degraded to ${result.overall}`
            : result.overall === "healthy"
              ? `Health recovered to ${result.overall}`
              : `Health changed from ${previousResult.overall} to ${result.overall}`;

        if (!json) {
          console.log(chalk.bold(`\n🔄 ${changeMsg}\n`));
        }
      }
    }

    previousResult = result;
  };

  // Start health check service (enables periodic checks)
  await service.start();

  // Initial check
  await checkAndDisplay();

  // Set up interval for watch mode
  const interval = setInterval(async () => {
    try {
      await checkAndDisplay();
    } catch (error) {
      console.error(
        chalk.red(`Health check failed: ${error instanceof Error ? error.message : String(error)}`),
      );
      console.error(chalk.yellow("Continuing to monitor..."));
    }
  }, intervalMs);

  // Handle graceful shutdown
  const cleanup = async (): Promise<void> => {
    clearInterval(interval);
    await service.close();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Keep process alive (never resolves)
  await new Promise<never>(() => {
    // This promise never resolves, keeping the process alive
    // Exit is handled by SIGINT/SIGTERM handlers
  });
  // Unreachable - process exits via signal handlers
  throw new Error("Watch mode terminated unexpectedly");
}

export function registerHealth(program: Command): void {
  program
    .command("health [project]")
    .description("Show system health — event bus, BMAD tracker, local state, agent registry")
    .option("--json", "Output as JSON")
    .option("--watch", "Continuous monitoring with alerts on status changes")
    .option("--interval <ms>", "Check interval in ms for watch mode (default: 30000)", "30000")
    .action(
      async (
        projectArg: string | undefined,
        opts: { json?: boolean; watch?: boolean; interval?: string },
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

        // Get tracker (BMAD)
        let tracker: BMADTracker | undefined;
        const trackerPlugin = getTracker(config, projectId);
        if (trackerPlugin && trackerPlugin.name === "bmad") {
          tracker = trackerPlugin as unknown as BMADTracker;
        }

        // Get agent registry
        const { getAgentRegistry, getSessionsDir } = await import("@composio/ao-core");
        const sessionsDir = getSessionsDir(config.configPath, projectId);
        const agentRegistry = getAgentRegistry(sessionsDir, config);

        // Create health check service (eventBus and stateManager are optional)
        const healthCheckConfig: HealthCheckConfig = {
          bmadTracker: tracker,
          agentRegistry,
          checkIntervalMs: opts.interval ? Number.parseInt(opts.interval, 10) : undefined,
        };

        const healthCheckService = createHealthCheckService(healthCheckConfig);

        // Watch mode or single check
        if (opts.watch) {
          await runHealthWatch(
            healthCheckService,
            project.name || projectId,
            opts.json ?? false,
            opts.interval ? Number.parseInt(opts.interval, 10) : 30000,
          );
        } else {
          await runHealthCheck(healthCheckService, project.name || projectId, opts.json ?? false);
        }
      },
    );
}
