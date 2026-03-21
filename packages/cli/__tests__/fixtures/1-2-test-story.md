# Story 1.2: Story-Aware Agent Spawning

Status: ready-for-dev

## Story

As a Product Manager,
I want to spawn an agent with story context from sprint-status.yaml via `ao spawn --story`,
so that agents begin work with full acceptance criteria without manual setup.

## Acceptance Criteria

1. `ao spawn --story <id>` reads story from sprint-status.yaml and passes context via prompt builder
2. Optional `--agent <name>` flag to select specific agent plugin
3. Unresolved dependencies trigger warning message with confirmation prompt

## Tasks / Subtasks

- [ ] Task 1: Add --story flag to ao spawn
- [ ] Task 2: Integrate with prompt builder
