# Epic 9 Retrospective: Artifact Inventory & Activity Tracking

**Date:** 2026-03-14
**Participants:** Alice (Product Owner), Bob (Scrum Master), Charlie (Senior Dev), Dana (QA Engineer), Elena (Junior Dev), R2d2 (Project Lead)
**Epic:** 9 - Artifact Inventory & Activity Tracking (Workflow Dashboard)
**Stories:** 2 stories, all complete
**Total New Tests:** 45 across the epic

**Key Achievement:** 100% code review rate — first time in project history. The GATE enforcement mechanism (escalated in Epic 8 retro) worked on first application. Both reviews caught real issues.

---

## What Went Well

### 1. Code Review Gate Achieved 100%
- **First time in project history** — 2/2 stories reviewed before marking done
- Epic 6: 0% → Epic 7: 60% → Epic 8: 50% → **Epic 9: 100%**
- The only variable that changed was enforcement mechanism: commitment → gate
- Both reviews found real issues (not rubber stamps)

### 2. Zero Debug Issues (Third Consecutive Epic)
- Epic 8: 0 debug issues → Epic 9: 0 debug issues
- Enhancement passes on solid Epic 7 foundations continue to execute cleanly
- No TypeScript mismatches, no mock pattern issues, no ESLint conflicts

### 3. Reviews Caught Real Bugs
- **Story 9-1 (MEDIUM)**: sr-only text created a 6th `<td>` column with no matching `<th>` header — accessibility violation in semantic table structure. Fixed by nesting sr-only `<span>` inside first `<td>`.
- **Story 9-2 (4 LOWs)**: Missing boundary test cases for `formatRelativeTime` (60s, 60m, 24h, 7d), completion notes test count mismatch, render optimization (extracting local variables).

### 4. Enhancement Pattern Continues to Excel
- Both stories enhanced placeholders created in Story 7-4
- Story 9-1: Converted `<ul>`/`<li>` list → semantic `<table>` with 5 columns
- Story 9-2: Added `PHASE_LABELS` formatting, sr-only text, aria-hidden
- Focused scope made each story manageable and well-defined

### 5. New Testing Pattern Established
- `vi.useFakeTimers()` + `vi.setSystemTime()` for deterministic time-dependent testing
- Applied in Story 9-2 for `formatRelativeTime()` with known ISO dates
- Much better than regex pattern matching (`/\d+[mhd] ago/`)
- Boundary tests at format-switching points (60s, 60m, 24h, 7d) added during review

---

## What Didn't Go Well

### 1. "Green Checkbox, Red DOM" Pattern
**Issue:** Dev agent marked tasks as `[x]` complete, but the DOM structure had a bug that only code review caught.

**Specific Case:** Story 9-1's sr-only text was added as a 6th `<td>` element, but only 5 `<th>` headers existed. The dev claimed "Task 2 — Accessibility: ✅" but the implementation violated semantic table structure.

**Context:** Same pattern as Story 8-4 where "Add role description" was marked `[x]` but role was never rendered. The dev agent validates intent ("I added sr-only text") but doesn't verify structural correctness ("does my column count match?").

**Impact:** MEDIUM — caught by review, would have shipped as an accessibility violation without the gate.

**Root Cause:** Dev agent lacks structural verification step after DOM changes. Self-assessment is intent-based, not evidence-based.

**Prevention:** Add explicit DOM structure count verification for table components (th count === td count per row).

### 2. hasType() Substring Issue (Carried Forward)
**Status:** Deferred — third consecutive retro. No user-facing impact. Low priority.

---

## Lessons Learned

### Technical Lessons

1. **Table Conversion Requires Column Count Verification**
   - Converting from `<ul>` to `<table>` changes the layout paradigm
   - Any element added (like sr-only text) must maintain column consistency
   - Rule: after any layout paradigm change, count `<th>` vs `<td>` elements per row
   - Fix pattern: nest sr-only content inside an existing `<td>` using `<span className="sr-only">`

2. **`vi.useFakeTimers()` Is the Canonical Time-Testing Pattern**
   - `vi.setSystemTime(new Date("2026-03-14T12:00:00Z"))` controls "now"
   - Pass known ISO dates → get deterministic output
   - Always `vi.useRealTimers()` in `afterEach`
   - Test boundary values where output format switches (60s, 60m, 24h, 7d)

3. **`phaseLabel()` Helper Is a Recurring Pattern**
   - Stories 8-3, 8-4, 9-1, 9-2 all implement variations of `PHASE_LABELS[phase as Phase]`
   - Safe lookup with fallback to raw string for unknown phases
   - Consistent enough to be a shared utility, though DRY cost is low (3-4 lines each)

