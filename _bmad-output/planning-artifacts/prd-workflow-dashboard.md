---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
workflowStatus: complete
completedAt: '2026-03-13'
inputDocuments:
  - product-brief-agent-orchestrator-2026-03-13.md
  - research/technical-bmad-workflow-engine-integration-research-2026-03-13.md
  - project-context.md
  - docs/product_docs/bmad-tracker-plugin.md
  - docs/product_docs/bmad-web-dashboard.md
  - docs/product_docs/bmad-cli-commands.md
workflowType: 'prd'
classification:
  projectType: Web App (dashboard feature)
  domain: Developer Tools / DevOps
  complexity: MEDIUM
  projectContext: additive-brownfield
---

# Product Requirements Document - BMAD Workflow Dashboard

**Author:** R2d2
**Date:** 2026-03-13

---

## Relationship to Product Brief

This PRD translates the product vision defined in `product-brief-agent-orchestrator-2026-03-13.md` into testable requirements. Architecture and solution decisions referenced here are documented in the brief's MVP Scope section and will be formalized in the architecture document. This PRD focuses exclusively on *what* the system must do, not *how* it does it.

---

## Document Metadata

**Workflow Status:** Complete (Steps 1-12 of 12)
**Project:** agent-orchestrator
**Feature:** BMAD Workflow Dashboard
**Type:** Feature PRD for additive brownfield enhancement

---

## Project Classification

| Dimension | Classification |
|---|---|
| **Project Type** | Web App (dashboard feature) |
| **Domain** | Developer Tools / DevOps |
| **Complexity** | MEDIUM (non-trivial engineering, well-constrained, zero-risk architecture) |
| **Context** | Additive brownfield (new files alongside existing system, zero modification to existing features except 3 minimal touchpoints) |

### Brownfield Touchpoints

| Existing File | Change | Risk |
|---|---|---|
| Navigation component (tab bar) | Add "Workflow" tab link | LOW |
| SSE event handler (server) | Add `workflow-change` event type | LOW |
| SSE event types (shared) | Add `WorkflowEvent` to type union | LOW |

All other deliverables are new files with zero modification to existing code.

---

## Executive Summary

The Agent Orchestrator dashboard provides real-time visibility into AI coding agent execution via the Sprint Board. However, the broader BMAD methodology lifecycle — Analysis, Planning, Solutioning, Implementation — remains invisible. Developers reconstruct project state from scattered files and CLI history, spending 10-15 minutes per session before productive work begins. The BMAD Workflow Dashboard eliminates this by surfacing methodology progress, artifact state, and deterministic next-step guidance in a single glanceable tab.

This is a read-only visibility layer over existing file-based state. It adds zero new dependencies, zero infrastructure, zero LLM costs. The feature is fully additive — zero coupling to existing Sprint Board functionality, rollback is a single file-deletion PR. All data derives from BMAD files on disk using the existing SSE infrastructure for real-time updates.

**Scope**: 8 user stories, 5 components, 1 page, 1 API endpoint. ~6 working days, single sprint. Three existing files modified with minimal additive changes (navigation, SSE handler, SSE types).

**Relationship to existing PRD**: This is a standalone feature PRD for the read-only visibility MVP (Phase A). It does not depend on or implement the bidirectional sync architecture described in `prd.md`. All decisions are forward-compatible with the broader integration vision.

### What Makes This Special

| Property | Implication |
|---|---|
| **Category of one** | No competing tool provides BMAD lifecycle visibility with AI-guided next steps |
| **Zero cognitive load** | Project state comprehensible in <5 seconds — all components visible on 1280x800 without scrolling |
| **Deterministic AI Guide** | Rule-based, file-existence-based recommendations. Zero LLM cost, zero latency, 100% reproducible |
| **Architectural invisibility** | Uses existing stack entirely — SSE, Next.js 15, Tailwind, chokidar. No new moving parts |
| **Error-tolerant by design** | LKG state pattern, 200ms debounce, context voice. Wrong recommendations feel like stale data, not bad advice |

### Design Constraints

Four principles govern all requirements in this PRD:

1. **Zero cognitive load** — All critical information visible without scrolling, clicking, or expanding
2. **Lens, not platform** — Dashboard shall NOT modify any files. No write operations to project directories
3. **Stateless comprehension** — No user session state, no personalization, no auth context. Same view for everyone
4. **Inform, don't instruct** — AI Guide output contains only observations and implications, never imperative verbs

### Anti-Requirements

What the system must never do:

- No write operations to `_bmad/` or `_bmad-output/`
- No imports from `tracker-bmad` plugin, no shared state with Sprint Board
- No new entries in `package.json` dependencies
- No new fields in `agent-orchestrator.yaml`
- No imperative verbs in AI Guide output

---

## Success Criteria

### User Success

