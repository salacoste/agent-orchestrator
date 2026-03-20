# Development Guide

Comprehensive guide for developing Agent Orchestrator — an open-source system for orchestrating parallel AI coding agents.

This guide consolidates and supersedes [DEVELOPMENT.md](./DEVELOPMENT.md) and [SETUP-GUIDE.md](./SETUP-GUIDE.md).

---

## 1. Prerequisites

| Requirement | Version | Check Command | Install (macOS) |
|-------------|---------|---------------|-----------------|
| Node.js | 20+ | `node --version` | `brew install node` |
| pnpm | 9.15.4+ | `pnpm --version` | `corepack enable && corepack prepare pnpm@latest --activate` |
| Git | 2.25+ | `git --version` | `brew install git` |
| tmux | any | `tmux -V` | `brew install tmux` |
| GitHub CLI | 2.0+ | `gh --version` | `brew install gh` |
| gitleaks | any | `gitleaks version` | `brew install gitleaks` |

**Linux (Ubuntu/Debian):**

```bash
sudo apt install tmux
# gh: https://github.com/cli/cli/blob/trunk/docs/install_linux.md
# pnpm: corepack enable && corepack prepare pnpm@latest --activate
```

**Authenticate GitHub CLI:**

```bash
gh auth login
# Select: GitHub.com -> HTTPS -> Authenticate with browser
gh auth status  # Verify
```

---

## 2. Quick Start

```bash
# Clone
git clone https://github.com/ComposioHQ/agent-orchestrator.git
cd agent-orchestrator

# Install dependencies
pnpm install

# Build all packages (required before running anything)
pnpm build

# Copy and edit config
cp agent-orchestrator.yaml.example agent-orchestrator.yaml
$EDITOR agent-orchestrator.yaml

# Start the web dashboard
cd packages/web
pnpm dev
# Open http://localhost:5000

# Or link the CLI globally
npm link -g packages/cli
ao --version
```

**Why build first?** The web package and CLI import from `@composio/ao-core` and plugin packages. These must be compiled (TypeScript to JavaScript) before they can be resolved at runtime.

**Config requirement:** The app expects `agent-orchestrator.yaml` in the working directory. Without it, all API routes fail with "No agent-orchestrator.yaml found".

---

## 3. Project Structure

```
agent-orchestrator/
├── packages/
│   ├── core/                  # @composio/ao-core — types, config, services
│   ├── cli/                   # @composio/ao-cli — the `ao` command (Commander.js)
│   ├── web/                   # @composio/ao-web — Next.js 15 dashboard
│   │   └── src/
│   │       ├── app/           # App Router (pages, API routes, layouts)
│   │       ├── components/    # React components
│   │       ├── hooks/         # Custom React hooks
│   │       └── lib/           # Shared utilities
│   ├── plugin-api/            # @composio/ao-plugin-api — stable plugin development types
│   ├── integration-tests/     # Cross-package integration tests
│   └── plugins/
│       ├── runtime-tmux/      # Runtime: tmux sessions
│       ├── runtime-process/   # Runtime: child processes
│       ├── agent-claude-code/ # Agent: Claude Code
│       ├── agent-codex/       # Agent: OpenAI Codex
│       ├── agent-aider/       # Agent: Aider
│       ├── agent-opencode/    # Agent: OpenCode
│       ├── agent-glm/         # Agent: GLM
│       ├── workspace-worktree/# Workspace: git worktrees
│       ├── workspace-clone/   # Workspace: git clone
│       ├── tracker-github/    # Tracker: GitHub Issues
│       ├── tracker-linear/    # Tracker: Linear
│       ├── tracker-bmad/      # Tracker: BMad file-based
│       ├── scm-github/        # SCM: GitHub PRs/CI
│       ├── notifier-desktop/  # Notifier: OS notifications
│       ├── notifier-slack/    # Notifier: Slack webhooks
│       ├── notifier-webhook/  # Notifier: generic webhooks
│       ├── notifier-composio/ # Notifier: Composio
│       ├── event-bus-redis/   # Event bus: Redis pub/sub
│       ├── terminal-iterm2/   # Terminal: iTerm2 tabs
│       └── terminal-web/      # Terminal: browser-based
├── agent-orchestrator.yaml.example  # Config template
├── tsconfig.base.json         # Shared TypeScript config
├── eslint.config.js           # ESLint flat config
├── pnpm-workspace.yaml        # Workspace definitions
├── .gitleaks.toml             # Secret scanning config
├── .husky/                    # Git hooks (secret scanning)
└── docs/                      # Documentation
```

