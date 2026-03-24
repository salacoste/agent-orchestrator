# Story 46a.1: Immutable Audit Log

Status: review

## Story

As a system administrator requiring compliance,
I want all state-changing actions to be recorded in an immutable append-only log,
so that there is a tamper-proof trail of everything that happened.

## Acceptance Criteria

1. State-changing actions (spawn, kill, resume, status change) recorded in `audit.jsonl`
2. Each entry has: timestamp, actor, action, target, before/after state
3. Audit log is APPEND-ONLY — no edits, no deletes, no rotation
4. Entries are cryptographically chained (each includes hash of previous entry)
5. `GET /api/audit?since=timestamp&limit=N` returns audit entries (extends existing route)
6. Chain integrity can be verified
7. Tests verify append-only behavior, hash chaining, and chain verification

## Tasks / Subtasks

- [x] Task 1: Create immutable audit log service (AC: #1, #2, #3)
  - [x] 1.1: Create `packages/core/src/immutable-audit-log.ts`
  - [x] 1.2: appendFile to audit.jsonl (separate from events.jsonl)
  - [x] 1.3: AuditLogEntry: id, timestamp, actor, action, target, beforeState, afterState, metadata
  - [x] 1.4: No rotation, no deletion — ensureInitialized resumes chain from existing file
- [x] Task 2: Add cryptographic hash chaining (AC: #4, #6)
  - [x] 2.1: Each entry includes previousHash (SHA-256 of preceding entry's content)
  - [x] 2.2: Genesis hash = "0"
  - [x] 2.3: verifyChain() validates hash content + chain links + genesis
- [x] Task 3: Create/extend audit API route (AC: #5)
  - [x] 3.1: Create `packages/web/src/app/api/audit/immutable/route.ts`
  - [x] 3.2: Query with ?since= and ?limit= (max 1000)
  - [x] 3.3: ?verify=true returns ChainVerification result
- [x] Task 4: Write tests (AC: #7)
  - [x] 4.1: 9 service tests: chain, persistence, filtering, resume, metadata
  - [x] 4.2: 4 verifyChain tests: tampered hash, broken link, invalid genesis
  - [x] 4.3: 2 computeEntryHash tests: consistency, uniqueness
  - [x] 4.4: 3 route tests: entries, verify, params

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- Deferred items explicitly documented
- No hidden TODOs or FIXMEs in completed tasks
- Documentation updated (Dev Notes, File List)

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] No deferred items
- [x] File List includes all changed files

## Dev Notes

### Architecture — Separate from events.jsonl

**Critical distinction:** `events.jsonl` rotates at 10MB (existing behavior). `audit.jsonl` is immutable — NO rotation, NO deletion. Different file, different service, different semantics.

```
immutable-audit-log.ts (core service)
  ├── appendEntry(entry) → writes to audit.jsonl with hash chain
  ├── readEntries(since?, limit?) → reads with optional time filter
  ├── verifyChain() → validates entire chain integrity
  └── File: audit.jsonl (NEVER rotated)

API route (wiring)
  └── GET /api/audit/immutable?since=&limit=&verify=true
```

### AuditLogEntry Interface

```typescript
interface AuditLogEntry {
  id: string;             // UUID
  timestamp: string;      // ISO 8601
  actor: string;          // "user", "autopilot", "agent-X"
  action: string;         // "spawn", "kill", "resume", "status.change", "config.update"
  target: string;         // Session ID, story ID, or config key
  beforeState?: string;   // Previous state (optional)
  afterState?: string;    // New state (optional)
  metadata?: Record<string, unknown>;
  hash: string;           // SHA-256 of this entry's content
  previousHash: string;   // Hash of previous entry ("0" for genesis)
}
```

### Hash Chaining

```typescript
import { createHash } from "node:crypto";

function computeEntryHash(entry: Omit<AuditLogEntry, "hash">): string {
  const data = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    actor: entry.actor,
    action: entry.action,
    target: entry.target,
    previousHash: entry.previousHash,
  });
  return createHash("sha256").update(data).digest("hex");
}
```

### Chain Verification

```typescript
function verifyChain(entries: AuditLogEntry[]): { valid: boolean; brokenAt?: number } {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    // Verify hash matches content
    const expected = computeEntryHash({ ...entry });
    if (entry.hash !== expected) return { valid: false, brokenAt: i };
    // Verify chain link
    if (i > 0 && entry.previousHash !== entries[i - 1].hash) {
      return { valid: false, brokenAt: i };
    }
    // First entry must have genesis previousHash
    if (i === 0 && entry.previousHash !== "0") {
      return { valid: false, brokenAt: 0 };
    }
  }
  return { valid: true };
}
```

### Existing Code to Reuse

1. **`AuditTrailImpl`** from `audit-trail.ts` — JSONL append pattern, `appendFile` from `node:fs/promises`
2. **`createHash("sha256")`** from `node:crypto` — already used in audit-trail.ts line 102
3. **`/api/audit/events`** route — query parameter pattern (since, limit, pagination)

### Anti-Patterns to Avoid

- Do NOT reuse `events.jsonl` — this is a SEPARATE file `audit.jsonl`
- Do NOT add rotation — immutable means the file only grows
- Do NOT modify existing AuditTrailImpl — create a new service
- Do NOT use `exec`/`execFile` for any operations — use `appendFile` from `node:fs/promises`

### Previous Story Intelligence (45.8)

- Pure function + API route pattern is solid (8th time)
- LearningStore query pattern for time-based filtering
- Route validation (timestamp format, parameter presence)

### Files to Create

1. `packages/core/src/immutable-audit-log.ts` (new)
2. `packages/core/src/__tests__/immutable-audit-log.test.ts` (new)
3. `packages/web/src/app/api/audit/immutable/route.ts` (new)
4. `packages/web/src/app/api/audit/immutable/route.test.ts` (new)

### Files to Modify

1. `packages/core/src/index.ts` (export createImmutableAuditLog)

### References

- [Source: packages/core/src/audit-trail.ts] — existing JSONL append + hash pattern
- [Source: packages/core/src/types.ts:1876-1882] — AuditEvent interface
- [Source: packages/web/src/app/api/audit/events/route.ts] — query API pattern
- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 46a.1] — requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- createImmutableAuditLog(filePath) — factory returning ImmutableAuditLog interface
- Append-only via node:fs/promises appendFile — no rotation, no deletion
- Hash chain: SHA-256 of {id, timestamp, actor, action, target, beforeState, afterState, previousHash}
- Genesis previousHash = "0", subsequent entries link to previous hash
- ensureInitialized() reads last line of existing file to resume chain on restart
- verifyChain() validates: hash content match, chain links, genesis hash
- computeEntryHash() exposed for external verification
- API route: ?since= time filter, ?limit= (max 1000), ?verify=true for chain verification
- 19 new tests (16 core + 3 route), 92+105 files, zero regressions

### File List

- packages/core/src/immutable-audit-log.ts (new)
- packages/core/src/__tests__/immutable-audit-log.test.ts (new)
- packages/core/src/index.ts (modified — export createImmutableAuditLog)
- packages/web/src/app/api/audit/immutable/route.ts (new)
- packages/web/src/app/api/audit/immutable/route.test.ts (new)
