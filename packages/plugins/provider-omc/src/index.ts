import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_MODEL_TIERS,
  createNotepad,
  type ModelTierMapping,
  type PluginModule,
  type PluginManifest,
  type SessionEnhancementProvider,
  type ProviderConfig,
  type StoryContext,
  type ProviderHealth,
  type Session,
} from "@composio/ao-core";

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_OMC_AGENTS = [
  "omc",
  "explore",
  "analyst",
  "planner",
  "architect",
  "debugger",
  "executor",
  "verifier",
  "tracer",
] as const;

const DEFAULT_AGENT_MODELS: Record<string, string> = {
  omc: "claude-opus-4-6",
  explore: "claude-haiku-4-5",
  analyst: "claude-opus-4-6",
  planner: "claude-opus-4-6",
  architect: "claude-opus-4-6",
  debugger: "claude-sonnet-4-6",
  executor: "claude-sonnet-4-6",
  verifier: "claude-sonnet-4-6",
  tracer: "claude-sonnet-4-6",
};

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export const manifest = {
  name: "omc",
  slot: "provider" as const,
  description: "Provider plugin: oh-my-claudecode session enhancement",
  version: "0.1.0",
} satisfies PluginManifest;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAgentConfig(userAgents?: Record<string, unknown>): Record<string, { model: string }> {
  const agents: Record<string, { model: string }> = {};
  for (const name of DEFAULT_OMC_AGENTS) {
    const userModel = userAgents?.[name] as Record<string, unknown> | undefined;
    agents[name] = { model: (userModel?.model as string) ?? DEFAULT_AGENT_MODELS[name] };
  }
  return agents;
}

function buildTierModels(modelTiers?: ModelTierMapping): Record<string, string> {
  const tiers = modelTiers ?? DEFAULT_MODEL_TIERS;
  return {
    LOW: tiers.low,
    MEDIUM: tiers.medium,
    HIGH: tiers.high,
  };
}

// ---------------------------------------------------------------------------
// CLAUDE.md additions generator (Epic 59, Story 59-4)
// ---------------------------------------------------------------------------

