---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - technical-bmad-workflow-engine-integration-research-2026-03-13.md
  - project-context.md
  - bmad-tracker-plugin.md
  - bmad-web-dashboard.md
  - bmad-cli-commands.md
date: 2026-03-13
author: R2d2
---

# Product Brief: agent-orchestrator

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

Agent Orchestrator's Sprint Board answers "how are my coding agents doing right now?" But the moment a team asks "what should we build next?" or "where are we in the planning process?" — the dashboard goes dark. The entire BMAD methodology lifecycle — analysis, planning, solutioning, implementation — happens invisibly in files and CLI commands, with no centralized view of progress, no guidance on next steps, and no way to understand at a glance which phases are complete and which need attention.

**BMAD Workflow Dashboard** lights up the full map. A new "Workflow" tab surfaces real-time BMAD methodology progress — phase completion, active workflows, available agents, generated artifacts — alongside a deterministic AI Guide that recommends what to do next. Zero new dependencies, zero LLM costs, zero infrastructure changes. The existing file-based architecture and SSE infrastructure extend naturally to deliver lifecycle visibility that no competing tool provides.

The result: developers stop context-switching to terminal commands and file explorers to understand project state. They open one tab, see exactly where they are, and know exactly what to do next — in under 5 seconds.

---

## Core Vision

### Problem Statement

Teams using BMAD methodology with Agent Orchestrator face a fundamental visibility gap. The Sprint Board tracks *execution* — which agents are running, which PRs are open, which CI checks are passing. But the broader *planning and methodology lifecycle* remains opaque:

- **Phase blindness**: No way to see whether a project is in Analysis, Planning, Solutioning, or Implementation without inspecting files manually
- **Next-step uncertainty**: Users must remember which BMAD workflow step comes next, which agent to invoke, and which artifacts are required
- **Artifact sprawl**: Generated documents (research reports, PRDs, architecture specs, story files) accumulate in `_bmad-output/` with no centralized inventory or status tracking
- **Context loss across sessions**: When a user returns after hours or days, they must reconstruct project state from scattered files and CLI history

### Problem Impact

- **Cognitive overhead**: Developers spend 10-15 minutes per session reconstructing "where am I?" before they can make progress
- **Methodology drift**: Without visibility into phase completion, teams skip steps or repeat work unnecessarily
- **Onboarding friction**: New team members cannot understand project state without deep file-system archaeology
- **Underutilization**: BMAD's 9 specialized agents and structured workflows go unused because users don't know what's available or when to invoke them

### Why Existing Solutions Fall Short

| Tool Category | What It Does | What It Misses |
|---|---|---|
| **GitHub Projects / Linear / Jira** | Track issues and sprints | No awareness of BMAD methodology phases or workflow state |
| **IDE extensions** | File browsing, syntax highlighting | No semantic understanding of BMAD artifacts or phase progression |
| **CI/CD dashboards** | Pipeline status, test results | Only see implementation phase; blind to analysis/planning/solutioning |
| **Agent Orchestrator Sprint Board** | Agent sessions, PR state, sprint health | Execution-focused; no methodology lifecycle visibility |

No existing tool understands the BMAD workflow lifecycle. Agent Orchestrator is uniquely positioned because it already has the architecture — plugin system, file-based state, SSE real-time updates, project-aware dashboard — to extend naturally into methodology visibility. This is a **category of one**: BMAD-aware lifecycle dashboard with AI-guided next steps.

### Proposed Solution

**BMAD Workflow Dashboard** — a new tab in the Agent Orchestrator web dashboard that provides:

1. **Phase Progress Bar**: Visual 4-phase (Analysis → Planning → Solutioning → Implementation) progress indicator showing completion state per phase, computed from BMAD artifacts on disk
2. **Active Workflow Display**: Current step, active agent, and workflow progress for any running BMAD workflow
3. **Available Agents Panel**: List of 9 BMAD agents with descriptions and invocation context — surfacing what's available and when each is relevant
4. **AI Guide Recommendations**: Deterministic, rule-based recommendation engine (zero LLM cost) with 4-tier priority system — tells users what to do next based on artifact state and phase progression
5. **Artifact Inventory**: Centralized list of all generated BMAD documents with status, type, and quick-access links

