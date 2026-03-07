---
id: task-1
title: Drag-and-drop sprint board with YAML write-back
status: Done
assignee: []
created_date: '2026-03-04 17:13'
updated_date: '2026-03-04 17:13'
labels:
  - bmad
  - frontend
  - web
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enable drag-and-drop story reordering between columns on the web SprintBoard. When a story is moved, write the status change back to sprint-status.yaml and append a transition to sprint-history.jsonl.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Stories can be dragged between columns on SprintBoard
- [x] #2 Drop triggers PATCH /api/sprint/[project]/story/[id]/move with new status
- [x] #3 sprint-status.yaml is updated with new status
- [x] #4 sprint-history.jsonl gets a transition entry with timestamp
- [x] #5 Optimistic UI update with rollback on API failure
- [x] #6 Conflict detection if status was changed by another source
- [x] #7 Works on desktop browsers (Chrome, Firefox, Safari)
<!-- AC:END -->
