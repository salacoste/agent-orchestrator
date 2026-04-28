---
title: Plugin Development
nav_order: 2
parent: Contributing
description: Build custom plugins for Agent Orchestrator — complete guide covering the PluginModule pattern, all 8 plugin interfaces, testing, security, and publishing.
---

# Plugin Development

Every major abstraction in Agent Orchestrator is a plugin. This guide covers how to build, test, and publish your own. The plugin system is built around 8 typed interfaces — implement one and the orchestrator handles the rest.

{: .highlight }
> **Start here:** The [Notifier](#quick-start---notifier-plugin) interface has only 2 required methods and is the fastest way to learn the pattern.

---

## Plugin System Overview

### The 8 Plugin Slots

Every plugin occupies one of 8 slots. Each slot defines a typed interface — swap any plugin without touching the core.

| Slot | Interface | Default Plugin | Purpose |
|------|-----------|----------------|---------|
| Runtime | `Runtime` | tmux | Where sessions execute |
| Agent | `Agent` | claude-code | AI coding tool |
| Workspace | `Workspace` | worktree | Code isolation |
| Tracker | `Tracker` | github | Issue tracking |
| SCM | `SCM` | github | Source control + PR/CI |
| Notifier | `Notifier` | desktop | Push notifications |
| Terminal | `Terminal` | iterm2 | Human interaction UI |
| Provider | `SessionEnhancementProvider` | raw | Session enhancement |

### Core Types

All interfaces are defined in `packages/core/src/types.ts`. Three types define the plugin contract:

**`PluginSlot`** — which slot a plugin occupies:

```typescript
type PluginSlot =
  | "runtime" | "agent" | "workspace" | "tracker"
  | "scm" | "notifier" | "terminal" | "provider";
```

**`PluginManifest`** — metadata about your plugin:

```typescript
interface PluginManifest {
  name: string;        // e.g. "desktop"
  slot: PluginSlot;    // e.g. "notifier"
  description: string; // e.g. "Notifier plugin: OS desktop notifications"
  version: string;     // e.g. "0.1.0"
}
```

**`PluginModule<T>`** — the module your plugin exports:

```typescript
interface PluginModule<T = unknown> {
  manifest: PluginManifest;
  create(config?: Record<string, unknown>): T;
  init?(): Promise<void> | void;      // optional lifecycle hook
  shutdown?(): Promise<void> | void;   // optional lifecycle hook
}
```

{: .note }
> The `create()` function receives plugin config from `agent-orchestrator.yaml` as a `Record<string, unknown>`. Validate and parse it inside `create()`.

---

## Quick Start — Notifier Plugin

The `Notifier` interface has only 2 required methods — perfect for learning the pattern.

### 1. Create the Plugin File

```
packages/plugins/notifier-my-plugin/
  src/
    index.ts
  package.json
  tsconfig.json
```

### 2. Write the Plugin

```typescript
import type { PluginModule, Notifier, OrchestratorEvent } from "@composio/ao-core";

export const manifest = {
  name: "my-plugin",
  slot: "notifier" as const,
  description: "Notifier plugin: my custom notification channel",
  version: "0.1.0",
};

export function create(config?: Record<string, unknown>): Notifier {
  // Parse config — validate types, set defaults
  const apiUrl = typeof config?.apiUrl === "string"
    ? config.apiUrl
    : "https://default.example.com";

  return {
    name: "my-plugin",

    async notify(event: OrchestratorEvent): Promise<void> {
      // Required: send a notification for this event
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: event.sessionId,
          message: event.message,
          priority: event.priority,
        }),
      });
      if (!response.ok) {
        throw new Error(`Notification failed: ${response.status}`);
      }
    },

    // Optional: send notification with interactive action buttons
    async notifyWithActions(event, actions) {
      // Not all channels support actions — fallback to plain notify
      await this.notify(event);
    },

    // Optional: post a free-form message (not tied to an event)
    async post(message, context) {
      // Return message ID or null
      return null;
    },
  };
}

export default { manifest, create } satisfies PluginModule<Notifier>;
```

{: .warning }
> Always use `satisfies PluginModule<T>` inline on the default export. Do NOT assign to an intermediate variable — inline `satisfies` gives compile-time type checking that catches missing methods.

### 3. Configure in agent-orchestrator.yaml

```yaml
plugins:
  notifier:
    name: my-plugin
    config:
      apiUrl: "https://my-channel.example.com/webhook"
```

---

## Plugin Interfaces Reference

All interfaces are defined in `packages/core/src/types.ts`. Required methods must be implemented; optional methods provide enhanced functionality.

### Runtime

Where sessions execute (tmux, docker, process).

| Method | Required | Signature |
|--------|----------|-----------|
| `name` | Yes | `readonly string` |
| `create` | Yes | `(config: RuntimeCreateConfig) => Promise<RuntimeHandle>` |
| `destroy` | Yes | `(handle: RuntimeHandle) => Promise<void>` |
| `sendMessage` | Yes | `(handle: RuntimeHandle, message: string) => Promise<void>` |
| `getOutput` | Yes | `(handle: RuntimeHandle, lines?: number) => Promise<string>` |
| `isAlive` | Yes | `(handle: RuntimeHandle) => Promise<boolean>` |
| `getMetrics` | No | `(handle: RuntimeHandle) => Promise<RuntimeMetrics>` |
| `getAttachInfo` | No | `(handle: RuntimeHandle) => Promise<AttachInfo>` |
| `getExitCode` | No | `(handle: RuntimeHandle) => Promise<number \| null \| undefined>` |
| `getSignal` | No | `(handle: RuntimeHandle) => Promise<string \| null \| undefined>` |

### Agent

AI coding tool integration (claude-code, codex, aider, opencode, glm).

| Method / Property | Required | Signature |
|-------------------|----------|-----------|
| `name` | Yes | `readonly string` |
| `processName` | Yes | `readonly string` |
| `promptDelivery` | No | `"inline" \| "post-launch"` |
| `getLaunchCommand` | Yes | `(config: AgentLaunchConfig) => string` |
| `getEnvironment` | Yes | `(config: AgentLaunchConfig) => Record<string, string>` |
| `detectActivity` | Yes | `(terminalOutput: string) => ActivityState` |
| `getActivityState` | Yes | `(session: Session, readyThresholdMs?: number) => Promise<ActivityDetection \| null>` |
| `isProcessRunning` | Yes | `(handle: RuntimeHandle) => Promise<boolean>` |
| `getSessionInfo` | Yes | `(session: Session) => Promise<AgentSessionInfo \| null>` |
| `getRestoreCommand` | No | `(session: Session, project: ProjectConfig) => Promise<string \| null>` |
| `postLaunchSetup` | No | `(session: Session) => Promise<void>` |
| `setupWorkspaceHooks` | No | `(workspacePath: string, config: WorkspaceHooksConfig) => Promise<void>` |

### Workspace

Code isolation (worktree, clone).

| Method | Required | Signature |
|--------|----------|-----------|
| `name` | Yes | `readonly string` |
| `create` | Yes | `(config: WorkspaceCreateConfig) => Promise<WorkspaceInfo>` |
| `destroy` | Yes | `(workspacePath: string) => Promise<void>` |
| `list` | Yes | `(projectId: string) => Promise<WorkspaceInfo[]>` |
| `postCreate` | No | `(info: WorkspaceInfo, project: ProjectConfig) => Promise<void>` |
| `exists` | No | `(workspacePath: string) => Promise<boolean>` |
| `restore` | No | `(config: WorkspaceCreateConfig, workspacePath: string) => Promise<WorkspaceInfo>` |

### Tracker

Issue tracking (github, linear, bmad).

| Method | Required | Signature |
|--------|----------|-----------|
| `name` | Yes | `readonly string` |
| `getIssue` | Yes | `(identifier: string, project: ProjectConfig) => Promise<Issue>` |
| `isCompleted` | Yes | `(identifier: string, project: ProjectConfig) => Promise<boolean>` |
| `issueUrl` | Yes | `(identifier: string, project: ProjectConfig) => string` |
| `branchName` | Yes | `(identifier: string, project: ProjectConfig) => string` |
| `generatePrompt` | Yes | `(identifier: string, project: ProjectConfig) => Promise<string>` |
| `issueLabel` | No | `(url: string, project: ProjectConfig) => string` |
| `listIssues` | No | `(filters: IssueFilters, project: ProjectConfig) => Promise<Issue[]>` |
| `updateIssue` | No | `(identifier: string, update: IssueUpdate, project: ProjectConfig) => Promise<void>` |
| `createIssue` | No | `(input: CreateIssueInput, project: ProjectConfig) => Promise<Issue>` |
| `validateIssue` | No | `(identifier: string, project: ProjectConfig) => Promise<IssueValidationResult>` |
| `findIssueByBranch` | No | `(branch: string, project: ProjectConfig) => Promise<string \| null>` |
| `onPRMerge` | No | `(issueId: string, prUrl: string \| undefined, project: ProjectConfig) => Promise<void>` |
| `onSessionDeath` | No | `(issueId: string, project: ProjectConfig, sessionId?: string) => Promise<void>` |
| `getNotifications` | No | `(project: ProjectConfig) => Promise<OrchestratorEvent[]>` |
| `getEpicTitle` | No | `(epicId: string, project: ProjectConfig) => string` |

### SCM

Source control management + PR/CI/reviews (github).

| Method | Required | Signature |
|--------|----------|-----------|
| `name` | Yes | `readonly string` |
| `detectPR` | Yes | `(session: Session, project: ProjectConfig) => Promise<PRInfo \| null>` |
| `getPRState` | Yes | `(pr: PRInfo) => Promise<PRState>` |
| `mergePR` | Yes | `(pr: PRInfo, method?: MergeMethod) => Promise<void>` |
| `closePR` | Yes | `(pr: PRInfo) => Promise<void>` |
| `getCIChecks` | Yes | `(pr: PRInfo) => Promise<CICheck[]>` |
| `getCISummary` | Yes | `(pr: PRInfo) => Promise<CIStatus>` |
| `getReviews` | Yes | `(pr: PRInfo) => Promise<Review[]>` |
| `getReviewDecision` | Yes | `(pr: PRInfo) => Promise<ReviewDecision>` |
| `getPendingComments` | Yes | `(pr: PRInfo) => Promise<ReviewComment[]>` |
| `getAutomatedComments` | Yes | `(pr: PRInfo) => Promise<AutomatedComment[]>` |
| `getMergeability` | Yes | `(pr: PRInfo) => Promise<MergeReadiness>` |
| `getPRSummary` | No | `(pr: PRInfo) => Promise<{ state, title, additions, deletions }>` |

### Notifier

Push notifications (desktop, slack, discord, telegram, webhook, composio).

| Method | Required | Signature |
|--------|----------|-----------|
| `name` | Yes | `readonly string` |
| `notify` | Yes | `(event: OrchestratorEvent) => Promise<void>` |
| `notifyWithActions` | No | `(event: OrchestratorEvent, actions: NotifyAction[]) => Promise<void>` |
| `post` | No | `(message: string, context?: NotifyContext) => Promise<string \| null>` |

### Terminal

Human interaction UI (iterm2, web).

| Method | Required | Signature |
|--------|----------|-----------|
| `name` | Yes | `readonly string` |
| `openSession` | Yes | `(session: Session) => Promise<void>` |
| `openAll` | Yes | `(sessions: Session[]) => Promise<void>` |
| `isSessionOpen` | No | `(session: Session) => Promise<boolean>` |

### Provider (SessionEnhancementProvider)

Session enhancement (raw, omc).

| Method | Required | Signature |
|--------|----------|-----------|
| `name` | Yes | `readonly string` |
| `install` | Yes | `(worktreePath: string, config: ProviderConfig) => Promise<void>` |
| `configure` | Yes | `(worktreePath: string, context: StoryContext) => Promise<void>` |
| `enhance` | Yes | `(session: Session) => Promise<Session>` |
| `teardown` | Yes | `(worktreePath: string) => Promise<void>` |
| `healthCheck` | Yes | `() => Promise<ProviderHealth>` |

---

## Directory Structure

A canonical plugin package looks like this:

```text
packages/plugins/{slot}-{name}/
  src/
    index.ts          — Plugin entry point (manifest + create + default export)
    __tests__/
      index.test.ts   — Unit tests
  package.json        — Package config with @composio/ao-core dependency
  tsconfig.json       — Extends ../../tsconfig.base.json
  vitest.config.ts    — Test configuration (if needed)
```

### package.json

```json
{
  "name": "@composio/ao-plugin-{slot}-{name}",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
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
    "vitest": "^3.0.0"
  }
}
```

{: .note }
> Use `"workspace:*"` for the ao-core dependency — pnpm resolves it to the local workspace package.

### tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

---

## Configuration

Plugins are configured per-slot in `agent-orchestrator.yaml`:

```yaml
# Global plugin config (applies to all projects unless overridden)
plugins:
  notifier:
    name: slack
    config:
      webhookUrl: "${SLACK_WEBHOOK_URL}"
      channel: "#agent-alerts"

  runtime:
    name: tmux
    config: {}

# Per-project override
projects:
  my-backend:
    plugins:
      notifier:
        name: discord  # Override global notifier for this project
        config:
          webhookUrl: "${DISCORD_WEBHOOK_URL}"
```

### Accessing Config in Your Plugin

The `create()` function receives the `config` object from YAML. Validate types explicitly:

```typescript
export function create(config?: Record<string, unknown>): Notifier {
  // Validate required config
  const webhookUrl = config?.webhookUrl;
  if (typeof webhookUrl !== "string" || !webhookUrl.startsWith("https://")) {
    throw new Error("notifier-my-plugin: config.webhookUrl must be a valid HTTPS URL");
  }

  // Optional config with defaults
  const timeout = typeof config?.timeout === "number" ? config.timeout : 30_000;

  return {
    name: "my-plugin",
    async notify(event) {
      // use webhookUrl, timeout...
    },
  };
}
```

{: .warning }
> Never log or expose config values — they may contain secrets (API keys, tokens). Use environment variable references (`${VAR_NAME}`) in YAML instead of literal secrets.

---

## Testing

### Unit Tests

Mock the ao-core types and test your plugin in isolation:

```typescript
import { describe, it, expect, vi } from "vitest";
import { create } from "./index.js";
import type { OrchestratorEvent } from "@composio/ao-core";

describe("notifier-my-plugin", () => {
  it("should send a notification", async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    const notifier = create({ apiUrl: "https://test.example.com" });

    const event: OrchestratorEvent = {
      sessionId: "test-1",
      message: "Build passed",
      priority: "info",
      type: "session.completed",
      timestamp: new Date(),
    };

    await notifier.notify(event);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.example.com",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("should throw on invalid config", () => {
    expect(() => create({ apiUrl: "not-a-url" })).toThrow("must be a valid HTTPS URL");
  });
});
```

### Integration Tests

For plugins that interact with real services, use the integration test aliases pattern from `packages/core/vitest.config.ts`:

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    alias: {
      // Resolve ao-core to source so integration tests import real types
      "@composio/ao-core": resolve(__dirname, "../../core/src/index.ts"),
    },
  },
});
```

See [Testing Guide](testing/) for detailed conventions and patterns.

---

## Security

{: .warning }
> Plugins run in the orchestrator process. Security violations in plugins compromise the entire system.

### Shell Commands — Always execFile

```typescript
// GOOD — no shell injection risk
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
const { stdout } = await execFileAsync("git", ["branch", "--show-current"], {
  timeout: 30_000,
});

