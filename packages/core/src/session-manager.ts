/**
 * Session Manager — CRUD for agent sessions.
 *
 * Orchestrates Runtime, Agent, and Workspace plugins to:
 * - Spawn new sessions (create workspace → create runtime → launch agent)
 * - List sessions (from metadata + live runtime checks)
 * - Kill sessions (agent → runtime → workspace cleanup)
 * - Cleanup completed sessions (PR merged / issue closed)
 * - Send messages to running sessions
 *
 * Reference: scripts/claude-ao-session, scripts/send-to-session
 */

import { statSync, existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  isIssueNotFoundError,
  isRestorable,
  NON_RESTORABLE_STATUSES,
  SessionNotRestorableError,
  WorkspaceMissingError,
  type SessionManager,
  type Session,
  type SessionId,
  type SessionSpawnConfig,
  type OrchestratorSpawnConfig,
  type SessionStatus,
  type CleanupResult,
  type OrchestratorConfig,
  type ProjectConfig,
  type Runtime,
  type Agent,
  type Workspace,
  type Tracker,
  type SCM,
  type PluginRegistry,
  type RuntimeHandle,
  type Issue,
  type SessionEnhancementProvider,
  type ProviderConfig,
  type ModelTierMapping,
  type ModelTier,
  type HookRegistry,
  type StoryContext,
  type AgentMapping,
  DEFAULT_MODEL_TIERS,
  PR_STATE,
} from "./types.js";
import { modelRoutingService } from "./model-routing.js";
import { verifyInstallation, verifyOmcConfigure } from "./provider-verify.js";
import { performMerge } from "./claudemd-merge.js";
import {
  readMetadataRaw,
  readArchivedMetadataRaw,
  writeMetadata,
  updateMetadata,
  deleteMetadata,
  listMetadata,
  reserveSessionId,
} from "./metadata.js";
import { buildPrompt } from "./prompt-builder.js";
import { updateSprintStatus, logAuditEvent } from "./completion-handlers.js";
import { getAgentRegistry } from "./agent-registry.js";
import {
  getSessionsDir,
  getProjectBaseDir,
  generateTmuxName,
  generateConfigHash,
  validateAndStoreOrigin,
} from "./paths.js";

