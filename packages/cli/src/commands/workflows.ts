/**
 * ao workflows — List workflows and view execution history
 *
 * Usage:
 *   ao workflows [project]          — list all workflows for a project
 *   ao workflows [project] --history — show workflow execution history
 *   ao workflows --examples          — show workflow definition examples
 */

import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

// ---------------------------------------------------------------------------
// Display functions
// ---------------------------------------------------------------------------

function formatWorkflowStatus(status: string): string {
  switch (status) {
    case "completed":
      return chalk.green(status);
    case "failed":
      return chalk.red(status);
    case "running":
      return chalk.yellow(status);
    case "async":
      return chalk.blue(status);
    case "pending":
      return chalk.dim(status);
    default:
      return status;
  }
}

function formatStepSummary(
  steps: Array<{ action: string; if?: unknown; async?: boolean }>,
): string {
  const parts: string[] = [];
  for (const step of steps) {
    let stepStr = step.action;
    if (step.if) {
      stepStr += chalk.dim(" (if)");
    }
    if (step.async) {
      stepStr += chalk.dim(" (async)");
    }
    parts.push(stepStr);
  }
  return parts.join(" → ");
}

function formatTriggerSummary(trigger: { event?: { type: string } }): string {
  if (trigger.event?.type) {
    return chalk.cyan(`event:`) + ` ${chalk.yellow(trigger.event.type)}`;
  }
  return chalk.dim("(no trigger)");
}

function printWorkflowList(
  projectName: string,
  workflows: Array<{
    name: string;
    plugin?: string;
    trigger: { event?: { type: string } };
    steps: Array<{ action: string; if?: unknown; async?: boolean }>;
  }>,
): void {
  console.log(header(`Workflows: ${projectName}`));
  console.log();

  if (workflows.length === 0) {
    console.log(chalk.dim("  (no workflows registered)"));
    console.log();
    console.log(chalk.dim("  Workflows can be defined in plugin.yaml files:"));
    console.log();
    console.log(chalk.dim("    workflows:"));
    console.log(chalk.dim('      - name: "on-completion-cleanup"'));
    console.log(chalk.dim("        trigger:"));
    console.log(chalk.dim('          event: { type: "story.completed" }'));
    console.log(chalk.dim("        steps:"));
    console.log(chalk.dim('          - action: "updateBurndown"'));
    console.log(chalk.dim('          - action: "notifyTeam"'));
    console.log();
    return;
  }

  for (const workflow of workflows) {
    console.log(`  ${chalk.bold(workflow.name)}`);
    if (workflow.plugin) {
      console.log(`    ${chalk.dim("Plugin:")} ${workflow.plugin}`);
    }

    console.log(`    ${chalk.dim("Trigger:")} ${formatTriggerSummary(workflow.trigger)}`);

    console.log(`    ${chalk.dim("Steps:")} ${formatStepSummary(workflow.steps)}`);

    console.log();
  }
}

function printWorkflowHistory(
  projectName: string,
  history: Array<{
    id: string;
    workflowName: string;
    plugin?: string;
    triggerEvent?: string;
    status: string;
    startTime: string;
    duration: number;
    executedSteps: number;
    totalSteps: number;
    currentStep?: number;
    error?: string;
  }>,
): void {
  console.log(header(`Workflow History: ${projectName}`));
  console.log();

  if (history.length === 0) {
    console.log(chalk.dim("  (no workflow executions recorded)"));
    console.log();
    return;
  }

  // Sort by start time (newest first)
  const sortedHistory = [...history].sort((a, b) => b.startTime.localeCompare(a.startTime));

  for (const entry of sortedHistory) {
    console.log(`  ${chalk.bold(entry.workflowName)} ${chalk.dim(`(${entry.id.slice(-8)})`)}`);
    if (entry.plugin) {
      console.log(`    ${chalk.dim("Plugin:")} ${entry.plugin}`);
    }

    if (entry.triggerEvent) {
      console.log(`    ${chalk.dim("Trigger:")} ${chalk.yellow(entry.triggerEvent)}`);
    }

    console.log(
      `    ${chalk.dim("Status:")} ${formatWorkflowStatus(entry.status)} ${chalk.dim(`(${entry.executedSteps}/${entry.totalSteps} steps`)}${entry.currentStep !== undefined ? `, step ${entry.currentStep})` : ")"}`,
    );

    console.log(
      `    ${chalk.dim("Time:")} ${chalk.dim(new Date(entry.startTime).toLocaleString())} (${chalk.dim(`${entry.duration}ms`)})`,
    );

    if (entry.error) {
      console.log(`    ${chalk.dim("Error:")} ${chalk.red(entry.error)}`);
    }

    console.log();
  }
}