| ID | Criterion | Acceptance Test |
|---|---|---|
| **US-01** | Time to comprehension under 5 seconds | GIVEN a Workflow tab showing a mid-lifecycle project (2 phases complete, 1 active, 1 not-started), WHEN 3 BMAD-familiar testers are asked "What phase is this project in?" and "What should happen next?", THEN all 3 answer both correctly within 5 seconds. Note: the second question specifically validates that the AI Guide's observation translates to actionable understanding, not just state awareness |
| **US-02** | Context recovery under 30 seconds | GIVEN a developer returning after multi-day absence, WHEN they open the Workflow tab, THEN they perform an observable productive action (navigate to a specific file, invoke a CLI command, or reference a specific artifact by name) within 30 seconds |
| **US-03** | Self-evidence without documentation | GIVEN a developer familiar with BMAD methodology but unfamiliar with the Workflow Dashboard, WHEN they first encounter the tab, THEN they can identify project phase, read AI Guide output, and browse artifacts without consulting any documentation |
| **US-04** | First-visit clarity | GIVEN a project with BMAD artifacts, WHEN a developer who has read a one-paragraph description of BMAD opens the Workflow tab for the first time, THEN they can identify what each panel shows and what the phase states mean — no onboarding modal, no tooltip dependency, no guided tour |
| **US-05** | Visual hierarchy | GIVEN the Workflow tab rendered at 1280×800, WHEN a user first views the page, THEN the Phase Bar (top) and AI Guide (prominent position) are visually dominant — the user's eye lands on these before secondary panels (agents, artifacts, activity). All 5 panels visible without scrolling |

### Business Success

| ID | Criterion | Target | Timeframe |
|---|---|---|---|
| **BS-01** | Lifecycle visibility adoption | Users report understanding full BMAD methodology state from the dashboard alone | 3 months post-launch |
| **BS-02** | Ecosystem value signal | BMAD Workflow Dashboard cited as reason to adopt or recommend Agent Orchestrator | 6 months |
| **BS-03** | Methodology discovery | Increased usage of BMAD agents and workflows, attributed to agents panel and AI Guide visibility | 6 months |
| **BS-04** | Platform perception shift | Agent Orchestrator perceived as lifecycle companion, not just execution monitor | 12 months |
| **BS-05** | Zero support burden | No "how do I use the Workflow tab?" issues filed — self-explanatory UI or failure. Partially testable during sprint: any question testers ask during the Human Gate session is a support burden signal | 3 months |

Note: BS-01 through BS-05 are directional business context, not MVP engineering gates. They inform post-MVP prioritization decisions but do not block the MVP ship.

### Technical Success

| ID | Criterion | Target | Verification |
|---|---|---|---|
| **TS-01** | Zero new dependencies | 0 new entries in `package.json` | `package.json` diff — CI-verifiable |
| **TS-02** | Bundle size budget | <50KB total for all new Workflow components | Next.js build output analysis |
| **TS-03** | API response latency | <100ms for `GET /api/workflow/[project]` (expected: <20ms for typical projects — investigate if approaching threshold) | Automated performance test against local project |
| **TS-04** | Page load performance | <500ms initial render of Workflow tab | Lighthouse or manual measurement |
| **TS-05** | SSE update latency | End-to-end file change to UI update within 500ms (200ms chokidar debounce + <50ms SSE dispatch + render). SSE event dispatched within 50ms of debounce timer firing | Integration test: chokidar debounce fires → SSE event timestamp → client render timestamp |
| **TS-06** | Sprint Board regression | Zero performance or functionality degradation | Existing test suite passes + before/after comparison |
| **TS-07** | Error resilience | Zero user-visible crashes across 6 file states (empty, partial, complete, malformed, mid-write, permission-denied) × 5 panels = 30 scenarios | QA test matrix covering all 30 combinations |
| **TS-08** | AI Guide correctness | 100% accuracy for Tier 1-2 recommendations across all 81 phase-state permutations (3 states ^ 4 phases) | Unit test suite enumerating all 81 combinations with expected tier + observation + implication per permutation |
| **TS-09** | Test coverage | >80% recommendation engine, >70% components | vitest coverage report |
| **TS-10** | API surface area | Exactly 1 new route (`/api/workflow/[project]`). SSE modification is a new event type on existing channel, not a new route | Code review gate — additional routes indicate data model pollution |
| **TS-11** | Component isolation | Each Workflow panel renderable and testable independently with mock data | No implicit dependency on sibling components or shared state beyond the API response shape |

### Measurable Outcomes

**MVP Go/No-Go Gate** — split into automated and human verification:

**Automated Gate** (CI — every PR must pass):

1. **TS-01** through **TS-11** all pass
2. **TS-06** specifically verified (Sprint Board zero regression — automatic no-ship if existing product broken)
3. **TS-07** specifically verified (error resilience across all 30 file-state scenarios)
4. **TS-08** specifically verified (AI Guide deterministic correctness across all 81 permutations)

**Human Gate** (Day 6 — formal test session with 3 BMAD-familiar testers):

5. **US-01** passes (comprehension test — 3/3 correct within 5 seconds)
6. **US-03** confirmed (no documentation dependency for basic usage)
7. **Protocol**: Record all questions testers ask during the session. Each question is a UX debt item — label/layout issues fixed before ship, conceptual gaps logged as post-MVP UX research items

**Recommendation**: Run a lightweight comprehension check on Day 4 with 1-2 testers using the Phase Bar PR alone. Catch layout disasters early. The formal 3-tester protocol runs after Story 8 merges.

**Post-MVP Success Signal**: If go/no-go gate passes AND community engagement signals positive (feature requests *for* Workflow tab outnumber bug reports *about* it), proceed with Growth features. If bug reports outnumber feature requests 2:1 in the first month, pause Growth work and resolve quality debt first. If US-01 fails, redesign UI before adding features.

**Post-MVP Trackable** (requires optional localStorage counters — Growth phase):

