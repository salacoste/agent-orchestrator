# BMAD Workflows

Structured processes that guide AI agents through development tasks.

## 🔄 Workflow Categories

### 1. Analysis Phase (1-analysis)

| Workflow | Purpose | Agent |
|----------|---------|-------|
| **Brainstorming** | Generate diverse ideas through interactive techniques | analyst |
| **Market Research** | Market analysis, competitive landscape, customer needs | analyst |
| **Domain Research** | Industry domain deep dive, subject matter expertise | analyst |
| **Technical Research** | Technical feasibility, architecture options | analyst |
| **Create Brief** | Guided experience to nail down product idea | analyst |

### 2. Planning Phase (2-planning)

| Workflow | Purpose | Agent |
|----------|---------|-------|
| **Create PRD** | Expert facilitation to produce Product Requirements Document | pm |
| **Validate PRD** | Validate PRD is comprehensive, lean, well-organized | pm |
| **Edit PRD** | Improve and enhance existing PRD | pm |
| **Create UX** | Guidance through UX plan for your project | ux-designer |
| **Create Architecture** | Document technical decisions | architect |
| **Create Epics and Stories** | Create the epics and stories listing | pm |
| **Check Implementation Readiness** | Ensure PRD, UX, Architecture, Epics aligned | architect |

### 3. Solutioning Phase (3-solutioning)

| Workflow | Purpose | Agent |
|----------|---------|-------|
| **Create Architecture** | Guided workflow for technical decisions | architect |
| **Create Epics and Stories** | Create epics and stories listing | pm |
| **Check Implementation Readiness** | Validate alignment before implementation | architect |

### 4. Implementation Phase (4-implementation)

| Workflow | Purpose | Agent |
|----------|---------|-------|
| **Sprint Planning** | Generate sprint plan for development tasks | sm |
| **Sprint Status** | Summarize sprint status and route to next workflow | sm |
| **Create Story** | Prepare story for implementation | sm |
| **Validate Story** | Validate story readiness before development | sm |
| **Dev Story** | Execute story implementation and tests | dev |
| **QA Automation Test** | Generate automated E2E tests | qa |
| **Code Review** | Review implemented code | dev |
| **Retrospective** | Review completed work and lessons learned | sm |

### 5. Quick Flow (anytime)

| Workflow | Purpose | Agent |
|----------|---------|-------|
| **Quick Spec** | Create quick tech spec for small changes | quick-flow-solo-dev |
| **Quick Dev** | Implement quick tech spec | quick-flow-solo-dev |

### 6. Anytime Workflows

| Workflow | Purpose | Agent |
|----------|---------|-------|
| **Document Project** | Analyze existing project to produce documentation | analyst |
| **Generate Project Context** | Generate lean LLM-optimized project-context.md | analyst |
| **Correct Course** | Navigate significant changes during development | sm |
| **Write Document** | Create detailed documentation | tech-writer |

### 7. Core Workflows

| Workflow | Purpose |
|----------|---------|
| **Party Mode** | Orchestrate multi-agent discussions |
| **Advanced Elicitation** | Deep requirement discovery |
| **Index Docs** | Create lightweight index for quick LLM scanning |
| **Shard Document** | Split large documents into smaller files |
| **Editorial Review - Prose** | Review prose for clarity and communication |
| **Editorial Review - Structure** | Propose cuts, reorganization, simplification |
| **Adversarial Review** | Critical review to find issues and weaknesses |
| **Edge Case Hunter** | Walk branching paths and boundary conditions |

## 🎯 Workflow Selection Guide

| Goal | Phase | Workflow |
|------|-------|----------|
| New product idea | Analysis | Brainstorming → Create Brief |
| Requirements doc | Planning | Create PRD |
| Technical design | Solutioning | Create Architecture |
| Implementation plan | Implementation | Sprint Planning |
| Build feature | Implementation | Create Story → Dev Story |
| Small change | Quick Flow | Quick Spec → Quick Dev |
| Generate tests | Implementation | QA Automation Test |
| Review code | Implementation | Code Review |

## 📖 Workflow Files

Workflow definitions are located in:
- `/_bmad/bmm/workflows/` — BMM module workflows
- `/_bmad/core/workflows/` — Core framework workflows

---

**Last Updated**: 2026-03-05