### Package Roles

| Package | npm Name | Purpose |
|---------|----------|---------|
| `core` | `@composio/ao-core` | All interfaces (`types.ts`), config loading (Zod), session manager, lifecycle manager, event bus, AI intelligence services |
| `cli` | `@composio/ao-cli` | The `ao` command — spawns agents, monitors sessions, manages sprints, AI insights |
| `web` | `@composio/ao-web` | Next.js 15 dashboard with SSE real-time updates, terminal embedding, learning insights |
| `plugin-api` | `@composio/ao-plugin-api` | Stable plugin development API — type definitions for Plugin, PluginContext, Event, Story, Agent, Trigger |
| plugins | `@composio/ao-plugin-{slot}-{name}` | Swappable implementations for each of the 8 plugin slots |

### Plugin Slots (8 total)

| Slot | Interface | Default | Purpose |
|------|-----------|---------|---------|
| Runtime | `Runtime` | tmux | Where sessions execute |
| Agent | `Agent` | claude-code | AI tool adapter |
| Workspace | `Workspace` | worktree | Code isolation |
| Tracker | `Tracker` | github | Issue/task tracking |
| SCM | `SCM` | github | PR/CI/review management |
| Notifier | `Notifier` | desktop | Push notifications |
| Terminal | `Terminal` | iterm2 | Human session attachment |
| EventBus | `EventBus` | (in-memory) | Distributed event pub/sub |

Lifecycle is handled by core (`lifecycle-manager.ts`) and is not pluggable.

---

## 4. Build System

### pnpm Workspaces

The monorepo uses pnpm workspaces defined in `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "packages/plugins/*"
  - "!packages/mobile"
```

Internal dependencies use `workspace:*` protocol:

```json
{
  "dependencies": {
    "@composio/ao-core": "workspace:*"
  }
}
```

### Build Order

`pnpm build` runs `pnpm -r build` which respects the dependency graph:

1. `@composio/ao-core` builds first (all other packages depend on it)
2. `@composio/ao-plugin-api` builds next (depends only on core types)
3. Plugin packages build in parallel (each depends only on core)
4. `@composio/ao-cli` and `@composio/ao-web` build last (depend on core + plugins)

To build a single package:

```bash
pnpm --filter @composio/ao-core build
pnpm --filter @composio/ao-plugin-runtime-tmux build
```

### TypeScript Configuration

**Base config** (`tsconfig.base.json`) — shared by all packages:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

**Per-package config** — extends the base:

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

Plugin tsconfigs use `"extends": "../../../tsconfig.base.json"` (one level deeper).

### Changesets

The project uses `@changesets/cli` for versioning and publishing:

```bash
pnpm changeset          # Create a changeset
pnpm version-packages   # Apply changesets to package versions
pnpm release            # Build and publish
```

---

## 5. Development Workflow

### Making Changes

1. **Create a feature branch:**

   ```bash
   git checkout -b feat/your-feature
   ```

2. **Make changes** following [CLAUDE.md](../CLAUDE.md) conventions.

3. **Build and validate:**

   ```bash
   pnpm build
   pnpm test
   pnpm lint
   pnpm typecheck
   ```

4. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):

   ```bash
   git add <files>
   git commit -m "feat: add your feature"
   ```

   The pre-commit hook automatically scans for secrets.

