import chalk from "chalk";
import ora from "ora";
import { join } from "node:path";
import type { Command } from "commander";
import {
  loadConfig,
  type OrchestratorConfig,
  type AgentStatus,
  getAgentRegistry,
  computeStoryContextHash,
  getSessionsDir,
  getEventPublisher,
  createConflictDetectionService,
  updateMetadata,
} from "@composio/ao-core";
import { exec } from "../lib/shell.js";
import { banner, header } from "../lib/format.js";
import { getSessionManager } from "../lib/create-session-manager.js";
import { preflight } from "../lib/preflight.js";
import { getTracker } from "../lib/plugins.js";
import {
  readSprintStatus,
  findStoryFile,
  parseStoryFile,
  formatStoryPrompt,
  promptConfirmation,
} from "../lib/story-context.js";
import { wireDetection } from "../lib/wire-detection.js";

/**
 * Run pre-flight checks for a project once, before any sessions are spawned.
 * Validates runtime and tracker prerequisites so failures surface immediately
 * rather than repeating per-session in a batch.
 */
async function runSpawnPreflight(config: OrchestratorConfig, projectId: string): Promise<void> {
  const project = config.projects[projectId];
  const runtime = project?.runtime ?? config.defaults.runtime;
  if (runtime === "tmux") {
    await preflight.checkTmux();
  }
  if (project?.tracker?.plugin === "github") {
    await preflight.checkGhAuth();
  }
}

async function spawnSession(
  config: OrchestratorConfig,
  projectId: string,
  issueId?: string,
  openTab?: boolean,
  agent?: string,
  storyContext?: string,
): Promise<string> {
  const spinner = ora("Creating session").start();

  try {
    const sm = await getSessionManager(config);
    spinner.text = "Spawning session via core";

    const session = await sm.spawn({
      projectId,
      issueId,
      agent,
      storyContext,
    });

    spinner.succeed(`Session ${chalk.green(session.id)} created`);

    console.log(`  Worktree: ${chalk.dim(session.workspacePath ?? "-")}`);
    if (session.branch) console.log(`  Branch:   ${chalk.dim(session.branch)}`);

    // Show the tmux name for attaching (stored in metadata or runtimeHandle)
    const tmuxTarget = session.runtimeHandle?.id ?? session.id;
    console.log(`  Attach:   ${chalk.dim(`tmux attach -t ${tmuxTarget}`)}`);
    console.log();

    // Open terminal tab if requested
    if (openTab) {
      try {
        await exec("open-iterm-tab", [tmuxTarget]);
      } catch {
        // Terminal plugin not available
      }
    }

    // Output for scripting
    console.log(`SESSION=${session.id}`);
    return session.id;
  } catch (err) {
    spinner.fail("Failed to create session");
    throw err;
  }
}

/**
 * Resolve the story location directory from project config.
 * Uses tracker.storyDir if configured, otherwise defaults to _bmad-output/implementation-artifacts.
 */
function resolveStoryDir(
  projectPath: string,
  project: { tracker?: Record<string, unknown> },
): string {
  const storyDir =
    typeof project.tracker?.["storyDir"] === "string"
      ? project.tracker["storyDir"]
      : "_bmad-output/implementation-artifacts";
  return join(projectPath, storyDir);
}

/**
 * Handle the --story flow: read sprint status, parse story, check deps/conflicts, spawn.
 */
