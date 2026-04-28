# Epic 31 Retrospective — IDE & CI Integrations

**Date**: 2026-04-29
**Epic**: 31 — IDE & CI Integrations
**Status**: Complete (all stories marked done — types/interfaces/scaffold only)
**Source**: Cycle 6

## Epic Summary

Epic 31 defined the integration surface for embedding Agent Orchestrator into three external platforms: VS Code (sidebar panel), GitHub Actions (CI/CD orchestration), and git hooks (commit provenance tagging). All three stories shipped with type definitions, interface scaffolds, and test coverage, but the implementations are stubs rather than production-ready platform integrations. The VS Code extension registers tree data providers with hardcoded placeholder data and three TODO comments for SDK wiring. The GitHub Action defines `action.yml`, implements three commands (spawn, status, recommend) with full fetch+timeout logic and 10 unit tests, but has never run against a real CI pipeline. The git hook story produced only the acceptance criteria in the epic spec — the actual `prepare-commit-msg` hook and `commit-tag.ts` implementation landed later in Epic 35 (Stories 35.4 and 41.4).

The Cycles 4-5-6 retrospective flagged this explicitly: "Epic 31 implementation is types/interfaces only — actual VS Code extension, GitHub Action need real platform integration work." Epic 35 (IDE & CI Production Integrations) was subsequently created to carry the production implementation forward.

## Story Delivery

| Story | Title | Status | Implementation Depth |
|-------|-------|--------|----------------------|
| 31.1 | VS Code Extension — Orchestrator Sidebar | Done | Scaffold only: tree data providers with hardcoded data, 3 commands with TODO stubs, no SDK wiring |
| 31.2 | GitHub Action — CI/CD Orchestration | Done | Action scaffold + logic: `action.yml` manifest, 3 commands (spawn/status/recommend) with fetch+timeout, 10 mocked unit tests |
| 31.3 | Git Hook Integration | Done | Spec only: acceptance criteria defined in epic planning. Actual implementation shipped in Epic 35 (Stories 35.4, 41.4) |

---

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead), Nova (Architect), Blaze (Dev), Pax (QA)

---

### What Went Well

**Nova (Architect):**
Epic 31 correctly identified the three integration surfaces that matter: editor (VS Code), CI (GitHub Actions), and local workflow (git hooks). The separation of concerns is clean — each story targets one slot, each slot has a distinct interface boundary. The GitHub Action (31.2) went furthest because it maps cleanly onto existing API routes (`/api/sessions`, `/api/workflow/{projectId}`). The action.yml manifest with typed inputs/outputs and `using: "node20"` runtime is production-shape even if the API backend it calls does not fully exist yet.

**Blaze (Dev):**
The GitHub Action implementation (`packages/github-action/src/index.ts`) is genuinely useful scaffold. The `fetchWithTimeout` helper with AbortController, the command switch (spawn/status/recommend), error handling with `setFailed`, and Bearer token auth — that is real logic, not just types. The 10 unit tests with mocked `ActionCore` and `fetch` prove the command dispatch and error paths work. I could take this and wire it into a real workflow file in an afternoon.

**Pax (QA):**
Story 31.2 has the best test coverage of the three — 10 tests covering all 3 commands, missing-input validation, non-ok HTTP responses, network errors, and auth header injection. The `action.yml` validation test confirms the manifest structure. Story 31.1 has structural tests (checking source strings for `registerTreeDataProvider`, command IDs) but no runtime behavior tests — appropriate since the extension has no runtime behavior beyond hardcoded data.

**R2d2 (Project Lead):**
The epic correctly scoped what was achievable in a single cycle. Trying to build a real VS Code extension (with `vsce` packaging, marketplace publishing, WebSocket connections to the dashboard API) would have consumed the entire cycle. Instead, we defined the shape and deferred the platform work to Epic 35. The follow-through was good — Epic 35 stories (35.1-35.4) actually shipped the vsce scaffold, the CI workflow testing, and the git hook implementation.

### What Could Be Improved

**Nova (Architect):**
Story 31.3 (Git Hook Integration) has zero implementation artifacts. The story file is two lines (title + status: done). The acceptance criteria exist only in the epic planning doc (`epics-cycle-6.md`). Meanwhile, the actual git hook shipped in Stories 35.4 and 41.4 — `packages/cli/src/hooks/commit-tag.ts` and the `HOOK_SCRIPT` in `init.ts`. Marking 31.3 as "done" when it was really "deferred" creates a misleading sprint history. We should have tracked it as "deferred to Epic 35" rather than "done."

**Blaze (Dev):**
The VS Code extension (`packages/vscode-extension/src/extension.ts`) has three TODO comments: `// TODO: Call SDK ao.spawn()`, `// TODO: Call SDK ao.recommend()`, and `// TODO: Fetch from API via SDK`. The `getChildren()` methods return hardcoded arrays like `["Sprint Progress: 5/10 stories done", "Active Agents: 3 running"]`. This is a prototype, not a scaffold. A scaffold would define the API client interface and wire it to the tree providers even if the backend returns mock data. The current state requires rewriting the data flow, not just swapping a mock for a real client.

