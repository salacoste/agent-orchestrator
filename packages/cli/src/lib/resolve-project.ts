import chalk from "chalk";
import type { OrchestratorConfig } from "@composio/ao-core";

/**
 * Resolve a project ID from a CLI argument or pick the only project.
 * Prints an error and exits if the project is unknown or ambiguous.
 */
export function resolveProject(config: OrchestratorConfig, projectArg: string | undefined): string {
  const projectIds = Object.keys(config.projects);

  if (projectArg) {
    if (!config.projects[projectArg]) {
      console.error(
        chalk.red(`Unknown project: ${projectArg}\nAvailable: ${projectIds.join(", ")}`),
      );
      process.exit(1);
    }
    return projectArg;
  }

  if (projectIds.length === 1 && projectIds[0]) {
    return projectIds[0];
  }

  console.error(chalk.red(`Multiple projects found. Specify one: ${projectIds.join(", ")}`));
  process.exit(1);
}