| ID | Metric | Target | Timeframe |
|---|---|---|---|
| **PM-01** | Tab visit rate | >50% of dashboard sessions include Workflow tab | 3 months |
| **PM-02** | Return visits | Users revisit Workflow tab within 7 days | 3 months |
| **PM-03** | Panel interaction distribution | Data on which panels users engage with most | Ongoing — validates persona hypotheses |

---

## Product Scope

### MVP — Minimum Viable Product

**Essential for proving the concept — "Where am I?"**

| Capability | Stories | Rationale |
|---|---|---|
| Workflow Data API | 1 | Single endpoint, single response shape — all data computation lives here |
| Workflow Page Shell + EmptyWorkflowState | 2 | Route, layout, SSE connection, graceful empty state |
| Phase Progress Bar | 3 | Hero component — the single most valuable visual for both personas |
| Last Workflow Activity | 4 | Temporal context — "when did something last happen?" |
| Available Agents Panel | 5 | Discovery — surfaces what's available and when it's relevant |
| AI Guide (Tier 1-2) | 6 | Deterministic next-step observations. **Flex story**: can ship Tier 1 only if sprint gets squeezed |
| Artifact Inventory | 7 | Detail view of all generated BMAD documents |
| Navigation Integration | 8 | Tab in existing nav bar. Sprint Board remains default landing |

**MVP boundary test**: Can a developer returning after multi-day absence understand project state and start working in under 30 seconds? If yes, MVP is sufficient.

### Growth Features (Post-MVP)

**Makes it competitive — "What do I do?"**

| Priority | Feature | Value | Dependency |
|---|---|---|---|
| **P1** | CLI command hints in AI Guide | Closes the action loop: "Run: `ao workflow create-architecture`" | Tier 1-2 validated |
| **P1** | localStorage usage counters | Validates adoption hypotheses (PM-01 through PM-03) — needed to inform all other Growth decisions | MVP shipped |
| **P2** | AI Guide Tier 3-4 | Retrospective reminders, health assessments — lower confidence, higher value | Tier 1-2 accuracy confirmed |
| **P2** | Default landing page switch | Workflow tab as default if adoption validates | PM-01 >50% confirmed |
| **P3** | Multi-project portfolio overview | Dashboard view across all projects | Adoption validated |
| **P3** | Sprint Board cross-link | Link stories to BMAD phase that produced them | Both features stable |

### Vision (Future)

**The dream — "Let me shape the process"**

| Feature | Category | Caveat |
|---|---|---|
| Interactive workflow invocation | Control surface | Transforms lens to platform — requires revisiting read-only principle |
| Workflow step-by-step progress | Granularity | Requires workflow parsing, not just artifact detection |
| Custom agent creation in UI | Methodology platform | Requires own product brief and architecture |
| Workflow templates (shareable) | Ecosystem play | Community-contributed methodology variations |
| Phase sequence modification | Customization | Adapt methodology to team preferences |

**Vision gate**: Every feature must pass the design constitution — zero cognitive load, lens not platform, stateless comprehension, inform don't instruct. Features violating these principles are rejected regardless of demand, or the principles themselves are formally revised through a new product brief.

---

## User Journeys

### Journey 1: Context Recovery After Absence (BMAD Practitioner — Success Path)

**Persona**: Dana, a full-stack developer managing two BMAD projects through Agent Orchestrator. She's been deep in Project Alpha's implementation phase for three weeks, but today she needs to context-switch to Project Beta — a planning-stage project she hasn't touched in 12 days.

**Opening Scene**: Dana opens her laptop Monday morning. She knows Project Beta needs attention — the architecture doc was supposed to come next — but she can't remember exactly where she left off. Did she finish the PRD? Was there a research doc? She vaguely remembers running the analyst agent but isn't sure what it produced.

Her old workflow: open terminal, `ls _bmad-output/planning-artifacts/`, scan filenames and timestamps, try to reconstruct the sequence. Check `_bmad/` for config state. Maybe `git log` to see what changed. Ten minutes later, she has a mental model. Maybe.

**Rising Action**: Today, Dana navigates to the Agent Orchestrator dashboard. She sees the Sprint Board — agents idle, no active sessions for Project Beta. She clicks the **Workflow** tab and selects Project Beta from the project dropdown.

The page loads in under a second. The **Phase Bar** shows: Analysis ● | Planning ★ | Solutioning ○ | Implementation ○. One phase done, one active, two untouched. Instantly she knows: planning is in progress.

The **AI Guide** reads: "Research report and product brief present. PRD not found." Dana nods — she remembers now. The research and brief are done. She was about to start the PRD.

**Climax**: Dana glances at the **Artifact Inventory** — three files listed under Analysis (research report, product brief, project context), none under Planning. The **Last Activity** shows: "product-brief-agent-orchestrator.md — Analysis — 12 days ago." She scans the **Agents Panel** and sees the PM agent listed with role "Product Manager specializing in collaborative PRD creation."

Total elapsed time: 8 seconds. She knows exactly where she is, what's missing, and which agent to invoke.

**Resolution**: Dana switches to terminal, runs `ao workflow create-prd`, and starts the PRD workflow. The context-recovery that used to take 10-15 minutes took less than 30 seconds. She didn't read any documentation. She didn't ask anyone. The dashboard answered every question she had before she formulated them.

