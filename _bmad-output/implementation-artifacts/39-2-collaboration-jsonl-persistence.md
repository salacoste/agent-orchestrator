# Story 39.2: Collaboration JSONL Persistence

Status: review

## Story

As a team using the dashboard for collaboration,
I want decisions and claims to survive server restarts,
so that collaboration history is not lost when the Next.js dev server reloads or production redeploys.

## Acceptance Criteria

1. Decisions are appended to a JSONL file when `logDecision()` is called
2. Claims are appended to a JSONL file when `claimItem()` / `unclaimItem()` is called
3. On initialization, decisions and claims are loaded from JSONL files into in-memory state
4. Presence is NOT persisted (ephemeral by nature — stale presence data would be misleading)
5. JSONL files are stored in a configurable directory (default: project root `.ao-collaboration/`)
6. Tests verify write, load, and round-trip behavior

## Tasks / Subtasks

- [x] Task 1: Create collaboration persistence module (AC: #1, #2, #5)
  - [x] 1.1: Create `collaboration-store.ts` with `initCollaborationStore(dir)` factory
  - [x] 1.2: Implement `persistEvent()` — append decisions to `decisions.jsonl`
  - [x] 1.3: Implement `persistEvent()` — append claim events to `claims.jsonl`
  - [x] 1.4: Implement `loadJsonl<Decision>()` — read decisions from JSONL
  - [x] 1.5: Implement `loadJsonl<ClaimEvent>()` + `resolveLatestClaims()` — replay claim events
- [x] Task 2: Wire persistence into collaboration module (AC: #3, #4)
  - [x] 2.1: `initCollaborationStore(dir?, injectDecisions?, injectClaims?)` export
  - [x] 2.2: Subscribe via `subscribeCollaborationChanges` — persist decision/claim events
  - [x] 2.3: Load + inject on init (decisions + claims, NOT presence)
- [x] Task 3: Write tests (AC: #6)
  - [x] 3.1: Test decisions round-trip (write → load)
  - [x] 3.2: Test claims round-trip (write → load, with unclaim resolution)
  - [x] 3.3: Test malformed JSONL lines are skipped
  - [x] 3.4: Test missing directory is created automatically
  - [x] 3.5: Test presence is NOT persisted
  - [x] 3.6: Test stopCollaborationStore stops persisting

## Task Completion Validation

**CRITICAL:** Use correct task status notation:
- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete
- [ ] All tests have real assertions
- [ ] No hidden TODOs/FIXMEs
- [ ] File List includes all changed files

## Dev Notes

### Architecture Constraints

- **ESM modules** — no `.js` extensions in web package
- **`node:fs` only in server code** — `collaboration-store.ts` will use `node:fs/promises` since it's only called from server-side init code, not client components
- **Collaboration module is pure** — keep `collaboration.ts` pure (no fs imports). The store is a separate module that subscribes to changes via the 39.1 broadcasting API.
- **JSONL pattern** — follow the same pattern as `packages/core/src/learning-store.ts`: `appendFile` for writes, `readFile` + split for reads, `mkdir` for directory creation.

### Implementation Approach

Create `packages/web/src/lib/workflow/collaboration-store.ts` as a server-side module:

```typescript
// Called once on server startup
export async function initCollaborationStore(dir?: string): Promise<void> {
  const storeDir = dir ?? join(process.cwd(), ".ao-collaboration");
  // Load existing data
  await loadDecisions(join(storeDir, "decisions.jsonl"));
  await loadClaims(join(storeDir, "claims.jsonl"));
  // Subscribe to future changes
  subscribeCollaborationChanges((event) => {
    if (event.type === "decision") appendToFile(decisionsPath, event.data);
    if (event.type === "claim") appendToFile(claimsPath, event);
  });
}
```

The store subscribes to the 39.1 broadcasting system — no changes needed to collaboration.ts mutation functions.

### Previous Story Intelligence (39.1)

Story 39.1 added the `subscribeCollaborationChanges` API and discriminated union `CollaborationEvent` type. The persistence module should subscribe using this API and filter by event type.

### Files to Create/Modify

1. `packages/web/src/lib/workflow/collaboration-store.ts` (new — persistence logic)
2. `packages/web/src/lib/workflow/__tests__/collaboration-store.test.ts` (new — tests)

### References

- [Source: packages/core/src/learning-store.ts] — JSONL persistence pattern
- [Source: packages/web/src/lib/workflow/collaboration.ts] — collaboration module with broadcasting
- [Source: _bmad-output/planning-artifacts/epics-cycle-8.md#Story-39.2] — epic spec

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Created `collaboration-store.ts` with JSONL persistence for decisions and claims
- Uses 39.1 broadcasting API (no modifications to collaboration.ts needed)
- ClaimEvent replays resolve latest state per itemId (claim/unclaim sequence)
- `injectDecisions`/`injectClaims` callbacks allow callers to populate the module
- 9 tests covering all ACs including stop, malformed lines, missing dir, presence exclusion
- All 1,128 web tests pass, typecheck clean

### File List

- packages/web/src/lib/workflow/collaboration-store.ts (new — persistence module)
- packages/web/src/lib/workflow/__tests__/collaboration-store.test.ts (new — 9 tests)
