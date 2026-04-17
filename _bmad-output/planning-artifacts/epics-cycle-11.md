# Agent Orchestrator — Cycle 11 Epic Breakdown

## Overview

This document provides the epic and story breakdown for Cycle 11 of the Agent Orchestrator, implementing **oh-my-claudecode (OMC) Integration** — a session enhancement platform that amplifies every spawned agent session with specialized sub-agents, model routing, compaction survival, and deep dashboard intelligence.

**Source Documents:**
- `brainstorming-session-2026-03-31-001.md` — 60-idea brainstorm with 4-phase roadmap
- `_tmp/omc-report/` — 7-file OMC analysis (architecture, agents, skills, tools, hooks, integrations, value)
- `brainstorming-session-2026-03-31-001.md` — Session Enhancement Provider architecture

**Totals:** 28 FRs + 12 NFRs across 4 capability areas

**Build Order:** Epic 58 (foundation) → Epic 59 (after 58) → Epics 60, 61 (parallel, after 59)

---

## Requirements Inventory

### Functional Requirements — Provider Abstraction (P)

**Provider Interface (P1):**
FR-P1-1: The system defines a `SessionEnhancementProvider` interface in types.ts with lifecycle methods (install, configure, enhance, teardown)
FR-P1-2: Multiple providers can coexist (OMC, Raw, Custom) with per-project selection
FR-P1-3: Provider selection is configurable in agent-orchestrator.yaml under `session_enhancement.provider`
FR-P1-4: Providers are discovered and loaded at runtime via the existing plugin system
FR-P1-5: Provider health is tracked and degraded gracefully on failure

**Model Routing (P2):**
FR-P2-1: Agent configuration supports `modelTier: "low" | "medium" | "high"` with per-tier model mapping
FR-P2-2: Simple tasks (file search, formatting) default to low-tier models for cost savings
FR-P2-3: Complex tasks (architecture, debugging) default to high-tier models
FR-P2-4: Auto-escalation: if a model tier fails twice, the system bumps to the next tier
FR-P2-5: Model tier usage is tracked per session/story/project for cost reporting

---

### Functional Requirements — Session Enhancement (S)

**Compaction Survival (S1):**
FR-S1-1: Each spawned session creates a notepad file pre-populated with story context (ACs, relevant files, prior decisions)
FR-S1-2: Pre-compact hooks save working context (current task, blocking issues, key decisions) to notepad
FR-S1-3: On session resume after compaction, notepad contents are reloaded into context
FR-S1-4: Notepad has three sections: Priority (permanent), Working Memory (7-day TTL), Manual (permanent)

**Auto-Installation (S2):**
FR-S2-1: On session spawn, the configured enhancement provider is automatically installed in the worktree
FR-S2-2: CLAUDE.md is merged: project rules first, provider additions appended
FR-S2-3: Provider hooks are configured based on story type (exploration gets different hooks than implementation)
FR-S2-4: Session lifecycle respects provider state — persistent sessions get longer timeouts

**Smart Agent Routing (S3):**
FR-S3-1: Story types map to agent combinations (bug fix → tracer + debugger + verifier, feature → planner + architect + executor + verifier)
FR-S3-2: Agent combinations are configurable per project in agent-orchestrator.yaml
FR-S3-3: Story-level overrides allow specifying execution mode and enabled agents

---

### Functional Requirements — Dashboard Intelligence (D)

**Notepad Viewer (D1):**
FR-D1-1: API route `/api/session/[id]/notepad` reads and serves the session's notepad contents
FR-D1-2: Dashboard panel shows priority context, working memory, and manual notes per session
FR-D1-3: Notepad viewer updates in real-time via SSE when notepad changes

**Agent Activity Timeline (D2):**
FR-D2-1: API route aggregates OMC trace data per session into a timeline format
FR-D2-2: Dashboard shows which sub-agent ran when, what tools were used, what files were touched
FR-D2-3: Timeline supports filtering by agent type, tool type, and time range

**Model Cost Dashboard (D3):**
FR-D3-1: Token usage is tracked per model tier (haiku/sonnet/opus) per session
FR-D3-2: Dashboard shows cost breakdown by session, story, project, and sprint
FR-D3-3: Cost metrics integrate with existing token tracking from Epic 21

**Session State Panel (D4):**
FR-D4-1: Dashboard shows OMC state per session (execution mode, active agents, progress indicators)
FR-D4-2: State panel updates in real-time via SSE
FR-D4-3: Users can view project memory (learned conventions, decisions, directives) per session

---

### Functional Requirements — Learning & Quality (Q)

**Cross-Session Memory Bridge (Q1):**
FR-Q1-1: On session completion, project memory is extracted from provider state
FR-Q1-2: Extracted knowledge is merged into the existing JSONL learning system
FR-Q1-3: Next session benefits from accumulated knowledge from all prior sessions
FR-Q1-4: Dashboard shows project memory entries with edit/delete capability

