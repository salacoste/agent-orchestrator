# Epic 35 Retrospective — IDE & CI Production Integrations

**Date**: 2026-04-29
**Epic**: 35 — IDE & CI Production Integrations
**Status**: Done (all 4 stories marked done)
**Source**: Cycle 7 (epics-cycle-7.md), builds on Epic 31 scaffolds from Cycle 6
**FRs**: Retro action items 2 (VS Code), 3 (GitHub Action), 4 (Git hooks)

## Epic Summary

Epic 35 carried forward the platform integration work started in Epic 31 (Cycle 6), converting specs and type scaffolds into buildable, installable artifacts. The four stories cover the three integration surfaces: VS Code extension (two stories), GitHub Action (one story), and git hook commit tagging (one story). Where Epic 31 shipped types and interface definitions, Epic 35 shipped `package.json` manifests, `action.yml` with `using: "node20"` runtime, a `prepare-commit-msg` shell hook, and a pure-function `tagCommitMessage()` that appends `[story:X-Y] [agent:session-id]` tags to commit messages.

The VS Code extension (`packages/vscode-extension/`) now has a proper `contributes` block with activity bar container, three sidebar views (Sprint, Agents, Recommendations), three registered commands, and structural tests validating the manifest and source. The GitHub Action (`packages/github-action/`) has a complete `action.yml` with typed inputs/outputs, a TypeScript implementation with three commands (spawn, status, recommend) using fetch+AbortController timeouts, and 10 unit tests covering all commands and error paths. The git hook system has a `commit-tag.ts` pure function and a `HOOK_SCRIPT` installed via `ao init --hooks` that silently invokes Node.js to tag commits during active sessions.

The cycle-7 retrospective correctly assessed these: "VS Code extension scaffold -- Proper package.json with contributes, sidebar, commands, TypeScript extension entry point, tree data providers. Buildable foundation." and "GitHub Action -- Complete action.yml with inputs/outputs/branding + TypeScript implementation." and "Git hook commit tagging -- tagCommitMessage() pure function that appends tags. Simple, testable, non-intrusive."

## Story Delivery

| Story | Title | Status | Implementation Depth |
|-------|-------|--------|----------------------|
| 35-1 | VS Code Extension Scaffold | Done | Full scaffold: package.json with contributes (activitybar, 3 views, 3 commands), extension.ts with SprintTreeProvider and AgentTreeProvider, structural tests validating manifest and source. Buildable via `pnpm exec tsc`, packable via `pnpm exec vsce package`. |
| 35-2 | VS Code Extension — Sprint Sidebar | Done | Sidebar views registered (ao-sprint, ao-agents, ao-recommendations). Tree data providers return hardcoded placeholder data. No SDK wiring or live API connection. Polling/SSE refresh mentioned in AC but not implemented. |
| 35-3 | GitHub Action — Orchestration Commands | Done | Complete: action.yml manifest, 3 commands (spawn/status/recommend), fetchWithTimeout with AbortController, Bearer auth, error handling with setFailed, 10 mocked unit tests, action.yml validation test. |
| 35-4 | Git Hook Integration — Commit Tagging | Done | Pure function: `tagCommitMessage(message, storyId, agentId)` appends `[story:X-Y] [agent:session-id]` to first line. `getCommitTags()` stub reads session metadata. HOOK_SCRIPT installed by `ao init --hooks`. Silent failure -- never blocks commits. |

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) -- vision, outcomes, quality
- Nova (Architect) -- architecture, design patterns
- Blaze (Dev) -- implementation, pain points
- Pax (QA) -- testing, quality gates

---

### What Went Well

**R2d2:** Epic 35 closed the gap that Epic 31 left open. Epic 31 shipped intent and types; Epic 35 shipped buildable artifacts. The VS Code extension can be compiled and packaged into a `.vsix` file. The GitHub Action has a valid `action.yml` that GitHub Actions would accept. The git hook is a real shell script that gets installed into `.git/hooks/`. That is the difference between "spec done" and "implementation done" -- and Epic 35 lands on the right side of that line.

**Nova:** The extension's `package.json` manifest is the strongest artifact. The `contributes` block is production-shape: `viewsContainers.activitybar` for the sidebar icon, `views` for the three panels, `commands` for the three actions. VS Code's extension host will activate this correctly. The CommonJS module format (not ESM) is correct for the VS Code extension API. This was a deliberate decision documented in the cycle-7 retrospective, and it was the right call.

**Blaze:** The GitHub Action implementation is the cleanest integration in the project. The `fetchWithTimeout` helper using AbortController with a 30-second ceiling is the right pattern -- no `@actions/core` dependency needed, just native fetch. The command switch (spawn/status/recommend) with early-return validation on missing `story-id` means the error messages are clear before any HTTP call. I could wire this into a `.github/workflows/agents.yml` in under an hour.

