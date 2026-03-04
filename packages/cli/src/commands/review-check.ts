import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import { loadConfig, type PRInfo } from "@composio/ao-core";
import { getSCM } from "../lib/plugins.js";
import { getSessionManager } from "../lib/create-session-manager.js";

interface ReviewInfo {
  sessionId: string;
  prNumber: number;
  pendingComments: number;
  reviewDecision: string | null;
}

export function registerReviewCheck(program: Command): void {
  program
    .command("review-check")
    .description("Check PRs for review comments and trigger agents to address them")
    .argument("[project]", "Project ID (checks all if omitted)")
    .option("--dry-run", "Show what would be done without sending messages")
    .action(async (projectId: string | undefined, opts: { dryRun?: boolean }) => {
      const config = loadConfig();

      if (projectId && !config.projects[projectId]) {
        console.error(chalk.red(`Unknown project: ${projectId}`));
        process.exit(1);
      }

      const sm = await getSessionManager(config);
      const sessions = await sm.list(projectId);

      const spinner = ora("Checking PRs for review comments...").start();
      const results: ReviewInfo[] = [];

      for (const session of sessions) {
        const project = config.projects[session.projectId];
        if (!project?.repo) continue;

        let scm;
        try {
          scm = getSCM(config, session.projectId);
        } catch {
          continue;
        }

        let pr: PRInfo | null;
        try {
          pr = await scm.detectPR(session, project);
        } catch {
          // No PR found — skip
          continue;
        }

        if (!pr) continue;

        try {
          const [pendingComments, reviewDecision] = await Promise.all([
            scm.getPendingComments(pr),
            scm.getReviewDecision(pr),
          ]);

          const commentCount = pendingComments.length;

          if (commentCount > 0 || reviewDecision === "changes_requested") {
            results.push({
              sessionId: session.id,
              prNumber: pr.number,
              pendingComments: commentCount,
              reviewDecision,
            });
          }
        } catch {
          // Skip PRs we can't access
        }
      }

      spinner.stop();

      if (results.length === 0) {
        console.log(chalk.green("No pending review comments found."));
        return;
      }

      console.log(
        chalk.bold(
          `\nFound ${results.length} session${results.length > 1 ? "s" : ""} with pending reviews:\n`,
        ),
      );

      for (const result of results) {
        console.log(`  ${chalk.green(result.sessionId)}  PR #${result.prNumber}`);
        if (result.reviewDecision) {
          console.log(`    Decision: ${chalk.yellow(result.reviewDecision)}`);
        }
        if (result.pendingComments > 0) {
          console.log(`    Comments: ${chalk.yellow(String(result.pendingComments))}`);
        }

        if (!opts.dryRun) {
          try {
            const message =
              "There are review comments on your PR. Check with `gh pr view --comments` and `gh api` for inline comments. Address each one, push fixes, and reply.";
            await sm.send(result.sessionId, message);
            console.log(chalk.green(`    -> Fix prompt sent`));
          } catch (err) {
            console.error(chalk.red(`    -> Failed to send: ${err}`));
          }
        } else {
          console.log(chalk.dim(`    (dry run — would send fix prompt)`));
        }
      }
      console.log();
    });
}
