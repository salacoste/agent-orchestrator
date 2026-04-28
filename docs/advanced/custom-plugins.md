---
title: Custom Plugin Development
nav_order: 3
parent: Advanced Topics
description: Plugin authoring guide — PluginModule interface, directory structure, all 8 slot interfaces, registration, lifecycle, testing, version compatibility, and step-by-step walkthrough with code examples.
---

# Custom Plugin Development

# Custom Plugin Development

## Overview

The Agent Orchestrator is built on 8 swappable plugin slots. Every abstraction — runtime, agent, workspace, tracker, SCM, notifier, terminal, and session enhancement — is a plugin. This guide covers how to write, test, register, and distribute custom plugins.

The plugin system is agent-agnostic: all AI coding tools (Claude Code, Codex, Aider, GLM, OpenCode) are interchangeable agent plugins. The same applies to runtimes (tmux, process), trackers (GitHub, Linear, BMAD), and every other slot.

**Core types:** `packages/core/src/types.ts` — read this file first for all interface definitions.

**Infrastructure:** `packages/core/src/plugin-registry.ts`, `packages/core/src/plugin-loader.ts`, `packages/core/src/plugin-installer.ts`, `packages/core/src/plugin-version-compatibility.ts`

**Related docs:** [Plugins Index](../plugins/)

## Plugin Architecture

### PluginSlot

Every plugin fills exactly one of 8 slots:

```typescript
type PluginSlot =
  | "runtime"   // Where sessions execute (tmux, process, docker)
  | "agent"     // AI coding tool (claude-code, codex, aider)
  | "workspace" // Code isolation (worktree, clone)
  | "tracker"   // Issue tracking (github, linear, bmad)
  | "scm"       // Source control + PR/CI/reviews (github)
  | "notifier"  // Push notifications (desktop, slack, webhook)
  | "terminal"  // Human interaction UI (iterm2, web)
  | "provider"; // Session enhancement (raw, omc)
```

### PluginManifest (TypeScript)

Every plugin declares its identity via a TypeScript interface with 4 fields:

```typescript
// Source: packages/core/src/types.ts
interface PluginManifest {
  name: string;        // e.g. "tmux", "claude-code"
  slot: PluginSlot;    // Which slot this fills
  description: string; // Human-readable summary
  version: string;     // Semver (e.g. "0.1.0")
}
```