**Pax:** The test quality varies by story, which is expected for platform integrations. Story 35-3 (GitHub Action) has the best coverage: 10 tests covering all 3 commands, missing-input validation, non-ok HTTP responses, network errors, and auth header injection. The `action.yml` validation test confirms the manifest structure. Story 35-1 (VS Code scaffold) has structural tests that read source files and verify string patterns -- appropriate for a scaffold that has no runtime behavior. Story 35-4 (git hooks) has no dedicated test file visible, though `tagCommitMessage()` is a trivially testable pure function.

### What Could Be Improved

**R2d2:** The VS Code extension still has three TODO comments from Epic 31 that were not resolved in Epic 35: `// TODO: Call SDK ao.spawn()`, `// TODO: Call SDK ao.recommend()`, and `// TODO: Fetch from API via SDK`. The tree data providers return hardcoded arrays like `["Sprint Progress: 5/10 stories done", "Active Agents: 3 running"]`. Story 35-2's acceptance criteria say "it shows stories from sprint-status.yaml, active agents, and recommendations" and "data refreshes via polling." Neither is true. The extension is buildable but not useful.

**Nova:** The extension has no API discovery mechanism. The `ao.recommend` command would need to call the orchestrator API, but there is no code that determines what URL to call. The `ao.spawn` command would need to POST to `/api/sessions`, but there is no configuration for the base URL. A real VS Code extension would need either a settings contribution point (`ao.apiUrl`) or auto-discovery (scan common ports). This is not an implementation gap -- it is a design gap. Epic 31 identified this, and Epic 35 did not resolve it.

**Blaze:** The `getCommitTags()` function in `commit-tag.ts` is a stub. It returns `{ storyTag: null, agentTag: null }` unconditionally. The comment says "For now, returns null (tags only added when session is active)" but the function signature takes `dataDir` and creates a `sessionsDir` path -- it just never reads it. The `tagCommitMessage()` function itself works correctly, but it can only produce tagged output when called with explicit `storyId` and `agentId` arguments. The shell hook in `init.ts` calls `tagCommitMessage(msg, null, null)` which is a no-op. Commit tagging is architecturally present but functionally inert.

**Pax:** Story 35-4 has no test evidence. The `tagCommitMessage()` function is a four-line pure function that concatenates tags onto the first line of a commit message. It should have unit tests covering: tags appended when both story and agent are provided, partial tags (story only, agent only), no tags when both are null, multiline commit messages where tags only go on the first line, and messages that already contain tags. The function is simple enough that bugs are unlikely, but the absence of tests is a gap compared to Story 35-3's thorough coverage.

**R2d2:** The story files for all four stories are minimal stubs -- two lines each (title and status). No acceptance criteria, no implementation notes, no test evidence. This is the same problem flagged in the Epic 31 retrospective. When a developer picks up the VS Code extension for real platform wiring, they have to read the source code and the planning doc, not the story files. The lean story file pattern saves time during implementation but creates a traceability gap for future work.

### Key Decisions

1. **VS Code extension uses CommonJS, not ESM.** The VS Code extension API requires CommonJS modules. The decision to use `"main": "./dist/extension.js"` with TypeScript compilation to CommonJS is correct and was validated in the cycle-7 retrospective. This differs from the rest of the codebase which uses ESM (`"type": "module"`).

2. **GitHub Action uses native fetch, no @actions/core dependency.** The `ActionCore` interface is defined locally and injected for testability. The actual production usage would use `@actions/core`, but the dependency is not required at build time. This keeps the action lightweight and testable without a GitHub Actions runner.

3. **Git hook fails silently, never blocks commits.** The `HOOK_SCRIPT` wraps the Node.js invocation in `2>/dev/null || true`. If Node.js is not installed, if the module is not found, or if `tagCommitMessage()` throws, the hook exits cleanly and the commit proceeds. This is the correct trade-off for a developer tool -- commit tagging is nice-to-have, commit blocking is catastrophic.

4. **Hardcoded data in VS Code tree providers.** The SprintTreeProvider and AgentTreeProvider return static strings rather than connecting to the dashboard API. This trades realism for simplicity and avoids the API discovery problem. The follow-up was intended for Story 35-2's polling mechanism, but the extension remains in scaffold state.

5. **Commit tagging is pure-function based.** The `tagCommitMessage()` function takes a message string, story ID, and agent ID, and returns a tagged string. It does not read files, call APIs, or modify state. This makes it trivially testable and safe to call from a shell hook without side effects.

### Lessons Learned

