import chalk from "chalk";
import type { Command } from "commander";
import {
  type Agent,
  type SCM,
  type Session,
  type PRInfo,
  type CIStatus,
  type ReviewDecision,
  type ActivityState,
  type AgentStatus,
  type AgentRegistry,
  loadConfig,
  getAgentRegistry,
  getSessionsDir,
} from "@composio/ao-core";
import { git, getTmuxSessions, getTmuxActivity } from "../lib/shell.js";
import {
  banner,
  header,
  formatAge,
  activityIcon,
  ciStatusIcon,
  reviewDecisionIcon,
  padCol,
} from "../lib/format.js";
import { getAgentByName, getSCM, getTracker } from "../lib/plugins.js";
import { getSessionManager } from "../lib/create-session-manager.js";
import { readSprintStatus } from "../lib/story-context.js";
import { join } from "node:path";

interface SessionInfo {
  name: string;
  branch: string | null;
  status: string | null;
  summary: string | null;
  claudeSummary: string | null;
  pr: string | null;
  prNumber: number | null;
  issue: string | null;
  issueTitle: string | null;
  issueStatus: string | null;
  lastActivity: string;
  project: string | null;
  ciStatus: CIStatus | null;
  reviewDecision: ReviewDecision | null;
  pendingThreads: number | null;
  activity: ActivityState | null;
  storyId: string | null;
  agentStatus: AgentStatus | null;
}

/** Color-code agent status for display */
function agentStatusIcon(status: AgentStatus | null): string {
  if (!status) return chalk.dim("-");
  switch (status) {
    case "active":
      return chalk.green(status);
    case "blocked":
      return chalk.red(status);
    case "idle":
      return chalk.yellow(status);
    case "completed":
      return chalk.dim(status);
    case "spawning":
      return chalk.blue(status);
    case "disconnected":
      return chalk.red(status);
    default:
      return chalk.dim(status);
  }
}

async function gatherSessionInfo(
  session: Session,
  agent: Agent,
  scm: SCM,
  projectConfig: ReturnType<typeof loadConfig>,
  registry: AgentRegistry | null,
): Promise<SessionInfo> {
  let branch = session.branch;
  const status = session.status;
  const summary = session.metadata["summary"] ?? null;
  const prUrl = session.metadata["pr"] ?? null;
  const issue = session.issueId;

  // Look up agent-story assignment from registry
  let storyId: string | null = null;
  let agentStatus: AgentStatus | null = null;
  if (registry) {
    const assignment = registry.getByAgent(session.id);
    if (assignment) {
      storyId = assignment.storyId;
      agentStatus = assignment.status;
    }
  }
  // Fallback: read storyId from session metadata if not in registry
  if (!storyId && session.metadata["storyId"]) {
    storyId = session.metadata["storyId"];
  }
  if (!agentStatus && session.metadata["agentStatus"]) {
    agentStatus = session.metadata["agentStatus"] as AgentStatus;
  }

  // Get live branch from worktree if available
  if (session.workspacePath) {
    const liveBranch = await git(["branch", "--show-current"], session.workspacePath);
    if (liveBranch) branch = liveBranch;
  }

  // Get last activity time from tmux
  const tmuxTarget = session.runtimeHandle?.id ?? session.id;
  const activityTs = await getTmuxActivity(tmuxTarget);
  const lastActivity = activityTs ? formatAge(activityTs) : "-";

  // Get agent's auto-generated summary via introspection
  let claudeSummary: string | null = null;
  try {
    const introspection = await agent.getSessionInfo(session);
    claudeSummary = introspection?.summary ?? null;
  } catch {
    // Summary extraction failed — not critical
  }

  // Use activity from session (already enriched by sessionManager.list())
  const activity = session.activity;

  // Fetch PR, CI, and review data from SCM
  let prNumber: number | null = null;
  let ciStatus: CIStatus | null = null;
  let reviewDecision: ReviewDecision | null = null;
  let pendingThreads: number | null = null;

  // Extract PR number from metadata URL as fallback
  if (prUrl) {
    const prMatch = /\/pull\/(\d+)/.exec(prUrl);
    if (prMatch) {
      prNumber = parseInt(prMatch[1], 10);
    }
  }

  if (branch) {
    try {
      const project = projectConfig.projects[session.projectId];
      if (project) {
        const prInfo: PRInfo | null = await scm.detectPR(session, project);
        if (prInfo) {
          prNumber = prInfo.number;

          const [ci, review, threads] = await Promise.all([
            scm.getCISummary(prInfo).catch(() => null),
            scm.getReviewDecision(prInfo).catch(() => null),
            scm.getPendingComments(prInfo).catch(() => null),
          ]);

          ciStatus = ci;
          reviewDecision = review;
          pendingThreads = threads !== null ? threads.length : null;
        }
      }
    } catch {
      // SCM lookup failed — not critical
    }
  }

  // Fetch story info if tracker is available
  let issueTitle: string | null = null;
  let issueStatus: string | null = null;
  if (issue) {
    try {
      const project = projectConfig.projects[session.projectId];
      if (project?.tracker) {
        const tracker = getTracker(projectConfig, session.projectId);
        if (tracker) {
          const issueData = await tracker.getIssue(issue, project);
          issueTitle = issueData.title;
          // Last label is the BMad status (e.g. "in-progress", "done")
          issueStatus =
            issueData.labels.length > 0
              ? (issueData.labels[issueData.labels.length - 1] ?? null)
              : null;
        }
      }
    } catch {
      // Tracker lookup failed — not critical
    }
  }

  return {
    name: session.id,
    branch,
    status,
    summary,
    claudeSummary,
    pr: prUrl,
    prNumber,
    issue,
    issueTitle,
    issueStatus,
    lastActivity,
    project: session.projectId,
    ciStatus,
    reviewDecision,
    pendingThreads,
    activity,
    storyId,
    agentStatus,
  };
}

