# Story 62.60: Contributing Guide

Status: done

## Story

As a developer who wants to contribute to the Agent Orchestrator,
I want a comprehensive contributing guide that documents the code of conduct, PR process, issue templates, and development setup,
so that I can effectively participate in the project and follow established conventions.

## Acceptance Criteria

1. **Contributing Guide page** (`docs/contributing/index.md`) replaces stub with comprehensive content, using Just the Docs front matter: `title: Contributing`, `nav_order: 11`, `has_children: true`, `description` field
2. **Code of Conduct section** references the Contributor Covenant Code of Conduct with link — summary of expectations (be respectful, constructive, inclusive)
3. **How to Contribute section** documents ways to contribute: bug reports, feature requests, documentation improvements, code contributions, plugin development — with links to issue tracker
4. **Issue Reporting section** documents how to report bugs (search existing, use issue template, include reproduction steps, expected vs actual behavior, environment info)
5. **Pull Request Process section** documents the PR workflow: fork → branch → develop → test → lint → commit → push → PR — with branch naming conventions (`story/ID-description`, `fix/description`, `docs/description`)
6. **Commit Conventions section** documents commit message format, husky pre-commit hooks (gitleaks secret scanning), what the pre-commit hook checks
7. **Code Review section** documents review expectations: all PRs require review, CI must pass, no secrets in code, test coverage for new features
8. **Development Setup section** provides condensed setup instructions with links to Development Guide child page — prerequisites (Node 20+, pnpm 9+, git), install/build/test/lint commands
9. **Project Structure section** provides condensed architecture overview with links to Architecture Overview — packages layout, 8 plugin slots, key files
10. **License section** notes MIT license with brief description and link to LICENSE file
11. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
12. **Cross-links** verified: links to Development Guide, Plugin Development, Testing Guide, Architecture Overview, Quick Start, SDK & Integration
13. **Front matter** includes `description` field
14. **Callouts** use Just the Docs callout syntax (`{: .highlight }` for highlight, `{: .note}` for notes, `{: .warning}` for warnings)

## Tasks / Subtasks

