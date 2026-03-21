# Epic 1 Retrospective: Core Agent Orchestration

**Date:** 2026-03-16
**Facilitator:** Bob (Scrum Master)
**Participant:** R2d2
**Epic Status:** DONE (5/5 stories complete)

## Epic Summary

Epic 1 delivered the core agent orchestration lifecycle: plan → spawn → track → resume → auto-assign. All 5 stories completed with code reviews, all tests passing, lint/typecheck clean.

| Story | Title | Agent |
|-------|-------|-------|
| 1-1 | Sprint Plan CLI & Data Model Foundation | Claude Opus 4.6 |
| 1-2 | Story-Aware Agent Spawning | Claude Opus 4.6 |
| 1-3 | Agent-Story Status Tracking & Completion Detection | Claude Opus 4.6 |
| 1-4 | Resume Blocked Stories | Claude Opus 4.6 |
| 1-5 | Multi-Agent Assignment | Claude Opus 4.6 |

## What Went Well

1. **Clean story sequencing** — Each story built logically on the previous: data model (1-1) → spawning (1-2) → tracking (1-3) → resume (1-4) → auto-assignment (1-5). No story required rework of a predecessor.

2. **Shared utility extraction in Story 1-2** — Extracting `readSprintStatus`, `findStoryFile`, `parseStoryFile`, `formatStoryPrompt`, `promptConfirmation` into `cli/src/lib/story-context.ts` was an excellent architectural move. Stories 1-3, 1-4, and 1-5 all benefited from this.

3. **Code reviews found real bugs** — Not just style nits:
   - 1-1: Missing type validation for `development_status`, missing `review` field in `SprintPlanView`
   - 1-3: Sessions directory hash mismatch in completion handlers, no error isolation between handler callbacks
   - 1-5: Position counter bug (FIFO counter incrementing for non-story keys), JSDoc inaccuracy about `backlog` stories, audit logging duplication

4. **Graceful degradation pattern** — Consistent across stories: detection wiring (1-3, 1-4) wrapped in try-catch so spawn still succeeds if monitoring setup fails. Non-fatal audit logging. Right pattern for CLI-lifetime tooling.

5. **Deferred items tracked explicitly** — Every story documented its limitations with clear "Status: Deferred", "Requires", "Epic", "Current" fields. Some were resolved in later stories (1-3's "kill cleanup" → fixed in 1-4). Clean paper trail.

6. **Interface validation process** — Caught `updateStatus()` missing from `AgentRegistry` interface in Story 1-3 and added it. Feature flags documented for deferred capabilities like `getExitCode()`.

## What Could Improve

1. **`assign.ts` duplication** — Still has its own copies of `readSprintStatus`, `logAssignment`, `validateDependencies` that predate `story-context.ts`. Noted as deferred in Story 1-5 but this debt will compound if Epic 2 adds more consumers.

2. **Task Completion Validation Checklists inconsistent** — Stories 1-1 and 1-5 have fully checked validation checklists. Stories 1-3 and 1-4 have unchecked items. Story 1-4 also has `{{agent_model_name_version}}` placeholder unfilled.

3. **CLI integration tests (createTempEnv) deferred across all 5 stories** — Every story's CLI Integration Testing section is unchecked. Unit tests with mocks are comprehensive, but no end-to-end CLI tests exist for the new commands.

4. **wireDetection extraction timing** — `wireDetection()` was created in `spawn.ts` (Story 1-3) and then extracted to `wire-detection.ts` (Story 1-4). If the story sequence had anticipated both spawn and resume needing it, it could have been extracted from the start.

5. **Story 1-4 Dev Agent Record incomplete** — Missing Completion Notes and the Agent Model field is a template placeholder. Makes future retros harder.

## Patterns Established

| Pattern | Introduced In | Used By |
|---------|--------------|---------|
| `story-context.ts` shared helpers | 1-2 | 1-3, 1-4, 1-5 |
| `wireDetection()` shared utility | 1-3 → extracted in 1-4 | spawn.ts, resume.ts |
| Priority field on `AgentAssignment` | 1-4 (passive) | 1-5 (consumed) |
| Source-scanning + behavioral tests | 1-5 | future stories |
| `overrideSessionsDir` parameter | 1-3 code review | 1-4 |
| In-memory EventBus for CLI-lifetime | 1-3 | 1-4 |

## Deferred Items Carried Forward

| Item | Deferred From | Target |
|------|--------------|--------|
| Redis-backed priority queue | 1-5 | Epic 2 |
| Persistent event-driven monitoring | 1-3, 1-4 | Epic 2 |
| Auto idle-agent detection + trigger | 1-5 | Epic 2/4 |
| `assign.ts` refactor to shared utilities | 1-5 | Pre-Epic-2 tech debt |
| CLI integration tests (createTempEnv) | All stories | Tech debt story |
| `ao spawn-story` deprecation | 1-2 | Future cycle |
| Exit code detection for completion | 1-3 | Epic 4 |
| Story-to-issue mapping | 1-2 | Future cycle |

## Technical Concerns for Epic 2

1. **CLI-lifetime detection → persistent monitoring gap.** wireDetection() and createInMemoryEventBus() won't scale. Epic 2 needs to bridge to durable event-driven monitoring (Redis Pub/Sub). Story 2-1 or 2-2 should address the migration path.

2. **Two sprint-status readers.** Core has `readSprintData()` (minimal), CLI has `readSprintStatus()` (full), tracker-bmad has its own. Epic 2's bidirectional sync needs a single canonical reader/writer. Story 2-1 should resolve this.

3. **State Manager not wired to CLI.** Architecture calls for StateManager as smart cache with write-through to YAML, but CLI commands read YAML directly. Story 2-1 needs to make StateManager the single entry point.

4. **Event schema evolution.** Epic 2 introduces story lifecycle events. Current EventPublisher/EventSubscription are generic. Story 2-2 should add Zod schema validation on event payloads to prevent silent contract drift.

## Action Items

| # | Priority | Action | Target |
|---|----------|--------|--------|
| 1 | HIGH | Refactor `assign.ts` to use shared `story-context.ts` utilities (eliminate duplication before Epic 2 adds more consumers) | Pre-Epic-2 tech debt story |
| 2 | MEDIUM | Add dev-story workflow validation: block "done" transition if `{{` template placeholders remain in story file | Workflow update |
| 3 | LOW | Backfill Story 1-4 Dev Agent Record (agent model, completion notes) | Housekeeping |
