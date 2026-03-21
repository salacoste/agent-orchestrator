---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'BMAD Workflow Orchestration Web UI — visual command center for managing the entire BMAD development lifecycle'
session_goals: 'Feature roadmap/epics, UX/UI ideas, architecture decisions, recommendation engine intelligence, comprehensive end-to-end vision'
selected_approach: 'user-selected + ai-recommended'
techniques_used: ['Role Playing', 'First Principles Thinking', 'Morphological Analysis', 'Cross-Pollination', 'Dream Fusion Laboratory', 'Reverse Brainstorming', 'Cross-Industry Pollination']
ideas_generated: 248
session_active: false
workflow_completed: true
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** R2d2
**Date:** 2026-03-20

## Session Overview

**Topic:** BMAD Workflow Orchestration Web UI — a visual command center for orchestrating BMAD agents, subagents, and workflows through the agent-orchestrator dashboard

**Goals:**
- Feature roadmap / epic list for BMAD orchestration capabilities
- UX/UI ideas for dashboard workflow management
- Architecture decisions for BMAD integration with the plugin system
- Recommendation engine intelligence ("what to do next")
- Comprehensive end-to-end vision

### Session Setup

_User selected a combined approach: first browsing the full technique library (user-selected), then AI-recommended techniques to fill gaps. 7 techniques executed across 14+ domains generating 248 ideas._

## Technique Selection

**Approach:** AI-Recommended + User-Selected Hybrid
**Selected Techniques:**

1. **Role Playing** — Embody 6 stakeholder personas (Solo Dev, Team Lead, PM, New Contributor, Reviewer, DevOps)
2. **First Principles Thinking** — Strip to 4 primitives (Observe/Decide/Act/Learn) and core data model
3. **Morphological Analysis** — 5-dimension matrix (View Scope × User Role × Time Horizon × Interaction Mode × Intelligence Level)
4. **Cross-Pollination** — Steal UX from Linear, Vercel, Figma, GitHub Copilot, Spotify
5. **Dream Fusion Laboratory** — Impossible visions reverse-engineered to practical steps
6. **Reverse Brainstorming** — Anti-patterns and what NOT to build
7. **Cross-Industry Pollination** — Aviation, healthcare, manufacturing, military, restaurant, music, gaming, ecology, journalism, finance, film

## Technique Execution Results

### Role Playing (6 Personas)

