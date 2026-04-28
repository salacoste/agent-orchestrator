---
title: Contributing
nav_order: 11
has_children: true
description: How to contribute to the Agent Orchestrator — code of conduct, issue reporting, pull request process, commit conventions, and development setup.
---

# Contributing

Thanks for your interest in contributing to the Agent Orchestrator! This guide covers everything you need to get started.

{: .highlight }
> **Quick setup:** `pnpm install && pnpm build` — then see [Development Guide](development/) for the full walkthrough.

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to:

- Be respectful and inclusive in all interactions
- Provide constructive, actionable feedback
- Focus on what is best for the community
- Show empathy toward other community members

Report unacceptable behavior to the project maintainers.

---

## How to Contribute

There are many ways to contribute:

| Type | Description |
|------|-------------|
| **Bug reports** | File issues for unexpected behavior |
| **Feature requests** | Suggest new capabilities or improvements |
| **Documentation** | Fix typos, add examples, improve guides |
| **Code contributions** | Implement features, fix bugs, add tests |
| **Plugin development** | Build new plugins for any of the 8 plugin slots |
| **Tutorials** | Write walkthroughs and how-to guides |

{: .note }
> Not sure where to start? Look for issues labeled `good first issue` or `help wanted` in the issue tracker.

---

## Reporting Issues

### Bug Reports

Before filing a bug:

1. **Search existing issues** to avoid duplicates
2. **Verify you're on the latest version** — the bug may already be fixed
3. **Gather environment info**: Node.js version (`node -v`), pnpm version (`pnpm -v`), OS

When filing, include:

- **Steps to reproduce** — exact commands and config
- **Expected behavior** — what should happen
- **Actual behavior** — what happened instead
- **Environment** — Node version, OS, agent-orchestrator.yaml (redacted of secrets)
- **Logs** — relevant output from `ao logs` or the web dashboard

### Feature Requests

Describe:

- **The problem** you're trying to solve
- **Proposed solution** — how you'd like it to work
- **Alternatives considered** — other approaches you thought of

---

## Pull Request Process

### Branch Naming

Use descriptive branch names with a prefix:

| Pattern | Example | Use Case |
|---------|---------|----------|
| `story/ID-description` | `story/62-60-contributing-guide` | Feature or story work |
| `fix/description` | `fix/ci-status-detection` | Bug fixes |
| `docs/description` | `docs/sdk-reference-update` | Documentation changes |

### Workflow

```text
1. Fork the repository
2. Create a branch: git checkout -b story/ID-description
3. Make changes and add tests
4. Run checks locally: pnpm lint && pnpm typecheck && pnpm test
5. Commit with a descriptive message
6. Push: git push origin story/ID-description
7. Open a Pull Request against main
```

### Before Submitting

```bash
# Install dependencies (if not done)
pnpm install

# Build all packages
pnpm build

# Run linting
pnpm lint

# Run type checking
pnpm typecheck

# Run tests
pnpm test
```

{: .warning }
> The pre-commit hook scans for secrets using **gitleaks**. If you accidentally stage a secret, the commit will be blocked. Install gitleaks: `brew install gitleaks` (macOS) or see [gitleaks](https://github.com/gitleaks/gitleaks).

### PR Requirements

- All CI checks must pass (lint, typecheck, test)
- New features must include tests
- Bug fixes should include a regression test
- Documentation changes should build cleanly (`pnpm docs:build`)
- No secrets, credentials, or `.env` files in the diff

---

## Commit Conventions

### Commit Messages

Write clear, descriptive commit messages that explain **why** the change was made:

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

### Pre-commit Hooks

The project uses [Husky](https://typicode.github.io/husky/) to manage Git hooks. The pre-commit hook runs:

- **gitleaks** — scans staged files for secrets (API keys, tokens, passwords)

If gitleaks is not installed, the commit is blocked. Install it:

```bash
# macOS
brew install gitleaks

# Linux — see https://github.com/gitleaks/gitleaks#installing
```

If you hit a false positive, add the pattern to `.gitleaks.toml` allowlist rather than skipping the hook.

---

## Code Review

All pull requests require review before merging:

1. **CI must pass** — lint, typecheck, and test checks must all be green
2. **No secrets** — the pre-commit hook catches most cases, but reviewers also check
3. **Test coverage** — new features need tests; bug fixes need regression tests
4. **Documentation** — public API changes should update relevant docs
5. **Security** — uses `execFile` not `exec`, validates external input, no `any` types

Reviewers look for:

- Correctness — does the change do what it claims?
- Edge cases — are error paths handled?
- Security — no injection vulnerabilities
- Performance — no unnecessary allocations or N+1 patterns
- Style — follows existing conventions (see [CLAUDE.md](https://github.com/composio/agent-orchestrator/blob/main/CLAUDE.md))

---

## Development Setup

This is a condensed setup. See [Development Guide](development/) for the full walkthrough.

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (`corepack enable && corepack prepare pnpm@latest --activate`)
- **git**
- **gitleaks** (for pre-commit hook)

### Install and Build

```bash
# Clone the repository
git clone https://github.com/composio/agent-orchestrator.git
cd agent-orchestrator

# Install dependencies
pnpm install

# Build all packages (required before dev server)
pnpm build

# Copy config
cp agent-orchestrator.yaml.example agent-orchestrator.yaml
```

### Development Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Run web dashboard dev server |
| `pnpm lint` | Check code style |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm format` | Format code with Prettier |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm test` | Run unit tests |
| `pnpm docs:dev` | Local docs server (Jekyll) |
| `pnpm docs:build` | Build docs for production |

### Project Structure

The project uses pnpm workspaces with 8 plugin slots. See [Architecture Overview](../getting-started/architecture-overview/) for details.

```text
packages/
  core/          — @composio/ao-core (types, config, services)
  cli/           — @composio/ao-cli (the ao command)
  web/           — @composio/ao-web (Next.js dashboard)
  plugins/
    runtime-{tmux,process}/
    agent-{claude-code,codex,aider,opencode}/
    workspace-{worktree,clone}/
    tracker-{github,linear}/
    scm-github/
    notifier-{desktop,slack,composio,webhook}/
    terminal-{iterm2,web}/
```

Key files to read first:

- `packages/core/src/types.ts` — all plugin interfaces
- `agent-orchestrator.yaml.example` — config format
- `CLAUDE.md` — code conventions and architecture

---

## License

This project is released under the **MIT License**. See the [LICENSE](https://github.com/composio/agent-orchestrator/blob/main/LICENSE) file for details.

By contributing, you agree that your contributions will be licensed under the same MIT License.

---

- **Parent** — [Contributing](.)
- **Children** — [Development Guide](development/), [Plugin Development](plugin-development/), [Testing Guide](testing/)
- **Getting Started** — [Quick Start](../getting-started/quick-start/), [Architecture Overview](../getting-started/architecture-overview/), [Configuration](../getting-started/configuration/)
- **Reference** — [SDK & Integration](../sdk/), [CLI Reference](../cli/)
