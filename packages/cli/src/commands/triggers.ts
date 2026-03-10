/**
 * ao triggers — List registered trigger conditions
 *
 * Usage:
 *   ao triggers [project]           — list all triggers for a project
 */

import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "@composio/ao-core";
import { header } from "../lib/format.js";
import { resolveProject } from "../lib/resolve-project.js";

// ---------------------------------------------------------------------------
// Display functions
// ---------------------------------------------------------------------------

function formatConditionSummary(condition: unknown): string {
  // Simple formatting for condition display
  const cond = condition as Record<string, unknown>;
  const parts: string[] = [];

  if (cond.story) {
    const story = cond.story as Record<string, unknown>;
    const storyParts: string[] = [];
    for (const [key, value] of Object.entries(story)) {
      if (typeof value === "object" && value !== null) {
        const op = Object.keys(value)[0] ?? "";
        const opValue = (value as Record<string, unknown>)[op];
        storyParts.push(`${key} ${op} ${JSON.stringify(opValue)}`);
      } else {
        storyParts.push(`${key} = ${JSON.stringify(value)}`);
      }
    }
    if (storyParts.length > 0) {
      parts.push(chalk.cyan(`story:`) + " " + storyParts.join(", "));
    }
  }

  if (cond.event) {
    const event = cond.event as Record<string, unknown>;
    if (event.type) {
      parts.push(chalk.cyan(`event:`) + ` type = ${JSON.stringify(event.type)}`);
    }
  }

  if (cond.time) {
    const time = cond.time as Record<string, unknown>;
    const timeParts: string[] = [];
    if (time.hour) {
      const hour = time.hour as { start: number; end: number };
      timeParts.push(`hour: ${hour.start}-${hour.end}`);
    }
    if (time.dayOfWeek !== undefined) {
      timeParts.push(`dayOfWeek: ${JSON.stringify(time.dayOfWeek)}`);
    }
    if (timeParts.length > 0) {
      parts.push(chalk.cyan(`time:`) + " " + timeParts.join(", "));
    }
  }

  if (cond.and) {
    parts.push(chalk.yellow(`AND` + ` (${(cond.and as unknown[]).length} conditions)`));
  }

  if (cond.or) {
    parts.push(chalk.yellow(`OR` + ` (${(cond.or as unknown[]).length} conditions)`));
  }

  if (cond.not) {
    parts.push(chalk.yellow(`NOT` + ` (1 condition)`));
  }

  return parts.length > 0 ? parts.join(" ") : chalk.dim("(no condition)");
}

function printTriggerList(
  projectName: string,
  triggers: Array<{
    name: string;
    plugin?: string;
    condition: unknown;
    action: string | unknown;
    debounce?: number;
    once?: boolean;
  }>,
  stats?: Record<string, { fireCount: number; lastFired?: string }>,
): void {
  console.log(header(`Triggers: ${projectName}`));
  console.log();

  if (triggers.length === 0) {
    console.log(chalk.dim("  (no triggers registered)"));
    console.log();
    console.log(chalk.dim("  Triggers can be defined in plugin.yaml files:"));
    console.log();
    console.log(chalk.dim("    triggers:"));
    console.log(chalk.dim('      - name: "auto-assign-high-priority"'));
    console.log(chalk.dim("        condition:"));
    console.log(chalk.dim("          story:"));
    console.log(chalk.dim('            priority: "high"'));
    console.log(chalk.dim('            status: "todo"'));
    console.log(chalk.dim('        action: "autoAssignAgent"'));
    console.log();
    return;
  }

  for (const trigger of triggers) {
    const triggerStats = stats?.[trigger.name];

    console.log(`  ${chalk.bold(trigger.name)}`);
    if (trigger.plugin) {
      console.log(`    ${chalk.dim("Plugin:")} ${trigger.plugin}`);
    }

    console.log(`    ${chalk.dim("Condition:")} ${formatConditionSummary(trigger.condition)}`);

    if (typeof trigger.action === "string") {
      console.log(`    ${chalk.dim("Action:")} ${chalk.green(trigger.action)}`);
    } else {
      console.log(`    ${chalk.dim("Action:")} ${chalk.green("(function)")}`);
    }

    if (trigger.debounce) {
      console.log(`    ${chalk.dim("Debounce:")} ${trigger.debounce}ms`);
    }

    if (trigger.once) {
      console.log(`    ${chalk.dim("Once:")} true`);
    }

    if (triggerStats) {
      console.log(
        `    ${chalk.dim("Stats:")} fired ${chalk.yellow(String(triggerStats.fireCount))}x${
          triggerStats.lastFired
            ? `, last: ${chalk.dim(new Date(triggerStats.lastFired).toLocaleString())}`
            : ""
        }`,
      );
    }

    console.log();
  }
}

