/**
 * Assign Suggest Command — recommend optimal agent for a story
 */

import chalk from "chalk";
import type { Command } from "commander";
import {
  loadConfig,
  createLearningStore,
  getSessionsDir,
  getAgentRegistry,
  scoreAffinity,
} from "@composio/ao-core";
import { join } from "node:path";

export function registerAssignSuggest(program: Command): void {
  program
    .command("assign-suggest <story-id>")
    .description("Recommend optimal agent assignment for a story")
    .option("--json", "Output as JSON", false)
    .option("--domains <tags>", "Comma-separated domain tags (e.g., frontend,testing)")
    .action(async (storyId: string, opts: { json?: boolean; domains?: string }) => {
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
      const store = createLearningStore({ learningsPath: join(sessionsDir, "learnings.jsonl") });
      await store.start();

      const registry = getAgentRegistry(sessionsDir, config);
      await registry.reload();

      const agents = registry.list();
      if (agents.length === 0) {
        if (opts.json) {
          console.log(JSON.stringify({ storyId, candidates: [], message: "No agents available" }));
        } else {
          console.log(chalk.yellow("\nNo agents available for assignment.\n"));
        }
        return;
      }

      // Parse domain tags from flag or default to empty
      const storyDomainTags = opts.domains ? opts.domains.split(",").map((t) => t.trim()) : [];

      // Score each agent
      const allLearnings = store.list();
      const scores = agents.map((a) => {
        const agentLearnings = allLearnings.filter((l) => l.agentId === a.agentId);
        return scoreAffinity(a.agentId, storyDomainTags, agentLearnings);
      });

      scores.sort((a, b) => b.score - a.score);

      if (opts.json) {
        console.log(JSON.stringify({ storyId, candidates: scores }, null, 2));
        return;
      }

      console.log(chalk.bold(`\n  Assignment Suggestions for ${chalk.cyan(storyId)}\n`));
      console.log(
        chalk.dim(
          `  ${"Agent".padEnd(25)} ${"Score".padEnd(8)} ${"Success".padEnd(10)} ${"Recommendation"}`,
        ),
      );
      console.log(
        chalk.dim(`  ${"─".repeat(25)} ${"─".repeat(8)} ${"─".repeat(10)} ${"─".repeat(15)}`),
      );

      for (let i = 0; i < scores.length; i++) {
        const s = scores[i];
        const agent = s.agentId.padEnd(25);
        const score = s.score.toFixed(2).padEnd(8);
        const success = `${Math.round(s.successRate * 100)}%`.padEnd(10);
        const rec = i === 0 ? chalk.green("★ Recommended") : chalk.dim("—");
        console.log(`  ${agent} ${score} ${success} ${rec}`);
      }

      console.log("");
    });
}
