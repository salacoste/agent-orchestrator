# Epic 24 Retrospective — DX & Quality Infrastructure

**Date**: 2026-04-29
**Epic**: 24 — DX & Quality Infrastructure
**Status**: Complete (all stories done)
**Source**: Cycle 5

## Epic Summary

Epic 24 delivered two DX guardrails that permanently prevent recurring bugs from Cycles 3-4. Story 24.1 added an ESLint `no-restricted-imports` rule blocking `node:*` imports in client-side files, preventing the Next.js bundling crash that hit Stories 16.1 and 18.4. Story 24.2 audited all dashboard buttons for missing onClick handlers, finding and fixing one dead button in `DeadLetterQueueViewer.tsx`. Both stories shipped in a single commit alongside the Cycle 4 retrospective.

## Story Delivery

| Story | Title | Status |
|-------|-------|--------|
| 24.1 | ESLint No-Node-Imports-In-Client Rule | Done |
| 24.2 | Dead Button Audit & Fix | Done |

---

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead), Nova (Architect), Blaze (Dev), Pax (QA)

---

### What Went Well

**Nova (Architect):**
Story 24.1 was the highest-ROI story of Cycle 5. Five minutes of ESLint config eliminates an entire class of bundling failure. The `no-restricted-imports` rule with path-based overrides — targeting `src/components/**` and `src/app/**/page.tsx` while exempting `src/lib/` and `src/app/api/` — is the right granularity. Server-side code keeps `node:*` access; client code gets a clear error message explaining the "why" (Next.js bundle crash).

**Blaze (Dev):**
The dead button audit (24.2) was straightforward. One dead button found — in `DeadLetterQueueViewer.tsx`, which is a bit ironic. The fix was a 5-line change. More importantly, the audit established the pattern that later became Story 37-1 (formal dead-button lint rule). We identified the pattern, fixed the instance, and the escalation path was clear.

**Pax (QA):**
Both stories passed `pnpm lint` with zero new errors — AC2 for 24.1 was critical here. The rule must not flag existing valid code. The explanatory comment in the ESLint config satisfies AC3: new contributors can read the config and understand the context without git archaeology.

**R2d2 (Project Lead):**
Shipped as the first epic in Cycle 5, which was correct prioritization. These guardrails protect all subsequent development. The commit (1cc0590) bundled both stories cleanly with the Cycle 4 retro — minimal overhead, maximum impact.

### What Could Be Improved

**Blaze (Dev):**
Story 24.2 never got a dedicated story file in `_bmad-output/implementation-artifacts/`. The sprint-status.yaml tracks `24-2-dead-button-audit-fix: done`, but there is no spec document. The dead button pattern kept recurring (Stories 17.2, 18.3, 18.5, 19.2) — a formal spec would have captured the audit methodology for reuse. We eventually formalized it as Story 37-1, but the gap between 24.2 and 37.1 left the pattern unprotected for several cycles.

**Nova (Architect):**
The ESLint rule in `eslint.config.js` at the repo root is correct scope, but it could have been more granular. The current config uses glob patterns to distinguish client vs server paths, but Next.js server components (files with `"use server"` directive) are in the same `src/app/` tree. A future iteration could detect the directive rather than relying on path heuristics.

**Pax (QA):**
The dead button audit was manual — grep for `<button` elements, check for onClick or disabled. A custom ESLint rule (which eventually landed in 37-1 and 42-4) would have been better from the start. The audit found 1 dead button, but the Cycles 4-5-6 retro notes the pattern recurred 4 times total. We should have invested in the lint rule immediately rather than deferring it.

### Key Decisions

1. **Ship first in Cycle 5** — DX guardrails before feature work. Prevents bugs rather than fixing them post-hoc. This was the correct call given the Cycle 4 bundling failures.

2. **Path-based ESLint overrides vs custom rule** — For 24.1, the built-in `no-restricted-imports` rule was sufficient. No custom rule needed. For dead buttons (24.2), the manual audit was chosen over a custom ESLint rule for speed. The custom rule was deferred to Story 37-1.

3. **Error message includes context** — The ESLint rule message reads: "Node.js builtins cannot be imported in client components (breaks Next.js bundle). Use server-side API routes instead." This satisfies AC3 (documented reason) and provides actionable guidance, not just a cryptic error.

4. **Single commit for both stories** — 24.1 and 24.2 shipped together in commit 1cc0590 along with the Cycle 4 retrospective. Combined 5 files, 677 insertions. Appropriate because both stories were small, targeted changes with no cross-dependencies.

### Lessons Learned

1. **Lint rules are force multipliers.** A 29-line ESLint config entry (Story 24.1) prevents a failure mode that burned multiple stories across two cycles. The ROI on DX infrastructure is asymmetrically high.

2. **Audit findings should immediately become lint rules.** The dead button pattern was found 4 times before being automated. The gap between identification (24.2) and automation (37-1) was 13 epics. Next time: audit and automate in the same story.

3. **Missing story files create traceability gaps.** Story 24.2 has no spec document. Sprint status says done, but the audit methodology, scope, and findings exist only in the commit message. Formal specs should not be skipped even for small stories.

4. **Error messages in lint rules are documentation.** The comment in `eslint.config.js` serves as living documentation. Every developer who triggers the error reads the reason. This is more reliable than README docs that nobody reads.

---

## Action Items

| # | Action | Status | Notes |
|---|--------|--------|-------|
| 1 | Create dedicated story spec file for 24.2 retroactively | Open | Traceability gap in `_bmad-output` |
| 2 | Extend ESLint rule to detect `"use server"` directive for more precise client/server distinction | Deferred | Current path-based heuristics work for now |
| 3 | Establish convention: audit findings must produce lint rules in the same story | Adopted | Applied starting Story 37-1 |

## Metrics

| Metric | Value |
|--------|-------|
| Stories delivered | 2 |
| Dead buttons found | 1 (DeadLetterQueueViewer) |
| ESLint rules added | 1 (no-restricted-imports for `node:*`) |
| Files changed | 5 |
| Commit | 1cc0590 |
| New test files | 0 (lint rule verified via `pnpm lint`) |
| Recurring bugs prevented | Node import bundling crash (hit Stories 16.1, 18.4) |
