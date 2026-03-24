# Story 48.6: Investigation Spike — Swarm Intelligence

Status: done

## Story

As a team exploring autonomous agent coordination,
I want a technical assessment of decentralized agent decision-making,
so that we can decide whether swarm patterns are feasible.

## Tasks / Subtasks

- [x] Task 1: Research and produce technical assessment document
  - [x] 1.1: Evaluate swarm algorithms
  - [x] 1.2: Assess applicability to orchestration
  - [x] 1.3: Document messaging requirements
  - [x] 1.4: Provide effort estimate and recommendation

## Technical Assessment: Swarm Intelligence

### Algorithm Options

| Algorithm | Concept | Applicability | Complexity |
|-----------|---------|---------------|------------|
| **Ant Colony Optimization** | Pheromone trails on paths — agents leave success/failure signals that influence future decisions | HIGH — agents "mark" stories as successful/risky, future agents avoid risky stories | Medium |
| **Particle Swarm** | Agents converge toward best-known solution by sharing position/velocity | LOW — agents work on discrete stories, not continuous optimization spaces | High |
| **Stigmergy** | Indirect coordination through environment modification — agents read/write shared state | HIGH — already partially implemented via learning store and session metadata | Low |

### Applicability to Agent Orchestration

**Best fit: Stigmergy + Ant Colony hybrid**

1. **Stigmergy (already have it)**: Agents read learning store before starting → adjust approach based on past outcomes. This IS swarm intelligence — we just don't call it that.
2. **Ant Colony pheromones**: Add a "confidence" signal per story/domain. Failed agents decrease confidence, successful ones increase it. Pre-flight check (47.6) already does this.
3. **Direct negotiation (47.1)**: Agents negotiate file conflicts via message bus — another swarm pattern.

### Messaging Requirements

- **Message bus (46a.3)**: Already supports pub/sub channels ✅
- **Pheromone signals**: Could use `bus.publish("swarm.pheromone", { storyId, confidence })`
- **Convergence**: Agents subscribe to pheromone channel and weight story selection

### What We Already Have (vs What's New)

| Swarm Capability | Status |
|-----------------|--------|
| Shared memory (learning store) | ✅ Implemented |
| Agent-to-agent messaging | ✅ Implemented (46a.3) |
| Success/failure signals (confidence) | ✅ Implemented (47.6 pre-flight) |
| Direct negotiation | ✅ Implemented (47.1) |
| Pheromone-based story selection | ❌ New — weighted random based on accumulated signals |
| Emergent task prioritization | ❌ New — agents collectively prioritize without central control |

### Effort Estimate

- **Pheromone signal layer**: 1-2 weeks (new channel type on message bus)
- **Weighted story selection**: 1 week (modify autopilot to consider pheromones)
- **Emergent prioritization**: 2-3 weeks (research + implementation + tuning)

### Recommendation: **NO-GO for dedicated swarm system — we already have 80% of it**

The orchestrator already implements stigmergy (learning store), negotiation (47.1), and confidence signaling (47.6). Adding a formal "swarm" layer would add complexity without proportional benefit. Instead:

1. **Enhance pre-flight check** with accumulated confidence from past agents (pheromone effect)
2. **Let autopilot use confidence scores** to prioritize story selection
3. **These are incremental improvements**, not a swarm system rewrite

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### File List

- _bmad-output/implementation-artifacts/48-6-spike-swarm-intelligence.md
