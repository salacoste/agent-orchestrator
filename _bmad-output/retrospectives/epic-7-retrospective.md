# Epic 7 Retrospective: Workflow Phase Visibility

**Date:** 2026-03-14
**Participants:** Alice (Product Owner), Bob (Scrum Master), Charlie (Senior Dev), Dana (QA Engineer), Elena (Junior Dev), R2d2 (Project Lead)
**Epic:** 7 - Workflow Phase Visibility (Workflow Dashboard)
**Stories:** 5 stories, all complete
**Total Tests:** 122+ across the epic

**Key Achievement:** Complete workflow phase visibility system — artifact scanner, phase computation engine, API route, page shell with CSS Grid layout, and phase bar component. All 8 architecture decisions (WD-1 through WD-8) held without revision through the entire epic.

---

## What Went Well

### 1. Foundational Architecture in Story 7-1
- Single story created 12 new files (6 lib modules + API route + 5 test files) and 82 tests
- Established `lib/workflow/*` module structure used by every subsequent story
- Architecture decisions WD-1 through WD-8 all validated through implementation — none required revision
- Recommendation engine and agent parser built here were reused directly in Epic 8

### 2. Code Review Improvement Over Epic 6
- Epic 6: 0/6 stories reviewed (0%)
- Epic 7: 3/5 stories reviewed (60%) — Stories 7-2, 7-3, 7-5
- Reviews drove real improvements: PhaseState type parameter fix (7-5), test reorganization (7-2), precise assertions (7-3)
- Reviews were substantive, not checkbox exercises

### 3. Deferred Items Properly Tracked
- Story 7-3 explicitly documented 2 deferred items: stat() error path test, mid-write file state test
- Both were picked up and completed in Epic 10 (Stories 10-3, 10-4)
- Direct application of Epic 6 lesson: "Deferred Features Need Tracking"

### 4. Clean UI Stories
- Story 7-4 (page shell) had zero debug issues — solid API layer enabled smooth frontend work
- Story 7-5 (phase bar) was focused enhancement with clean implementation
- "Boring" downstream stories are a sign of good architecture

### 5. Comprehensive Test Coverage
- 82 tests in Story 7-1 alone
- 122+ total across the epic
- Integration tests against real `_bmad/` directory using `describe.skipIf` pattern
- Zero production incidents

---

## What Didn't Go Well

### 1. Vitest Mock Pattern Rediscovered 3 Times
**Issue:** `vi.hoisted()` / `vi.mock()` ordering was a stumbling block in Stories 7-1, 7-2, and 7-3

**Root Cause:** Solution discovered in Story 7-1 was not documented for reuse

**Impact:** Lost development time in Stories 7-2 and 7-3 solving the same problem

**Prevention:** Document test patterns as they're discovered — one-time solutions should be reusable

### 2. TypeScript Type Mismatches
**Issue:** Types didn't match runtime reality in 2 stories

- Story 7-1: `ProjectConfig.path` missing from type definition
- Story 7-2: `Services` type needed a cast workaround

**Root Cause:** Types defined in advance without validating against actual runtime shapes

**Prevention:** Validate types against runtime data early in implementation

### 3. Test Precision Consistently Flagged in Reviews
**Issue:** First-draft tests tend toward "good enough" rather than precise

- Stories 7-2, 7-3, 7-5, and 10-4 all received feedback about test precision
- Common feedback: differentiate mock states, use realistic error types, add shape assertions

**Root Cause:** No established test quality standard

**Prevention:** Establish and enforce test precision standard

### 4. Code Review Still Not 100%
**Issue:** Stories 7-1 and 7-4 did not receive code review

- Story 7-1 was the largest story (12 files, 82 tests) — exactly the story that needs review most
- Skipped because the story felt "too large to review"

**Root Cause:** Large stories create review resistance

**Prevention:** Mandate code review for all stories regardless of size; consider reviewing incrementally during implementation for large stories

---

## Lessons Learned

### Technical Lessons

1. **Front-Loading Architecture Pays Dividends**
   - Story 7-1's investment in foundational modules made every downstream story smoother
   - Architecture decisions that hold without revision save enormous rework
   - "Boring" UI stories are the reward for solid backend work

2. **`vi.hoisted()` Pattern for Vitest Mocks**
   - ESLint `no-duplicate-imports` conflicts with `vi.mock()` placement
   - Solution: Use `vi.hoisted()` to declare mocks, then `vi.mock()` references them
   - Import the module under test after all `vi.mock()` calls

3. **`describe.skipIf` for Environment-Dependent Tests**
   - Integration tests against real `_bmad/` directory use `describe.skipIf(!fs.existsSync(...))` pattern
   - Enables tests to run locally but skip gracefully in CI environments without the fixture

