# BMAD AI Agents

AI agents that automate software development tasks in the BMAD framework.

## 🤖 Agent Catalog

### Core Development Agents

| Agent | Role | Description |
|-------|------|-------------|
| **pm** | Product Manager | Creates PRDs, breaks down epics and stories, manages product requirements |
| **sm** | Scrum Master | Sprint planning, daily standup, retrospectives, story preparation |
| **dev** | Developer | Implements stories, writes code, creates tests |
| **qa** | QA Engineer | Test planning, E2E test generation, quality validation |

### Specialist Agents

| Agent | Role | Description |
|-------|------|-------------|
| **architect** | System Architect | Technical architecture, design decisions, scalability planning |
| **analyst** | Business Analyst | Market research, domain research, competitive analysis |
| **ux-designer** | UX Designer | User research, UX patterns, design system planning |
| **tech-writer** | Technical Writer | Documentation, guides, API documentation |

### Fast-Track Agents

| Agent | Role | Description |
|-------|------|-------------|
| **quick-flow-solo-dev** | Solo Developer | Fast feature development without extensive planning |

## 📋 Agent Details

### pm (Product Manager)
- **Creates**: PRDs, epics, user stories
- **Workflows**: create-prd, create-epics-and-stories, sprint-planning
- **Focus**: Product requirements and stakeholder alignment

### sm (Scrum Master)
- **Creates**: Sprint plans, standup notes, retrospective reports
- **Workflows**: sprint-planning, sprint-status, create-story, retrospective
- **Focus**: Sprint execution and team coordination

### dev (Developer)
- **Creates**: Implemented code, tests, story implementations
- **Workflows**: dev-story, quick-dev
- **Focus**: Code implementation and testing

### qa (QA Engineer)
- **Creates**: Test plans, E2E tests, validation reports
- **Workflows**: qa-generate-e2e-tests, code-review
- **Focus**: Quality assurance and testing

### architect (System Architect)
- **Creates**: Architecture documents, technical decisions
- **Workflows**: create-architecture, check-implementation-readiness
- **Focus**: System design and technical planning

### analyst (Business Analyst)
- **Creates**: Research reports, market analysis, domain studies
- **Workflows**: market-research, domain-research, technical-research
- **Focus**: Business and technical research

### ux-designer (UX Designer)
- **Creates**: UX designs, user journey maps, design systems
- **Workflows**: create-ux-design
- **Focus**: User experience and interface design

### tech-writer (Technical Writer)
- **Creates**: Documentation, guides, API docs
- **Workflows**: document-project, write-document
- **Focus**: Technical communication

### quick-flow-solo-dev (Solo Developer)
- **Creates**: Quick implementations, small features
- **Workflows**: quick-spec, quick-dev
- **Focus**: Fast development without extensive planning

## 🚀 Using Agents

### Load an Agent
```bash
# Via BMAD Master
/load [agent-name]

# Example
/load architect
```

### Run a Workflow
```bash
# After loading agent
/workflow [workflow-name]

# Example
/workflow create-architecture
```

### Agent Selection Guide

| Task Type | Best Agent |
|-----------|------------|
| New feature planning | pm |
| Sprint planning | sm |
| Implementation | dev |
| Testing | qa |
| Architecture | architect |
| Research | analyst |
| UX design | ux-designer |
| Documentation | tech-writer |
| Quick feature | quick-flow-solo-dev |

---

**Source**: Agent definitions in `/_bmad/bmm/agents/`
