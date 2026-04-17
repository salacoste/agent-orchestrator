---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Integrating oh-my-claudecode into agent-orchestrator'
session_goals: 'Determine the best integration strategy and identify high-value features to adopt'
selected_approach: 'ai-recommended'
techniques_used: ['Constraint Mapping', 'Morphological Analysis', 'Cross-Pollination']
ideas_generated: [60]
context_file: '_tmp/omc-report/'
---

# Brainstorming Session Results

**Facilitator:** R2d2
**Date:** 2026-03-31

## Session Overview

**Topic:** Maximum integration of oh-my-claudecode (OMC) features into agent-orchestrator
**Goals:** Map every OMC capability to a concrete integration point in our architecture — where, how, and what value it brings

### Context Guidance

_Comprehensive analysis of OMC available in `_tmp/omc-report/` (7 files covering architecture, agents, skills, tools, hooks, integrations, value assessment)_

OMC capabilities to integrate (from analysis):
- 19 specialized agents with model routing (haiku/sonnet/opus)
- 30+ workflow skills (autopilot, ralph, ultrawork, team)
- 40+ MCP tools (LSP, AST, State, Notepad, Memory, Trace)
- Hook system (11 lifecycle events)
- Persistent execution ("boulder never stops")
- Context compaction survival (notepad + pre-compact)
- External provider orchestration (Codex, Gemini)
- Notifications (Telegram, Discord, Slack)
- Background task management

### Session Setup

_Two systems at different layers: OMC enhances individual Claude Code sessions, agent-orchestrator coordinates multiple sessions across sprints. Goal: find the integration points where OMC's capabilities amplify our platform._

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** Maximum integration of OMC features into agent-orchestrator with focus on mapping every capability to concrete integration points

**Recommended Techniques:**

- **Constraint Mapping:** Map what OMC expects vs what AO provides — identify gaps before ideation
- **Morphological Analysis:** Systematic matrix of OMC features × AO integration points — exhaustive coverage
- **Cross-Pollination:** Borrow integration patterns from VS Code, Kubernetes, webpack, etc.

**AI Rationale:** Technical integration between two complex systems requires structured analysis first (Constraint Mapping), exhaustive feature-point mapping second (Morphological Analysis), then creative discovery of non-obvious integration patterns (Cross-Pollination). This sequence moves from "what's possible" through "what's systematic" to "what's surprising."

## Technique 1: Constraint Mapping

**Interactive Focus:** OMC expectations vs AO capabilities — finding the seams
**Key Breakthroughs:**
- OMC runs INSIDE sessions, AO runs OUTSIDE — they compose, not compete
- CLAUDE.md conflict is solvable with merge strategy (our rules first, OMC adds orchestration)
- Worktree isolation means `.omc/` is per-session — good for isolation, needs bridge for cross-session memory
- Hook interference is manageable with selective enable/disable per story type

**Collision Points Identified:**
1. CLAUDE.md — both systems want to inject system prompts
2. Hook interference — OMC's persistence vs AO's completion detection
3. State divergence — `.omc/state/` vs `sprint-status.yaml`
4. Model routing — who decides which model to use?
5. Worktree isolation — `.omc/` is per-worktree, not per-project

**Complementary Points Identified:**
1. OMC's 19 sub-agents amplify each AO session
2. Notepad solves compaction pain point
3. MCP tools (LSP, AST) come for free
4. Model routing saves money
5. Project memory enhances learning system

## Technique 2: Morphological Matrix — 33 Ideas

### Core Integration

