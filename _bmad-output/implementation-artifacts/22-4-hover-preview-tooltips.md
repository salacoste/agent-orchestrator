# Story 22.4: Hover Preview Tooltips

Status: done

## Story
As a **user**, I want hover previews for any story/agent reference, So that I get context without navigating away.

## Acceptance Criteria
1. Hovering any story ID or agent reference shows tooltip: status, agent, last activity, metrics
2. Tooltip appears within 200ms, dismisses on mouse-out
3. Works consistently across all dashboard pages

## Tasks
- [ ] Task 1: Create HoverPreview component (tooltip with delay)
- [ ] Task 2: Wrap story/agent references throughout dashboard
- [ ] Task 3: Write tests + validate

## Dev Notes
### Source Files
- `packages/web/src/components/` — HoverPreview component
- Wrap references in WorkflowDashboard, FleetMatrix, AgentSessionCard

## Dev Agent Record
### Agent Model Used
{{agent_model_name_version}}
### File List