async function spawnWithStory(
  config: OrchestratorConfig,
  projectId: string,
  rawStoryId: string,
  opts: { open?: boolean; agent?: string; force?: boolean },
): Promise<void> {
  const project = config.projects[projectId];

  // Normalize story ID (remove leading "story-" if present)
  const storyId = rawStoryId.startsWith("story-") ? rawStoryId.slice(6) : rawStoryId;

  // Validate story ID format (prevent path traversal)
  if (!/^[\w][\w-]*$/.test(storyId)) {
    console.error(
      chalk.red(
        `Invalid story ID: "${storyId}"\nStory IDs must be alphanumeric with hyphens (e.g. 1-2-user-auth).`,
      ),
    );
    process.exit(1);
  }

  // Read sprint-status.yaml from project path (not CWD)
  const storyDir = resolveStoryDir(project.path, project);
  const sprintStatus = readSprintStatus(storyDir);

  if (!sprintStatus) {
    console.error(
      chalk.red(
        `sprint-status.yaml not found in ${storyDir}\n` +
          "Ensure the file exists. Run sprint-planning to generate it.",
      ),
    );
    process.exit(1);
  }

  // Check if story exists in sprint-status.yaml
  const storyStatus = sprintStatus.development_status[storyId];
  if (!storyStatus) {
    const allStories = Object.keys(sprintStatus.development_status).filter(
      (k) => k.match(/^\d+-\d+-/) && !k.startsWith("epic-"),
    );
    const displayStories = allStories.slice(0, 10);
    console.error(
      chalk.red(
        `Story "${storyId}" not found in sprint-status.yaml\n\n` +
          `Available stories:\n  ${displayStories.join("\n  ")}` +
          (allStories.length > 10 ? "\n  ..." : ""),
      ),
    );
    process.exit(1);
  }

  // Find and parse story file
  const storyLocation = sprintStatus.story_location
    ? join(project.path, sprintStatus.story_location)
    : storyDir;
  const storyFilePath = findStoryFile(storyId, storyLocation);

  if (!storyFilePath) {
    console.error(
      chalk.red(
        `Story file for "${storyId}" not found in ${storyLocation}\n` +
          `Ensure story file exists with name: ${storyId}.md or story-${storyId}.md`,
      ),
    );
    process.exit(1);
  }

  const storyContext = parseStoryFile(storyFilePath, storyId);
  if (!storyContext) {
    console.error(chalk.red(`Failed to extract context from story file: ${storyFilePath}`));
    process.exit(1);
  }

  // Add dependencies from sprint-status.yaml if available
  if (sprintStatus.dependencies?.[storyId]) {
    storyContext.dependencies = sprintStatus.dependencies[storyId];
  }

  // Add priority from sprint-status.yaml if available
  if (sprintStatus.priorities?.[storyId]) {
    storyContext.priority = sprintStatus.priorities[storyId];
  }

  // Check for unresolved dependencies (AC #3)
  if (sprintStatus.dependencies?.[storyId]) {
    const deps = sprintStatus.dependencies[storyId];
    const unresolvedDeps = deps.filter((dep) => {
      const depStatus = sprintStatus.development_status[dep];
      return depStatus !== "done";
    });

    if (unresolvedDeps.length > 0 && !opts.force) {
      console.log();
      console.log(chalk.yellow.bold("⚠ Unresolved Dependencies"));
      console.log();
      for (const dep of unresolvedDeps) {
        const depStatus = sprintStatus.development_status[dep] ?? "unknown";
        console.log(`  ${chalk.yellow("•")} ${chalk.bold(dep)} — ${chalk.dim(depStatus)}`);
      }
      console.log();

      const shouldContinue = await promptConfirmation(
        "Story has unresolved dependencies. Continue anyway?",
      );
      if (!shouldContinue) {
        console.log(chalk.dim("Spawn cancelled."));
        process.exit(0);
      }
    }
  }

  // Conflict detection (AC #7)
  const sessionsDir = getSessionsDir(config.configPath, projectId);
  const registry = getAgentRegistry(sessionsDir, config);

  if (!opts.force) {
    const conflictService = createConflictDetectionService(registry, { enabled: true });
    const canAssign = conflictService.canAssign(storyId, "temp-new-agent");

    if (!canAssign) {
      const existing = registry.findActiveByStory(storyId);
      console.log();
      console.log(chalk.yellow.bold(`⚠ Conflict: Story ${storyId} already has an active agent`));
      if (existing) {
        console.log(`  Agent: ${chalk.bold(existing.agentId)}`);
        console.log(`  Assigned: ${chalk.dim(existing.assignedAt.toISOString())}`);
      }
      console.log();

      const shouldContinue = await promptConfirmation("Spawn another agent for this story?");
      if (!shouldContinue) {
        console.log(chalk.dim("Spawn cancelled."));
        process.exit(0);
      }
    }
  }

  // Display spawn summary
  console.log(header(`Spawning Agent for Story: ${storyId}`));
  console.log();
  console.log(`  ${chalk.dim("Story:")}   ${chalk.bold(storyContext.title)}`);
  console.log(`  ${chalk.dim("Epic:")}    ${storyContext.epic ?? "N/A"}`);
  console.log(`  ${chalk.dim("Status:")}  ${storyStatus}`);
  if (storyContext.dependencies?.length) {
    console.log(`  ${chalk.dim("Deps:")}    ${storyContext.dependencies.join(", ")}`);
  }
  console.log();

  // Format story context for prompt builder
  const storyPrompt = formatStoryPrompt(storyContext);

  // Run preflight then spawn
  await runSpawnPreflight(config, projectId);
  const sessionId = await spawnSession(
    config,
    projectId,
    storyId, // Use storyId as issueId for branch naming
    opts.open,
    opts.agent,
    storyPrompt,
  );

  // Store storyId and initial agentStatus in session metadata for lifecycle tracking
  updateMetadata(sessionsDir, sessionId, { storyId, agentStatus: "active" });

  // Register agent-story assignment (AC #5)
  const contextHash = computeStoryContextHash(
    storyContext.title,
    storyContext.description,
    storyContext.acceptanceCriteria,
  );

  registry.register({
    agentId: sessionId,
    storyId,
    assignedAt: new Date(),
    status: "active" as AgentStatus,
    contextHash,
    priority: 0,
  });

  // --- Wire completion + blocked detection (Tasks 3-5) ---
  // Detection runs for the lifetime of this CLI process.
  // If the user Ctrl+C's, detection stops (acceptable for MVP).
  // Detection setup is non-fatal — spawn succeeds even if monitoring fails.
  try {
    await wireDetection(config, projectId, sessionId, sessionsDir, storyDir, registry);
  } catch (err) {
    // Non-fatal: monitoring failure doesn't block the spawn
    console.log(
      chalk.dim(
        `  (monitoring not available: ${err instanceof Error ? err.message : String(err)})`,
      ),
    );
  }

  // Publish story lifecycle events (non-fatal)
  // EventPublisher is set up by wireDetection above, available via service registry
  try {
    const ep = getEventPublisher();
    if (ep) {
      await ep.publishStoryAssigned({ storyId, agentId: sessionId, reason: "auto" });
      await ep.publishStoryStarted({ storyId, agentId: sessionId, contextHash });
    }
  } catch {
    // Non-fatal: event publishing is an enhancement
  }
}