**Pax (QA):**
The story files for all three stories (`31-1-*.md`, `31-2-*.md`, `31-3-*.md`) are each two lines. No acceptance criteria, no implementation notes, no test evidence. Compare this to stories from earlier cycles (e.g., Story 24.1 with full ESLint rule documentation, or Story 56.3 with 28KB of risk calculation details). The lean story file pattern accelerated Cycle 6 velocity but at the cost of traceability. When someone picks up the Epic 35 production work, they have to read the source code and the planning doc, not the story files.

**R2d2 (Project Lead):**
The gap between "marked done" and "production-ready" is wider here than any other epic in Cycle 6. Epic 30 (Compound Learning) shipped pure modules with real test coverage. Epic 29 (Accessibility) shipped real utility functions. Epic 31 shipped intent. The lesson: platform integration stories need a different completion bar than pure-module stories. We addressed this by creating Epic 35, but we should have distinguished "spec complete" from "implementation complete" in the original planning.

### Key Decisions

1. **Ship specs + types instead of blocking on platform work** — Correct call for Cycle 6 velocity. Building real VS Code extension packaging (`vsce`), CI workflow testing, and hook installation would have consumed the cycle. The spec-first approach let us define interfaces and move on.

2. **GitHub Action got the deepest implementation** — The fetch-based command dispatcher with timeout, auth, and error handling is near-production quality. This was the right story to invest in because the interface boundary (HTTP API) is well-defined and testable without platform dependencies.

3. **Git hook deferred to Epic 35** — Story 31.3 acceptance criteria were defined but no code was written in Cycle 6. The actual implementation (prepare-commit-msg hook, `tagCommitMessage()`, `ao init --hooks`) shipped in Stories 35.4 and 41.4. This was honest scoping but the "done" label was misleading.

4. **Hardcoded data in VS Code extension** — The tree providers return static strings rather than connecting to the dashboard API. This trades realism for simplicity and avoids the question of how a VS Code extension discovers the orchestrator API URL. The follow-up story (35.2) was intended to address this but the extension remains in scaffold state.

### Lessons Learned

1. **"Done" should distinguish spec-complete from implementation-complete.** Epic 31 has three stories marked done, but only 31.2 (GitHub Action) has runnable code with test coverage. Story 31.3 has no code at all. Future planning should use two status tiers: "Spec Done" and "Implementation Done." The Cycles 4-5-6 retro action item ("Distinguish spec + types stories from full implementation stories in planning") was identified but never formally adopted.

2. **Platform integration stories have hidden dependencies.** VS Code extension needs `vsce` tooling, marketplace account, and WebSocket or HTTP connection to the dashboard. GitHub Action needs a running orchestrator API and a workflow YAML consuming the action. Git hooks need the CLI `init` command and session metadata files. These dependencies are not visible in the story ACs but dominate the actual implementation effort.

3. **The GitHub Action pattern is the most portable.** Of the three integrations, the GitHub Action has the cleanest separation: HTTP API boundary, typed inputs/outputs, no platform SDK dependency at runtime (just Node.js fetch). This makes it the best candidate for "first production integration" because it can be tested with a mock API server without GitHub infrastructure.

4. **Epic follow-through worked.** Epic 35 (IDE & CI Production Integrations) was explicitly created to carry the platform work forward. Stories 35.1 (VS Code scaffold), 35.2 (sidebar panel), 35.3 (GitHub Action orchestration commands), and 35.4 (git hook commit tagging) all reference back to the Epic 31 specs. The Epic 31 work was not lost — it was correctly staged.

5. **Lean story files have a cost.** The two-line story files for 31.1/31.2/31.3 saved time during Cycle 6 implementation but create a traceability gap. When the Epic 35 developer searches for Story 31.1 context, they find nothing useful in the story file. All context lives in the planning doc and source code.

---

## Action Items

| # | Action | Status | Notes |
|---|--------|--------|-------|
| 1 | Build production VS Code extension from 31.1 scaffold | Deferred to Epic 35 | Need SDK client, API discovery, vsce packaging |
| 2 | Test GitHub Action against live orchestrator API | Deferred to Epic 35 | Story 41.3 added tests but no CI workflow |
| 3 | Ship git hook installation (completed in Epic 35) | Done | `ao init --hooks` + `commit-tag.ts` shipped in Stories 35.4/41.4 |
| 4 | Adopt "Spec Done" vs "Implementation Done" status tiers | Open | Identified in Cycles 4-5-6 retro, not yet formalized |
| 5 | Enrich story files for platform integration stories | Open | 31.1/31.2/31.3 files are two lines each; should capture ACs and implementation notes |
| 6 | Define API discovery mechanism for VS Code extension | Open | Extension currently has no way to find the orchestrator API URL |

## Metrics

| Metric | Value |
|--------|-------|
| Stories delivered | 3 (all marked done) |
| Stories with runnable code | 2 (31.1 scaffold, 31.2 action) |
| Stories with production integration | 0 (all deferred to Epic 35) |
| New test cases | ~15 (10 for GitHub Action, 5 for VS Code structure) |
| VS Code extension commands registered | 3 (ao.spawn, ao.status, ao.recommend) |
| GitHub Action commands implemented | 3 (spawn, status, recommend) |
| Git hook scripts written (in Epic 31) | 0 (shipped in Epic 35) |
| TODO comments remaining | 3 (all in extension.ts) |
| Story files with full specs | 0 (all are two-line stubs) |
