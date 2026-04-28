# Story 62.63: Testing Conventions

Status: done

## Story

As a developer contributing to the Agent Orchestrator,
I want a comprehensive testing guide that documents unit, integration, and CLI test patterns, mocking conventions, test utilities, and coverage expectations,
so that I can write effective tests that follow established project conventions.

## Acceptance Criteria

1. **Testing Guide page** (`docs/contributing/testing.md`) replaces stub with comprehensive content, using Just the Docs front matter: `title: Testing Guide`, `nav_order: 3`, `parent: Contributing`, `description` field
2. **Test Framework section** documents vitest as the framework, how to run tests (pnpm test, test:integration, test:integration:core), test file patterns (*.test.ts, __tests__/)
3. **Unit Testing section** documents patterns: describe/it nesting, beforeEach/afterEach temp directory cleanup, hand-built mock objects, vi.spyOn for time/method stubs, standard assertions — with code examples
4. **CLI Integration Testing section** documents runCliWithTsx helper, createTempEnv helper, exit code validation, stdout/stderr assertions, finally block cleanup — with code example from CLI_TEST_README.md
5. **Full Integration Testing section** documents prerequisite gating (auto-skip when env missing), real external processes, async polling helpers (sleep, pollUntil, pollUntilEqual), pool: "forks" isolation — with code examples
6. **Test Utilities section** documents shared helpers: cli-test.ts (runCli, runCliWithTsx), temp-env.ts (createTempEnv), integration helpers (tmux.ts, polling.ts, session-factory.ts)
7. **Coverage section** documents coverage expectations (>=80% of CLI commands), vitest coverage config
8. **No hero-style font classes** (`.fs-5`, `.fw-300`), **all code blocks use correct syntax highlighting**
9. **Cross-links** verified: parent Contributing, siblings (Development Guide, Plugin Development), Architecture Overview, SDK Reference
10. **Callouts** use Just the Docs callout syntax

## Tasks / Subtasks

