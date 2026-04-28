---
title: Development Guide
nav_order: 1
parent: Contributing
description: Set up your development environment for contributing to Agent Orchestrator — install, build, lint, test, and common workflows.
---

# Development Guide

A step-by-step guide to setting up a local development environment for the Agent Orchestrator. Covers prerequisites, install, build, lint, test, code conventions, and git workflow.

{: .highlight }
> **TL;DR:** `pnpm install && pnpm build && cp agent-orchestrator.yaml.example agent-orchestrator.yaml && pnpm dev`

---

## Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org/) or `nvm install 20` |
| **pnpm** | 9+ | `corepack enable && corepack prepare pnpm@latest --activate` |
| **git** | any recent version | [git-scm.com](https://git-scm.com/) |
| **gitleaks** | latest | `brew install gitleaks` (macOS) or see [gitleaks](https://github.com/gitleaks/gitleaks) |

Verify everything is installed:

```bash
node -v    # v20.x or higher
pnpm -v    # 9.x or higher
git --version
gitleaks version
```

{: .note }
> The project uses **pnpm workspaces**. npm and yarn are not supported.

---

## Getting the Code

### Fork and Clone

```bash
# Fork on GitHub, then clone your fork
git clone git@github.com:YOUR_USERNAME/agent-orchestrator.git
cd agent-orchestrator

# Add upstream remote
git remote add upstream git@github.com:composio/agent-orchestrator.git
```

Or with HTTPS:

```bash
git clone https://github.com/YOUR_USERNAME/agent-orchestrator.git
cd agent-orchestrator
git remote add upstream https://github.com/composio/agent-orchestrator.git
```

---

## Install & Build

### Install Dependencies

```bash
pnpm install
```

The `postinstall` script runs `scripts/rebuild-node-pty.js` to compile native modules for your platform. This is normal and expected.

### Build All Packages

```bash
pnpm build
```

{: .warning }
> **Build is required before the dev server.** The web dashboard (`@composio/ao-web`) imports from `@composio/ao-core` and plugin packages. These must be compiled from TypeScript to JavaScript before Next.js can resolve them. Run `pnpm build` every time you pull changes that modify `packages/core` or plugin source.

### Project Structure

The project uses **pnpm workspaces** with two package groups (plus a `!packages/mobile` exclusion):

```text
agent-orchestrator/
  packages/
    core/           — @composio/ao-core (types, config, services)
    cli/            — @composio/ao-cli (the ao command)
    web/            — @composio/ao-web (Next.js 15 dashboard)
    sdk/            — @composio/ao-sdk (SDK client)
    integration-tests/ — cross-package integration tests
    plugins/
      runtime-{tmux,process}/
      agent-{claude-code,codex,aider,opencode,glm}/
      workspace-{worktree,clone}/
      tracker-{github,linear,bmad}/
      scm-github/
      notifier-{desktop,slack,discord,telegram,webhook,composio}/
      terminal-{iterm2,web}/
      provider-{omc,raw}/
      eventbus-redis/
```

---

## Configuration

Copy the example config and adjust for your environment:

```bash
cp agent-orchestrator.yaml.example agent-orchestrator.yaml
```

{: .warning }
> The app expects `agent-orchestrator.yaml` in the working directory. Without it, all API routes fail with "No agent-orchestrator.yaml found". **Never commit this file** — it contains secrets and local paths.

See [Configuration](../getting-started/configuration/) for all config options.

---

## Development Server

Start the web dashboard with hot reload:

```bash
pnpm dev
```

This runs the Next.js dev server for `@composio/ao-web` (typically at `http://localhost:3000`). Changes to web package source files trigger hot reload automatically.

{: .note }
> Changes to `packages/core` or plugin packages require a rebuild: `pnpm build`. Only the web package has live reload.

---

## Linting & Formatting

### ESLint

The project uses **typescript-eslint strict** rules with **eslint-config-prettier** for formatting compatibility.

```bash
# Check for lint errors
pnpm lint

# Auto-fix lint errors
pnpm lint:fix
```

### Prettier

Formatting is enforced by Prettier with these settings:

| Setting | Value |
|---------|-------|
| Semicolons | `true` (always) |
| Quotes | `"double"` |
| Trailing commas | `"all"` |
| Indent | 2 spaces |
| Print width | 100 characters |
| Bracket spacing | `true` (spaces in object literals) |
| Arrow parens | `"always"` |

```bash
# Format all files
pnpm format

# Check formatting (CI mode — no writes)
pnpm format:check
```

---

## Type Checking

The project uses **TypeScript strict mode** with modern ESM configuration:

| Setting | Value | Why |
|---------|-------|-----|
| `target` | ES2022 | Modern JavaScript output |
| `module` | Node16 | ESM module resolution (requires `.js` extensions in imports) |
| `strict` | `true` | All strict checks enabled |
| `verbatimModuleSyntax` | `true` | Enforces `import type` for type-only imports |
| `isolatedModules` | `true` | Each file is a separate module |

```bash
# Type-check all packages
pnpm typecheck
```

---

## Testing

The project uses **vitest** for all testing.

### Test Commands

| Command | What It Runs |
|---------|-------------|
| `pnpm test` | Unit tests across all packages (excludes web) |
| `pnpm test:integration` | Cross-package integration tests |
| `pnpm test:integration:core` | Core package integration tests |
| `pnpm test:redis` | Start Redis Docker container for event bus tests |
| `pnpm test:redis:stop` | Stop and remove Redis container |

### Test File Patterns

- **Co-located**: `src/**/*.test.ts` alongside source files
- **Test directory**: `src/__tests__/*.test.ts` for broader test suites

### Writing Tests

```typescript
import { describe, it, expect } from "vitest";

describe("MyService", () => {
  it("should handle the expected case", () => {
    const result = myFunction("input");
    expect(result).toBe("expected output");
  });
});
```

See [Testing Guide](testing/) for detailed conventions and patterns.

---

## Code Conventions

### ESM Module Rules

Every package uses `"type": "module"` (ESM). Follow these rules strictly:

```typescript
// GOOD — .js extension in local imports (required for ESM with Node16 resolution)
import { foo } from "./bar.js";

// BAD — missing .js extension causes runtime errors
import { foo } from "./bar";

// GOOD — node: prefix for builtins
import { readFileSync } from "node:fs";

// BAD — bare module specifier
import { readFileSync } from "fs";
```

### Type Imports

`verbatimModuleSyntax` requires explicit `import type` for type-only imports:

```typescript
// GOOD — type-only import
import type { Runtime, Session } from "@composio/ao-core";

// GOOD — mixed import (runtime + type)
import { createSession } from "@composio/ao-core";
import type { SessionConfig } from "@composio/ao-core";

// BAD — type imported as runtime value (ESLint error)
import { Runtime } from "@composio/ao-core"; // Runtime is an interface
```

### No `any`

ESLint enforces `no-explicit-any`. Use `unknown` with type guards instead:

```typescript
// GOOD
function handle(data: unknown) {
  if (typeof data === "string") {
    console.log(data.toUpperCase());
  }
}

// BAD — bypasses type safety
function handle(data: any) {
  console.log(data.toUpperCase()); // crashes if data is not a string
}
```

### Shell Command Safety

Always use `execFile` (or `spawn`) — never `exec`:

```typescript
// GOOD — no shell injection risk
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
const { stdout } = await execFileAsync("git", ["branch", "--show-current"], {
  timeout: 30_000,
});

// BAD — shell injection risk
exec(`git checkout ${branchName}`); // branchName could contain "; rm -rf /"
```

- Always add timeouts (`{ timeout: 30_000 }`)
- Never interpolate user input into commands
- Do not use `JSON.stringify` for shell escaping

### Plugin Pattern

Every plugin exports a `PluginModule` with inline `satisfies`:

```typescript
import type { PluginModule, Runtime } from "@composio/ao-core";

export const manifest = {
  name: "tmux",
  slot: "runtime" as const,
  description: "Runtime plugin: tmux sessions",
  version: "0.1.0",
};

export function create(): Runtime {
  return {
    name: "tmux",
    async create(config) { /* ... */ },
    async destroy(handle) { /* ... */ },
  };
}

export default { manifest, create } satisfies PluginModule<Runtime>;
```

Do NOT use `const plugin = { ... }; export default plugin;` — always inline `satisfies`.

See [Plugin Development](plugin-development/) for the full authoring guide.

---

## Git Workflow

### Branch Naming

| Pattern | Example | Use Case |
|---------|---------|----------|
| `story/ID-description` | `story/62-61-development-setup` | Feature or story work |
| `fix/description` | `fix/ci-status-detection` | Bug fixes |
| `docs/description` | `docs/sdk-reference-update` | Documentation changes |

### Commit Messages

Write clear, descriptive messages that explain **why** the change was made:

```text
feat(core): add shared pool allocation algorithm

Implement 4-factor affinity scoring for cross-project agent
assignment with configurable allocation weights.

Co-Authored-By: Contributor Name <email@example.com>
```

Common prefixes:

| Prefix | Use Case |
|--------|----------|
| `feat(scope):` | New feature |
| `fix(scope):` | Bug fix |
| `docs(scope):` | Documentation |
| `refactor(scope):` | Code refactoring |
| `test(scope):` | Test additions or fixes |
| `chore(scope):` | Build, CI, tooling |

### Pre-commit Hook

The project uses [Husky](https://typicode.github.io/husky/) to manage Git hooks. The pre-commit hook runs:

- **gitleaks** — scans staged files for secrets (API keys, tokens, passwords)

If gitleaks is not installed, the commit is blocked:

```bash
# macOS
brew install gitleaks

# Linux — see https://github.com/gitleaks/gitleaks#installing
```

If you hit a false positive, add the pattern to `.gitleaks.toml` rather than skipping the hook.

---

## Debugging Common Issues

### Build Required Before Dev Server

**Symptom:** Next.js fails with "Cannot resolve @composio/ao-core"

**Fix:** Run `pnpm build` to compile all TypeScript packages. The web dashboard imports from core and plugin packages — these must be compiled before the dev server can resolve them.

### Config File Missing

**Symptom:** API routes return "No agent-orchestrator.yaml found"

**Fix:** Copy the example config: `cp agent-orchestrator.yaml.example agent-orchestrator.yaml`

### Gitleaks Blocks Commit

**Symptom:** Pre-commit hook fails with "Secret(s) detected"

**Fix:**
1. Remove the secret from the file
2. Use environment variables instead: `${SECRET_NAME}`
3. Add secrets to `.env.local` (which is in `.gitignore`)
4. If false positive, add the pattern to `.gitleaks.toml` allowlist

### Gitleaks Not Installed

**Symptom:** Pre-commit hook fails with "gitleaks is not installed"

**Fix:** Install gitleaks: `brew install gitleaks` (macOS)

### Worktree Setup

If using git worktrees for parallel agent work:

```bash
cd /path/to/worktree
pnpm install          # Install deps (fresh copy)
pnpm build            # Build packages
cp /path/to/main/agent-orchestrator.yaml .  # Copy config
cd packages/web && pnpm dev  # Start server
```

### Stale Chrome Process (Playwright)

If Playwright was previously used, kill orphaned Chrome for Testing instances:

```bash
pkill -f "Google Chrome for Testing"
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Install dependencies | `pnpm install` |
| Build all packages | `pnpm build` |
| Start dev server | `pnpm dev` |
| Lint check | `pnpm lint` |
| Lint auto-fix | `pnpm lint:fix` |
| Format code | `pnpm format` |
| Check formatting | `pnpm format:check` |
| Type check | `pnpm typecheck` |
| Run unit tests | `pnpm test` |
| Run integration tests | `pnpm test:integration` |
| Run core integration | `pnpm test:integration:core` |
| Start Redis for tests | `pnpm test:redis` |
| Stop Redis | `pnpm test:redis:stop` |
| Clean build artifacts | `pnpm clean` |
| Local docs server | `pnpm docs:dev` |
| Build docs | `pnpm docs:build` |

---

- **Parent** — [Contributing](.)
- **Siblings** — [Plugin Development](plugin-development/), [Testing Guide](testing/)
- **Getting Started** — [Quick Start](../getting-started/quick-start/), [Architecture Overview](../getting-started/architecture-overview/), [Configuration](../getting-started/configuration/)
- **Reference** — [SDK & Integration](../sdk/), [CLI Reference](../cli/)
