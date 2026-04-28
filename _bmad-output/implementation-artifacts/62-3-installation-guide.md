# Story 62.3: Installation Guide

Status: done

## Story

As a developer setting up Agent Orchestrator,
I want a comprehensive installation guide with prerequisites, three install methods, and troubleshooting,
so that I can get the tool running on my machine regardless of my preferred package manager or platform.

## Acceptance Criteria

1. Prerequisites section lists all required (Node 20+, Git 2.25+) and optional (tmux, gh CLI, Claude CLI) dependencies with version requirements and install links
2. Three install methods documented with copy-paste commands: (a) clone + setup.sh, (b) clone + manual build, (c) npm global (noted as "coming soon" per SETUP.md)
3. Verification section: `ao --version` and `ao --help` commands with expected output examples
4. Troubleshooting section covers at least 5 common failures: missing Node, wrong Node version, pnpm not found, PATH issues after npm link, tmux not installed
5. Platform-specific callouts for macOS (brew) and Linux (apt) where relevant
6. Links to Configuration Reference (Story 62.5) and Quick Start Tutorial (Story 62.4) as next steps
7. Uses Just the Docs front matter with correct parent navigation (parent: Getting Started)
8. All code blocks use correct syntax highlighting (bash) and are copy-pasteable

## Tasks / Subtasks

