# Story 20.3: Parallelism Opportunity Finder

Status: done

## Story
As a **PM**, I want the system to identify safe parallelism in the dependency graph, So that I can spawn concurrent agents and save time.

## Acceptance Criteria
1. Analyzes story dependencies and identifies stories with no mutual dependencies
2. Shows Gantt-like sequential vs parallel comparison
3. "Spawn parallel" button spawns multiple agents simultaneously

## Tasks
- [ ] Task 1: Analyze sprint dependency graph for parallelizable stories
- [ ] Task 2: Compute time savings estimate (sequential vs parallel)
- [ ] Task 3: Display parallelism opportunities in dashboard
- [ ] Task 4: Write tests + validate

## Dev Notes
### Source Files
- `packages/web/src/lib/workflow/` — parallelism analysis module
- `packages/web/src/components/` — parallelism visualization

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