// BAD — shell injection risk
exec(`git checkout ${branchName}`);
```

Rules:
- **Always use `execFile` or `spawn`** — never `exec`
- **Always add timeouts** — `{ timeout: 30_000 }` for external commands
- **Never interpolate user input** into command strings
- **Do not use `JSON.stringify` for shell escaping** — it doesn't escape `$`, backticks, or `$()`

### Input Validation

Validate all external data (config, API responses, file contents):

```typescript
// GOOD — validate config
const webhookUrl = config?.webhookUrl;
if (typeof webhookUrl !== "string" || !webhookUrl.startsWith("https://")) {
  throw new Error("Invalid webhookUrl: must be HTTPS string");
}

// BAD — trust external input
const url = config.webhookUrl as string; // crashes if undefined or wrong type
```

### No Secret Logging

Never log config values, API keys, or tokens. Use environment variable references in config:

```yaml
# GOOD — references env var
config:
  apiKey: "${MY_API_KEY}"

# BAD — literal secret in config
config:
  apiKey: "your-api-key-here"
```

---

## Publishing

### Package Naming Convention

Official plugins follow the pattern: `@composio/ao-plugin-{slot}-{name}`

| Slot | Package Name |
|------|-------------|
| Runtime | `@composio/ao-plugin-runtime-tmux` |
| Agent | `@composio/ao-plugin-agent-claude-code` |
| Workspace | `@composio/ao-plugin-workspace-worktree` |
| Tracker | `@composio/ao-plugin-tracker-github` |
| SCM | `@composio/ao-plugin-scm-github` |
| Notifier | `@composio/ao-plugin-notifier-desktop` |
| Terminal | `@composio/ao-plugin-terminal-iterm2` |
| Provider | `@composio/ao-plugin-provider-omc` |

### Changeset Workflow

```bash
# 1. Create a changeset
pnpm changeset
# Select your plugin package, choose "patch" or "minor", write a summary

# 2. Version packages
pnpm version-packages
# This updates package.json versions and writes CHANGELOG.md

# 3. Publish
pnpm release
# Builds and publishes to npm
```

{: .note }
> Community plugins can use any npm scope (e.g., `@my-org/ao-plugin-notifier-msteams`). The `@composio` scope is reserved for official plugins.

---

## Real-World Example: notifier-desktop

The desktop notifier plugin demonstrates all the patterns described above. Read it as a reference:

```text
packages/plugins/notifier-desktop/src/index.ts
```

Key patterns to observe:
- `export default { manifest, create } satisfies PluginModule<Notifier>` — inline satisfies
- `execFile` for osascript/notify-send — no shell injection
- `escapeAppleScript()` for input sanitization — validates external data
- Platform detection with graceful fallback — handles unsupported OS
- Config parsing with defaults: `config?.sound ?? true`

---

- **Parent** — [Contributing](.)
- **Siblings** — [Development Guide](development/), [Testing Guide](testing/)
- **Reference** — [Architecture Overview](../getting-started/architecture-overview/), [SDK & Integration](../sdk/), [Plugin Index](../plugins/)