**Requirements revealed**: Phase computation from artifacts (TS-08), AI Guide observation accuracy (TS-08), artifact inventory with timestamps (Story 7), agents panel with roles (Story 5), page load <500ms (TS-04), comprehension <5 seconds (US-01).

---

### Journey 2: First Encounter — Empty State (BMAD Practitioner — Edge Case)

**Persona**: Marcus, a backend developer who's been using Agent Orchestrator for three months — exclusively for the Sprint Board and agent spawning. He's never used BMAD methodology. Today, he upgrades Agent Orchestrator and notices a new "Workflow" tab in the navigation.

**Opening Scene**: Marcus clicks the Workflow tab out of curiosity. He selects his project — a straightforward API service tracked via GitHub Issues.

**Rising Action**: The page loads and displays the **EmptyWorkflowState** component. No phase bar, no AI Guide, no artifacts. Instead, a clean, non-judgmental invitation: a brief explanation that this tab shows BMAD methodology progress, with a pointer to what BMAD is and how to get started.

Marcus reads it in 3 seconds, thinks "not for me right now," and clicks back to the Sprint Board.

**Climax**: The critical moment is what *doesn't* happen. No error. No broken layout. No confusing empty panels with "no data" labels. No guilt-inducing "you should try BMAD!" messaging. The empty state communicates clearly: this feature exists, here's what it's for, here's how to start if you want to. No pressure.

**Resolution**: Marcus goes back to the Sprint Board and continues his work. The Workflow tab cost him 5 seconds of curiosity and left a positive impression. Three weeks later, when he starts a greenfield project and wants more structure, he remembers the tab and explores BMAD methodology.

**Requirements revealed**: EmptyWorkflowState component (Story 2), graceful detection of missing `_bmad/` directory, non-judgmental invitation copy, zero interference with Sprint Board workflow, navigation integration that doesn't change default landing (Story 8).

---

### Journey 3: Onboarding to an Unfamiliar Project (Project Explorer)

**Persona**: Kai, a developer who just joined a team that's been running a BMAD project for two months. Their tech lead says "check the Agent Orchestrator dashboard to get up to speed on where we are." Kai has heard of BMAD but hasn't used it.

**Opening Scene**: Kai opens the dashboard URL shared in Slack. They see the Sprint Board with several active agent sessions and a bunch of PR links. Useful, but it tells them *what's happening now*, not *how we got here* or *what comes next*.

**Rising Action**: Kai clicks the **Workflow** tab. The Phase Bar shows: Analysis ● | Planning ● | Solutioning ● | Implementation ★. Three phases complete, implementation active. Immediately Kai understands: this project is in the build phase, with all planning done.

The **AI Guide** reads: "All solutioning artifacts present. Implementation phase active." Kai doesn't know exactly what "solutioning artifacts" means, but the message is clear: planning is done, building is happening.

**Climax**: Kai scrolls to — actually, they don't scroll. Everything is visible. The **Artifact Inventory** lists 8 documents: a research report, product brief, PRD, architecture spec, three epic files, and a sprint plan. Each shows its phase, type, and modification date. Kai clicks through to read the architecture spec and PRD — now they understand the project's technical decisions and requirements without asking the tech lead 20 questions.

The **Agents Panel** shows 9 agents with descriptions. Kai sees "Dev Agent — Senior Software Engineer" and "QA Agent — QA Engineer" and understands what's available for implementation work.

**Resolution**: In under 2 minutes, Kai has a complete mental model: what phases the project went through, what artifacts were produced, what's being built now, and what tools are available. Their first standup contribution: "I reviewed the architecture spec from the Workflow Dashboard — I have a question about the caching strategy." The tech lead is impressed.

**Requirements revealed**: Artifact inventory as project history (Story 7), phase bar as progress summary (Story 3), self-descriptive panel labels for BMAD-unfamiliar users (US-04), agents panel for tool discovery (Story 5), all panels visible without scrolling (US-05).

---

### Journey 4: Malformed State Recovery (BMAD Practitioner — Error Path)

**Persona**: Dana again (from Journey 1). This time she's mid-workflow — she ran the architect agent to generate an architecture spec, but the agent crashed partway through. The architecture file exists but contains truncated YAML frontmatter and half-written content.

**Opening Scene**: Dana opens the Workflow tab. She expects to see Solutioning as the active phase since she started architecture work.

**Rising Action**: The Phase Bar shows: Analysis ● | Planning ● | Solutioning ★ | Implementation ○. The malformed architecture file was detected as an artifact in the Solutioning phase — its existence is sufficient to mark the phase active, regardless of content validity. The AI Guide reads: "Architecture spec present. No epic or story files found."

**Climax**: The critical behavior is the **Last-Known-Good pattern** in action. The API parsed the architecture file, found invalid frontmatter, and silently fell back to detecting it by filename pattern and directory location. No error toast. No warning banner. No "file corrupted" message. The dashboard shows slightly stale but directionally correct information — solutioning has started, implementation hasn't.

Dana notices the architecture spec in the Artifact Inventory, sees its recent timestamp, and opens it in her editor. She spots the truncation, re-runs the architect agent, and the file is regenerated correctly. The next SSE event triggers a refetch, and the dashboard updates within 500ms.

**Resolution**: A file corruption that could have produced a confusing error state was handled invisibly. Dana's trust in the dashboard is maintained because the worst case — showing a malformed file as "present" — is directionally correct. The context voice (Design Constraint #4: observations and implications, no imperatives) made a potentially wrong observation feel like slightly stale information, not a system failure.

