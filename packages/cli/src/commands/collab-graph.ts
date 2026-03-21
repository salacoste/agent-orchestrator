/**
 * Collab Graph Command — view agent collaboration dependencies
 */

import chalk from "chalk";
import type { Command } from "commander";
import {
  loadConfig,
  getSessionsDir,
  getAgentRegistry,
  buildCollabGraph,
  type StoryDependency,
} from "@composio/ao-core";

export function registerCollabGraph(program: Command): void {
  program
    .command("collab-graph")
    .description("View agent collaboration graph and dependencies")
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
      const registry = getAgentRegistry(sessionsDir, config);
      await registry.reload();

      const agents = registry.list();

      // Build simple dependency graph from agent assignments
      const deps: StoryDependency[] = agents.map((a) => ({
        storyId: a.storyId,
        dependsOn: [],
        status: a.status === "completed" ? ("completed" as const) : ("ready" as const),
        assignedAgent: a.agentId,
      }));

      const completedStories = new Set(
        agents.filter((a) => a.status === "completed").map((a) => a.storyId),
      );

      const graph = buildCollabGraph(deps, completedStories);

      if (opts.json) {
        console.log(JSON.stringify(graph, null, 2));
        return;
      }

      if (graph.length === 0) {
        console.log(chalk.yellow("\nNo active agent dependencies.\n"));
        return;
      }

      console.log(chalk.bold(`\n  Agent Collaboration Graph (${graph.length} entries)\n`));
      console.log(
        chalk.dim(
          `  ${"Agent".padEnd(22)} ${"Story".padEnd(25)} ${"Status".padEnd(12)} Waiting On`,
        ),
      );
      console.log(
        chalk.dim(`  ${"─".repeat(22)} ${"─".repeat(25)} ${"─".repeat(12)} ${"─".repeat(20)}`),
      );

      for (const entry of graph) {
        const agent = entry.agentId.padEnd(22);
        const story = entry.storyId.padEnd(25);
        const statusColors: Record<string, (s: string) => string> = {
          active: chalk.green,
          waiting: chalk.yellow,
          completed: chalk.gray,
          blocked: chalk.red,
        };
        const colorFn = statusColors[entry.status] ?? chalk.white;
        const status = colorFn(entry.status.padEnd(12));
        const waiting = entry.waitingOn.length > 0 ? entry.waitingOn.join(", ") : "—";

        console.log(`  ${agent} ${story} ${status} ${chalk.dim(waiting)}`);
      }

      console.log("");
    });
}