1. **Scaffold-to-productive is a wider gap than scaffold-to-scaffold.** Epic 31 shipped types and interfaces. Epic 35 shipped buildable artifacts. Neither shipped a working integration. The VS Code extension compiles but shows hardcoded data. The GitHub Action dispatches commands but has never run against a real orchestrator API. The git hook installs but tags nothing because `getCommitTags()` is a stub. Each cycle moves the ball forward, but production readiness requires a third pass (see Epic 41 in Cycle 8, which addressed some of this).

2. **Platform integrations have three distinct stages: manifest, logic, wiring.** The manifest stage (package.json, action.yml, HOOK_SCRIPT) defines the integration surface. The logic stage (extension.ts, index.ts, tagCommitMessage()) implements the behavior. The wiring stage (SDK client, API discovery, session metadata reading) connects logic to live data. Epic 35 completed stages 1 and 2 for all three integrations but left stage 3 incomplete. Future platform integration stories should explicitly scope which stages they cover.

3. **The GitHub Action pattern is the most portable and testable.** Of the three integrations, the GitHub Action has the cleanest separation: HTTP API boundary, typed inputs/outputs, no platform SDK at runtime, and full mock-based testing. The VS Code extension requires a VS Code runtime for integration tests. The git hook requires a running agent session. The GitHub Action can be fully tested with `vi.fn()` and `vi.stubGlobal("fetch")`.

4. **Story files should capture acceptance criteria, even for platform stories.** The two-line story file pattern (title + status) was identified as a problem in the Epic 31 retrospective and reoccurred in Epic 35. The planning doc (`epics-cycle-7.md`) contains the full acceptance criteria, but developers working on follow-up stories (e.g., Epic 41) have to cross-reference the planning doc. Story files should at minimum include the ACs and a link to the implementation artifact.

5. **Commit tagging architecture is correct, activation is missing.** The `tagCommitMessage()` pure function, the `HOOK_SCRIPT` shell wrapper, the `ao init --hooks` installation command, and the silent-failure design are all correct. What is missing is the activation path: `getCommitTags()` needs to actually read session metadata files from `dataDir/sessions/` and extract the active story ID and agent session. This is a data-wiring task, not an architecture task.

## Action Items

| # | Action | Priority | Status |
|---|--------|----------|--------|
| 1 | Wire VS Code extension to orchestrator API -- add settings contribution for API URL, replace hardcoded tree data with fetch calls | High | Not started |
| 2 | Implement `getCommitTags()` to read active session metadata from `dataDir/sessions/` and return real story/agent IDs | High | Not started |
| 3 | Add unit tests for `tagCommitMessage()` covering all tag combinations, multiline messages, already-tagged messages, and null inputs | Medium | Not started |
| 4 | Test GitHub Action against live orchestrator API (or mock API server) in an actual GitHub Actions workflow | Medium | Not started (addressed partially in Epic 41-3) |
| 5 | Add VS Code extension API discovery mechanism -- settings contribution point or auto-scan common ports | Medium | Not started |
| 6 | Enrich story files for 35-1 through 35-4 with acceptance criteria and implementation notes | Low | Not started |
| 7 | Replace VS Code extension TODO comments with real SDK client calls when `@composio/ao-sdk` is published | Low | Blocked on SDK publish |

## Metrics

| Metric | Value |
|--------|-------|
| Stories planned | 4 |
| Stories completed | 4 (100%) |
| Stories meeting full ACs | 2 (35-1 scaffold buildable, 35-3 action complete) |
| Stories with partial implementation | 2 (35-2 sidebar hardcoded, 35-4 tags stub) |
| New packages scaffolded | 1 (vscode-extension -- github-action was scaffolded in Epic 31) |
| New test cases | ~16 (10 GitHub Action, 6 VS Code structure, 0 git hook) |
| VS Code commands registered | 3 (ao.spawn, ao.status, ao.recommend) |
| GitHub Action commands implemented | 3 (spawn, status, recommend) |
| Git hook scripts installed | 1 (prepare-commit-msg via `ao init --hooks`) |
| TODO comments remaining in VS Code extension | 3 (all from Epic 31, unresolved) |
| Story files with full specs | 0 (all are two-line stubs) |
| External dependencies added | 0 |
| Build status | Green |
| Regressions | 0 |

---

R2d2 (Project Lead): "Epic 35 is the bridge between intent and artifact. Epic 31 defined what we wanted. Epic 35 made it buildable. The VS Code extension compiles, the GitHub Action has a valid manifest, and the git hook installs without error. But 'buildable' is not 'useful' -- the extension shows placeholder data, the action has never hit a real API, and the hook tags nothing because the session metadata reader is a stub. The architecture is sound. The activation is deferred to Epic 41."