**[Core #1]**: Agent Definitions as Config
_Concept_: Import OMC's 19 agent definitions into our types.ts as an agent catalog. Each project config specifies which OMC agents to enable.
_Novelty_: Delegating agent specialization to OMC's proven system rather than reimplementing.

**[Core #2]**: Model Routing Service
_Concept_: Add `modelTier: "low" | "medium" | "high"` to agent config. Implement in assignment-service.ts. Auto-escalate on failure.
_Novelty_: 3-tier pattern from OMC, implemented natively. 50-70% cost savings on simple tasks.

**[Core #3]**: Session Notepad for Compaction Survival
_Concept_: Create `.omc/notepad.md` in each worktree on spawn. Pre-populate with story context. PreCompact hook saves progress on compaction.
_Novelty_: Solves #1 pain point (lost context) with zero core changes.

**[Core #4]**: Provider Abstraction Layer
_Concept_: Define `SessionEnhancementProvider` interface. OMC is first implementation. Raw/custom can follow.
_Novelty_: Not "integrate OMC" but "create provider system where OMC is the first provider." Like K8s CRI.

**[Core #5]**: Story-OMC Agent Mapping
_Concept_: Map story types to OMC agent combos. Bug fix → tracer + debugger + verifier. Feature → planner + architect + executor + verifier.
_Novelty_: Optimized multi-agent pipelines per story type within a single session.

**[Core #6]**: Cross-Session Memory Bridge
_Concept_: Read `.omc/project-memory.json` after session completes. Merge into our JSONL learning. Next session benefits from all prior sessions.
_Novelty_: OMC's structured memory + our cross-sprint learning = 1+1=3.

**[Core #7]**: Verification Gate Integration
_Concept_: Wire OMC's verification into story completion. Before "done": run tests, pass lint, verify ACs. OMC's verifier agent does this automatically.
_Novelty_: Catches issues before code review, reduces round-trips.

**[Core #8]**: Persistent Execution Mode
_Concept_: Add "persistent" flag to story assignment. OMC's ralph/ultrawork keeps agent alive until verification passes.
_Novelty_: Agents that don't stop until work is actually done.

### CLI Integration

**[CLI #9]**: `ao omc` Command Suite
_Concept_: `ao omc install`, `ao omc config`, `ao omc status` — single entry point for OMC management.
_Novelty_: Integrated management, not separate tooling.

**[CLI #10]**: `ao skills` Command
_Concept_: `ao skills list`, `ao skills run autopilot --story 52-2` — invoke OMC skills from our CLI.
_Novelty_: Skills become part of sprint workflow, not ad-hoc session commands.

### Web Dashboard Integration

**[Web #11]**: OMC State in Session Detail
_Concept_: Read `.omc/state/` per session. Show execution mode, sub-agent activity, notepad, progress in dashboard drill-down.
_Novelty_: Deep visibility into agent session internals from the sprint dashboard.

**[Web #12]**: LSP Diagnostics Dashboard Panel
_Concept_: API routes calling OMC's LSP tools. `/api/lsp/diagnostics`, `/api/lsp/symbols`. Real-time type errors in dashboard.
_Novelty_: IDE-lite code health view without leaving sprint context.

**[Web #13]**: Agent Activity Timeline
_Concept_: OMC trace tools → timeline of sub-agent activity per session. Which agent ran when, what tools used, what files touched.
_Novelty_: Sprint-level agent coordination visualization.

**[Web #14]**: Notepad Viewer
_Concept_: `/api/session/[id]/notepad` reads `.omc/notepad.md`. Show priority context, working memory, manual notes per session.
_Novelty_: See what agents are thinking, learning, stuck on — in real time.

**[Web #15]**: Model Cost Dashboard
_Concept_: Track haiku/sonnet/opus usage per session/story/project/sprint. Integrate with existing token tracking (Epic 21).
_Novelty_: Financial visibility at sprint level.

**[Web #16]**: Project Memory Viewer
_Concept_: Read/display `.omc/project-memory.json` in dashboard. Learned conventions, decisions, directives. Editable from web.
_Novelty_: Crowd-sourced project knowledge improving with every session.

### Runtime Integration

**[Runtime #17]**: Automatic OMC Installation in Worktrees
_Concept_: On spawn: install OMC plugin, configure `.claude/omc.jsonc`, create `.omc/` directory structure.
_Novelty_: Zero-config OMC — every spawned session gets capabilities automatically.

**[Runtime #18]**: Smart Hook Configuration
_Concept_: Generate `.claude/hooks.json` per worktree. Selective enable/disable OMC hooks based on story type.
_Novelty_: Contextual OMC behavior — right features for the right story.

**[Runtime #19]**: CLAUDE.md Merge Strategy
_Concept_: Merge our CLAUDE.md (project rules) with OMC's additions (agent catalog, delegation). Our rules first, OMC adds orchestration.
_Novelty_: Both systems coexist in a single prompt without conflict.

**[Runtime #20]**: Session Timeout with Persistence Awareness
_Concept_: On idle detection, read OMC notepad. If persistent mode active and work incomplete, let continue. If done, gracefully stop.
_Novelty_: Smarter session lifecycle respecting OMC's persistence model.

### Configuration

**[Config #21]**: OMC Section in agent-orchestrator.yaml
_Concept_: `omc:` section: enabled/disabled, agent mappings, skill config, model routing overrides, hook customization per project.
_Novelty_: Single config file controls both AO and OMC.

**[Config #22]**: Story-Level OMC Configuration
_Concept_: Optional `omc` field in story files: execution mode, enabled agents, verification requirements, model tier hints.
_Novelty_: Story-specific agent orchestration — mini-PRD for AI workflow.

**[Config #23]**: Project Template System
_Concept_: OMC profiles per project type: "web-frontend" (designer + executor + test-engineer), "backend-api" (architect + executor + security-reviewer).
_Novelty_: Right-size the AI team per project.

### Plugin Integration

**[Plugin #24]**: OMC Notifier Plugins (Telegram/Discord/Slack)
_Concept_: Implement OMC's notification channels as AO notifier plugins. Unified event bus + OMC delivery.
_Novelty_: Unified notification — AO manages what/when, OMC handles delivery.

### Cross-Pollination Patterns

**[Pattern #25]**: VS Code Extension Host Model
_Concept_: AO as "session enhancement host." OMC (and future enhancers) register capabilities, AO injects into sessions.
_Novelty_: Platform/ecosystem model, not single-tool integration.

**[Pattern #26]**: Kubernetes CRI Pattern
_Concept_: "Session Enhancement Interface" — OMC is one implementation, raw Claude Code another, custom enhancers can follow.
_Novelty_: Vendor-neutral abstraction for future flexibility.

**[Pattern #27]**: Terraform Provider Pattern
_Concept_: AO orchestrates sprints, "session providers" implement agent behavior. Switch agents by changing provider.
_Novelty_: Clean separation between orchestration strategy and execution tactics.

**[Pattern #28]**: Shopify App Store Model
_Concept_: AO provides sprint platform, "session apps" provide agent capabilities. Community-built specializations.
_Novelty_: Third-party extensibility for specialized domains.

**[Pattern #29]**: Git Hooks + CI Pipeline Model
_Concept_: AO provides session lifecycle hooks (pre-spawn, post-complete). OMC subscribes to enhance sessions.
_Novelty_: Event-driven, loosely coupled, easy to add/remove enhancers.

**[Pattern #30]**: Neovim LSP Client Pattern
_Concept_: AO as MCP client aggregator — expose OMC's tools (and others) through unified dashboard API.
_Novelty_: Dashboard as MCP gateway — all AI tools from one web UI.

**[Pattern #31]**: Docker Compose Orchestration
_Concept_: Per-session OMC configuration. Story 52-2 gets "full-stack" profile, bug fix gets "quick-fix."
_Novelty_: Per-session customization at orchestration level.

**[Pattern #32]**: WordPress Plugin API
_Concept_: AO exposes "session actions" (pre_spawn, post_complete) and "session filters" (modify_prompt, modify_config).
_Novelty_: Well-proven extensibility model from the web's most customizable platform.

**[Pattern #33]**: OpenTelemetry Collector Pattern
_Concept_: AO as "agent telemetry collector" — receiving status from OMC sessions, processing through sprint logic, exporting to dashboard.
_Novelty_: Unified observability for AI agent work — traces, metrics, logs from every session.

## Technique 3: Cross-Pollination — 27 Additional Ideas

### Infrastructure Patterns

**[Infra #34]**: Health Check Probes (Kubernetes)
_Concept_: Liveness/readiness probes for agent sessions. OMC's state tools report health; AO decides restart/escalate.
_Novelty_: Self-healing agent sessions — detect stuck agents and auto-recover.

**[Infra #35]**: Sidecar Injection (Service Mesh)
_Concept_: Inject OMC configuration as a "sidecar" alongside each session. Transparent enhancement without modifying the session itself.
_Novelty_: Zero-touch session enhancement — OMC is woven in by the platform, not configured by the agent.

**[Infra #36]**: ConfigMap/Secrets Pattern (Kubernetes)
_Concept_: Separate OMC configuration from session secrets. Project-level defaults, session-level overrides, secret injection for API keys.
_Novelty_: Secure, layered configuration with proper secret management.

**[Infra #37]**: Operator Pattern (Kubernetes)
_Concept_: AO as "Agent Operator" — watches desired state (sprint backlog), reconciles actual state (running sessions), self-heals drift.
_Novelty_: Declarative sprint management — describe what you want, not how to get there.

**[Infra #38]**: Circuit Breaker (Resilience4j)
_Concept_: If OMC features fail repeatedly (notepad write errors, LSP crashes), gracefully degrade to raw sessions. Auto-recover when OMC stabilizes.
_Novelty_: OMC failures never block sprint progress.

### Developer Experience Patterns

**[DX #39]**: Language Server Protocol for Sprints (VS Code)
_Concept_: Expose sprint state, story details, and agent progress through an LSP-like protocol. IDE extensions, CLI tools, and dashboards all consume the same data.
_Novelty_: Sprint-as-a-service — any tool can integrate with our orchestration.

**[DX #40]**: Hot Module Replacement (Webpack/Vite)
_Concept_: Swap OMC configuration mid-session without restarting. Change agent mappings, model tiers, or skill enablement on the fly.
_Novelty_: Zero-downtime configuration changes for running sessions.

**[DX #41]**: DevTools Protocol (Chrome)
_Concept_: Debug protocol for agent sessions. Inspect context window, step through agent decisions, set breakpoints on tool calls.
_Novelty_: IDE-level debugging for AI agent sessions.

**[DX #42]**: REPL-Driven Development (Clojure)
_Concept_: Interactive session tuning — adjust OMC parameters, test agent behaviors, iterate in real-time from the dashboard.
_Novelty_: Live-coding the AI orchestration layer.

**[DX #43]**: Package Manager (npm/cargo)
_Concept_: `ao install agent/security-reviewer`, `ao install skill/performance-audit`. Community-contributed OMC agent profiles and skill packs.
_Novelty_: Ecosystem of specialized agent capabilities.

### Data Flow Patterns

**[Data #44]**: Event Sourcing (CQRS)
_Concept_: Store every OMC event (tool call, agent switch, notepad update) as an immutable event. Replay to reconstruct any session state.
_Novelty_: Perfect audit trail and time-travel debugging for agent sessions.

**[Data #45]**: Message Queue (RabbitMQ/Kafka)
_Concept_: Decouple OMC event production from AO consumption. Buffer spikes, replay missed events, guarantee delivery.
_Novelty_: Reliable event pipeline between session internals and sprint dashboard.

**[Data #46]**: Materialized View (Database)
_Concept_: Pre-compute sprint metrics from OMC events. Dashboard queries are instant, not aggregated on-the-fly from JSONL.
_Novelty_: Sub-second dashboard queries regardless of session count.

**[Data #47]**: Change Data Capture (Debezium)
_Concept_: Watch `.omc/state/` and `.omc/notepad.md` for changes. Stream updates to dashboard in real-time without polling.
_Novelty_: File-based CDC — no API needed, just watch the files OMC already writes.

**[Data #48]**: Pub/Sub with Topic Routing (Google Pub/Sub)
_Concept_: Route OMC events to different handlers: notepad changes → dashboard, state changes → sprint tracker, errors → notifier.
_Novelty_: Event-driven architecture connecting OMC internals to AO features.

### Collaboration Patterns

**[Collab #49]**: Pull Request Review Model (GitHub)
_Concept_: Agent sessions submit "work reviews" — not code reviews, but progress reviews. Other agents or humans review and approve/reject.
_Novelty_: Quality gates between agent stages, not just at completion.

**[Collab #50]**: Pair Programming (VS Code Live Share)
_Concept_: Two agents share a session context. One explores, one implements. Combined notepad and shared state.
_Novelty_: Agent pair-programming within a single session.

**[Collab #51]**: Scrum Board (Jira/Linear)
_Concept_: Map OMC execution modes to scrum ceremonies. Ultrawork = sprint, ralph = spike, team = sprint planning.
_Novelty_: Fam Agile metaphors for AI agent workflows.

**[Collab #52]**: Code Ownership (CODEOWNERS)
_Concept_: Map OMC agents to code areas. Security-reviewer owns `*auth*`, `*crypto*`. Architect owns `types.ts`, interfaces.
_Novelty_: Automatic expert routing based on file paths.

### Learning & Adaptation Patterns

**[Learn #53]**: Feature Flags (LaunchDarkly)
_Concept_: Toggle OMC features per session: notepad on/off, persistent mode on/off, model routing aggressive/conservative.
_Novelty_: A/B testing agent capabilities across sessions.

**[Learn #54]**: Can you release pattern (Blue/Green)
_Concept_: Roll out OMC features to one session first. If metrics improve, roll out to all. If worse, rollback.
_Novelty_: Safe rollout of agent enhancements with data-driven decisions.

**[Learn #55]**: Reinforcement Learning Loop
_Concept_: Track which OMC agent combos produce the best outcomes per story type. Auto-recommend the best combo for new stories.
_Novelty_: The system gets better at assigning agents over time.

**[Learn #56]**: Chaos Engineering (Netflix)
_Concept_: Randomly disable OMC features in some sessions. Measure impact on quality, speed, cost. Find which features matter most.
_Novelty_: Evidence-based feature prioritization through controlled experiments.

**[Learn #57]**: Gradual Typing (TypeScript)
_Concept_: Start with minimal OMC integration (just installation). Progressively add features: first notepad, then model routing, then persistent execution.
_Novelty_: Adoption spectrum from zero to full — no big-bang migration.

### Visualization Patterns

**[Viz #58]**: Flame Graph (Performance)
_Concept_: Visualize agent session time breakdown: thinking vs tool calls vs waiting vs errors. Spot bottlenecks.
_Novelty_: Performance profiling for AI agent sessions.

**[Viz #59]**: Dependency Graph (Webpack Bundle Analyzer)
_Concept_: Show which OMC agents depend on which tools, which stories depend on which agents. Visualize the full dependency tree.
_Novelty_: System-level understanding of agent capability dependencies.

**[Viz #60]**: Sankey Diagram (D3)
_Concept_: Flow diagram: Sprint → Stories → Agents → Models → Cost. See where tokens and time flow through the system.
_Novelty_: Financial and temporal flow visualization for sprint orchestration.

---

## Idea Organization and Prioritization

### Theme Clusters (7 Themes)

**Theme 1: Provider Abstraction Platform** (Ideas #4, #25, #26, #27, #35, #57)
Core idea: AO doesn't integrate OMC — it builds a provider system where OMC is the first provider. Future providers can follow.
_Pattern_: Infrastructure-first, enabling many integrations through one abstraction.

**Theme 2: Session Lifecycle Enhancement** (Ideas #3, #8, #17, #18, #19, #20, #38, #40, #53)
Core idea: Every spawned session gets smarter through OMC: compaction survival, persistent execution, contextual hooks.
_Pattern_: Transparent enhancement — agents don't know OMC is there, they just work better.

**Theme 3: Dashboard Intelligence** (Ideas #11, #12, #13, #14, #15, #16, #30, #47, #58, #59, #60)
Core idea: OMC session data flows into our dashboard: notepad viewer, agent timeline, cost tracking, diagnostics.
_Pattern_: Visualization of agent internals — see what agents think, do, and cost.

**Theme 4: Smart Agent Routing** (Ideas #2, #5, #9, #10, #22, #23, #41, #43, #52)
Core idea: Route stories to the right agent combo with the right model tier. Per-story customization.
_Pattern_: Intelligence in assignment — the right AI for the right task.

**Theme 5: Cross-Session Learning** (Ideas #6, #55, #56)
Core idea: Every session teaches the system. Project memory, outcome tracking, auto-tuning of agent selections.
_Pattern_: The platform learns and improves with every sprint.

**Theme 6: Quality & Verification** (Ideas #7, #49)
Core idea: Verification gates, progress reviews, quality checks — agents prove their work before marking done.
_Pattern_: Trust-but-verify — automated quality assurance in the agent pipeline.

**Theme 7: Notification & Communication** (Ideas #24, #34, #48)
Core idea: Unified notification channels, event routing, health monitoring — humans stay informed without being overwhelmed.
_Pattern_: Right information to the right person at the right time.

### Top 3 Priority Ideas

| Rank | Idea | Theme | Impact | Effort | ROI |
|------|------|-------|--------|--------|-----|
| **#1** | **#4 Provider Abstraction Layer** | Platform | Architectural foundation for all future integrations | Medium | Highest — enables everything else |
| **#2** | **#3 Compaction Survival** | Lifecycle | Prevents lost work on long stories | Medium | Critical — solves #1 pain point |
| **#3** | **#2 Model Routing Service** | Routing | 50-70% cost savings on simple tasks | Low | High — immediate cost reduction |

### Prioritization Matrix

```
         High Effort │  #12 LSP Diagnostics   │  #4 Provider Layer
                     │  #13 Agent Timeline     │  #3 Compaction Survival
                     │                         │  #17 Auto-Install
                     │                         │  #19 CLAUDE.md Merge
                     ├─────────────────────────┤──────────────────────────
         Low  Effort │  #9 CLI Commands        │  #2 Model Routing
                     │  #22 Story-Level Config │  #6 Memory Bridge
                     │  #23 Project Templates  │  #24 Notification Plugins
                     │                         │  #7 Verification Gate
                     ├─────────────────────────┤──────────────────────────
                     │      Low Impact         │       High Impact
```

---

## Action Planning

### 4-Phase Integration Roadmap

#### Phase 1: Foundation (Weeks 1-2)
_Theme: Provider Abstraction Platform + Core Setup_

| Step | Action | Delivers |
|------|--------|----------|
| 1.1 | Define `SessionEnhancementProvider` interface in `types.ts` | Abstraction layer |
| 1.2 | Implement `OMCProvider` as first provider (install, configure, inject) | OMC integration point |
| 1.3 | Add `omc:` section to `agent-orchestrator.yaml` schema (Zod) | Configuration |
| 1.4 | Build `ao omc install|config|status` CLI commands | User-facing tooling |
| 1.5 | Implement model routing service (`modelTier` in agent config) | Cost savings |

**Outcome:** Every spawned session can optionally use OMC. Foundation for all subsequent phases.

#### Phase 2: Session Enhancement (Weeks 3-4)
_Theme: Session Lifecycle + Smart Routing_

| Step | Action | Delivers |
|------|--------|----------|
| 2.1 | Auto-install OMC in worktrees on session spawn | Zero-config enhancement |
| 2.2 | Implement CLAUDE.md merge strategy (project rules + OMC additions) | Coexistence |
| 2.3 | Add notepad creation in worktree with story context pre-population | Compaction survival |
| 2.4 | Build smart hook configuration per story type | Contextual behavior |
| 2.5 | Map story types to agent combos + model tiers | Intelligent routing |

**Outcome:** Sessions are enhanced with compaction survival, smart routing, and contextual behavior.

#### Phase 3: Dashboard Intelligence (Weeks 5-6)
_Theme: Dashboard Visibility + Cost Tracking_

| Step | Action | Delivers |
|------|--------|----------|
| 3.1 | Add notepad viewer API route + dashboard panel | Session introspection |
| 3.2 | Build agent activity timeline from OMC trace data | Coordination visibility |
| 3.3 | Create model cost dashboard (haiku/sonnet/opus usage tracking) | Financial visibility |
| 3.4 | Add OMC state panel to session detail view | Real-time status |
| 3.5 | Implement LSP diagnostics API route + dashboard integration | Code health |

**Outcome:** Full visibility into agent session internals from the sprint dashboard.

#### Phase 4: Learning & Quality (Weeks 7-8)
_Theme: Cross-Session Learning + Verification_

| Step | Action | Delivers |
|------|--------|----------|
| 4.1 | Build cross-session memory bridge (OMC memory → AO learning) | Accumulated knowledge |
| 4.2 | Add verification gate (tests + lint + ACs before story completion) | Quality assurance |
| 4.3 | Implement persistent execution mode for critical stories | Completion guarantee |
| 4.4 | Add project memory viewer/editor in dashboard | Knowledge management |
| 4.5 | Build notification plugins (Telegram, Discord, Slack) | Communication |

**Outcome:** The platform learns from every session and guarantees story quality before completion.

---

## Session Summary and Insights

### Key Insights

1. **Layer Complementarity is the Core Insight**: OMC (inside sessions) and AO (outside sessions) don't compete — they compose. This is the foundation for all 60 ideas.

2. **Provider Abstraction is the Force Multiplier**: Building a `SessionEnhancementProvider` interface (not just "integrate OMC") means OMC is the first of many session enhancers. Future: custom domain-specific enhancers, alternative AI tool integrations, community plugins.

3. **Compaction Survival is the #1 Pain Point**: Agents losing context mid-task is the most impactful problem to solve. OMC's notepad + pre-compact hook pattern is the proven solution.

4. **Cost Optimization Through Model Routing**: Simple tasks (file search, formatting) on haiku, complex tasks (architecture, debugging) on opus. 50-70% projected cost savings with zero quality loss.

5. **Dashboard Intelligence Differentiates Us**: No other agent orchestration platform offers real-time visibility into agent session internals (notepad, agent timeline, cost tracking). This is our competitive advantage.

### Integration Architecture (Final)

```
┌─────────────────────────────────────────────────────────┐
│  agent-orchestrator (Sprint Orchestration Platform)      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │ Sprint Mgmt  │ │  Dashboard   │ │  Learning System │ │
│  │ (assignment, │ │  (real-time  │ │  (cross-session  │ │
│  │  tracking)   │ │   SSE feeds) │ │   memory bridge) │ │
│  └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘ │
│         │                │                   │           │
│  ┌──────┴────────────────┴───────────────────┴─────────┐ │
│  │  SessionEnhancementProvider Interface                │ │
│  │  ┌─────────────────────────────────────────────┐    │ │
│  │  │  OMCProvider (oh-my-claudecode)             │    │ │
│  │  │  ├─ 19 specialized agents                   │    │ │
│  │  │  ├─ Model routing (haiku/sonnet/opus)       │    │ │
│  │  │  ├─ Notepad + compaction survival           │    │ │
│  │  │  ├─ Persistent execution modes              │    │ │
│  │  │  ├─ LSP/AST code intelligence               │    │ │
│  │  │  ├─ Project memory                          │    │ │
│  │  │  └─ Verification gates                      │    │ │
│  │  └─────────────────────────────────────────────┘    │ │
│  │  ┌─────────────────────────────────────────────┐    │ │
│  │  │  RawProvider (plain Claude Code)            │    │ │
│  │  └─────────────────────────────────────────────┘    │ │
│  │  ┌─────────────────────────────────────────────┐    │ │
│  │  │  FutureProvider (custom enhancers...)       │    │ │
│  │  └─────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Metrics for Success

| Metric | Current | Phase 2 Target | Phase 4 Target |
|--------|---------|---------------|---------------|
| Context loss on compaction | ~80% of long stories | <10% | <2% |
| Cost per simple story | $X (full model) | 0.3-0.5X (model routing) | 0.2X (optimized routing) |
| Story rework rate | ~30% | ~15% (verification gates) | ~5% (persistent + verify) |
| Dashboard visibility | Session status only | + Notepad, agent activity | + Cost, memory, diagnostics |
| Cross-session learning | None | Per-project memory | Auto-tuned agent selection |

### Next Steps

1. **Create Epic 53**: Provider Abstraction Platform (Phase 1)
2. **Create Epic 54**: Session Lifecycle Enhancement (Phase 2)
3. **Create Epic 55**: Dashboard Intelligence (Phase 3)
4. **Create Epic 56**: Learning & Quality Assurance (Phase 4)
5. **Priority**: Start with Phase 1 — it unblocks everything else

---

_Session completed: 2026-03-31 | 60 ideas generated | 7 themes identified | 4-phase roadmap defined | 16 concrete action steps planned_
