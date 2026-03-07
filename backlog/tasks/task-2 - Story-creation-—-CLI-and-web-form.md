---
id: task-2
title: Story creation — CLI and web form
status: Done
assignee: []
created_date: '2026-03-04 17:13'
updated_date: '2026-03-04 17:13'
labels:
  - bmad
  - cli
  - web
  - frontend
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create new stories via CLI command and web form. Writes new entry to sprint-status.yaml with status "backlog", creates story template file, appends creation event to sprint-history.jsonl.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ao create CLI adds story to sprint-status.yaml with backlog status
- [x] #2 story-{id}.md template file is created in output directory
- [x] #3 Creation event appended to sprint-history.jsonl
- [x] #4 Web form at /sprint/[project]/create with title, epic, description fields
- [x] #5 Web form POSTs to /api/sprint/[project]/story/create
- [x] #6 Validates: unique story ID, required title, valid epic reference
- [x] #7 Unit tests for createStory() covering normal and error cases
<!-- AC:END -->