function buildClaudeMdAdditions(agents: Record<string, { model: string }>): string {
  const agentCatalog = Object.entries(agents)
    .map(([name, cfg]) => `- **${name}**: model=${cfg.model}`)
    .join("\n");

  return [
    "### Agent Catalog",
    "",
    agentCatalog,
    "",
    "### Delegation Instructions",
    "",
    "Use the `omc` agent (opus) for complex reasoning, planning, and orchestration.",
    "Delegate to specialized agents based on task type:",
    "- **explore** (haiku): file search, dependency mapping, quick lookups",
    "- **analyst** (opus): deep analysis, code review, pattern detection",
    "- **planner** (opus): implementation planning, story breakdown",
    "- **architect** (opus): system design, cross-module decisions",
    "- **debugger** (sonnet): bug investigation, error tracing",
    "- **executor** (sonnet): code implementation, refactoring",
    "- **verifier** (sonnet): test writing, validation, acceptance criteria",
    "- **tracer** (sonnet): log analysis, performance profiling",
    "",
    "### OMC Conventions",
    "",
    "- **Notepad**: Read `.omc/notepad.md` for story context (priority, working memory, manual notes).",
    "- **State**: Store transient state in `.omc/state/`.",
    "- **Project Memory**: Check `.omc/project-memory.json` for cross-session learnings.",
    "- **Plans**: Save implementation plans in `.omc/plans/`.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// create()
// ---------------------------------------------------------------------------

export function create(config?: Record<string, unknown>): SessionEnhancementProvider {
  const providerConfig: ProviderConfig = config ?? {};
  const userAgents = providerConfig.agents as Record<string, unknown> | undefined;
  const userModelTiers = providerConfig.modelTiers as ModelTierMapping | undefined;
  const enabledAgents = [...DEFAULT_OMC_AGENTS];

  return {
    name: "omc",

    // -----------------------------------------------------------------------
    // install — create .omc/ directory structure
    // -----------------------------------------------------------------------
    async install(worktreePath: string, _config: ProviderConfig): Promise<void> {
      const omcDir = join(worktreePath, ".omc");

      // Create directories (idempotent via recursive: true)
      await mkdir(join(omcDir, "state"), { recursive: true });
      await mkdir(join(omcDir, "plans"), { recursive: true });
      await mkdir(join(omcDir, "logs"), { recursive: true });

      // Create project-memory.json (overwrite if exists — idempotent)
      await writeFile(join(omcDir, "project-memory.json"), "{}", "utf-8");
    },

    // -----------------------------------------------------------------------
    // configure — generate omc.jsonc + populate notepad via createNotepad()
    // -----------------------------------------------------------------------
    async configure(worktreePath: string, context: StoryContext): Promise<void> {
      const agents = buildAgentConfig(userAgents);
      const tierModels = buildTierModels(userModelTiers);

      // Build JSONC with comments for self-documentation
      const lines: string[] = ["{", "  // Agent model assignments", '  "agents": {'];
      const agentEntries = Object.entries(agents);
      for (const [i, [name, cfg]] of agentEntries.entries()) {
        const comma = i < agentEntries.length - 1 ? "," : "";
        lines.push(`    "${name}": ${JSON.stringify(cfg)}${comma}`);
      }
      lines.push("  },");
      lines.push("");
      lines.push("  // Model routing configuration");
      lines.push('  "routing": {');
      lines.push('    "enabled": true,');
      lines.push('    "defaultTier": "MEDIUM",');
      lines.push("    // LOW = simple tasks, MEDIUM = standard, HIGH = complex reasoning");
      lines.push('    "tierModels": {');
      lines.push(`      "LOW": ${JSON.stringify(tierModels.LOW)},`);
      lines.push(`      "MEDIUM": ${JSON.stringify(tierModels.MEDIUM)},`);
      lines.push(`      "HIGH": ${JSON.stringify(tierModels.HIGH)}`);
      lines.push("    }");
      lines.push("  },");
      lines.push("");
      lines.push("  // Feature flags");
      lines.push('  "features": {');
      lines.push('    "parallelExecution": true,');
      lines.push('    "autoContextInjection": true');
      lines.push("  }");
      lines.push("}");

      const omcJsonc = lines.join("\n") + "\n";

      // Ensure .claude/ directory exists and write config
      const claudeDir = join(worktreePath, ".claude");
      await mkdir(claudeDir, { recursive: true });
      await writeFile(join(claudeDir, "omc.jsonc"), omcJsonc, "utf-8");

      // Populate notepad using the shared notepad module
      await createNotepad(worktreePath, context);

      // Generate CLAUDE.md additions for the merge utility (Epic 59, Story 59-4)
      const additions = buildClaudeMdAdditions(agents);
      await writeFile(join(worktreePath, ".omc", "provider-claude-md.md"), additions, "utf-8");
    },

    // -----------------------------------------------------------------------
    // enhance — inject OMC metadata into session
    // -----------------------------------------------------------------------
    async enhance(session: Session): Promise<Session> {
      try {
        // Shallow-clone metadata to avoid mutating the input session
        const metadata = { ...session.metadata };
        metadata["omc:agents"] = JSON.stringify(enabledAgents);
        metadata["omc:executionMode"] = "standard";
        metadata["omc:configured"] = "true";
        return { ...session, metadata };
      } catch {
        // Error-resilient: return session unchanged on any failure
        return session;
      }
    },

    // -----------------------------------------------------------------------
    // teardown — remove .omc/ directory
    // -----------------------------------------------------------------------
    async teardown(worktreePath: string): Promise<void> {
      try {
        await rm(join(worktreePath, ".omc"), { recursive: true, force: true });
      } catch {
        // Missing directory is not an error
      }
    },

    // -----------------------------------------------------------------------
    // healthCheck — always healthy
    // -----------------------------------------------------------------------
    async healthCheck(): Promise<ProviderHealth> {
      return {
        healthy: true,
        lastCheck: new Date(),
      };
    },
  };
}

export default { manifest, create } satisfies PluginModule<SessionEnhancementProvider>;