**Architecture principles**:
- **Read-only integration**: Web UI reads BMAD files but never rewrites them — CLI remains the canonical authoring interface
- **Unidirectional data flow**: File change → chokidar → state recomputation → SSE → UI
- **Last-Known-Good state**: Malformed or mid-edit files never crash the UI; previous valid state is retained silently
- **Zero new dependencies**: Built entirely with existing stack (Next.js 15, React Server Components, Tailwind, SSE)

**Delivery scope**: 8 user stories, 5 new components, 1 new page, 1 new API endpoint. Estimated ~6 working days, single sprint.

**Future vision** (not in deliverable scope): Interactive workflow editor enabling users to customize BMAD workflows, create custom agents, and modify phase sequences directly from the dashboard.

### Key Differentiators

1. **Zero cognitive load**: Users understand project state in <5 seconds — glanceable phase bar, clear next-step guidance, no documentation required
2. **Deterministic AI Guide**: Rule-based recommendations with zero LLM cost, zero latency, zero API keys. 4-tier priority system derived from artifact state analysis
3. **Zero infrastructure cost**: No database, no cloud services, no API fees. File-based, local-first, extends existing architecture
4. **Stigmergy-native**: Follows the project's established pattern — components coordinate through file system changes, not direct communication. CLI and web coexist naturally
5. **Graceful degradation**: Missing files show invitation state (not errors), malformed files fall back to last-known-good state, partial BMAD setups show what's available
6. **Category of one**: No competing tool provides BMAD methodology lifecycle visibility with AI-guided next steps. This extends Agent Orchestrator from an execution monitor to a full lifecycle companion

---

## Target Users

### Design Principles

Four principles govern all user-facing decisions:

1. **Zero cognitive load** — Understand project state in <5 seconds
2. **Lens, not platform** — Dashboard shows local file state; no collaboration features; git handles multi-user sync
3. **Stateless comprehension** — Identical, objective, file-derived view for every user. No session history, no personalization, no user-specific views
4. **Inform, don't instruct** — Present state and implications, never give orders. AI Guide uses context voice: "[State observation]. [Implication/next artifact]." Calm, factual, dense. No imperatives, no emoji, no encouragement

### Primary User: BMAD Practitioner

**Profile**: Full-stack developer or tech lead using Agent Orchestrator to manage AI coding agents with BMAD methodology. Scales from solo developer with one project to tech lead managing 2-5 projects at different lifecycle stages.

**Context**: Runs BMAD workflows through CLI (`ao` commands), spawns agents, walks away, comes back hours or days later. Needs to context-switch efficiently between projects and quickly reconstruct state after absence.

**Motivation**: Ship features faster by leveraging BMAD methodology and parallel agents without losing track of where things stand across the full lifecycle.

**Pain today**: Returns to a project and spends 10-15 minutes reconstructing state — checking `_bmad-output/` for artifacts, reading CLI history, figuring out which BMAD phase is current and what step comes next. For multi-project leads, this multiplies across every project.

**Key scenario — Context recovery after absence**: The highest-value moment. Developer returns to their own project after a 2-week break. They wrote the PRD themselves but forgot where they left off. The AI Guide shows: "Planning complete. Solutioning phase has no artifacts." Instant context recovery. They start working within 30 seconds.

**Success moment**: Opens the Workflow tab, immediately sees phase progression and AI Guide observation, and knows exactly where the project stands — in under 5 seconds.

**Key interaction**: Daily "status check" — glance at phase bar, read AI Guide observation, act on implication. For multi-project leads: morning "portfolio scan" — switch between projects via dropdown, identify which need attention, dive into the one that's stalled.

### Secondary User: Project Explorer

**Profile**: Anyone who needs to understand an unfamiliar BMAD project's state. Could be a developer joining mid-stream, inheriting a project, reviewing a colleague's repo, or exploring an open-source project that uses BMAD.

