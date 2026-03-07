---
id: task-5
title: Support IssueUpdate.comment in BMad tracker
status: Done
assignee: []
created_date: '2026-03-04 17:13'
updated_date: '2026-03-04 17:13'
labels:
  - bmad
  - backend
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The IssueUpdate type has a comment field that GitHub and Linear trackers implement. BMad's updateIssue now processes it, appending comments to sprint-history.jsonl as audit trail entries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 updateIssue processes comment field when provided
- [x] #2 Comments appended to sprint-history.jsonl as comment-type entries
- [x] #3 Existing state-only updates continue to work unchanged
- [x] #4 Unit tests for comment append with and without state change
<!-- AC:END -->