- [x] Task 1: Write prerequisites section (AC: #1, #5)
  - [x] Required: Node.js 20+, Git 2.25+, pnpm 9+ with version check commands in table format
  - [x] Optional: tmux (default runtime), gh CLI (GitHub integration), Claude CLI (default agent), Linear API, Slack webhook
  - [x] Platform-specific install tips (macOS: brew, Linux: apt/nvm)
  - [x] Info callout explaining optional dependencies

- [x] Task 2: Write install methods section (AC: #2)
  - [x] Method 1: Clone + setup.sh (recommended) — describes what the script does (5-step breakdown)
  - [x] Method 2: Clone + manual build — `git clone`, `pnpm install`, `pnpm build`, `npm link -g packages/cli`
  - [x] Method 3: npm global — marked as "coming soon" with `{: .label .label-yellow }` badge
  - [x] Each method in a separate section with clear heading and step numbers

- [x] Task 3: Write verification section (AC: #3)
  - [x] `ao --version` with expected output (0.1.0 or current)
  - [x] `ao --help` as alternative (ao doctor does not exist in CLI)
  - [x] `ao start URL` quick test command
  - [x] Dashboard URL confirmation (localhost:5000)

- [x] Task 4: Write troubleshooting section (AC: #4)
  - [x] Node.js not found — install via brew/nvm
  - [x] Node version too old — upgrade instructions
  - [x] pnpm not installed (corepack enable or npm install -g pnpm)
  - [x] `ao` command not found after install (PATH issue with npm link)
  - [x] tmux not installed (macOS: brew, Linux: apt/dnf)
  - [x] Build failures (clean + rebuild)
  - [x] GitHub CLI not authenticated

- [x] Task 5: Write next steps and navigation (AC: #6, #7, #8)
  - [x] Link to Quick Start Tutorial (../quick-start/)
  - [x] Link to Configuration Reference (../configuration/)
  - [x] Link to Architecture Overview (../architecture-overview/)
  - [x] Front matter verified: title: Installation, nav_order: 1, parent: Getting Started
  - [x] All code blocks have ```bash syntax highlighting

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

**Not applicable** — This story modifies a single Jekyll markdown page. No TypeScript interfaces.

## Dependency Review

**Not applicable** — No new dependencies. Uses existing Just the Docs theme features.

## Dev Notes

### Limitations (Deferred Items)

1. **`ao doctor` command does not exist**
   - Status: Deferred - Command not implemented in CLI
   - AC#3 mentioned `ao doctor` but the command does not exist in `packages/cli/src/commands/`
   - Used `ao --help` as the alternative verification command
   - Current: Verification section uses `ao --version` and `ao --help`

### Deviation from AC

- **AC#3**: Originally specified `ao doctor` — replaced with `ao --help` since `ao doctor` does not exist in the CLI. Verified by searching `packages/cli/src/commands/` for "doctor" with no results.

### Content Source

The installation guide content was adapted from:
- `SETUP.md` (17,798 bytes) — prerequisites tables, install commands, troubleshooting patterns
- `scripts/setup.sh` (168 lines) — validation logic, build pipeline steps, PATH verification
- `README.md` (lines 38-50) — quick start commands
- `package.json` — Node 20+ engine requirement, pnpm 9.15.4

### Just the Docs Features Used

- `{: .fs-5 .fw-300 }` for subtitle styling
- `{: .highlight }` for tip callout after Method 1
- `{: .label .label-yellow }` for "Coming Soon" badge on Method 3
- Markdown tables for prerequisites (required and optional)
- All code blocks with `bash` syntax highlighting
- Relative links to sibling pages (`../quick-start/`, `../configuration/`, `../architecture-overview/`)

### Link Verification

All 3 internal links verified against existing pages from Story 62-1:
- `../quick-start/` → `docs/getting-started/quick-start.md` (exists)
- `../configuration/` → `docs/getting-started/configuration.md` (exists)
- `../architecture-overview/` → `docs/getting-started/architecture-overview.md` (exists)

### Important: Single File Change

This story modified **only** `docs/getting-started/installation.md`.

### References

- [Source: SETUP.md — canonical installation reference]
- [Source: scripts/setup.sh — automated setup script with validation]
- [Source: README.md lines 38-50 — quick start commands]
- [Source: README.md lines 155-170 — prerequisites list]
- [Source: packages/cli/package.json — bin field and package name]
- [Source: package.json — engines and packageManager fields]
- [Source: Story 62-1 — docs/getting-started/installation.md placeholder]
- [Source: Story 62-2 — Just the Docs styling patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Rewrote docs/getting-started/installation.md with comprehensive installation guide
- Prerequisites section with two tables (required: 3 items, optional: 5 items) plus platform-specific install commands
- Three install methods: setup.sh (recommended), manual build, npm global (coming soon)
- Verification section with ao --version, ao --help, and ao start URL test
- Troubleshooting section with 7 common issues and solutions
- Next steps section linking to Quick Start, Configuration, and Architecture pages
- Replaced `ao doctor` (does not exist) with `ao --help` in verification section
- All code blocks use ```bash syntax highlighting
- Just the Docs styling: .highlight callout, .label .label-yellow badge

### File List

**Modified:**
- `docs/getting-started/installation.md` — Complete rewrite from placeholder to production installation guide

## Change Log

- 2026-04-20: Story implemented — installation guide written with prerequisites, 3 install methods, verification, troubleshooting, and next steps
- 2026-04-20: Code review completed — fixed 5 issues (M1-M2, L1-L3)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6
**Date:** 2026-04-20
**Outcome:** Approved — all issues fixed

**Issues Found:** 2 Medium, 3 Low
**Issues Fixed:** 5/5

| ID | Severity | Description | Fix |
|----|----------|-------------|-----|
| M1 | Medium | `{: .fs-5 .fw-300 }` hero-style font sizing on interior documentation page — oversized and inconsistent with other pages | Removed `.fs-5 .fw-300` classes |
| M2 | Medium | pnpm listed as "Required" but setup.sh installs it automatically — confusing for Method 1 users | Changed Purpose to "Package manager (installed by setup.sh)" |
| L1 | Low | nvm install URL hardcoded to v0.40.0 — will become outdated | Changed to `/latest/install.sh` |
| L2 | Low | Description front matter could be more SEO-friendly | Expanded to include "step-by-step", "macOS and Linux" |
| L3 | Low | Method 3 "For now, use Method 1 or Method 2 above" — unhelpful text after Coming Soon label | Added link to GitHub issues for npm publication tracking |