// Column widths for the table
const COL = {
  session: 14,
  branch: 24,
  story: 12,
  agentSt: 8,
  pr: 6,
  ci: 6,
  review: 6,
  threads: 4,
  activity: 9,
  age: 8,
};

function printTableHeader(): void {
  const hdr =
    padCol("Session", COL.session) +
    padCol("Branch", COL.branch) +
    padCol("Story", COL.story) +
    padCol("AgentSt", COL.agentSt) +
    padCol("PR", COL.pr) +
    padCol("CI", COL.ci) +
    padCol("Rev", COL.review) +
    padCol("Thr", COL.threads) +
    padCol("Activity", COL.activity) +
    "Age";
  console.log(chalk.dim(`  ${hdr}`));
  const totalWidth =
    COL.session +
    COL.branch +
    COL.story +
    COL.agentSt +
    COL.pr +
    COL.ci +
    COL.review +
    COL.threads +
    COL.activity +
    3;
  console.log(chalk.dim(`  ${"─".repeat(totalWidth)}`));
}

function printSessionRow(info: SessionInfo): void {
  const prStr = info.prNumber ? `#${info.prNumber}` : "-";
  // Truncate story ID to fit column
  const storyStr = info.storyId ? info.storyId.slice(0, COL.story - 1) : "-";

  const row =
    padCol(chalk.green(info.name), COL.session) +
    padCol(info.branch ? chalk.cyan(info.branch) : chalk.dim("-"), COL.branch) +
    padCol(info.storyId ? chalk.magenta(storyStr) : chalk.dim(storyStr), COL.story) +
    padCol(agentStatusIcon(info.agentStatus), COL.agentSt) +
    padCol(info.prNumber ? chalk.blue(prStr) : chalk.dim(prStr), COL.pr) +
    padCol(ciStatusIcon(info.ciStatus), COL.ci) +
    padCol(reviewDecisionIcon(info.reviewDecision), COL.review) +
    padCol(
      info.pendingThreads !== null && info.pendingThreads > 0
        ? chalk.yellow(String(info.pendingThreads))
        : chalk.dim(info.pendingThreads !== null ? "0" : "-"),
      COL.threads,
    ) +
    padCol(activityIcon(info.activity), COL.activity) +
    chalk.dim(info.lastActivity);

  console.log(`  ${row}`);

  // Show summary on a second line if available
  const displaySummary = info.claudeSummary || info.summary;
  if (displaySummary) {
    console.log(`  ${" ".repeat(COL.session)}${chalk.dim(displaySummary.slice(0, 60))}`);
  }

  // Show story info if available
  if (info.issueTitle) {
    const statusTag = info.issueStatus ? chalk.dim(` [${info.issueStatus}]`) : "";
    console.log(
      `  ${" ".repeat(COL.session)}${chalk.magenta("story:")} ${info.issueTitle.slice(0, 50)}${statusTag}`,
    );
  }
}

