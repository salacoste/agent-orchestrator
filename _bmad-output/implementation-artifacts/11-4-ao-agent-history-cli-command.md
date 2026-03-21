# Story 11.4: `ao agent-history` CLI Command

Status: done

## Story

As a Developer,
I want to view an agent's learning history from the CLI,
so that I can understand agent performance patterns and past outcomes.

## Acceptance Criteria

1. **`ao agent-history <agent-id>` shows table** — Story ID, Outcome (🟢/🔴/🟡), Duration, Domain, Date per session (AC1)
2. **`--json` outputs raw records** — JSONL format for piping (AC2)
3. **`--since 7d` filters by time** — Uses `parseTimeDelta()` from format.ts (AC3)
4. **Agent not found** — Error with list of known agents from learning store (AC4)
5. **Empty history** — "No learning history for this agent" message (AC5)

## Tasks / Subtasks

- [x] Task 1: Create `ao agent-history` CLI command (AC: 1-5)
  - [x]1.1 Create `packages/cli/src/commands/agent-history.ts` with `registerAgentHistory(program)`
  - [x]1.2 Options: `<agent-id>` (required), `--since <time>`, `--json`, `--limit <n>` (default 20)
  - [x]1.3 Load config → resolve project → create LearningStore → start → query by agentId
  - [x]1.4 Table output: Story ID | Outcome (emoji) | Duration | Domains | Date
  - [x]1.5 Outcome emoji: completed=🟢, failed=🔴, blocked=🟡, abandoned=⚫
  - [x]1.6 `--json` outputs raw SessionLearning records as JSONL
  - [x]1.7 Empty results: "No learning history for agent <id>"
  - [x]1.8 Register in `packages/cli/src/index.ts`

- [x] Task 2: Tests (AC: 1-5)
  - [x]2.1 Unit tests: command registration, outcome emoji mapping
  - [x]2.2 Data shape tests: SessionLearning → table row conversion

## Dev Notes

### Follow `ao events query` pattern exactly

```typescript
export function registerAgentHistory(program: Command): void {
  program
    .command("agent-history <agent-id>")
    .description("View agent learning history")
    .option("--since <time>", "Filter by time window (e.g., 7d, 30d)")
    .option("--limit <n>", "Max records to show", "20")
    .option("--json", "Output as JSONL", false)
    .action(async (agentId, opts) => {
      // loadConfig → getSessionsDir → createLearningStore → start → query
    });
}
```

### LearningStore already has everything needed

- `createLearningStore({ learningsPath })` — factory
- `store.start()` — loads from disk
- `store.query({ agentId, sinceMs, limit })` — filters + sorts

### References
- [Source: packages/core/src/learning-store.ts] — LearningStore with query()
- [Source: packages/cli/src/commands/events.ts] — CLI pattern reference
- [Source: packages/cli/src/lib/format.ts#parseTimeDelta] — Time delta parser

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- Created `ao agent-history <agent-id>` command: table output (Story, Outcome emoji, Duration, Domains, Date)
- Supports `--json` (JSONL), `--since` (time filter via parseTimeDelta), `--limit` (default 20)
- Uses LearningStore.query() from Story 11-3 — no duplicate logic
- Empty state: "No learning history for agent"
- Required `pnpm build` after adding new core exports (integration tests depend on built packages)
- 5 new tests, 661 total CLI tests, 0 failures

### Change Log

- 2026-03-18: Story 11.4 — ao agent-history CLI command + 5 tests

### File List

**New files:**
- `packages/cli/src/commands/agent-history.ts` — CLI command
- `packages/cli/__tests__/commands/agent-history.test.ts` — 5 tests

**Modified files:**
- `packages/cli/src/index.ts` — import + register registerAgentHistory