function printWorkflowExamples(): void {
  console.log(header("Workflow Examples"));
  console.log();

  console.log(chalk.bold("  1. Simple sequential workflow:"));
  console.log();
  console.log(chalk.dim("    workflows:"));
  console.log(chalk.dim('      - name: "on-completion-cleanup"'));
  console.log(chalk.dim("        trigger:"));
  console.log(chalk.dim('          event: { type: "story.completed" }'));
  console.log(chalk.dim("        steps:"));
  console.log(chalk.dim('          - action: "updateBurndown"'));
  console.log(chalk.dim('          - action: "notifyTeam"'));
  console.log();

  console.log(chalk.bold("  2. Workflow with conditional steps:"));
  console.log();
  console.log(chalk.dim("    workflows:"));
  console.log(chalk.dim('      - name: "conditional-workflow"'));
  console.log(chalk.dim("        trigger:"));
  console.log(chalk.dim('          event: { type: "story.created" }'));
  console.log(chalk.dim("        steps:"));
  console.log(chalk.dim('          - action: "checkPriority"'));
  console.log(chalk.dim("            if:"));
  console.log(chalk.dim('              field: "previousResult.priority"'));
  console.log(chalk.dim('              operator: "eq"'));
  console.log(chalk.dim('              value: "high"'));
  console.log(chalk.dim('          - action: "assignAgent"'));
  console.log();

  console.log(chalk.bold("  3. Workflow with async steps:"));
  console.log();
  console.log(chalk.dim("    workflows:"));
  console.log(chalk.dim('      - name: "async-workflow"'));
  console.log(chalk.dim("        trigger:"));
  console.log(chalk.dim('          event: { type: "story.completed" }'));
  console.log(chalk.dim("        steps:"));
  console.log(chalk.dim('          - action: "updateMetrics"'));
  console.log(chalk.dim('          - action: "sendReport"'));
  console.log(chalk.dim("            async: true"));
  console.log();

  console.log(chalk.bold("  4. Workflow with retry logic:"));
  console.log();
  console.log(chalk.dim("    workflows:"));
  console.log(chalk.dim('      - name: "retry-workflow"'));
  console.log(chalk.dim("        trigger:"));
  console.log(chalk.dim('          event: { type: "api.call" }'));
  console.log(chalk.dim("        steps:"));
  console.log(chalk.dim('          - action: "callAPI"'));
  console.log(chalk.dim("            retry:"));
  console.log(chalk.dim("              maxAttempts: 3"));
  console.log(chalk.dim("              delay: 1000"));
  console.log(chalk.dim("              backoffMultiplier: 2"));
  console.log();

  console.log(chalk.dim("  Operators: eq, ne, gt, gte, lt, lte, contains, exists, truthy"));
  console.log();
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerWorkflows(program: Command): void {
  program
    .command("workflows [project]")
    .description("List workflows and view execution history")
    .option("--json", "Output as JSON")
    .option("--history", "Show workflow execution history")
    .option("--examples", "Show workflow definition examples")
    .action(
      async (
        projectArg: string | undefined,
        opts: { json?: boolean; history?: boolean; examples?: boolean },
      ) => {
        let config: ReturnType<typeof loadConfig>;
        try {
          config = loadConfig();
        } catch {
          console.error(chalk.red("No config found. Run `ao init` first."));
          process.exit(1);
        }

        if (opts.examples) {
          printWorkflowExamples();
          return;
        }

        const projectId = resolveProject(config, projectArg);
        const project = config.projects[projectId];
        if (!project) {
          console.error(chalk.red(`Project config not found: ${projectId}`));
          process.exit(1);
        }

        // For now, show empty list with examples
        // TODO: Integrate with WorkflowEngine to show actual registered workflows
        const workflows: Array<{
          name: string;
          plugin?: string;
          trigger: { event?: { type: string } };
          steps: Array<{ action: string; if?: unknown; async?: boolean }>;
        }> = [];

        const history: Array<{
          id: string;
          workflowName: string;
          plugin?: string;
          triggerEvent?: string;
          status: string;
          startTime: string;
          duration: number;
          executedSteps: number;
          totalSteps: number;
          currentStep?: number;
          error?: string;
        }> = [];

        if (opts.history) {
          if (opts.json) {
            console.log(JSON.stringify({ project: projectId, history }, null, 2));
          } else {
            printWorkflowHistory(project.name || projectId, history);
          }
        } else {
          if (opts.json) {
            console.log(JSON.stringify({ project: projectId, workflows }, null, 2));
          } else {
            printWorkflowList(project.name || projectId, workflows);
          }
        }
      },
    );
}