**Requirements revealed**: LKG state pattern (TS-07), filename-based artifact detection as fallback, 200ms debounce preventing mid-write flicker (TS-05), error resilience across malformed file states, context voice reducing trust damage from edge cases.

---

### Journey 5: Shared URL for Quick Status (Incidental Beneficiary)

**Persona**: Priya, an engineering manager who oversees three teams. One team is using BMAD methodology for a new feature. Priya doesn't use BMAD herself and doesn't touch the CLI, but she needs a quick read on project progress for a stakeholder meeting in 15 minutes.

**Opening Scene**: Priya receives a Slack message from the tech lead: "Dashboard is at localhost:3000 — check the Workflow tab for Project Gamma." Priya opens the URL in her browser.

**Rising Action**: Priya sees the Workflow tab. The Phase Bar shows: Analysis ● | Planning ● | Solutioning ★ | Implementation ○. She doesn't know what "Solutioning" means in BMAD terms, but the visual pattern is clear: 2 done, 1 in progress, 1 not started. The project is roughly 60% through its planning lifecycle.

The AI Guide reads: "PRD and architecture spec present. No epic or story files found." Priya translates: requirements and architecture are done, but the work hasn't been broken into implementable chunks yet.

**Climax**: Priya doesn't interact further. She doesn't need to. In 10 seconds she has what she needs for the meeting: "The team has finished analysis and planning, they're in the architecture phase, and implementation hasn't started yet. They need to break the work into stories next."

**Resolution**: Priya reports project status accurately in her stakeholder meeting without having asked the tech lead a single follow-up question. The dashboard served a user it wasn't designed for, because the design principles (zero cognitive load, stateless comprehension) made it universally readable.

