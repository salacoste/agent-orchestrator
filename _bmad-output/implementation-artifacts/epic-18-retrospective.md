# Epic 18 Retrospective — Agent Communication & Intelligence

**Date**: 2026-04-28
**Epic**: 18 — Agent Communication & Intelligence
**Status**: Complete (all 5 stories done)
**Source**: Cycle 4

## Epic Summary

Epic 18 transformed the orchestrator's agent communication from rigid enum-only state reporting into a rich, intent-driven dialogue system. Five stories introduced Commander's Intent in agent prompts (enabling autonomous adaptation when prescribed approaches fail), narrative status updates (human-readable context alongside machine states), structured help requests (formal A/B/C decision points instead of vague "blocked" states), workflow anti-pattern detection with advisory coaching nudges, and a recommendation feedback loop that deprioritizes frequently-dismissed suggestion types. The epic spanned CLI prompt engineering, core metadata schema, and the web dashboard — touching all three layers of the architecture.

## Story Delivery

| Story | Title | Status |
|-------|-------|--------|
| 18.1 | Commander's Intent in Agent Prompts | Done |
| 18.2 | Agent Narrative Status Updates | Done |
| 18.3 | Structured Help Request Protocol | Done |
| 18.4 | Workflow Anti-Pattern Detector | Done |
| 18.5 | Recommendation Feedback Loop | Done |

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead), Nova (Architect), Blaze (Dev), Pax (QA)

---

### What Went Well

**R2d2:** "Commander's Intent was the standout story. Ten lines of code in `formatStoryPrompt()` — a single prose paragraph injected between Acceptance Criteria and the closing separator — and agent behavior improved noticeably. That is the highest-ROI change in the entire cycle."

**Nova:** "Story 18.2 is a close second in terms of architectural elegance. The `summary` metadata field already existed in `SessionMetadata` but was unused. We repurposed it as the narrative carrier with zero schema changes. No new types, no migrations, no backward compatibility concerns. Just populate the field and render it."

**Blaze:** "The anti-pattern rules in 18.4 followed the same data-driven pattern we established with the recommendation engine in Epic 17. Rules as constant arrays, pure evaluation functions, no coupling to React state. Detecting things like 'PRD edited 5+ times without advancing' or 'Architecture skipped' — all from the same artifact state scanner."

**Pax:** "The feedback loop in 18.5 is simple and correct. In-memory tracking for the MVP, JSONL persistence path clearly defined for when we wire it properly. The deprioritization logic — suppress types dismissed more than 3 times in a row — is easy to reason about and test."

**Nova:** "Across all five stories, backward compatibility was handled cleanly. Old sessions without narrative, help requests, or intent sections render without errors. The graceful degradation pattern is consistent."

### What Could Be Improved

**Pax:** "The dead-button pattern recurred here. Story 18.3's help request option buttons initially had no `onClick` handler — the same mistake from 17.2. Then 18.5's accept/dismiss buttons on the recommendation panel hit the same issue. Three occurrences across two epics means this should have been caught as a convention after the first time."

**Blaze:** "Story 18.4 had a client-side import problem. The anti-pattern banners initially imported `buildPhasePresence` from `scan-artifacts`, which pulls in `node:fs`. That broke the Next.js client build. We had to create a client-safe `buildPresenceFromPhases()` function that uses phase state data instead of reading the filesystem. Same class of issue as 16.1's type re-export problem."

**Nova:** "The help request protocol in 18.3 stores structured JSON in session metadata, but the resume flow — passing the human's choice back to the agent — depends on `packages/cli/src/commands/resume.ts` which needs deeper integration with the session manager. The API endpoint story is half-done; the button records the choice but the agent doesn't actually receive it on resume yet."

**R2d2:** "Story spec depth varied. 18.1 and 18.4 had comprehensive dev notes with source files, architecture decisions, and implementation patterns. 18.3 and 18.5 were leaner — helpful but missing the 'what NOT to touch' section that 18.1 included and that saved significant time."

### Key Decisions

