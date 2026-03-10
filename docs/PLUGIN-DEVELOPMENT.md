# Plugin Development Guide

How to write custom plugins for Agent Orchestrator — custom runtimes, agents, trackers, notifiers, and more.

---

## Architecture Overview

Agent Orchestrator has **8 pluggable slots**, each defined by a TypeScript interface in `packages/core/src/types.ts`:

| Slot | Interface | Purpose | Example Plugins |
|------|-----------|---------|-----------------|
| Runtime | `Runtime` | Where sessions execute | tmux, process, docker, k8s |
| Agent | `Agent` | AI tool adapter | claude-code, codex, aider |
| Workspace | `Workspace` | Code isolation | worktree, clone |
| Tracker | `Tracker` | Issue/task tracking | github, linear, jira |
| SCM | `SCM` | PR/CI/review management | github, gitlab |
| Notifier | `Notifier` | Push notifications | desktop, slack, webhook |
| Terminal | `Terminal` | Human session attachment | iterm2, web |
| Lifecycle | (core) | State machine | Not pluggable |

Every plugin follows the same pattern: **manifest + create function + satisfies type check**.

---

## Plugin Module Pattern

Every plugin must export a `PluginModule<T>`:

```typescript
import type { PluginModule, Runtime } from "@composio/ao-core";

// 1. Manifest — metadata about the plugin
export const manifest = {
  name: "my-runtime",
  slot: "runtime" as const,
  description: "Runtime plugin: my custom runtime",
  version: "0.1.0",
};

// 2. Create function — returns interface implementation
export function create(config?: Record<string, unknown>): Runtime {
  return {
    name: "my-runtime",
    async create(runtimeConfig) { /* ... */ },
    async destroy(handle) { /* ... */ },
    async sendMessage(handle, message) { /* ... */ },
    async getOutput(handle, lines) { /* ... */ },
    async isAlive(handle) { /* ... */ },
  };
}

// 3. Default export with inline satisfies (REQUIRED)
export default { manifest, create } satisfies PluginModule<Runtime>;
```

**Critical rules:**

- Always use `satisfies PluginModule<T>` — this provides compile-time type checking
- Never use `as unknown as T` casts — they defeat type safety
- The `create()` function receives optional config from the YAML configuration
- The `manifest.slot` must use `as const` for literal type narrowing

---

## Package Structure

```
packages/plugins/my-plugin/
  src/
    index.ts           # Plugin implementation
  package.json
  tsconfig.json
```

### package.json

```json
{
  "name": "@composio/ao-plugin-runtime-my-runtime",
  "version": "0.1.0",
  "description": "Custom runtime plugin for Agent Orchestrator",
  "license": "MIT",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@composio/ao-core": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^25.2.3",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**Naming convention:** `@composio/ao-plugin-{slot}-{name}`

### tsconfig.json

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

---

## Interface Reference

### Runtime Interface

Controls where and how agent sessions execute.

```typescript
interface Runtime {
  readonly name: string;

  // Create a new runtime environment (tmux session, container, process)
  create(config: RuntimeCreateConfig): Promise<RuntimeHandle>;

  // Destroy the runtime environment
  destroy(handle: RuntimeHandle): Promise<void>;

  // Send a message/command to the running agent
  sendMessage(handle: RuntimeHandle, message: string): Promise<void>;

  // Get recent output from the runtime
  getOutput(handle: RuntimeHandle, lines?: number): Promise<string>;

  // Check if the runtime is still alive
  isAlive(handle: RuntimeHandle): Promise<boolean>;

  // Optional: metrics (uptime, memory, CPU)
  getMetrics?(handle: RuntimeHandle): Promise<RuntimeMetrics>;

  // Optional: info for human attachment (tmux attach command, URL, etc.)
  getAttachInfo?(handle: RuntimeHandle): Promise<AttachInfo>;

  // Optional: exit code and signal of terminated process
  getExitCode?(handle: RuntimeHandle): Promise<number | null | undefined>;
  getSignal?(handle: RuntimeHandle): Promise<string | null | undefined>;
}