### Process Lessons

1. **Code Review Rate: 0% → 60% — Progress But Not Complete**
   - Epic 6 retro committed to "never skip code review" — partially applied
   - Reviews that happened drove real quality improvements
   - Gap: largest story (7-1) and first UI story (7-4) were skipped
   - Next commitment: 100% review rate for Epic 8

2. **Solve Once, Document Immediately**
   - The `vi.hoisted()` pattern was rediscovered 3 times because it wasn't captured after the first solve
   - Knowledge sharing saves more time than knowledge discovery

3. **Deferred Items Work When Tracked**
   - Explicit documentation in story files → items tracked in sprint status → picked up in later epic
   - The system works; the discipline is worth maintaining

---

## Previous Epic Follow-Through (Epic 6)

### Epic 6 Action Items Status

Most Epic 6 action items (9 total) were Plugin system-specific — different domain from Epic 7's Workflow Dashboard. All were marked done as of 2026-03-10.

### Process Lessons Applied from Epic 6

**Applied Successfully:**
- ✅ "Code Review Should Not Be Skipped" — went from 0/6 to 3/5 (60%)
- ✅ "Deferred Features Need Tracking" — 2 deferred items tracked and completed in Epic 10
- ✅ "Integration Points Need Planning" — WD-1 through WD-8 planned upfront, all held

**Partially Applied:**
- ⏳ Code review still not at 100% — Stories 7-1 and 7-4 skipped

---

## Action Items

### Process Improvements

1. **Mandate code review for ALL stories — no exceptions**
   - Owner: Bob (Scrum Master)
   - Success criteria: Epic 8 has 4/4 stories reviewed before marking done
   - Priority: HIGH

2. **Document `vi.hoisted()` mock pattern as test convention**
   - Owner: Charlie (Senior Dev)
   - Success criteria: Pattern documented with copy-paste example showing vi.hoisted() → vi.mock() → import ordering
   - Priority: MEDIUM

3. **Establish test precision standard**
   - Owner: Dana (QA Engineer)
   - Success criteria: Standard covers differentiated mock states, realistic error types, shape assertions; referenced during Epic 8 reviews
   - Priority: MEDIUM

4. **Audit Story 2.2 test coverage against existing 7-1 recommendation tests**
   - Owner: Dana (QA Engineer)
   - Success criteria: Coverage gap analysis completed before writing new tests; no duplicate test cases
   - Priority: MEDIUM

5. **Document `describe.skipIf` integration test pattern**
   - Owner: Charlie (Senior Dev)
   - Success criteria: Pattern captured alongside vi.hoisted() documentation
   - Priority: LOW

6. **Document component pattern from PhaseBar for Epic 8 reuse**
   - Owner: Elena (Junior Dev)
   - Success criteria: Props-only pattern, semantic HTML, ARIA labels, loading/empty states documented as template
   - Priority: LOW

### Team Agreements

- All stories get code review before marking done — 100%, no exceptions
- Hard problems solved once get documented immediately — no rediscovery tax
- Tests start precise, not "good enough" — reviewers enforce the standard

---

## Metrics

### Code Quality
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Test Count | 122+ | >50 | Pass |
| Code Reviews | 3/5 (60%) | 100% | Improved (was 0%) |
| Production Incidents | 0 | 0 | Pass |
| Architecture Revisions | 0/8 decisions | Minimal | Pass |

### Story Completion
| Metric | Value |
|--------|-------|
| Total Stories | 5 |
| Completed | 5 (100%) |
| Code Reviews Performed | 3 |
| Deferred Items | 2 (both resolved in Epic 10) |

### Technical Debt
| Category | Count | Status |
|----------|-------|--------|
| Critical | 0 | None |
| Deferred Tests | 0 | Resolved in Epic 10 |
| Knowledge Gaps | 2 | Action items created |

---

## Next Epic Preview: Epic 8 — AI-Guided Recommendations & Agent Discovery

**Dependencies on Epic 7:** All met
- `recommendation-engine.ts` — implemented in Story 7-1
- `parse-agents.ts` — implemented in Story 7-1
- API route returning recommendation + agents data — working
- CSS Grid layout with panel slots — created in Story 7-4

**Preparation Needed:** Minimal
- Audit existing recommendation engine test coverage
- Review PhaseBar component pattern for reuse

**Critical Blockers:** None

**Assessment:** Epic 8 is primarily UI component work (AI Guide panel, Agents panel) plus test gap-filling. The backend foundation from Epic 7 is solid and ready.

---

**Retrospective Facilitator:** Bob (Scrum Master)
**Document Version:** 1.0
**Last Updated:** 2026-03-14