export function registerSpawn(program: Command): void {
  program
    .command("spawn")
    .description("Spawn a single agent session")
    .argument("<project>", "Project ID from config")
    .argument("[issue]", "Issue identifier (e.g. INT-1234, #42) - must exist in tracker")
    .option("--open", "Open session in terminal tab")
    .option("--agent <name>", "Override the agent plugin (e.g. glm, codex, claude-code)")
    .option("--story <id>", "Story ID from sprint-status.yaml (e.g. 1-2-user-auth)")
    .option("--force", "Skip dependency and conflict checks")
    .action(
      async (
        projectId: string,
        issueId: string | undefined,
        opts: { open?: boolean; agent?: string; story?: string; force?: boolean },
      ) => {
        const config = loadConfig();
        if (!config.projects[projectId]) {
          console.error(
            chalk.red(
              `Unknown project: ${projectId}\nAvailable: ${Object.keys(config.projects).join(", ")}`,
            ),
          );
          process.exit(1);
        }

        try {
          // --story takes precedence over [issue] argument
          if (opts.story) {
            await spawnWithStory(config, projectId, opts.story, opts);
          } else {
            await runSpawnPreflight(config, projectId);
            await spawnSession(config, projectId, issueId, opts.open, opts.agent);
          }
        } catch (err) {
          console.error(chalk.red(`✗ ${err instanceof Error ? err.message : String(err)}`));
          process.exit(1);
        }
      },
    );
}

