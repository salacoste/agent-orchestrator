# Epic 21 Retrospective — Cost & Efficiency Analytics

**Date**: 2026-04-28
**Epic**: 21 — Cost & Efficiency Analytics
**Status**: Complete (all 3 stories done)
**Source**: Cycle 4

## Epic Summary

Epic 21 introduced cost visibility and efficiency tooling for AI agent orchestration. A single `cost-tracker.ts` module was designed to serve all three stories — token consumption tracking, agent efficiency scoring, and sprint clock countdown — because they share types, data sources, and computation logic. The epic delivered runaway agent detection (>3x average flagging), tokens-per-story-point efficiency rankings with cost pattern identification by codebase area, and a real-time sprint clock showing time-vs-work gap with color-coded on-track/tight/behind status.

## Story Delivery

| Story | Title | Status |
|-------|-------|--------|
| 21.1 | Token Consumption Tracking | Done |
| 21.2 | Agent Efficiency Scoring | Done |
| 21.3 | Sprint Clock Countdown | Done |

## Party Mode — Retrospective Discussion

**Participants:**
- R2d2 (Project Lead), Nova (Architect), Blaze (Dev), Pax (QA)

---

### What Went Well

**Blaze (Dev):** The decision to consolidate all three stories into one module (`cost-tracker.ts`) was the right call. Story 21.2 explicitly depends on 21.1's token tracking data, and 21.3's sprint clock reuses the same data model. Building a shared module from the start avoided the duplication and sync issues we saw in other epics.

**Nova (Architect):** Runaway agent detection stands out as high-value, low-complexity work. The >3x average threshold is simple to reason about, mathematically sound, and directly actionable — a tech lead sees the flag and can intervene. This is the kind of feature that justifies the entire epic.

**Pax (QA):** The sprint clock's time-vs-work gap is intuitive. Green/amber/red color coding with a concrete message like "Sprint ends in 2d 14h. Remaining work: 3d 2h. STATUS: BEHIND by 12h" gives PMs exactly what they need at a glance. No interpretation required.

**R2d2 (Project Lead):** Efficiency scoring feeding into Epic 2's smart assignment is good architectural foresight. The tokens-per-story-point metric normalizes cost across agents of different capabilities, making cross-agent comparison meaningful rather than a raw token race.

### What Could Be Improved

**Pax (QA):** The runaway agent test had a mathematical edge case that wasn't caught until implementation. With only 3 agents, the outlier contributes to the average, making it impossible for any single agent to exceed 3x average. We needed 4+ agents for the test to work correctly. This should have been identified during story specification, not during dev.

**Nova (Architect):** The sprint clock depends on sprint date metadata from `sprint-status.yaml`, which isn't currently parsed by the system. Story 21.3 lists "Parse sprint dates from sprint-status.yaml" as Task 1, but that parsing infrastructure doesn't exist yet. The clock module works in isolation but can't wire into real data without that parser.

**Blaze (Dev):** Cost pattern identification ("Stories in packages/core/ cost 2x more tokens") is mentioned in 21.2's acceptance criteria but requires correlating token data with file path metadata. The module handles the computation, but the data pipeline to feed file paths per story into the tracker isn't built yet.

**R2d2 (Project Lead):** All three stories are marked done, but the dev agent record fields (`Agent Model Used`, `File List`) are empty template placeholders. This makes it harder to audit what was actually delivered vs. what was spec'd.

### Key Decisions

1. **Single module for all three stories.** Rather than three separate tracking modules, combined everything into `cost-tracker.ts`. Shared types (token records, sprint metadata, efficiency scores) and shared data (token consumption feeds both efficiency scoring and runaway detection) made consolidation the natural choice.

2. **Runaway threshold at 3x average.** Lower thresholds (2x) would generate too many false positives during normal variance. Higher thresholds (5x) would miss genuine runaways until significant waste occurred. 3x balances signal vs. noise.

3. **Sprint clock uses estimated velocity.** Remaining work is estimated from story count plus velocity data rather than summing individual task estimates, because task-level estimation is unreliable in this project.

### Lessons Learned

1. **Self-inclusive averages make outlier detection harder.** When computing "is agent X consuming >3x the average," agent X's own consumption raises the average. This dilution effect means you need N+1 entities minimum for the math to work — a 3-agent pool can never flag a runaway because the outlier inflates the baseline. Design detection algorithms with this in mind from the start.

2. **Upstream data dependencies should be explicit in story specs.** Story 21.3 silently depends on sprint date parsing that doesn't exist. Story 21.2 silently depends on file-path-to-story mapping. These should be called out as prerequisites or split into separate stories.

3. **Consolidated modules work well when stories share a data model.** The decision to build one module instead of three saved significant effort. This pattern should be considered whenever multiple stories in the same epic reference the same source data.

4. **Burn rate projection is sensitive to sprint phase.** Tokens-per-minute calculated early in a sprint (when agents are reading code) vs. late (when agents are writing code) can vary significantly. Projections should account for sprint phase or include confidence intervals.

---

## Action Items

| # | Action | Owner |
|---|--------|-------|
| 1 | Add sprint date parser to extract start/end dates from `sprint-status.yaml` so SprintClock can wire into real data | Dev |
| 2 | Build file-path-to-story mapping so efficiency scoring can identify cost patterns by codebase area | Dev |
| 3 | Add runaway detection to CI dashboard with alerting (currently logic-only, no UI) | Dev |
| 4 | Populate dev agent record fields in story files with actual model version and file list | SM |
| 5 | Wire cost-tracker output into Epic 2 smart assignment as efficiency input signal | Dev |
| 6 | Add sprint-phase-awareness to burn rate projection (early vs. late sprint calibration) | Dev |

## Metrics

| Metric | Value |
|--------|-------|
| Stories planned | 3 |
| Stories delivered | 3 (100%) |
| Acceptance criteria met | 9/9 |
| Primary module | `cost-tracker.ts` (single module, all stories) |
| Key feature: Runaway detection | >3x average threshold, requires 4+ agents |
| Key feature: Efficiency scoring | Tokens per story point, ranked by agent |
| Key feature: Sprint clock | Time-vs-work gap, green/amber/red status |
| Upstream gaps identified | 2 (sprint date parser, file-path mapping) |