**Context**: Unfamiliar with the project's history, BMAD phase progression, or what artifacts have been generated. Needs to get up to speed without asking 20 questions or performing file-system archaeology.

**Pain today**: Faces a `_bmad-output/` directory full of files with no context on what's been done, what's in progress, or what's needed next. The Sprint Board shows active agents but not the bigger picture.

**Success moment**: Opens Workflow tab, sees the artifact inventory (research done, PRD done, architecture in progress), reads the AI Guide ("Planning complete. Solutioning phase has no artifacts."), and immediately understands the project's state and what they can contribute.

**Key interaction**: One-time orientation deep dive, then periodic check-ins. The artifact inventory (Story 7) and available agents panel (Story 5) are disproportionately valuable for this persona.

**Note**: Both personas interact with identical UI — the distinction informs content decisions (self-explanatory labeling, no jargon) rather than layout or functionality. These personas are hypotheses to be validated through MVP usage observation.

### Incidental Beneficiary: Non-Technical Stakeholder

Product managers, engineering managers, or project sponsors who want a quick read on project progress without touching CLI. They benefit passively from the phase progress bar's "traffic light" view but are **not a design target**. Designing for stakeholders would add explanatory UI, tooltips, and onboarding flows that increase cognitive load for the primary BMAD Practitioner. The dashboard URL can be shared, but the UI optimizes for the expert user.

### Anti-Patterns (Explicitly Not For)

1. **Non-BMAD developer** — Uses Agent Orchestrator purely for agent spawning and Sprint Board. No `_bmad/` directory. Sees `EmptyWorkflowState` invitation, which is fine. We don't try to convert them.
2. **PM-tool-seeker** — Expects Jira-like boards, ticket assignments, time tracking. We're a methodology visibility tool, not a project management platform.
3. **UI-customizer** — Wants to drag-and-drop phases, create custom agents in the UI, redesign the methodology. That's future vision scope. MVP is read-only.

### User Journey

| Stage | BMAD Practitioner | Project Explorer |
|---|---|---|
| **Discovery** | Sees new "Workflow" tab after upgrading Agent Orchestrator | Led to dashboard URL by colleague, or opens unfamiliar BMAD repo |
| **First visit (empty)** | `EmptyWorkflowState` — inviting CTA: "Start your first BMAD workflow" | Same component — clear signal that BMAD is available but not yet used |
| **First visit (with data)** | Phase bar shows progress, AI Guide shows next observation — instant value | Artifact inventory reveals project history, agents panel shows available tools |
| **Aha moment** | "I know exactly where I am and what to do next — in 5 seconds" | "I understand this project's history without reading 20 files" |
| **Routine** | Workflow tab becomes default landing page for methodology work | Reference point when context-switching between projects |

### Story-to-Persona Value Map

| Story | BMAD Practitioner | Project Explorer |
|---|---|---|
| 3. Phase progress bar | **Primary value** | **Primary value** |
| 6. AI Guide | **Primary value** | High |
| 5. Available agents panel | Medium | **High** |
| 7. Artifact inventory | Medium | **High** |
| 4. Active workflow display | High | Medium |
| 1, 2, 8 (foundation + nav) | Enables all | Enables all |

### Accessibility

- **Keyboard navigation**: All panels fully keyboard-accessible using semantic HTML (`<nav>`, `<button>`, `<ol>`, `<section>`)
- **Color-independent status**: Phase bar uses labels + icons + color — never color alone. "Analysis ✓ | Planning ✓ | Solutioning → | Implementation ○"
- **Screen reader support**: Proper ARIA labels — "Project phase: Solutioning, step 3 of 5, 60% complete"
- **i18n**: English-only. BMAD methodology terms are English-native. No localization for MVP or near-term

### AI Guide Voice

The AI Guide uses **context voice** — factual observations, no directives:

- **Pattern**: "[State observation]. [Implication/next artifact]."
- **Examples**:
  - "Analysis phase complete. Planning phase has no artifacts yet."
  - "PRD exists. Architecture spec not found."
  - "All planning artifacts present. Solutioning phase ready to begin."
  - Empty state: "No BMAD artifacts detected. First phase: Analysis."