{: .note}
> The Plugin Loader also defines a separate `PluginManifestWithMeta` interface (6 fields) for external/community plugins loaded from `plugin.yaml` files. That manifest includes additional fields: `apiVersion`, `main`, and `permissions`. See the [Plugin Loader](#plugin-loader) section below. Built-in plugins use the 4-field TypeScript `PluginManifest` above — they don't need `plugin.yaml` files.

### PluginModule\<T\>

The core contract — what every plugin must export:

```typescript
interface PluginModule<T = unknown> {
  manifest: PluginManifest;
  create(config?: Record<string, unknown>): T;

  // Optional lifecycle hooks at module level
  init?(): Promise<void> | void;
  shutdown?(): Promise<void> | void;
}
```

- `manifest` — static metadata (name, slot, description, version)
- `create()` — factory function returning a slot-specific interface implementation
- `init()` / `shutdown()` — optional lifecycle hooks (called by the registry)

### PluginLifecycle

Instances may implement optional lifecycle hooks:

```typescript
interface PluginLifecycle {
  init?(): Promise<void> | void;
  shutdown?(): Promise<void> | void;
}
```

Both module-level and instance-level hooks are called. Init order: module first, then instance. Shutdown order: instance first, then module (reverse).

## Plugin Structure

### Directory Layout

```
packages/plugins/{slot}-{name}/
  src/
    index.ts           # Plugin entry point
    index.test.ts      # Co-located tests
  package.json         # peer dep on @composio/ao-core
  tsconfig.json        # extends ../../../tsconfig.base.json
```

### package.json

```json
{
  "name": "@composio/ao-plugin-{slot}-{name}",
  "type": "module",
  "main": "dist/index.js",
  "peerDependencies": {
    "@composio/ao-core": "workspace:*"
  }
}
```

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

### Export Pattern

Every plugin must export three things from `src/index.ts`:

```typescript
import type { PluginModule, Runtime } from "@composio/ao-core";

export const manifest = {
  name: "my-runtime",
  slot: "runtime" as const,
  description: "Runtime plugin: custom runtime",
  version: "0.1.0",
};

export function create(config?: Record<string, unknown>): Runtime {
  return {
    name: "my-runtime",
    // ... implement Runtime interface methods
  };
}

export default { manifest, create } satisfies PluginModule<Runtime>;
```

Key conventions:
- **Inline `satisfies`** — compile-time type checking enforced by the build
- **Named exports** — `manifest` and `create` as named, default export with `satisfies`
- **No cross-plugin imports** — zero dependencies between plugins

## Slot Interfaces

Each slot defines a TypeScript interface that `create()` must return. Required methods must be implemented; optional methods (marked `?`) can be omitted.

### Runtime (Slot 1)

Where sessions execute. Manages process lifecycle, I/O, and health.

```typescript
interface Runtime {
  readonly name: string;
  create(config: RuntimeCreateConfig): Promise<RuntimeHandle>;
  destroy(handle: RuntimeHandle): Promise<void>;
  sendMessage(handle: RuntimeHandle, message: string): Promise<void>;
  getOutput(handle: RuntimeHandle, lines?: number): Promise<string>;
  isAlive(handle: RuntimeHandle): Promise<boolean>;
  getMetrics?(handle: RuntimeHandle): Promise<RuntimeMetrics>;
  getAttachInfo?(handle: RuntimeHandle): Promise<AttachInfo>;
  getExitCode?(handle: RuntimeHandle): Promise<number | null | undefined>;
  getSignal?(handle: RuntimeHandle): Promise<string | null | undefined>;
}
```

5 required + 4 optional methods. Reference implementation: `packages/plugins/runtime-process/src/index.ts`

### Agent (Slot 2)

AI coding tool adapter. Knows how to launch, detect activity, and extract info.

```typescript
interface Agent {
  readonly name: string;
  readonly processName: string;
  readonly promptDelivery?: "inline" | "post-launch";
  getLaunchCommand(config: AgentLaunchConfig): string;
  getEnvironment(config: AgentLaunchConfig): Record<string, string>;
  detectActivity(terminalOutput: string): ActivityState;
  getActivityState(session: Session, readyThresholdMs?: number): Promise<ActivityDetection | null>;
  isProcessRunning(handle: RuntimeHandle): Promise<boolean>;
  getSessionInfo(session: Session): Promise<AgentSessionInfo | null>;
  getRestoreCommand?(session: Session, project: ProjectConfig): Promise<string | null>;
  postLaunchSetup?(session: Session): Promise<void>;
  setupWorkspaceHooks?(workspacePath: string, config: WorkspaceHooksConfig): Promise<void>;
}
```

6 required + 3 optional methods. Reference implementation: `packages/plugins/agent-claude-code/src/index.ts`

### Workspace (Slot 3)

Code isolation — how each session gets its own copy of the repo.

```typescript
interface Workspace {
  readonly name: string;
  create(config: WorkspaceCreateConfig): Promise<WorkspaceInfo>;
  destroy(workspacePath: string): Promise<void>;
  list(projectId: string): Promise<WorkspaceInfo[]>;
  postCreate?(info: WorkspaceInfo, project: ProjectConfig): Promise<void>;
  exists?(workspacePath: string): Promise<boolean>;
  restore?(config: WorkspaceCreateConfig, workspacePath: string): Promise<WorkspaceInfo>;
}
```

3 required + 3 optional methods. Reference implementation: `packages/plugins/workspace-worktree/src/index.ts`

### Tracker (Slot 4)

Issue/task tracking — GitHub Issues, Linear, Jira, BMAD.

```typescript
interface Tracker {
  readonly name: string;
  getIssue(identifier: string, project: ProjectConfig): Promise<Issue>;
  isCompleted(identifier: string, project: ProjectConfig): Promise<boolean>;
  issueUrl(identifier: string, project: ProjectConfig): string;
  branchName(identifier: string, project: ProjectConfig): string;
  generatePrompt(identifier: string, project: ProjectConfig): Promise<string>;
  issueLabel?(url: string, project: ProjectConfig): string;
  listIssues?(filters: IssueFilters, project: ProjectConfig): Promise<Issue[]>;
  updateIssue?(identifier: string, update: IssueUpdate, project: ProjectConfig): Promise<void>;
  createIssue?(input: CreateIssueInput, project: ProjectConfig): Promise<Issue>;
  validateIssue?(identifier: string, project: ProjectConfig): Promise<IssueValidationResult>;
  findIssueByBranch?(branch: string, project: ProjectConfig): Promise<string | null>;
  onPRMerge?(issueId: string, prUrl: string | undefined, project: ProjectConfig): Promise<void>;
  onSessionDeath?(issueId: string, project: ProjectConfig, sessionId?: string): Promise<void>;
  getNotifications?(project: ProjectConfig): Promise<OrchestratorEvent[]>;
  getEpicTitle?(epicId: string, project: ProjectConfig): string;
}
```

5 required + 10 optional methods. Reference implementation: `packages/plugins/tracker-github/src/index.ts`

### SCM (Slot 5)

Source control platform — PR lifecycle, CI tracking, review management.

```typescript
interface SCM {
  readonly name: string;
  detectPR(session: Session, project: ProjectConfig): Promise<PRInfo | null>;
  getPRState(pr: PRInfo): Promise<PRState>;
  getPRSummary?(pr: PRInfo): Promise<{ state: PRState; title: string; additions: number; deletions: number }>;
  mergePR(pr: PRInfo, method?: MergeMethod): Promise<void>;
  closePR(pr: PRInfo): Promise<void>;
  getCIChecks(pr: PRInfo): Promise<CICheck[]>;
  getCISummary(pr: PRInfo): Promise<CIStatus>;
  getReviews(pr: PRInfo): Promise<Review[]>;
  getReviewDecision(pr: PRInfo): Promise<ReviewDecision>;
  getPendingComments(pr: PRInfo): Promise<ReviewComment[]>;
  getAutomatedComments(pr: PRInfo): Promise<AutomatedComment[]>;
  getMergeability(pr: PRInfo): Promise<MergeReadiness>;
}
```

11 required + 1 optional methods. Reference implementation: `packages/plugins/scm-github/src/index.ts`

### Notifier (Slot 6)

Push notifications — the primary interface between orchestrator and human.

```typescript
interface Notifier {
  readonly name: string;
  notify(event: OrchestratorEvent): Promise<void>;
  notifyWithActions?(event: OrchestratorEvent, actions: NotifyAction[]): Promise<void>;
  post?(message: string, context?: NotifyContext): Promise<string | null>;
}
```

1 required + 2 optional methods. Reference implementation: `packages/plugins/notifier-webhook/src/index.ts`

### Terminal (Slot 7)

Human interaction — opens IDE tabs, browser windows, or terminal sessions.

```typescript
interface Terminal {
  readonly name: string;
  openSession(session: Session): Promise<void>;
  openAll(sessions: Session[]): Promise<void>;
  isSessionOpen?(session: Session): Promise<boolean>;
}
```

2 required + 1 optional methods. Reference implementation: `packages/plugins/terminal-iterm2/src/index.ts`

### SessionEnhancementProvider (Slot 8)

Session enhancement — install/configure provider artifacts in workspaces.

```typescript
interface SessionEnhancementProvider {
  readonly name: string;
  install(worktreePath: string, config: ProviderConfig): Promise<void>;
  configure(worktreePath: string, context: StoryContext): Promise<void>;
  enhance(session: Session): Promise<Session>;
  teardown(worktreePath: string): Promise<void>;
  healthCheck(): Promise<ProviderHealth>;
}
```

5 required methods. Reference implementation: `packages/plugins/provider-raw/src/index.ts`

## Step-by-Step Guide: Custom Notifier

This walkthrough creates a custom notifier plugin that sends events to a file. It demonstrates the complete plugin development cycle: scaffold, implement, test, register, configure.

### 1. Create Package Directory

```bash
mkdir -p packages/plugins/notifier-filelog/src
cd packages/plugins/notifier-filelog
```

### 2. Create package.json

```json
{
  "name": "@composio/ao-plugin-notifier-filelog",
  "type": "module",
  "version": "0.1.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "peerDependencies": {
    "@composio/ao-core": "workspace:*"
  }
}
```

### 3. Create tsconfig.json

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

### 4. Implement the Plugin

```typescript
// src/index.ts
import { appendFile } from "node:fs/promises";
import type {
  PluginModule,
  Notifier,
  OrchestratorEvent,
} from "@composio/ao-core";

export const manifest = {
  name: "filelog",
  slot: "notifier" as const,
  description: "Notifier plugin: append events to a log file",
  version: "0.1.0",
};

export function create(config?: Record<string, unknown>): Notifier {
  const filePath = (config?.filePath as string) ?? "/tmp/ao-events.log";

  return {
    name: "filelog",

    async notify(event: OrchestratorEvent): Promise<void> {
      const line = `${new Date().toISOString()} [${event.priority}] ${event.type}: ${event.message}\n`;
      await appendFile(filePath, line);
    },
  };
}

export default { manifest, create } satisfies PluginModule<Notifier>;
```

### 5. Write Tests

```typescript
// src/index.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { create } from "./index.js";

const TMP = join(import.meta.dirname, "__test_tmp__");

describe("notifier-filelog", () => {
  beforeEach(async () => {
    await mkdir(TMP, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP, { recursive: true, force: true });
  });

  it("appends event to log file", async () => {
    const logPath = join(TMP, "events.log");
    const notifier = create({ filePath: logPath });

    await notifier.notify({
      id: "evt-1",
      type: "session.spawned",
      priority: "info",
      sessionId: "test-1",
      projectId: "my-project",
      timestamp: new Date("2026-04-27T12:00:00Z"),
      message: "Session started",
      data: {},
    });

    const content = await readFile(logPath, "utf-8");
    expect(content).toContain("[info] session.spawned: Session started");
  });
});
```

### 6. Register in Config

Add to `agent-orchestrator.yaml`:

```yaml
projects:
  my-project:
    name: "My Project"
    # ...
    plugins:
      notifier:
        name: filelog
        config:
          filePath: "/var/log/ao/events.log"
```

### 7. Test the Build

```bash
cd packages/plugins/notifier-filelog
pnpm build
pnpm test
```

## Plugin Registry

The registry manages plugin lifecycle: discovery, registration, retrieval, and shutdown.

**Source:** `packages/core/src/plugin-registry.ts`

### Registration

```typescript
const registry = createPluginRegistry();

// Load all built-in plugins from packages/plugins/*
await registry.loadBuiltins(orchestratorConfig);

// Load plugins specified in config
await registry.loadFromConfig(config);

// Manual registration
registry.register(myPluginModule, { customConfig: true });
```

### Retrieval

```typescript
// Get a specific plugin by slot + name
const runtime = registry.get<Runtime>("runtime", "tmux");

// List all plugins for a slot
const notifiers = registry.list("notifier");

// Check if registered
const exists = registry.isRegistered("notifier", "slack");
```

### Built-in Plugins

20 built-in plugins are registered automatically via `loadBuiltins()`:

| Slot | Plugins |
|------|---------|
| runtime | tmux, process |
| agent | claude-code, glm, codex, aider |
| workspace | worktree, clone |
| tracker | github, linear, bmad |
| scm | github |
| notifier | composio, desktop, slack, webhook |
| terminal | iterm2, web |
| provider | raw, omc |

{: .note}
> Built-in plugins are loaded on a best-effort basis — if a package is not installed, it is silently skipped. Missing built-in plugins generate warnings for configured providers.

### Hot Reload

Replace a running plugin without full system restart:

```typescript
const success = await registry.reload("notifier", "slack");
```

Hot reload preserves state through optional instance hooks:

- **`getState()`** — if the plugin instance exposes this method, the registry calls it before shutdown to capture state into an internal `Map`
- **`setState(state)`** — if the new instance exposes this method, the registry calls it after creation to restore the captured state

These are not part of the `PluginLifecycle` interface — they are informal hooks that the registry detects via duck-typing (`typeof instance.getState === "function"`). Plugins that need to survive hot reload (e.g., maintaining connection pools or cached data) should implement both methods.

### Shutdown

```typescript
// Shutdown a single plugin
await registry.shutdown("runtime", "tmux");

// Shutdown all registered plugins (reverse order)
await registry.shutdownAll();
```

Shutdown calls both instance-level and module-level `shutdown()` hooks. Errors are caught and logged — they never crash the system.

## Plugin Loader

Discovers and validates external/community plugins from `plugin.yaml` manifests. Built-in plugins (loaded via `registry.loadBuiltins()`) are imported directly from TypeScript packages and don't use YAML manifests.

**Source:** `packages/core/src/plugin-loader.ts`

### Two Loading Mechanisms

| Mechanism | For | Manifest | Loaded By |
|-----------|-----|----------|-----------|
| TypeScript import | Built-in plugins (`packages/plugins/*`) | 4-field `PluginManifest` in code | `registry.loadBuiltins()` |
| YAML + dynamic import | External/community plugins | 6-field `plugin.yaml` file | `loader.scan()` + `loader.loadPlugin()` |

### Scanning

```typescript
const loader = createPluginLoader({
  pluginsDir: "/path/to/plugins",
  apiVersion: "1.0.0",
});

const results = await loader.scan();
// Returns PluginLoadResult[] — loaded or failed for each discovered plugin
```

### Validation (External Plugins)

Each external plugin directory must contain a `plugin.yaml` with these fields:

```yaml
name: my-plugin
version: 0.1.0
description: "My custom plugin"
apiVersion: "1.0.0"
main: dist/index.js
permissions:
  - runtime
```

This is the `PluginManifestWithMeta` format (6 fields). Missing required fields (`name`, `version`, `description`, `apiVersion`, `main`, `permissions`) cause the plugin to fail validation. Built-in plugins don't use this file — they declare their manifest inline in TypeScript.

### Permission System

Plugins declare required permissions. The loader enforces them:

```typescript
loader.requirePermission("my-plugin", "runtime"); // Throws PermissionError if not granted
loader.checkPermission("my-plugin", "notifier");   // Returns boolean
```

```typescript
class PermissionError extends Error {
  pluginName: string;
  operation: string;
}
```

## Plugin Installer

Install, update, and manage plugins from npm or local paths.

**Source:** `packages/core/src/plugin-installer.ts`

### Operations

```typescript
const installer = createPluginInstaller({
  pluginsDir: "/path/to/plugins",
  apiVersion: "1.0.0",
});

// Install from npm
const result = await installer.install("@composio/ao-plugin-notifier-filelog");

// Install from local path
await installer.install("/local/path/to/plugin", { local: true });

// Update to latest
await installer.update("@composio/ao-plugin-notifier-filelog");

// Uninstall (checks for dependents)
await installer.uninstall("@composio/ao-plugin-notifier-filelog");

// Search npm for ao-plugin packages
const results = await installer.search("notifier");

// Disable/enable without uninstalling
await installer.disable("@composio/ao-plugin-notifier-filelog");
await installer.enable("@composio/ao-plugin-notifier-filelog");
```

### Disable Mechanism

Disabling creates a `.disabled` file in the plugin directory. The loader skips directories containing this file during scanning.

### Dependency Safety

`uninstall()` checks for dependent plugins before removing. Use `force: true` to bypass:

```typescript
await installer.uninstall("my-plugin", { force: true });
```

## Version Compatibility

Validates plugin versions against the orchestrator core using semantic versioning.

**Source:** `packages/core/src/plugin-version-compatibility.ts`

### Checking Compatibility

```typescript
const matrix = createVersionCompatibilityMatrix({ coreVersion: "0.1.0" });

const result = matrix.check("@composio/ao-plugin-runtime-tmux", "0.1.0");
```

### CompatibilityResult

```typescript
interface CompatibilityResult {
  pluginName: string;
  pluginVersion: string;
  coreVersion: string;
  status: CompatibilityStatus;
  message: string;
  recommendation?: string;
  minimumVersion?: string;
  maximumVersion?: string;
  knownIssues?: string[];
}
```

### Status Values

| Status | Meaning |
|--------|---------|
| `compatible` | Version is within a known compatible range |
| `warning` | Version is newer than tested range |
| `incompatible` | Version is too old |
| `deprecated` | Version works but has known issues |
| `unknown` | Plugin not in the compatibility registry |

### Registering Custom Ranges

```typescript
matrix.register({
  name: "@composio/ao-plugin-notifier-filelog",
  ranges: [{ min: "0.1.0", max: "1.0.0" }],
  recommendedVersion: "0.1.0",
  lastTestedVersion: "0.1.0",
});
```

## Testing

### Test Structure

Tests are co-located with source files using the `*.test.ts` pattern:

```
src/
  index.ts
  index.test.ts
```

### Mocking Slot Interfaces

For unit tests, create inline mock objects that satisfy the interface:

```typescript
import type { Runtime, RuntimeHandle } from "@composio/ao-core";

function createMockRuntime(overrides?: Partial<Runtime>): Runtime {
  return {
    name: "mock",
    create: vi.fn().mockResolvedValue({ id: "test", runtimeName: "mock", data: {} }),
    destroy: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    getOutput: vi.fn().mockResolvedValue(""),
    isAlive: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}
```

### Testing the Export Pattern

Verify the plugin satisfies the `PluginModule<T>` contract:

```typescript
import { describe, it, expect } from "vitest";
import mod, { manifest, create } from "./index.js";
import type { PluginModule, Notifier } from "@composio/ao-core";

it("exports valid PluginModule<Notifier>", () => {
  expect(mod.manifest).toBeDefined();
  expect(mod.manifest.slot).toBe("notifier");
  expect(typeof mod.create).toBe("function");
  const instance = mod.create();
  expect(instance.name).toBe("filelog");
  expect(typeof instance.notify).toBe("function");
});
```

### Module-Level Singleton Reset

If the plugin uses module-level state, add a `_resetForTesting()` method:

```typescript
// In plugin source
const cache = new Map<string, string>();

export function _resetForTesting(): void {
  cache.clear();
}

// In tests
beforeEach(() => { _resetForTesting(); });
```

Call `_resetForTesting()` in `beforeEach`, not `afterEach` — thrown tests skip `afterEach`.

## Configuration

### Global Plugin Config

In `agent-orchestrator.yaml`, plugins receive config through the `create()` function. Notifiers use a keyed map:

```yaml
defaults:
  runtime: tmux
  agent: claude-code
  workspace: worktree
  notifiers: [desktop]  # Default notifiers to enable

# Notification channel configuration
notifiers:
  slack:
    plugin: slack
    webhook: ${SLACK_WEBHOOK_URL}
    channel: "#agent-ops"
  desktop:
    plugin: desktop
    sound: true
```

### Per-Project Overrides

Override plugins per-project:

```yaml
projects:
  api-service:
    name: "API Service"
    repo: "org/api-service"
    path: "~/projects/api-service"
    defaultBranch: main
    sessionPrefix: "api"
    runtime: tmux
    agent: claude-code
    tracker: github
    notifier: slack
    terminal: iterm2
```

### Provider Configuration

The session enhancement provider has its own config section:

```yaml
sessionEnhancement:
  provider: omc
  config:
    autoInstall: true
    mergeStrategy: append
```

Per-project provider override:

```yaml
projects:
  secure-project:
    sessionEnhancement:
      provider: raw
```

## Config Examples

### Minimal Runtime Plugin

The simplest possible runtime — spawns a child process:

```typescript
import { spawn } from "node:child_process";
import type { PluginModule, Runtime, RuntimeHandle } from "@composio/ao-core";

export const manifest = {
  name: "process",
  slot: "runtime" as const,
  description: "Runtime plugin: child processes",
  version: "0.1.0",
};

export function create(): Runtime {
  return {
    name: "process",
    async create(config) {
      const child = spawn(config.launchCommand, {
        cwd: config.workspacePath,
        env: { ...process.env, ...config.environment },
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });
      return {
        id: config.sessionId,
        runtimeName: "process",
        data: { pid: child.pid },
      };
    },
    async destroy(handle) { /* kill process */ },
    async sendMessage(handle, message) { /* write to stdin */ },
    async getOutput(handle) { /* read from buffer */ },
    async isAlive(handle) { /* check exitCode */ },
  };
}

export default { manifest, create } satisfies PluginModule<Runtime>;
```

### Custom Notifier Plugin

A notifier that posts to an HTTP endpoint with retry:

```typescript
import type {
  PluginModule,
  Notifier,
  OrchestratorEvent,
} from "@composio/ao-core";

export const manifest = {
  name: "webhook",
  slot: "notifier" as const,
  description: "Notifier plugin: HTTP webhook",
  version: "0.1.0",
};

export function create(config?: Record<string, unknown>): Notifier {
  const url = config?.url as string;

  return {
    name: "webhook",
    async notify(event: OrchestratorEvent): Promise<void> {
      if (!url) return;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: event.type,
          priority: event.priority,
          sessionId: event.sessionId,
          message: event.message,
        }),
      });
      if (!response.ok) {
        throw new Error(`Webhook POST failed: ${response.status}`);
      }
    },
  };
}

export default { manifest, create } satisfies PluginModule<Notifier>;
```

### Plugin Configuration in YAML

Full plugin configuration in `agent-orchestrator.yaml`:

```yaml
# Global defaults
runtime: tmux
agent: claude-code
workspace: worktree
tracker: github
scm: github
notifier: desktop
terminal: iterm2

# Session enhancement
sessionEnhancement:
  provider: omc
  config:
    autoInstall: true
    mergeStrategy: append

# Per-project overrides
projects:
  frontend:
    name: "Frontend App"
    repo: "org/frontend"
    path: "~/projects/frontend"
    defaultBranch: main
    sessionPrefix: "fe"
    agent: codex              # Use Codex for frontend
    notifier: slack           # Use Slack for frontend
    notifierConfig:
      webhookUrl: "https://hooks.slack.com/services/..."
      channel: "#frontend-ops"

  backend:
    name: "Backend API"
    repo: "org/backend"
    path: "~/projects/backend"
    defaultBranch: main
    sessionPrefix: "be"
    runtime: process          # Use process runtime for backend
    agent: claude-code        # Use Claude Code for backend
```

---

- **Parent** — [Advanced Topics](.)
- **Siblings** — [Cross-Project Orchestration](cross-project/), [Monte Carlo Simulations](monte-carlo/), [Hooks & Extensions](hooks-extensions/), [Prompt Layers](prompt-layers/), [Production Deployment](production-deployment/)
- **Plugin Reference** — [Plugins Index](../plugins/)
- **Getting Started** — [Installation](../getting-started/installation/), [Quick Start](../getting-started/quick-start/)
- **Configuration** — [Configuration Reference](../getting-started/configuration/)