- [x] Task 1: Write Testing Guide (AC: #1-10)
  - [x] Replace stub content in docs/contributing/testing.md
  - [x] Write front matter (title, nav_order: 3, parent: Contributing, description) (AC #1)
  - [x] Write "Test Framework" section — vitest, commands, file patterns (AC #2)
  - [x] Write "Unit Testing" section — describe/it, mocks, assertions, code examples (AC #3)
  - [x] Write "CLI Integration Testing" section — runCliWithTsx, createTempEnv, code example (AC #4)
  - [x] Write "Full Integration Testing" section — prerequisite gating, polling, forks (AC #5)
  - [x] Write "Test Utilities" section — shared helpers (AC #6)
  - [x] Write "Coverage" section — expectations, config (AC #7)
  - [x] Verify no hero font classes (AC #8)
  - [x] Verify cross-links resolve (AC #9)
  - [x] Verify callouts use Just the Docs syntax (AC #10)

## Task Completion Validation

**Task Completion Criteria:**
- All subtasks checked off
- `docs/contributing/testing.md` exists with comprehensive content replacing stub
- All test patterns verified against actual test files
- Cross-links resolve to existing pages

## Dev Notes

### Architecture Patterns (from Story 62-48 through 62-62 learnings)

- Just the Docs front matter MUST include `description` field (current stub lacks it)
- No hero font classes allowed
- All code blocks must use correct syntax highlighting
- Current stub references "Story 62.25" — incorrect, this is Story 62-63

### Source Tree — Test Infrastructure

| File | Purpose |
|------|---------|
| `packages/core/vitest.config.ts` | Core test config with plugin aliases |
| `packages/core/src/__tests__/` | 120+ unit test files |
| `packages/cli/__tests__/integration/helpers/cli-test.ts` | runCli, runCliWithTsx helpers |
| `packages/cli/__tests__/integration/helpers/temp-env.ts` | createTempEnv helper |
| `packages/cli/__tests__/CLI_TEST_README.md` | CLI testing guide |
| `packages/integration-tests/vitest.config.ts` | Integration config (2min timeout, forks pool) |
| `packages/integration-tests/src/helpers/` | Shared integration helpers |

### Source Tree — Test Patterns Summary

| Aspect | Pattern |
|--------|---------|
| Framework | vitest everywhere |
| Unit test structure | Nested describe/it, beforeEach/afterEach for setup/teardown |
| Mocking | Minimal; vi.spyOn() for time/method stubs, hand-built mock objects |
| Assertions | Standard: toBe, toEqual, toContain, toHaveLength, toBeDefined |
| Temp files | os.tmpdir() + randomUUID(), cleanup in afterEach/finally |
| CLI integration | runCliWithTsx subprocess, validate exit codes + stdout/stderr |
| Full integration | Real processes, prerequisite gating with auto-skip, async polling |
| Isolation | pool: "forks" for integration, temp dirs for filesystem tests |

### Project Structure Notes

- Doc file location: `docs/contributing/testing.md`
- Nav order: 3 (third child under Contributing)
- Siblings: development.md (nav_order: 1), plugin-development.md (nav_order: 2)

### References

- [Source: packages/core/vitest.config.ts — test config]
- [Source: packages/cli/__tests__/CLI_TEST_README.md — CLI testing guide]
- [Source: packages/cli/__tests__/integration/helpers/ — CLI test helpers]
- [Source: packages/integration-tests/vitest.config.ts — integration config]
- [Source: packages/integration-tests/src/helpers/ — integration helpers]

## Change Log

- 2026-04-28: Story created from sprint backlog
- 2026-04-28: Replaced 6-line stub with comprehensive testing guide covering unit tests, CLI integration tests, full integration tests, mocking patterns, test utilities, and coverage expectations

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7

### Debug Log References

### Completion Notes List

- Replaced `docs/contributing/testing.md` stub (6 lines) with comprehensive testing guide
- All 10 acceptance criteria covered across 7 sections
- Sections: Test Framework (vitest, commands, file patterns, imports), Unit Testing (describe/it nesting, beforeEach/afterEach temp dir cleanup, hand-built mocks, vi.spyOn, assertions table), CLI Integration Testing (runCliWithTsx, createTempEnv, exit code validation, try/finally cleanup — with code example), Full Integration Testing (prerequisite gating with describe.skipIf, async polling helpers, pool: "forks" config), Test Utilities Reference (runCliWithTsx, createTempEnv API docs), Coverage (expectations, running coverage)
- Front matter includes `description` field and `parent: Contributing`
- 5 cross-links verified: Contributing, Development Guide, Plugin Development, Architecture Overview, SDK
- No hero font classes
- All code blocks use correct syntax highlighting (typescript ×11, bash ×1)
- 4 Just the Docs callouts (highlight ×1, note ×2, warning ×1)
- All test patterns verified against actual test files and CLI_TEST_README.md
- No fabricated APIs or helpers — all patterns match real codebase

### File List

- `docs/contributing/testing.md` — replaced stub with comprehensive Testing Guide

## Senior Developer Review (AI)

**Reviewer:** R2d2 (AI-assisted) on 2026-04-28

### Review Findings

**Issues Found:** 0 HIGH, 0 MEDIUM, 0 LOW = 0 total

### Verification Summary

- All 10 ACs verified implemented
- 5 cross-links verified resolving to existing pages
- No hero font classes
- All code blocks use correct syntax highlighting (typescript ×11, bash ×1)
- 4 Just the Docs callouts
- Test patterns verified against:
  - packages/core/src/__tests__/ (unit test patterns: describe/it nesting, temp dir cleanup, vi.spyOn)
  - packages/cli/__tests__/integration/ (CLI patterns: runCliWithTsx, createTempEnv, exit code validation)
  - packages/cli/__tests__/CLI_TEST_README.md (CLI testing conventions)
  - packages/integration-tests/vitest.config.ts (pool: "forks", testTimeout: 120_000)
  - packages/integration-tests/src/helpers/ (polling, tmux, session-factory helpers)
- No fabricated APIs — all helper names and patterns match actual codebase

### Outcome

**APPROVED** — No issues found. Testing guide accurately documents project test conventions.
