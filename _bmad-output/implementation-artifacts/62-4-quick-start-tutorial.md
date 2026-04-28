# Story 62.4: Quick Start Tutorial

Status: done

## Story

As a developer new to Agent Orchestrator,
I want a 5-minute hands-on tutorial that walks me through init, spawn, and monitor,
so that I can see the tool working end-to-end without reading extensive documentation first.

## Acceptance Criteria

1. Tutorial covers the complete first experience: install (link to installation page) → init config → start dashboard → spawn first agent → check status
2. Every command is copy-pasteable with expected output shown inline (e.g., session ID format, dashboard URL)
3. Two paths documented: (a) `ao start <url>` (fastest — from repo URL) and (b) `ao init --auto` (from existing repo)
4. Explains what happens at each step (e.g., "This creates a git worktree, starts tmux, launches Claude Code...")
5. Links to next resources: Configuration Reference, Core Concepts (Sessions), Plugin Directory
6. Uses Just the Docs front matter with correct parent navigation (parent: Getting Started)
7. All code blocks use `bash` syntax highlighting
8. Complete in concept under 5 minutes of reading — concise, no walls of text

## Tasks / Subtasks

- [x] Task 1: Write intro and prerequisites (AC: #1, #8)
  - [x] One-paragraph intro setting expectations ("5 minutes, zero config")
  - [x] Brief prerequisites with link to Installation page
  - [x] No hero-style font classes on interior page (learned from 62-3 review)

- [x] Task 2: Write Path A — From a repo URL (AC: #2, #3, #4)
  - [x] `ao start https://github.com/owner/repo` — explain auto-detection
  - [x] Show expected output: dashboard URL, config path
  - [x] Moved spawn to separate section (applies to both paths)

- [x] Task 3: Write Path B — From existing local repo (AC: #2, #3, #4)
  - [x] `ao init --auto` — explain auto-detection (language, SCM, branch)
  - [x] `ao start` — start dashboard with existing config
  - [x] Spawn section applies to both paths (linked from both)

- [x] Task 4: Write "Check Status" section (AC: #2, #4)
  - [x] `ao status` — show tabular output format
  - [x] Explain dashboard at `http://localhost:5000`
  - [x] Brief description of what you see (session list, PR, CI, real-time SSE)

- [x] Task 5: Write "What Just Happened?" section (AC: #4, #8)
  - [x] 6-step numbered flow: worktree → runtime → agent → autonomous → reactions → notifier
  - [x] Adapted from README.md "How It Works" section (lines 68-79)
  - [x] Kept brief — link to Architecture Overview for details

- [x] Task 6: Write next steps and navigation (AC: #5, #6, #7)
  - [x] Link to Configuration Reference (../configuration/)
  - [x] Link to Architecture Overview (../architecture-overview/)
  - [x] Link to Sessions page (../../core-concepts/sessions/)
  - [x] Link to CLI Reference (../../cli/)
  - [x] Front matter verified: title: Quick Start, nav_order: 2, parent: Getting Started
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

### Design Decisions

- **Spawn as shared section**: Moved `ao spawn` to its own section between the two paths and the status check. Both paths converge at the spawn step, so documenting it once avoids duplication and reduces reading time.
- **Expected output formats**: CLI output examples are based on actual source code from `packages/cli/src/commands/spawn.ts` and `start.ts`. Session IDs shown as placeholders (`abc123def`) since actual IDs are generated at runtime.
- **No hero fonts**: Applied lesson from 62-3 code review — interior documentation pages should not use `.fs-5 .fw-300` hero-style classes.

### Just the Docs Features Used

- `{: .highlight }` callout for prerequisites tip and dashboard auto-open note
- Markdown code blocks with `bash` syntax highlighting throughout
- Relative links to sibling pages and cross-section links (../../core-concepts/)

### Link Verification

All 4 internal links verified against existing pages from Story 62-1:
- `../installation/` → `docs/getting-started/installation.md` (updated in Story 62-3)
- `../configuration/` → `docs/getting-started/configuration.md` (exists)
- `../architecture-overview/` → `docs/getting-started/architecture-overview.md` (exists)
- `../../core-concepts/sessions/` → `docs/core-concepts/sessions.md` (exists)
- `../../cli/` → `docs/cli/index.md` (exists)

### Important: Single File Change

This story modified **only** `docs/getting-started/quick-start.md`.

### References

- [Source: README.md lines 38-66 — quick start commands]
- [Source: README.md lines 68-79 — "How It Works" 6-step flow]
- [Source: packages/cli/src/commands/spawn.ts — spawn output format]
- [Source: packages/cli/src/commands/start.ts — start output format]
- [Source: examples/simple-github.yaml — minimal config]
- [Source: Story 62-3 — interior page styling lesson]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Rewrote docs/getting-started/quick-start.md with production-ready tutorial content
- Two paths: Option A (ao start URL — fastest) and Option B (ao init --auto — existing repo)
- Shared "Spawn Your First Agent" section covering ao spawn with expected output
- "Check on Your Agents" section with ao status tabular output and dashboard description
- "What Just Happened?" 6-step flow adapted from README.md
- Next steps with 4 links: Configuration, Architecture, Sessions, CLI
- Expected CLI outputs verified against actual source code (spawn.ts, start.ts)
- No hero-style font classes on interior page (per 62-3 review lesson)

### File List

**Modified:**
- `docs/getting-started/quick-start.md` — Complete rewrite from placeholder to production quick start tutorial

## Change Log

- 2026-04-20: Story implemented — quick start tutorial written with two paths, spawn, status, and 6-step flow
- 2026-04-20: Code review completed — fixed 5 issues (M1-M2, L1-L3)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6
**Date:** 2026-04-20
**Outcome:** Approved — all issues fixed

**Issues Found:** 2 Medium, 3 Low
**Issues Fixed:** 5/5

| ID | Severity | Description | Fix |
|----|----------|-------------|-----|
| M1 | Medium | Prerequisites callout missing AI agent dependency — users won't know they need Claude Code or another agent installed | Added "You'll also need an AI agent installed — Claude Code is the default." to prerequisites callout |
| M2 | Medium | Excessive `---` dividers between sections — adds visual noise for a concise tutorial page | Removed divider before "What Just Happened?" section, keeping dividers only at major section boundaries |
| L1 | Low | `SESSION=abc123def` output line unexplained — users won't know what it's for | Added explanation: "The last line (SESSION=...) is for scripting — you can use it in shell scripts to reference the session." |
| L2 | Low | "17-state session lifecycle" is an implementation detail too technical for a 5-minute tutorial | Changed to "session lifecycle" |
| L3 | Low | "Server-Sent Events" is an implementation detail inappropriate for a quick start tutorial | Removed SSE mention, simplified to "real-time updates" |