**Solo Developer:** Needs "You Are Here" orientation (#1), one-click "Next Step" launcher (#2), autopilot mode (#3)
**Team Lead:** Needs War Room agent grid (#4), auto-triage CI failures (#5), conflict radar (#6)
**PM/Stakeholder:** Needs Executive View toggle (#7), Decisions Needed queue (#8)
**New Contributor:** Needs Onboarding Flyover (#9), Context Injection for agents (#10)
**Code Reviewer:** Needs Spec-Aware PR Summary (#11), Diff Theater (#12), Review Pipeline (#13)
**DevOps:** Needs Cost Dashboard (#14), Efficiency Score (#15), Kill Switch with Grace (#16)

### First Principles Thinking

**4 Primitives:** Every BMAD action = OBSERVE / DECIDE / ACT / LEARN (#17)
**Core Data Model:** Artifact Dependency Graph, not sessions (#18)
**State Machine:** Workflow as graph, recommendations = available transitions (#19)
**Intelligence Plugin Slot:** Swappable brain — heuristic to ML (#20)

### Morphological Analysis — Dimension Matrix

| Dimension | Options |
|-----------|---------|
| View Scope | Single story / Sprint / Project / Portfolio |
| User Role | Dev / Lead / PM / Reviewer / DevOps / New |
| Time Horizon | Real-time / Session / Sprint / Historical |
| Interaction | Monitor / Click-to-act / Autonomous / Conversational |
| Intelligence | None / Heuristic / Pattern-based / Predictive |

**Notable combos:** Portfolio+PM+Historical (#21), Story+Dev+Conversational (#22), Sprint+Lead+Autonomous (#23), Command Palette (#24), Sprint Forecaster (#25)

### Cross-Pollination

Linear-style Kanban (#26), Vercel Deploy paradigm (#27), GitHub Copilot inline suggestions (#28), Figma multiplayer cursors (#29), Spotify Wrapped for sprints (#30)

### Dream Fusion Laboratory

Conversation with Your Project (#51), Time Travel Debugger (#52), Fully Autonomous Dream Sprint (#53), Multi-Project Orchestrator (#54), Agent Collaboration (#55), Learning Organization (#56), Ambient Dashboard (#57), Template Marketplace (#58), Story Replay (#59), Natural Language Orchestration (#60)

---

## Complete Idea Inventory (248 Ideas)

### Theme 1: Core Workflow Engine (9 ideas)
- #17 **4 Primitives** (Observe/Decide/Act/Learn) — every UI maps to one primitive
- #18 **Artifact Dependency Graph** as core data model — everything computed from this
- #19 **State Machine Workflow Engine** — deterministic "what's next" from graph traversal
- #33 **`Artifact` as first-class type in types.ts** — typed entities enable reasoning
- #34 **WorkflowEvent extension** of existing event system — new event types, zero new transport
- #35 **Artifact Scanner Service** — watches `_bmad-output/`, builds in-memory graph
- #36 **YAML State Machine Config** — workflow is data, not code
- #194 **Immutable Artifact Versions** — diff any two, rollback to any
- #245 **Living Specifications** — specs co-evolve with implementation

### Theme 2: Intelligence & Recommendation Engine (12 ideas)
- #20 **Intelligence Plugin Slot** — swappable: heuristic ↔ ML ↔ custom
- #44 **3-Layer Recommendation Stack** — deterministic → heuristic → predictive
- #45 **Readiness Score** per phase transition — continuous automatic quality gates
- #46 **Decision Tree Transparency** — show reasoning, build trust
- #47 **Blocker Buster** — proactive unblocking with options
- #48 **Workflow Anti-Pattern Detector** — gentle coaching nudges
- #49 **Parallel Opportunity Finder** — identifies safe parallelism
- #50 **Feedback Loop** — recommendations improve via accept/dismiss tracking
- #128 **Personality Matching** — story-agent affinity
- #129 **Pre-Flight Check** — agent success prediction
- #130 **Context Distillation** — smart agent prompting (signal not noise)
- #175 **iLayer meta-pattern** — intelligence as infrastructure layer

### Theme 3: Dashboard UX & Interaction (24 ideas)
- #1 **"You Are Here" Project State Map** — visual pipeline with current position
- #2 **"Next Step" One-Click Launcher** — recommended action button
- #7 **Executive View** toggle — PM vs dev lens
- #24 **Command Palette** (Cmd+K) — natural language action interface
- #64 **Dark Mode War Room / Light Mode Planning** — context-adaptive theme
- #76 **Split Screen** — artifact + agent side-by-side
- #77 **Breadcrumb Navigation** — always know where you are
- #78 **Notification Priority** — 3 tiers (red/amber/green)
- #79 **Customizable Widget Grid** — drag-and-drop layout
- #80 **Quick Actions Floating Bar** — persistent bottom bar
- #90 **Diff Preview** before phase advance — dry-run for transitions
- #96 **Artifact Diff** — version comparison with provenance
- #98 **Focus Mode** — single story deep dive
- #103 **Keyboard-First Navigation** — full shortcut system
- #135 **Progressive Complexity** — UI grows with user expertise
- #181 **Quick Peek** — hover previews everywhere
- #192 **Notification Digest** — daily summary email
- #207 **Anti-Addiction nudge** — optimize for disengagement
- #208 **Micromanagement Trap** counter — push humans up abstraction ladder
- #209 **Metric Vanity** warnings — honest metric health warnings
- #210 **Automation Complacency** gates — periodic zoom-out
- #222 **Inverted Pyramid** status reports — most important info first
- #224 **Director's Cut vs Theatrical** — completion quality modes
- #230 **ELI5 Mode** — plain language for non-technical

### Theme 4: Agent Fleet Management (14 ideas)
- #4 **War Room Agent Grid** — stories as rows, status as columns
- #16 **Kill Switch with Grace** — save/reassign/rollback options
- #37 **Dead Agent Detection & Recovery** — silence as signal
- #70 **Agent Personality Profiles** — Careful/Speed/Security configs
- #74 **Agent Swap** — hot-replace running agent preserving context
- #88 **Agent Queue** — priority-based auto-spawn backlog
- #95 **Resource Pool** — shared agent capacity across team
- #141 **Heartbeat Protocol** — explicit liveness every 60s
- #143 **Zombie Process Reaper** — reclaim resources from dead processes
- #182 **Pre-Warmed Agent Pools** — instant spawn from warm pool
- #186 **Agent Affinity** — sticky assignment for related stories
- #193 **Agent Shadowing** — learning mode for new agents
- #196 **Panic Button** — emergency stop all
- #214 **WIP Limits** (Kanban) — fewer concurrent = faster overall

### Theme 5: Real-Time Observability & Visualization (12 ideas)
- #29 **Figma-style Multiplayer Cursors** — see what agents edit live
- #57 **Ambient Dashboard** — passive awareness display
- #87 **Agent Health Heartbeat Visualizer** — pulsing dots
- #104 **Agent Log Streaming** — xterm.js live terminal in browser
- #117 **3D Dependency Constellation** — Three.js artifact graph
- #118 **Velocity Heatmap** — sprint-over-sprint patterns
- #119 **Agent Activity Stream** — GitHub-style contribution graph
- #120 **Sankey Diagram** — workflow flow with friction visible
- #121 **Real-Time Code Change Visualization** — animated treemap
- #122 **Sprint Replay** — time-lapse for retros
- #152 **Sonification** — audio status layer
- #237 **LED Status Strip** — ambient hardware indicator

### Theme 6: Architecture & Platform (12 ideas)
- #31 **Workflow Plugin Slot** (#9) — BMAD is swappable
- #32 **Intelligence Plugin Slot** (#10) — swappable recommendation backend
- #81 **REST + SSE API Layer** — unified API for all clients
- #82 **Event Sourcing** — state = reduce(all events)
- #83 **SDK** `@composio/ao-sdk` — enable custom integrations
- #84 **Config-as-Code** — workflow definitions in git
- #85 **Headless Mode** — API without dashboard for CI/CD
- #91 **Multi-Tenant Support** — auth, permissions, teams
- #183 **Event Schema Registry** — plugins get dashboard for free
- #189 **Plugin Composition** — fallback chains in YAML
- #178 **Universal API meta-pattern** — API-first, interfaces multiply
- #179 **Observable by Default meta-pattern** — every action emits events

### Theme 7: Error Recovery & Resilience (11 ideas)
- #38 **Cascade Failure Circuit Breaker** — system-level correlated failure response
- #39 **Conflict Resolution Wizard** — 3-way diff with AI merge suggestion
- #40 **Regression Guardian** — cross-story testing before merge
- #41 **Checkpoint & Rollback** — Time Machine for agent work
- #42 **Orphan Cleanup Daemon** — auto-clean abandoned resources
- #71 **Infinite Loop Detector** — break agent cycles externally
- #72 **Graceful Degradation** — offline-capable, stale-data-tolerant
- #139 **Offline-First Dashboard** — IndexedDB cache, background sync
- #140 **Event Replay Recovery** — rebuild state from event log
- #142 **State Snapshots** — periodic checkpoints for fast restore
- #197 **Self-Healing Orchestrator** — auto-fix own issues

### Theme 8: Agent-Human Communication (8 ideas)
- #215 **Commander's Intent** — goal-based agent briefing
- #225 **Agent Status Narratives** — stories not states
- #226 **Reasoning Trail** — show agent decision logic
- #227 **Help Request Protocol** — formal "I'm stuck" with choices
- #228 **Confidence Indicator** per file — direct reviewer attention
- #229 **Agent Diary** — session journal (WHY and HOW)
- #132 **Code Style Enforcer** — project-aware agent guardrails
- #131 **Post-Mortem Auto-Generator** — auto-analyze agent failures

### Theme 9: Collaboration & Multi-User (8 ideas)
- #111 **Team Presence** — avatar bubbles showing who's watching
- #112 **Claim System** — one person commits, others move on
- #113 **Shared Annotations** on artifacts
- #114 **Role-Based Agent Ownership** — distributed accountability
- #115 **Decision Log** — institutional memory
- #116 **Handoff Protocol** — follow-the-sun development
- #158 **Timezone-Aware Sprint Management**
- #177 **Social Orchestrator meta-pattern**

### Theme 10: Analytics, Cost & Reporting (13 ideas)
- #14 **Cost Dashboard** — real-time token burn per agent/story/sprint
- #15 **Efficiency Score** — tokens / story points ratio
- #25 **Sprint Forecaster** — predictive completion probability
- #30 **Spotify Wrapped for Sprints** — fun shareable retro
- #61 **ROI Calculator** — prove agent value ($47 tokens vs 170 dev-hours)
- #63 **Sprint Broadcast** — shareable progress infographic
- #65 **Technical Debt Radar** — agent-generated debt tracking
- #68 **Scope Creep Detector** — token/file usage vs estimate
- #92 **Meeting Summary Generator** — standup update button
- #97 **Sprint Health Score** — composite 0-100 metric
- #105 **Workflow Bottleneck Analyzer** — identify slowest phases
- #188 **Sprint Diff** — compare two sprints side-by-side
- #231 **Sprint Clock** — visual time-vs-work countdown

### Theme 11: Onboarding & Education (7 ideas)
- #9 **Onboarding Flyover** — auto-generated project narrative
- #10 **Context Injection** — agents start smart, not cold
- #69 **BMAD Academy** — interactive tutorial
- #136 **Guided Workflow** — step-by-step overlay
- #137 **BMAD Coach** — contextual tips reading YOUR state
- #138 **Template Gallery** — pre-built project archetypes
- #211 **Zero-Config Default** — 60-second time-to-first-agent

### Theme 12: Security & Compliance (8 ideas)
- #75 **Quality Gate Automation** — continuous at every transition
- #106 **Agent Sandbox** — per-story permission boundaries
- #107 **Secret Rotation Alert** — auto-detect committed secrets
- #108 **Compliance-Grade Audit Trail** — SOC2/ISO ready
- #109 **Approval Workflows** — risk-proportional human gates
- #110 **Agent Isolation Levels** — shared/isolated/quarantined
- #239 **Code Provenance** — AI attribution tracking
- #240 **License Compliance Scanner** — block incompatible deps

### Theme 13: Integrations & Ecosystem (12 ideas)
- #66 **Webhook-First** external integration — zero-code connection
- #67 **Mobile Companion PWA** — phone notifications + quick actions
- #83 **SDK** — TypeScript SDK for custom integrations
- #123 **VS Code Extension** — orchestrator sidebar
- #124 **Git Hook Integration** — git as event source
- #125 **GitHub Action** — CI pipeline orchestration
- #126 **Cursor/Windsurf Integration** — feed context to IDE AI
- #127 **Terminal Multiplexer View** — multi-pane tmux in browser
- #170 **Plugin Registry** — npm for AO plugins
- #171 **Workflow Recipes** — shareable configurations
- #198 **White Label** — custom-branded orchestrator
- #238 **Stream Deck Integration** — physical buttons

### Theme 14: Moonshot Vision (12 ideas)
- #3 **Autopilot Mode** — auto-advance workflows
- #51 **Conversation with Your Project** — project as entity
- #52 **Time Travel Debugger** — navigate any historical state
- #53 **Dream Sprint** — fully autonomous brief-to-merge
- #55 **Agent Collaboration** — agents negotiate directly
- #59 **Story Replay** — watch agent work as time-lapse
- #60 **Natural Language Orchestration** — talk, don't click
- #146 **Digital Twin** — simulated sprint before committing
- #200 **Meta-Orchestrator** — orchestrators orchestrating orchestrators
- #244 **Agent-First, Human-Optional** — Level 5 autonomy
- #246 **Swarm Intelligence** — decentralized emergent coordination
- #248 **Failure as Feature** — intentional multi-approach exploration

### Theme 15: Developer Psychology & Behavioral Design (6 ideas)
- #201 **Flow State Protector** — suppress non-critical notifications during focus
- #202 **Decision Fatigue Detector** — suggest batching when response time slows
- #203 **Confidence Calibration** — honest uncertainty in recommendations
- #204 **Celebration Moments** — positive reinforcement at milestones
- #205 **Cognitive Load Meter** — triage decisions by mental weight
- #206 **Streak Counter** — momentum tracker

### Theme 16: Cross-Industry Patterns (13 ideas)
- #212 **Pre-Flight Checklist** (aviation) — standardized launch protocol
- #213 **Triage Protocol** (healthcare) — emergency prioritization
- #214 **WIP Limits** (manufacturing/Kanban) — constraint-based flow
- #215 **Commander's Intent** (military) — goal-based briefing
- #216 **Mission Control** (space) — console layout pattern
- #217 **Ticket System** (restaurant) — order-based workflow
- #218 **Conductor Mode** (music) — orchestration literal
- #219 **Fog of War** (gaming) — progressive information reveal
- #220 **Supply Chain** (logistics) — package tracking for stories
- #221 **Carrying Capacity** (ecology) — resource equilibrium
- #222 **Inverted Pyramid** (journalism) — most important info first
- #223 **Portfolio Theory** (finance) — risk diversification
- #224 **Director's Cut** (film) — quality modes

### Theme 17: Accessibility & i18n (9 ideas)
- #151 **Screen Reader-First** agent status
- #152 **Sonification** — audio status layer
- #153 **High Contrast Mode** — shape + pattern, not just color
- #154 **Reduced Motion** dashboard toggle
- #155 **Voice Navigation** — full voice alternative
- #156 **Localized Workflow Phases** — Russian, Chinese, Japanese, etc.
- #157 **Multi-Language Agent Prompts**
- #158 **Timezone-Aware Sprint Management**
- #159 **RTL Layout** — Arabic/Hebrew support

### Theme 18: Business & Community (10 ideas)
- #58 **Template Marketplace** — share BMAD workflows
- #61 **ROI Calculator**
- #147 **Agent Marketplace** — community agent configs
- #165 **Freemium Tiers** — free/pro/team/enterprise
- #166 **Token Credits** — pay-per-agent-minute
- #167 **Enterprise Compliance Package**
- #168 **Partner Ecosystem** — AI provider integrations
- #169 **Consulting Marketplace** — BMAD experts for hire
- #172 **Open Telemetry** — anonymized usage analytics
- #173 **Contributor Dashboard** — meta-meta view

### Theme 19: Legal & Ethical (4 ideas)
- #239 **Code Provenance** — AI attribution tracking
- #240 **License Compliance Scanner**
- #241 **Bias Audit** — agent output analysis
- #242 **Environmental Impact** — carbon footprint tracker

### Theme 20: Meta & Testing (5 ideas)
- #160 **Dogfooding Mode** — use BMAD to build BMAD
- #161 **Simulation Mode** — test workflows with mock agents
- #162 **Chaos Monkey** — stress-test resilience
- #163 **Benchmark Suite** — automated performance testing
- #164 **Plugin Test Harness** — standardized plugin quality

### Theme 21: Temporal Orchestration (5 ideas)
- #231 **Sprint Clock** — visual time-vs-work countdown
- #232 **Business Hours Awareness** — time-aware spawning
- #233 **Historical Pattern** — time-of-day performance analytics
- #234 **Deadline Pressure Adaptation** — pragmatic trade-offs near deadline
- #235 **Cool-Down Period** — post-sprint automated cleanup

### Theme 22: Physical Space & Hardware (3 ideas)
- #236 **Team Screen** — 55" TV information radiator
- #237 **LED Status Strip** — ambient hardware indicator
- #238 **Stream Deck Integration** — physical buttons

### Theme 23: Paradigm Shifts (6 ideas)
- #243 **No Dashboard** — pure push, no pull
- #244 **Agent-First, Human-Optional** — Level 5 autonomy
- #245 **Living Specifications** — specs co-evolve
- #246 **Swarm Intelligence** — decentralized coordination
- #247 **Code as Conversation** — real-time pair programming
- #248 **Failure as Feature** — intentional multi-approach exploration

---

## Prioritization Results

### Horizon 0: Already Exists (Extend, Don't Rebuild)
Existing code in the project that ideas build upon:
- Fleet monitoring matrix → extend with #4 War Room grid
- Agent session cards → extend with #87 heartbeat visualizer
- Workflow dashboard → extend with #1 "You Are Here" map
- Burndown charts → extend with #231 Sprint Clock
- Event system + SSE → extend with #34 WorkflowEvents
- Learning store → extend with #176 Compound Learning

### Horizon 1: Foundation (Weeks 1-4) — P0/P1

**P0 — Core Data Model:**
- #19 State Machine Workflow Engine
- #33 Artifact type in types.ts
- #35 Artifact Scanner Service
- #36 YAML State Machine Config
- #34 WorkflowEvent extension

**P0 — Primary UX:**
- #1 "You Are Here" Project State Map
- #2 "Next Step" One-Click Launcher
- #4 War Room Agent Grid (extend existing fleet view)

**P1 — Intelligence Layer 1:**
- #44 Layer 1 (deterministic from state machine)
- #45 Readiness Score per phase transition
- #75 Quality Gate Automation

**P1 — Agent Communication (prompt changes only):**
- #215 Commander's Intent in agent prompts
- #225 Agent Status Narratives
- #227 Help Request Protocol

**P1 — Quick Wins:**
- #77 Breadcrumb Navigation (2h)
- #78 Notification Priority tiers (3h)
- #103 Keyboard shortcuts (4h)
- #181 Hover previews (4h)
- #211 Zero-Config Default (4h)
- #231 Sprint Clock (1h)

### Horizon 2: Intelligence & Power (Weeks 5-12) — P1/P2

**P1:**
- #37 Dead Agent Detection + #141 Heartbeat Protocol
- #38 Circuit Breaker + #71 Loop Detector
- #41 Checkpoint & Rollback
- #14 Cost Dashboard + #15 Efficiency Score
- #51 Conversation with Your Project (high wow, low effort)

**P2:**
- #44 Layer 2 (heuristic recommendations)
- #47 Blocker Buster + #49 Parallel Opportunity Finder
- #70 Agent Profiles + #128 Personality Matching
- #24 Command Palette
- #39 Conflict Resolution Wizard
- #84 Config-as-Code
- #138 Template Gallery
- #226 Reasoning Trail + #228 Confidence Indicator

### Horizon 3: Scale & Ecosystem (Months 4-12) — P2/P3

**P2:**
- #111-116 Multi-User Collaboration suite
- #81 REST + SSE API Layer (formalized)
- #83 SDK + #85 Headless Mode
- #106 Agent Sandbox + #108 Audit Trail

**P3:**
- #170 Plugin Registry + #171 Workflow Recipes
- #44 Layer 3 (predictive) + #25 Sprint Forecaster
- #123 VS Code Extension + #125 GitHub Action
- #43+#50+#56 Compound Learning System
- #91 Multi-Tenant Support

### Horizon 4: Moonshots (Year 2+) — P3/P4

**P3:**
- #53 Dream Sprint (autonomous pipeline)
- #55 Agent Collaboration (agents negotiate)
- #146 Digital Twin (simulated sprints)
- #60 Natural Language Orchestration

**P4:**
- #200 Meta-Orchestrator
- #244 Agent-First autonomy
- #246 Swarm Intelligence
- #145 AR Dashboard

---

## Breakthrough Differentiators — What Makes This Product Unique

1. **State Machine as Recommendation Engine (#19)** — Deterministic, testable, zero-AI intelligence covering 80% of cases. No other tool does this.
2. **Compound Learning System (#176)** — Every sprint improves the next. This is the competitive MOAT. Impossible to replicate without usage data.
3. **Push Not Pull to the Extreme (#243, #207, #8)** — The best dashboard is one you DON'T open. Optimize for human disengagement.
4. **Intelligence as Plugin Slot (#20, #32)** — Swappable brain. Rules today, ML tomorrow. Users choose their intelligence level.
5. **Agent Communication Protocol (#225-229)** — Agents that EXPLAIN themselves. Reasoning trails, confidence indicators, help requests. Transforms agents from black boxes to transparent collaborators.
6. **Artifact Graph as Core (#18)** — Not sessions, not agents — ARTIFACTS are the primary entity. Everything else is computed from the graph.

---

## Proposed Epic Structure (for PRD/Sprint Planning)

### Epic A: Workflow Engine Foundation
Stories: Artifact type, Scanner service, State machine config, WorkflowEvents, "You Are Here" UI, "Next Step" launcher

### Epic B: Intelligence Layer v1
Stories: Layer 1 deterministic recommendations, Readiness scoring, Quality gates, Anti-pattern detection

### Epic C: Fleet Management v2
Stories: War Room grid, Heartbeat protocol, Dead agent detection, Circuit breaker, Kill Switch, WIP limits

### Epic D: Agent Communication
Stories: Commander's Intent prompts, Status narratives, Help request protocol, Reasoning trail, Confidence indicators

### Epic E: Dashboard UX Polish
Stories: Breadcrumbs, Keyboard shortcuts, Hover previews, Notification tiers, Sprint clock, Command palette, Focus mode

### Epic F: Analytics & Cost
Stories: Cost dashboard, Efficiency score, Sprint health score, ROI calculator, Scope creep detector

### Epic G: Intelligence Layer v2
Stories: Heuristic recommendations, Blocker buster, Parallel finder, Agent profiles, Template gallery

### Epic H: Collaboration & Multi-User
Stories: Team presence, Claim system, Handoffs, Decision log, Role-based ownership

### Epic I: Platform & Ecosystem
Stories: SDK, Headless mode, Config-as-code, Plugin registry, Workflow recipes, VS Code extension

### Epic J: Compound Learning
Stories: Learning store integration, Cross-sprint patterns, Failure analysis, Feedback loops

---

## Action Plan — Next Steps

### This Week (Quick Wins)
1. Add breadcrumb navigation to all dashboard pages (2h)
2. Add sprint clock countdown to sprint view (1h)
3. Add hover preview tooltips for story/agent references (4h)
4. Update agent spawn prompts with Commander's Intent pattern (2h)
5. Add notification priority tiers to existing notification system (3h)

### Next 2 Weeks (Horizon 1 Core)
1. Define `Artifact` interface in `types.ts`
2. Build Artifact Scanner service (watch `_bmad-output/`, parse frontmatter, build graph)
3. Define YAML state machine config format, add to `agent-orchestrator.yaml`
4. Implement "You Are Here" workflow phase visualization component
5. Implement "Next Step" button with Layer 1 deterministic recommendations
6. Extend fleet view to War Room grid layout

### Month 2 (Horizon 1 Complete)
1. WorkflowEvent types + SSE integration
2. Readiness scoring for all phase transitions
3. Quality gate automation
4. Agent status narratives + help request protocol
5. Zero-config default + guided first-run

### Months 3-6 (Horizon 2)
1. Intelligence Layer 2 (heuristic recommendations)
2. Agent health monitoring + circuit breaker
3. Cost dashboard + efficiency scoring
4. Conflict resolution wizard
5. "Conversation with Your Project" chat interface
6. Template gallery + config-as-code

---

## Session Summary and Insights

**Key Achievements:**
- 248 ideas generated across 23 thematic clusters and 14+ domains
- Clear 4-horizon roadmap from quick wins to moonshots
- 6 breakthrough differentiators identified as competitive moat
- 10 proposed epics ready for PRD/sprint planning
- Concrete action plan with specific weekly deliverables

**Creative Breakthroughs:**
- State Machine as recommendation engine — 80% of "AI intelligence" is actually graph traversal
- Push Not Pull as design philosophy — optimize for human DISENGAGEMENT
- Artifact Graph as core data model — sessions are ephemeral, artifacts persist
- Commander's Intent for agents — goal-based prompting improves agent adaptability
- Compound Learning as competitive moat — impossible to replicate without usage history

**Session Reflections:**
This session revealed that the BMAD orchestration dashboard is not a monitoring tool — it's an autonomous development pipeline with human oversight. The fundamental reframe from "dashboard for watching agents" to "intelligent pipeline that notifies humans when needed" changes every design decision. The state machine + artifact graph foundation enables everything else: recommendations, quality gates, learning, and eventually full autonomy.

### Creative Facilitation Narrative

The session used 7 techniques across 14+ domains over an intensive exploration. Role Playing established WHO we're building for (6 distinct personas with different needs). First Principles stripped away assumptions to find the 4 primitives and artifact graph core. Morphological Analysis systematically mapped the 5-dimension space revealing non-obvious combos like "conversational story view" and "autonomous sprint mode." Cross-Pollination stole the best UX patterns from Linear, Vercel, Figma, and Spotify. Dream Fusion generated impossible visions that reverse-engineered to surprisingly practical implementations. Reverse Brainstorming identified critical anti-patterns (dashboard addiction, micromanagement trap, metric vanity). Cross-Industry Pollination brought aviation checklists, healthcare triage, manufacturing WIP limits, and military intent-based orders into software orchestration.

The most productive moment was the realization that "Conversation with Your Project" (#51) — seemingly a moonshot — is actually buildable TODAY with the artifact graph + event log fed to Claude with a system prompt. Dreams reverse-engineered to reality.