function printTriggerExamples(): void {
  console.log(header("Trigger Examples"));
  console.log();
  console.log(chalk.bold("  1. Story-based trigger:"));
  console.log();
  console.log(chalk.dim("    triggers:"));
  console.log(chalk.dim('      - name: "auto-assign-high-priority"'));
  console.log(chalk.dim("        condition:"));
  console.log(chalk.dim("          story:"));
  console.log(chalk.dim('            priority: "high"'));
  console.log(chalk.dim('            status: "todo"'));
  console.log(chalk.dim('        action: "autoAssignAgent"'));
  console.log();

  console.log(chalk.bold("  2. Event-based trigger:"));
  console.log();
  console.log(chalk.dim("    triggers:"));
  console.log(chalk.dim('      - name: "notify-on-complete"'));
  console.log(chalk.dim("        condition:"));
  console.log(chalk.dim("          event:"));
  console.log(chalk.dim('            type: "story.completed"'));
  console.log(chalk.dim('        action: "sendNotification"'));
  console.log();

  console.log(chalk.bold("  3. Combined conditions (AND/OR/NOT):"));
  console.log();
  console.log(chalk.dim("    triggers:"));
  console.log(chalk.dim('      - name: "urgent-or-high"'));
  console.log(chalk.dim("        condition:"));
  console.log(chalk.dim("          or:"));
  console.log(chalk.dim('            - story: { tags: ["urgent"] }'));
  console.log(chalk.dim('            - story: { priority: "high" }'));
  console.log(chalk.dim('        action: "escalate"'));
  console.log();

  console.log(chalk.bold("  4. With operators:"));
  console.log();
  console.log(chalk.dim("    triggers:"));
  console.log(chalk.dim('      - name: "large-stories"'));
  console.log(chalk.dim("        condition:"));
  console.log(chalk.dim("          story:"));
  console.log(chalk.dim("            points: { gte: 8 }"));
  console.log(chalk.dim('        action: "reviewRequired"'));
  console.log();

  console.log(chalk.bold("  Available operators:"));
  console.log();
  console.log(chalk.dim("    String: eq, ne, contains, matches (regex)"));
  console.log(chalk.dim("    Number: eq, ne, gt, gte, lt, lte"));
  console.log(chalk.dim('    Tags: ["tag1", "tag2"] (AND) or { any: ["tag1", "tag2"] } (OR)'));
  console.log(chalk.dim("    Boolean: AND, OR, NOT for combining conditions"));
  console.log();
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerTriggers(program: Command): void {
  program
    .command("triggers [project]")
    .description("List registered trigger conditions")
    .option("--json", "Output as JSON")
    .option("--examples", "Show trigger definition examples")
    .action(
      async (projectArg: string | undefined, opts: { json?: boolean; examples?: boolean }) => {
        let config: ReturnType<typeof loadConfig>;
        try {
          config = loadConfig();
        } catch {
          console.error(chalk.red("No config found. Run `ao init` first."));
          process.exit(1);
        }

        if (opts.examples) {
          printTriggerExamples();
          return;
        }

        const projectId = resolveProject(config, projectArg);
        const project = config.projects[projectId];
        if (!project) {
          console.error(chalk.red(`Project config not found: ${projectId}`));
          process.exit(1);
        }

        // For now, show empty list with examples
        // TODO: Integrate with TriggerEvaluator to show actual registered triggers
        const triggers: Array<{
          name: string;
          plugin?: string;
          condition: unknown;
          action: string | unknown;
          debounce?: number;
          once?: boolean;
        }> = [];

        if (opts.json) {
          console.log(JSON.stringify({ project: projectId, triggers }, null, 2));
          return;
        }

        printTriggerList(project.name || projectId, triggers);
      },
    );
}
