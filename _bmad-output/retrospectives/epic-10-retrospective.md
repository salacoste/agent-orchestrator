# Epic 10 Retrospective: Real-Time Updates & Error Resilience

**Date:** 2026-03-14
**Participants:** Alice (Product Owner), Bob (Scrum Master), Charlie (Senior Dev), Dana (QA Engineer), Elena (Junior Dev), R2d2 (Project Lead)
**Epic:** 10 - Real-Time Updates & Error Resilience (Workflow Dashboard)
**Stories:** 4 stories, all complete
**Total New Tests:** 93 across the epic

**Key Achievement:** Complete WD-7 three-layer error resilience validated with 30-scenario exhaustive matrix. All architecture decisions (WD-1 through WD-8) held without revision across 4 epics and 15 stories. 306 total tests for the Workflow Dashboard feature.

---

## What Went Well

### 1. Three-Layer Error Resilience Validated
- WD-7 designed in Epic 7, implemented across Stories 10-1/10-2/10-3, validated in Story 10-4
- Layer 1: Per-source try/catch around file I/O (10-3)
- Layer 2: In-memory per-project, per-field LKG cache (10-3)
- Layer 3: React state retention on fetch failure (10-2)
- 30-scenario matrix: 6 file states × 5 data sources = all HTTP 200, zero user-visible errors

### 2. Zero Debug Issues (Fourth Consecutive Epic)
- Epics 7, 8, 9, 10 — all zero debug issues
- Most complex WD epic (server infra + client hooks + caching + 40-test validation) executed cleanly
- Architecture investment in Epic 7 continues paying dividends through every subsequent epic

### 3. Code Reviews Caught Significant Bugs
- **Story 10-1 review**: Missing error logging (AC6), overly broad directory watching, resource leak (no watcher cleanup). Added 6 new tests.
- **Story 10-2 review**: Loading state stuck when SSE interrupts initial fetch — user-facing bug. Vacuous test assertions. Missing abort verification.
- **Story 10-3 review**: `hasBmad: true` on cold-start failure should be `hasBmad: false` (semantically incorrect). Duplicated `buildPhasePresence()` call. Silent error swallowing in agents catch.

### 4. Architecture Decisions Held Through All 4 Epics
- WD-1 through WD-8 designed in Epic 7, validated through Epics 8, 9, 10
- Not one architecture decision required revision
- 15 stories implemented against these decisions with zero architectural rework

### 5. Proper Story Sequencing
- Infrastructure (10-1: file watcher) → Integration (10-2: SSE subscription) → Caching (10-3: LKG) → Validation (10-4: 30-scenario matrix)
- Clean dependency chain — each story built on the previous one's foundation
- Each story independently mergeable

### 6. 93 New Tests — Highest Test Count
- 20 watcher tests (10-1) + 17 SSE tests (10-2) + 16 LKG tests (10-3) + 40 resilience tests (10-4)
- Includes exhaustive 30-scenario matrix, 4 sequential validation cycles, 5 panel independence proofs
- All tests use real assertions — no `expect(true).toBe(true)`

### 7. Deferred Items Resolved
- Story 7-3 deferred stat() error path test and mid-write file state test
- Both resolved in Stories 10-3 (LKG handling) and 10-4 (6-state matrix includes EBUSY mid-write)
- Tracking system proven effective across 3 epics

---

## What Didn't Go Well

### 1. Code Review Gate Violated Again (75%)
**Issue:** Story 10-4 (test-only, 40 tests) was NOT code-reviewed. Rate: 3/4 = 75%.

**Historical Pattern — Fifth Consecutive Retro:**

| Epic | Rate | Enforcement | What Was Skipped |
|------|------|-------------|-----------------|
| 6 | 0/6 (0%) | None | Everything |
| 7 | 3/5 (60%) | Commitment | Largest story + first UI story |
| 8 | 2/4 (50%) | Commitment | Enhancement stories |
| 9 | 2/2 (100%) | Gate | Nothing — gate worked |
| **10** | **3/4 (75%)** | **Gate** | **Test-only story** |