interface RuntimeCreateConfig {
  sessionId: SessionId;           // Unique session ID (e.g., "fe-1")
  workspacePath: string;          // Path to isolated workspace
  launchCommand: string;          // Command to run (from Agent plugin)
  environment: Record<string, string>; // Env vars (from Agent plugin)
}

interface RuntimeHandle {
  id: string;                     // Runtime-specific ID
  runtimeName: string;            // Plugin name
  data: Record<string, unknown>;  // Opaque runtime state
}
```

**Example: Docker Runtime**

```typescript
import type { PluginModule, Runtime, RuntimeCreateConfig, RuntimeHandle } from "@composio/ao-core";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const manifest = {
  name: "docker",
  slot: "runtime" as const,
  description: "Runtime plugin: Docker containers",
  version: "0.1.0",
};

export function create(config?: Record<string, unknown>): Runtime {
  const image = (config?.image as string) ?? "node:20-slim";

  return {
    name: "docker",

    async create(cfg: RuntimeCreateConfig): Promise<RuntimeHandle> {
      const { stdout } = await execFileAsync("docker", [
        "run", "-d",
        "--name", cfg.sessionId,
        "-v", `${cfg.workspacePath}:/workspace`,
        "-w", "/workspace",
        ...Object.entries(cfg.environment).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
        image,
        "sh", "-c", cfg.launchCommand,
      ], { timeout: 60_000 });

      return {
        id: stdout.trim(),
        runtimeName: "docker",
        data: { containerId: stdout.trim(), createdAt: Date.now() },
      };
    },

    async destroy(handle: RuntimeHandle): Promise<void> {
      await execFileAsync("docker", ["rm", "-f", handle.id], { timeout: 30_000 });
    },

    async sendMessage(handle: RuntimeHandle, message: string): Promise<void> {
      // Write message to a file, agent reads it
      await execFileAsync("docker", [
        "exec", handle.id, "sh", "-c", `echo '${message}' >> /workspace/.ao-message`,
      ], { timeout: 10_000 });
    },

    async getOutput(handle: RuntimeHandle, lines = 100): Promise<string> {
      const { stdout } = await execFileAsync("docker", [
        "logs", "--tail", String(lines), handle.id,
      ], { timeout: 10_000 });
      return stdout;
    },

    async isAlive(handle: RuntimeHandle): Promise<boolean> {
      try {
        const { stdout } = await execFileAsync("docker", [
          "inspect", "-f", "{{.State.Running}}", handle.id,
        ], { timeout: 5_000 });
        return stdout.trim() === "true";
      } catch {
        return false;
      }
    },
  };
}

export default { manifest, create } satisfies PluginModule<Runtime>;
```

---

### Agent Interface

Adapts a specific AI coding tool (Claude Code, Codex, etc.) for the orchestrator.

```typescript
interface Agent {
  readonly name: string;
  readonly processName: string;            // Process name for ps lookup ("claude", "codex")
  readonly promptDelivery?: "inline" | "post-launch"; // How prompt is delivered

  // Generate the shell command to launch the agent
  getLaunchCommand(config: AgentLaunchConfig): string;

  // Environment variables for the agent process
  getEnvironment(config: AgentLaunchConfig): Record<string, string>;

  // Detect activity from terminal output (deprecated, use getActivityState)
  detectActivity(terminalOutput: string): ActivityState;

  // Get structured activity state from agent-native sources (JSONL, DB, etc.)
  getActivityState(session: Session, readyThresholdMs?: number): Promise<ActivityDetection | null>;

  // Check if agent process is running (ps lookup)
  isProcessRunning(handle: RuntimeHandle): Promise<boolean>;

  // Extract session info (summary, cost, session ID for resume)
  getSessionInfo(session: Session): Promise<AgentSessionInfo | null>;

  // Optional: command to resume a previous session
  getRestoreCommand?(session: Session, project: ProjectConfig): Promise<string | null>;

  // Optional: setup after launch (install hooks, configure MCP, etc.)
  postLaunchSetup?(session: Session): Promise<void>;

  // Optional: install hooks in workspace (metadata updater scripts, etc.)
  setupWorkspaceHooks?(workspacePath: string, config: WorkspaceHooksConfig): Promise<void>;
}