/** Display detailed status for a specific story */
function printStoryDetail(
  storyId: string,
  sessionInfos: SessionInfo[],
  sprintStatus: {
    development_status: Record<string, string>;
    dependencies?: Record<string, string[]>;
  } | null,
): void {
  console.log(header(`Story: ${storyId}`));
  console.log();

  // Sprint status info
  if (sprintStatus) {
    const devStatus = sprintStatus.development_status;
    const storyStatus = devStatus[storyId] ?? "unknown";
    console.log(`  ${chalk.dim("Sprint Status:")} ${chalk.bold(storyStatus)}`);

    // Show dependency status
    const storyDeps = sprintStatus.dependencies?.[storyId];
    if (storyDeps && storyDeps.length > 0) {
      console.log(`  ${chalk.dim("Dependencies:")}`);
      for (const dep of storyDeps) {
        const depStatus = devStatus[dep] ?? "unknown";
        const resolved = depStatus === "done";
        const icon = resolved ? chalk.green("✓") : chalk.yellow("○");
        console.log(`    ${icon} ${dep} — ${chalk.dim(depStatus)}`);
      }
    }
  }

  // Assigned agent info
  const assigned = sessionInfos.filter((s) => s.storyId === storyId);
  if (assigned.length === 0) {
    console.log(`  ${chalk.dim("Agent:")} ${chalk.dim("(no agent assigned)")}`);
  } else {
    console.log(`  ${chalk.dim("Assigned Agents:")}`);
    for (const info of assigned) {
      const duration = info.lastActivity !== "-" ? info.lastActivity : "unknown";
      console.log(
        `    ${chalk.green(info.name)} — ${agentStatusIcon(info.agentStatus)} — ${chalk.dim(duration)}`,
      );
    }
  }
  console.log();
}