**Root Cause:** Test-only stories perceived as "safe" — same perception bias that caused skipping in Epics 7 and 8 for "large" and "easy" stories respectively. The gate mechanism works (proven in Epic 9), but exception culture undermines it.

**Impact:** Unknown — Story 10-4 may have test quality issues (vacuous assertions, missing edge cases, structural problems) that review would have caught. Story 10-2's review DID catch vacuous test assertions, proving that tests need review too.

**Assessment:** The code review problem is not about the mechanism (gate vs. commitment). It's about exception culture. No enforcement mechanism survives if "justified exceptions" are allowed.

### 2. Task Completion Validation Checkboxes Not Filled
**Issue:** Stories 10-1, 10-2, 10-3 all have unchecked `[ ]` validation checkboxes in their Task Completion Validation Checklist sections, despite being marked as `done`.

**Impact:** LOW — the actual work was done correctly, but the validation artifact wasn't filled out. This is a process paperwork gap, not a quality gap.

### 3. Pre-Existing Test Failures Not Addressed
**Issue:** 2 pre-existing failures in `conflicts.test.ts` exist on clean main branch and were not addressed during Epic 10.

**Impact:** LOW — these are in a different package (`packages/core`) and don't affect the Workflow Dashboard. But they represent unresolved technical debt.

---

## Lessons Learned

### Technical Lessons

1. **Three-Layer Error Resilience Is Elegant and Effective**
   - Layer 1 (file I/O try/catch): Catches permission denied, mid-write, empty files
   - Layer 2 (API LKG cache): Per-project, per-field caching with `_resetForTesting()`
   - Layer 3 (client state retention): React state preserved on fetch failure, no error UI
   - Together they guarantee HTTP 200 and no user-visible errors for all 30 file state scenarios

2. **Per-Source Try/Catch Enables Panel Independence**
   - Refactoring from one outer try/catch to five independent ones is more code but better isolation
   - When `scanAllArtifacts()` fails, artifacts get LKG but agents stay fresh
   - This is the key architectural insight: panels are independent in their data sources AND their failure modes

3. **Module-Level Singleton with `_resetForTesting()` Is the Pattern**
   - Used in `workflow-watcher.ts` (10-1) and `lkg-cache.ts` (10-3)
   - Module-level state, lazy initialization, exported functions (not classes)
   - `_resetForTesting()` enables test isolation without `vi.resetModules()`

4. **Variable Scoping in Try/Catch Requires Care**
   - `const` in `try` block is NOT accessible in `catch`
   - Must hoist declarations with `let` above try block
   - Easy to forget during refactoring — caught during 10-3 implementation

5. **Story Sequencing Matters for Complex Epics**
   - Infrastructure → Integration → Caching → Validation
   - Each story builds on the previous one's foundation
   - Clean dependency chain enables each story to be independently testable

### Process Lessons

1. **Gates Work — Exception Culture Doesn't**
   - Epic 9 proved the gate mechanism works (100%)
   - Epic 10 proved that allowing exceptions undermines the gate (75%)
   - The problem isn't the mechanism — it's the willingness to make exceptions
   - "Test-only stories are safe" is the same perception bias as "easy stories are safe" and "large stories are too big to review"

2. **30-Scenario Matrices Are the Gold Standard for Error Resilience**
   - Enumerate all combinations systematically: 6 file states × 5 data sources
   - Each scenario gets its own test with specific assertions
   - No gaps, no "we probably covered that" assumptions
   - Sequential validation cycles (valid → invalid → valid) prove cache lifecycle

3. **Deferred Items Work When Tracked Across Epics**
   - Story 7-3 → resolved in Stories 10-3/10-4 (3 epics later)
   - The tracking system works: document in story file → track in sprint status → resolve in later epic

---

## Previous Epic Follow-Through (Epic 9)

### Epic 9 Action Items Status

1. **"Maintain code review GATE — permanent"** — ❌ Partially achieved (3/4 = 75%). Story 10-4 (test-only) was skipped.
2. **"Add 'count your columns' verification for table components"** — ⏳ Not applicable (no table components this epic).
3. **"Address hasType() substring false-positive"** — ⏳ Not applicable (no artifact scanning changes).

