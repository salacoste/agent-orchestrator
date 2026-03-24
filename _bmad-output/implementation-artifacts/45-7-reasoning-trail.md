# Story 45.7: Reasoning Trail — Agent Decision Logic

Status: review

## Story

As a code reviewer,
I want to see WHY the agent made specific decisions,
so that I can validate the approach, not just the code.

## Acceptance Criteria

1. `GET /api/agent/{id}/reasoning` returns key decision points from the session
2. Each decision shows: what was decided, alternatives considered (if available), rationale
3. Data extracted from session summary, learning record metadata, and activity events
4. Reasoning extractor is a pure function (testable without side effects)
5. If no reasoning data available, returns "No reasoning data available"
6. Tests verify reasoning extraction, empty state, and API response

## Tasks / Subtasks

- [x] Task 1: Create reasoning extractor (pure function) (AC: #2, #4)
  - [x] 1.1: Create `packages/core/src/reasoning-extractor.ts`
  - [x] 1.2: Accept ReasoningInput: summary, domainTags, errorCategories, filesModified, retryCount
  - [x] 1.3: Extract decisions via keyword matching, domain inference, retry patterns, test ratio
  - [x] 1.4: Return ReasoningTrail with categorized decisions and rationale
- [x] Task 2: Create reasoning API route (AC: #1, #5)
  - [x] 2.1: Create `packages/web/src/app/api/agent/[id]/reasoning/route.ts`
  - [x] 2.2: Fetch from sessionManager.get() + learningStore.query() (newest entry)
  - [x] 2.3: Agent ID validation, extractReasoning call, JSON response
- [x] Task 3: Write tests (AC: #6)
  - [x] 3.1: 13 extractor tests: keywords, rationale, categories, domains, retries, test ratio
  - [x] 3.2: Empty input returns hasData=false with no decisions
  - [x] 3.3: Domain tags produce "approach" category decisions
  - [x] 3.4: 4 route tests: success, empty, invalid ID, service failure

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

### Architecture — Pure Extractor + API Route

```
reasoning-extractor.ts (pure — no I/O)
  ├── Input: { summary, domainTags, errorCategories, filesModified, retryCount }
  └── Output: ReasoningTrail { decisions[], hasData }

API route (wiring)
  └── SessionManager.get() + LearningStore.query() → extractor → JSON
```

### ReasoningTrail Interface

```typescript
interface ReasoningDecision {
  category: "library" | "architecture" | "testing" | "approach" | "trade-off" | "general";
  decision: string;        // What was decided
  rationale: string;       // Why (extracted or inferred)
}

interface ReasoningTrail {
  agentId: string;
  hasData: boolean;
  decisions: ReasoningDecision[];
}
```

### Extraction Strategy

Since agents don't explicitly log "decisions", we infer reasoning from:

1. **Session summary** (`AgentSessionInfo.summary`) — parse for decision-like sentences
2. **Domain tags** — infer technology choices (e.g., "frontend" → "Working on UI layer")
3. **Error categories + retries** — infer approach changes (e.g., "2 retries with timeout" → "Adjusted approach after failures")
4. **Files modified** — infer architectural scope (e.g., "Modified 3 test files" → "Test-first approach")

Pattern keywords for summary parsing:
- "chose", "decided", "using", "approach", "because", "instead of", "trade-off"
- Fall back to sentence-level extraction if no keywords found

### Data Sources

```typescript
// Session summary
const session = sessionManager.get(agentId);
const summary = session?.agentInfo?.summary ?? null;

// Learning data
const learnings = learningStore.query({ agentId });
const latest = learnings[learnings.length - 1]; // newest (per 45.6 fix)
```

### Anti-Patterns to Avoid

- Do NOT use AI/LLM to generate reasoning — pure text extraction only
- Do NOT add new fields to SessionLearning — work with existing data
- Do NOT add UI components — backend only

### Previous Story Intelligence (45.6)

- `learnings[learnings.length - 1]` for newest entry (store returns oldest-first)
- Agent ID validation regex: `/^[a-zA-Z0-9_-]+$/`
- Pure function + API route pattern (6th time)

### Files to Create

1. `packages/core/src/reasoning-extractor.ts` (new)
2. `packages/core/src/__tests__/reasoning-extractor.test.ts` (new)
3. `packages/web/src/app/api/agent/[id]/reasoning/route.ts` (new)
4. `packages/web/src/app/api/agent/[id]/reasoning/route.test.ts` (new)

### Files to Modify

1. `packages/core/src/index.ts` (export extractReasoning)

### References

- [Source: packages/core/src/types.ts:399-404] — AgentSessionInfo.summary
- [Source: packages/core/src/types.ts:1432-1459] — SessionLearning fields
- [Source: packages/core/src/learning-store.ts:112-136] — query method
- [Source: _bmad-output/planning-artifacts/epics-cycle-9.md#Story 45.7] — requirements

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Pure extractReasoning() with 4 inference strategies: summary keywords, domain tags, retry patterns, test file ratio
- 8 decision keywords, 6 rationale keywords, 4 trade-off keywords for sentence parsing
- 4 category patterns (library, architecture, testing, trade-off) + fallback "general"
- extractRationale() checks same sentence and next sentence for "because"/"since" clauses
- Test ratio threshold 40% for "test-focused approach" inference
- Sentences < 10 chars filtered to avoid noise
- 17 new tests (13 extractor + 4 route), zero regressions

### File List

- packages/core/src/reasoning-extractor.ts (new)
- packages/core/src/__tests__/reasoning-extractor.test.ts (new)
- packages/core/src/index.ts (modified — export extractReasoning)
- packages/web/src/app/api/agent/[id]/reasoning/route.ts (new)
- packages/web/src/app/api/agent/[id]/reasoning/route.test.ts (new)
