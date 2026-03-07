---
id: task-6
title: Refactor review-check CLI to use SCM plugin
status: Done
assignee: []
created_date: '2026-03-04 17:13'
updated_date: '2026-03-04 17:13'
labels:
  - cli
  - backend
  - refactor
  - scm
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The CLI review-check command called gh CLI directly instead of using the SCM plugin. Refactored to use SCM interface for consistency and to support non-GitHub SCM plugins.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 review-check uses SCM.getPendingComments() instead of direct gh calls
- [x] #2 review-check uses SCM.getReviews() for review status
- [x] #3 Works with any SCM plugin, not just GitHub
- [x] #4 Session resolution uses session-manager instead of raw tmux parsing
- [x] #5 Existing review-check behavior preserved for GitHub users
- [x] #6 Unit tests mock SCM interface instead of gh CLI
<!-- AC:END -->
