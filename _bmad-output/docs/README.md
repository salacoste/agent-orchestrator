# BMAD Framework Documentation

**BMAD (Business Management & Development)** — AI-powered framework for managing software development projects with intelligent agents.

## 📁 Documentation Structure

```
_bmad-output/docs/
├── README.md                   # This file
├── project-context.md          # AI agent rules (root level)
├── integration/                # BMAD integration docs
│   ├── tracker-plugin.md       # BMAD tracker plugin documentation
│   ├── cli-commands.md         # CLI commands reference
│   └── web-dashboard.md        # Web dashboard guide
├── agents/                     # AI Agent descriptions
│   └── README.md               # Agent catalog
└── workflows/                  # Workflow descriptions
    └── README.md               # Workflow overview
```

## 🎯 Quick Start

### For AI Agents
1. Read `../project-context.md` for implementation rules
2. Follow all documented conventions exactly

### For Humans
1. Start with `integration/` to understand BMAD capabilities
2. Use `agents/README.md` to find the right agent for your task
3. Reference `workflows/README.md` for development processes

## 📚 Documentation Areas

### Integration (`integration/`)
Documentation for BMAD integration into agent-orchestrator:
- **Tracker Plugin** — File-based issue tracking with YAML/JSONL
- **CLI Commands** — Command-line interface for sprint operations
- **Web Dashboard** — Next.js dashboard for sprint visualization

### Agents (`agents/`)
AI agents that automate development tasks:
- **pm** — Product Manager (PRD, epics, stories)
- **sm** — Scrum Master (sprint planning, standup, retro)
- **dev** — Developer (story implementation)
- **qa** — QA Engineer (testing, validation)
- **architect** — System design and architecture
- **analyst** — Business analysis and research
- **ux-designer** — UX/UI design and user research
- **tech-writer** — Technical documentation
- **quick-flow-solo-dev** — Fast feature development

### Workflows (`workflows/`)
Structured processes for development:
- **Brainstorming** — Idea generation techniques
- **Party Mode** — Multi-agent collaboration
- **Advanced Elicitation** — Deep requirement discovery
- And many more...

## 🔗 Related Resources

- **Main Project Docs**: `/docs/` — General development documentation
- **BMAD Framework**: `/_bmad/` — Framework source code
- **Agent Config**: `/_bmad/bmm/config.yaml` — BMAD configuration

---

**Last Updated**: 2026-03-05