export function registerStatus(program: Command): void {
  program
    .command("status")
    .description("Show all sessions with branch, activity, PR, and CI status")
    .option("-p, --project <id>", "Filter by project ID")
    .option("-s, --story <id>", "Show detailed status for a specific story")
    .option("--json", "Output as JSON")
    .action(async (opts: { project?: string; story?: string; json?: boolean }) => {
      let config: ReturnType<typeof loadConfig>;
      try {
        config = loadConfig();
      } catch {
        console.log(chalk.yellow("No config found. Run `ao init` first."));
        console.log(chalk.dim("Falling back to session discovery...\n"));
        await showFallbackStatus();
        return;
      }

      if (opts.project && !config.projects[opts.project]) {
        console.error(chalk.red(`Unknown project: ${opts.project}`));
        process.exit(1);
      }

      // Use session manager to list sessions (metadata-based, not tmux-based)
      const sm = await getSessionManager(config);
      const sessions = await sm.list(opts.project);

      if (!opts.json) {
        console.log(banner("AGENT ORCHESTRATOR STATUS"));
        console.log();
      }

      // Group sessions by project
      const byProject = new Map<string, Session[]>();
      for (const s of sessions) {
        const list = byProject.get(s.projectId) ?? [];
        list.push(s);
        byProject.set(s.projectId, list);
      }

      // Show projects that have no sessions too (if not filtered)
      const projectIds = opts.project ? [opts.project] : Object.keys(config.projects);
      let totalSessions = 0;
      const jsonOutput: SessionInfo[] = [];

      for (const projectId of projectIds) {
        const projectConfig = config.projects[projectId];
        if (!projectConfig) continue;

        const projectSessions = (byProject.get(projectId) ?? []).sort((a, b) =>
          a.id.localeCompare(b.id),
        );

        // Resolve agent and SCM for this project
        const agentName = projectConfig.agent ?? config.defaults.agent;
        const agent = getAgentByName(agentName);
        const scm = getSCM(config, projectId);

        // Get agent registry for this project
        let registry: AgentRegistry | null = null;
        try {
          const sessionsDir = getSessionsDir(config.configPath, projectId);
          registry = getAgentRegistry(sessionsDir, config);
        } catch {
          // Registry unavailable — non-critical, columns will show "-"
        }

        if (!opts.json && !opts.story) {
          console.log(header(projectConfig.name || projectId));
        }

        if (projectSessions.length === 0 && !opts.story) {
          if (!opts.json) {
            console.log(chalk.dim("  (no active sessions)"));
            console.log();
          }
          continue;
        }

        totalSessions += projectSessions.length;

        // Gather all session info in parallel
        const infoPromises = projectSessions.map((s) =>
          gatherSessionInfo(s, agent, scm, config, registry),
        );
        const sessionInfos = await Promise.all(infoPromises);

        // Story detail mode
        if (opts.story) {
          let sprintStatus: ReturnType<typeof readSprintStatus> = null;
          try {
            const storyDir =
              typeof projectConfig.tracker?.["storyDir"] === "string"
                ? projectConfig.tracker["storyDir"]
                : "_bmad-output/implementation-artifacts";
            sprintStatus = readSprintStatus(join(projectConfig.path, storyDir));
          } catch {
            // Sprint status unavailable
          }
          printStoryDetail(opts.story, sessionInfos, sprintStatus);
          // Include matching sessions in JSON
          if (opts.json) {
            const matching = sessionInfos.filter((s) => s.storyId === opts.story);
            jsonOutput.push(...matching);
          }
          continue;
        }

        if (!opts.json) {
          printTableHeader();
        }

        for (const info of sessionInfos) {
          if (opts.json) {
            jsonOutput.push(info);
          } else {
            printSessionRow(info);
          }
        }

        if (!opts.json) {
          console.log();
        }
      }

      if (opts.json) {
        console.log(JSON.stringify(jsonOutput, null, 2));
      } else if (!opts.story) {
        console.log(
          chalk.dim(
            `  ${totalSessions} active session${totalSessions !== 1 ? "s" : ""} across ${projectIds.length} project${projectIds.length !== 1 ? "s" : ""}`,
          ),
        );
        console.log();
      }
    });
}

async function showFallbackStatus(): Promise<void> {
  const allTmux = await getTmuxSessions();
  if (allTmux.length === 0) {
    console.log(chalk.dim("No tmux sessions found."));
    return;
  }

  console.log(banner("AGENT ORCHESTRATOR STATUS"));
  console.log();
  console.log(
    chalk.dim(`  ${allTmux.length} tmux session${allTmux.length !== 1 ? "s" : ""} found\n`),
  );

  // Use claude-code as default agent for fallback introspection
  const agent = getAgentByName("claude-code");

  for (const session of allTmux.sort()) {
    const activityTs = await getTmuxActivity(session);
    const lastActivity = activityTs ? formatAge(activityTs) : "-";
    console.log(`  ${chalk.green(session)} ${chalk.dim(`(${lastActivity})`)}`);

    // Try introspection even without config
    try {
      const sessionObj: Session = {
        id: session,
        projectId: "",
        status: "working",
        activity: null,
        branch: null,
        issueId: null,
        pr: null,
        workspacePath: null,
        runtimeHandle: { id: session, runtimeName: "tmux", data: {} },
        agentInfo: null,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        metadata: {},
      };
      const introspection = await agent.getSessionInfo(sessionObj);
      if (introspection?.summary) {
        console.log(`     ${chalk.dim("Claude:")} ${introspection.summary.slice(0, 65)}`);
      }
    } catch {
      // Not critical
    }
  }
  console.log();
}