/** Escape regex metacharacters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Get the next session number for a project. */
function getNextSessionNumber(existingSessions: string[], prefix: string): number {
  let max = 0;
  const pattern = new RegExp(`^${escapeRegex(prefix)}-(\\d+)$`);
  for (const name of existingSessions) {
    const match = name.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return max + 1;
}

/** Safely parse JSON, returning null on failure. */
function safeJsonParse<T>(str: string): T | null {
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

/** Valid session statuses for validation. */
const VALID_STATUSES: ReadonlySet<string> = new Set([
  "spawning",
  "working",
  "pr_open",
  "ci_failed",
  "review_pending",
  "changes_requested",
  "approved",
  "mergeable",
  "merged",
  "cleanup",
  "needs_input",
  "stuck",
  "errored",
  "killed",
  "done",
  "terminated",
]);

/** Validate and normalize a status string. */
function validateStatus(raw: string | undefined): SessionStatus {
  // Bash scripts write "starting" — treat as "working"
  if (raw === "starting") return "working";
  if (raw && VALID_STATUSES.has(raw)) return raw as SessionStatus;
  return "spawning";
}

/** Reconstruct a Session object from raw metadata key=value pairs. */
function metadataToSession(
  sessionId: SessionId,
  meta: Record<string, string>,
  createdAt?: Date,
  modifiedAt?: Date,
): Session {
  return {
    id: sessionId,
    projectId: meta["project"] ?? "",
    status: validateStatus(meta["status"]),
    activity: null,
    branch: meta["branch"] || null,
    issueId: meta["issue"] || null,
    pr: meta["pr"]
      ? (() => {
          // Parse owner/repo from GitHub PR URL: https://github.com/owner/repo/pull/123
          const prUrl = meta["pr"];
          const ghMatch = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
          return {
            number: ghMatch
              ? parseInt(ghMatch[3], 10)
              : parseInt(prUrl.match(/\/(\d+)$/)?.[1] ?? "0", 10),
            url: prUrl,
            title: "",
            owner: ghMatch?.[1] ?? "",
            repo: ghMatch?.[2] ?? "",
            branch: meta["branch"] ?? "",
            baseBranch: "",
            isDraft: false,
          };
        })()
      : null,
    workspacePath: meta["worktree"] || null,
    runtimeHandle: meta["runtimeHandle"]
      ? safeJsonParse<RuntimeHandle>(meta["runtimeHandle"])
      : null,
    agentInfo: meta["summary"] ? { summary: meta["summary"], agentSessionId: null } : null,
    createdAt: meta["createdAt"] ? new Date(meta["createdAt"]) : (createdAt ?? new Date()),
    lastActivityAt: modifiedAt ?? new Date(),
    restoredAt: meta["restoredAt"] ? new Date(meta["restoredAt"]) : undefined,
    metadata: meta,
  };
}

export interface SessionManagerDeps {
  config: OrchestratorConfig;
  registry: PluginRegistry;
}

/**
 * Resolve model tier mapping for a project.
 * Cascade: project override > global config > DEFAULT_MODEL_TIERS.
 */
export function resolveModelTiers(
  config: OrchestratorConfig,
  project: ProjectConfig,
): ModelTierMapping {
  return (
    project.sessionEnhancement?.modelTiers ??
    config.sessionEnhancement?.modelTiers ??
    DEFAULT_MODEL_TIERS
  );
}

/** Create a SessionManager instance. */
export function createSessionManager(deps: SessionManagerDeps): SessionManager {
  const { config, registry } = deps;

  /**
   * Get the sessions directory for a project.
   */
  function getProjectSessionsDir(project: ProjectConfig): string {
    return getSessionsDir(config.configPath, project.path);
  }

  /**
   * List all session files across all projects (or filtered by projectId).
   * Scans project-specific directories under ~/.agent-orchestrator/{hash}-{projectId}/sessions/
   *
   * Note: projectId is the config key (e.g., "test-project"), not the path basename.
   */
  function listAllSessions(projectIdFilter?: string): { sessionName: string; projectId: string }[] {
    const results: { sessionName: string; projectId: string }[] = [];

    // Scan each project's sessions directory
    for (const [projectKey, project] of Object.entries(config.projects)) {
      // Use config key as projectId for consistency with metadata
      const projectId = projectKey;

      // Filter by project if specified
      if (projectIdFilter && projectId !== projectIdFilter) continue;

      const sessionsDir = getSessionsDir(config.configPath, project.path);
      if (!existsSync(sessionsDir)) continue;

      const files = readdirSync(sessionsDir);
      for (const file of files) {
        if (file === "archive" || file.startsWith(".")) continue;
        const fullPath = join(sessionsDir, file);
        try {
          if (statSync(fullPath).isFile()) {
            results.push({ sessionName: file, projectId });
          }
        } catch {
          // Skip files that can't be stat'd
        }
      }
    }

    return results;
  }

  /** Resolve which plugins to use for a project. */
  function resolvePlugins(project: ProjectConfig, agentOverride?: string) {
    const runtime = registry.get<Runtime>("runtime", project.runtime ?? config.defaults.runtime);
    const agent = registry.get<Agent>(
      "agent",
      agentOverride ?? project.agent ?? config.defaults.agent,
    );
    const workspace = registry.get<Workspace>(
      "workspace",
      project.workspace ?? config.defaults.workspace,
    );
    const tracker = project.tracker
      ? registry.get<Tracker>("tracker", project.tracker.plugin)
      : null;
    const scm = project.scm ? registry.get<SCM>("scm", project.scm.plugin) : null;

    return { runtime, agent, workspace, tracker, scm };
  }

  /**
   * Resolve the session enhancement provider for a project.
   * Falls back to "raw" if no provider configured or if the configured provider is not loaded.
   */
  function resolveProvider(project: ProjectConfig): {
    provider: SessionEnhancementProvider | null;
    providerConfig: ProviderConfig;
  } {
    const providerName =
      project.sessionEnhancement?.provider ?? config.sessionEnhancement?.provider ?? "raw";
    const provider = registry.get<SessionEnhancementProvider>("provider", providerName);
    // Fall back to "raw" if configured provider is not loaded
    const resolved = provider ?? registry.get<SessionEnhancementProvider>("provider", "raw");
    const providerConfig =
      project.sessionEnhancement?.config ?? config.sessionEnhancement?.config ?? {};
    return { provider: resolved, providerConfig };
  }

  /**
   * Ensure session has a runtime handle (fabricate one if missing) and enrich
   * with live runtime state + activity detection. Used by both list() and get().
   */
  async function ensureHandleAndEnrich(
    session: Session,
    sessionName: string,
    project: ProjectConfig,
    plugins: ReturnType<typeof resolvePlugins>,
  ): Promise<void> {
    const handleFromMetadata = session.runtimeHandle !== null;
    if (!handleFromMetadata) {
      session.runtimeHandle = {
        id: sessionName,
        runtimeName: project.runtime ?? config.defaults.runtime,
        data: {},
      };
    }
    await enrichSessionWithRuntimeState(session, plugins, handleFromMetadata);
  }

  /**
   * Enrich session with live runtime state (alive/exited) and activity detection.
   * Mutates the session object in place.
   */
  const TERMINAL_SESSION_STATUSES = new Set(["killed", "done", "merged", "terminated", "cleanup"]);

  async function enrichSessionWithRuntimeState(
    session: Session,
    plugins: ReturnType<typeof resolvePlugins>,
    handleFromMetadata: boolean,
  ): Promise<void> {
    // Skip all subprocess/IO work for sessions already known to be terminal.
    if (TERMINAL_SESSION_STATUSES.has(session.status)) {
      session.activity = "exited";
      return;
    }

    // Check runtime liveness — but only if the handle came from metadata.
    // Fabricated handles (constructed as fallback for external sessions) should
    // NOT override status to "killed" — we don't know if the session ever had
    // a tmux session, and we'd clobber meaningful statuses like "pr_open".
    if (handleFromMetadata && session.runtimeHandle && plugins.runtime) {
      try {
        const alive = await plugins.runtime.isAlive(session.runtimeHandle);
        if (!alive) {
          session.status = "killed";
          session.activity = "exited";
          return;
        }
      } catch {
        // Can't check liveness — continue to activity detection
      }
    }

    // Detect activity independently of runtime handle.
    // Activity detection reads JSONL files on disk — it only needs workspacePath,
    // not a runtime handle. Gating on runtimeHandle caused sessions created by
    // external scripts (which don't store runtimeHandle) to always show "unknown".
    if (plugins.agent) {
      try {
        const detected = await plugins.agent.getActivityState(session, config.readyThresholdMs);
        if (detected !== null) {
          session.activity = detected.state;
          if (detected.timestamp && detected.timestamp > session.lastActivityAt) {
            session.lastActivityAt = detected.timestamp;
          }
        }
      } catch {
        // Can't detect activity — keep existing value
      }

      // Enrich with live agent session info (summary, cost).
      try {
        const info = await plugins.agent.getSessionInfo(session);
        if (info) {
          session.agentInfo = info;
        }
      } catch {
        // Can't get session info — keep existing values
      }
    }
  }

  // Define methods as local functions so `this` is not needed
  async function spawn(spawnConfig: SessionSpawnConfig): Promise<Session> {
    const project = config.projects[spawnConfig.projectId];
    if (!project) {
      throw new Error(`Unknown project: ${spawnConfig.projectId}`);
    }

    const plugins = resolvePlugins(project);
    if (!plugins.runtime) {
      throw new Error(`Runtime plugin '${project.runtime ?? config.defaults.runtime}' not found`);
    }

    // Allow --agent override to swap the agent plugin for this session
    if (spawnConfig.agent) {
      const overrideAgent = registry.get<Agent>("agent", spawnConfig.agent);
      if (!overrideAgent) {
        throw new Error(`Agent plugin '${spawnConfig.agent}' not found`);
      }
      plugins.agent = overrideAgent;
    }

    if (!plugins.agent) {
      throw new Error(`Agent plugin '${project.agent ?? config.defaults.agent}' not found`);
    }

    // Validate issue exists BEFORE creating any resources
    let resolvedIssue: Issue | undefined;
    if (spawnConfig.issueId && plugins.tracker) {
      try {
        // Fetch and validate the issue exists
        resolvedIssue = await plugins.tracker.getIssue(spawnConfig.issueId, project);
      } catch (err) {
        // Issue fetch failed - determine why
        if (isIssueNotFoundError(err)) {
          // Ad-hoc issue string — proceed without tracker context.
          // Branch will be generated as feat/{issueId} (line 329-331)
        } else {
          // Other error (auth, network, etc) - fail fast
          throw new Error(`Failed to fetch issue ${spawnConfig.issueId}: ${err}`, { cause: err });
        }
      }
    }

    // Pre-spawn story validation (if tracker supports it)
    if (resolvedIssue && spawnConfig.issueId && plugins.tracker?.validateIssue) {
      const validation = await plugins.tracker.validateIssue(spawnConfig.issueId, project);
      if (!validation.valid) {
        throw new Error(
          `Story validation failed for ${spawnConfig.issueId}:\n  - ${validation.errors.join("\n  - ")}`,
        );
      }
    }

    // Get the sessions directory for this project
    const sessionsDir = getProjectSessionsDir(project);

    // Validate and store .origin file (new architecture only)
    if (config.configPath) {
      validateAndStoreOrigin(config.configPath, project.path);
    }

    // Determine session ID — atomically reserve to prevent concurrent collisions
    const existingSessions = listMetadata(sessionsDir);
    let num = getNextSessionNumber(existingSessions, project.sessionPrefix);
    let sessionId: string;
    let tmuxName: string | undefined;
    for (let attempts = 0; attempts < 10; attempts++) {
      sessionId = `${project.sessionPrefix}-${num}`;
      // Generate tmux name if using new architecture
      if (config.configPath) {
        tmuxName = generateTmuxName(config.configPath, project.sessionPrefix, num);
      }
      if (reserveSessionId(sessionsDir, sessionId)) break;
      num++;
      if (attempts === 9) {
        throw new Error(
          `Failed to reserve session ID after 10 attempts (prefix: ${project.sessionPrefix})`,
        );
      }
    }
    // Reassign to satisfy TypeScript's flow analysis (not redundant from compiler's perspective)
    sessionId = `${project.sessionPrefix}-${num}`;
    if (config.configPath) {
      tmuxName = generateTmuxName(config.configPath, project.sessionPrefix, num);
    }

    // Determine branch name — explicit branch always takes priority
    let branch: string;
    if (spawnConfig.branch) {
      branch = spawnConfig.branch;
    } else if (spawnConfig.issueId && plugins.tracker && resolvedIssue) {
      branch = plugins.tracker.branchName(spawnConfig.issueId, project);
    } else if (spawnConfig.issueId) {
      // If the issueId is already branch-safe (e.g. "INT-9999"), use as-is.
      // Otherwise sanitize free-text (e.g. "fix login bug") into a valid slug.
      const id = spawnConfig.issueId;
      const isBranchSafe = /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) && !id.includes("..");
      const slug = isBranchSafe
        ? id
        : id
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 60)
            .replace(/^-+|-+$/g, "");
      branch = `feat/${slug || sessionId}`;
    } else {
      branch = `session/${sessionId}`;
    }

    // Create workspace (if workspace plugin is available)
    let workspacePath = project.path;
    if (plugins.workspace) {
      try {
        const wsInfo = await plugins.workspace.create({
          projectId: spawnConfig.projectId,
          project,
          sessionId,
          branch,
        });
        workspacePath = wsInfo.path;

        // Run post-create hooks — clean up workspace on failure
        if (plugins.workspace.postCreate) {
          try {
            await plugins.workspace.postCreate(wsInfo, project);
          } catch (err) {
            if (workspacePath !== project.path) {
              try {
                await plugins.workspace.destroy(workspacePath);
              } catch {
                /* best effort */
              }
            }
            throw err;
          }
        }
      } catch (err) {
        // Clean up reserved session ID on workspace failure
        try {
          deleteMetadata(sessionsDir, sessionId, false);
        } catch {
          /* best effort */
        }
        throw err;
      }
    }

    // Session Enhancement Provider — install after workspace, before agent launch (Epic 58, Story 58.1)
    const { provider: resolvedProvider, providerConfig } = resolveProvider(project);
    const rawProvider = registry.get<SessionEnhancementProvider>("provider", "raw");
    let activeProvider: SessionEnhancementProvider | null = resolvedProvider ?? rawProvider ?? null;
    let providerFallback = false;

    // Circuit breaker check: if provider health monitor says breaker is OPEN, fall back to raw (Story 58.6)
    if (activeProvider && activeProvider.name !== "raw") {
      try {
        const { getProviderHealthMonitor } = await import("./service-registry.js");
        const healthMonitor = getProviderHealthMonitor();
        if (healthMonitor && !healthMonitor.isProviderAvailable()) {
          // eslint-disable-next-line no-console
          console.warn(
            `[provider] circuit breaker OPEN for ${activeProvider.name}, falling back to raw`,
          );
          if (rawProvider) {
            activeProvider = rawProvider;
            providerFallback = true;
          }
        }
      } catch {
        // Health monitor not available — continue with resolved provider
      }
    }

    if (!activeProvider) {
      // Neither configured nor raw provider available — skip provider flow silently
    } else if (workspacePath) {
      try {
        // Health check before install
        const health = await activeProvider.healthCheck();
        if (!health.healthy) {
          // eslint-disable-next-line no-console
          console.warn(
            `[provider] ${activeProvider.name} unhealthy: ${health.message ?? "unknown"}, falling back to raw`,
          );
          if (rawProvider) activeProvider = rawProvider;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[provider] health check failed, falling back to raw:`, err);
        if (rawProvider) activeProvider = rawProvider;
      }

      try {
        await activeProvider.install(workspacePath, providerConfig);

        // Post-install verification (Epic 59, Story 59-3)
        try {
          const result = await verifyInstallation(workspacePath, activeProvider.name);
          if (!result.verified) {
            // eslint-disable-next-line no-console
            console.warn(
              `[provider] ${activeProvider.name} verification failed, missing: ${result.missing.join(", ")}. Falling back to raw.`,
            );
            if (rawProvider) {
              activeProvider = rawProvider;
            }
          }
        } catch (verifyErr) {
          // Verification itself failed (permissions, I/O) — log and continue
          // eslint-disable-next-line no-console
          console.warn(`[provider] verification error:`, verifyErr);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[provider] install failed, falling back to raw:`, err);
        if (rawProvider) {
          activeProvider = rawProvider;
          try {
            await rawProvider.install(workspacePath, {});
          } catch {
            // Best effort — raw install should be a no-op anyway
          }
        }
      }
    }

    // Generate prompt with validated issue
    let issueContext: string | undefined;
    if (spawnConfig.issueId && plugins.tracker && resolvedIssue) {
      try {
        issueContext = await plugins.tracker.generatePrompt(spawnConfig.issueId, project);
      } catch {
        // Non-fatal: continue without detailed issue context
        // Silently ignore errors - caller can check if issueContext is undefined
      }
    }

    // Inject past learnings if opt-in via config (Cycle 3 — AC-AI-3, AC4)
    let learnings;
    if (project.learning?.injectInPrompts) {
      try {
        const { getLearningStore } = await import("./service-registry.js");
        const { selectRelevantLearnings } = await import("./session-learning.js");
        const store = getLearningStore();
        if (store) {
          const allLearnings = store.query({
            agentId: spawnConfig.agent,
            limit: 50,
          });
          learnings = selectRelevantLearnings(allLearnings, []);
        }
      } catch {
        // Learning injection failure must never block spawning
      }
    }

    const composedPrompt = buildPrompt({
      project,
      projectId: spawnConfig.projectId,
      issueId: spawnConfig.issueId,
      issueContext,
      storyContext: spawnConfig.storyContext,
      userPrompt: spawnConfig.prompt,
      learnings,
    });

    // Provider configure — set up story context in workspace before agent launch
    const storyContext: StoryContext = {
      storyId: spawnConfig.issueId ?? "",
      storyTitle: resolvedIssue?.title,
      acceptanceCriteria: [] as string[] | undefined,
      relevantFiles: [] as string[] | undefined,
      dependencies: [] as string[] | undefined,
    };

    // Story-level agent override extracted from <!-- ao-agents: [...] --> comment
    let storyOverrideAgents: string[] | undefined;

    // Enrich storyContext from implementation artifact (best-effort)
    if (spawnConfig.issueId) {
      try {
        const storyDir =
          typeof project.tracker?.["storyDir"] === "string"
            ? join(project.path, project.tracker["storyDir"] as string)
            : join(project.path, "_bmad-output/implementation-artifacts");
        const artifactPath = join(storyDir, `${spawnConfig.issueId}.md`);
        if (existsSync(artifactPath)) {
          const { readFile: readFileAsync } = await import("node:fs/promises");
          const artifactContent = await readFileAsync(artifactPath, "utf-8");
          // Extract acceptance criteria from "## Acceptance Criteria" section
          const acMatch = artifactContent.match(
            /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## (?![#])|\n---|$)/,
          );
          if (acMatch?.[1]) {
            const acs = acMatch[1]
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l.startsWith("- ") || /^\d+\./.test(l));
            if (acs.length > 0) {
              storyContext.acceptanceCriteria = acs;
            }
          }
          // Extract relevant files from Dev Notes → File Change Impact table (all extensions)
          const fileMatch = artifactContent.match(
            /\| `([^`]+\.\w+)` \| (?:NEW|MODIFY|MODIFIED) \|/g,
          );
          if (fileMatch && fileMatch.length > 0) {
            storyContext.relevantFiles = fileMatch.map((m) => m.match(/`([^`]+)`/)?.[1] ?? m);
          }
          // Extract dependencies from Dev Notes or Dependency Review sections
          const depMatch = artifactContent.match(
            /## Dependencies[\s\S]*?\n([\s\S]*?)(?=\n## |\n---|$)/,
          );
          if (depMatch?.[1]) {
            const deps = depMatch[1]
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l.startsWith("- ") || l.startsWith("* "));
            if (deps.length > 0) {
              storyContext.dependencies = deps.map((d) => d.replace(/^[-*]\s+/, ""));
            }
          }
          // Extract story-level agent override: <!-- ao-agents: ["agent1", "agent2"] -->
          const agentsMatch = artifactContent.match(/<!--\s*ao-agents:\s*(\[[\s\S]*?\])\s*-->/);
          if (agentsMatch?.[1]) {
            try {
              const parsed = JSON.parse(agentsMatch[1]);
              if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
                storyOverrideAgents = parsed;
              }
            } catch {
              // Invalid JSON — skip story-level override
            }
          }
        }
      } catch {
        // Best-effort — enrichment failure must never block spawning
      }
    }
    if (workspacePath && activeProvider) {
      try {
        await activeProvider.configure(workspacePath, storyContext);

        // Post-configure verification (Epic 59, Story 59-3)
        try {
          const result = await verifyOmcConfigure(workspacePath);
          if (!result.verified) {
            // eslint-disable-next-line no-console
            console.warn(
              `[provider] post-configure verification: missing ${result.missing.join(", ")}. Session continues — no fallback.`,
            );
          }
        } catch {
          // Verification failure must never block spawn
        }

        // CLAUDE.md merge — project rules + provider additions (Epic 59, Story 59-4)
        try {
          const mergeResult = await performMerge(workspacePath, activeProvider.name);
          if (mergeResult.merged) {
            // eslint-disable-next-line no-console
            console.log(`[provider] CLAUDE.md merged successfully at ${mergeResult.path}`);
          }
        } catch (mergeErr) {
          // Merge failure must never block spawn — agent still has project CLAUDE.md
          // eslint-disable-next-line no-console
          console.warn("[provider] CLAUDE.md merge failed:", mergeErr);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[provider] configure failed, falling back to raw:`, err);
        if (rawProvider) {
          try {
            await rawProvider.configure(workspacePath, storyContext);
          } catch {
            // Raw provider configure is no-op, but guard anyway
          }
        }
      }
    }

    // Hook registry — compaction survival hooks (Epic 59, Story 59-2)
    // Story-type hook profiles (Epic 59, Story 59-5)
    // Initialize only for non-raw providers; raw sessions have no compact lifecycle.
    let hookRegistry: HookRegistry | undefined;
    let hookMetadata: Record<string, string> = {};
    if (activeProvider && activeProvider.name !== "raw") {
      try {
        const { createHookRegistry, detectStoryType, HOOK_PROFILES, registerHooksForProfile } =
          await import("./hooks.js");
        hookRegistry = createHookRegistry();
        const storyType = detectStoryType(storyContext.storyId, storyContext.storyTitle);
        storyContext.storyType = storyType;
        let profile = HOOK_PROFILES[storyType];
        // Merge per-project config override if present
        const configOverride = project.sessionEnhancement?.hookProfile;
        if (configOverride) {
          profile = {
            ...profile,
            ...configOverride,
            // Deep-merge metadata so override adds to, not replaces, base profile
            metadata: { ...profile.metadata, ...configOverride.metadata },
          };
        }
        registerHooksForProfile(hookRegistry, profile);
        // Store profile metadata for merge into sessionMetadata during pre-compact
        hookMetadata = profile.metadata;
      } catch {
        // Hook registry failure must never block spawning
      }
    }

    // Agent mapping — resolve which OMC agents to activate per story type (Epic 59, Story 59-6)
    // Story-level override (<!-- ao-agents -->) > project config > defaults
    if (activeProvider && activeProvider.name !== "raw") {
      try {
        const { resolveAgentMapping } = await import("./agent-mapping.js");
        let resolved: AgentMapping = resolveAgentMapping(
          storyContext.storyType,
          project.sessionEnhancement?.agentMappings,
        );
        // Story-level override takes highest priority
        if (storyOverrideAgents && storyOverrideAgents.length > 0) {
          resolved = { ...resolved, agents: storyOverrideAgents };
        }
        storyContext.agents = resolved;
      } catch {
        // Agent mapping failure must never block spawning
      }
    }

    // Get agent launch config and create runtime — clean up workspace on failure
    const isRoutingActive = activeProvider !== null && activeProvider.name !== "raw";

    let routedModel: string | undefined;
    let routedTier: ModelTier | undefined;
    if (isRoutingActive) {
      const tier = modelRoutingService.resolveTier({
        storyKey: spawnConfig.issueId ?? "",
        explicitTier: spawnConfig.modelTier,
        defaultTier: config.sessionEnhancement?.config?.defaultTier as ModelTier | undefined,
        sessionId,
      });
      routedModel = modelRoutingService.tierToModel(tier, config, project);
      routedTier = tier;
    }

    const agentLaunchConfig = {
      sessionId,
      projectConfig: project,
      issueId: spawnConfig.issueId,
      prompt: composedPrompt ?? spawnConfig.prompt,
      permissions: project.agentConfig?.permissions,
      model: isRoutingActive ? routedModel : project.agentConfig?.model,
    };

    let handle: RuntimeHandle;
    try {
      const launchCommand = plugins.agent.getLaunchCommand(agentLaunchConfig);
      const environment = plugins.agent.getEnvironment(agentLaunchConfig);

      handle = await plugins.runtime.create({
        sessionId: tmuxName ?? sessionId, // Use tmux name for runtime if available
        workspacePath,
        launchCommand,
        environment: {
          ...environment,
          AO_SESSION: sessionId,
          AO_DATA_DIR: sessionsDir, // Pass sessions directory (not root dataDir)
          AO_SESSION_NAME: sessionId, // User-facing session name
          ...(tmuxName && { AO_TMUX_NAME: tmuxName }), // Tmux session name if using new arch
        },
      });
    } catch (err) {
      // Clean up workspace and reserved ID if agent config or runtime creation failed
      if (plugins.workspace && workspacePath !== project.path) {
        try {
          await plugins.workspace.destroy(workspacePath);
        } catch {
          /* best effort */
        }
      }
      try {
        deleteMetadata(sessionsDir, sessionId, false);
      } catch {
        /* best effort */
      }
      throw err;
    }

    // Write metadata and run post-launch setup — clean up on failure
    const session: Session = {
      id: sessionId,
      projectId: spawnConfig.projectId,
      status: "spawning",
      activity: "active",
      branch,
      issueId: spawnConfig.issueId ?? null,
      pr: null,
      workspacePath,
      runtimeHandle: handle,
      agentInfo: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: {
        ...(routedTier && { "ao:modelTier": routedTier }),
        ...(routedModel && { "ao:model": routedModel }),
        ...(providerFallback && { "ao:providerFallback": "true" }),
        ...(storyContext.agents?.executionMode && {
          "ao:executionMode": storyContext.agents.executionMode,
        }),
        ...hookMetadata,
      },
      ...(hookRegistry && { hookRegistry }),
    };

    try {
      writeMetadata(sessionsDir, sessionId, {
        worktree: workspacePath,
        branch,
        status: "spawning",
        tmuxName, // Store tmux name for mapping
        issue: spawnConfig.issueId,
        project: spawnConfig.projectId,
        agent: plugins.agent.name, // Persist agent name for lifecycle manager
        createdAt: new Date().toISOString(),
        runtimeHandle: JSON.stringify(handle),
      });

      if (plugins.agent.postLaunchSetup) {
        await plugins.agent.postLaunchSetup(session);
      }

      // Auto-update tracker status to in-progress when spawning with a resolved issue
      if (resolvedIssue && spawnConfig.issueId && plugins.tracker?.updateIssue) {
        try {
          await plugins.tracker.updateIssue(spawnConfig.issueId, { state: "in_progress" }, project);
        } catch {
          // Non-fatal — don't fail spawn if tracker update fails
        }
      }
    } catch (err) {
      // Clean up runtime and workspace on post-launch failure
      try {
        await plugins.runtime.destroy(handle);
      } catch {
        /* best effort */
      }
      if (plugins.workspace && workspacePath !== project.path) {
        try {
          await plugins.workspace.destroy(workspacePath);
        } catch {
          /* best effort */
        }
      }
      try {
        deleteMetadata(sessionsDir, sessionId, false);
      } catch {
        /* best effort */
      }
      throw err;
    }

    // Send initial prompt post-launch for agents that need it (e.g. Claude Code
    // exits after -p, so we send the prompt after it starts in interactive mode).
    // This is intentionally outside the try/catch above — a prompt delivery failure
    // should NOT destroy the session. The agent is running; user can retry with `ao send`.
    if (plugins.agent.promptDelivery === "post-launch" && agentLaunchConfig.prompt) {
      try {
        // Wait for agent to start and be ready for input
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        await plugins.runtime.sendMessage(handle, agentLaunchConfig.prompt);
      } catch {
        // Non-fatal: agent is running but didn't receive the initial prompt.
        // User can retry with `ao send`.
      }
    }

    return session;
  }

  async function spawnOrchestrator(orchestratorConfig: OrchestratorSpawnConfig): Promise<Session> {
    const project = config.projects[orchestratorConfig.projectId];
    if (!project) {
      throw new Error(`Unknown project: ${orchestratorConfig.projectId}`);
    }

    const plugins = resolvePlugins(project);
    if (!plugins.runtime) {
      throw new Error(`Runtime plugin '${project.runtime ?? config.defaults.runtime}' not found`);
    }
    if (!plugins.agent) {
      throw new Error(`Agent plugin '${project.agent ?? config.defaults.agent}' not found`);
    }

    const sessionId = `${project.sessionPrefix}-orchestrator`;

    // Generate tmux name if using new architecture
    let tmuxName: string | undefined;
    if (config.configPath) {
      const hash = generateConfigHash(config.configPath);
      tmuxName = `${hash}-${sessionId}`;
    }

    // Get the sessions directory for this project
    const sessionsDir = getProjectSessionsDir(project);

    // Validate and store .origin file
    if (config.configPath) {
      validateAndStoreOrigin(config.configPath, project.path);
    }

    // Setup agent hooks for automatic metadata updates
    if (plugins.agent.setupWorkspaceHooks) {
      await plugins.agent.setupWorkspaceHooks(project.path, { dataDir: sessionsDir });
    }

    // Write system prompt to a file to avoid shell/tmux truncation.
    // Long prompts (2000+ chars) get mangled when inlined in shell commands
    // via tmux send-keys or paste-buffer. File-based approach is reliable.
    let systemPromptFile: string | undefined;
    if (orchestratorConfig.systemPrompt) {
      const baseDir = getProjectBaseDir(config.configPath, project.path);
      mkdirSync(baseDir, { recursive: true });
      systemPromptFile = join(baseDir, "orchestrator-prompt.md");
      writeFileSync(systemPromptFile, orchestratorConfig.systemPrompt, "utf-8");
    }

    // Get agent launch config — uses systemPromptFile, no issue/tracker interaction.
    // Orchestrator ALWAYS gets skip permissions — it must run ao CLI commands autonomously.
    const agentLaunchConfig = {
      sessionId,
      projectConfig: project,
      permissions: "skip" as const,
      model: project.agentConfig?.model,
      systemPromptFile,
    };

    const launchCommand = plugins.agent.getLaunchCommand(agentLaunchConfig);
    const environment = plugins.agent.getEnvironment(agentLaunchConfig);

    const handle = await plugins.runtime.create({
      sessionId: tmuxName ?? sessionId,
      workspacePath: project.path,
      launchCommand,
      environment: {
        ...environment,
        AO_SESSION: sessionId,
        AO_DATA_DIR: sessionsDir,
        AO_SESSION_NAME: sessionId,
        ...(tmuxName && { AO_TMUX_NAME: tmuxName }),
      },
    });

    // Write metadata and run post-launch setup
    const session: Session = {
      id: sessionId,
      projectId: orchestratorConfig.projectId,
      status: "working",
      activity: "active",
      branch: project.defaultBranch,
      issueId: null,
      pr: null,
      workspacePath: project.path,
      runtimeHandle: handle,
      agentInfo: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: {},
    };

    try {
      writeMetadata(sessionsDir, sessionId, {
        worktree: project.path,
        branch: project.defaultBranch,
        status: "working",
        role: "orchestrator",
        tmuxName,
        project: orchestratorConfig.projectId,
        createdAt: new Date().toISOString(),
        runtimeHandle: JSON.stringify(handle),
      });

      if (plugins.agent.postLaunchSetup) {
        await plugins.agent.postLaunchSetup(session);
      }
    } catch (err) {
      // Clean up runtime on post-launch failure
      try {
        await plugins.runtime.destroy(handle);
      } catch {
        /* best effort */
      }
      try {
        deleteMetadata(sessionsDir, sessionId, false);
      } catch {
        /* best effort */
      }
      throw err;
    }

    return session;
  }

  async function list(projectId?: string): Promise<Session[]> {
    const allSessions = listAllSessions(projectId);

    const sessionPromises = allSessions.map(
      async ({ sessionName, projectId: sessionProjectId }) => {
        const project = config.projects[sessionProjectId];
        if (!project) return null;

        const sessionsDir = getProjectSessionsDir(project);
        const raw = readMetadataRaw(sessionsDir, sessionName);
        if (!raw) return null;

        // Get file timestamps for createdAt/lastActivityAt
        let createdAt: Date | undefined;
        let modifiedAt: Date | undefined;
        try {
          const metaPath = join(sessionsDir, sessionName);
          const stats = statSync(metaPath);
          createdAt = stats.birthtime;
          modifiedAt = stats.mtime;
        } catch {
          // If stat fails, timestamps will fall back to current time
        }

        const session = metadataToSession(sessionName, raw, createdAt, modifiedAt);

        const plugins = resolvePlugins(project, raw["agent"]);
        // Cap per-session enrichment at 2s — subprocess calls (tmux/ps) can be
        // slow under load. If we time out, session keeps its metadata values.
        const enrichTimeout = new Promise<void>((resolve) => setTimeout(resolve, 2_000));
        await Promise.race([
          ensureHandleAndEnrich(session, sessionName, project, plugins),
          enrichTimeout,
        ]);

        return session;
      },
    );

    const results = await Promise.all(sessionPromises);
    return results.filter((s): s is Session => s !== null);
  }

  async function get(sessionId: SessionId): Promise<Session | null> {
    // Try to find the session in any project's sessions directory
    for (const project of Object.values(config.projects)) {
      const sessionsDir = getProjectSessionsDir(project);
      const raw = readMetadataRaw(sessionsDir, sessionId);
      if (!raw) continue;

      // Get file timestamps for createdAt/lastActivityAt
      let createdAt: Date | undefined;
      let modifiedAt: Date | undefined;
      try {
        const metaPath = join(sessionsDir, sessionId);
        const stats = statSync(metaPath);
        createdAt = stats.birthtime;
        modifiedAt = stats.mtime;
      } catch {
        // If stat fails, timestamps will fall back to current time
      }

      const session = metadataToSession(sessionId, raw, createdAt, modifiedAt);

      const plugins = resolvePlugins(project, raw["agent"]);
      await ensureHandleAndEnrich(session, sessionId, project, plugins);

      return session;
    }

    return null;
  }

  async function kill(sessionId: SessionId): Promise<void> {
    // Find the session in any project's sessions directory
    let raw: Record<string, string> | null = null;
    let sessionsDir: string | null = null;
    let project: ProjectConfig | undefined;

    for (const proj of Object.values(config.projects)) {
      const dir = getProjectSessionsDir(proj);
      const metadata = readMetadataRaw(dir, sessionId);
      if (metadata) {
        raw = metadata;
        sessionsDir = dir;
        project = proj;
        break;
      }
    }

    if (!raw || !sessionsDir) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Destroy runtime — prefer handle.runtimeName to find the correct plugin
    if (raw["runtimeHandle"]) {
      const handle = safeJsonParse<RuntimeHandle>(raw["runtimeHandle"]);
      if (handle) {
        const runtimePlugin = registry.get<Runtime>(
          "runtime",
          handle.runtimeName ??
            (project ? (project.runtime ?? config.defaults.runtime) : config.defaults.runtime),
        );
        if (runtimePlugin) {
          try {
            await runtimePlugin.destroy(handle);
          } catch {
            // Runtime might already be gone
          }
        }
      }
    }

    // Provider teardown — clean up provider artifacts before workspace destruction
    const worktreeForTeardown = raw["worktree"];
    if (worktreeForTeardown) {
      const { provider: teardownProvider } = project
        ? resolveProvider(project)
        : { provider: null };
      if (teardownProvider) {
        try {
          await teardownProvider.teardown(worktreeForTeardown);
        } catch {
          // Provider teardown failure must not block kill
        }
      }
    }

    // Destroy workspace — skip if worktree is the project path (no isolation was used)
    const worktree = raw["worktree"];
    const isProjectPath = project && worktree === project.path;
    if (worktree && !isProjectPath) {
      const workspacePlugin = project
        ? resolvePlugins(project).workspace
        : registry.get<Workspace>("workspace", config.defaults.workspace);
      if (workspacePlugin) {
        try {
          await workspacePlugin.destroy(worktree);
        } catch {
          // Workspace might already be gone
        }
      }
    }

    // Story cleanup — if this session had a story assignment, mark story as blocked
    const storyId = raw["storyId"];
    if (storyId && project) {
      // Clean up in-memory agent registry assignment first.
      // remove() also clears metadata fields (storyId, agentStatus, etc.),
      // so we call it before setting the disconnected reason below.
      const agentRegistry = getAgentRegistry(sessionsDir, config);
      agentRegistry.remove(sessionId);

      // Store disconnected reason in metadata before archiving
      // (after remove, since remove() clears agentStatus)
      updateMetadata(sessionsDir, sessionId, {
        failureReason: "disconnected",
        agentStatus: "disconnected",
      });

      // Update sprint status to "blocked" (unless story is already done).
      // Uses tracker.storyDir if configured, otherwise falls back to BMAD default.
      // Non-BMAD projects without storyDir silently skip (existsSync check below).
      const storyDir =
        typeof project.tracker?.["storyDir"] === "string"
          ? join(project.path, project.tracker["storyDir"] as string)
          : join(project.path, "_bmad-output/implementation-artifacts");

      // Read current story status to avoid overwriting "done"
      try {
        const statusPath = join(storyDir, "sprint-status.yaml");
        if (existsSync(statusPath)) {
          const content = readFileSync(statusPath, "utf-8");
          // Simple regex check — avoid adding yaml dependency to session-manager
          const escapedId = storyId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const pattern = new RegExp(`${escapedId}:\\s*(\\S+)`);
          const match = content.match(pattern);
          const currentStatus = match?.[1];
          if (currentStatus && currentStatus !== "done" && currentStatus !== "review") {
            updateSprintStatus(storyDir, storyId, "blocked");
          }
        }
      } catch {
        // Non-fatal: sprint status update failure should not block kill
      }

      // Log audit event
      const auditDir = join(sessionsDir, "audit");
      logAuditEvent(auditDir, {
        timestamp: new Date().toISOString(),
        event_type: "agent_disconnected",
        agent_id: sessionId,
        story_id: storyId,
        reason: "killed",
      });
    }

    // Archive metadata
    deleteMetadata(sessionsDir, sessionId, true);
  }

  async function cleanup(
    projectId?: string,
    options?: { dryRun?: boolean },
  ): Promise<CleanupResult> {
    const result: CleanupResult = { killed: [], skipped: [], errors: [] };
    const sessions = await list(projectId);

    for (const session of sessions) {
      try {
        // Never clean up orchestrator sessions — they manage the lifecycle.
        // Check explicit role metadata first, fall back to naming convention
        // for pre-existing sessions spawned before the role field was added.
        if (session.metadata["role"] === "orchestrator" || session.id.endsWith("-orchestrator")) {
          result.skipped.push(session.id);
          continue;
        }

        const project = config.projects[session.projectId];
        if (!project) {
          result.skipped.push(session.id);
          continue;
        }

        const plugins = resolvePlugins(project);
        let shouldKill = false;

        // Check if PR is merged
        if (session.pr && plugins.scm) {
          try {
            const prState = await plugins.scm.getPRState(session.pr);
            if (prState === PR_STATE.MERGED || prState === PR_STATE.CLOSED) {
              shouldKill = true;
            }
          } catch {
            // Can't check PR — skip
          }
        }

        // Check if issue is completed
        if (!shouldKill && session.issueId && plugins.tracker) {
          try {
            const completed = await plugins.tracker.isCompleted(session.issueId, project);
            if (completed) shouldKill = true;
          } catch {
            // Can't check issue — skip
          }
        }

        // Check if runtime is dead
        if (!shouldKill && session.runtimeHandle && plugins.runtime) {
          try {
            const alive = await plugins.runtime.isAlive(session.runtimeHandle);
            if (!alive) shouldKill = true;
          } catch {
            // Can't check — skip
          }
        }

        if (shouldKill) {
          if (!options?.dryRun) {
            await kill(session.id);
          }
          result.killed.push(session.id);
        } else {
          result.skipped.push(session.id);
        }
      } catch (err) {
        result.errors.push({
          sessionId: session.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }

  async function send(sessionId: SessionId, message: string): Promise<void> {
    // Find the session in any project's sessions directory
    let raw: Record<string, string> | null = null;
    for (const project of Object.values(config.projects)) {
      const sessionsDir = getProjectSessionsDir(project);
      const metadata = readMetadataRaw(sessionsDir, sessionId);
      if (metadata) {
        raw = metadata;
        break;
      }
    }

    if (!raw) throw new Error(`Session ${sessionId} not found`);

    // Build handle: use stored runtimeHandle, or fall back to session ID as tmux session name
    let handle: RuntimeHandle;
    if (raw["runtimeHandle"]) {
      const parsed = safeJsonParse<RuntimeHandle>(raw["runtimeHandle"]);
      if (!parsed) {
        throw new Error(`Corrupted runtime handle for session ${sessionId}`);
      }
      handle = parsed;
    } else {
      // Sessions created by bash scripts don't have runtimeHandle — use session ID as tmux handle
      handle = { id: sessionId, runtimeName: config.defaults.runtime, data: {} };
    }

    // Prefer handle.runtimeName to find the correct plugin
    const project = config.projects[raw["project"] ?? ""];
    const runtimePlugin = registry.get<Runtime>(
      "runtime",
      handle.runtimeName ??
        (project ? (project.runtime ?? config.defaults.runtime) : config.defaults.runtime),
    );
    if (!runtimePlugin) {
      throw new Error(`No runtime plugin for session ${sessionId}`);
    }

    await runtimePlugin.sendMessage(handle, message);
  }

  async function restore(sessionId: SessionId): Promise<Session> {
    // 1. Find session metadata across all projects (active first, then archive)
    let raw: Record<string, string> | null = null;
    let sessionsDir: string | null = null;
    let project: ProjectConfig | undefined;
    let projectId: string | undefined;
    let fromArchive = false;

    for (const [key, proj] of Object.entries(config.projects)) {
      const dir = getProjectSessionsDir(proj);
      const metadata = readMetadataRaw(dir, sessionId);
      if (metadata) {
        raw = metadata;
        sessionsDir = dir;
        project = proj;
        projectId = key;
        break;
      }
    }

    // Fall back to archived metadata (killed/cleaned sessions)
    if (!raw) {
      for (const [key, proj] of Object.entries(config.projects)) {
        const dir = getProjectSessionsDir(proj);
        const archived = readArchivedMetadataRaw(dir, sessionId);
        if (archived) {
          raw = archived;
          sessionsDir = dir;
          project = proj;
          projectId = key;
          fromArchive = true;
          break;
        }
      }
    }

    if (!raw || !sessionsDir || !project || !projectId) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // If restored from archive, recreate the active metadata file
    if (fromArchive) {
      writeMetadata(sessionsDir, sessionId, {
        worktree: raw["worktree"] ?? "",
        branch: raw["branch"] ?? "",
        status: raw["status"] ?? "killed",
        role: raw["role"],
        tmuxName: raw["tmuxName"],
        issue: raw["issue"],
        pr: raw["pr"],
        summary: raw["summary"],
        project: raw["project"],
        createdAt: raw["createdAt"],
        runtimeHandle: raw["runtimeHandle"],
      });
    }

    // 2. Reconstruct Session from metadata and enrich with live runtime state.
    //    metadataToSession sets activity: null, so without enrichment a crashed
    //    session (status "working", agent exited) would not be detected as terminal
    //    and isRestorable would reject it.
    const session = metadataToSession(sessionId, raw);
    const plugins = resolvePlugins(project, raw["agent"]);
    await enrichSessionWithRuntimeState(session, plugins, true);

    // 3. Validate restorability
    if (!isRestorable(session)) {
      if (NON_RESTORABLE_STATUSES.has(session.status)) {
        throw new SessionNotRestorableError(sessionId, `status is "${session.status}"`);
      }
      throw new SessionNotRestorableError(sessionId, "session is not in a terminal state");
    }

    // 4. Validate required plugins (plugins already resolved above for enrichment)
    if (!plugins.runtime) {
      throw new Error(`Runtime plugin '${project.runtime ?? config.defaults.runtime}' not found`);
    }
    if (!plugins.agent) {
      throw new Error(`Agent plugin '${project.agent ?? config.defaults.agent}' not found`);
    }

    // 5. Check workspace
    const workspacePath = raw["worktree"] || project.path;
    const workspaceExists = plugins.workspace?.exists
      ? await plugins.workspace.exists(workspacePath)
      : existsSync(workspacePath);

    if (!workspaceExists) {
      // Try to restore workspace if plugin supports it
      if (!plugins.workspace?.restore) {
        throw new WorkspaceMissingError(workspacePath, "workspace plugin does not support restore");
      }
      if (!session.branch) {
        throw new WorkspaceMissingError(workspacePath, "branch metadata is missing");
      }
      try {
        const wsInfo = await plugins.workspace.restore(
          {
            projectId,
            project,
            sessionId,
            branch: session.branch,
          },
          workspacePath,
        );

        // Run post-create hooks on restored workspace
        if (plugins.workspace.postCreate) {
          await plugins.workspace.postCreate(wsInfo, project);
        }
      } catch (err) {
        throw new WorkspaceMissingError(
          workspacePath,
          `restore failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 6. Destroy old runtime if still alive (e.g. tmux session survives agent crash)
    if (session.runtimeHandle) {
      try {
        await plugins.runtime.destroy(session.runtimeHandle);
      } catch {
        // Best effort — may already be gone
      }
    }

    // 7. Get launch command — try restore command first, fall back to fresh launch
    let launchCommand: string;
    const agentLaunchConfig = {
      sessionId,
      projectConfig: project,
      issueId: session.issueId ?? undefined,
      permissions: project.agentConfig?.permissions,
      model: project.agentConfig?.model,
    };

    if (plugins.agent.getRestoreCommand) {
      const restoreCmd = await plugins.agent.getRestoreCommand(session, project);
      launchCommand = restoreCmd ?? plugins.agent.getLaunchCommand(agentLaunchConfig);
    } else {
      launchCommand = plugins.agent.getLaunchCommand(agentLaunchConfig);
    }

    const environment = plugins.agent.getEnvironment(agentLaunchConfig);

    // 8. Create runtime (reuse tmuxName from metadata)
    const tmuxName = raw["tmuxName"];
    const handle = await plugins.runtime.create({
      sessionId: tmuxName ?? sessionId,
      workspacePath,
      launchCommand,
      environment: {
        ...environment,
        AO_SESSION: sessionId,
        AO_DATA_DIR: sessionsDir,
        AO_SESSION_NAME: sessionId,
        ...(tmuxName && { AO_TMUX_NAME: tmuxName }),
      },
    });

    // 9. Update metadata — merge updates, preserving existing fields
    const now = new Date().toISOString();
    updateMetadata(sessionsDir, sessionId, {
      status: "spawning",
      runtimeHandle: JSON.stringify(handle),
      restoredAt: now,
    });

    // 10. Run postLaunchSetup (non-fatal)
    const restoredSession: Session = {
      ...session,
      status: "spawning",
      activity: "active",
      workspacePath,
      runtimeHandle: handle,
      restoredAt: new Date(now),
    };

    if (plugins.agent.postLaunchSetup) {
      try {
        await plugins.agent.postLaunchSetup(restoredSession);
      } catch {
        // Non-fatal — session is already running
      }
    }

    return restoredSession;
  }

  // -------------------------------------------------------------------------
  // Compaction survival hooks (Epic 59, Story 59-2)
  // -------------------------------------------------------------------------

  /** Store hook registries keyed by session ID for lifecycle access. */
  const hookRegistries = new Map<SessionId, HookRegistry>();

  /**
   * Run pre-compact hooks for a session.
   * Saves working state to notepad and project-memory before compaction.
   */
  async function runPreCompactHooks(
    sessionId: SessionId,
    sessionMetadata: Record<string, string> = {},
  ): Promise<void> {
    const registry = hookRegistries.get(sessionId);
    if (!registry) return; // No hooks registered for this session

    // Find the session to get worktreePath
    const session = await get(sessionId);
    if (!session?.workspacePath) return;

    await registry.runPreCompact(session.workspacePath, sessionMetadata);
  }

  /**
   * Run post-compact hooks for a session.
   * Returns context string to re-inject into the session after compaction.
   */
  async function runPostCompactHooks(sessionId: SessionId): Promise<string> {
    const registry = hookRegistries.get(sessionId);
    if (!registry) return ""; // No hooks registered

    const session = await get(sessionId);
    if (!session?.workspacePath) return "";

    return registry.runPostCompact(session.workspacePath);
  }

  // Monkey-patch spawn to also register the hook registry in our map.
  // This is cleaner than modifying the large spawn function.
  const originalSpawn = spawn;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrappedSpawn = (async (config: any) => {
    const session = await originalSpawn(config as SessionSpawnConfig);
    if (session.hookRegistry) {
      hookRegistries.set(session.id, session.hookRegistry);
    }
    return session;
  }) as typeof spawn;

  // Clean up hook registry on kill
  const originalKill = kill;
  const wrappedKill = (async (sessionId: SessionId) => {
    hookRegistries.delete(sessionId);
    await originalKill(sessionId);
  }) as typeof kill;

  return {
    spawn: wrappedSpawn,
    spawnOrchestrator,
    restore,
    list,
    get,
    kill: wrappedKill,
    cleanup,
    send,
    runPreCompactHooks,
    runPostCompactHooks,
  };
}