5. **Push and open a PR:**

   ```bash
   git push origin feat/your-feature
   ```

### Running the Dev Server

The web dashboard runs three processes concurrently:

```bash
cd packages/web
pnpm dev
# Starts: Next.js dev server + terminal WebSocket server + direct terminal WS server
```

Individual processes can be run separately:

```bash
pnpm dev:next              # Next.js only (port 5000)
pnpm dev:terminal          # Terminal WebSocket server
pnpm dev:direct-terminal   # Direct terminal WebSocket server
```

**Terminal server ports** (configurable via env vars):

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 5000 | Next.js dev server |
| `TERMINAL_PORT` / `NEXT_PUBLIC_TERMINAL_PORT` | 5080 | Terminal WebSocket |
| `DIRECT_TERMINAL_PORT` / `NEXT_PUBLIC_DIRECT_TERMINAL_PORT` | 5081 | Direct terminal WebSocket |

### Working with Worktrees

Git worktrees are common for parallel agent work:

```bash
# Create worktree
git worktree add ../ao-feature-x feat/feature-x
cd ../ao-feature-x

# Set up the worktree
pnpm install
pnpm build
cp ../agent-orchestrator/agent-orchestrator.yaml .

# Start dev server
cd packages/web
pnpm dev
```

### Environment Variables

**Development (not secret):**

```bash
TERMINAL_PORT=5080
DIRECT_TERMINAL_PORT=5081
NEXT_PUBLIC_TERMINAL_PORT=5080
NEXT_PUBLIC_DIRECT_TERMINAL_PORT=5081
```

**User secrets (never commit):**

```bash
GITHUB_TOKEN=ghp_...
LINEAR_API_KEY=lin_api_...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
ANTHROPIC_API_KEY=sk-ant-api03-...
COMPOSIO_API_KEY=...
```

Store secrets in `.env.local` (gitignored):

```bash
echo 'GITHUB_TOKEN=ghp_...' >> .env.local
```

---

## 6. Testing

### Framework

The project uses [vitest](https://vitest.dev/) for all testing. Each package has its own test configuration.

### Running Tests

```bash
# All tests (excludes web package)
pnpm test

# Specific package
pnpm --filter @composio/ao-core test

# Watch mode
pnpm --filter @composio/ao-core test -- --watch

# Integration tests
pnpm test:integration

# Core integration tests
pnpm test:integration:core

# Performance tests (core)
pnpm --filter @composio/ao-core test:performance
```

### Redis-dependent Tests

Some integration tests require Redis:

```bash
pnpm test:redis           # Start Redis container
pnpm test:integration     # Run tests
pnpm test:redis:stop      # Stop and remove container
```

### Test Conventions

See [TESTING-CONVENTIONS.md](./TESTING-CONVENTIONS.md) for the full reference. Key patterns:

**Mock factories with `vi.hoisted()`:**

```typescript
const { mockReaddir } = vi.hoisted(() => ({
  mockReaddir: vi.fn(async () => []),
}));

vi.mock("node:fs/promises", () => ({
  default: { readdir: mockReaddir },
  readdir: mockReaddir,
}));

import { myFunction } from "./my-module.js";
```

**Singleton reset for test isolation:**

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  lkgCache._resetForTesting();
});
```

**Environment-dependent tests with `describe.skipIf()`:**

```typescript
describe.skipIf(!hasTmux)("tmux integration", () => {
  // Tests that require tmux installed
});
```

**Real assertions only** -- never `expect(true).toBe(true)`. Every test must verify actual behavior.

**Test file naming:** `*.test.ts`, co-located with source or in `__tests__/`.

---

## 7. Code Standards

### ESM Modules

All packages use `"type": "module"`. This requires:

- **`.js` extensions in imports:** `import { foo } from "./bar.js"` (TypeScript compiles `.ts` to `.js`)
- **`node:` prefix for builtins:** `import { readFileSync } from "node:fs"`
- **`import type` for type-only imports:** `import type { Runtime } from "@composio/ao-core"`

### TypeScript Strict Mode

- `"strict": true` in all tsconfigs
- **No `any`** -- use `unknown` + type guards (ESLint error)
- **No unsafe casts** -- `as unknown as T` bypasses type safety; validate instead
- **`verbatimModuleSyntax`: true** -- enforces explicit `import type`

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | `kebab-case.ts` | `plugin-registry.ts` |
| Types/Interfaces | `PascalCase` | `RuntimeHandle` |
| Functions/variables | `camelCase` | `getAttachInfo` |
| Constants | `UPPER_SNAKE_CASE` | `SAFE_SESSION_ID` |
| Test files | `*.test.ts` | `session-manager.test.ts` |
| Plugin packages | `@composio/ao-plugin-{slot}-{name}` | `@composio/ao-plugin-runtime-tmux` |

### Formatting

Enforced by Prettier: semicolons, double quotes, 2-space indent.

```bash
pnpm format         # Auto-format
pnpm format:check   # Check (CI)
```

### Linting

ESLint flat config with TypeScript strict rules:

```bash
pnpm lint           # Check
pnpm lint:fix       # Auto-fix
```

Key lint rules:
- `no-eval`, `no-implied-eval`, `no-new-func` -- security
- `@typescript-eslint/no-explicit-any` -- error
- `@typescript-eslint/consistent-type-imports` -- enforced
- `no-console` -- warn (relaxed for CLI, web, and test files)

### Shell Command Execution (Security Critical)

**Always use `execFile`** (or `spawn`), never `exec`:

```typescript
// GOOD
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
const { stdout } = await execFileAsync("git", ["branch", "--show-current"], {
  timeout: 30_000,
});