interface AgentLaunchConfig {
  prompt: string;                          // Issue description + rules
  workspacePath: string;
  sessionId: SessionId;
  issueId?: string;
  model?: string;
  permissions?: "skip" | "default";
  extraArgs?: string[];
}

interface AgentSessionInfo {
  summary: string | null;
  summaryIsFallback?: boolean;
  agentSessionId: string | null;           // For --resume
  cost?: CostEstimate;
}
```

**Key patterns from existing agent plugins:**

- **Claude Code**: Reads JSONL files from `~/.claude/projects/` for activity detection and session info
- **Codex**: Installs shell wrappers in `~/.ao/bin/` that intercept `gh` and `git` commands to auto-update metadata
- **Aider**: Uses git commit timestamps + chat history mtime for activity detection
- **Process detection**: All agents use `ps -eo pid,tty,args` to find running processes by name + TTY

---

### Tracker Interface

Connects to an issue/task tracking system.

```typescript
interface Tracker {
  readonly name: string;

  // Fetch a single issue by identifier
  getIssue(identifier: string, project: ProjectConfig): Promise<Issue>;

  // Check if an issue is completed
  isCompleted(identifier: string, project: ProjectConfig): Promise<boolean>;

  // Generate URL for the issue
  issueUrl(identifier: string, project: ProjectConfig): string;

  // Generate branch name for the issue
  branchName(identifier: string, project: ProjectConfig): string;

  // Generate prompt text for the agent (issue title + description + labels)
  generatePrompt(identifier: string, project: ProjectConfig): Promise<string>;

  // Optional: extract short label from URL (e.g., "#42")
  issueLabel?(url: string, project: ProjectConfig): string;

  // Optional: list issues with filters
  listIssues?(filters: IssueFilters, project: ProjectConfig): Promise<Issue[]>;

  // Optional: update issue state/labels/comments
  updateIssue?(identifier: string, update: IssueUpdate, project: ProjectConfig): Promise<void>;

  // Optional: create a new issue
  createIssue?(input: CreateIssueInput, project: ProjectConfig): Promise<Issue>;

  // Optional: close issue when PR is merged
  onPRMerge?(issueId: string, prUrl: string | undefined, project: ProjectConfig): Promise<void>;
}

interface Issue {
  id: string;
  title: string;
  description: string;
  url: string;
  state: "open" | "in_progress" | "closed" | "cancelled";
  labels: string[];
  assignee?: string;
  priority?: number;
}
```

**Example: Jira Tracker**

```typescript
import type { PluginModule, Tracker, Issue, ProjectConfig } from "@composio/ao-core";

export const manifest = {
  name: "jira",
  slot: "tracker" as const,
  description: "Tracker plugin: Jira",
  version: "0.1.0",
};