- **Engine returns structured data** (tier, observation, implication, phase); UI component formats display text
- **Visual styling conveys urgency**, not word choice — Tier 1 prominent, Tier 4 subtle
- **MVP ships Tier 1-2 only** (high confidence, file-existence-based). Tier 3-4 post-MVP

---

## Success Metrics

### MVP-Measurable Metrics

#### User Success (Qualitative)

| Metric | Target | Test Protocol |
|---|---|---|
| **Time to comprehension** | <5 seconds | Show 3 testers a Workflow tab with a mid-solutioning project (2 phases complete, 1 in progress, 1 not started). Ask: "What phase is this project in?" and "What should happen next?" Both correct within 5 seconds = pass |
| **Context recovery** | <30 seconds to productive action | Returning developer opens Workflow tab after multi-day absence, starts meaningful work within 30 seconds |
| **First-visit aha moment** | 3/3 testers understand immediately | Qualitative observation — testers navigate without guidance or confusion |
| **Self-evidence** | Usable without any documentation | A developer familiar with BMAD can use all Workflow tab features without consulting docs. Documentation exists only for reference, not learning |

#### Technical KPIs (Automated)

| KPI | Target | Measurement |
|---|---|---|
| **New dependencies** | 0 | `package.json` diff — no new entries. CI-verifiable |
| **Bundle size increase** | <50KB total for all new components | Next.js build output analysis |
| **API response time** | <100ms for `/api/workflow/[project]` | Automated performance test |
| **Page load time** | <500ms initial render | Lighthouse or manual measurement |
| **SSE update latency** | <200ms from file change to UI update | Integration test with chokidar + SSE |
| **Sprint Board regression** | Zero performance degradation | Existing test suite + before/after comparison |
| **Error rate** | Zero crashes in normal use (empty, partial, full, malformed file states) | QA test matrix across all file states |
| **AI Guide correctness** | 100% for Tier 1-2 | Unit test suite with exhaustive state permutations — deterministic engine, file-existence-based |
| **Test coverage** | >80% recommendation engine, >70% components | vitest coverage report |
| **API route count** | Exactly 1 new route (`/api/workflow/[project]`) | Code review — more routes = data model wasn't clean |

### Post-MVP Trackable Metrics

#### Adoption & Engagement (requires optional localStorage counters — Phase 2)

| Metric | Target | Timeframe |
|---|---|---|
| **Tab visit rate** | >50% of dashboard sessions include Workflow tab | 3 months post-launch |
| **Panel interaction distribution** | Understand which panels users engage with most | Ongoing — validates persona hypotheses |
| **Return visits** | Users revisit Workflow tab within 7 days | 3 months |

#### Community Signals (OSS-specific)

| Signal | What It Indicates | Measurement |
|---|---|---|
| **GitHub stars trajectory** | Project interest after Workflow Dashboard ships | Stars delta in 30/60/90 days post-launch |
| **Issue quality** | Feature requests *for* Workflow tab (engagement) vs. bug reports *about* it (quality) | GitHub issue categorization |
| **Adoption mentions** | New users cite Workflow Dashboard in setup experience | GitHub discussions, social mentions |
| **Zero support burden** | No "how to use Workflow tab" issues filed | 3 months — self-explanatory UI or we've failed |

### Contributor Experience Metrics

| Metric | Target | Rationale |
|---|---|---|
| **Component isolation** | Each panel developable and testable independently | OSS contributors can add/modify one panel without touching others |
| **API contract stability** | Response shape documented and versioned | Contributors build against a stable contract |

### Business Objectives

| Objective | Success Indicator | Timeframe |
|---|---|---|
| **Lifecycle visibility** | Users report understanding their full BMAD methodology state from the dashboard | 3 months |
| **Ecosystem value** | BMAD Workflow Dashboard cited as reason to adopt Agent Orchestrator | 6 months |
| **Methodology adoption** | Increased usage of BMAD agents and workflows (users discover them via Agents panel) | 6 months |
| **Platform evolution** | Agent Orchestrator perceived as lifecycle companion, not just execution monitor | 12 months |

