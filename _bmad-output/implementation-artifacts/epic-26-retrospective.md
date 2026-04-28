# Epic 26 Retrospective — Command Palette & Agent Profiles

**Date**: 2026-03-21
**Epic**: 26 — Command Palette & Agent Profiles
**Status**: Complete (all 3 stories done)
**Source**: epics-cycle-5.md

## Epic Summary

Epic 26 delivered two distinct but complementary features: a global Command Palette (Cmd+K) for the web dashboard, and an agent personality profile system with automatic story-agent matching. The Command Palette provides a keyboard-driven overlay with substring-matching action search, backdrop dismiss, and Escape-to-close. The profile system defines three built-in agent personalities (Careful, Speed, Security) with configurable validation frequency, test coverage thresholds, and security check flags. The `recommendProfile()` function scores each profile against story characteristics (complexity, domain tags, security sensitivity) and returns ranked recommendations with explanatory reasons.

Both stories 26.2 and 26.3 were delivered in a single commit since the profile types and matching logic share the same module.

## Story Delivery

| Story | Title | Tests | Review Issues | Status |
|-------|-------|-------|--------------|--------|
| 26-1 | Command Palette (Cmd+K) | 8 | No formal review | Done |
| 26-2 | Agent Personality Profiles | 8 | No formal review | Done |
| 26-3 | Story-Agent Personality Matching | (included in 26-2) | No formal review | Done |

**Total new tests**: 16 (8 component tests + 8 unit tests)
**New files**: 4 (2 source + 2 test)
**External dependencies added**: 0

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead) — feature vision, user outcomes, quality standards
- Nova (Architect) — module design, extensibility, integration points
- Blaze (Dev) — implementation patterns, code quality, pain points
- Pax (QA) — test coverage, edge cases, correctness verification

---

### What Went Well

**R2d2 (Project Lead):** Three stories, two commits, clean delivery in under an hour. The Command Palette is a power-user feature that makes the dashboard significantly more navigable — Cmd+K to open, type to filter, click to execute. The agent profile system is the foundation for intelligent agent assignment. Right now it has three profiles and a scoring function, but the interface is extensible. Adding new profiles or tuning the scoring weights is straightforward. Both features shipped with zero external dependencies, which keeps the bundle lean.

**Nova (Architect):** Two design decisions that worked well:

1. **`PaletteAction` as a generic interface** — The Command Palette accepts an array of `PaletteAction` objects (id, label, description, category, action callback). This decouples the palette from any specific command set. The parent component owns the actions list, the palette owns the UI and filtering. Adding commands is purely a data concern, no palette code changes needed.

2. **Scoring-based profile recommendation** — The `recommendProfile()` function returns all three profiles ranked by score with an attached reason string. This is better than returning a single "best" match because callers can present alternatives to the user or apply secondary logic. The reason field makes recommendations explainable, which matters for trust when agents are assigned automatically.

**Blaze (Dev):** The Command Palette implementation is clean React — `useState` for open/query, `useRef` for input focus, `useCallback` for the global keydown handler with proper cleanup in the `useEffect` return. The fuzzy matching is simple case-insensitive substring matching against both label and description. Not true fuzzy search (no typo tolerance, no ranked relevance), but for a dashboard with ~20 actions, substring matching is sufficient and avoids pulling in a dependency like fuse.js.

The profile module is pure TypeScript with no React dependency. It can be imported from the CLI, from server-side code, or from the web app without any bundling concerns. The `StoryCharacteristics` interface is minimal — just complexity, domains, and a security flag — which makes it easy for callers to construct.

**Pax (QA):** 16 tests total with good coverage. Command Palette tests cover: hidden-by-default, open on Ctrl+K, show all actions unfiltered, filter by query, execute-and-close, Escape-to-close, backdrop-click-to-close, empty results message. Profile tests cover: profile count, field validation, careful recommendation for high complexity, speed recommendation for low complexity, security recommendation for security-sensitive stories, speed penalty for security-sensitive stories, sorted ranking, and reason string presence. The edge cases are covered — empty query shows all actions, no matches shows a message, security-sensitive stories penalize the speed profile below its base score.

---

### What Could Be Improved

**R2d2 (Project Lead):** No formal code reviews on any of the three stories. This is consistent with the Cycle 5 retrospective finding that "Code review found unintegrated components." The Command Palette was flagged in the cycle retro as created but not wired into the parent layout — a separate fix commit was needed. If we had reviewed 26-1 immediately, the integration gap would have been caught before the cycle review.