export function registerBatchSpawn(program: Command): void {
  program
    .command("batch-spawn")
    .description("Spawn sessions for multiple issues with duplicate detection")
    .argument("<project>", "Project ID from config")
    .argument("[issues...]", "Issue identifiers (optional when --ready is used)")
    .option("--open", "Open sessions in terminal tabs")
    .option("--ready", "Auto-discover stories with 'ready-for-dev' status from tracker")
    .action(
      async (
        projectId: string,
        explicitIssues: string[],
        opts: { open?: boolean; ready?: boolean },
      ) => {
        const config = loadConfig();
        if (!config.projects[projectId]) {
          console.error(
            chalk.red(
              `Unknown project: ${projectId}\nAvailable: ${Object.keys(config.projects).join(", ")}`,
            ),
          );
          process.exit(1);
        }

        const project = config.projects[projectId];

        // Collect all issue IDs to process, merging explicit + --ready discovered
        const extraReadyIds: string[] = [];

        if (opts.ready) {
          const tracker = getTracker(config, projectId);
          if (!tracker) {
            console.error(
              chalk.red(
                `No tracker configured for project: ${projectId}\nConfigure a tracker plugin in agent-orchestrator.yaml to use --ready`,
              ),
            );
            process.exit(1);
          }

          if (!tracker.listIssues) {
            console.error(
              chalk.red(
                `Tracker plugin "${tracker.name}" does not support listing issues (listIssues not implemented)`,
              ),
            );
            process.exit(1);
          }

          console.log(chalk.dim("  Discovering ready-for-dev stories from tracker..."));
          const readyIssues = await tracker.listIssues(
            { state: "open", labels: ["ready-for-dev"] },
            project,
          );

          if (readyIssues.length === 0) {
            console.log(chalk.yellow("  No ready-for-dev stories found in tracker"));
          } else {
            const readyIds = readyIssues.map((i) => i.id);
            console.log(
              chalk.dim(`  Discovered ${readyIds.length} ready issue(s): ${readyIds.join(", ")}`),
            );
            // Collect ready IDs not already in the explicit list
            const explicitLower = new Set(explicitIssues.map((id) => id.toLowerCase()));
            for (const id of readyIds) {
              if (!explicitLower.has(id.toLowerCase())) {
                extraReadyIds.push(id);
              }
            }
          }
        }

        // Deduplicate: explicit issues first, then any newly discovered ready ones
        const issues = [...explicitIssues, ...extraReadyIds];

        if (issues.length === 0) {
          console.error(
            chalk.red(
              "No issues to spawn. Provide issue identifiers or use --ready to auto-discover.",
            ),
          );
          process.exit(1);
        }

        console.log(banner("BATCH SESSION SPAWNER"));
        console.log();
        console.log(`  Project: ${chalk.bold(projectId)}`);
        console.log(`  Issues:  ${issues.join(", ")}`);
        console.log();

        // Pre-flight once before the loop so a missing prerequisite fails fast
        try {
          await runSpawnPreflight(config, projectId);
        } catch (err) {
          console.error(chalk.red(`✗ ${err instanceof Error ? err.message : String(err)}`));
          process.exit(1);
        }

        const sm = await getSessionManager(config);
        const created: Array<{ session: string; issue: string }> = [];
        const skipped: Array<{ issue: string; existing: string }> = [];
        const failed: Array<{ issue: string; error: string }> = [];
        const spawnedIssues = new Set<string>();

        // Load existing sessions once before the loop to avoid repeated reads + enrichment.
        // Exclude dead/killed sessions so crashed sessions don't block respawning.
        const deadStatuses = new Set(["killed", "done", "exited"]);
        const existingSessions = await sm.list(projectId);
        const existingIssueMap = new Map(
          existingSessions
            .filter(
              (s): s is typeof s & { issueId: string } =>
                s.issueId !== null && s.issueId !== undefined && !deadStatuses.has(s.status),
            )
            .map((s) => [s.issueId.toLowerCase(), s.id]),
        );

        for (const issue of issues) {
          // Duplicate detection — check both existing sessions and same-run duplicates
          if (spawnedIssues.has(issue.toLowerCase())) {
            console.log(chalk.yellow(`  Skip ${issue} — duplicate in this batch`));
            skipped.push({ issue, existing: "(this batch)" });
            continue;
          }

          // Check existing sessions (pre-loaded before loop)
          const existingSessionId = existingIssueMap.get(issue.toLowerCase());
          if (existingSessionId) {
            console.log(
              chalk.yellow(`  Skip ${issue} — already has session: ${existingSessionId}`),
            );
            skipped.push({ issue, existing: existingSessionId });
            continue;
          }

          try {
            const sessionName = await spawnSession(config, projectId, issue, opts.open);
            created.push({ session: sessionName, issue });
            spawnedIssues.add(issue.toLowerCase());
          } catch (err) {
            const message = String(err);
            console.error(chalk.red(`  ✗ ${issue} — ${err}`));
            failed.push({ issue, error: message });
          }

          // Small delay between spawns
          await new Promise((r) => setTimeout(r, 500));
        }

        console.log(chalk.bold("\nSummary:"));
        console.log(`  Created: ${chalk.green(String(created.length))} sessions`);
        console.log(`  Skipped: ${chalk.yellow(String(skipped.length))} (duplicate)`);
        console.log(`  Failed:  ${chalk.red(String(failed.length))}`);

        if (created.length > 0) {
          console.log(chalk.bold("\nCreated sessions:"));
          for (const { session, issue } of created) {
            console.log(`  ${chalk.green(session)} -> ${issue}`);
          }
        }
        if (skipped.length > 0) {
          console.log(chalk.bold("\nSkipped (duplicate):"));
          for (const { issue, existing } of skipped) {
            console.log(`  ${issue} -> existing: ${existing}`);
          }
        }
        if (failed.length > 0) {
          console.log(chalk.yellow(`\n${failed.length} failed:`));
          failed.forEach((f) => {
            console.log(chalk.dim(`  - ${f.issue}: ${f.error}`));
          });
        }
        console.log();
      },
    );
}
