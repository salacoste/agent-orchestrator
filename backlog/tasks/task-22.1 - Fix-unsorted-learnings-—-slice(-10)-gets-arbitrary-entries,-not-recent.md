---
id: task-22.1
title: 'Fix: unsorted learnings — slice(-10) gets arbitrary entries, not recent'
status: To Do
assignee: []
created_date: '2026-03-24 11:40'
labels:
  - edge-case
  - pre-flight
dependencies: []
parent_task_id: task-22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**File:** `pre-flight-check.ts:93`\n**Trigger:** learnings array is not sorted by time; slice(-10) gets arbitrary entries\n**Fix:** `const sorted = [...matching].sort((a,b) => a.completedAt.localeCompare(b.completedAt));`\n**Consequence:** Recent failure rate computed from random 10 entries, not actually recent ones
<!-- SECTION:DESCRIPTION:END -->