---

## MVP Scope

### Core Features (8 User Stories)

**Foundation (Stories 1-2) — Days 1-2:**

| # | Story | Description |
|---|---|---|
| 1 | **Workflow Data API** | `GET /api/workflow/[project]` — computes BMAD lifecycle state from files on disk. Single endpoint, single response shape, always returns 200 with nullable fields. Response includes: phase states, agent roster, AI Guide recommendation, artifact inventory, last activity. ~3-4KB response |
| 2 | **Workflow Page Shell** | `/workflow/[project]` route with layout, project context, SSE connection. React Server Component for data fetch, Client Components for SSE-driven updates. Includes `EmptyWorkflowState` for projects with no `_bmad/` directory |

**Components (Stories 3-7) — Days 3-5:**

| # | Story | Description | Primary Value |
|---|---|---|---|
| 3 | **Phase Progress Bar** | Visual 4-phase indicator (Analysis → Planning → Solutioning → Implementation). Three states per phase: ○ not-started, ● done, ★ active. Downstream inference: if later phase has artifacts, earlier phase = done. Semantic `<ol>` with `aria-current`. Labels + icons + color (never color alone) | Both personas |
| 4 | **Last Workflow Activity** | Most recent BMAD workflow artifact, timestamp, and phase. Derived from file `mtime` — no process monitoring. ~3 lines of logic. Bundled with Story 7 in same PR | Practitioner |
| 5 | **Available Agents Panel** | Lists BMAD agents with name, display name, role, and icon. Read from `_bmad/_config/agent-manifest.csv`. Renders own empty state if manifest not found | Explorer |
| 6 | **AI Guide Recommendations** | Deterministic engine: Tier 1 (missing phase artifacts) + Tier 2 (incomplete phases). Returns structured data `{tier, observation, implication, phase}`. Context voice: "[State observation]. [Implication]." ~15 lines of core logic. **Flex story** — can ship Tier 1 only if sprint gets squeezed | Practitioner |
| 7 | **Artifact Inventory** | Lists all generated BMAD documents from `_bmad-output/` with filename, phase, type, path, and modification time. Data already computed for phase bar — inventory is the detail view | Explorer |

**Capstone (Story 8) — Day 6:**

| # | Story | Description |
|---|---|---|
| 8 | **Navigation Integration** | Add "Workflow" tab to dashboard tab bar. **Sprint Board remains default landing page.** Default landing switch is a post-MVP decision after validating adoption. Route: `/workflow/[project]` |

### Delivery Plan

**PR grouping (5 PRs):**

| PR | Stories | Theme |
|---|---|---|
| 1 | 1 + 2 | Foundation: API + page shell + EmptyWorkflowState |
| 2 | 3 | Hero component: phase progress bar |
| 3 | 5 + 6 | Discovery: agents panel + AI Guide |
| 4 | 4 + 7 | File queries: last activity + artifact inventory |
| 5 | 8 | Capstone: navigation integration |

**Totals**: 5 new components + EmptyWorkflowState, 1 new page, 1 new API endpoint, 0 new dependencies, ~800-1000 lines of new code, ~6 working days, single sprint.

### Architecture Decisions

**Zero configuration**: Auto-detect `_bmad/` in project root. No changes to `agent-orchestrator.yaml`. Convention over configuration.

**Independent data path**: Workflow API and tracker-bmad are parallel, non-overlapping modules. No shared state, no shared types, no coupling. Future integration via client-side API join if needed.

**Code organization** (all in `packages/web/`):
```
src/
  app/workflow/[project]/page.tsx           # Page shell (Story 2)
  app/api/workflow/[project]/route.ts       # API route (Story 1)
  components/workflow/
    PhaseBar.tsx                             # Story 3
    LastActivity.tsx                         # Story 4
    AgentsPanel.tsx                          # Story 5
    AiGuide.tsx                             # Story 6
    ArtifactInventory.tsx                   # Story 7
    EmptyWorkflowState.tsx                  # Story 2 sub-component
  lib/workflow/
    compute-state.ts                        # Phase computation, artifact scanning
    recommendation-engine.ts                # AI Guide logic
    types.ts                                # Workflow-specific types
```