// BAD -- shell injection vulnerability
exec(`git checkout ${branchName}`);
```

Rules:
- Always add timeouts: `{ timeout: 30_000 }`
- Never interpolate user input into command strings
- Never use `JSON.stringify` for shell escaping

### Error Handling

- Throw typed errors, not error codes
- Always wrap `JSON.parse` in try/catch
- Guard external data with validation (Zod, type guards)
- Plugins throw on failure; core services catch and handle

---

## 8. Plugin Development

Every plugin exports a `PluginModule` with three parts: manifest, create function, and a `satisfies` type check.

### Minimal Plugin Template

```typescript
import type { PluginModule, Runtime } from "@composio/ao-core";

// 1. Manifest -- plugin metadata
export const manifest = {
  name: "my-runtime",
  slot: "runtime" as const,        // as const is required
  description: "Runtime plugin: my custom runtime",
  version: "0.1.0",
};

// 2. Create function -- returns the interface implementation
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
- Always use `satisfies PluginModule<T>` inline -- never `const plugin = {...}; export default plugin`
- Never use `as unknown as T` casts
- `manifest.slot` must use `as const` for literal type narrowing

### Package Setup

**Directory:** `packages/plugins/{slot}-{name}/`

**package.json:**

```json
{
  "name": "@composio/ao-plugin-{slot}-{name}",
  "version": "0.1.0",
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
  "engines": { "node": ">=20.0.0" },
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
    "vitest": "^3.0.0"  // note: core uses ^4.0.18, plugins use ^3.0.0
  }
}
```

**tsconfig.json:**

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

### Registration

**Built-in plugins (in monorepo):**

1. Create `packages/plugins/{slot}-{name}/`
2. The `packages/plugins/*` glob in `pnpm-workspace.yaml` auto-includes it
3. Add to `BUILTIN_PLUGINS` in `packages/core/src/plugin-registry.ts`
4. Add as dependency in `packages/cli/package.json` and/or `packages/web/package.json`

**External plugins (npm):**

```bash
ao plugins install @your-org/ao-plugin-runtime-docker
```

### Available Interfaces

All interfaces are defined in `packages/core/src/types.ts`. Key ones:

