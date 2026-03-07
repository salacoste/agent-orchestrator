---
id: task-3
title: Add CLI/web UI for setting sprintEndDate
status: Done
assignee: []
created_date: '2026-03-04 17:13'
updated_date: '2026-03-04 17:13'
labels:
  - bmad
  - cli
  - web
  - ux
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
forecast.ts reads project.tracker.sprintEndDate to compute pace, but there's no way to set it. Add ao sprint-config command and web API endpoint to set/update sprint dates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ao sprint-config [project] --end-date YYYY-MM-DD sets sprintEndDate in agent-orchestrator.yaml
- [x] #2 Web API PATCH /api/sprint/[project]/config updates sprint dates
- [x] #3 Sprint board shows sprint end date when configured
- [x] #4 Forecast pace switches from no-data to ahead/on-pace/behind after setting end date
- [x] #5 Validation: date must be in the future
<!-- AC:END -->