**Verification Gates (Q2):**
FR-Q2-1: Before story completion, verification checks run: tests pass, lint clean, ACs verified
FR-Q2-2: Verification results are captured and displayed in the dashboard
FR-Q2-3: Failed verification triggers automatic retry with error context (up to configured limit)

**Persistent Execution (Q3):**
FR-Q3-1: Stories can be flagged for "persistent" execution mode
FR-Q3-2: Persistent sessions continue until verification gates pass (not just when agent thinks it's done)
FR-Q3-3: Session timeout is extended for persistent-mode sessions with active work

**Notification Plugins (Q4):**
FR-Q4-1: Telegram notifier plugin sends configurable notifications for sprint events
FR-Q4-2: Discord notifier plugin sends webhook-based notifications for sprint events
FR-Q4-3: Slack notifier plugin sends webhook-based notifications for sprint events
FR-Q4-4: All notifier plugins use the existing Notifier interface and event bus

---

### Non-Functional Requirements

**Performance:**
NFR-P1: Provider installation adds <5 seconds to session spawn time
NFR-P2: Notepad reads complete in <100ms
NFR-P3: Dashboard intelligence panels load within 2 seconds
NFR-P4: Model routing adds <1 second to session configuration

**Security:**
NFR-S1: Provider scripts are validated before execution (no arbitrary code injection)
NFR-S2: Notepad contents are sandboxed to the session's worktree
NFR-S3: API keys for notification channels are stored in environment variables, not config files

**Reliability:**
NFR-R1: Provider failures degrade gracefully — session continues without enhancement
NFR-R2: Notepad writes are atomic (temp-file-then-rename pattern)
NFR-R3: Notification delivery retries with exponential backoff (max 3 attempts)

**Extensibility:**
NFR-X1: New providers can be added without modifying core code (plugin pattern)
NFR-X2: Model tier mappings are configurable (not hardcoded to specific models)
NFR-X3: Notification channel configuration uses the existing plugin slot system

---

## Approved Epic List

### Epic 58: Provider Abstraction & Model Routing
**User Outcome:** Every spawned agent session can be transparently enhanced by a configurable session enhancement provider. Model routing reduces costs 50-70% on simple tasks.
**FRs Covered:** FR-P1-1 through FR-P1-5, FR-P2-1 through FR-P2-5
**Est. Stories:** 5-6
**Phase:** Foundation
**Depends on:** None (foundation for all subsequent epics)

### Epic 59: Session Lifecycle Enhancement
**User Outcome:** Every spawned session gets compaction survival, auto-installed enhancements, contextual hooks, and smart agent routing based on story type.
**FRs Covered:** FR-S1-1 through FR-S1-4, FR-S2-1 through FR-S2-4, FR-S3-1 through FR-S3-3
**Est. Stories:** 6-7
**Phase:** Enhancement
**Depends on:** Epic 58

### Epic 60: Dashboard Intelligence
**User Outcome:** Users can see inside agent sessions: notepad contents, sub-agent activity timeline, model cost breakdown, and session state — all in real-time.
**FRs Covered:** FR-D1-1 through FR-D1-3, FR-D2-1 through FR-D2-3, FR-D3-1 through FR-D3-3, FR-D4-1 through FR-D4-3
**Est. Stories:** 8-10
**Phase:** Dashboard
**Depends on:** Epic 59
**Parallel with:** Epic 61

### Epic 61: Learning, Verification & Notifications
**User Outcome:** Sessions learn from each other through a cross-session memory bridge. Stories pass verification before completion. Notifications reach users via Telegram, Discord, and Slack.
**FRs Covered:** FR-Q1-1 through FR-Q1-4, FR-Q2-1 through FR-Q2-3, FR-Q3-1 through FR-Q3-3, FR-Q4-1 through FR-Q4-4
**Est. Stories:** 7-8
**Phase:** Quality
**Depends on:** Epic 59
**Parallel with:** Epic 60

---

## Epic 58: Provider Abstraction & Model Routing

### Stories

**58-1: SessionEnhancementProvider Interface**
- Define the `SessionEnhancementProvider` interface in `types.ts`
- Methods: `install(worktreePath, config)`, `configure(worktreePath, storyContext)`, `enhance(session)`, `teardown(worktreePath)`, `healthCheck()`
- `RawProvider` as the default no-op implementation
- FRs: FR-P1-1, FR-P1-2

**58-2: Provider Configuration & Discovery**
- Add `session_enhancement:` section to `agent-orchestrator.yaml` schema (Zod)
- Fields: `provider: "raw" | "omc" | string`, per-project overrides, model tier mappings
- Provider discovery via plugin system (same pattern as Runtime/Agent slots)
- FRs: FR-P1-3, FR-P1-4

**58-3: OMC Provider Implementation**
- `OMCProvider` implementing `SessionEnhancementProvider`
- Install: clone/setup OMC in worktree, create `.omc/` directory structure
- Configure: generate `.claude/omc.jsonc`, merge CLAUDE.md
- Enhance: inject agent catalog and story-specific config into session
- Teardown: clean up OMC artifacts
- FRs: FR-P1-1, FR-P1-5

**58-4: Model Routing Service**
- Add `modelTier` to agent config schema: `"low" | "medium" | "high"`
- Map tiers to models via config (default: low→haiku, medium→sonnet, high→opus)
- Routing logic in `assignment-service.ts`
- Auto-escalation: track failures per session, bump tier after 2 consecutive failures
- FRs: FR-P2-1, FR-P2-2, FR-P2-3, FR-P2-4

**58-5: Model Usage Tracking**
- Track model tier and estimated tokens per session in JSONL event log
- Aggregate by story, project, sprint for cost reporting
- FRs: FR-P2-5

**58-6: Provider Health & Graceful Degradation**
- Health check endpoint for providers
- On provider failure: log warning, fall back to RawProvider, continue session
- Circuit breaker pattern: after 3 consecutive failures, disable provider for project
- FRs: FR-P1-5, NFR-R1

---

## Epic 59: Session Lifecycle Enhancement

### Stories

**59-1: Notepad Creation with Story Context**
- On session spawn, create `.omc/notepad.md` in worktree
- Pre-populate Priority section with: story ACs, relevant file list, dependency context
- Pre-populate Working Memory section with: sprint context, related completed stories
- FRs: FR-S1-1, FR-S1-4

**59-2: Compaction Survival Hooks**
- Pre-compact hook: export current task state, blocking issues, key decisions to notepad Priority section
- Post-compaction reload: inject notepad contents back into session context
- Project memory pre-compact hook: save key learnings to project memory
- FRs: FR-S1-2, FR-S1-3

**59-3: Auto-Install OMC in Worktrees**
- On spawn: call provider.install() to set up OMC in the worktree
- Verify installation (check for `.omc/` directory, config files)
- Rollback on failed installation, log warning, continue with raw session
- FRs: FR-S2-1

**59-4: CLAUDE.md Merge Strategy**
- Read project CLAUDE.md (our rules)
- Read provider enhancement content (OMC agent catalog, delegation prompts)
- Merge: project rules first, provider additions appended under clear section headers
- Write merged CLAUDE.md to worktree
- FRs: FR-S2-2

**59-5: Story-Type Hook Configuration**
- Define hook profiles per story type: `exploration`, `implementation`, `bugfix`, `review`
- Generate provider-specific hooks.json based on story type
- Exploration: enable search/analysis agents, disable write enforcers
- Implementation: enable all agents, enable persistence, enable verification
- FRs: FR-S2-3

**59-6: Story-Agent Mapping Configuration**
- Default mappings: bugfix → [tracer, debugger, verifier], feature → [planner, architect, executor, verifier]
- Configurable in agent-orchestrator.yaml under `session_enhancement.agent_mappings`
- Story-level override: optional `agents` field in story files
- FRs: FR-S3-1, FR-S3-2, FR-S3-3

**59-7: Persistence-Aware Session Timeout**
- On idle detection, read provider state
- If persistent mode active and work incomplete → extend timeout, continue session
- If work complete or no provider → graceful stop
- FRs: FR-S2-4

---

## Epic 60: Dashboard Intelligence

### Stories

**60-1: Notepad API Route**
- GET `/api/session/[id]/notepad` — reads and parses `.omc/notepad.md` from session worktree
- Returns structured response: `{ priority: string, working: string, manual: string }`
- SSE endpoint for notepad change notifications
- FRs: FR-D1-1, FR-D1-3

**60-2: Notepad Dashboard Panel**
- Client component showing three-tab notepad viewer (Priority / Working Memory / Manual)
- Real-time updates via SSE subscription
- Collapsible panel in session detail view
- FRs: FR-D1-2

**60-3: Agent Timeline API Route**
- GET `/api/session/[id]/timeline` — aggregates trace data from OMC state
- Returns timeline entries: `{ agent, action, tools, files, timestamp, duration }`
- Query params for filtering: `?agent=`, `?tool=`, `?from=`, `?to=`
- FRs: FR-D2-1, FR-D2-3

**60-4: Agent Activity Timeline Component**
- Visual timeline showing sub-agent activity per session
- Color-coded by agent type, filterable
- Tool usage breakdown and file touch indicators
- FRs: FR-D2-2

**60-5: Model Cost API Route**
- GET `/api/costs/breakdown` — aggregates model tier usage from JSONL events
- Dimensions: session, story, project, sprint
- Returns: token counts per tier, estimated cost, total
- FRs: FR-D3-1, FR-D3-2

**60-6: Model Cost Dashboard Panel**
- Cost breakdown chart by model tier (haiku/sonnet/opus)
- Drill-down: sprint → project → story → session
- Integration with existing token tracking from Epic 21
- FRs: FR-D3-3

**60-7: Session State API Route**
- GET `/api/session/[id]/state` — reads provider state from worktree
- Returns: execution mode, active agents, progress indicators, health
- SSE endpoint for real-time state changes
- FRs: FR-D4-1, FR-D4-2

**60-8: Session State Dashboard Panel**
- Panel in session detail view showing: execution mode badge, active agent list, progress bar
- Real-time updates via SSE
- Health indicator with provider status
- FRs: FR-D4-1, FR-D4-2

**60-9: Project Memory API & Viewer**
- GET `/api/session/[id]/memory` — reads project memory from provider state
- Dashboard panel showing learned conventions, decisions, directives
- Editable from web (PUT endpoint with validation)
- FRs: FR-D4-3

---

## Epic 61: Learning, Verification & Notifications

### Stories

**61-1: Cross-Session Memory Bridge**
- On session completion, extract project memory from provider state
- Parse conventions, decisions, directives into structured format
- Merge into existing JSONL learning system (deduplication)
- FRs: FR-Q1-1, FR-Q1-2, FR-Q1-3

**61-2: Project Memory Dashboard Viewer**
- Dashboard panel showing accumulated project memory across sessions
- Filterable by: convention, decision, directive, source session
- Edit/delete capability for managing accumulated knowledge
- FRs: FR-Q1-4

**61-3: Verification Gate Service**
- Before story completion: run configured checks (test command, lint command, AC verification)
- Capture verification results as structured data
- Expose via API: GET `/api/story/[id]/verification`
- FRs: FR-Q2-1, FR-Q2-2

**61-4: Auto-Retry on Verification Failure**
- If verification fails: inject error context into session, trigger retry
- Configurable retry limit (default: 2)
- Track retry count and reasons in event log
- FRs: FR-Q2-3

**61-5: Persistent Execution Mode**
- Stories can be flagged `persistent: true` in story files or config
- Persistent sessions continue until verification gates pass
- Extended timeout for active persistent sessions
- Session lifecycle respects persistence flag
- FRs: FR-Q3-1, FR-Q3-2, FR-Q3-3

**61-6: Telegram Notifier Plugin**
- Implement `Notifier` interface for Telegram delivery
- Bot API with configurable notification tags
- Per-event-type channel routing
- FRs: FR-Q4-1, FR-Q4-4

**61-7: Discord & Slack Notifier Plugins**
- Implement `Notifier` interface for Discord webhook delivery
- Implement `Notifier` interface for Slack webhook delivery
- Both support @here, @everyone, role mentions
- FRs: FR-Q4-2, FR-Q4-3, FR-Q4-4

---

## Dependency Graph

```
Epic 58 (Provider Abstraction)
    ↓
Epic 59 (Session Enhancement)
    ↓         ↓
Epic 60    Epic 61
(Dashboard) (Learning & Quality)
```

- **Epic 58** has no dependencies — it's the foundation
- **Epic 59** depends on 58 (needs provider interface)
- **Epics 60 and 61** depend on 59 (need sessions to be enhanced first) but are parallel with each other

---

## Source Mapping

Ideas from brainstorming session mapped to stories:

| Brainstorm Idea | Epic | Story |
|----------------|------|-------|
| #4 Provider Abstraction | 58 | 58-1, 58-2, 58-3 |
| #2 Model Routing | 58 | 58-4, 58-5 |
| #38 Circuit Breaker | 58 | 58-6 |
| #3 Compaction Survival | 59 | 59-1, 59-2 |
| #17 Auto-Install | 59 | 59-3 |
| #19 CLAUDE.md Merge | 59 | 59-4 |
| #18 Smart Hooks | 59 | 59-5 |
| #5 Story-Agent Mapping | 59 | 59-6 |
| #20 Persistence Awareness | 59 | 59-7 |
| #14 Notepad Viewer | 60 | 60-1, 60-2 |
| #13 Agent Timeline | 60 | 60-3, 60-4 |
| #15 Model Cost | 60 | 60-5, 60-6 |
| #11 Session State | 60 | 60-7, 60-8 |
| #16 Project Memory Viewer | 60 | 60-9 |
| #6 Memory Bridge | 61 | 61-1, 61-2 |
| #7 Verification Gate | 61 | 61-3, 61-4 |
| #8 Persistent Execution | 61 | 61-5 |
| #24 Notification Plugins | 61 | 61-6, 61-7 |