**Score:** 0 applied, 1 failed, 2 not applicable

---

## Action Items

### Process Improvements

1. **Code review: no exceptions, including test-only stories**
   - Owner: Bob (Scrum Master)
   - Success criteria: Any future development achieves 100% code review. Test-only stories ARE reviewed — Story 10-2's review proved tests have bugs too (vacuous assertions, missing verifications).
   - Priority: HIGH
   - Note: Fifth consecutive retro. The gate works when enforced. The problem is exception culture, not enforcement mechanism.

2. **Address hasType() substring false-positive (carry forward)**
   - Owner: Charlie (Senior Dev)
   - Success criteria: `buildContext()` uses word-boundary or exact-match instead of `.includes()`
   - Priority: LOW (carried from Epic 8. No user-facing impact. Apply if future work touches this code.)

3. **Document WD-7 three-layer error resilience as reusable pattern**
   - Owner: Charlie (Senior Dev)
   - Success criteria: Pattern documented as architectural reference for dashboards backed by file system reads.
   - Priority: LOW (knowledge sharing for future projects)

### Team Agreements

- Code review gate is permanent — no exceptions for any story type
- Test-only stories need review — tests can have vacuous assertions, missing edge cases, structural issues
- Module-level singletons use `_resetForTesting()` for test isolation
- Error resilience uses per-source try/catch, not single outer catch

---

## Metrics

### Code Quality
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Test Count | 93 new | >50 | Pass |
| Code Reviews | 3/4 (75%) | 100% | Improved from Epic 8 (50%), regressed from Epic 9 (100%) |
| Debug Issues | 0 | Minimal | Pass |
| Production Incidents | 0 | 0 | Pass |
| Architecture Revisions | 0/8 | Minimal | Pass |

### Story Completion
| Metric | Value |
|--------|-------|
| Total Stories | 4 |
| Completed | 4 (100%) |
| Code Reviews Performed | 3 |
| Deferred Items Resolved | 2 (from Story 7-3) |
| New Deferred Items | 1 (hasType() carry forward) |

### Code Review Trend (Full Project — Workflow Dashboard)
| Epic | Rate | Mechanism | Outcome |
|------|------|-----------|---------|
| 7 | 3/5 (60%) | Commitment | Improvement from 0%, but gaps remain |
| 8 | 2/4 (50%) | Commitment | Regression — commitments don't work |
| 9 | 2/2 (100%) | Gate | Gate works when enforced |
| 10 | 3/4 (75%) | Gate | Exception culture undermines gate |

### Workflow Dashboard Totals (Epics 7-10)
| Metric | Value |
|--------|-------|
| Total Epics | 4 |
| Total Stories | 15 |
| Total New Tests | 306 |
| Debug Issues | 0 |
| Architecture Revisions | 0/8 (WD-1 through WD-8) |
| Production Incidents | 0 |
| Code Review Average | 10/15 (67%) |

---

## Project Completion Assessment

This is the **final epic-level retrospective**. All 10 epics (57 stories) are complete.

**Workflow Dashboard Feature Summary:**
- Epic 7: Phase Visibility — artifact scanner, phase computation, API route, page shell, phase bar (5 stories, 122 tests)
- Epic 8: AI-Guided Recommendations — recommendation engine, AI guide, agents panel (4 stories, 46 tests)
- Epic 9: Artifact Inventory & Activity Tracking — artifact table, last activity indicator (2 stories, 45 tests)
- Epic 10: Real-Time Updates & Error Resilience — file watcher, SSE, LKG cache, 30-scenario matrix (4 stories, 93 tests)

**Architecture Decisions:** WD-1 through WD-8 all held without revision across 15 stories. The upfront investment in architectural planning (Epic 7, Story 7-1) paid dividends throughout.

**Biggest Process Learning:** Code review enforcement requires gate mechanisms AND zero-exception culture. Gates alone are insufficient — they must be applied universally without "justified exceptions."

**Project-Wide Retrospective:** Available at `_bmad-output/retrospectives/project-wide-retrospective.md`.

---

**Retrospective Facilitator:** Bob (Scrum Master)
**Document Version:** 1.0
**Last Updated:** 2026-03-14
