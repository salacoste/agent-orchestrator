---
id: task-4
title: Remove hardcoded BMad plugin checks from lifecycle-manager
status: Done
assignee: []
created_date: '2026-03-04 17:13'
updated_date: '2026-03-04 17:13'
labels:
  - bmad
  - backend
  - architecture
  - refactor
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lifecycle-manager.ts checks project.tracker?.plugin === "bmad" in two places to conditionally emit events. Refactored to use tracker capability interface instead.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No hardcoded plugin === 'bmad' checks in lifecycle-manager
- [x] #2 Tracker interface extended with optional capability methods or event hooks
- [x] #3 BMad plugin implements the capability interface
- [x] #4 Other tracker plugins unaffected by the change
- [x] #5 Existing bmad.story_done and bmad.sprint_complete events still emitted correctly
- [x] #6 Unit tests verify capability-based dispatch
<!-- AC:END -->