- [x] Task 1: Write Contributing Guide (AC: #1-14)
  - [x] Replace stub content in docs/contributing/index.md
  - [x] Write front matter (title, nav_order: 11, has_children: true, description) (AC #1, #13)
  - [x] Write "Code of Conduct" section — Contributor Covenant summary (AC #2)
  - [x] Write "How to Contribute" section — ways to contribute (AC #3)
  - [x] Write "Reporting Issues" section — bug reports, feature requests (AC #4)
  - [x] Write "Pull Request Process" section — fork, branch, develop, PR workflow (AC #5)
  - [x] Write "Commit Conventions" section — commit format, husky hooks, gitleaks (AC #6)
  - [x] Write "Code Review" section — review expectations (AC #7)
  - [x] Write "Development Setup" section — condensed setup with links (AC #8)
  - [x] Write "Project Structure" section — condensed architecture with links (AC #9)
  - [x] Write "License" section — MIT license note (AC #10)
  - [x] Verify no hero font classes (AC #11)
  - [x] Verify cross-links resolve (AC #12)
  - [x] Verify callouts use Just the Docs syntax (AC #14)

## Task Completion Validation

**Task Completion Criteria:**
- All subtasks checked off
- `docs/contributing/index.md` exists with comprehensive content replacing stub
- Every AC maps to at least one documentation section
- All commands match actual CLI command syntax from package.json
- Cross-links resolve to existing pages
- No hero font classes used

## Dev Notes

### Architecture Patterns (from Story 62-48 through 62-59 learnings)

- Just the Docs front matter MUST include `description` field (current stub lacks it)
- No hero font classes (`.fs-5`, `.fw-300`) allowed
- All code blocks must use correct syntax highlighting
- This is a **contributing guide** — focus on practical instructions for contributors
- Use Just the Docs callout syntax: `{: .highlight }`, `{: .note }`, `{: .warning }`
- Current stub references "Story 62.25" — incorrect, this is Story 62-60

### Source Tree — Project Configuration

| File | Purpose |
|------|---------|
| `package.json` | Scripts: build, dev, lint, lint:fix, format, format:check, typecheck, test, test:integration, docs:dev, docs:build |
| `CLAUDE.md` | Tech stack, architecture (8 plugin slots), TypeScript conventions, development workflow |
| `.husky/pre-commit` | Gitleaks secret scanning hook |
| `LICENSE` | MIT License, Copyright 2025 Composio, Inc. |

### Source Tree — Related Docs

| File | Purpose |
|------|---------|
| `docs/contributing/development.md` | Development Guide child page (Story 62-61, currently stub) |
| `docs/contributing/plugin-development.md` | Plugin Development child page (Story 62-62, currently stub) |
| `docs/contributing/testing.md` | Testing Guide child page (Story 62-63, currently stub) |
| `docs/getting-started/architecture-overview.md` | Full architecture overview (link target) |
| `docs/getting-started/quick-start.md` | Quick Start guide (link target) |
| `docs/sdk/index.md` | SDK & Integration reference (link target) |

### Key Project Info for Contributing Guide

#### Available Scripts (from package.json)

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm build` | Build all packages |
| `pnpm dev` | Run web dev server |
| `pnpm lint` | ESLint check |
| `pnpm lint:fix` | ESLint auto-fix |
| `pnpm format` | Prettier format |
| `pnpm format:check` | Prettier check (CI) |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm test` | Run tests |
| `pnpm test:integration` | Run integration tests |
| `pnpm docs:dev` | Local docs dev server |
| `pnpm docs:build` | Build docs for production |
| `pnpm clean` | Clean build artifacts |

#### Pre-commit Hook (from .husky/pre-commit)

- **Gitleaks**: Scans staged files for secrets before allowing commit
- **Required**: gitleaks must be installed (`brew install gitleaks` on macOS)
- **On failure**: Shows which secret was detected, suggests fixes (env vars, .env.local, .gitleaks.toml allowlist)

#### Branch Naming Conventions (from CLAUDE.md and observed patterns)

| Pattern | Use Case |
|---------|----------|
| `story/ID-description` | Feature/story work (e.g. `story/62-60-contributing-guide`) |
| `fix/description` | Bug fixes |
| `docs/description` | Documentation changes |

#### Project Architecture (condensed from CLAUDE.md)

- **8 plugin slots**: Runtime, Agent, Workspace, Tracker, SCM, Notifier, Terminal, Provider
- **All interfaces** in `packages/core/src/types.ts`
- **Plugin pattern**: export `PluginModule` with inline `satisfies`
- **ESM modules** with `.js` extensions in imports
- **Security**: `execFile` not `exec`, validate all external input

#### License

- **MIT License**, Copyright (c) 2025 Composio, Inc.
- See `LICENSE` file in repository root

### Project Structure Notes

- Doc file location: `docs/contributing/index.md`
- Nav order: 11 (top-level with children)
- Has children: development.md (nav_order: 1), plugin-development.md (nav_order: 2), testing.md (nav_order: 3)
- Current stub references "Story 62.25" — incorrect, this is Story 62-60
- This is a **contributing guide** — practical instructions for open-source contributors

### References

- [Source: package.json — scripts, dependencies, license]
- [Source: CLAUDE.md — tech stack, architecture, conventions, development workflow]
- [Source: .husky/pre-commit — gitleaks secret scanning]
- [Source: LICENSE — MIT license]
- [Source: docs/getting-started/architecture-overview.md — architecture reference]
- [Source: docs/getting-started/quick-start.md — quick start reference]

## Change Log

- 2026-04-28: Story created from sprint backlog
- 2026-04-28: Replaced 10-line stub in `docs/contributing/index.md` with comprehensive contributing guide covering code of conduct, ways to contribute, issue reporting, PR process, commit conventions, code review expectations, development setup, project structure, and license

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7

### Debug Log References

### Completion Notes List

- Replaced `docs/contributing/index.md` stub (10 lines) with comprehensive contributing guide (276 lines)
- All 14 acceptance criteria covered across 10 sections
- Sections: Code of Conduct (Contributor Covenant link, expectations), How to Contribute (6 ways table), Reporting Issues (bug reports with reproduction template, feature requests), Pull Request Process (branch naming conventions table, 7-step workflow, pre-submit checklist, PR requirements), Commit Conventions (commit message format with prefixes table, pre-commit hooks — gitleaks installation and false positive handling), Code Review (6-point reviewer checklist), Development Setup (prerequisites, install/build commands table, 8 development commands table), Project Structure (pnpm workspaces layout, key files), License (MIT, link to LICENSE file), Cross-links section (parent, 3 children, getting started, reference)
- Front matter includes `description` field and `has_children: true` (was missing from stub)
- Cross-links verified: Development Guide, Plugin Development, Testing Guide, Architecture Overview, Quick Start, Configuration, SDK & Integration, CLI Reference (all 8 resolve)
- No hero font classes used
- All code blocks use correct syntax highlighting (bash, text)
- Callouts use Just the Docs syntax: `{: .highlight }` (1), `{: .note }` (1), `{: .warning }` (1)
- All commands match actual package.json scripts (build, dev, lint, lint:fix, format, typecheck, test, docs:dev, docs:build)
- Pre-commit hook content verified against .husky/pre-commit (gitleaks scanning, installation instructions)
- License verified against LICENSE file (MIT, Copyright 2025 Composio, Inc.)
- Corrected stub reference from "Story 62.25" to Story 62-60

### File List

- `docs/contributing/index.md` — replaced stub with comprehensive Contributing guide

## Senior Developer Review (AI)

**Reviewer:** R2d2 (AI-assisted) on 2026-04-28

### Review Findings

**Issues Found:** 0 HIGH, 0 MEDIUM, 0 LOW = 0 total

### Verification Summary

- All 14 ACs verified implemented
- 8 cross-links verified resolving to existing pages
- No hero font classes
- All code blocks use correct syntax highlighting (bash, text)
- 3 Just the Docs callouts (`{: .highlight }`, `{: .note }`, `{: .warning }`)
- All 9 development commands match `package.json` scripts
- Pre-commit hook documentation matches `.husky/pre-commit` content
- License section matches `LICENSE` file (MIT, 2025 Composio, Inc.)
- Branch naming conventions consistent with git history patterns
- Project structure matches `packages/` directory layout
- No fabricated APIs or commands

### Outcome

**APPROVED** — No issues found. Contributing guide accurately documents project conventions.