**Phase computation**: Presence-based with downstream inference. Three states (not-started/done/active). Artifact-to-phase mapping via filename patterns in a single constant. Unrecognized artifacts go to "other" bucket — visible in inventory, not counted toward phases.

**Progressive detection**: Each panel independently checks its data source. Partial BMAD setups show what's available. Full-page `EmptyWorkflowState` only when no `_bmad/` directory exists at all.

**SSE integration**: New `workflow-change` event on existing SSE channel. Payload: `{projectId, timestamp}` only — client refetches full state. 200ms debounce on chokidar. ~10 lines total (5 server, 5 client).

**API response contract**:
```typescript
interface WorkflowResponse {
  projectId: string;
  projectName: string;
  phases: { id: string; label: string; state: "not-started" | "done" | "active" }[];
  agents: { name: string; displayName: string; title: string; icon: string; role: string }[] | null;
  recommendation: { tier: 1 | 2; observation: string; implication: string; phase: string } | null;
  artifacts: { filename: string; phase: string; type: string; path: string; modifiedAt: string }[];
  lastActivity: { filename: string; phase: string; modifiedAt: string } | null;
}
```

### Non-Functional Requirements

1. **Error resilience**: All components implement Last-Known-Good state pattern. Malformed or mid-edit files never produce user-visible errors. 200ms debounce on file change events. API always returns 200.
2. **Accessibility**: Semantic HTML (`<nav>`, `<button>`, `<ol>`, `<section>`) with ARIA labels. Keyboard-navigable. Color-independent status indicators.
3. **SSE real-time updates**: Server-side chokidar → SSE broadcast in Story 1. Client-side EventSource → refetch in Story 2.

### Testing Strategy

| Story | Testing Level | Approach |
|---|---|---|
| 1 (API) | Integration test | Hit endpoint with various `_bmad/` states, verify response shape |
| 2 (Shell) | Render test | Page loads, EmptyWorkflowState renders for no-BMAD projects |
| 3 (Phase bar) | Unit test | Given phase states, renders correct ○ ● ★ indicators |
| 4+7 (Activity + Inventory) | Unit test | Given file list, renders correct items and timestamps |
| 5 (Agents) | Snapshot test | Renders agent list from manifest; renders empty state for null |
| 6 (AI Guide) | **Exhaustive unit tests** | Every state permutation — this is correctness-critical |
| 8 (Navigation) | Render test | Tab appears, routes correctly |
| Cross-cutting | Integration test | Use actual `_bmad/` from this repository as real-world test fixture |

### Out of Scope for MVP

| Feature | Rationale | Timeline |
|---|---|---|
| **Workflow editor / customization** | Phase B — bidirectional file writing, complex UI. Requires own product brief | Long-term exploration |
| **Drag-and-drop Kanban** | Requires new dependency (`@hello-pangea/dnd`). Not needed for read-only | Post-MVP |
| **AI Guide Tier 3-4** | Lower confidence. Ship after validating Tier 1-2 accuracy | Post-MVP |
| **Interactive workflow invocation** | Transforms dashboard from lens to control surface. Conflicts with read-only principle. Alternative: CLI command hints in AI Guide | Medium-term, with philosophy caveat |
| **CLI command hints in AI Guide** | "Run: `ao workflow create-architecture`" — closes action loop without breaking read-only | Near-term post-MVP |
| **localStorage usage counters** | Adoption tracking for persona hypothesis validation | Phase 2 |
| **Multi-project portfolio view** | Dropdown switching sufficient for MVP | Post-MVP |
| **Default landing page switch** | Workflow tab as default landing. Ship after validating adoption | Post-MVP decision |
| **i18n / localization** | BMAD terms are English-native. No demand signal | Only if warranted |
| **Stakeholder-specific UX** | Tooltips, onboarding modals add cognitive load for primary persona | Not planned |
| **Real-time collaboration** | Dashboard is a lens on local file state. Git handles multi-user sync | Not planned |
| **Percentage-based phase completion** | Requires fixed checklists or workflow parsing. Binary/ternary states are factual, not judgmental | Not planned |