**Nova (Architect):** The profile scoring function uses hardcoded magic numbers — base score 50, security bonus +30, complexity bonus +25, security penalty -20. These should be named constants or configurable weights. If we add more profiles or more characteristics, tuning these numbers becomes error-prone. A `ScoringConfig` interface with documented weights would make the scoring logic maintainable.

The `StoryCharacteristics.domains` field is defined but unused in the scoring algorithm. The function accepts it but never reads it. This is either a forward-looking placeholder (domains will factor into future scoring) or dead input. If it is intentional, a comment explaining the intent would prevent confusion.

**Blaze (Dev):** The Command Palette uses `setTimeout(() => inputRef.current?.focus(), 50)` for auto-focus on open. The 50ms delay is a workaround for React's render timing, but it is fragile. A more robust approach would use `requestAnimationFrame` or a layout effect. In practice, 50ms works, but it is the kind of magic number that breaks on slow devices or under heavy render load.

The palette also does not support keyboard navigation within the results list. Arrow keys to move up/down, Enter to select — these are standard command palette behaviors (VS Code, Raycast, Spotlight). Right now, users must click actions with the mouse. This limits the keyboard-driven workflow that the palette is supposed to enable.

**Pax (QA):** The profile tests verify scoring arithmetic but do not test boundary conditions for the complexity field. The interface says complexity is 1-5, but the function does not validate the range. What happens if complexity is 0, -1, or 100? The scoring function would produce unexpected results without error or warning. Input validation on `StoryCharacteristics` would make the matching more robust.

The CommandPalette tests mock actions with `vi.fn()` callbacks but do not verify that the palette handles rapidly changing action lists (e.g., actions added/removed while the palette is open). This is an edge case but plausible in a dashboard with real-time state updates.

---

### Key Decisions

1. **Stories 26.2 and 26.3 delivered as a single commit** — The profile types (`AgentProfile`, `StoryCharacteristics`, `ProfileRecommendation`) and the matching function (`recommendProfile`) were naturally co-located. Splitting them across two commits would have created a temporary state where types exist but the function does not, with no benefit.

2. **Substring matching instead of fuzzy search** — True fuzzy matching (e.g., fuse.js) adds ~15KB to the bundle and introduces a dependency. For a dashboard with a bounded set of ~20-30 actions, case-insensitive substring matching is sufficient and keeps the implementation dependency-free.

3. **Scoring-based recommendation over rule-based** — A rules engine ("if security-sensitive then use Security profile") is simpler but brittle. A scoring system where every profile gets a numeric score allows tie-breaking, secondary sorting, and presenting alternatives. The reason string attached to each score makes the decision explainable.

4. **No keyboard navigation in results** — Shipped without arrow-key navigation in the results list. This was a scope decision: the palette works for mouse users and the Cmd+K open/close is keyboard-driven. Full keyboard navigation can be added as a follow-up without API changes.

---

### Lessons Learned

1. **Always wire new components into parent layouts in the same story** — The Command Palette was created as a standalone component but not added to `WorkflowDashboard`. The cycle review caught this, but it required a separate fix commit. The "renders in parent" acceptance criterion convention (established in Story 37.3 later) would have prevented this.

2. **Co-located types and logic in a single module is fine for small domains** — The agent-profiles module has types, constants, and a function in one file (~100 lines). This is appropriate for the current scope. When profiles become user-configurable or the scoring logic grows, the module should be split.

3. **Scoring functions should have named constants, not magic numbers** — The profile scoring weights (50, +30, +25, -20) work but are opaque. Named constants like `BASE_SCORE`, `SECURITY_BONUS`, `HIGH_COMPLEXITY_BONUS`, `NO_SECURITY_PENALTY` would make the scoring logic self-documenting and tunable.

---

### Action Items

| # | Action Item | Owner | Priority |
|---|------------|-------|----------|
| 1 | Wire CommandPalette into WorkflowDashboard layout (done in separate fix commit) | Dev | Done |
| 2 | Add keyboard navigation (Arrow Up/Down, Enter) to CommandPalette results | Dev | MEDIUM |
| 3 | Extract scoring weights into named constants in agent-profiles.ts | Dev | LOW |
| 4 | Add input validation for StoryCharacteristics.complexity range (1-5) | Dev | LOW |
| 5 | Document or implement domain-based scoring in recommendProfile() | Dev | LOW |

---

## Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 3 |
| New source files | 2 (CommandPalette.tsx, agent-profiles.ts) |
| New test files | 2 |
| Total tests added | 16 |
| External dependencies added | 0 |
| Commits | 2 |
| Epic duration | ~5 minutes (both commits within 3 minutes) |
| Agent model used | Claude Opus 4.6 (1M context) |
| Formal code reviews | 0 |
| Integration fixes required | 1 (palette not wired into layout) |