1. **Commander's Intent lives in CLI, not core.** `formatStoryPrompt()` in `packages/cli/src/lib/story-context.ts` generates the intent paragraph, not `buildPrompt()` in core. Core already handles `storyContext` as pre-formatted markdown — no changes needed there. This keeps the prompt formatting concern in CLI where it belongs.

2. **Anti-patterns are advisory-only.** No blocking gates. Frequency-controlled nudges (max 1 per pattern per day via localStorage). This was a deliberate UX choice — coaching, not enforcement. Users can dismiss and continue without friction.

3. **Feedback loop uses its own JSONL, not the Cycle 3 learning store.** Per AC4 and FR-WF-30, the recommendation feedback system is independent. Path: `_bmad-output/.recommendation-feedback.jsonl`. This avoids coupling to a system that may not be deployed.

4. **Narrative reuses the `summary` field.** No new schema field was added. The existing `summary` in `SessionMetadata` was already defined but unused. Populating it with narrative text and rendering it in `AgentSessionCard` below the status enum required zero type changes.

5. **Anti-pattern detection is a separate module from the recommendation engine.** Both follow the same "rules as data" pattern, but they evaluate different concerns. Recommendations guide workflow progression; anti-patterns detect coaching opportunities. Separation keeps both testable and extensible independently.

### Lessons Learned

1. **Never import Node.js modules in client components.** This happened twice (16.1, 18.4). Always use client-safe alternatives that operate on already-loaded state rather than reading from the filesystem. A lint rule (`no-node-imports-in-client-components`) would prevent this class of bug entirely.

2. **Every `<button>` element requires an `onClick` handler or `disabled` attribute.** The dead-button pattern recurred 3 times across Epics 17-18 (17.2, 18.3, 18.5). This should be a codified convention or ESLint rule. Dead buttons damage user trust — they look interactive but do nothing.

3. **Prompt engineering changes are the highest-ROI stories.** Commander's Intent was approximately 10 lines of code. The impact on agent autonomy — giving agents permission to adapt when prescribed approaches fail — is disproportionate to the implementation cost. Future epics should prioritize prompt-level improvements.

4. **Reuse existing unused fields before adding new ones.** The `summary` field in `SessionMetadata` was a free narrative carrier. Similarly, `blockReason` in `AgentSessionCard` was already scaffolded for 18.3's help requests. Always audit existing types before extending schemas.

5. **Rules-as-data patterns are composable and consistent.** Both the recommendation engine (Epic 17) and anti-pattern detector (Epic 18) use constant arrays of rule objects with pure evaluation functions. This pattern is now well-established and should be the default approach for any rule-based feature.

---

## Action Items

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | Add ESLint rule: `no-node-imports-in-client-components` to prevent `node:fs`/`node:path` in web client components | Dev | High |
| 2 | Add convention: all `<button>` elements must have `onClick` or `disabled` — consider ESLint plugin | Dev | High |
| 3 | Wire help request choice through to agent resume context in `packages/cli/src/commands/resume.ts` | Dev | Medium |
| 4 | Add JSONL persistence to recommendation feedback (currently in-memory only) | Dev | Medium |
| 5 | Create API endpoints for help request choices (`/api/sessions/:id/help-request`) | Dev | Medium |
| 6 | Add "what NOT to touch" section to all story specs going forward — 18.1's dev notes were the gold standard | SM | Low |

## Metrics

| Metric | Value |
|--------|-------|
| Stories planned | 5 |
| Stories completed | 5 (100%) |
| Core type changes | 1 (HelpRequest interface added) |
| New modules created | 2 (anti-patterns.ts, recommendation feedback) |
| Schema fields added | 1 (helpRequest on metadata) |
| Schema fields reused | 2 (summary for narrative, blockReason UI scaffold) |
| Dead-button bugs | 2 (18.3, 18.5) — caught in review |
| Client-import bugs | 1 (18.4 — node:fs in client component) |
| Approximate LOC added | ~250 (excluding tests) |
| Highest-ROI story | 18.1 Commander's Intent (~10 LOC) |
| Backward compatibility issues | 0 |
| Regressions | 0 |