### MVP Success Criteria

The MVP is successful when:

1. **Comprehension test passes**: 3/3 testers identify project phase and next step within 5 seconds
2. **Technical KPIs met**: Zero new dependencies, <50KB bundle, <100ms API, <500ms page load
3. **Error resilience verified**: All file states (empty, partial, complete, malformed) handled without crashes
4. **AI Guide correctness**: 100% Tier 1-2 accuracy in exhaustive unit tests
5. **Zero regression**: Sprint Board performance and functionality unchanged
6. **Self-evidence confirmed**: Usable without consulting documentation

**Go/no-go for post-MVP**: If success criteria met AND community engagement signals positive (feature requests, mentions), proceed with CLI command hints and Tier 3-4. If comprehension test fails, redesign UI before adding features.

### Risk Mitigation by Design

Three architectural properties that make this MVP inherently low-risk:

1. **Fully additive**: Zero coupling to existing features. Rollback = delete 1 page, 5 components, 1 API route. Single PR, ~30 minutes.
2. **Incremental navigation**: Tab added without changing default landing page. Behavior change deferred to post-MVP.
3. **Error-tolerant voice**: Context voice makes wrong recommendations feel like stale data, not bad advice. Low trust damage from edge-case inaccuracies.

### Key Assumptions

| # | Assumption | Risk if Wrong | Validation |
|---|---|---|---|
| 1 | Developers lose context after absence (10-15 min reconstruction) | Solving a phantom problem | Interview 3 BMAD users about context recovery |
| 2 | Developers will use browser dashboard, not just terminal | Zero adoption | Proxy: existing Sprint Board usage validates dashboard willingness |
| 3 | BMAD artifact and directory conventions are stable | Scanner breaks on updates | Check BMAD changelog; patterns in single constant, easy update |
| 4 | Three phase states (not-started/done/active) are sufficient | Users want granularity | Ship and listen; AI Guide fills intra-phase granularity gap |
| 5 | Zero new dependencies is achievable | Scope increase, principle violation | **Validated**: YAML, chokidar, Intl.RelativeTimeFormat all available |
| 6 | AI Guide adds value beyond the phase bar | Redundant feature | Complementary: phase bar = inter-phase, AI Guide = intra-phase |

### Future Vision

**Growth trajectory**:
```
MVP:         "Where am I?"              → Visibility
Near-term:   "What do I do?"            → Guidance (CLI hints, Tier 3-4)
Medium-term: "Show me everything"       → Full lifecycle awareness
Long-term:   "Let me shape the process" → Methodology platform (Phase B, exploratory)
```

**Near-term (post-MVP, 1-3 months):**
- CLI command hints in AI Guide ("Run: `ao workflow create-architecture`")
- AI Guide Tier 3-4 recommendations (retrospective reminders, health assessments)
- localStorage usage counters for adoption validation
- Default landing page switch (if adoption validates)

**Medium-term (3-6 months):**
- Interactive workflow invocation from dashboard (requires revisiting read-only principle)
- Workflow step-by-step progress within a phase
- Agent activity history
- Sprint Board integration (link stories to BMAD phase that produced them)
- Multi-project portfolio overview page
- Notification triggers from workflow state changes

**Long-term exploration (6-12+ months, Phase B):**
These capabilities represent a potential evolution from visibility tool to methodology platform. Each requires its own product brief, technical research, and architecture evaluation. Listed for directional context, not as committed roadmap.

- Interactive workflow editor — customize BMAD workflows from the dashboard
- Custom agent creation — define new agents with custom personas and skills
- Workflow templates — shareable workflow configurations for different project types
- Community-contributed workflow templates — ecosystem play enabling teams to share methodology variations
- Phase sequence modification — adapt methodology to team preferences

**Guiding principle**: Every post-MVP feature must pass the design constitution — zero cognitive load, lens not platform, stateless comprehension, inform don't instruct. Features that violate these principles are rejected regardless of demand.