- **Runtime** -- session execution (create, destroy, sendMessage, getOutput, isAlive)
- **Agent** -- AI tool adapter (getLaunchCommand, getEnvironment, detectActivity, getSessionInfo)
- **Workspace** -- code isolation (create, destroy, list)
- **Tracker** -- issue tracking (getIssue, generatePrompt, branchName)
- **SCM** -- PR/CI lifecycle (detectPR, getPRState, getCIChecks, getReviews, mergePR)
- **Notifier** -- push notifications (notify)
- **Terminal** -- human attachment (openSession)

See [PLUGIN-DEVELOPMENT.md](./PLUGIN-DEVELOPMENT.md) for complete interface definitions with examples.

### Complexity Reference

| Level | Example Plugin | Lines | Notes |
|-------|---------------|-------|-------|
| Minimal | terminal-web | ~50 | Stateless, no external commands |
| Simple | notifier-desktop | ~80 | Single OS command |
| Moderate | runtime-tmux | ~200 | Session lifecycle, command handling |
| Complex | agent-claude-code | ~900 | JSONL introspection, hook scripts, caching |

---

## 9. CLI Development

The CLI (`packages/cli`) uses [Commander.js](https://github.com/tj/commander.js) and is the `ao` command.

### Structure

```
packages/cli/src/
  index.ts              # Entry point, registers all commands
  commands/
    spawn.ts            # ao spawn <project> <issue>
    status.ts           # ao status
    session.ts          # ao session ls|kill|...
    init.ts             # ao init [--auto]
    start.ts            # ao start / ao stop
    fleet.ts            # ao fleet (monitoring table)
    health.ts           # ao health (system health + DLQ depth)
    send.ts             # ao send <session> <message>
    agent-history.ts    # ao agent-history [agent-id] (learning history)
    learning-patterns.ts # ao learning-patterns (failure pattern detection)
    assign-suggest.ts   # ao assign-suggest <story-id> (optimal assignment)
    assign-next.ts      # ao assign-next (auto-pick next story)
    review-stats.ts     # ao review-stats (review analytics)
    collab-graph.ts     # ao collab-graph (agent dependency graph)
    ... (~66 command files)
```

### Adding a New Command

1. **Create the command file** at `packages/cli/src/commands/my-command.ts`:

   ```typescript
   import type { Command } from "commander";
   import { loadConfig } from "@composio/ao-core";

   export function registerMyCommand(program: Command): void {
     program
       .command("my-command <arg>")
       .description("Does something useful")
       .option("-f, --flag <value>", "An option")
       .action(async (arg: string, opts: { flag?: string }) => {
         const config = loadConfig(); // synchronous — readFileSync + Zod parse
         // Implementation
       });
   }
   ```

2. **Register it** in `packages/cli/src/index.ts`:

   ```typescript
   import { registerMyCommand } from "./commands/my-command.js";
   // ...
   registerMyCommand(program);
   ```

3. **Build and test:**

   ```bash
   pnpm --filter @composio/ao-cli build
   ao my-command test-arg
   ```

### CLI Dependencies

The CLI depends on all plugin packages (for plugin loading) plus user-facing libraries:
- `commander` -- argument parsing
- `chalk` -- colored output
- `ora` -- spinners
- `cli-table3` -- table formatting
- `@inquirer/prompts` -- interactive prompts

---

## 10. Web Dashboard Development

The dashboard (`packages/web`) is a Next.js 15 app using the App Router.

### Structure

```
packages/web/src/
  app/
    layout.tsx            # Root layout
    page.tsx              # Home page
    globals.css           # Tailwind CSS
    api/
      sessions/           # Session API routes
      spawn/              # Spawn API routes
      workflow/           # Workflow API routes
      events/             # SSE event streams
      health/             # System health endpoint (Cycle 3)
      learning/           # Learning insights endpoint (Cycle 3)
      ...
    sessions/             # Session pages
    fleet/                # Fleet monitoring page
    workflow/             # Workflow dashboard page
    settings/             # Settings pages
  components/
    FleetMatrix.tsx           # Fleet monitoring matrix (Cycle 3)
    LearningInsightsPanel.tsx # AI learning insights panel (Cycle 3)
    AgentSessionCard.tsx      # Agent session cards
    WorkflowDashboard.tsx     # Workflow dashboard
    ...
  hooks/                  # Custom React hooks
  lib/                    # Utilities
  __tests__/              # Component tests
server/
  terminal-websocket.ts   # xterm.js WebSocket proxy
  direct-terminal-ws.ts   # Direct terminal WebSocket
```

### Key Patterns

**API routes** are Next.js Route Handlers:

```typescript
// app/api/sessions/route.ts
import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";

export async function GET() {
  const { config, sessionManager } = await getServices();
  // getServices() is a lazy singleton — loads config, creates plugin registry,
  // creates session manager once, caches in globalThis
  const sessions = await sessionManager.list();
  return NextResponse.json({ sessions });
}
```

**Real-time updates** use Server-Sent Events (SSE) -- the client subscribes to `/api/events` and receives live session state changes.

**Styling** uses Tailwind CSS v4.

**Component testing** uses `@testing-library/react` with vitest and jsdom.

### Running the Dashboard

```bash
# Build dependencies first (required)
pnpm build

# Ensure config exists
cp agent-orchestrator.yaml.example agent-orchestrator.yaml

# Start all three servers
cd packages/web
pnpm dev
```

### Web-specific Commands

```bash
pnpm --filter @composio/ao-web dev          # Dev server
pnpm --filter @composio/ao-web build        # Production build
pnpm --filter @composio/ao-web test         # Run tests
pnpm --filter @composio/ao-web typecheck    # Type check
pnpm --filter @composio/ao-web screenshot   # E2E screenshots (requires Playwright)
```

---

## 11. AI Intelligence Layer (Cycle 3)

Cycle 3 introduced an AI intelligence layer in `@composio/ao-core` that learns from agent sessions to improve future performance.

### Core Services

All services live in `packages/core/src/`:

| Service | File | Purpose |
|---------|------|---------|
| Session Learning | `session-learning.ts` | Captures structured outcome records (duration, files modified, domain tags, error categories) when agents complete stories |
| Learning Store | `learning-store.ts` | Persistent append-only JSONL storage (`learnings.jsonl`) with file rotation (10MB default) and retention (90 days) |
| Learning Patterns | `learning-patterns.ts` | Detects recurring failure patterns (3+ occurrences) across sessions and suggests remediation actions |
| Assignment Scorer | `assignment-scorer.ts` | Scores agent-story affinity: `score = (successRate * 0.4) + (domainMatch * 0.3) + (speedFactor * 0.2) + (retryPenalty * -0.1)` |
| Assignment Service | `assignment-service.ts` | Orchestrates story selection and agent assignment using scorer + dependency resolver |
| Collaboration Service | `collaboration-service.ts` | Multi-agent coordination: dependency-aware scheduling, cross-agent context sharing, handoff protocol, file conflict detection |
| Dependency Resolver | `dependency-resolver.ts` | Event-driven story dependency resolution with diamond dependency support and circular dependency detection |
| Review Findings Store | `review-findings-store.ts` | JSONL storage for structured code review findings with query and analytics |

### CLI Commands

| Command | Description |
|---------|-------------|
| `ao agent-history [agent-id]` | View agent learning history and session outcomes |
| `ao learning-patterns` | Detect and display recurring failure patterns |
| `ao assign-suggest <story-id>` | Recommend optimal agent assignment based on affinity scoring |
| `ao assign-next` | Auto-select next story and assign best-fit agent |
| `ao review-stats` | View code review analytics from stored findings |
| `ao collab-graph` | Visualize agent collaboration graph and story dependencies |
| `ao health` | System health check including DLQ depth and service status |

All commands support `--json` for machine-readable output.

### Usage Examples

```bash
# View what an agent learned from past sessions
ao agent-history agent-1

# See recurring failure patterns across all agents
ao learning-patterns

# Get scored agent recommendations for a story
ao assign-suggest 3-2-api-authentication
# Output: ranked agents with affinity scores and reasoning

# Auto-assign the next ready story to the best-fit agent
ao assign-next

# View code review analytics (common issues, resolution rates)
ao review-stats

# Visualize agent collaboration and story dependency chains
ao collab-graph

# System health check with DLQ depth
ao health
```

### Web Dashboard Components

| Component | File | Purpose |
|-----------|------|---------|
| `LearningInsightsPanel` | `components/LearningInsightsPanel.tsx` | Dashboard panel showing session success rates, failure patterns, and learning trends |
| `FleetMatrix` | `components/FleetMatrix.tsx` | Fleet monitoring matrix with agent status overview |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/learning` | GET | Learning insights summary (session counts, success rate, top patterns) |
| `/api/health` | GET | System health check (component status, DLQ depth, latency) |

Both endpoints follow the WD-FR31 pattern: always return HTTP 200 with status in the response body.

### Plugin API Package

The `@composio/ao-plugin-api` package (`packages/plugin-api/`) provides stable type definitions for external plugin development:

```typescript
import type { Plugin, PluginContext, Event, Story, Agent, Trigger } from "@composio/ao-plugin-api";

export function create(context: PluginContext): Plugin {
  return {
    name: "my-plugin",
    version: "1.0.0",
    async init() { /* ... */ },
    async onEvent(event) { /* ... */ },
    async shutdown() { /* ... */ },
  };
}
```

Key interfaces exported:
- `Plugin` -- name, version, init(), onEvent(), shutdown()
- `PluginContext` -- logger, config, events, state, agents
- `Event` -- id, type, timestamp, data
- `Story` -- id, title, status, acceptanceCriteria, tasks
- `Agent` -- id, storyId, status, startTime
- `Trigger` -- id, type (event/schedule/manual), condition, action

---

## 12. Common Commands

### Quick Reference

```bash
# Setup
pnpm install                    # Install all dependencies
pnpm build                      # Build all packages
pnpm clean                      # Remove all dist/ directories

# Quality checks
pnpm lint                       # ESLint check
pnpm lint:fix                   # ESLint auto-fix
pnpm format                     # Prettier format
pnpm format:check               # Prettier check (CI)
pnpm typecheck                  # TypeScript check all packages

# Testing
pnpm test                       # Run all tests
pnpm --filter <pkg> test        # Run tests for one package
pnpm --filter <pkg> test -- --watch  # Watch mode
pnpm test:integration           # Integration tests
pnpm test:integration:core      # Core integration tests

# Development
pnpm dev                        # Start web dashboard (from root)
cd packages/web && pnpm dev     # Start web dashboard (explicit)
cd packages/cli && pnpm dev     # Run CLI in dev mode (tsx)

# Per-package builds
pnpm --filter @composio/ao-core build
pnpm --filter @composio/ao-plugin-runtime-tmux build
pnpm --filter @composio/ao-cli build

# Release
pnpm changeset                  # Create a changeset
pnpm version-packages           # Apply changeset versions
pnpm release                    # Build and publish

# Pre-commit checklist
pnpm lint && pnpm typecheck && pnpm test
```

### Filtering Syntax

pnpm's `--filter` flag targets specific packages:

```bash
pnpm --filter @composio/ao-core <command>           # By package name
pnpm --filter "./packages/plugins/*" <command>       # By path glob
pnpm --filter "!@composio/ao-web" <command>          # Exclude a package
```

---

## 13. Troubleshooting

### Build Failures

**Symptom:** TypeScript compilation errors or missing modules.

```bash
pnpm clean && pnpm install && pnpm build
```

If a specific package fails, build its dependencies first:

```bash
pnpm --filter @composio/ao-core build
pnpm --filter @composio/ao-plugin-runtime-tmux build
```

### Web Dashboard 404s / API Errors

**Symptom:** "No agent-orchestrator.yaml found" or API routes returning errors.

```bash
cp agent-orchestrator.yaml.example agent-orchestrator.yaml
```

The config file must be in the working directory where you run `pnpm dev`.

### ESM Import Errors

**Symptom:** `ERR_MODULE_NOT_FOUND` or `Cannot find module`.

All local imports must include the `.js` extension:

```typescript
// Correct
import { foo } from "./bar.js";

// Wrong -- will fail at runtime
import { foo } from "./bar";
```

Verify `"type": "module"` is in the package's `package.json`.

### node-pty Build Errors

**Symptom:** `node-pty` fails to compile during `pnpm install`.

The `postinstall` script runs `scripts/rebuild-node-pty.js`. If it fails:

```bash
# macOS: ensure Xcode command line tools are installed
xcode-select --install

# Rebuild manually
cd packages/web
npx node-gyp rebuild
```

### Permission Errors in Tests

**Symptom:** Tests fail requiring `tmux` or other system tools.

```bash
# macOS
brew install tmux gitleaks

# Ubuntu
sudo apt install tmux
```

### Port Conflicts

**Symptom:** `EADDRINUSE` when starting the dev server.

```bash
# Find and kill process on port 5000
lsof -ti:5000 | xargs kill

# Or use a different port
PORT=5001 pnpm dev
```

Override terminal server ports via environment variables or config:

```yaml
terminalPort: 5082
directTerminalPort: 5083
```

### Pre-commit Hook Blocks Commit

**Symptom:** gitleaks detects a secret in staged files.

1. Verify it is actually a false positive (not a real secret)
2. If false positive, update `.gitleaks.toml` allowlist:

   ```toml
   [allowlist]
   regexes = [
     '''your-pattern-here''',
   ]
   ```

3. Commit `.gitleaks.toml` first, then retry your commit

To test locally:

```bash
gitleaks detect --no-git        # Scan current files
gitleaks protect --staged       # Scan staged files (same as pre-commit)
```

### Stale Playwright / Chrome Processes

**Symptom:** Playwright fails with "Opening in existing browser session".

```bash
pkill -f "Google Chrome for Testing"
```

### Worktree Issues

**Symptom:** Conflicts or missing files in git worktrees.

```bash
git worktree list               # Check existing worktrees
git worktree prune              # Clean up stale entries
```

After creating a new worktree, always run:

```bash
pnpm install && pnpm build
```

---

## Key Files to Read First

1. `packages/core/src/types.ts` -- all plugin interfaces (~2800 lines)
2. `agent-orchestrator.yaml.example` -- config format and options
3. `CLAUDE.md` -- code conventions and architecture overview
4. `packages/plugins/runtime-tmux/src/index.ts` -- clean Runtime plugin example
5. `packages/plugins/tracker-github/src/index.ts` -- clean Tracker plugin example
6. `packages/plugin-api/src/index.ts` -- plugin API type definitions (Plugin, PluginContext, Event, Story, Agent, Trigger)
7. `packages/core/src/session-learning.ts` -- AI intelligence entry point (session outcome capture)
8. `docs/PLUGIN-DEVELOPMENT.md` -- full interface reference with example implementations
9. `docs/TESTING-CONVENTIONS.md` -- vitest patterns and test standards

---

## Further Reading

- [PLUGIN-DEVELOPMENT.md](./PLUGIN-DEVELOPMENT.md) -- writing custom plugins with full interface specs
- [TESTING-CONVENTIONS.md](./TESTING-CONVENTIONS.md) -- vitest patterns, mock strategies, test precision standards
- [SCALING-STRATEGIES.md](./SCALING-STRATEGIES.md) -- handling many concurrent agents
- [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md) -- connecting Linear, Slack, webhooks
- [SECURITY-AUDIT-SUMMARY.md](./SECURITY-AUDIT-SUMMARY.md) -- security practices
- [architecture.md](./architecture.md) -- system architecture deep dive