**Requirements revealed**: Phase bar visual clarity for non-experts (US-04, US-05), AI Guide context voice readable without BMAD expertise, stateless comprehension — no login, no session, no personalization (Design Constraint #3), shareable URL with no auth barrier.

---

### Journey Requirements Summary

| Capability | Journeys | Requirement IDs |
|---|---|---|
| Phase computation from artifacts | 1, 3, 4, 5 | TS-08, Story 3 |
| AI Guide accuracy and usefulness | 1, 3, 4, 5 | TS-08, US-01 |
| Artifact inventory with metadata | 1, 3, 4 | Story 7 |
| Agents panel with roles | 1, 3 | Story 5 |
| EmptyWorkflowState | 2 | Story 2 |
| LKG error resilience | 4 | TS-07 |
| SSE real-time updates | 4 | TS-05 |
| Visual hierarchy and glanceability | 1, 3, 5 | US-05, TS-04 |
| Self-descriptive for BMAD-unfamiliar users | 2, 3, 5 | US-04 |
| Navigation integration (non-disruptive) | 2 | Story 8 |
| Page load performance | 1, 3, 5 | TS-04 |
| Stateless, shareable, no-auth access | 5 | Design Constraint #3 |

**Coverage assessment**: 5 journeys cover the primary persona's success path and two edge cases (empty state, malformed files), the secondary persona (project explorer), and the incidental beneficiary (non-technical stakeholder). No admin/ops/API-consumer journeys because this is a read-only visibility tab with no configuration, no user management, and no programmatic API consumers beyond the internal frontend.

---

## Web App Specific Requirements

### Rendering Architecture

Next.js 15 App Router with hybrid rendering:
- **Server Components**: Initial data fetch for `/workflow/[project]` page — API call resolved server-side, HTML streamed to client
- **Client Components**: SSE connection, real-time state updates, interactive panels
- **No client-side routing for Workflow tab**: Single page with project parameter, no nested navigation

### Browser Support

| Browser | Minimum Version | Rationale |
|---|---|---|
| Chrome / Edge | Last 2 major versions | Primary development browser |
| Firefox | Last 2 major versions | Secondary development browser |
| Safari | Last 2 major versions | macOS developer audience |

**Not supported**: IE11, pre-Chromium Edge, mobile browsers. This is a localhost development dashboard — users control their browser. No polyfills for legacy APIs (EventSource, CSS Grid, CSS Custom Properties are all baseline).

### Responsive Design

**Target viewport**: 1280×800 minimum (US-05). All 5 panels visible without scrolling at this resolution.

**Responsive stance**: Desktop-only. No mobile layout, no tablet breakpoints. Developer dashboards are used on development machines. Adding responsive breakpoints would increase bundle size and complexity for zero audience benefit.

**Large screen behavior**: Panels expand naturally with CSS Grid. No max-width constraint — larger screens get more breathing room, not more content.

### Performance Targets

Already formalized as technical success criteria:

| Target | Criterion | Reference |
|---|---|---|
| API response | <100ms (expected <20ms) | TS-03 |
| Page load | <500ms initial render | TS-04 |
| SSE latency | <500ms end-to-end | TS-05 |
| Bundle size | <50KB new components | TS-02 |
| Dependencies | Zero new | TS-01 |

### SEO Strategy

**Not applicable.** This is a localhost development dashboard. No public URLs, no search engine indexing, no meta tags, no sitemap. The page should include `<meta name="robots" content="noindex">` as a defensive measure in case the dashboard is accidentally exposed.

### Accessibility Level

Target: **WCAG 2.1 AA** for all new Workflow components. See **Non-Functional Requirements > Accessibility** (NFR-A1 through NFR-A6) for the formal requirements. Key implementation notes:

- **Reduced motion**: SSE-triggered updates are data replacements, not animations. No `prefers-reduced-motion` concern for MVP
- **Phase state indicators**: ○ ● ★ symbols carry meaning without color — the primary accessibility-sensitive UI element

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach**: Problem-solving MVP — deliver the smallest feature set that eliminates the context-recovery pain point (10-15 minutes → <30 seconds).

This is NOT an experience MVP (we're not testing whether dashboards are pleasant), a platform MVP (we're not building extensibility), or a revenue MVP (OSS, no monetization). The hypothesis is simple: **developers lose context after absence, and a glanceable lifecycle dashboard eliminates that cost.**

**What we are NOT testing with this MVP:**

1. **NOT testing BMAD methodology adoption.** If people don't use BMAD, the Workflow tab is irrelevant. That's a separate question — the dashboard assumes BMAD usage, it doesn't drive it.
2. **NOT testing dashboard vs. CLI preference.** Some developers will always prefer terminal. The dashboard is for developers who also use the Sprint Board — a validated behavior.
3. **NOT testing multi-project workflow.** MVP uses project dropdown switching. Portfolio view is a Growth feature. MVP validates single-project comprehension.

**Validation method**: The MVP boundary test — "Can a developer returning after multi-day absence understand project state and start working in under 30 seconds?" — is the single question the MVP must answer affirmatively.

**Resource Requirements**: Solo developer, 6 working days, single sprint. No design resources needed (Tailwind utility classes, no custom design system). No backend infrastructure changes. PR 1 (API + compute-state + exhaustive tests) is the heaviest unit at ~1.5-2 days (~30% of sprint). Remaining PRs are 0.25-1 day each. Cold-start overhead: add 0.5 day if the developer is unfamiliar with the codebase (types.ts, SSE infrastructure, Sprint Board patterns).

### MVP Feature Set (Phase 1)

All 5 user journeys are fully supported at the 6-day tier. See Scope Ladder below for degradation at compressed tiers.

**Must-Have Analysis:**

| Capability | Without this, does the product fail? | Can be manual initially? | MVP? |
|---|---|---|---|
| Phase progress bar | Yes — core value proposition | No | **Must-have** |
| AI Guide (Tier 1-2) | Partially — phase bar alone gives 70% of value | Could be removed; phase bar carries the load | **Must-have** (primary flex: Tier 2 deferred if squeezed) |
| Artifact inventory | No — but Explorer persona loses primary value | Could browse `_bmad-output/` manually | **Must-have** |
| Agents panel | No — decorative for Practitioner, high for Explorer | Could check manifest CSV manually | **Must-have** (secondary flex: defer if squeezed past Day 4) |
| Last activity | No — nice temporal context | Check file timestamps manually | **Must-have** (trivial: ~3 lines of logic) |
| EmptyWorkflowState | No — but broken empty state damages trust | Could show blank page | **Must-have** (small component, big impression) |
| Navigation tab | Yes — discovery mechanism | Could navigate by URL | **Must-have** |
| SSE real-time updates | No — could manual refresh | User refreshes page | **Must-have** (trivial: ~10 lines total) |

**Operational constraints:**

1. **API contract freeze**: The `WorkflowResponse` interface must be frozen after PR 1 merges. PR 1's review checklist includes "API contract reviewed and accepted by at least one reviewer." After merge, any PR that modifies `WorkflowResponse` requires a comment explaining why the freeze is being broken.
2. **API completeness**: The API computes all fields (phases, recommendation, artifacts, agents, lastActivity) regardless of which UI components are deployed. The UI degrades gracefully across scope tiers — the API does not. This preserves the contract freeze and means the raw API response is always a complete view of project state, even when UI panels are still being built.
3. **Front-load risk**: Day 1 includes exhaustive `compute-state.ts` tests alongside the API route. Phase computation is the riskiest code (81 permutations, downstream inference rules). Discovering edge cases on Day 5 could force contract changes against the freeze. Test it first.

### Scope Ladder (Graceful Degradation Plan)

If the sprint compresses, ship in this priority order:

| Days Available | What Ships | PRs | Value Delivered |
|---|---|---|---|
| **6 days** (full sprint) | Everything including Tier 2 | PRs 1-5 | Full MVP — all journeys, all panels |
| **5 days** | Defer AI Guide Tier 2, ship Tier 1 only | PRs 1-5 (PR 3 reduced) | Core value intact — "missing phase artifacts" recommendations still work |
| **4 days** | Defer PR 4 (last activity + artifact inventory) | PRs 1-3, 5 | Phase bar + AI Guide + agents panel. **Note**: Explorer persona partially impacted — AI Guide references artifacts user can't browse. Primary persona (Practitioner) fully served |
| **3 days** | Ship only PRs 1-2 (API + page shell + phase bar) | PRs 1-2 | **Emergency tier, no buffer.** PR 1 alone is ~1.5-2 days. Phase bar validates the hypothesis. Phase bar must be styled as intentionally standalone — not a single component surrounded by empty space. Centered layout with visual completeness |

**Note**: PRs 3-5 are order-independent after PR 2 merges. The scope ladder shows *priority* order, not a dependency chain.

**Minimum-viable Human Gate per scope tier:**

| Tier | Human Gate Protocol |
|---|---|
| 6 days (full) | Full US-01 + US-03 protocol with 3 testers. Record all questions |
| 5 days (no Tier 2) | Same protocol — Tier 1 AI Guide still answers "what should happen next?" |
| 4 days (no inventory) | US-01 with modified protocol — testers answer from phase bar + AI Guide without artifact drill-down. Comprehension test still valid |
| 3 days (phase bar only) | Lightweight validation — 1-2 testers, "What phase is this project in?" only. Skip "what should happen next?" since AI Guide isn't rendered |

### Post-MVP Roadmap

See **Product Scope > Growth Features** for the prioritized P1/P2/P3 post-MVP roadmap and **Product Scope > Vision** for long-term exploration items.

### Scope-Specific Risks

Risks specifically related to scope compression and MVP boundary decisions:

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| PR 1 takes longer than 2 days | Medium | High — cascading delay to all other PRs | Front-load compute-state tests. If Day 2 ends without PR 1 merged, trigger 4-day scope tier |
| API contract needs changes after freeze | Medium | High — all component PRs need updating | Exhaustive tests on Day 1 catch edge cases before freeze. Post-freeze changes require explicit justification |
| 4-day tier ships without artifact inventory | Low | Medium — Explorer journey degraded | AI Guide still names artifacts; users can browse `_bmad-output/` manually. Inventory PR ships as fast-follow |
| 3-day tier produces sparse UI | Low | Medium — single component looks broken | Phase bar styled as intentional standalone with centered layout. EmptyWorkflowState precedent shows how to make sparse feel complete |
| Human Gate fails at Day 6 | Low | High — redesign needed, no buffer | Day 4 lightweight check with 1-2 testers catches layout disasters early. Leave Day 6 for formal protocol only |
| Solo developer blocked mid-sprint | Low | Medium — handoff cost | PRs 3-5 are independent and context-light. PR 1 requires most context — complete it first to de-risk handoff |

---

## Functional Requirements

### Lifecycle Visibility

- **FR1**: User can view the current BMAD methodology phase state for a project (Analysis, Planning, Solutioning, Implementation) with each phase showing one of three states: not-started, done, or active
- **FR2**: System can compute phase states from BMAD artifacts on disk using presence-based detection with downstream inference (if a later phase has artifacts, earlier phases are inferred as done)
- **FR3**: User can identify the active phase at a glance through distinct visual indicators for each state (not-started, done, active) that do not rely on color alone
- **FR4**: User can view phase progression as an ordered sequence showing the relationship between phases

### AI-Guided Recommendations

- **FR5**: System can generate deterministic recommendations based on artifact state and phase progression, using a rule-based engine with zero LLM dependency
- **FR6**: User can view a contextual recommendation consisting of a state observation and an implication, presented in context voice (factual, no imperative verbs)
- **FR7**: System can produce Tier 1 recommendations (missing phase artifacts) and Tier 2 recommendations (incomplete phases) with structured output (tier, observation, implication, phase)
- **FR8**: System can return null recommendation when no actionable observation applies (all phases complete or no BMAD artifacts present)

### Artifact Management

- **FR9**: User can view an inventory of all generated BMAD documents with filename, associated phase, document type, file path, and modification timestamp
- **FR10**: System can scan `_bmad-output/` directory to discover artifacts and classify them by phase using filename pattern matching
- **FR11**: System can handle unrecognized artifacts by placing them in an uncategorized bucket visible in the inventory but not counted toward phase completion
- **FR12**: User can view the most recent BMAD workflow activity showing filename, phase, and relative timestamp

### Agent Discovery

- **FR13**: User can view a list of available BMAD agents with display name, title, icon, and role description
- **FR14**: System can read agent information from the BMAD agent manifest file (`_bmad/_config/agent-manifest.csv`)
- **FR15**: System can display an appropriate empty state when the agent manifest file is not found

### Real-Time Updates

- **FR16**: System can detect file changes in BMAD-related directories and notify the dashboard within 500ms end-to-end
- **FR17**: User can see the dashboard update automatically when BMAD files are created, modified, or deleted without manual page refresh
- **FR18**: System can debounce rapid file changes to prevent UI flicker during active file editing

### Navigation & Page Structure

- **FR19**: User can navigate to the Workflow tab from the existing dashboard navigation bar
- **FR20**: User can select a project to view its BMAD workflow state
- **FR21**: User can view all workflow panels (phase bar, AI Guide, agents, artifacts, last activity) simultaneously without scrolling at 1280×800 viewport
- **FR22**: User can see an informative empty state when viewing a project with no BMAD configuration (`_bmad/` directory absent), explaining what the Workflow tab offers and how to get started
- **FR23**: System can detect whether a project has BMAD configuration and render the appropriate view (full dashboard or empty state)

### Error Resilience

- **FR24**: System can maintain a last-known-good state for each data source, displaying previous valid data when current data is malformed or unreadable
- **FR25**: System can detect and handle malformed files (truncated YAML, invalid frontmatter, partial content) without producing user-visible errors
- **FR26**: System can handle inaccessible files (permission denied, mid-write) by retaining previous state silently
- **FR27**: System can operate with partial BMAD configurations — each panel independently checks its data source and renders what's available

### Data Integrity Constraints

- **FR28**: System shall NOT write to any file in `_bmad/` or `_bmad-output/` directories (read-only lens)
- **FR29**: System shall NOT import from or share state with the tracker-bmad plugin or Sprint Board components
- **FR30**: System shall NOT require changes to `agent-orchestrator.yaml` configuration — auto-detect BMAD presence from file system conventions
- **FR31**: System shall return a consistent API response shape regardless of BMAD state (nullable fields for absent data, never error responses for expected states)

---

## Non-Functional Requirements

### Performance

| ID | Requirement | Target | Rationale |
|---|---|---|---|
| **NFR-P1** | API response time | <100ms for `GET /api/workflow/[project]` (expected <20ms) | Phase computation + artifact scan must feel instant. Investigate if approaching 50ms — indicates algorithmic issue |
| **NFR-P2** | Page initial render | <500ms from navigation to fully rendered Workflow tab | Users must see meaningful content before cognitive engagement begins |
| **NFR-P3** | SSE end-to-end latency | <500ms from file change on disk to UI update in browser | Real-time feel without animation — data replacement within one visual "beat" |
| **NFR-P4** | SSE dispatch latency | <50ms from debounce timer firing to SSE event sent | Transport layer must not add perceptible delay on top of debounce |
| **NFR-P5** | Bundle size | <50KB total for all new Workflow components | Workflow tab must not noticeably increase dashboard load time |
| **NFR-P6** | Zero new dependencies | 0 new entries in `package.json` | Architectural constraint — eliminates supply chain risk and bundle bloat |
| **NFR-P7** | Sprint Board performance | Zero degradation in existing Sprint Board response times and render performance | New feature must not impose cost on existing features |

### Reliability

| ID | Requirement | Target | Rationale |
|---|---|---|---|
| **NFR-R1** | Error resilience coverage | Zero user-visible errors across 6 file states × 5 panels = 30 scenarios | LKG pattern must handle every realistic file state silently |
| **NFR-R2** | API stability | API always returns HTTP 200 with well-formed JSON for any BMAD state | Client code must never handle error responses for expected states (empty, partial, complete, malformed) |
| **NFR-R3** | File change debounce | 200ms debounce on file system events | Prevents UI flicker during rapid saves, agent-generated file bursts, and IDE auto-save |
| **NFR-R4** | Graceful degradation | Each panel renders independently — failure in one data source does not affect other panels | Partial BMAD setups show what's available, not what's missing |
| **NFR-R5** | SSE reconnection | Client automatically reconnects SSE on connection drop with no user action required | Network interruptions should be invisible to the user |

### Accessibility

| ID | Requirement | Target | Rationale |
|---|---|---|---|
| **NFR-A1** | WCAG compliance level | WCAG 2.1 AA for all new Workflow components | Developer tools should not exclude developers with disabilities |
| **NFR-A2** | Semantic markup | All panels use semantic HTML elements (`<nav>`, `<ol>`, `<section>`, `<button>`) — no div-soup | Enables screen reader navigation and browser accessibility features |
| **NFR-A3** | Color independence | All status indicators use labels + icons + color — never color alone | Phase states (○ ● ★) must be distinguishable without color perception |
| **NFR-A4** | Keyboard navigation | All interactive elements reachable and operable via keyboard. No keyboard traps | Full functionality without mouse requirement |
| **NFR-A5** | Screen reader support | ARIA labels on all status indicators with descriptive state information | Example: "Project phase: Solutioning, active" — not just "phase 3" |
| **NFR-A6** | Focus visibility | Visible focus indicators on all interactive elements | Browser default or Tailwind `ring-*` — must be perceptible on both light and dark backgrounds |

### Maintainability

| ID | Requirement | Target | Rationale |
|---|---|---|---|
| **NFR-M1** | Component isolation | Each Workflow panel renderable and testable independently with mock data | OSS contributors can modify one panel without understanding or touching others |
| **NFR-M2** | Artifact mapping updatability | Artifact-to-phase mapping defined as a single constant, updatable without logic changes | BMAD convention changes require a constant update, not a code refactor |
| **NFR-M3** | API contract stability | `WorkflowResponse` interface documented and versioned — changes are breaking changes | Downstream consumers (UI components, potential third-party tools) depend on stable shape |
| **NFR-M4** | Code isolation from Sprint Board | Zero imports from tracker-bmad, zero shared state, zero shared components | Workflow tab can be deleted in a single PR without affecting any existing feature |

### Testability

| ID | Requirement | Target | Rationale |
|---|---|---|---|
| **NFR-T1** | Recommendation engine coverage | >80% test coverage for `recommendation-engine.ts` | Deterministic engine must be exhaustively validated — correctness is a core differentiator |
| **NFR-T2** | Phase computation coverage | All 81 phase-state permutations (3^4) covered by unit tests | Every possible combination of 4 phases × 3 states must have an expected outcome |
| **NFR-T3** | Component test coverage | >70% test coverage for all Workflow components | UI components must be testable with mock data per NFR-M1 |
| **NFR-T4** | Integration test fixture | Use actual `_bmad/` directory from this repository as real-world test fixture | Tests validate against real BMAD file structures, not synthetic mocks |
| **NFR-T5** | File state test matrix | Explicit test cases for all 6 file states (empty, partial, complete, malformed, mid-write, permission-denied) | Error resilience (NFR-R1) must be proven, not assumed |

---