### Process Lessons

1. **Gates Work Where Commitments Don't**
   - Epic 6: Committed to "never skip" → 0% compliance
   - Epic 7: Committed to "100%, no exceptions" → 60% compliance
   - Epic 8: Committed again → 50% compliance
   - **Epic 9: Enforced as gate → 100% compliance**
   - The enforcement mechanism matters more than the strength of the commitment

2. **"Green Checkbox, Red DOM" Is a Testable Anti-Pattern**
   - Dev agent self-assessment is intent-based, not evidence-based
   - Can be mitigated by requiring structural verification steps (e.g., "count your columns")
   - Code review remains the safety net for structural correctness

3. **Smallest Epics Aren't Necessarily Easiest**
   - Epic 9 had only 2 stories but each had complex DOM transformations
   - Story 9-1's table conversion was a paradigm shift (list → table)
   - Story 9-2's time-dependent testing required new patterns
   - Size ≠ simplicity — complexity per story was moderate

---

## Previous Epic Follow-Through (Epic 8)

### Epic 8 Action Items Status

1. **"Code review is a GATE, not a suggestion"** — ✅ **ACHIEVED** (2/2 = 100%). First 100% in project history.
2. **"Address hasType() substring false-positive"** — ⏳ Not applicable this epic (UI-only stories).

**Score:** 1 achieved, 1 not applicable

---

## Action Items

### Process Improvements

1. **Maintain code review GATE — permanent process change**
   - Owner: Bob (Scrum Master)
   - Success criteria: Epic 10 achieves 4/4 (100%) code review. Gate is now permanent.
   - Priority: HIGH
   - Note: Gate proven effective. Carry forward indefinitely.

2. **Add "count your columns" verification for table components**
   - Owner: Dana (QA Engineer)
   - Success criteria: Dev agent includes DOM structure count verification (th count === td count per row) as post-implementation check for table-based components.
   - Priority: LOW

3. **Address hasType() substring false-positive (carry forward)**
   - Owner: Charlie (Senior Dev)
   - Success criteria: `buildContext()` uses word-boundary or exact-match instead of `.includes()`
   - Priority: LOW (carried from Epic 8, no user-facing impact)

### Team Agreements

- Code review is a GATE — permanently enforced, story file must contain review section before marking done
- Enhancement stories still need review — "easy" ≠ "bug-free" (reinforced by 9-1 M1 finding)
- Table components require column count verification post-implementation
- `vi.useFakeTimers()` is the standard pattern for time-dependent tests

---

## Metrics

### Code Quality
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Test Count | 45 new | >20 | Pass |
| Code Reviews | 2/2 (100%) | 100% | **PASS** (first time) |
| Debug Issues | 0 | Minimal | Pass |
| Production Incidents | 0 | 0 | Pass |

### Story Completion
| Metric | Value |
|--------|-------|
| Total Stories | 2 |
| Completed | 2 (100%) |
| Greenfield Stories | 0 (all enhancement/validation) |
| Code Reviews Performed | 2 |
| Deferred Items | 1 (inherited from 7-1/8-1) |

### Code Review Trend
| Epic | Rate | Enforcement |
|------|------|-------------|
| 6 | 0/6 (0%) | None |
| 7 | 3/5 (60%) | Commitment |
| 8 | 2/4 (50%) | Commitment |
| **9** | **2/2 (100%)** | **Gate** |

---

## Next Epic Preview: Epic 10 — Real-Time Updates & Error Resilience

**Dependencies on Epic 9:** All met
- Artifact inventory and last activity components complete
- Component patterns fully established
- All 5 dashboard panels rendering with proper data

**Stories:** 4 stories
- 10-1: File Watcher with Debounced SSE Notifications (`node:fs.watch()`, 200ms debounce, fan-out)
- 10-2: Client-Side SSE Subscription & Auto-Refresh (`useWorkflowSSE` hook, `AbortController`, reconnect)
- 10-3: LKG State Pattern & Error Resilience (per-field caching, try/catch wrapping, graceful degradation)
- 10-4: Error Resilience Tests (30-scenario matrix, sequential validation, panel independence)

**Assessment:** Most complex Workflow Dashboard epic — combines server-side infrastructure (file watcher + LKG cache), client-side hooks (SSE subscription), and comprehensive testing (30 error scenarios). This is the "hardening" epic that makes the dashboard production-ready.

**Critical Blockers:** None

**Preparation Needed:** None — API route, component architecture, and test patterns all established.

---

**Retrospective Facilitator:** Bob (Scrum Master)
**Document Version:** 1.0
**Last Updated:** 2026-03-14