export function create(config?: Record<string, unknown>): Tracker {
  const baseUrl = config?.baseUrl as string;
  const apiToken = process.env["JIRA_API_TOKEN"] ?? "";
  const email = config?.email as string;

  async function jiraFetch(path: string): Promise<unknown> {
    const res = await fetch(`${baseUrl}/rest/api/3${path}`, {
      headers: {
        "Authorization": `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Jira API error: ${res.status}`);
    return res.json();
  }

  return {
    name: "jira",

    async getIssue(identifier: string, _project: ProjectConfig): Promise<Issue> {
      const data = await jiraFetch(`/issue/${identifier}`) as Record<string, unknown>;
      const fields = data.fields as Record<string, unknown>;
      return {
        id: identifier,
        title: fields.summary as string,
        description: (fields.description as string) ?? "",
        url: `${baseUrl}/browse/${identifier}`,
        state: mapJiraState(fields.status as Record<string, unknown>),
        labels: (fields.labels as string[]) ?? [],
        assignee: (fields.assignee as Record<string, unknown>)?.displayName as string,
      };
    },

    async isCompleted(identifier: string, project: ProjectConfig): Promise<boolean> {
      const issue = await this.getIssue(identifier, project);
      return issue.state === "closed";
    },

    issueUrl(identifier: string): string {
      return `${baseUrl}/browse/${identifier}`;
    },

    branchName(identifier: string): string {
      return `feat/${identifier.toLowerCase()}`;
    },

    async generatePrompt(identifier: string, project: ProjectConfig): Promise<string> {
      const issue = await this.getIssue(identifier, project);
      return [
        `## ${issue.title}`,
        `URL: ${issue.url}`,
        issue.labels.length > 0 ? `Labels: ${issue.labels.join(", ")}` : "",
        `\n${issue.description}`,
      ].filter(Boolean).join("\n");
    },
  };
}

function mapJiraState(status: Record<string, unknown>): Issue["state"] {
  const category = (status.statusCategory as Record<string, unknown>)?.key as string;
  if (category === "done") return "closed";
  if (category === "indeterminate") return "in_progress";
  return "open";
}

export default { manifest, create } satisfies PluginModule<Tracker>;
```

---

### Notifier Interface

Sends push notifications to humans.

```typescript
interface Notifier {
  readonly name: string;

  // Send a notification for an orchestrator event
  notify(event: OrchestratorEvent): Promise<void>;
}

interface OrchestratorEvent {
  type: string;                            // "ci.failing", "review.changes_requested", etc.
  priority: "urgent" | "action" | "warning" | "info";
  sessionId: SessionId;
  projectId: string;
  message: string;
  timestamp: Date;
  data: Record<string, unknown>;           // prUrl, ciStatus, etc.
}
```

**Example: Discord Notifier**

```typescript
import type { PluginModule, Notifier, OrchestratorEvent } from "@composio/ao-core";

export const manifest = {
  name: "discord",
  slot: "notifier" as const,
  description: "Notifier plugin: Discord webhooks",
  version: "0.1.0",
};

const PRIORITY_EMOJI: Record<string, string> = {
  urgent: ":rotating_light:",
  action: ":point_right:",
  warning: ":warning:",
  info: ":information_source:",
};

export function create(config?: Record<string, unknown>): Notifier {
  const webhookUrl = (config?.webhook as string) ?? process.env["DISCORD_WEBHOOK_URL"] ?? "";

  return {
    name: "discord",

    async notify(event: OrchestratorEvent): Promise<void> {
      if (!webhookUrl) {
        // eslint-disable-next-line no-console -- notifier plugin, no logger available
        console.warn("Discord webhook URL not configured");
        return;
      }

      const emoji = PRIORITY_EMOJI[event.priority] ?? ":bell:";
      const prUrl = event.data.prUrl as string | undefined;

      const content = [
        `${emoji} **[${event.projectId}/${event.sessionId}]** ${event.message}`,
        prUrl ? `PR: ${prUrl}` : null,
        `Priority: ${event.priority} | ${event.timestamp.toISOString()}`,
      ].filter(Boolean).join("\n");

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        throw new Error(`Discord webhook failed: ${res.status}`);
      }
    },
  };
}

export default { manifest, create } satisfies PluginModule<Notifier>;
```

---

### SCM Interface (Richest)

Full PR/CI/review lifecycle management.

```typescript
interface SCM {
  readonly name: string;

  // PR detection and lifecycle
  detectPR(session: Session, project: ProjectConfig): Promise<PRInfo | null>;
  getPRState(pr: PRInfo): Promise<PRState>;
  mergePR(pr: PRInfo, method?: MergeMethod): Promise<void>;
  closePR(pr: PRInfo): Promise<void>;

  // CI tracking
  getCIChecks(pr: PRInfo): Promise<CICheck[]>;
  getCISummary(pr: PRInfo): Promise<CIStatus>;

  // Review tracking
  getReviews(pr: PRInfo): Promise<Review[]>;
  getReviewDecision(pr: PRInfo): Promise<ReviewDecision>;
  getPendingComments(pr: PRInfo): Promise<ReviewComment[]>;
}
```

### Workspace Interface

```typescript
interface Workspace {
  readonly name: string;

  create(config: WorkspaceCreateConfig): Promise<WorkspaceInfo>;
  destroy(workspacePath: string): Promise<void>;
  list(projectId: string): Promise<WorkspaceInfo[]>;

  // Optional
  postCreate?(info: WorkspaceInfo, project: ProjectConfig): Promise<void>;
  exists?(workspacePath: string): Promise<boolean>;
  restore?(config: WorkspaceCreateConfig, workspacePath: string): Promise<WorkspaceInfo>;
}
```

### Terminal Interface

```typescript
interface Terminal {
  readonly name: string;

  openSession(session: Session): Promise<void>;
}
```

---

## Security Requirements

### Shell Command Execution (Critical)

**Always use `execFile`**, never `exec`:

```typescript
// CORRECT — arguments passed as array, no shell injection
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

const { stdout } = await execFileAsync("git", ["branch", "--show-current"], {
  timeout: 30_000,
});

// WRONG — shell injection vulnerability
import { exec } from "node:child_process";
exec(`git checkout ${branchName}`);  // branchName could be "; rm -rf /"
```

### Path Validation

Validate path segments to prevent directory traversal:

```typescript
const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9_-]+$/;

function assertSafe(value: string, label: string): void {
  if (!SAFE_PATH_SEGMENT.test(value)) {
    throw new Error(`Invalid ${label}: "${value}"`);
  }
}
```

### JSON Parsing

Always wrap `JSON.parse` in try/catch:

```typescript
try {
  const parsed: unknown = JSON.parse(data);
  // validate structure before using
} catch {
  // Handle corrupted data gracefully
}
```

### Timeouts

Always set timeouts on external commands:

```typescript
await execFileAsync("gh", ["pr", "view", prNumber], { timeout: 30_000 });
```

---

## TypeScript Conventions

| Rule | Example |
|------|---------|
| ESM modules | `"type": "module"` in package.json |
| `.js` extensions in imports | `import { foo } from "./bar.js"` |
| `node:` prefix for builtins | `import { readFileSync } from "node:fs"` |
| `import type` for types | `import type { Runtime } from "@composio/ao-core"` |
| No `any` | Use `unknown` + type guards |
| `const` by default | `let` only when reassignment needed |
| Semicolons, double quotes | Enforced by Prettier |

---

## Testing Plugins

Use vitest with mocks:

```typescript
import { describe, it, expect, vi } from "vitest";
import { create } from "../src/index.js";

describe("my-runtime", () => {
  it("creates a session", async () => {
    const runtime = create();
    const handle = await runtime.create({
      sessionId: "test-1",
      workspacePath: "/tmp/test",
      launchCommand: "echo hello",
      environment: { NODE_ENV: "test" },
    });

    expect(handle.id).toBeDefined();
    expect(handle.runtimeName).toBe("my-runtime");
    expect(await runtime.isAlive(handle)).toBe(true);

    await runtime.destroy(handle);
    expect(await runtime.isAlive(handle)).toBe(false);
  });
});
```

---

## Registering Your Plugin

### Built-in (in monorepo)

1. Create `packages/plugins/{slot}-{name}/`
2. Add to `pnpm-workspace.yaml`
3. Add to the `BUILTIN_PLUGINS` array in `packages/core/src/plugin-registry.ts`

### External (npm package)

```bash
ao plugins install @your-org/ao-plugin-runtime-docker
```

### Config Reference

```yaml
projects:
  my-app:
    runtime: my-runtime        # Matches manifest.name
    tracker:
      plugin: jira
      baseUrl: https://your-org.atlassian.net
      email: you@company.com
```

Plugin-specific config is passed to the `create(config)` function.

---

## Complexity Levels

| Level | Example | Lines | Notes |
|-------|---------|-------|-------|
| Minimal | terminal-web | ~50 | Stateless, no external commands |
| Simple | notifier-desktop | ~80 | Single OS command |
| Moderate | runtime-tmux | ~200 | Session lifecycle, command handling |
| Complex | agent-claude-code | ~900 | JSONL introspection, hook scripts, caching |

Start with the simplest existing plugin in your target slot and extend from there.

---

## Key Files to Read

1. `packages/core/src/types.ts` — All interfaces (~2600 lines)
2. `packages/plugins/runtime-tmux/src/index.ts` — Clean Runtime example
3. `packages/plugins/tracker-github/src/index.ts` — Clean Tracker example
4. `packages/plugins/notifier-slack/src/index.ts` — Clean Notifier example
5. `packages/core/src/plugin-registry.ts` — How plugins are loaded and registered
